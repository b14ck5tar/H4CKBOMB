# Sound system (`@/lib/sound`)

All music and sound effects are generated live with the Web Audio API: no audio files, no licences.
Audition everything at **`/sound-test`**.

One shared AudioContext serves the music and every sound effect (legacy `lib/sfx.ts` included). It is created
on the first click / tap / keypress (a one-time listener is attached automatically), so nothing errors or warns
before that. Calls made before the unlock are remembered: `music.startLobby()` on page load starts the
lobby music on the first tap.

## Music (the TV only)

Play music on the **TV / big screen only**. Phones play sound effects only (four phones plus a TV each
playing music would be noise).

```ts
import { music, useMusic } from "@/lib/sound";

// easiest: a hook that follows the screen (crossfades on change, never restarts the same track)
useMusic(s.phase === "lobby" ? "lobby" : storyMood);   // null = fade out

// or imperatively
music.startLobby();                 // lobby / attract / landing: "Night Shift"
music.startStory("eerie");          // "mysterious" | "eerie" | "playful" | "warm" | "tense"
music.startStory(scene.music);      // any mood-ish word works: the AI's "calm" -> warm, "epic" -> tense, "eerie" -> eerie
music.startStory();                 // no mood: rotates through the five (persisted, so consecutive games differ)
music.stop();                       // fade out (1.5 s)
```

Suggested phase mapping (QuickTV/TV): lobby, story_vote, attract: `"lobby"`. From the first scene through
the epilogue: the story's mood. On `final_roll`: `music.setIntensity(0.8)`. On the reveal/keepsake: back to
`setIntensity(0)` (or `music.startStory("warm")` for a soft landing).

### Narration ducking (QuickTV `useNarrator`)

```ts
const audio = new Audio(url);
const unduck = music.duckWhile(audio);   // ducks -12 dB on play, releases on pause/ended/error
// ...in the effect cleanup:
audio.pause();
unduck();
```
Or by hand: `music.duck(true)` / `music.duck(false)` (attack ~250 ms, release ~600 ms). It is keyed, so
overlapping clips are fine: `music.duck(true, "clipA")`.

### Intensity (big rolls, finale)

```ts
music.setIntensity(0.7);       // 0..1, glides: brighter, +3.5 dB, busier drums / arps / ostinato
music.swell(1, 4000);          // temporary: up to 1 for 4 s, then glides back (nat 20, final roll landing)
```

### Volume and mute

```ts
sfx.setMuted(true);            // existing TV mute button: now mutes music too (same "ouar-muted" key)
music.toggleMute();            // music only (persisted, "gp-music-muted")
music.setMasterVolume(0.8);    // music only, 0..1 (persisted)
const p = useSoundPrefs();     // { muted, musicMuted, volume, track, toggleMuted, toggleMusic, setVolume }
```

## Sound effects

```ts
import { playSfx } from "@/lib/sound";

playSfx("tap");                       // any button press (phones)
playSfx("pick");                      // choosing a card / hero / suggestion
playSfx("vote");                      // backing a plan
playSfx("submit");                    // sending a plan / answer
playSfx("join");                      // a player joined (TV)
playSfx("turnStart");                 // "your turn" (the active player's phone + TV)
playSfx("timerTick", { index: secondsLeft, final: secondsLeft === 1 });   // last 5 s only, alternates tick/tock
playSfx("diceRoll", { ms: 1400 });    // rattle for the roll animation length
playSfx("diceLand");
playSfx("success"); playSfx("partial"); playSfx("fail");                    // outcome tiers
playSfx("nat20"); playSfx("nat1");    // play instead of success/fail on a natural 20 / 1
playSfx("finaleShake", { ms: 2000 }); // everyone shaking for the final roll
playSfx("reveal");                    // "this really happened"
playSfx("keepsake");                  // the keepsake card appears
```
Options: `{ volume?: number; pitch?: number /* semitones */; ms?: number; index?: number; final?: boolean }`.
Loose names also work (`"your turn"`, `"nat_20"`, `"yes-but"`, `"send"`). Unknown names are ignored.

Legacy: every existing `sfx.*` call (`sfx.diceRoll()`, `sfx.fanfare()`, `sfx.play(outcome.sfx)`, ...) works
unchanged. `sfx.play()` also accepts the house names, and `sfx.fx(name, opts)` is an alias for `playSfx`.

## Design notes

- **Under the voice.** Music sits around -30 dBFS RMS (measured on `/sound-test`), with a -4 dB dip at 2.6 kHz
  (the "voice pocket") so narration always reads, plus -12 dB of ducking while the narrator talks.
- **Small speakers.** The bass is softly saturated so it is still heard on laptop / TV speakers.
- **Never loops obviously.** Chords and grooves are hand-written; melody, fills, ghost notes, sections
  (full / airy / breakdown) and timing are rolled live.
- **CPU.** A 50 ms lookahead scheduler (350 ms ahead); persistent buses, filters, LFOs and one shared
  convolution reverb (impulse response generated in code); each note's tiny graph disconnects itself.
- Files: `context.ts` (shared context, unlock, global mute), `music.ts` (engine), `tracks.ts` (the six
  loops + `toMood`), `instruments.ts` (pad, FM e-piano, bell, pluck, bass, drums), `sfx.ts` (house SFX),
  `dsp.ts` (noise, reverb IR, waves), `useMusic.ts` (React hooks).
