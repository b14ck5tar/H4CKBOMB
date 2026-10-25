import "server-only";

// News fetchers for odd-news candidates (candidates.ts): SerpApi google_news, its saved fixture, and article facts.
// Every fetcher normalizes to NewsItem and never throws (failures return []).

export type NewsOrigin = "serpapi" | "serpapi_fixture" | "bbc_rss" | "gnews_rss";

export interface NewsItem {
  title: string;
  source: string;
  link: string;
  date: string; // ISO 8601 ("" if unknown)
  snippet: string;
  thumbnail: string;
  origin: NewsOrigin;
  sourceIcon?: string;
  storyToken?: string;
}

const UA = "Mozilla/5.0 (compatible; GroupProject/1.0; +https://hacktx.com)";
const FETCH_TIMEOUT = 8_000;

// ---------------------------------------------------------------- helpers

export function normalizeTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function toIso(d: string | undefined) {
  if (!d) return "";
  const t = Date.parse(d);
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
}

async function getText(url: string, timeoutMs = FETCH_TIMEOUT): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html, */*" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------- SerpApi google_news

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function serpStory(s: Any, extraSnippet = "", storyToken?: string): NewsItem | null {
  if (!s?.title || !s?.link) return null;
  return {
    title: String(s.title),
    source: String(s.source?.name ?? "").trim() || "Google News",
    link: String(s.link),
    date: s.iso_date ? String(s.iso_date) : toIso(String(s.date ?? "").replace(/,\s*\+0000 UTC$/, " UTC")),
    snippet: extraSnippet,
    thumbnail: String(s.thumbnail ?? s.thumbnail_small ?? ""),
    origin: "serpapi",
    sourceIcon: s.source?.icon ? String(s.source.icon) : undefined,
    storyToken: storyToken ?? (s.story_token ? String(s.story_token) : undefined),
  };
}

/**
 * Parse a SerpApi google_news response. Search pages are flat; topic pages nest a `highlight`
 * story plus `stories[]` under a cluster title. SerpApi has no snippet field, so for clusters the
 * snippet is built from the cluster title and sibling headlines.
 */
export function parseSerpApiGoogleNews(json: Any): NewsItem[] {
  const out: NewsItem[] = [];
  for (const r of json?.news_results ?? []) {
    if (r.highlight || Array.isArray(r.stories)) {
      const stories: Any[] = r.stories ?? [];
      const lead = r.highlight ?? stories[0];
      const siblings = stories.map((s) => s?.title).filter((t: unknown) => typeof t === "string" && t !== lead?.title).slice(0, 3);
      const snippet = [r.title && r.title !== lead?.title ? r.title : "", siblings.length ? `Related coverage: ${siblings.join("; ")}` : ""]
        .filter(Boolean)
        .join(". ");
      const item = serpStory(lead, snippet, r.story_token ?? lead?.story_token);
      if (item) out.push(item);
    } else {
      const item = serpStory(r);
      if (item) out.push(item);
    }
  }
  return out;
}

/** Live SerpApi calls made by this server instance (for debug stats). */
export const serpApiCalls = { count: 0 };

/**
 * Any google_news query. Costs 1 search credit per call (250/month on the free plan) unless SerpApi's own 1-hour
 * cache absorbs it; callers gate it (candidates.ts). Never sends no_cache. Never throws.
 */
export async function fetchSerpApiParams(label: string, params: Record<string, string>): Promise<NewsItem[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  try {
    const u = new URL("https://serpapi.com/search.json");
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set("api_key", key);
    serpApiCalls.count++;
    // GET fetch → Next's Data Cache keeps it for 4h, a second layer on top of the route cache.
    const res = await fetch(u, { signal: AbortSignal.timeout(15_000), next: { revalidate: 14400 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(String(json.error).slice(0, 120));
    console.log(`[news] serpapi ${label} ok (${json.news_results?.length ?? 0} results)`);
    return parseSerpApiGoogleNews(json);
  } catch (e) {
    console.warn(`[news] serpapi ${label} failed: ${(e as Error).message}`);
    return [];
  }
}

/** Replay the saved SerpApi responses (dev/testing; zero credits). */
export async function fetchSerpApiFixture(): Promise<NewsItem[]> {
  try {
    const fx: Any = (await import("./fixtures/serpapi_google_news.json")).default;
    return [...parseSerpApiGoogleNews(fx.science), ...parseSerpApiGoogleNews(fx.search)].map((i) => ({
      ...i,
      origin: "serpapi_fixture" as const,
    }));
  } catch (e) {
    console.warn(`[news] serpapi fixture failed: ${(e as Error).message}`);
    return [];
  }
}

// ---------------------------------------------------------------- dedupe + enrich

function words(t: string) {
  return new Set(normalizeTitle(t).split(" ").filter((w) => w.length > 3));
}

/**
 * Dedupe by normalized title, plus a fuzzy pass (≥60% word overlap) so the same story from two
 * publishers collapses. Earlier items win, so pass the best sources first; a missing snippet or
 * thumbnail is filled from the duplicate.
 */
export function dedupe(list: NewsItem[]): NewsItem[] {
  const out: NewsItem[] = [];
  const seen = new Map<string, NewsItem>();
  const wordSets: Set<string>[] = [];
  for (const it of list) {
    const key = normalizeTitle(it.title);
    if (!key) continue;
    let dup = seen.get(key);
    if (!dup) {
      const w = words(it.title);
      const idx = wordSets.findIndex((s) => {
        if (s.size < 3 || w.size < 3) return false;
        let common = 0;
        for (const x of w) if (s.has(x)) common++;
        return common / Math.min(s.size, w.size) >= 0.6;
      });
      if (idx >= 0) dup = out[idx];
    }
    if (dup) {
      if (!dup.snippet && it.snippet) dup.snippet = it.snippet;
      if (!dup.thumbnail && it.thumbnail) dup.thumbnail = it.thumbnail;
      continue;
    }
    const copy = { ...it };
    seen.set(key, copy);
    out.push(copy);
    wordSets.push(words(it.title));
  }
  return out;
}

/** Fetch the publisher page and read og:description plus the first 3 paragraphs. "" on failure. */
export async function fetchArticleFacts(link: string, timeoutMs = 5_000, maxChars = 900): Promise<string> {
  if (!/^https?:\/\//.test(link) || /news\.google\.com/.test(link)) return "";
  try {
    const html = (await getText(link, timeoutMs)).slice(0, 400_000);
    const og =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i)?.[1] ??
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      "";
    const paras = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((p) => p.length > 60 && !/cookie|subscribe|newsletter|javascript|advertis/i.test(p))
      .slice(0, maxChars > 900 ? 6 : 3);
    return [decodeEntities(og), ...paras].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, maxChars);
  } catch {
    return "";
  }
}
