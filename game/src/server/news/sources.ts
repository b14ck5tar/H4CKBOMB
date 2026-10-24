import "server-only";

// News fetchers for the news → quest pipeline. Source: design/02-news-to-quest.md §1.
// Every fetcher normalizes to NewsItem and never throws (failures return []).

export type NewsOrigin = "serpapi" | "serpapi_fixture" | "bbc_rss" | "local_rss" | "gnews_rss";

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

const UA = "Mozilla/5.0 (compatible; OnceUponARoll/1.0; +https://hacktx.com)";
const FETCH_TIMEOUT = 8_000;

/** Google News "Science" topic (en-US). Verified against news.google.com/rss/topics/<token>. */
export const SCIENCE_TOPIC_TOKEN = "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB";
/** Upbeat discovery search from the design doc (§5). National; now runs on free Google News RSS only. */
export const HAPPY_QUERY = "bridge OR festival OR discovered OR restored OR record OR rescued when:1d";

// ---------------------------------------------------------------- home area (local-first news)

/**
 * The players' home area. Quests prefer stories from this city, then its state, then national, so a
 * tale can be set in the players' real city. One area per deployment (env NEWS_CITY="City, State",
 * default Austin, Texas: HackTX is at UT Austin). Not per request: every extra city would mean its own
 * SerpApi searches and its own Muse run every 4 h.
 */
export interface HomeArea {
  city: string;
  state: string;
  label: string; // "Austin, Texas"
  cityRe: RegExp; // the city, its suburbs and landmarks
  stateRe: RegExp;
}

const AUSTIN_NEARBY = [
  "Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown", "San Marcos", "Leander", "Kyle", "Buda",
  "Bastrop", "Lockhart", "Dripping Springs", "Lakeway", "Manor", "Hutto", "Travis County", "Williamson County",
  "Hays County", "Central Texas", "Lady Bird Lake", "Lake Travis", "Barton Springs", "Zilker", "UT Austin",
];

const reList = (words: string[]) =>
  new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

export function homeArea(spec = process.env.NEWS_CITY || "Austin, Texas"): HomeArea {
  const [city, state] = spec.split(",").map((s) => s.trim());
  const c = city || "Austin";
  const s = state || (c === "Austin" ? "Texas" : "");
  const near = c === "Austin" && s === "Texas" ? AUSTIN_NEARBY : [c];
  return {
    city: c,
    state: s,
    label: s ? `${c}, ${s}` : c,
    cityRe: reList(near),
    stateRe: s ? reList([s]) : /$^/,
  };
}

export const HOME = homeArea();

export type Locality = "city" | "state" | "national";
export const LOCALITY_RANK: Record<Locality, number> = { city: 0, state: 1, national: 2 };

/** Where a story happens, judged from its text (headline, snippet, article text, classifier location). */
export function locality(text: string, home: HomeArea = HOME): Locality {
  if (home.cityRe.test(text)) return "city";
  if (home.stateRe.test(text)) return "state";
  return "national";
}

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
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, text/html, */*" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------- RSS

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1].trim() : raw;
}

function attr(block: string, name: string, attribute: string): string {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function items(xml: string): string[] {
  return xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
}

/** Parse a publisher's own RSS feed (BBC, a local station): a real one-sentence description and direct links. */
export function parseDirectRss(xml: string, source: string, origin: "bbc_rss" | "local_rss"): NewsItem[] {
  return items(xml)
    .map((b) => ({
      title: stripTags(tag(b, "title")),
      source,
      link: decodeEntities(tag(b, "link")).replace(/\?at_medium=RSS.*$/, ""),
      date: toIso(tag(b, "pubDate")),
      snippet: stripTags(tag(b, "description")).slice(0, 400),
      thumbnail: attr(b, "media:thumbnail", "url") || attr(b, "media:content", "url"),
      origin,
    }))
    .filter((i) => i.title && i.link && !/\/(videos?|live|sounds|live-updates?)\//.test(i.link) && !/^live( updates)?\b/i.test(i.title));
}

/** Parse a BBC RSS feed. */
export function parseBbcRss(xml: string): NewsItem[] {
  return parseDirectRss(xml, "BBC News", "bbc_rss");
}

/** Parse a Google News RSS feed. Title is "Headline - Publisher"; description is a cluster of related headlines. */
export function parseGoogleNewsRss(xml: string): NewsItem[] {
  return items(xml)
    .map((b) => {
      const source = stripTags(tag(b, "source"));
      let title = stripTags(tag(b, "title"));
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
      // The description is an <ol> of the cluster's headlines; the first one repeats the title.
      const desc = decodeEntities(tag(b, "description"));
      const related = [...desc.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => stripTags(m[1]))
        .filter((t) => t && normalizeTitle(t) !== normalizeTitle(title))
        .slice(0, 3);
      return {
        title,
        source: source || "Google News",
        link: decodeEntities(tag(b, "link")),
        date: toIso(tag(b, "pubDate")),
        snippet: related.length ? `Related coverage: ${related.join("; ")}` : "",
        thumbnail: "",
        origin: "gnews_rss" as const,
      };
    })
    .filter((i) => i.title && i.link);
}

const GN = "https://news.google.com/rss";
const GN_PARAMS = "hl=en-US&gl=US&ceid=US:en";

/** Local: the city (any news, the filter sorts it). State: only the quirky, upbeat kind. Both free RSS. */
export const LOCAL_QUERY = `"${HOME.city}" ${HOME.state} when:3d`.replace(/\s+/g, " ").trim();
export const STATE_QUERY = HOME.state
  ? `${HOME.state} (festival OR zoo OR museum OR discovered OR record OR mystery OR strange OR rare OR reopens) when:3d`
  : "";

export type RssFeed = { name: string; url: string; kind: "bbc" | "local" | "gnews"; source?: string };

/** Free feeds, no SerpApi credits. Local ones first in spirit; dedupe priority is set in pipeline.ts. */
export const RSS_FEEDS: RssFeed[] = [
  // Austin's own station feed: direct links and real snippets (checked Oct 2026). Only for the default home.
  ...(HOME.city === "Austin" && HOME.state === "Texas"
    ? [{ name: "kxan", url: "https://www.kxan.com/feed/", kind: "local" as const, source: "KXAN Austin" }]
    : []),
  { name: "gnews-local", url: `${GN}/search?q=${encodeURIComponent(LOCAL_QUERY)}&${GN_PARAMS}`, kind: "gnews" },
  ...(STATE_QUERY ? [{ name: "gnews-state", url: `${GN}/search?q=${encodeURIComponent(STATE_QUERY)}&${GN_PARAMS}`, kind: "gnews" as const }] : []),
  { name: "bbc-science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", kind: "bbc" },
  { name: "bbc-world", url: "https://feeds.bbci.co.uk/news/world/rss.xml", kind: "bbc" },
  { name: "gnews-science", url: `${GN}/topics/${SCIENCE_TOPIC_TOKEN}?${GN_PARAMS}`, kind: "gnews" },
  { name: "gnews-search", url: `${GN}/search?q=${encodeURIComponent(HAPPY_QUERY)}&${GN_PARAMS}`, kind: "gnews" },
  { name: "gnews-top", url: `${GN}?${GN_PARAMS}`, kind: "gnews" },
];

export async function fetchRss(feed: RssFeed): Promise<NewsItem[]> {
  try {
    const xml = await getText(feed.url);
    if (feed.kind === "bbc") return parseBbcRss(xml);
    if (feed.kind === "local") return parseDirectRss(xml, feed.source ?? feed.name, "local_rss");
    return parseGoogleNewsRss(xml);
  } catch (e) {
    console.warn(`[news] rss ${feed.name} failed: ${(e as Error).message}`);
    return [];
  }
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

/**
 * Exactly 2 SerpApi searches per pipeline run (unchanged budget): national science (topic page) and the
 * home city (search). The city search replaced the national "happy" search, which now runs on free RSS.
 */
export const SERPAPI_QUERIES: Record<string, Record<string, string>> = {
  science: { engine: "google_news", topic_token: SCIENCE_TOPIC_TOKEN, gl: "us", hl: "en" },
  local: { engine: "google_news", q: LOCAL_QUERY, gl: "us", hl: "en" },
};

/**
 * Live SerpApi call. Costs 1 search credit per call (250/month on the free plan) unless SerpApi's
 * own 1-hour cache absorbs it. Callers must gate this (see pipeline.ts). Never sends no_cache.
 */
export async function fetchSerpApi(name: keyof typeof SERPAPI_QUERIES): Promise<NewsItem[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  try {
    const u = new URL("https://serpapi.com/search.json");
    for (const [k, v] of Object.entries(SERPAPI_QUERIES[name])) u.searchParams.set(k, v);
    u.searchParams.set("api_key", key);
    // GET fetch → Next's Data Cache keeps it for 4h on Vercel, a second layer on top of the route cache.
    const res = await fetch(u, { signal: AbortSignal.timeout(15_000), next: { revalidate: 14400 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(String(json.error).slice(0, 120));
    console.log(`[news] serpapi ${name} ok (${json.news_results?.length ?? 0} results)`);
    return parseSerpApiGoogleNews(json);
  } catch (e) {
    console.warn(`[news] serpapi ${name} failed: ${(e as Error).message}`);
    return [];
  }
}

/** Replay the saved SerpApi responses (dev/testing; zero credits). The fixture predates the local search: its
 * "search" capture is the old national happy search, so offline runs have no Austin stories. */
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
export async function fetchArticleFacts(link: string): Promise<string> {
  if (!/^https?:\/\//.test(link) || /news\.google\.com/.test(link)) return "";
  try {
    const html = (await getText(link, 5_000)).slice(0, 400_000);
    const og =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i)?.[1] ??
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      "";
    const paras = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((p) => p.length > 60 && !/cookie|subscribe|newsletter|javascript|advertis/i.test(p))
      .slice(0, 3);
    return [decodeEntities(og), ...paras].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 900);
  } catch {
    return "";
  }
}
