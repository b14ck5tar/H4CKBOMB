# Once Upon a Roll × Meta Muse: Custom Connector

Muse can start a game night for you. Our app exposes an **MCP server (Streamable HTTP, JSON responses)** at:

```
https://<vercel-domain>/api/mcp
```

Code: `game/src/app/api/mcp/route.ts` (hand-rolled JSON-RPC 2.0, no extra deps).

## Tools

| Tool | Args | What Muse gets back |
|---|---|---|
| `start_game_night` | `party_name?`, `quest_id?`, `vibe?` | A table link `https://<domain>/tv?party=<name>&quest=<id>` plus "Open this on a TV or laptop; everyone scans the QR with their phone." `vibe` ("nature", "spooky", "sports", "silly"…) picks the best-matching quest. |
| `list_todays_tales` | none | Every playable quest (5 classics + today's news tales from `/api/news`): id, title, one-line teaser, category. **The real headline is never revealed** (it's the end-of-game twist). |
| `invite_message` | `party_name`, `when?` | A short fairytale-style group-chat invite with join instructions, ready to paste. |

Each result has a human-readable `content[0].text` and machine-readable `structuredContent`.

## 1. Deploy + (optional) token

1. Deploy to Vercel as usual. The route is dynamic and needs no keys.
2. Optional but recommended: in Vercel → Project → Settings → Environment Variables, add `MCP_TOKEN` = a long random string (e.g. `openssl rand -hex 24`). Redeploy. When it is set, every request needs `Authorization: Bearer <MCP_TOKEN>`; without it the endpoint is open (it's read-only, so that's fine for a demo too).
3. Sanity check: `curl -X POST https://<domain>/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'` should print `{"jsonrpc":"2.0","id":1,"result":{}}`.

## 2. Add it in Muse

1. Open Muse → **Settings → Connectors** → **Add custom connector**.
2. Type: **MCP server (Streamable HTTP)**. Name: `Once Upon a Roll`.
3. URL: `https://<vercel-domain>/api/mcp`
4. Auth: if you set `MCP_TOKEN`, choose **API key / Bearer token** and paste the token. Otherwise choose **None**. (Skip OAuth; we don't implement it.)
5. Save. Muse should list 3 tools: `start_game_night`, `list_todays_tales`, `invite_message`. Make sure the connector is toggled **on** for the chat.

Localhost won't work: Muse calls the server from Meta's cloud, so use the Vercel URL (or a tunnel like `ngrok http 3000` for testing).

## 3. 20-second judge demo

> **You:** "Hey Muse, start a game night for The Cousins, something about nature."
>
> **Muse** (calls `start_game_night {party_name:"The Cousins", vibe:"nature"}`): "Your table is ready for The Cousins! Quest: *The Last Fifty Giants of Thamesreach*… Open the table: https://…/tv?party=The+Cousins&quest=fifty-giants"
>
> **You:** tap the link on the laptop/TV. The lobby shows "The Cousins" and the quest, with a QR code.
>
> **You:** "Now write an invite I can send the group chat for Friday at 8."
>
> **Muse** (calls `invite_message`): "Hear ye, hear ye! The Cousins, you are summoned…"
>
> Judges scan the QR with their phones and they're in.

Backup lines: "What tales can we play today?" (`list_todays_tales`), "Something spooky instead" (picks *The Billion Pearls of the Grey Sea*), "We want sports" (*The Fall of the Undefeated Sky-Colossus*).

## 4. curl examples

```bash
S=https://<vercel-domain>/api/mcp
H='Content-Type: application/json'
A='Authorization: Bearer <MCP_TOKEN>'   # omit if MCP_TOKEN isn't set

# handshake
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
curl -s -i -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'   # → 202, no body

# tools
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"start_game_night","arguments":{"party_name":"The Cousins","vibe":"nature"}}}'
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_todays_tales","arguments":{}}}'
curl -s -X POST $S -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"invite_message","arguments":{"party_name":"The Cousins","when":"Friday at 8pm"}}}'
```

Or point the official inspector at it: `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL above, header `Authorization: Bearer …`.

## Protocol notes

- POST only, JSON-RPC 2.0, single messages or batches. Always replies `application/json` (no SSE, no sessions). GET/DELETE → 405, OPTIONS → 204 (CORS open).
- Methods: `initialize` (protocolVersion `2025-06-18`, also echoes `2025-03-26`/`2024-11-05` if the client asks), `notifications/*` → 202, `ping`, `tools/list`, `tools/call`, plus empty `resources/list` / `prompts/list`.
- `origin` in links comes from `x-forwarded-proto` + `x-forwarded-host` (Vercel sets these), so links always point at the deployment Muse called.
- `/api/news` is fetched with a 4 s timeout; on 404/timeout/error only the 5 classic seeds are offered.

## TV-page contract (`/tv`)

`/tv?party=<urlencoded>&quest=<id>`: `party` prefills the party name; `quest` preselects the quest (a seed id like `fifty-giants`, or a news id like `news-2626874b9d` from `/api/news`). Both optional; unknown ids should fall back to the normal picker.
