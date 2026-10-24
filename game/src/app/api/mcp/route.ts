/**
 * Once Upon a Roll: MCP server for Meta Muse ("custom connector").
 *
 * Transport: MCP Streamable HTTP, JSON-only (no SSE). Clients POST JSON-RPC 2.0 messages
 * (single or batch) to /api/mcp and get application/json back. Notifications get 202, no body.
 * GET/DELETE return 405 (we never open a server-to-client stream and keep no sessions).
 *
 * Auth (optional): if env MCP_TOKEN is set, every POST needs `Authorization: Bearer <MCP_TOKEN>`.
 *
 * Tools: start_game_night, list_todays_tales, invite_message (see TOOLS below).
 *
 * ── CONTRACT FOR THE TV PAGE (lead engineer wires this up) ─────────────────────────────────
 *   /tv?party=<urlencoded party name>&quest=<quest id>
 *     party  optional. Prefill GameState.partyName (e.g. "The Cousins").
 *     quest  optional. Preselect this quest id (a seed id from src/data/seed_quests.json such as
 *            "fifty-giants", or a QuestSeed.id returned by GET /api/news). Unknown ids should be
 *            ignored (fall back to the normal quest picker).
 *   Both params are always URL-encoded; either may be absent.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
import { NextResponse, type NextRequest } from "next/server";
import seedsJson from "@/data/seed_quests.json";
import type { QuestSeed } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEEDS = seedsJson as unknown as QuestSeed[];
const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "once-upon-a-roll", version: "1.0.0", title: "Once Upon a Roll" };
const NEWS_TIMEOUT_MS = 4000;

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

// ─── Quest catalog ───────────────────────────────────────────────────────────────────────────

interface Tale {
  id: string;
  title: string;
  teaser: string;
  category: string;
  tone: string;
  source: "classic" | "todays_news";
  realm: string;
  keywords: string; // lowercase blob for vibe matching; never shown (contains spoilers)
}

const firstSentence = (s: string) => (s || "").split(/(?<=[.!?])\s/)[0].trim();

function toTale(q: QuestSeed, source: Tale["source"]): Tale {
  return {
    id: q.id,
    title: q.quest_title,
    teaser: firstSentence(q.fairytale_premise),
    category: (q.category || "mystery").replace(/_/g, " & "),
    tone: q.tone || "joyful",
    source,
    realm: q.realm_name,
    keywords: [
      q.category,
      q.tone,
      q.quest_title,
      q.realm_name,
      q.fairytale_premise,
      q.the_threat?.name,
      q.the_threat?.description,
      q.the_goal?.description,
      q.art_style_hint,
      ...(q.locations || []).map((l) => `${l.name} ${l.description}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

async function fetchNewsQuests(origin: string): Promise<QuestSeed[]> {
  try {
    const res = await fetch(`${origin}/api/news`, {
      signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { quests?: unknown };
    if (!Array.isArray(data.quests)) return [];
    return (data.quests as QuestSeed[]).filter((q) => q && typeof q.id === "string" && typeof q.quest_title === "string");
  } catch {
    return []; // 404, timeout, bad JSON: classics only
  }
}

async function getTales(origin: string): Promise<Tale[]> {
  const news = await fetchNewsQuests(origin);
  const seen = new Set<string>();
  const out: Tale[] = [];
  for (const [q, src] of [
    ...news.map((q) => [q, "todays_news"] as const),
    ...SEEDS.map((q) => [q, "classic"] as const),
  ]) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(toTale(q, src));
  }
  return out;
}

// Vibe words → categories/keywords. Category hits score highest; free-text keyword hits add up.
const VIBES: Record<string, string[]> = {
  animals_nature: ["nature", "outdoors", "animal", "animals", "forest", "tree", "trees", "river", "wild", "wildlife", "green", "earth", "garden", "cozy", "wholesome", "bugs", "birds"],
  environment: ["ocean", "sea", "beach", "water", "climate", "pollution", "eco", "environment", "mystery", "spooky", "creepy", "eerie", "ghost", "haunted", "dark"],
  sports: ["sports", "sport", "game", "football", "soccer", "basketball", "competitive", "underdog", "tournament", "team", "epic", "battle", "action"],
  quirky: ["silly", "funny", "weird", "quirky", "goofy", "chaos", "chaotic", "kids", "family", "food", "halloween", "pumpkin", "autumn", "fall", "festival", "harvest", "spooky"],
  infrastructure: ["city", "town", "bridge", "engineering", "build", "builders", "monster", "dragon", "heroic", "classic", "adventure"],
};

function pickByVibe(tales: Tale[], vibe: string): Tale | undefined {
  const words = vibe.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return undefined;
  let best: Tale | undefined;
  let bestScore = 0;
  for (const t of tales) {
    const cat = t.category.replace(/ & /g, "_").toLowerCase();
    let score = 0;
    for (const w of words) {
      if (w.length < 3) continue;
      if (cat.includes(w) || t.tone === w) score += 6;
      if ((VIBES[cat] || []).includes(w)) score += 4;
      if (new RegExp(`\\b${w}`).test(t.keywords)) score += 1;
    }
    if (t.source === "todays_news") score += 0.5; // prefer fresh tales on ties
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 1 ? best : undefined;
}

// ─── Tools ───────────────────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "start_game_night",
    title: "Start a game night",
    description:
      "Start a new Once Upon a Roll game night: a co-op fairytale tabletop adventure (like D&D with no Dungeon Master) for 2–6 people in the same room, where each quest is secretly based on a real news story. " +
      "Call this when the user wants to start, host, set up, or kick off a game night, party game, family game, or 'a story game' with friends. " +
      "Returns a link that opens the game table (open it on a TV or laptop) with the party name and quest preselected; everyone then joins by scanning the QR code with their phone. " +
      "Use `vibe` for what the user asked for (e.g. 'nature', 'spooky', 'sports', 'silly'); the best-matching quest is chosen. Use `quest_id` only with an id from list_todays_tales.",
    inputSchema: {
      type: "object",
      properties: {
        party_name: { type: "string", description: "Name of the group playing, e.g. 'The Cousins' or 'Friday Crew'." },
        quest_id: { type: "string", description: "Exact quest id from list_todays_tales. Overrides vibe." },
        vibe: { type: "string", description: "Desired theme or mood in a few words, e.g. 'nature', 'spooky', 'sports', 'silly', 'ocean mystery'." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_todays_tales",
    title: "List today's tales",
    description:
      "List the fairytale quests available to play in Once Upon a Roll right now: classic tales plus 'Tales from Today' freshly adapted from today's news. " +
      "Each has an id, title, one-line teaser and category. The real headline behind each tale is deliberately hidden (it is revealed at the end of the game, so don't guess it). " +
      "Call this when the user asks what stories, quests or adventures they can play, or wants to choose one before start_game_night.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "invite_message",
    title: "Write a game-night invite",
    description:
      "Write a short, fun, fairytale-style group-chat invite for a Once Upon a Roll game night that the user can paste to friends, including how to join (phones only, no app). " +
      "Call this when the user wants to invite friends or family, announce a game night, or asks for a message to send. Returns the text only; it does not send anything.",
    inputSchema: {
      type: "object",
      properties: {
        party_name: { type: "string", description: "Name of the group, e.g. 'The Cousins'." },
        when: { type: "string", description: "When it happens, e.g. 'Friday at 8pm' or 'tonight after dinner'." },
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
const tableLink = (origin: string, party: string, questId: string) => {
  const qs = new URLSearchParams();
  if (party) qs.set("party", party);
  if (questId) qs.set("quest", questId);
  const s = qs.toString();
  return `${origin}/tv${s ? `?${s}` : ""}`;
};

const JOIN_STEPS =
  "Open this on a TV or laptop; everyone scans the QR with their phone. (Or go to /play on a phone and type the 4-letter room code.) 2–6 players, about 4 minutes for a Quick Tale, no app or account needed.";

async function startGameNight(args: Record<string, unknown>, origin: string): Promise<ToolResult> {
  const party = str(args.party_name, 60);
  const questIdArg = str(args.quest_id, 80);
  const vibe = str(args.vibe, 120);
  const tales = await getTales(origin);

  let quest: Tale | undefined;
  let how = "";
  if (questIdArg) {
    quest = tales.find((t) => t.id === questIdArg);
    how = quest ? "requested" : `quest_id "${questIdArg}" not found`;
  }
  if (!quest && vibe) {
    quest = pickByVibe(tales, vibe);
    if (quest) how = `best match for "${vibe}"`;
  }
  if (!quest) {
    quest = tales.find((t) => t.source === "todays_news") || pick(SEEDS.map((q) => toTale(q, "classic")), party + vibe + new Date().toDateString());
    how = how ? `${how}; picked a featured tale instead` : "featured tale";
  }

  const url = tableLink(origin, party, quest.id);
  const who = party || "your party";
  const text =
    `Your table is ready for ${who}!\n\n` +
    `Quest: "${quest.title}" (${quest.category}${quest.source === "todays_news" ? ", from today's news" : ""})\n` +
    `${quest.teaser}\n\n` +
    `Open the table: ${url}\n\n` +
    `${JOIN_STEPS}\n` +
    `The real story behind the tale stays secret until the final page.`;

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      table_url: url,
      party_name: party || null,
      quest: { id: quest.id, title: quest.title, teaser: quest.teaser, category: quest.category, source: quest.source },
      quest_choice: how,
      join_url: `${origin}/play`,
      instructions: "Open this on a TV or laptop; everyone scans the QR with their phone.",
    },
  };
}

async function listTodaysTales(origin: string): Promise<ToolResult> {
  const tales = await getTales(origin);
  const lines = tales.map(
    (t, i) => `${i + 1}. ${t.title} [id: ${t.id}] (${t.category}${t.source === "todays_news" ? ", from today's news" : ""})\n   ${t.teaser}`,
  );
  const fresh = tales.filter((t) => t.source === "todays_news").length;
  const text =
    `${tales.length} tales are on the shelf${fresh ? ` (${fresh} adapted from today's news)` : ""}:\n\n${lines.join("\n")}\n\n` +
    `Each one is secretly based on a real news story, revealed at the end. To play one, call start_game_night with its quest_id.`;
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      tales: tales.map((t) => ({ id: t.id, title: t.title, teaser: t.teaser, category: t.category, tone: t.tone, source: t.source })),
    },
  };
}

const OPENERS = [
  "Hear ye, hear ye!",
  "Once upon a time (specifically, very soon)…",
  "By royal decree of the Storyteller's Guild:",
  "A raven has arrived with urgent news!",
  "Gather 'round, brave souls!",
];
const HOOKS = [
  "A dragon, a disaster, and one very questionable plan await.",
  "The realm is in peril and, frankly, only we are available.",
  "Legends will be forged. Dice will be blamed.",
  "Heroes are needed. Competence is optional.",
  "There will be quests, there will be chaos, there will be a d20.",
];
const CLOSERS = [
  "Bring your phone, your wits, and your worst ideas.",
  "No Dungeon Master needed. No dragons harmed (probably).",
  "Come for the adventure, stay for the Shame Titles.",
  "Your character sheet is your phone. Charge it like your life depends on it.",
];

function inviteMessage(args: Record<string, unknown>, origin: string): ToolResult {
  const party = str(args.party_name, 60) || "the Party";
  const when = str(args.when, 80);
  const seed = party + when;
  const whenLine = when ? `The quest begins ${when}.` : "The quest begins soon (watch this chat for the signal).";
  const text = [
    `${pick(OPENERS, seed)} ${party}, you are summoned to a night of Once Upon a Roll!`,
    `${pick(HOOKS, seed + "h")} ${whenLine}`,
    `How to join: when we're together, scan the QR code on the TV with your phone (or open ${origin}/play and type the 4-letter room code). No app, no account, no prep.`,
    pick(CLOSERS, seed + "c"),
  ].join("\n\n");
  return {
    content: [{ type: "text", text }],
    structuredContent: { message: text, party_name: party, when: when || null, join_url: `${origin}/play` },
  };
}

async function callTool(name: string, args: Record<string, unknown>, origin: string): Promise<ToolResult | null> {
  switch (name) {
    case "start_game_night":
      return startGameNight(args, origin);
    case "list_todays_tales":
      return listTodaysTales(origin);
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
          "Once Upon a Roll is a co-op fairytale party game played on one TV/laptop plus everyone's phones. " +
          "Use start_game_night to give the user a link to open the game table, list_todays_tales to browse quests, and invite_message to draft a group-chat invite.",
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
      "WWW-Authenticate": 'Bearer realm="once-upon-a-roll"',
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
