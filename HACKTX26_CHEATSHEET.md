# HackTX '26 Cheat Sheet ("Once Upon a Hack")

All endpoints below were checked live on Oct 24, 2026.

## Key times
- Soft submission: **Sat 11:30 PM**. Final: **Sun 11:30 AM** at hacktx26.devpost.com
- Pitching workshop: Sun 1 PM (GDC 5.302). Judging: Sun 2–5 PM (WEL). Pitching: 5:30 PM (GDC 2.216)
- WEL is locked 11 PM–6:30 AM. Work in GDC overnight.
- Pick up to 3 tracks. Best Overall and Best Novice are on top of those.
- All code must be written during the hacking period.

## Prizes
| Track | Prize | Ask |
|---|---|---|
| Best Overall | MacBook Pro M5 Pro | – |
| Best Novice | Meta Ray-Ban Wayfarer Gen 2 | first hackathon |
| Most Entertaining | PS5 | – |
| Best Pitch | DJI / keyboard / JBL | – |
| Best Hardware | RTX 5080 | – |
| Meta | Top 3 + Round 2 at Menlo Park | AI social product that brings people closer, using Muse |
| Northmark (NMC²) | AirPods Max / Apple Watch / Echo Show | platform for quickly building enterprise AI agents |
| SerpApi | Switch 2 / AirPods Pro 3 / monitors | SerpApi plays a meaningful role |
| Toyota Financial | $500 / $350 / $150 Amazon | "smartest next move for me and my Toyota?" with synthetic data |
| Capital One | $250 per team member | Best Use of Nessie |
| MLH | swag and gear | Gemini, Snowflake, Tiger Data, Solana, Vultr, .TECH, DEV writing ($100) |

## Sponsor APIs
- **Meta Muse**: dev.meta.ai (US only, public preview). OpenAI-compatible at `https://api.meta.ai/v1`, env var `MODEL_API_KEY`.
  - Models: `muse-spark-1.3` (text, vision, tools, web_search), `muse-image-1.0` (about $0.01/image), `muse-voice-transcribe-1.0` (realtime websocket).
  - Muse connectors: a public MCP server URL or an OpenAPI spec. Must be deployed, not on localhost.
  - Avoid `-contributor` models: Meta trains on what you send them.
  - The Graph API is useless without app review. Only people you add to the app work.
- **SerpApi**: serpapi.com. Free plan: 250 searches/month, 50/hour. **Cache everything.** Ask the booth for credits.
  - Engines: google_maps, google_local, google_events, google_shopping, google_flights, google_hotels, google_news.
  - Extract API: `engine=extract&url=...`
- **Gemini**: aistudio.google.com. `gemini-3.8-flash` is free. `pip install google-genai`.
- **Tiger Data**: $1k credits, no card (MLH link). It's Postgres.
- **Vultr**: $100 via mlh.link/vultr-discover, then a gift code.
- **Snowflake**: 120-day trial. Marketplace has free Cybersyn data (weather, FX, stocks).
- **NMC²**: no public API. Last year they praised "Guido", a multi-agent F1 strategy sim. Building blocks: MCP registry, LangGraph, Agents SDK, Langfuse.
- **Nessie (Capital One)**: nessieisreal.com (GitHub login → /profile for your key). Base `https://api.nessieisreal.com?key=...`. **HTTPS only.**
  - Old `reimaginebanking.com` is dead.
  - Missing key gives a 502. A new key's sandbox is empty: seed customer → account → merchants → purchases.
  - ATM geo filter is broken: filter by distance yourself.
  - `/enterprise/*` is readable by everyone. Never put real data in it.

## Austin / UT live data (no key unless noted)
- Traffic incidents: `data.austintexas.gov/resource/dx9v-zd7x.json?$order=published_date DESC`
- 311: `.../resource/xwdj-i9he.json` · Restaurant inspections: `ecmv-9xxi` · Crime: `fdj4-gpfu` · Public art: `uuk6-933w` · Parks: `v8hw-gz65` · Neighborhoods: `inrm-c3ee.geojson` · MetroBike kiosks: `qd73-bsdg`
- CapMetro live vehicles (JSON): `data.texas.gov/download/cuc7-ywmd/text%2Fplain`. Static GTFS: `.../download/r4v4-vz24/application%2Fx-zip-compressed`
- Weather: `api.weather.gov/gridpoints/EWX/156,92/forecast`. Needs a User-Agent header.
- Floods: `api.atxfloods.com/api/closures`, `/crossings`, `/cameras`
- Air quality: `air-quality-api.open-meteo.com/v1/air-quality?latitude=30.28&longitude=-97.73&current=us_aqi`
- Events: `do512.com/events/today.json` (unofficial). UT calendar: `calendar.utexas.edu/api/2/events?days=2&pp=50`
- POIs: Overpass `overpass-api.de/api/interpreter`. Needs a User-Agent.
- Ticketmaster Discovery: free key, 5k calls/day.

## Fairytale theme data
- Grimm text: `gutendex.com/books/?search=grimm` (book 2591)
- Met art: `collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&isPublicDomain=true&q=fairy`. The old `/v1/search` is dead.
- Art Institute of Chicago: `api.artic.edu/api/v1/artworks/search?q=fairy&fields=id,title,image_id,is_public_domain`

## Auto / finance data (Toyota and Capital One)
- VIN decode: `vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`
- Recalls: `api.nhtsa.gov/recalls/recallsByVehicle?make=toyota&model=camry&modelYear=2022` · Safety ratings: `/SafetyRatings/...`
- Fuel economy: `fueleconomy.gov/ws/rest/vehicle/menu/model?year=2025&make=Toyota` (send `Accept: application/json`). Fuel prices: `/ws/rest/fuelprices`
- FRED, no key: `fred.stlouisfed.org/graph/fredgraph.csv?id=SERIES`

  | Series | Meaning | Latest |
  |---|---|---|
  | `RIFLPBCIANM60NM` | 60-month new-car loan rate | 7.54% |
  | `GASREGW` | Weekly regular gas | $4.28 |
  | `CUSR0000SETA02` | Used-car CPI | – |
  | `APU000072610` | Electricity $/kWh | – |

- CFPB complaints: `consumerfinance.gov/data-research/consumer-complaints/search/api/v1/` (no key)
- Treasury yields: fiscaldata.treasury.gov · FDIC banks: api.fdic.gov/banks · MCC codes: github.com/greggles/mcc-codes
- AAA 2026 driving costs: $12,863/yr, about 86¢/mile. Hybrids are the cheapest category.
- Toyota Financial lease-end options: buy out, return, replace (TFS FAQ). No public Toyota API, so mock the account.
- Synthetic data: Faker, SDV.
- Past Nessie winners are agents with a sharp target user. **Avoid generic budget dashboards.**
