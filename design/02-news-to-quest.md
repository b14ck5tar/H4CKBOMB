# 02 — Real News → Fairytale Quest Pipeline

Every quest in **Once Upon a Headline** is a real story from today's news, retold as a fairytale. At the end the TV reveals the real headline, its source and a link (shown as a QR code). The pipeline runs ahead of time in the background, so a demo never waits on a news API.

```
[cron every 4h] → FETCH (SerpApi google_news + RSS backups) → DEDUPE → STAGE A keyword prefilter
   → ENRICH (snippet/og:description) → STAGE B LLM safety classifier → TRANSFORM (quest seed)
   → STAGE C output lint → store in quests table (status=ready) → game picks one at lobby time
```

---

## 1. News sources (all live-tested Oct 24, 2026)

| Source | Endpoint | Auth | Free limits | Fields | Test result |
|---|---|---|---|---|---|
| **SerpApi `google_news`** | `https://serpapi.com/search.json?engine=google_news` | `api_key` | 250 searches/mo, 50/hr. **Cached repeats (same params, <1h) are free.** | `title`, `source.{name,icon,authors}`, `link` (**direct publisher URL**), `thumbnail`, `thumbnail_small`, `date`, `iso_date`, `story_token`, `serpapi_link`; topic pages nest `highlight` + `stories[]`; `menu_links[].topic_token` | Without a key: `401 "Invalid API key"`, which confirms the endpoint is live. Schema taken from the official docs examples. **There is no snippet field.** |
| **Google News RSS** | `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`, `/rss/headlines/section/topic/SCIENCE?...`, `/rss/search?q=<q>+when:1d&...` | none | Unofficial, no published limit. Keep it to a few calls per hour. | `title` ("Headline - Publisher"), `link`, `pubDate`, `source` | **200 OK, 117 KB, 30+ items, all dated today.** The `description` only repeats the title and source. `link` is a `news.google.com/rss/articles/...` token that redirects with JavaScript, so it opens fine in a phone browser but curl can't resolve it to the publisher URL. |
| **BBC RSS** | `https://feeds.bbci.co.uk/news/world/rss.xml`, `.../science_and_environment/rss.xml` | none | none | `title`, `description` (**real 1-sentence snippet**), `link` (direct), `pubDate`, `media:thumbnail` | **200 OK.** The best no-key source for snippets. |
| **NPR RSS** | `https://feeds.npr.org/1001/rss.xml` | none | none | title, description, link, pubDate | **200 OK.** |
| **GDELT DOC 2.0** | `https://api.gdeltproject.org/api/v2/doc/doc?query=...%20tone>3&mode=artlist&format=json&timespan=1d&maxrecords=25` | none | **1 request per 5 s**, enforced strictly | `url`, `title`, `seendate`, `socialimage`, `domain`, `language`, `sourcecountry` (no snippet). `tone>3` returns positive stories only, which makes it a good feed for discovery. | **First call 429.** One success (200, a `tone>3` query returned festival and pumpkin stories). After that, 5 calls in a row at 6–12 s spacing all got 429. Too flaky to be the primary source. |
| **Guardian Open Platform** | `https://content.guardianapis.com/search?q=&show-fields=trailText,thumbnail` | free developer key | 1 call/s, 500/day, non-commercial (hackathons are explicitly allowed) | `webTitle`, `webUrl`, `webPublicationDate`, `sectionName`, `fields.trailText`, `fields.thumbnail` | The old `api-key=test` now returns **401**, so you need to register. Docs confirmed live. |
| **GNews** | `https://gnews.io/api/v4/top-headlines?token=` | free key | 100 req/day, 10 articles/request, **12-hour delay**, CORS for localhost only | title, description, content, url, image, publishedAt, source | 400 without a key. Skip it: a 12-hour delay defeats "today's news". |
| **NewsAPI.org** | `https://newsapi.org/v2/top-headlines` | free key | 100 req/day, **24-hour delay**, and the dev tier **only allows browser (CORS) requests from localhost**, so a deployed frontend gets `corsNotAllowed`. Server-side calls work, but the license is dev-only. | title, description, url, urlToImage, publishedAt, source | 401 without a key. **Skip.** |
| **Currents API** | `https://api.currentsapi.services/v1/latest-news?apiKey=` | free key | Pricing page now says "Free 250 Requests/Day" | title, description, url, image, published, category | 401 without a key. Optional backup. |
| AP / Reuters RSS | `feeds.apnews.com` (DNS failed), `reutersagency.com/feed` (404) | — | — | — | **Dead.** Their stories still reach us through Google News, where AP and Reuters items show up. |

**Location:** none of these sources has a structured location field (GDELT `sourcecountry` is the publisher's country). The LLM pulls the place name out of the title and snippet.

### Decision
- **Primary: SerpApi `google_news`.** It is the only source that returns direct publisher links, thumbnails, ISO dates and `story_token` (the "Full Coverage" cluster that the reveal uses). It's also required for the prize.
- **Backup: Google News RSS (no key) plus BBC Science/World RSS (for snippets).** These run whenever SerpApi is rate-limited or out of quota, or the key is missing. Google News RSS covers the same index as SerpApi, so the stories match. GDELT `tone>3` is only an occasional discovery feed, run at most once per cron tick.
- **Last-resort fallback:** `seed_quests.json` in the repo, holding the 5 quests below. The demo can't fail.

**Snippet gap:** neither Google News source returns a summary. For each candidate that passes Stage A, the server fetches the publisher page and reads `og:description` plus the first 3 `<p>` tags (I did this for the BBC items below and it took about 1 s). For JS-heavy sites, SerpApi's Extract API is an option (it's listed in their docs nav, but check its credit cost first).

---

## 2. Safety filter: never turn tragedy into a game

### Stage A: keyword/category prefilter (free, instant, runs on title + snippet)
Reject if any of these regexes match (compile each with the `i` flag):

```ts
const HARD_BLOCK = [
  /\b(dead|death|deaths|died|dies|dying|killed?|killing|fatal(ly)?|murder|homicide|manslaughter|bod(y|ies)|corpse)\b/,
  /\b(shot|shooting|gunm[ae]n|gunfire|stabb(ed|ing)|massacre|bomb(ing)?|explosive device|terror(ism|ist)?|hostage|kidnap)/,
  /\b(war|invasion|airstrike|missile|drone strike|troops|soldiers?|militar(y|ia)|ceasefire|truce|occupied|siege|refugees?)\b/,
  /\b(abuse|assault|rape|sexual|trafficking|torture|harass)/,
  /\b(suicide|overdose|self-harm)\b/,
  /\b(outbreak|epidemic|pandemic|ebola|cholera|measles|mpox|patients?|hospitali[sz]ed|cancer)\b/,
  /\b(missing|search for|manhunt|arrest(ed)?|charged|sentenced|trial|lawsuit|sues?|indict)/,
  /\b(election|midterms?|vote|voters|ballot|campaign|senator|congress|parliament|president|prime minister|tariffs?|white house|trump|biden|putin|kim jong|netanyahu|zelensk)/,
  /\b(collapse[ds]?|crash(ed)?|derail|wildfire|flood(ing|s)?|evacuat|earthquake|tsunami|hurricane)\b/  // SOFT: send to Stage B with flag
];
```
The last line is a **soft** match. These stories go to Stage B tagged `needs_casualty_check`, because "bridge collapse" with no injuries is exactly the kind of story we want, but "building collapse, five missing" is not. Everything else is a **hard** reject. Also hard-reject any story older than 72 h, any `source.name` on a small denylist (tabloids, partisan outlets), and any story already used in the last 14 days (dedupe by normalized title).

**Boost list** (sort order after the filter): `bridge, reopen, restored, discovered, fossil, telescope, launch, moon, comet, rescued (animal), zoo, owl, octopus, pumpkin, festival, record, world record, upset, invention, robot, recycled, rewild, tree, river, clean-up, museum, shipwreck, library, parade, giant`.

### Stage B: LLM classifier (Muse Spark, temperature 0, JSON mode)

```text
SYSTEM: You are the safety editor for a family-friendly party game that turns REAL news
into whimsical fairytale quests. Players will laugh and play with this story. Decide if it
is SAFE and FUN to fantasize. Be strict: when unsure, reject.

REJECT (usable=false) if ANY are true:
- Anyone died, is missing, was seriously injured, or is in danger right now (including ongoing
  storms, fires, leaks, outbreaks). Property damage with zero casualties is OK only if the
  event is OVER.
- War, armed conflict, terrorism, crime, courts, abuse, disease with victims, mental health crises.
- Elections, partisan politics, heads of state or politicians as the subject, geopolitics,
  immigration, protests, culture-war topics.
- The story is ABOUT a named private individual (people other than public officials and
  celebrities), or any minor is named. Public figures may appear only in the end reveal, never
  as a quest character to be mocked.
- The core fun would require mocking a nation, ethnicity, religion, gender, disability or class.
- Economic hardship is the core (layoffs, poverty, price crises) — unless light and impersonal.

PREFER: infrastructure (bridges, roads, tunnels), science & space, animals & nature recovery,
quirky/"weird news", weather oddities with no casualties, sports upsets, inventions,
festivals, archaeology, cultural events, community projects.

Return ONLY JSON:
{"usable": boolean,
 "reason": "<=20 words",
 "category": "infrastructure|science_space|animals_nature|environment|weather_oddity|sports|festival_culture|invention_tech|archaeology|quirky|economy|other",
 "tone": "joyful|wholesome|neutral|bittersweet|tense|tragic",
 "fun_score": 1-10,
 "people_named": ["..."],          // names appearing in the input
 "private_individuals": boolean,   // true if story centers on a non-public person
 "location": "<place or null>",
 "real_cause": "<what caused the problem, 1 phrase>",
 "real_fix": "<what resolves it, 1 phrase>"}

USER: HEADLINE: {title}\nSOURCE: {source}\nDATE: {date}\nSNIPPET: {snippet}\nFLAGS: {flags}
```
Accept only if `usable && tone ∈ {joyful, wholesome, neutral} && fun_score ≥ 6`. Pulling out `real_cause` and `real_fix` at this step gives the transform prompt its mapping anchors.

### Stage C: output lint (after generation, code only)
Reject and regenerate (at most 2 times) if the quest JSON contains any string from `people_named` outside `the_real_story`, any demonym or ethnic/religious term in creature or villain names, real brand names in the threat, or anything from the Stage A hard-block list.

### Stereotype rules (these go in the transform prompt)
Fantasize **the problem, not the people**. Realm names come from geography (rivers, hills, the local crop), never from ethnicity. No accents, costumes, cuisines-as-jokes or "exotic" framing. Locals are always competent and kind, and the villain is a creature or curse standing in for an impersonal force (rust, tides, drainage, gravity), never a real group.

---

## 3. Transformation prompt (headline → quest seed)

```text
SYSTEM: You are the Royal Bard of "Once Upon a Headline", a co-op fairytale party game.
Turn ONE real, safe news story into a PG, witty, family-friendly quest seed for a 15-minute
one-shot. The joy of the game is the END REVEAL: players realize every fantasy element secretly
mapped to a real fact. So the mapping must be CLEVER and ACCURATE.

RULES
1. Map, don't invent. The_threat = a fantasy creature/curse that is a pun or metaphor for the
   REAL CAUSE ({real_cause}). The_goal = a fantasy version of the REAL FIX ({real_fix}).
   Every location and complication must be traceable to a fact in the input or to ordinary
   common sense about that kind of event. Add "mapped_from" to each.
2. Complications are "obvious in hindsight": a logical consequence of the situation that a
   smart player could have predicted (e.g., an iron-eating monster eats your iron sword).
   Escalate: #1 local snag, #2 bigger systemic snag, #3 finale twist. Each must be solvable
   by teamwork, not combat alone.
3. Never use real people's names or likenesses in the fiction. Real place names may inspire
   a realm name via wordplay (Porter → Porterholm). Fantasize the problem, not the people:
   no national, ethnic, religious or regional stereotypes; locals are capable and kind.
4. Tone: storybook narrator with a wink. Puns welcome. No gore, no death, no romance.
   Villains are defeated by driving off, outwitting, befriending, or curing — not killing.
5. The_real_story is NEUTRAL and factual — one sentence, no jokes, no fantasy words.
6. Keep every string short enough to read aloud on a TV (premise ≤ 70 words).
Return ONLY JSON matching the schema.

USER: HEADLINE: {title}\nSOURCE: {source}\nLINK: {link}\nDATE: {date}\nSNIPPET: {snippet}
EXTRA FACTS: {og_description_and_first_paragraphs}\nCLASSIFIER: {stage_b_json}
```

### Output schema (JSON Schema, abbreviated)
```json
{
  "type": "object",
  "required": ["quest_title","fairytale_premise","realm_name","the_threat","the_goal",
               "locations","complications","the_real_story","art_style_hint"],
  "properties": {
    "quest_title":       {"type":"string","maxLength":60},
    "fairytale_premise": {"type":"string","maxLength":450},
    "realm_name":        {"type":"string"},
    "the_threat": {"type":"object","required":["name","description","mapped_from"],
      "properties":{"name":{"type":"string"},"description":{"type":"string"},"mapped_from":{"type":"string"}}},
    "the_goal":   {"type":"object","required":["description","mapped_from"],
      "properties":{"description":{"type":"string"},"mapped_from":{"type":"string"}}},
    "locations": {"type":"array","minItems":4,"maxItems":5,"items":{"type":"object",
      "required":["name","description","mapped_from"],
      "properties":{"name":{"type":"string"},"description":{"type":"string"},"mapped_from":{"type":"string"}}}},
    "complications": {"type":"array","minItems":3,"maxItems":3,"items":{"type":"object",
      "required":["stage","title","what_happens","why_obvious_in_hindsight","mapped_from"],
      "properties":{"stage":{"enum":[1,2,3]},"title":{"type":"string"},"what_happens":{"type":"string"},
        "why_obvious_in_hindsight":{"type":"string"},"mapped_from":{"type":"string"}}}},
    "the_real_story": {"type":"object","required":["summary","headline","source","link","date"],
      "properties":{"summary":{"type":"string"},"headline":{"type":"string"},"source":{"type":"string"},
        "link":{"type":"string"},"date":{"type":"string"},"context_note":{"type":"string"}}},
    "art_style_hint": {"type":"string"},
    "category": {"type":"string"}, "tone": {"type":"string"}
  }
}
```
Each `complications[i]` is used as the **pre-seeded twist** for scene *i* (see 01-game-rules, consequence ledger). `mapped_from` fields are hidden during play and shown on the reveal screen as a "How the tale was told" list, which is the payoff moment.

---

## 4. Today's headlines through the filter (Oct 24, 2026)

All of these came from the live fetches above (Google News RSS top + `when:1d` search feed, BBC World/Science RSS, NPR).

| # | Headline (source) | Stage A | Stage B | Verdict |
|---|---|---|---|---|
| 1 | Seven shot dead by gunmen at church funeral in Jordan (BBC) | **HARD**: shot, dead, gunmen | — | ❌ |
| 2 | Woman, 65, becomes second patient to die of Ebola in Kenya (BBC) | **HARD**: die, Ebola, patient | — | ❌ |
| 3 | Two rescued after Nairobi building collapse with five still missing (BBC) | **HARD**: missing, manhunt | — | ❌ |
| 4 | Ukraine says Starlink connection 'now stable' after network limits (BBC) | **HARD**: military (in snippet) | — | ❌ |
| 5 | White House lifts tariffs on some Canadian goods as midterm elections loom (BBC) | **HARD**: tariffs, White House, midterm | — | ❌ |
| 6 | North Korea's Kim crosses new bridge into China as trade ties warm (Reuters) | passes ("Kim" alone isn't on the list, and "bridge" is a boost word!) | usable=false: "head of state; geopolitics" | ❌ This is why Stage B exists. |
| 7 | Texas Renaissance Festival evacuated due to nearby propane leak (ABC13) | SOFT: evacuat | usable=false: "ongoing safety incident; casualty status unknown; recheck in 24h" | ⏸ Painfully on-theme for a Texas hackathon, but held. |
| 8 | Halloween candy sales off to a slow start amid high chocolate prices (AP) | passes | usable=true, economy, neutral, fun 6 | ✅ bench ("The Cocoa Drought") |
| 9 | Wales plans to ban steel pylons as government launches consultation (BBC) | passes | usable=true, infrastructure, neutral, fun 7 | ✅ bench ("Bury the Iron Giants") |
| 10 | Road with new bridge in Porter to reopen after nearly 3 years (Chicago Tribune) | passes, boost: bridge, reopen | usable=true, infrastructure, joyful, fun 9 | ⭐ **Quest 1** |
| 11 | Denmark nurdles may be from Tyne spill, agency says (BBC) | passes | usable=true, environment, neutral, fun 8 | ⭐ **Quest 2** |
| 12 | Project to restore rare native trees with DNA testing (BBC) | passes, boost: tree | usable=true, animals_nature, wholesome, fun 8 | ⭐ **Quest 3** |
| 13 | Man City lose 100% Premier League record with defeat at Aston Villa (ESPN) | passes, boost: record, upset | usable=true, sports, joyful, fun 8 (no players named in fiction) | ⭐ **Quest 4** |
| 14 | A 2-year-old grew the 280-pound winning pumpkin at Hysham's Fall Fun Festival (KTVQ) | passes, boost: pumpkin, festival | usable=true, quirky, joyful, fun 10; minor not named in headline, so the child stays unnamed | ⭐ **Quest 5** |

Also rejected: the Eagle's Nest fire (Nazi history, arrest), the Oregon school shooting, Storm Boelo (a live storm, so held until it passes with no casualties), and the UAE oil spill (it was caused by a "tanker strike" in a conflict zone).

---

## 5. Caching & SerpApi budget

**Cron (Vercel Cron / Supabase scheduled function), every 4 h:**
1. SerpApi `google_news` × **2 calls**: `topic_token=<Science & Tech>` and `q="bridge OR festival OR discovered OR restored OR record OR rescued when:1d", so=1`. That gives about 40–60 items.
2. Google News RSS (topic + search) and BBC Science RSS: free and always on, merged and deduped by normalized title.
3. Stage A → enrich the top 15 by boost score → Stage B → transform the top **5** → Stage C → insert into `quests` with `status='ready'` and `expires_at = now()+72h`.
4. Pre-generate the title-card image for each ready quest (art pipeline) so the lobby is instant.

**At game time:** `SELECT * FROM quests WHERE status='ready' AND id NOT IN (recent plays) ORDER BY fun_score DESC, fetched_at DESC LIMIT 3`. The host picks one of 3 "Tales from Today" cards. Zero API calls happen on the critical path.

**Reveal screen, the "meaningful SerpApi use" judges will see:**
- **"The Real Story"**: the direct publisher link (from SerpApi `link`) as a QR code, publisher favicon (`source.icon`) and `thumbnail`.
- **"Full Coverage"**: one `google_news` call with the quest's `story_token` returns 3–5 other outlets covering the same story, so players see it wasn't a one-off. This runs at quest-generation time and is cached on the quest row, not live.
- **"See it for real"**: one `google_images` call (`q=<headline>`) shows a real photo next to the AI fairytale art, side by side as "Tale vs. Truth". It's also cached at generation time.
- **"Learn more"** (optional): when a player taps it on their phone, the server serves the cached `story_token` results, so no new search is needed.

**Budget:** 2 news calls × 6 ticks/day = 12/day. 5 quests × (1 story_token + 1 images) = 10 per tick, but only generate for *new* quests, about 10/day after the first tick. That's roughly **22/day, about 45 for the 36-hour hackathon**, under 20% of the 250/month quota. Throughput is well under 50/hr. Dev testing should replay saved JSON fixtures (`fixtures/serpapi/*.json`) rather than live calls. SerpApi's own free 1-hour cache also absorbs accidental repeats (don't send `no_cache=true`). A hard guard in code (`serpapi_calls` counter table) stops at 200/month and switches to RSS.

---

## 6. Example quest seeds (demo set → `seed_quests.json`)

> Links: the BBC links are direct. The others are the Google News article links from today's RSS, which open in a browser. The live pipeline replaces them with SerpApi's direct `link`.

### Quest 1 — The Rust-Wyrm of Mineral Springs
```json
{
  "quest_title": "The Rust-Wyrm of Mineral Springs",
  "category": "infrastructure", "tone": "joyful",
  "realm_name": "The Twin Banks of Porterholm",
  "fairytale_premise": "For nearly three winters, the two halves of Porterholm have only been able to wave at each other across the Lesser Calumet River. A Rust-Wyrm coiled beneath the old iron bridge and licked its beams into flaky orange lace, until the Royal Inspector declared it unsafe for so much as a goose. Bread arrives stale via the Endless Detour. Grandmothers shout recipes across the water. Enough is enough.",
  "the_threat": {
    "name": "The Rust-Wyrm",
    "description": "A long, damp, copper-orange serpent that eats iron and breathes humidity. Wherever it naps, steel turns to crumbly red flakes. It is not evil, just extremely hungry and extremely snacky.",
    "mapped_from": "The bridge's steel beams deteriorated until inspectors found the structure unsafe for all traffic."
  },
  "the_goal": {
    "description": "Coax the Rust-Wyrm out from under the girders, help the Bridgewrights raise a new span the Wyrm can't eat, and lead the first cart across to reunite the Twin Banks.",
    "mapped_from": "A replacement bridge was built and the road is set to reopen after nearly 3 years."
  },
  "locations": [
    {"name": "The Shouting Banks", "description": "Two riverside villages that have been yelling small talk across the water for three years. Their voices are VERY strong now.", "mapped_from": "The road closure split the route over the Little Calumet River."},
    {"name": "The Endless Detour", "description": "A road that loops so many times that travelers pack lunch, then dinner, then breakfast.", "mapped_from": "Traffic was detoured while the bridge was closed."},
    {"name": "The Inspector's Spire", "description": "Home of Inspector Pemberly, a monocled gnome with a clipboard who has never once said 'looks fine'.", "mapped_from": "The county inspection that closed the bridge."},
    {"name": "The Underspan Nest", "description": "A dripping cavern beneath the girders, glittering with half-chewed rivets.", "mapped_from": "The deteriorated steel beams beneath the deck."},
    {"name": "The Guildhall of Sealed Bids", "description": "Where rival Bridgewright guilds slide wax-sealed scrolls under the door and glare at one another.", "mapped_from": "The replacement was put out to bid and awarded to a contractor."}
  ],
  "complications": [
    {"stage": 1, "title": "Your Sword Is a Snack", "what_happens": "The first hero to draw an iron weapon watches the Wyrm eat it like a breadstick. It now wants more.", "why_obvious_in_hindsight": "It's literally an iron-eating monster. Bring wood, stone, or snacks that aren't you.", "mapped_from": "Steel deterioration: iron is the thing being consumed."},
    {"stage": 2, "title": "No Bridge Without a Bid", "what_happens": "The Wyrm is gone, but the Bridgewrights won't lift a hammer until the Guildhall opens the sealed bids. Two guilds are now locked in a staring contest.", "why_obvious_in_hindsight": "Public works always go out to bid. Someone has to pick a builder.", "mapped_from": "Bids for the new bridge were opened and awarded before construction."},
    {"stage": 3, "title": "The Trial of Weight", "what_happens": "The shiny new bridge is finished, and Inspector Pemberly refuses to open it until it holds the heaviest thing in the realm. Every villager is now rolling their prize pumpkin toward the river.", "why_obvious_in_hindsight": "The same inspector who closed the old bridge was always going to test the new one.", "mapped_from": "New bridges are inspected and load-checked before reopening."}
  ],
  "the_real_story": {
    "summary": "A road in Porter, Indiana, that has been closed for nearly three years is set to reopen with a newly built bridge.",
    "headline": "Road with new bridge in Porter to reopen after nearly 3 years",
    "source": "Chicago Tribune",
    "date": "2026-10-24",
    "link": "https://news.google.com/rss/articles/CBMigAFBVV95cUxNVmxaS290dEV3MHNGQ2Z2dUxhcDR2a0NJN2N3amZJRm52ckQxeDc2SzRaRGR1UUFMYnB0NnpMcXl2SkVLZ0VlN2tyNno3dHZMdnZ3QTVGME9MMWxMQ1JwLTdyUWhKYkRaU1lpTHFHXzd4emdZcWdFUXdaSGYwM0Q5ag?oc=5",
    "context_note": "Likely Mineral Springs Road over the Little Calumet River, closed Dec 1, 2023 for deteriorated steel beams (Town of Porter notice). Verify against the article before demo."
  },
  "art_style_hint": "Cozy storybook gouache, autumn Midwest palette (rust orange, river teal, harvest gold), a sheepish copper serpent curled under a steel truss bridge, villagers waving from both banks."
}
```

### Quest 2 — The Billion Pearls of the Grey Sea
```json
{
  "quest_title": "The Billion Pearls of the Grey Sea",
  "category": "environment", "tone": "neutral",
  "realm_name": "The Tidelands, from the Mouth of Tyne to the Wadden Isles",
  "fairytale_premise": "In midsummer, a careless cargo-giant at the Mouth of Tyne spilled a sack of one billion tiny milk-white pearls. Nobody chased them. Now the Grey Sea's great current has carried them 390 miles east, and a lighthouse keeper with a flying glass eye has found them carpeting the shores of the Wadden Isles. The gulls think they're fish eggs. The crabs are very confused. Someone has to prove where they came from and sweep the tide clean.",
  "the_threat": {
    "name": "The Pearl Plague",
    "description": "A billion false pearls, each smaller than a lentil, that look exactly like fish roe and fool every bird, seal and crab on the coast. They never dissolve, and they never stop traveling.",
    "mapped_from": "A spill of roughly one billion plastic nurdles (pre-production pellets) in the River Tyne in July."
  },
  "the_goal": {
    "description": "Trace the pearls back across the sea, prove their origin to the Alchemists of Aarhus, and rally both shores to sweep the tidelines before the gulls feast.",
    "mapped_from": "Denmark's Environment Protection Agency and Aarhus University tested the pellets and linked them to the Tyne spill."
  },
  "locations": [
    {"name": "The Isle of Mandø", "description": "A pristine tidal island where the pearls first appeared, so thick on the sand it looks like it snowed.", "mapped_from": "Nurdles first spotted on Mandø, Denmark, on 26 September."},
    {"name": "The Watchtower of the Flying Eye", "description": "Home of a lighthouse keeper whose enchanted glass drone can spot a single pearl from the clouds.", "mapped_from": "The finder runs a startup that detects microplastics from drone images."},
    {"name": "The Current Road", "description": "A swirling invisible highway across the Grey Sea. Anything dropped in at Tyne eventually turns up somewhere else.", "mapped_from": "Arrival timing matched North Sea currents and circulation."},
    {"name": "The Alchemists' Tower of Aarhus", "description": "Robed scholars who won't believe anything they haven't put under a lens and tested three times.", "mapped_from": "Aarhus University tested the pellets with the Danish EPA."},
    {"name": "The Mouth of Tyne", "description": "The bustling river harbor where the sack first split.", "mapped_from": "The July spill in north-east England."}
  ],
  "complications": [
    {"stage": 1, "title": "The Tide Giveth (Again)", "what_happens": "The party sweeps the whole beach spotless. Six hours later the tide delivers a fresh batch.", "why_obvious_in_hindsight": "You can't empty a beach while the sea keeps refilling it. Get ahead of the current, not behind it.", "mapped_from": "Nurdles kept washing up wherever the tide reached."},
    {"stage": 2, "title": "Pearls Know No Borders", "what_happens": "The pearls have drifted south onto the sands of Sylt, in the neighboring realm, and its wardens won't take orders from strangers.", "why_obvious_in_hindsight": "The sea doesn't stop at borders. Cleanup takes two kingdoms working together.", "mapped_from": "Samples were also collected on Sylt, Germany."},
    {"stage": 3, "title": "Prove It Wasn't Anyone Else", "what_happens": "The Alchemists agree the pearls match Tyne's, but won't seal the verdict until the party proves no OTHER ship spilled any. To the Harbor Ledgers!", "why_obvious_in_hindsight": "A match isn't proof until you rule out other suspects.", "mapped_from": "The agency noted there were no other recorded spills in the area that could explain the pellets."}
  ],
  "the_real_story": {
    "summary": "Denmark's Environment Protection Agency says plastic pellets that washed up on its coast likely came from a July spill of about one billion nurdles in the River Tyne, roughly 390 miles away.",
    "headline": "Denmark nurdles may be from Tyne spill, agency says",
    "source": "BBC News",
    "date": "2026-10-23",
    "link": "https://www.bbc.co.uk/news/articles/cqy43xv1jwv2o"
  },
  "art_style_hint": "Soft watercolor seascape in cool grey-blue and sand, milky pearl highlights scattered like snow on a tidal flat, a lighthouse with a tiny glass drone, curious gulls. Avoid Viking or horned-helmet clichés."
}
```

### Quest 3 — The Last Fifty Giants of Thamesreach
```json
{
  "quest_title": "The Last Fifty Giants of Thamesreach",
  "category": "animals_nature", "tone": "wholesome",
  "realm_name": "The Floodplain Kingdom of Thamesreach",
  "fairytale_premise": "Long ago, gnarled Black Poplar Giants lined every river in Thamesreach. They drank the floods and sheltered the Hornet-Moth folk. Then came the axes, the Drain-Sprites and the lost meadows. Now only fifty Giants remain in all of Oxenshire, standing so far apart they've forgotten each other's voices. The Druids of Long Mead have a plan: read each Giant's secret bloodline, take cuttings, and grow a new grove before the river rises again.",
  "the_threat": {
    "name": "The Drain-Sprites and the Great Sundering",
    "description": "Tiny mischief-sprites who pull the plugs out of marshes and sip the floodplains dry, leaving the Giants stranded in lonely patches. The real curse is distance: the Giants are too scattered to renew themselves.",
    "mapped_from": "Black poplar numbers fell due to decades of felling, land drainage and habitat loss. The remaining population is 'extremely fragmented'."
  },
  "the_goal": {
    "description": "Read each Giant's bloodline with the Lineage Rune, take cuttings from the true Giants, raise saplings, and plant a new guardian grove along the river.",
    "mapped_from": "The project uses DNA analysis of existing trees, propagates cuttings and plants them in suitable sites."
  },
  "locations": [
    {"name": "The Long Mead Druid Circle", "description": "A cheerful grove-council who call the Giants 'extraordinary survivors' and speak to moths.", "mapped_from": "The Long Mead Foundation in Swindon is involved in the project."},
    {"name": "The Gnarled Giant of the Ford", "description": "A colossal tree with a trunk like a twisted castle tower, wise but very lonely.", "mapped_from": "Black poplars' 'great gnarled trunks' that look like something out of a fantasy epic."},
    {"name": "The Thirsty Fens", "description": "Once-soggy marshland now dry and cracked where the Drain-Sprites partied.", "mapped_from": "Land drainage as a cause of decline."},
    {"name": "The Swollen Thames", "description": "A river that keeps creeping over its banks now that no Giants hold it back.", "mapped_from": "Black poplars reduce flood risk by lining rivers and floodplains."},
    {"name": "The Treasury of Oxenshire", "description": "A council vault with a strict ledger-keeper who will match gold, but only up to a point.", "mapped_from": "The county council will match-fund the fundraiser up to £10,000."}
  ],
  "complications": [
    {"stage": 1, "title": "Not Every Giant Is a Giant", "what_happens": "The Lineage Rune reveals that some trees calling themselves Giants are look-alike imposters. Plant their cuttings and you'll grow the wrong forest.", "why_obvious_in_hindsight": "If telling them apart by eye were easy, nobody would need the DNA test.", "mapped_from": "The project relies on DNA testing of existing trees before propagation."},
    {"stage": 2, "title": "The Gold Runs Half-Way", "what_happens": "The Treasury will match every coin the villagers raise, but only up to 10,000. The grove needs 20,000. Time to throw a fundraiser feast.", "why_obvious_in_hindsight": "Matched funding means someone still has to raise the first half.", "mapped_from": "Project aims to raise £20,000, with council matching up to £10,000."},
    {"stage": 3, "title": "Plant It and the River Takes It", "what_happens": "The first saplings go in right at the water's edge and the swollen Thames promptly floats them away.", "why_obvious_in_hindsight": "Trees that tame floods need to grow up first. Saplings need sheltered 'suitable sites'.", "mapped_from": "Cuttings are planted in suitable sites along the Thames and its flood plain."}
  ],
  "the_real_story": {
    "summary": "Conservation groups in the Thames Valley are using DNA testing, cuttings and new plantings to restore England's rare black poplar trees, with only about 50 recorded in Oxfordshire.",
    "headline": "Project to restore rare native trees with DNA testing",
    "source": "BBC News",
    "date": "2026-10-24",
    "link": "https://www.bbc.co.uk/news/articles/cw240ln41mq2o"
  },
  "art_style_hint": "Arthur Rackham-style ink and wash: huge gnarled poplars with faces in the bark, misty English floodplain, glowing moth-folk, druids in muddy wellies."
}
```

### Quest 4 — The Fall of the Undefeated Sky-Colossus
```json
{
  "quest_title": "The Fall of the Undefeated Sky-Colossus",
  "category": "sports", "tone": "joyful",
  "realm_name": "The League of Twenty Banners",
  "fairytale_premise": "All season, the Sky-Blue Colossus of the Northern Citadel has won every tourney it played. Bards have pre-written the 'Ballad of the Perfect Season'. Now the Colossus marches on Villa Keep, home of the Claret Lions, who are underdogs but not quite under-lions. You are the Lions' scrappy war council. Your mission: do the impossible, and give the bards something new to sing about.",
  "the_threat": {
    "name": "The Aura of Inevitability",
    "description": "A shimmering sky-blue fog that rolls off the Colossus and whispers 'you've already lost' to every opponent. It works great, until somebody stops listening.",
    "mapped_from": "Manchester City arrived with a 100% winning record in the Premier League."
  },
  "the_goal": {
    "description": "Break the Aura and win the Tourney of Villa Keep, ending the Colossus's perfect streak.",
    "mapped_from": "Aston Villa beat Manchester City, ending City's 100% Premier League record."
  },
  "locations": [
    {"name": "The Bards' Quarter", "description": "Minstrels nervously rehearsing a ballad with the ending already written.", "mapped_from": "Media buzz about a perfect season."},
    {"name": "Villa Keep", "description": "A claret-and-blue fortress whose crowd roars so loud pigeons migrate early.", "mapped_from": "Aston Villa's home ground."},
    {"name": "The Scrying Pool of Tactics", "description": "Where the Colossus has studied every move the Lions have ever made.", "mapped_from": "Top clubs' heavy opposition scouting and analysis."},
    {"name": "The Tourney Green", "description": "The great field where the match itself unfolds.", "mapped_from": "The match pitch."}
  ],
  "complications": [
    {"stage": 1, "title": "They've Seen This Before", "what_happens": "The Lions' favorite trick play fails instantly. The Colossus has watched it in the Scrying Pool a hundred times.", "why_obvious_in_hindsight": "An unbeaten giant got that way by studying everyone. You need a plan nobody has ever tried.", "mapped_from": "Elite teams scout opponents thoroughly."},
    {"stage": 2, "title": "The Roar Is the Real Magic", "what_happens": "The Aura only breaks when the whole Keep believes at once, and half the crowd is still queuing for pies.", "why_obvious_in_hindsight": "Home advantage only works if the home crowd shows up loud.", "mapped_from": "Villa won at home."},
    {"stage": 3, "title": "The Colossus Wakes Up", "what_happens": "You've taken the lead! Now the Colossus throws every knight forward at once. Hold the line until the final horn.", "why_obvious_in_hindsight": "A champion that's losing for the first time all season won't go quietly.", "mapped_from": "A favorite pushing hard late after falling behind (typical match dynamic)."}
  ],
  "the_real_story": {
    "summary": "Aston Villa beat Manchester City, ending City's 100% winning record in the Premier League this season.",
    "headline": "Man City lose 100% Premier League record with defeat at Aston Villa",
    "source": "ESPN",
    "date": "2026-10-24",
    "link": "https://news.google.com/rss/articles/CBMiqgFBVV95cUxQcm44T3BmNVFnVk1SQzlYT0FtUnNqSU93MEw1QmtHbDJxWnVVQ3kyWnZFS2czQVNsaDhpay1DVHppcGdpZTZqNl9SdmNVaVRNTVlLM1hWYlB3VUl2alJfangyQ3hLYlZzVnZtejlEbG1oWE1nTF9lSm5UaWdtU1M4Nlhnb3Joa1JDemFiUWhpZE1tdzdrS0p6S21aQ055SFBUd2FSTEsta1Y2Zw?oc=5",
    "context_note": "No players are named in the fiction; club names appear only in the reveal."
  },
  "art_style_hint": "Illuminated medieval manuscript meets sports poster: a towering sky-blue armored colossus facing a pride of claret lions in a roaring castle stadium, gold-leaf borders."
}
```

### Quest 5 — The Littlest Gardener and the Pumpkin That Ate the Fair
```json
{
  "quest_title": "The Littlest Gardener and the Pumpkin That Ate the Fair",
  "category": "quirky", "tone": "joyful",
  "realm_name": "The Treasure Vale of Hysham",
  "fairytale_premise": "At the Fall Fun Festival in the Treasure Vale, the Great Gourd Crown is up for grabs. The favorite isn't a grizzled farmer. It's the Littlest Gardener, two years old and about knee-high, whose pumpkin weighs 280 pounds, roughly ten times the gardener. The pumpkin is still in the patch. The scales are across the fairgrounds. Nap time is in one hour.",
  "the_threat": {
    "name": "The Gourd of Unstoppable Momentum",
    "description": "A colossal, gleaming orange pumpkin too heavy to lift and far too round to steer. Once it starts rolling, it has opinions about where it's going.",
    "mapped_from": "The winning pumpkin weighed 280 pounds."
  },
  "the_goal": {
    "description": "Get the Great Gourd from the patch to the Royal Scales in one piece and crown the Littlest Gardener before nap time.",
    "mapped_from": "A 2-year-old's pumpkin won the festival's weigh-off."
  },
  "locations": [
    {"name": "The Patch of Plenty", "description": "Where the Great Gourd sits like a sleeping orange moon.", "mapped_from": "The pumpkin was grown locally."},
    {"name": "Hayride Hill", "description": "A gentle slope that is not gentle at all if you're a 280-pound pumpkin.", "mapped_from": "Typical fall-festival grounds (hayrides, fields)."},
    {"name": "The Midway of Distractions", "description": "Kettle corn, ring toss, a petting zoo. Everything a toddler would rather do than win a crown.", "mapped_from": "The Fall Fun Festival setting."},
    {"name": "The Royal Scales", "description": "An enormous brass weighing platform guarded by a very serious Weigh-Master.", "mapped_from": "The festival's pumpkin weigh-in."}
  ],
  "complications": [
    {"stage": 1, "title": "Too Heavy to Lift", "what_happens": "Four heroes heave. The pumpkin doesn't notice. It weighs more than the whole party's packs combined.", "why_obvious_in_hindsight": "It's 280 pounds. You need a wagon, a lever, or a very polite ox.", "mapped_from": "The pumpkin's 280-pound weight."},
    {"stage": 2, "title": "What Goes Down Hayride Hill...", "what_happens": "The party gets it rolling, and now it won't stop. It's headed straight for the Midway at alarming speed.", "why_obvious_in_hindsight": "Big, round, heavy, downhill. Physics was always going to win.", "mapped_from": "Moving giant pumpkins is notoriously tricky."},
    {"stage": 3, "title": "The Champion Is Asleep", "what_happens": "The pumpkin is weighed and the crown is ready, but the Littlest Gardener has fallen fast asleep in a hay bale. Wake them gently, or the ceremony is a bust.", "why_obvious_in_hindsight": "The champion is two. It was always going to come down to nap time.", "mapped_from": "The winner is a 2-year-old."}
  ],
  "the_real_story": {
    "summary": "A 2-year-old grew the 280-pound pumpkin that won the weigh-off at the Fall Fun Festival in Hysham, Montana.",
    "headline": "A 2-year-old grew the 280-pound winning pumpkin at Hysham's Fall Fun Festival",
    "source": "KTVQ",
    "date": "2026-10-24",
    "link": "https://news.google.com/rss/articles/CBMipAFBVV95cUxOODhVb0ItQktJNE0zMkJlRlJaUU5GakVSb1p3U2RRQWpzXzU3S3drQnRoX1lJN3ZaY3FUMWI4NTliVVR1aV9vME9OVFVSMkJJaVliMGxFRHFobnlWbmhyRWh5UWZtMnRUUGx6N2Izb3NsWGUyNVJJZks4T2JYRWVZNzJjNWoxRTVxSnh3aHlPc3JFQUhFX011MHltZVd2WUl2NXZYeg?oc=5",
    "context_note": "The child is never named in the game. The reveal shows only the headline and link."
  },
  "art_style_hint": "Warm Richard Scarry-style busy fairground, big-sky Montana prairie at golden hour, a gigantic shiny pumpkin dwarfing a tiny gardener in overalls, hay bales and bunting."
}
```
