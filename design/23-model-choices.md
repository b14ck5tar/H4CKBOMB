# 23. Model choices: one model per job, picked by testing

Sat Oct 24 2026. This responds to the Meta judge's note: "use different models for different jobs and show taste by testing which works best."
Web research came from dev.meta.ai/docs, vendor pricing pages and Artificial Analysis (sources at the bottom).
The bake-off made 22 real Muse calls (budget 30). The scripts and raw JSON are in the session scratchpad (`bake/`), not in the repo.

## TL;DR: the lineup

| Job | ⭐ Pick | Alternative | Cost |
|---|---|---|---|
| 1. Scene art (consistent heroes) | **muse-image-1.0** `/images/edits` with a hero lineup sheet + previous scene as refs, `reasoning_strength:"low"` | Gemini Nano Banana 2.1 (`gemini-nano-banana-2.1`; 5 character refs + 10 object refs) | $0.01/image (Muse) vs $0.034 at 1K (Gemini) |
| 2. Narration voice | **OpenAI gpt-4o-mini-tts** with an `instructions` line ("warm storybook narrator, dry and deadpan, small pause before punchlines") | ElevenLabs Flash v2.5 (~75 ms model latency, best stock narrators). Gemini 3.8 Flash TTS is free (style prompts, raw PCM). Browser SpeechSynthesis is the offline fallback. | ~$0.015/min audio. A whole night costs well under $1. |
| 3. Judging plans | **muse-spark-1.3 `minimal`** + the v2 rubric below | Groq `openai/gpt-oss-120b` strict JSON (~0.8 s time to first token, $0.15/$0.60 per M) | ~$0.002 per verdict |
| 4. Story creation | **muse-spark-1.3 `high`** + the v2 prompt below | muse-wonder-1.0 `medium` (more coherent arcs, 2× slower, 3× pricier). Claude Opus 5.5 is the strongest off-Meta writer (#1 on EQ-Bench creative writing), but it weakens the "Muse is essential" story. | ~$0.009/story (spark) vs ~$0.03 (wonder) |

The story for judges: **Spark thinks fast (judge), Spark thinks hard (writer), Muse Image paints, Muse Voice Transcribe listens, and a dedicated TTS speaks.** Meta has no TTS model, so the voice is the one job that has to leave Meta.

Where Wonder could earn a spot (untested idea): it was the most self-consistent judge (identical tiers across runs) but 10–16 s per call. That suits offline jobs where care beats speed, such as the news safety filter ("is this headline harmless?") or the end-of-night epilogue.

**Heads-up:** `.env.local` already has a `GEMINI_API_KEY` entry (name only checked; not tested). If it is valid, Gemini TTS (free tier) and Nano Banana are available with no new signup.

## Bake-off A: judging (8 plans, one scene, each config run twice)

Scene: "The Boulder That Waited 100 Years." It blocks the road to Mabel's Bakery. A grumpy rock spirit inside hates being stared at. Nearby: a tow truck with a chain, selfie tourists, a sleepy council.
The plans, with my expected tier:

| Plan | Expected |
|---|---|
| p1. Push it with bare hands | risky |
| p2. Promise the spirit the tourists will stop staring | clever |
| p3. Tow truck chain | clever |
| p4. Eat it | miracle |
| p5. Bribe it with a pie | absurd |
| p6. Call the council's road crew | solid |
| p7. Teleport the town | miracle |
| p8. Tickle it | absurd |

| Config | Batch of 8, latency | Single plan, latency | Match expected (run 1 / run 2) | Same tier across runs |
|---|---|---|---|---|
| spark-1.3 minimal, v1 prompt | 2.2 s, 2.4 s | 1.7 s, 1.0 s | 7/8, 5/8 | 6/8 |
| spark-1.3 low, v1 prompt | 4.8 s, 6.2 s | 1.4 s, 2.1 s | 7/8, 5/8 | 6/8 |
| wonder-1.0 low, v1 prompt | 10.0 s, 14.9 s | 15.8 s, 14.1 s | 6/8, 6/8 | **8/8** |
| **spark-1.3 minimal, v2 rubric** (3 runs) | 2.3 s, 1.6 s, 2.2 s | 1.7 s | **8/8, 8/8, 8/8** | **8/8** |

What the runs showed:
- **The rubric mattered more than the model.**
  - With the v1 tier definitions, every model called "push it with bare hands" a *miracle*. That is unfair: "hard" got scored as "impossible".
  - Spark also flip-flopped on the tow truck (clever vs solid) and the pie bribe (absurd vs risky).
  - In the single-plan call, both Spark and Wonder ruled the pie bribe a *miracle* "because the road is blocked, so you can't get the pie." That is a logistics nitpick, and the batch call didn't make it.
- **v2 fixed all three problems** at the same speed:
  - It orders the tests (miracle → absurd → clever → solid → risky) and states "Hard is risky, not miracle."
  - It adds "Assume heroes can get ordinary items mentioned in the scene. Never punish small logistics."
  - It gives one 5-tier example from a different scene.
  - Caveat: I wrote both the examples and the test plans, so this may be over-fitted. Re-test v2 on a held-out scene with plans written by someone else before trusting 8/8.
- **Latency:** spark minimal took 1.0–1.7 s for a single plan and 1.6–2.4 s for a batch of 8.
  - It still reasons (133–355 reasoning tokens) because `none` is rejected on Spark.
  - It meets the <2 s target for one plan per call. A batch of 8 brushes the limit, and the p95 may go over 2 s.
  - If it does, switch the judge to Groq gpt-oss-120b. That is the textbook "different model for a different job" move.
- **Wonder is too slow** for live judging (10–16 s) and costs ~10× more per call. Low effort still produced ~700–900 reasoning tokens.
- Reasons were specific and readable in all configs ("Uses spirit complaint about being stared at"). They are good enough for the DM's Notes as they are.
- Consistency ideas that cost nothing:
  - Cache verdicts by (scene id, normalized plan text) so a repeated plan always gets the same tier.
  - Pass `prompt_cache_key` (cached input drops from $1.25 to $0.15 per M).

v2 rubric, verbatim (drop into the verdict system prompt):
```
Decide with these tests, in order:
- miracle: breaks the basic rules of this world even for a cartoon (teleporting a town, eating stone, time travel).
- absurd: silly, but a cartoon could allow it (bribing, tickling, or flattering an object with a spirit).
- clever: uses a specific thing named in the scene (an object, a character's want or complaint) or teamwork. It just works.
- solid: a normal, sensible approach that does not use a scene detail.
- risky: a normal person could try it, but it is likely to go wrong (brute force, climbing, sneaking). Hard is risky, not miracle.
Assume heroes can get ordinary items mentioned in the scene. Never punish small logistics.
Examples from another scene (a locked haunted library): "kick the door down" = risky; "ask the librarian ghost for the key" = solid; "return the overdue book the ghost keeps mentioning" = clever; "sing to the door" = absurd; "turn the library into a cloud" = miracle.
```

## Bake-off B: story creation (3 scenes, JSON {title, narration ≤45 words, goal ≤10 words})

The sources were a news item ("Left alone with nothing to do, AI agents started playing") and an anecdote ("my flight got cancelled in Lisbon and I slept in the airport").
FK grade = Flesch-Kincaid grade over all narration. A heuristic syllable counter was used, so treat it as ±1.

| Config | Source | Latency | FK grade | Limits kept | My read |
|---|---|---|---|---|---|
| spark-1.3 high, v1 | news | 6.5 s | 2.0 | yes | Funniest. "The pile of notes is now taller than your coffee cup." "One is pretending to be your mouse pointer." |
| wonder-1.0 medium, v1 | news | 12.3 s | 2.2 | yes | **Bug: all 3 titles were "The AI Playtime Curse."** Flatter jokes ("all chairs must wear hats"). |
| spark-1.3 high, v1 | Lisbon | 5.7 s | 1.4 | yes | Great specifics (fado on loop, "a pigeon in a tiny vest", "Your neck pillow feels watched"). Choppy 4-word sentences. Final goal was a yes/no choice. |
| wonder-1.0 medium, v1 | Lisbon | 14.8 s | 0.3 | yes | Most coherent arc: ghost passengers in neck pillows, a ghost captain, the real plane landing at dawn. Very choppy. |
| **spark-1.3 high, v2** | news | 9.5 s | **4.9** | yes | Flows better and stays funny ("race paper clips like small horses"). Goals are real challenges. |
| **spark-1.3 high, v2** | Lisbon | 8.2 s | **4.2** | yes | Smoother, but less sharp than v1 (the pigeon is gone). |

Findings:
- **Both models overshoot "simple."** The v1 prompt ("a 10-year-old reads easily") produced grade 0–2 baby-talk.
  - The v2 prompt says "US grade 5; mix short sentences with some longer ones joined by and/but/so/because; never three tiny sentences in a row."
  - That moved Spark to grade 4.2–4.9, close to the 5–6 target.
- **Pick Spark high for stories:**
  - It was funnier in 2 of 2 head-to-heads.
  - It is 2× faster (6–10 s vs 12–15 s) and ~3× cheaper.
  - Wonder made a structural mistake (duplicate titles), which in the app would need a validator retry.
  - Wonder's advantage is arc coherence. A cheap upgrade is to have Spark write and then validate in code: distinct titles, word limits, and a goal that isn't a yes/no choice.
- v2 also added "titles different for each scene" and "goal is a challenge the heroes can attempt with a plan (not a yes/no choice)." Both were followed.
- Taste call for the creative director: v1 had sharper jokes, and v2 reads better aloud. A middle path is to keep v2's reading-level line and add "one oddly specific detail per scene" to win the jokes back.

Best lines from each model:
- Spark (news, v1): *"The workers are very good at hiding. One is pretending to be your mouse pointer."*
- Wonder (Lisbon): *"You face the ghost captain at Gate 12. He sleeps standing up and snores into the speaker. His plane waits, clear as glass. Behind it, your real plane lands in the morning sun."*

## Job notes from research (as of Oct 24 2026)

### Images
**Muse Image** costs $0.01 flat, and edits are included. Failed or filtered images are free.
- It takes 1–10 references and allows 150 RPM.
- It is #3 on the Artificial Analysis editing arena. That is from a Sep capture I couldn't verify, and no public figures exist for multi-character consistency or latency.

Other options:
- **Nano Banana 2.1**: the best-documented multi-character consistency (5 character + 10 object refs), at $0.034 for 1K and $0.050 for 2K. It works through the `@google/genai` SDK and has no free image tier.
- **gpt-image-2**: strong (#2 on the arena) but slow ("up to 2 minutes").
- **FLUX.2 pro**: good, but each reference image is billed, about $0.10–0.18 with 5–10 refs.
- **Ideogram**: only 1 character reference.
- **Recraft**: matches a style, not a character's identity.

Consistency recipe for Muse:
1. Paint one "party lineup" sheet with all heroes.
2. Pass the lineup sheet plus the previous scene as references.
3. Keep the pre-painted demo scenes as the fallback.

If heroes drift, spend 30 minutes on a side-by-side test against Nano Banana.

### Voice
**Meta has no TTS model.** dev.meta.ai/docs/models lists muse-voice-transcribe-1.0 (speech to text, $0.18/hr) and states that it "does not synthesize speech."

| Option | Steerability | Price | Notes |
|---|---|---|---|
| gpt-4o-mini-tts | Free-text `instructions` field | $12 per M audio tokens (~$0.015/min) | Chunked mp3 to `<audio>` through a Next route; least integration work. Retires Jan 6 2027, which doesn't matter for the hackathon. |
| ElevenLabs Flash v2.5 / v4 Turbo | Pick a stock narrator voice | $40 per M characters | Fastest first audio (~75–100 ms model latency), the best voices, an HTTP stream or WebSocket, and a 10k-character free tier. |
| Gemini 3.8 Flash TTS | Style prompts plus tags like `<short pause>` | Free tier, then ~$0.013/min | Raw 24 kHz PCM, so it needs Web Audio code. |
| Cartesia | No style control | Not compared | |
| Deepgram | No style control | Not compared | |
| Hume Octave 2 | Strong acting instructions | Pricing unclear | |
| Browser SpeechSynthesis | None | Free | Robotic. Use it only as a fallback. |

### Text (Meta Model API facts)
- **Prices per M tokens:**
  - spark 1.1/1.2/1.3: $1.25 in, $0.15 cached, $4.25 out.
  - wonder: $4 in, $0.20 cached, $20 out.
  - Never use the `-contributor` variants, because Meta trains on that data.
- **Limits:** 3,000 RPM and 4M TPM per model, with a 1M-token context.
- **Effort:** values run minimal through max, and `none` returns HTTP 400. Reasoning tokens are billed as output.
- **Structured output:** `json_schema` is constrained decoding, and `strict` also validates the schema itself.
- **Unknowns:** no published latency, and streaming isn't documented.
- **Possible deprecation:** Artificial Analysis labels spark-1.3 "deprecated, use Muse Wonder." I could not confirm this on Meta's pages. Pin the model name and keep `fallbacks.ts`.
- **Groq:** it lists a `meta-models/muse-spark-open` (open weights) in its strict-schema docs. If it is live, it would be a fast, Meta-branded judge. Its status and price are unverified.

## Sources
- dev.meta.ai/docs, /docs/models, /docs/pricing-rate-limits, /docs/reasoning, /docs/structured-output, /docs/image-generation, /docs/api-reference/voice
- ai.google.dev/gemini-api/docs/pricing (updated Oct 22 2026), /docs/image-generation, /docs/speech-generation
- developers.openai.com/api/docs/pricing, /docs/guides/text-to-speech, /docs/guides/image-generation
- elevenlabs.io/pricing/api, elevenlabs.io/docs/models
- console.groq.com/docs/models, /docs/structured-outputs
- artificialanalysis.ai: the image editing arena and the muse-spark-1.3 provider pages
- EQ-Bench Creative Writing v3 and arena.ai creative writing, via a digitalapplied.com summary (the live tables failed to load)
