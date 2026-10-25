# Group Project × Meta Muse: custom connector

Muse (Meta's personal agent) can set up a game night for you. The app exposes an **MCP server (Streamable HTTP,
JSON responses)** at:

```
https://<vercel-domain>/api/mcp
```

Code: `game/src/app/api/mcp/route.ts` (hand-rolled JSON-RPC 2.0, no extra deps). Updated Sat Oct 24 ~9 PM for the
turn-based build (Odd news / Our stories, Quick Tale). Tested locally with JSON-RPC POSTs (results at the bottom).

**Heads-up:** the live Vercel site still runs the old build from `main` (its connector describes the old quests).
The new connector only goes live when `rebuild-around-the-table` is merged to `main` and deployed.

## Tools

All three are read-only. Nothing is sent and no room is created server-side; the TV makes the room when the link opens.

| Tool | Args | What Muse gets back |
|---|---|---|
| `start_game_night` | `party_name?`, `mode?` (`full` / `quick`), `quest_id?`, `vibe?`, `when?` | The table link to open on a TV or laptop, the phone join link, three steps to start, which story will play (or a preview of tonight's odd-news headlines the table will vote on), and a ready-to-paste invite. |
| `list_todays_tales` | `rating?` (`kids` / `teens` / `adults`) | Today's odd news from `/api/news` (up to 10 real, harmless headlines with place, source, date and a short teaser), then the ready-made stories (curated seeds, pickable by id), then a line about "Our stories". If live news is empty or slow, only the ready-made stories are listed. |
| `invite_message` | `party_name`, `when?`, `mode?` | A short, plain group-chat invite with join steps. Text only. |

Each result has a human-readable `content[0].text` and machine-readable `structuredContent`
(`table_url`, `join_url`, `mode`, `story`, `story_choice`, `odd_news_preview`, `invite_message` for `start_game_night`;
`odd_news`, `ready_made`, `odd_news_source` for `list_todays_tales`).

### How `start_game_night` picks the link

| What the user asked | Link | What happens on the TV |
|---|---|---|
| Nothing special | `/tv?party=<name>` | Full Story. The table votes on three live odd-news headlines (curated stories if news is down). "Our stories" can be picked in the lobby. |
| Something short, a demo (`mode: "quick"`, or words like "quick", "short", "demo" in `vibe`) | `/tv?party=<name>&mode=quick` | Quick Tale (about 5 minutes) with the boulder story. |
| A mood (`vibe: "space"`, "animals", "spooky", "silly"…) | `/tv?party=<name>&quest=<seed id>` | That ready-made story is pinned and the vote is skipped. Works with `mode=quick` too. |
| A ready-made id (`quest_id`) | `/tv?…&quest=<id>` | Pinned. |
| An odd-news id (`news-…`) | `/tv?party=<name>` | Not pinnable: a live story's opener is written while the table votes, so the table votes. `story_choice` says so. |

The audience setting (Kids / Teens / Adults) is picked in the TV lobby; links open at the default (Teens), which
also allows every Kids story.

## 1. Deploy + (optional) token

1. Merge to `main` and deploy to Vercel. The route is dynamic and needs no keys of its own.
2. Optional: in Vercel → Project → Settings → Environment Variables, add `MCP_TOKEN` = a long random string. Redeploy.
   When set, every request needs `Authorization: Bearer <MCP_TOKEN>`. Without it the endpoint is open (it's read-only).
3. Sanity check: `curl -X POST https://<domain>/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'`
   should print `{"jsonrpc":"2.0","id":1,"result":{}}`.

## 2. Add it in Muse

1. Open Muse → **Settings → Connectors** → **Add custom connector**.
2. Type: **MCP server (Streamable HTTP)**. Name: `Group Project`.
3. URL: `https://<vercel-domain>/api/mcp`
4. Auth: if you set `MCP_TOKEN`, choose **API key / Bearer token** and paste it. Otherwise **None**. (No OAuth.)
5. Save. Muse should list 3 tools. Make sure the connector is toggled **on** for the chat.

Localhost won't work: Muse calls the server from Meta's cloud. Use the Vercel URL (or a tunnel like `ngrok http 3000`).

## 3. 20-second demo (video Part 3, or the pitch)

> **You:** "Start a quick game night for the judges."
>
> **Muse** (calls `start_game_night {party_name:"Judges", mode:"quick"}`): "Your table is ready for Judges (Quick Tale,
> about 5 minutes). Open this on a TV or laptop: https://…/tv?party=Judges&mode=quick …" plus an invite to paste.
>
> **You:** tap the link on the laptop. The lobby shows the party name, the boulder story and the QR.
>
> Judges scan the QR and they're in.

Backup lines: "What's in the odd news tonight?" (`list_todays_tales`), "Something about space instead"
(pins *The Signal That Wakes Up Hungry*), "Write an invite for Friday at 8" (`invite_message`).
Muse drafts; the human sends. Never say Muse sent anything.

## 4. curl examples

```bash
S=https://<vercel-domain>/api/mcp
H='Content-Type: application/json'
A='Authorization: Bearer <MCP_TOKEN>'   # omit if MCP_TOKEN isn't set

curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
curl -s -i -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'   # → 202, no body
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_todays_tales","arguments":{"rating":"teens"}}}'
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"start_game_night","arguments":{"party_name":"Judges","mode":"quick"}}}'
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"invite_message","arguments":{"party_name":"The Cousins","when":"Friday at 8pm"}}}'
```

Or use the official inspector: `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", the URL above.

## Protocol notes

- POST only, JSON-RPC 2.0, single messages or batches. Always replies `application/json` (no SSE, no sessions).
  GET/DELETE → 405, OPTIONS → 204 (CORS open).
- Methods: `initialize` (protocolVersion `2025-06-18`; also echoes `2025-03-26` / `2024-11-05`), `notifications/*` → 202,
  `ping`, `tools/list`, `tools/call`, and empty `resources/list` / `prompts/list`.
- Links use `x-forwarded-proto` + `x-forwarded-host` (Vercel sets these), so they point at the deployment Muse called.
- `/api/news?rating=…` is fetched with an 8 s timeout. It's cached server-side for 4 h, so the connector never adds
  SerpApi calls beyond the app's own refresh. On empty, error or timeout, only the ready-made stories are offered.
- Accepts both `/api/news` shapes: candidates (`{headline, snippet, place, …}`) and the older whole-quest seeds.

## TV-page contract (`game/src/app/tv/page.tsx`)

`/tv?party=<urlencoded>&mode=quick&quest=<seed id>`. All optional. `party` prefills the party name, `mode=quick` opens
Quick Tale, `quest` pins a curated seed (unknown or news ids are ignored and the table votes).

## Local test (Sat Oct 24, ~9 PM, port 3097, `NEWS_LIVE=0`)

- `initialize` OK, `notifications/initialized` → 202, `tools/list` → 3 tools with the new args, `ping` → `{}`, GET → 405.
- `list_todays_tales` → 8 odd-news headlines (fixture run) + 8 ready-made stories. The very first call on a cold dev
  server timed out on `/api/news` compile and correctly fell back to ready-made only.
- `start_game_night {party_name:"Friday Crew", vibe:"something spooky about space"}` → `/tv?party=Friday+Crew&quest=galactic-signal`.
  Opened in a browser: lobby shows party "Friday Crew", story "The Signal That Wakes Up Hungry", mode full.
- `start_game_night {party_name:"Judges", mode:"quick"}` → `/tv?party=Judges&mode=quick`. Browser: mode quick,
  story `hanging-boulder`, party "Judges".
- `start_game_night {quest_id:"news-821186fa18"}` → `/tv` plus three live headlines as a preview and an invite.
