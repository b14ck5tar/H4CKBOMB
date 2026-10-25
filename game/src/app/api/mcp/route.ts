/**
 * Group Project: MCP server for Meta Muse ("custom connector"). See MUSE_CONNECTOR.md.
 *
 * Transport: MCP Streamable HTTP, JSON-only (no SSE). Clients POST JSON-RPC 2.0 messages
 * (single or batch) to /api/mcp and get application/json back. Notifications get 202, no body.
 * GET/DELETE return 405 (we never open a server-to-client stream and keep no sessions).
 *
 * Auth (optional): if env MCP_TOKEN is set, every POST needs `Authorization: Bearer <MCP_TOKEN>`.
 *
 * Tools: start_game_night, list_todays_tales, invite_message (see TOOLS below). All read-only: nothing is sent,
 * no room is created server-side. The TV creates the room when the link is opened.
 *
 * ── TV-PAGE CONTRACT (game/src/app/tv/page.tsx) ────────────────────────────────────────────────────────
 *   /tv?party=<name>&mode=quick&quest=<curated seed id>
 *     party  optional. Prefills the party name.
 *     mode   optional. "quick" opens the ~4 min Quick Tale (one scene, the boulder story unless quest is set).
 *     quest  optional. A curated seed id from src/data/seed_quests.json. Pins that story (skips the story vote).
 *            Live odd-news stories can NOT be pinned by link: their opener is written while the table votes,
 *            so for odd news we send no quest and the table votes on three live headlines.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Data: odd-news candidates come from GET /api/news?rating=… ({ quests: [{id, headline, snippet, source, url,
 * date, place, rating}] }, cached 4 h server-side, so this never spends SerpApi credits on its own beyond what
 * the app already does). If it is empty or slow, the curated seeds are the whole catalog.
 */
import { NextResponse, type NextRequest } from "next/server";
import seedsJson from "@/data/seed_quests.json";
import type { QuestSeed, Rating } from "@/lib/types";
import { DEFAULT_RATING, isRating, questAllowed } from "@/lib/rating";
import { QUICK } from "@/lib/quick";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEEDS = seedsJson as unknown as QuestSeed[];
const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "group-project", version: "2.0.0", title: "Group Project" };
const NEWS_TIMEOUT_MS = 8000; // a cold /api/news (first compile, or a 4 h refresh) can take a few seconds

// ─── JSON-RPC plumbing ───────────────────────────────────────────────────────────────────────

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}
type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const err = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", "Mcp-Protocol-Version": PROTOCOL_VERSION, ...extra },
  });
}

function getOrigin(req: NextRequest): string {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host).split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "") || "https")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

// ─── Story catalog ───────────────────────────────────────────────────────────────────────────

/** A live odd-news headline (GET /api/news). The table sees these headlines in the story vote, so they're no spoiler. */
interface OddNews {
  id: string;
  headline: string;
  teaser: string;
  place: string;
  source: string;
  date: string;
  rating: Rating;
}

/** A curated, hand-written story (seed_quests.json). The only kind a link can pin. */
interface ReadyMade {
  id: string;
  title: string;
  teaser: string;
  category: string;
  rating: Rating;
  keywords: string; // lowercase blob for vibe matching; never shown
}

const firstSentence = (s: string) => (s || "").split(/(?<=[.!?])\s/)[0].trim();
const clip = (s: string, max: number) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > max / 2 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
};

function toReadyMade(q: QuestSeed): ReadyMade {
  return {
    id: q.id,
    title: q.quest_title,
    teaser: firstSentence(q.quick_scene?.narration || q.fairytale_premise),
    category: (q.category || "mystery").replace(/_/g, " & "),
    rating: q.rating ?? "teens",
    keywords: [
      q.category,
      q.tone,
      q.quest_title,
      q.realm_name,
      q.fairytale_premise,
      q.the_threat?.name,
      q.the_threat?.description,
      q.the_goal?.description,
      ...(q.locations || []).map((l) => `${l.name} ${l.description}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function readyMadeFor(rating: Rating): ReadyMade[] {
  return SEEDS.filter((q) => questAllowed(q.rating, rating)).map(toReadyMade);
}

/** /api/news sends candidates ({headline, …}); an older build sent whole quest seeds. Accept both. */
function toOddNews(x: unknown): OddNews | null {
  const o = x as Record<string, unknown> & { the_real_story?: Record<string, string> };
  if (!o || typeof o !== "object") return null;
  const rs = o.the_real_story;
  const headline = typeof o.headline === "string" ? o.headline : rs?.headline;
  if (!headline) return null;
  const r = o.rating;
  return {
    id: String(o.id ?? headline).slice(0, 80),
    headline: clip(headline, 160),
    teaser: clip(String((typeof o.headline === "string" ? o.snippet : rs?.summary) ?? ""), 200),
    place: String(o.place ?? o.realm_name ?? ""),
    source: String((typeof o.headline === "string" ? o.source : rs?.source) ?? ""),
    date: String((typeof o.headline === "string" ? o.date : rs?.date) ?? "").slice(0, 10),
    rating: isRating(r) ? r : "teens",
  };
}

async function fetchOddNews(origin: string, rating: Rating): Promise<OddNews[]> {
  try {
    const res = await fetch(`${origin}/api/news?rating=${rating}`, {
      signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { quests?: unknown; candidates?: unknown };
    const raw = Array.isArray(data.candidates) ? data.candidates : Array.isArray(data.quests) ? data.quests : [];
    const seen = new Set<string>();
    return raw
      .map(toOddNews)
      .filter((c): c is OddNews => !!c && !seen.has(c.id) && !!seen.add(c.id))
      .slice(0, 10);
  } catch {
    return []; // 404, timeout, bad JSON: curated stories only
  }
}

// Vibe words → categories. Category hits score highest; free-text keyword hits add up.
const VIBES: Record<string, string[]> = {
  unexplained: ["spooky", "creepy", "eerie", "ghost", "haunted", "dark", "unexplained", "unknown", "supernatural", "paranormal", "mystery", "mysterious", "strange", "weird", "uncanny", "rocks", "boulder", "cave", "hiking", "ufo", "alien"],
  science_space: ["space", "science", "stars", "star", "galaxy", "astronomy", "radio", "signal", "alien", "aliens", "telescope", "scifi", "cosmic", "mystery"],
  environment: ["ocean", "sea", "beach", "water", "climate", "eco", "environment", "nature", "outdoors", "coast", "tide", "eggs", "fish"],
  infrastructure: ["city", "town", "bridge", "road", "engineering", "build", "river", "night", "urban", "adventure"],
  quirky: ["silly", "funny", "goofy", "quirky", "chaos", "chaotic", "kids", "kid", "family", "food", "halloween", "pumpkin", "autumn", "fall", "festival", "harvest", "garden", "cozy", "wholesome"],
  animals_nature: ["nature", "outdoors", "animal", "animals", "otter", "forest", "river", "wild", "wildlife", "cute", "kids", "family", "wholesome"],
  tech_ai: ["tech", "robot", "robots", "bots", "ai", "computer", "computers", "nerdy", "geeky", "internet", "games", "gaming"],
};
const QUICK_WORDS = /\b(quick|short|demo|fast|judges?|minutes?)\b/i;

function pickByVibe(stories: ReadyMade[], vibe: string): ReadyMade | undefined {
  const words = (vibe.toLowerCase().match(/[a-z]+/g) || []).filter((w) => !QUICK_WORDS.test(w));
  if (!words.length) return undefined;
  let best: ReadyMade | undefined;
  let bestScore = 0;
  for (const t of stories) {
    const cat = t.category.replace(/ & /g, "_").toLowerCase();
    let score = 0;
    for (const w of words) {
      if (w.length < 2) continue;
      if (cat.includes(w)) score += 6;
      if ((VIBES[cat] || []).includes(w)) score += 4;
      if (w.length >= 3 && new RegExp(`\\b${w}`).test(t.keywords)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 2 ? best : undefined;
}

// ─── Tools ───────────────────────────────────────────────────────────────────────────────────

const RATING_PROP = {
  type: "string",
  enum: ["kids", "teens", "adults"],
  description: "Who is playing: 'kids' (under 13 or mixed with little ones), 'teens' (13+, the default) or 'adults'. Filters which stories are offered.",
} as const;

const TOOLS = [
  {
    name: "start_game_night",
    title: "Start a game night",
    description:
      "Start a Group Project game night: a co-op story game for 2-6 friends in the same room. A laptop or TV is the table, everyone's phone is their controller (scan a QR, no app), and Muse is the Dungeon Master. " +
      "Players take turns; on your turn everyone else suggests a move, you pick one, and a d20 decides how it goes. Stories come from odd, harmless real news (the table votes on three live headlines) or from the players' own true stories, and the end reveals what really happened. " +
      "Call this when the user wants to start, host or set up a game night, party game or story game. Returns a link to open on the TV/laptop, the join link for phones, and a ready-to-paste invite. " +
      "Use mode 'quick' when they want something short or a demo (about 5 minutes). Leave quest_id and vibe empty for the normal live odd-news vote; set vibe (e.g. 'spooky', 'space', 'animals', 'silly') or quest_id (a ready-made id from list_todays_tales) only when they asked for a particular kind of story.",
    inputSchema: {
      type: "object",
      properties: {
        party_name: { type: "string", description: "Name of the group playing, e.g. 'The Cousins' or 'Friday Crew'." },
        mode: { type: "string", enum: ["full", "quick"], description: "'full' (default, 10-15 min, turns scale with the group) or 'quick' (one scene, about 5 min, good for a demo)." },
        quest_id: { type: "string", description: "A ready-made story id from list_todays_tales. Pins that story. Odd-news ids cannot be pinned: the table votes on those." },
        vibe: { type: "string", description: "Optional mood for a ready-made story, e.g. 'spooky', 'space', 'animals', 'silly'. Leave empty to play live odd news." },
        when: { type: "string", description: "Optional, for the invite text: when it happens, e.g. 'Friday at 8pm'." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_todays_tales",
    title: "List today's tales",
    description:
      "List what Group Project can play right now: today's odd news (strange, harmless real headlines from around the world this week, filtered for anything sad, violent or political; the table votes on three of them) and the ready-made stories (hand-written, can be picked by id). " +
      "Call this when the user asks what stories they could play, what's in the news tonight, or wants to choose before start_game_night.",
    inputSchema: { type: "object", properties: { rating: RATING_PROP }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "invite_message",
    title: "Write a game-night invite",
    description:
      "Write a short, friendly group-chat invite for a Group Project game night that the user can paste to friends, including how to join (phones only, no app). " +
      "Call this when the user wants to invite people or asks for a message to send. Returns text only; it never sends anything.",
    inputSchema: {
      type: "object",
      properties: {
        party_name: { type: "string", description: "Name of the group, e.g. 'The Cousins'." },
        when: { type: "string", description: "When it happens, e.g. 'Friday at 8pm' or 'tonight after dinner'." },
        mode: { type: "string", enum: ["full", "quick"], description: "Optional: 'quick' says it only takes a few minutes." },
      },
      required: ["party_name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = <T,>(arr: readonly T[], seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
};
const tableLink = (origin: string, party: string, quick: boolean, questId: string) => {
  const qs = new URLSearchParams();
  if (party) qs.set("party", party);
  if (quick) qs.set("mode", "quick");
  if (questId) qs.set("quest", questId);
  const s = qs.toString();
  return `${origin}/tv${s ? `?${s}` : ""}`;
};

const OPENERS = ["Game night!", "Heads up, group chat!", "Official summons:", "Clear your evening:", "Story night, who's in?"];
const HOOKS = [
  "We play heroes in a story built from something weird that really happened this week, and at the end we find out what actually happened.",
  "It's a co-op story game. On your turn, everyone yells ideas, you pick one, and a d20 decides if it works.",
  "Muse runs the story and does the voices. We just take turns, help each other out and roll dice.",
  "Bring a weird true story of your own if you have one. We might play it, and only you know how it really ended.",
];
const CLOSERS = [
  "Bring your phone and your worst ideas.",
  "No prep, no rules to learn. Nobody has to be good at anything.",
  "Your phone is your controller. Charge it.",
  "The dice are real and they do not care about your feelings.",
];

function inviteText(origin: string, party: string, when: string, quick: boolean) {
  const seed = party + when;
  const whenLine = when ? `When: ${when}.` : "When: soon. Watch this chat.";
  return [
    `${pick(OPENERS, seed)} ${party ? `${party}, you're` : "You're"} invited to Group Project${quick ? " (a quick one, about 5 minutes)" : ""}.`,
    pick(HOOKS, seed + "h"),
    whenLine,
    `How to join: scan the QR code on the TV with your phone (or open ${origin}/play and type the 4-letter room code). No app, no account.`,
    pick(CLOSERS, seed + "c"),
  ].join("\n");
}

async function startGameNight(args: Record<string, unknown>, origin: string): Promise<ToolResult> {
  const party = str(args.party_name, 40);
  const questIdArg = str(args.quest_id, 80);
  const vibe = str(args.vibe, 120);
  const when = str(args.when, 80);
  const quick = args.mode === "quick" || (args.mode !== "full" && QUICK_WORDS.test(vibe));
  const rating = DEFAULT_RATING; // the TV starts at the default; Kids/Adults is picked in the TV lobby
  const ready = readyMadeFor(rating);

  let story: ReadyMade | undefined;
  let choice = "";
  if (questIdArg) {
    story = ready.find((t) => t.id === questIdArg);
    if (story) choice = "requested";
    else if (/^news-/.test(questIdArg)) choice = "odd-news stories can't be pinned by link; the table votes on three live headlines";
    else choice = `story "${questIdArg}" not found`;
  }
  if (!story && vibe) {
    story = pickByVibe(ready, vibe);
    if (story) choice = choice ? `${choice}; best match for "${vibe}" instead` : `best match for "${vibe}"`;
  }
  if (!story && quick) {
    story = ready.find((t) => t.id === QUICK.defaultQuest);
    if (story) choice = choice ? `${choice}; Quick Tale's demo story instead` : "Quick Tale's demo story";
  }

  // Full night with nothing pinned = the live odd-news vote. Show what's on the board (no extra cost: cached).
  const news = story ? [] : await fetchOddNews(origin, rating);
  if (!story) choice = choice ? `${choice}; the table will vote` : "the table votes on three odd-news headlines";

  // Quick Tale's default story needs no quest param (the TV preselects it), which keeps the link short.
  const pinId = story && !(quick && story.id === QUICK.defaultQuest) ? story.id : "";
  const url = tableLink(origin, party, quick, pinId);
  const who = party || "your group";
  const invite = inviteText(origin, party, when, quick);

  const storyLine = story
    ? `Story: "${story.title}" (${story.category}). ${story.teaser}`
    : news.length
      ? `Story: the table votes on three of tonight's odd news headlines, for example:\n${news
          .slice(0, 3)
          .map((n) => `- ${n.headline}${n.place ? ` (${n.place})` : ""}`)
          .join("\n")}\n(Or pick "Our stories" on the TV and everyone writes a small true story of their own.)`
      : `Story: the table votes on three ready-made stories (live news isn't loaded right now). Or pick "Our stories" on the TV and everyone writes a small true story of their own.`;

  const text =
    `Your table is ready for ${who}${quick ? " (Quick Tale, about 5 minutes)" : ""}.\n\n` +
    `1. Open this on a TV or laptop: ${url}\n` +
    `2. Everyone scans the QR on the TV with their phone (or opens ${origin}/play and types the room code). 2-6 players, no app, no account.\n` +
    `3. Each player describes a hero in one line, then the host taps Start.\n\n` +
    `${storyLine}\n\n` +
    `Invite to paste in the group chat:\n---\n${invite}\n---\n` +
    `I did not send anything. Want me to change the invite?`;

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      table_url: url,
      join_url: `${origin}/play`,
      party_name: party || null,
      mode: quick ? "quick" : "full",
      story: story ? { id: story.id, title: story.title, teaser: story.teaser, category: story.category, kind: "ready_made" } : null,
      story_choice: choice,
      odd_news_preview: news.slice(0, 3).map((n) => ({ id: n.id, headline: n.headline, place: n.place })),
      invite_message: invite,
      instructions: "Open table_url on a TV or laptop; everyone scans the QR with their phone.",
    },
  };
}

async function listTodaysTales(args: Record<string, unknown>, origin: string): Promise<ToolResult> {
  const rating: Rating = isRating(args.rating) ? args.rating : DEFAULT_RATING;
  const [news, ready] = [await fetchOddNews(origin, rating), readyMadeFor(rating)];
  const newsBlock = news.length
    ? `Today's odd news (${news.length}, real and harmless; the table votes on three of these):\n` +
      news
        .map((n, i) => `${i + 1}. ${n.headline}${n.place ? ` (${n.place})` : ""}${n.source ? `, ${n.source}` : ""}${n.date ? `, ${n.date}` : ""}\n   ${n.teaser}`)
        .join("\n")
    : "Today's odd news isn't loaded right now, so the table will vote on the ready-made stories below.";
  const readyBlock =
    `Ready-made stories (hand-written from real news; pick one with start_game_night quest_id):\n` +
    ready.map((t) => `- ${t.title} [id: ${t.id}] (${t.category})\n   ${t.teaser}`).join("\n");
  const text =
    `${newsBlock}\n\n${readyBlock}\n\n` +
    `There's also "Our stories": everyone privately writes a small true story from their own life, the table votes on one, and the end shows how it really went. Choose it on the TV.`;
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      rating,
      odd_news: news.map(({ id, headline, teaser, place, source, date, rating: r }) => ({ id, headline, teaser, place, source, date, rating: r })),
      ready_made: ready.map(({ id, title, teaser, category, rating: r }) => ({ id, title, teaser, category, rating: r })),
      odd_news_source: news.length ? "live" : "unavailable",
    },
  };
}

function inviteMessage(args: Record<string, unknown>, origin: string): ToolResult {
  const party = str(args.party_name, 40);
  const when = str(args.when, 80);
  const quick = args.mode === "quick";
  const text = inviteText(origin, party, when, quick);
  return {
    content: [{ type: "text", text }],
    structuredContent: { message: text, party_name: party || null, when: when || null, join_url: `${origin}/play` },
  };
}

async function callTool(name: string, args: Record<string, unknown>, origin: string): Promise<ToolResult | null> {
  switch (name) {
    case "start_game_night":
      return startGameNight(args, origin);
    case "list_todays_tales":
      return listTodaysTales(args, origin);
    case "invite_message":
      return inviteMessage(args, origin);
    default:
      return null;
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────────────────────

async function handle(msg: unknown, origin: string): Promise<JsonRpcResponse | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return err(null, -32600, "Invalid Request");
  const m = msg as Partial<JsonRpcRequest> & { result?: unknown; error?: unknown };
  const isNotification = !("id" in m) || m.id === undefined;
  const id: JsonRpcId = isNotification ? null : (m.id as JsonRpcId);

  // A client response (to a server request we never send) or a notification: acknowledge silently.
  if (typeof m.method !== "string") return isNotification || "result" in m || "error" in m ? null : err(id, -32600, "Invalid Request");
  if (isNotification) return null; // notifications/initialized, notifications/cancelled, etc.

  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;
  switch (m.method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Group Project is a co-op story game night for friends in the same room: one TV or laptop is the table, everyone's phone is a controller, and Muse is the Dungeon Master. " +
          "Stories come from odd, harmless real news or from the players' own true stories. Use start_game_night to give the user a table link and an invite, list_todays_tales to see tonight's odd news and the ready-made stories, and invite_message for a group-chat invite. Never claim you sent a message.",
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, origin);
        if (!result) return err(id, -32602, `Unknown tool: ${name}`);
        return ok(id, result);
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `Tool failed: ${(e as Error).message}` }], isError: true });
      }
    }
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });
    default:
      return err(id, -32601, `Method not found: ${m.method}`);
  }
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const token = process.env.MCP_TOKEN;
  if (!token) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${token}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return json(err(null, -32001, "Unauthorized: missing or invalid bearer token"), 401, {
      "WWW-Authenticate": 'Bearer realm="group-project"',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(err(null, -32700, "Parse error"), 400);
  }

  const origin = getOrigin(req);
  if (Array.isArray(body)) {
    if (!body.length) return json(err(null, -32600, "Invalid Request"), 400);
    const responses = (await Promise.all(body.map((m) => handle(m, origin)))).filter((r): r is JsonRpcResponse => r !== null);
    return responses.length ? json(responses) : new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }
  const response = await handle(body, origin);
  return response ? json(response) : new NextResponse(null, { status: 202, headers: CORS_HEADERS });
}

export function GET() {
  return new NextResponse("Method Not Allowed: this MCP server uses JSON responses over POST only (no SSE stream).", {
    status: 405,
    headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" },
  });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
