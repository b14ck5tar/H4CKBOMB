# Sound system (`@/lib/sound`)

All music and sound effects are generated live with the Web Audio API: no audio files, no licences.
Audition everything at **`/sound-test`** (loops, intensity, ducking, phase cues, dice, graded results).

One shared AudioContext serves the music and every sound effect (legacy `lib/sfx.ts` included). It is created
on the first click / tap / keypress (a one-time listener is attached automatically), so nothing errors or warns
before that. Calls made before the unlock are remembered: `music.startLobby()` on page load starts the
lobby music on the first tap. Everything below is backward compatible with the first version.

## Music (the TV only)

Play music on the **TV / big screen only**. Phones play sound effects only.

```ts
import { music, useMusic } from "@/lib/sound";

useMusic(s.phase === "lobby" ? "lobby" : storyMood, intensity);   // null = fade out; crossfades on change

music.startLobby();                 // "Night Shift"
music.startStory("eerie");          // "mysterious" | "eerie" | "playful" | "warm" | "tense" (or "calm"/"epic"/...)
music.startStory();                 // no mood: rotates through the five (persisted)
music.stop();                       // fade out (1.5 s)
```

### Intensity = adaptive layers

`music.setIntensity(0..1)` (or the 2nd argument of `useMusic`) now adds and removes whole layers smoothly:

| intensity | what you hear |
|---|---|
| 0 - 0.15 | calm bed: chords + pad, drums at half level, lead mostly gone (good under long narration) |
| ~0.2 (default) | the normal story groove |
| 0.5 | full groove: drums, bass and lead all in, extra percussion (16th shakers, open hats) |
| 0.8 - 1 | everything: ostinatos / tremolos, brighter mix, +3.5 dB |

`music.swell(1, 4000)` still works (temporary push, then glides back).

### Phase cues (new)

Cues play in the key of whatever track is on, through the music bus (so they duck and mute with it).

```ts
music.cue("riser", { ms: 1800 });   // roll starts: suspense build; the drums step back while it rises
music.cue("hit", { grade: "up" });  // the die lands: boom + crash + chord ("up" | "down" | "neutral"); ends a riser/finale
music.cue("finale", { ms: 8000 });  // final roll: a short tension bed (drone, accelerating heartbeat, ticking)
music.cue("resolve");               // reveal: warm major bloom; ends any tension
music.cue("yourTurn");              // TV sting when a new player's turn starts
music.cueStop();                    // cut any running cue and return to the normal mix
```

Suggested hookup in QuickTV:
- `Roll` component: when the die is shown, `music.cue("riser", { ms: ROLL_ANIM_MS - 200 })`; when it settles,
  `music.cue("hit", { grade: band === "FAIL" || band === "CATASTROPHE" ? "down" : band === "YES_BUT" ? "neutral" : "up" })`.
- `final_roll` arm/shake: `music.cue("finale", { ms: <time until landing> })`; landed: `music.cue("hit", ...)`.
- `reveal`: `music.cue("resolve")` (then the "warm" track as now).
- `turn` (TV): `music.cue("yourTurn")` alongside or instead of `playSfx("turnStart")`.

### Narration ducking (already wired in QuickTV)

```ts
const unduck = music.duckWhile(audio);   // -12 dB, 250 ms down / 600 ms up, linear in dB
```
Or `music.duck(true | false, key?)`.

### Volume and mute

```ts
sfx.setMuted(true);            // TV mute button: mutes music too ("ouar-muted")
music.toggleMute();            // music only ("gp-music-muted")
music.setMasterVolume(0.8);    // music only, 0..1
const p = useSoundPrefs();     // { muted, musicMuted, volume, track, toggleMuted, toggleMusic, setVolume }
```

## Sound effects

```ts
import { playSfx, playResult, dice } from "@/lib/sound";

playSfx("tap");            // button press: a soft woody tock (phones)
playSfx("pick");           // choosing a card / hero / suggestion: wood + muted pluck
playSfx("vote");           // backing a plan: low knock + pluck
playSfx("submit");         // sending a plan: low whoosh + two plucks
playSfx("join");           // a hero joins: round pop + three-note pluck hello
playSfx("cardFlip");       // a card turning over
playSfx("turnStart");      // "your turn" (phone): two soft plucks over a warm pad
playSfx("timerTick", { index: secondsLeft, final: secondsLeft === 1 });   // last 5 s, wood tick/tock
playSfx("reveal"); playSfx("keepsake"); playSfx("finaleShake", { ms: 2000 });
// also: pop, stamp, whoosh, thud, boom, swell, heartbeat, countBeat ({ final: true } = "go"), drumroll ({ ms })

// dice, synced to the animation
dice.throw();              // leaves the hand: rattle + low whoosh
dice.bounce(n, { pan });   // each table hit, n = 0, 1, 2 ... (softer each time)
dice.land();               // final thud + the die rocking to a stop
playSfx("diceRoll", { ms }); // one-shot: throw + 7 bounces over ms (no land)

// graded result phrases (short musical phrases in the same instruments, no dings)
playResult("legendary" | "great" | "good" | "meh" | "bad" | "disaster");
```
**One family.** Since the CD's notes ("no loud dings", "all the sounds should have similar themes", "no womp
womp"), every effect is built only from the music's palette: muted plucks, soft low-index FM keys, a warm pad,
soft wood clicks, round low blips, low whooshes and dice wood/plastic. No bells or chimes; no sad trombones,
descending slides or deflating stings. Everything passes a 4 kHz lowpass, the music's own room, and a gentle
peak catcher, and the tonal effects follow the key of whatever track is playing.
- `bad` = a muted pluck stumble (two quick off-beat notes that trip, then settle down a step) + a soft wood thunk.
- `disaster` = a soft woody thunk on a gently "wrong" low cluster, and the music bed sinks for half a second
  (`music.stumble()`, a tape-slow style dip that recovers by itself).

Old names map onto the graded family: `success` = good, `partial` = meh, `fail` = bad, `nat20` = legendary,
`nat1` = disaster (band names work too: `playSfx("CATASTROPHE")`). Options:
`{ volume?, pitch? /* semitones */, ms?, index?, final?, pan? }`. Unknown names are ignored.

Legacy `sfx.*` calls all still work and now play the same family (fanfare = legendary, sadTrombone = bad,
choir / sparkle = swell, recordScratch = thud, pageTurn = cardFlip, thanks = good, explosion = boom, ...).
Note for QuickTV: the roll plays legacy `sfx.choir()` / `sfx.recordScratch()` AND `playSfx("nat20"/"nat1")` at
the same moment; drop the legacy pair so the graded phrase reads cleanly.

## Design notes

- **Under the voice.** Every track is calibrated to the same loudness (K-weighted, within 1 dB, measured on
  `/sound-test`) around -27 dBFS at the default intensity, with a -4 dB dip at 2.6 kHz for the narrator,
  a -2 dB mud dip at 300 Hz, a soft top shelf, and -12 dB ducking while the narrator talks.
- **Groove and width.** Kick/tom-driven sidechain pump on pads, keys and bass; stereo chorus on pads and keys;
  ping-pong echo on leads; low cuts on pads/keys/leads and on the reverb return so nothing gets muddy.
- **Never loops obviously.** 16-bar forms (A and B halves with their own progression, comping and melody),
  fills every 8 bars, a breath every 16; melody, ghost notes, velocity and micro-timing are rolled live.
- **SFX levels.** Every voice carries a measured loudness trim, so all effects land at the same loudness
  (K-weighted, loudest 100 ms, within 1 dB), about 6 dB under a narrator, with peaks kept under the music's.
- **CPU.** A 50 ms setInterval scheduler scheduling 350 ms ahead (500 ms in lite mode); no AudioWorklets;
  persistent buses, reused panners, one shared music reverb (plus one short SFX room), a per-track
  polyphony cap (56 sources; non-essential notes are dropped first) and each note's tiny graph disconnects itself.
- **Lite mode.** `music.setLite(true)` / `music.isLite()`. It turns on by itself (and stays on) if the browser
  reports audio underruns, the page's timers are starved, scheduling gets slow, or the machine has 2 cores:
  half the polyphony, single-oscillator pads, no reverb send, longer lookahead.
- **Headroom.** Music around -27 dBFS (peaks ~-15), effects peak at -14, so the mix keeps more than 6 dB of
  headroom; the master has a gentle compressor at -8 dBFS and a soft ceiling at -1 dBFS (linear below -6), so
  the bass (or anything) can never clip the output.
- Files: `context.ts` (shared context, unlock, global mute), `music.ts` (engine), `tracks.ts` (the six loops,
  layers, `toMood`), `cues.ts` (phase cues), `instruments.ts` (the per-track studio), `sfx.ts` (house SFX),
  `dsp.ts` (noise, reverb IR, waves), `useMusic.ts` (React hooks).
