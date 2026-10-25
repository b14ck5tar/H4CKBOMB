"use client";

/**
 * Sound tour: a guided show of one game night for the creative director. Each step says WHEN a sound plays in the
 * live game (traced from the real call sites, file names shown on every step), then plays that exact call through
 * the real engine in lib/sound. One thing at a time, music stopped between steps, lite mode on. Safe to delete.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { dice, music, playResult, playSfx, useSoundPrefs } from "@/lib/sound";
import { getBuses } from "@/lib/sound/context";

type At = (ms: number, fn: () => void, label?: string) => void;

interface Step {
  act: string;
  caption: string;
  when: string;
  sound: string;
  where: string;
  screen: "TV" | "Phone" | "TV + phone" | "Watch screen" | "Nowhere";
  ms: number;
  music?: boolean;
  unused?: boolean;
  note?: string;
  play: (at: At) => void;
}

/** Start a track the way the game does: intensity first, then the track. */
const track = (id: "lobby" | "mysterious" | "eerie" | "playful" | "warm" | "tense", intensity: number) => {
  music.setIntensity(intensity, 0.05);
  if (id === "lobby") music.startLobby();
  else music.startStory(id);
};

// QualityMeter.tsx timing: a tap per lit segment, then the grade phrase.
const FILL_S = 1.3;
const litAt = (i: number, shown: number) => 1 - Math.sqrt(Math.max(0, 1 - (i + 1) / Math.max(1, shown)));
const ROLL_MS = 2200; // ROLL_ANIM_MS (2400) - 200, as in QuickTV Roll

const STEPS: Step[] = [
  // ---------------- the lobby ----------------
  {
    act: "Lobby",
    caption: "The lobby opens",
    when: "TV lobby (the title screen with the QR code). Starts on the first tap anywhere and loops until the story starts. The same track comes back while everyone picks or writes tonight's story.",
    sound: 'Music "Night Shift": music.startLobby(), intensity 0',
    where: 'Lobby.tsx useMusic("lobby", 0); QuickTV.tsx useStorySound (story_vote / story_write)',
    screen: "TV",
    ms: 10000,
    music: true,
    play: () => track("lobby", 0),
  },
  {
    act: "Lobby",
    caption: "Someone types their name and joins",
    when: "Phone join screen, when the player sends their name. Every message a phone sends has a sound: name, hero, plan, idea and story all use this one.",
    sound: 'playSfx("submit")',
    where: "Phone.tsx SEND_SFX (join, concept, real, idea, pitch, story)",
    screen: "Phone",
    ms: 3000,
    play: () => playSfx("submit"),
  },
  {
    act: "Lobby",
    caption: "A new face pops into the lobby",
    when: "TV lobby, for each new player (not the ones already there when the screen opened). The pitch depends on the player's spot in the list: 0, +2 or +4 semitones.",
    sound: 'playSfx("join", { pitch: 0 | 2 | 4 })',
    where: "Lobby.tsx (new-player effect)",
    screen: "TV",
    ms: 4200,
    play: (at) => {
      at(0, () => playSfx("join", { pitch: 0 }), "1st player");
      at(1100, () => playSfx("join", { pitch: 2 }), "2nd player");
      at(2200, () => playSfx("join", { pitch: 4 }), "3rd player");
    },
  },
  {
    act: "Lobby",
    caption: "A spectator taps “join the table”",
    when: "The /watch screen (a spectator view, not a player phone), when they tap the join button.",
    sound: 'sfx.pageTurn() = playSfx("cardFlip")',
    where: "WatchView.tsx",
    screen: "Watch screen",
    ms: 2800,
    play: () => playSfx("cardFlip"),
  },
  {
    act: "Lobby",
    caption: "You pick your hero",
    when: "Phone hero screen, when the player taps a hero card.",
    sound: 'playSfx("pick")',
    where: "Phone.tsx SEND_SFX (pick)",
    screen: "Phone",
    ms: 2800,
    play: () => playSfx("pick"),
  },
  {
    act: "Lobby",
    caption: "A player's card flips to their hero",
    when: "TV lobby, when a player's card turns into their hero.",
    sound: 'playSfx("reveal", { volume: 0.6 })',
    where: "Lobby.tsx (hero sting effect)",
    screen: "TV",
    ms: 3500,
    play: () => playSfx("reveal", { volume: 0.6 }),
  },
  {
    act: "Lobby",
    caption: "The host changes a setting",
    when: "TV lobby, when the host taps a different option for mode, news source or rating.",
    sound: 'playSfx("pick")',
    where: "Lobby.tsx (option buttons)",
    screen: "TV",
    ms: 2800,
    play: () => playSfx("pick"),
  },
  {
    act: "Lobby",
    caption: "START: the 3-2-1 countdown",
    when: "TV lobby after START: a tick for 3, 2 and 1 (0.9 s apart), then the die lands on “Roll!”.",
    sound: 'playSfx("timerTick", { volume: 1.4 }) x3, then playSfx("diceLand")',
    where: "Lobby.tsx Countdown",
    screen: "TV",
    ms: 4400,
    play: (at) => {
      at(0, () => playSfx("timerTick", { volume: 1.4 }), "3");
      at(900, () => playSfx("timerTick", { volume: 1.4 }), "2");
      at(1800, () => playSfx("timerTick", { volume: 1.4 }), "1");
      at(2700, () => playSfx("diceLand"), "Roll!");
    },
  },

  // ---------------- picking the story ----------------
  {
    act: "Story pick",
    caption: "Everyone votes for tonight's story",
    when: "Phone story vote, when a player taps a story. The same sound plays on the phone when backing a plan in the finale.",
    sound: 'playSfx("vote")',
    where: "Phone.tsx SEND_SFX (vote)",
    screen: "Phone",
    ms: 2800,
    play: () => playSfx("vote"),
  },
  {
    act: "Story pick",
    caption: "The last 5 seconds of a timer",
    when: "TV, any phase with a timer (story vote, turns, finale plans and votes): one tick per second for the last 5 seconds. The last one (“1”) is the final tick.",
    sound: 'playSfx("timerTick", { index: 5..1, final: left === 1 })',
    where: "QuickTV.tsx useTimerTicks",
    screen: "TV",
    ms: 5600,
    play: (at) => {
      for (const n of [5, 4, 3, 2, 1]) at((5 - n) * 1000, () => playSfx("timerTick", { index: n, final: n === 1 }), `${n} left`);
    },
  },

  // ---------------- the story starts ----------------
  {
    act: "Story starts",
    caption: "The title card (Full mode only)",
    when: "TV title card as the story starts, in Full mode only. In Quick mode (the judge demo) the title card has no sound effect, only the music.",
    sound: 'sfx.whoosh() + sfx.stamp() = playSfx("whoosh") + playSfx("stamp"), at the same moment',
    where: "QuickTV.tsx TitleCard",
    screen: "TV",
    ms: 5000,
    play: (at) => {
      at(0, () => playSfx("whoosh"), "whoosh alone");
      at(1400, () => playSfx("stamp"), "stamp alone");
      at(2900, () => {
        playSfx("whoosh");
        playSfx("stamp");
      }, "both together, as in the game");
    },
  },
  {
    act: "Story starts",
    caption: "Story music: Velvet Alley",
    when: "TV, from the first scene until the finale, when Muse picks “mysterious” as the story's mood (secrets, mysteries). Also the fallback when no mood came back.",
    sound: 'music.startStory("mysterious"), intensity 0.2',
    where: "QuickTV.tsx useStorySound (s.cast.music); the mood comes from the cast AI call in host.ts",
    screen: "TV",
    ms: 9000,
    music: true,
    play: () => track("mysterious", 0.2),
  },
  {
    act: "Story starts",
    caption: "Story music: Hollow Hour",
    when: "TV, from the first scene until the finale, when Muse picks “eerie” (spooky, creepy stories). Never picked for Kids.",
    sound: 'music.startStory("eerie"), intensity 0.2',
    where: "QuickTV.tsx useStorySound (s.cast.music)",
    screen: "TV",
    ms: 9000,
    music: true,
    play: () => track("eerie", 0.2),
  },
  {
    act: "Story starts",
    caption: "Story music: Sneaky Business",
    when: "TV, from the first scene until the finale, when Muse picks “playful” (silly, odd stories).",
    sound: 'music.startStory("playful"), intensity 0.2',
    where: "QuickTV.tsx useStorySound (s.cast.music)",
    screen: "TV",
    ms: 9000,
    music: true,
    play: () => track("playful", 0.2),
  },
  {
    act: "Story starts",
    caption: "Story music: Hearthlight",
    when: "TV, from the first scene until the finale, when Muse picks “warm” (nature, kind, gentle stories). Every game also ends on this track (see the ending).",
    sound: 'music.startStory("warm"), intensity 0.2',
    where: "QuickTV.tsx useStorySound (s.cast.music)",
    screen: "TV",
    ms: 9000,
    music: true,
    play: () => track("warm", 0.2),
  },
  {
    act: "Story starts",
    caption: "Story music: Undercurrent",
    when: "TV, from the first scene until the finale, when Muse picks “tense” (danger, races against time). Never picked for Kids. Every non-Kids finale also switches to this track.",
    sound: 'music.startStory("tense"), intensity 0.2',
    where: "QuickTV.tsx useStorySound (s.cast.music)",
    screen: "TV",
    ms: 9000,
    music: true,
    play: () => track("tense", 0.2),
  },
  {
    act: "Story starts",
    caption: "A new scene: the page turns",
    when: "TV, each time a new scene of narration starts.",
    sound: 'sfx.pageTurn() = playSfx("cardFlip")',
    where: "QuickTV.tsx Narration",
    screen: "TV",
    ms: 2800,
    play: () => playSfx("cardFlip"),
  },
  {
    act: "Story starts",
    caption: "Each narration line appears",
    when: "TV subtitles: a soft tick as each new line of narration appears, in step with the narrator's voice. (While the narrator talks, the music dips 12 dB.)",
    sound: 'sfx.tick() = playSfx("timerTick")',
    where: "QuickTV.tsx Narration",
    screen: "TV",
    ms: 4800,
    play: (at) => {
      at(0, () => playSfx("timerTick"), "line 1");
      at(1700, () => playSfx("timerTick"), "line 2");
      at(3400, () => playSfx("timerTick"), "line 3");
    },
  },

  // ---------------- a turn ----------------
  {
    act: "A turn",
    caption: "A new turn: the music sting",
    when: "TV, the instant each hero's turn starts.",
    sound: 'music.cue("yourTurn")',
    where: "QuickTV.tsx useStorySound (turn)",
    screen: "TV",
    ms: 2800,
    play: () => music.cue("yourTurn"),
  },
  {
    act: "A turn",
    caption: "The hero's card slams in",
    when: "TV, about 0.5 s after the turn starts, as the hero's trading card lands. The turn owner's phone plays the same sound (and buzzes) at the same moment.",
    sound: 'playSfx("turnStart")',
    where: "tvskin/TurnCard.tsx; Phone.tsx (myTurn)",
    screen: "TV + phone",
    ms: 5400,
    play: (at) => {
      at(0, () => playSfx("turnStart"), "card slam alone");
      at(2400, () => music.cue("yourTurn"), "sting + slam, as in the game");
      at(2870, () => playSfx("turnStart"));
    },
  },
  {
    act: "A turn",
    caption: "A friend sends a suggestion",
    when: "Phone, when a friend sends an idea for the hero (the hero sending their own plan makes the same sound).",
    sound: 'playSfx("submit")',
    where: "Phone.tsx SEND_SFX (idea, pitch)",
    screen: "Phone",
    ms: 2600,
    play: () => playSfx("submit"),
  },
  {
    act: "A turn",
    caption: "The suggestion floats onto the TV",
    when: "TV, each time a new suggestion bubble appears next to the hero's card.",
    sound: 'playSfx("pick", { volume: 0.8 })',
    where: "tvskin/SuggestionBubbles.tsx",
    screen: "TV",
    ms: 2600,
    play: () => playSfx("pick", { volume: 0.8 }),
  },
  {
    act: "A turn",
    caption: "The DM's ruling: plan card and difficulty stamp",
    when: "TV, once Muse has judged the plan: the card is dealt (0.1 s), then the difficulty stamp lands (1.15 s). A harder plan (minus shift) stamps with “meh”; a solid or easy plan with “good”.",
    sound: 'playSfx("pick", { volume: 0.7 }), then playSfx("partial" | "success", { volume: 0.7 })',
    where: "tvskin/PlanCard.tsx",
    screen: "TV",
    ms: 6400,
    play: (at) => {
      at(120, () => playSfx("pick", { volume: 0.7 }), "card dealt");
      at(1150, () => playSfx("partial", { volume: 0.7 }), "stamp: a harder plan (meh)");
      at(3500, () => playSfx("pick", { volume: 0.7 }), "card dealt");
      at(4530, () => playSfx("success", { volume: 0.7 }), "stamp: a solid plan (good)");
    },
  },

  // ---------------- the roll ----------------
  {
    act: "The roll",
    caption: "Suspense builds as the die flies",
    when: "TV, the moment the hero swipes the die up on their phone (the phone itself makes no sound for the throw). It lasts the die's 2.2 s flight; the music's drums step back while it rises.",
    sound: 'music.cue("riser", { ms: 2200 })',
    where: "QuickTV.tsx Roll",
    screen: "TV",
    ms: 3800,
    play: () => music.cue("riser", { ms: ROLL_MS }),
  },
  {
    act: "The roll",
    caption: "The die leaves the hand",
    when: "TV, the same instant as the riser starts.",
    sound: "dice.throw()",
    where: "QuickTV.tsx Roll",
    screen: "TV",
    ms: 2400,
    play: () => dice.throw(),
  },
  {
    act: "The roll",
    caption: "The die hits the table",
    when: "TV, three hits timed to the flight animation: at 55%, 75% and 89% of the 2.2 s flight, each softer than the last.",
    sound: "dice.bounce(0), dice.bounce(1), dice.bounce(2)",
    where: "QuickTV.tsx Roll",
    screen: "TV",
    ms: 3600,
    play: (at) => {
      const b = [0.55, 0.7525, 0.8875].map((f) => Math.round((f - 0.55) * ROLL_MS));
      b.forEach((t, n) => at(t, () => dice.bounce(n), "three hits"));
      b.forEach((t, n) => at(1800 + t, () => dice.bounce(n), "again"));
    },
  },
  {
    act: "The roll",
    caption: "The die lands",
    when: "TV, at the end of the 2.2 s flight, as the die settles.",
    sound: "dice.land()",
    where: "QuickTV.tsx Roll",
    screen: "TV",
    ms: 2600,
    play: () => dice.land(),
  },
  {
    act: "The roll",
    caption: "The landing hit",
    when: "TV, the same instant the die lands. The chord follows the result: up for 10 and over, neutral for 6-9, down for 1-5.",
    sound: 'music.cue("hit", { grade: "up" | "neutral" | "down" })',
    where: "QuickTV.tsx Roll",
    screen: "TV",
    ms: 8800,
    play: (at) => {
      at(0, () => music.cue("hit", { grade: "up" }), "up (10+)");
      at(3000, () => music.cue("hit", { grade: "neutral" }), "neutral (6-9)");
      at(6000, () => music.cue("hit", { grade: "down" }), "down (1-5)");
    },
  },
  {
    act: "The roll",
    caption: "The whole throw, as heard in the game",
    when: "TV: the riser and throw together, the three table hits, then the landing and the hit, on the game's real timing.",
    sound: 'music.cue("riser") + dice.throw(), dice.bounce(0..2), dice.land() + music.cue("hit")',
    where: "QuickTV.tsx Roll",
    screen: "TV",
    ms: 5400,
    play: (at) => {
      at(0, () => {
        music.cue("riser", { ms: ROLL_MS });
        dice.throw();
      }, "riser + throw");
      [0.55, 0.7525, 0.8875].forEach((f, n) => at(Math.round(ROLL_MS * f), () => dice.bounce(n), "table hits"));
      at(ROLL_MS, () => {
        dice.land();
        music.cue("hit", { grade: "up" });
      }, "land + hit");
    },
  },
  {
    act: "The roll",
    caption: "The score meter fills",
    when: "TV, right after the landing: one rising tap for each segment as the 1-20 meter fills to the total (here, a 14).",
    sound: 'playSfx("tap", { volume: 0.32, pitch: rising }) once per segment',
    where: "tvskin/QualityMeter.tsx",
    screen: "TV",
    ms: 2600,
    play: (at) => {
      const shown = 14;
      for (let i = 0; i < shown; i++) at(Math.round((0.15 + litAt(i, shown) * FILL_S) * 1000), () => playSfx("tap", { volume: 0.32, pitch: Math.min(14, i * 0.7) }), "filling to 14");
    },
  },

  // ---------------- each result ----------------
  {
    act: "Results",
    caption: "Natural 1: disaster",
    when: "TV, as the meter slams its grade (about 1.5 s after the landing), only when the die shows a natural 1. In the game the music also sinks for half a second (silent here, since the music is off).",
    sound: 'playResult("disaster") (the game calls playSfx("nat1"))',
    where: "tvskin/QualityMeter.tsx",
    screen: "TV",
    ms: 3800,
    play: () => playResult("disaster"),
  },
  {
    act: "Results",
    caption: "A bad roll (total 1-5)",
    when: "TV, as the meter slams its grade, for totals of 1-5 (no natural 1). The same phrase plays when danger rises and for a grim finale.",
    sound: 'playResult("bad") (the game calls playSfx("fail"))',
    where: "tvskin/QualityMeter.tsx",
    screen: "TV",
    ms: 3800,
    play: () => playResult("bad"),
  },
  {
    act: "Results",
    caption: "Sort of (total 6-9)",
    when: "TV, as the meter slams its grade, for totals of 6-9. The same phrase stamps a harder plan in the ruling.",
    sound: 'playResult("meh") (the game calls playSfx("partial"))',
    where: "tvskin/QualityMeter.tsx",
    screen: "TV",
    ms: 3800,
    play: () => playResult("meh"),
  },
  {
    act: "Results",
    caption: "It works (total 10 and over)",
    when: "TV, as the meter slams its grade, for every total of 10 or more without a natural 20. Great rolls (15-19) and totals of 20+ play this too.",
    sound: 'playResult("good") (the game calls playSfx("success"))',
    where: "tvskin/QualityMeter.tsx",
    screen: "TV",
    ms: 3800,
    play: () => playResult("good"),
  },
  {
    act: "Results",
    caption: "Great",
    when: "Not used in the game. A GREAT roll (15-19) plays the “good” phrase instead; nothing calls “great”.",
    sound: 'playResult("great")',
    where: "lib/sound/sfx.ts only (no call site)",
    screen: "Nowhere",
    ms: 3800,
    unused: true,
    play: () => playResult("great"),
  },
  {
    act: "Results",
    caption: "Natural 20: legendary",
    when: "TV, as the meter slams its grade, only when the die shows a natural 20. The same phrase plays for a triumphant finale.",
    sound: 'playResult("legendary") (the game calls playSfx("nat20"))',
    where: "tvskin/QualityMeter.tsx",
    screen: "TV",
    ms: 4200,
    play: () => playResult("legendary"),
  },

  // ---------------- after the roll ----------------
  {
    act: "After the roll",
    caption: "What happened: the caption appears",
    when: "TV, when Muse's “what happened” caption appears over the new painting.",
    sound: 'sfx.pageTurn() = playSfx("cardFlip")',
    where: "QuickTV.tsx SkinOutcome",
    screen: "TV",
    ms: 2800,
    play: () => playSfx("cardFlip"),
  },
  {
    act: "After the roll",
    caption: "The story ladder steps up",
    when: "TV top bar, when the story moves up a step on the ladder (not when the bar first appears).",
    sound: 'playSfx("reveal", { volume: 0.35, pitch: 5 })',
    where: "tvskin/Hud.tsx LadderDots",
    screen: "TV",
    ms: 3200,
    play: () => playSfx("reveal", { volume: 0.35, pitch: 5 }),
  },
  {
    act: "After the roll",
    caption: "Danger goes up",
    when: "TV top bar, when the danger bar gains a level.",
    sound: 'playSfx("fail", { volume: 0.4, pitch: -5 }) = the "bad" phrase, lower and softer',
    where: "tvskin/Hud.tsx DangerBar",
    screen: "TV",
    ms: 3400,
    play: () => playSfx("fail", { volume: 0.4, pitch: -5 }),
  },
  {
    act: "After the roll",
    caption: "Someone taps a reaction emoji",
    when: "While watching (the outcome, the reveal): the phone taps when you send an emoji, and the TV pops as it floats up.",
    sound: 'playSfx("tap") on the phone, then sfx.pop() = playSfx("pop") on the TV',
    where: "Phone.tsx SEND_SFX (react); TV.tsx host.onReaction",
    screen: "TV + phone",
    ms: 3400,
    play: (at) => {
      at(0, () => playSfx("tap"), "phone: tap");
      at(1200, () => playSfx("pop"), "TV: pop");
    },
  },

  // ---------------- the finale ----------------
  {
    act: "Finale",
    caption: "The finale: the music turns tense",
    when: "TV, when the finale starts: non-Kids games switch to Undercurrent (Kids keep their story's track), louder (intensity 0.55) with a 3 s swell. The final roll pushes it to 0.8.",
    sound: 'music.startStory("tense"), intensity 0.55, music.swell(0.8, 3000)',
    where: "QuickTV.tsx useStorySound (s.finale)",
    screen: "TV",
    ms: 10000,
    music: true,
    play: () => {
      track("tense", 0.55);
      music.swell(0.8, 3000);
    },
  },
  {
    act: "Finale",
    caption: "Each sealed final plan flies in",
    when: "TV finale “write” screen, each time another hero's final plan arrives. The pitch rises with each one.",
    sound: 'playSfx("submit", { volume: 0.7, pitch: n * 2 })',
    where: "tvskin/Finale.tsx FinalePitch",
    screen: "TV",
    ms: 3600,
    play: (at) => [1, 2, 3].forEach((n, i) => at(i * 1000, () => playSfx("submit", { volume: 0.7, pitch: Math.min(10, n * 2) }), `plan ${n}`)),
  },
  {
    act: "Finale",
    caption: "Each friend backs a plan",
    when: "TV finale “back a plan” screen, each time a vote comes in. The pitch rises with each one.",
    sound: 'playSfx("vote", { volume: 0.7, pitch: n * 2 })',
    where: "tvskin/Finale.tsx FinaleVote",
    screen: "TV",
    ms: 3600,
    play: (at) => [1, 2, 3].forEach((n, i) => at(i * 1000, () => playSfx("vote", { volume: 0.7, pitch: Math.min(10, n * 2) }), `vote ${n}`)),
  },
  {
    act: "Finale",
    caption: "The final roll: the tension bed",
    when: "TV, when the final roll arms (it restarts at the 3-2-1 count): a drone, a heartbeat that speeds up and nervous ticking, under the louder music.",
    sound: 'music.cue("finale", { ms: 9000 })',
    where: "QuickTV.tsx useStorySound (final_roll arm / count)",
    screen: "TV",
    ms: 9400,
    play: () => music.cue("finale", { ms: 9000 }),
  },
  {
    act: "Finale",
    caption: "Each phone arms",
    when: "Phone: tapping ARM. TV: one tap for each phone that has armed, rising in pitch.",
    sound: 'playSfx("tap") on the phone; playSfx("tap", { volume: 0.6, pitch: n * 2 }) on the TV',
    where: "Phone.tsx SEND_SFX (arm); tvskin/Finale.tsx FinaleShake",
    screen: "TV + phone",
    ms: 3600,
    play: (at) => [1, 2, 3].forEach((n, i) => at(i * 1000, () => playSfx("tap", { volume: 0.6, pitch: Math.min(10, n * 2) }), `phone ${n} armed`)),
  },
  {
    act: "Finale",
    caption: "SHAKE!",
    when: "TV, the moment SHAKE! appears after the 3-2-1. (The 3-2-1 itself has no sound effect on the TV.)",
    sound: 'playSfx("finaleShake", { ms: 2000 })',
    where: "QuickTV.tsx useStorySound (final_roll shake)",
    screen: "TV",
    ms: 3400,
    play: () => playSfx("finaleShake", { ms: 2000 }),
  },
  {
    act: "Finale",
    caption: "Every shaking phone rattles the die",
    when: "TV, during SHAKE and the tumble: each phone that shakes adds a rattle, rising in pitch.",
    sound: 'playSfx("diceRoll", { volume: 0.5, pitch: n * 2 })',
    where: "tvskin/Finale.tsx FinaleShake",
    screen: "TV",
    ms: 3600,
    play: (at) => [1, 2, 3].forEach((n, i) => at(i * 800, () => playSfx("diceRoll", { volume: 0.5, pitch: Math.min(10, n * 2) }), `phone ${n} shook`)),
  },
  {
    act: "Finale",
    caption: "The final die lands",
    when: "TV, when the final die lands.",
    sound: 'sfx.diceLand() = playSfx("diceLand")',
    where: "QuickTV.tsx Final (stage landed)",
    screen: "TV",
    ms: 2600,
    play: () => playSfx("diceLand"),
  },
  {
    act: "Finale",
    caption: "The final hit",
    when: "TV, when the final result shows. The chord follows the result, as in a normal roll (here: up).",
    sound: 'music.cue("hit", { grade })',
    where: "QuickTV.tsx useStorySound (final_result)",
    screen: "TV",
    ms: 3000,
    play: () => music.cue("hit", { grade: "up" }),
  },
  {
    act: "Finale",
    caption: "The ending sting",
    when: "TV, the same moment as the final hit. Triumphant (10+) = the legendary phrase, bittersweet (6-9) = a stamp, grim but hilarious (1-5) = the bad phrase. About 1.5 s later the score meter plays its own result phrase too.",
    sound: 'sfx.fanfare() = legendary; sfx.stamp() = stamp; sfx.sadTrombone() = bad',
    where: "QuickTV.tsx Final",
    screen: "TV",
    ms: 9400,
    play: (at) => {
      at(0, () => playSfx("legendary"), "triumphant");
      at(3600, () => playSfx("stamp"), "bittersweet");
      at(6200, () => playSfx("bad"), "grim but hilarious");
    },
  },

  // ---------------- the ending ----------------
  {
    act: "Ending",
    caption: "Because of you: the montage starts",
    when: "TV ending montage, as the first painted panel appears.",
    sound: 'playSfx("turnStart", { volume: 0.7 })',
    where: "tvskin/EndingMontage.tsx",
    screen: "TV",
    ms: 3000,
    play: () => playSfx("turnStart", { volume: 0.7 }),
  },
  {
    act: "Ending",
    caption: "The next montage panel",
    when: "TV ending montage, as each later panel appears (every 4.8 s in the game).",
    sound: 'playSfx("pick", { volume: 0.7 })',
    where: "tvskin/EndingMontage.tsx",
    screen: "TV",
    ms: 4000,
    play: (at) => {
      at(0, () => playSfx("pick", { volume: 0.7 }), "panel 2");
      at(2000, () => playSfx("pick", { volume: 0.7 }), "panel 3");
    },
  },
  {
    act: "Ending",
    caption: "Based on a true story: the resolve",
    when: "TV, the moment the reveal starts (“this tale was inspired by real events”).",
    sound: 'music.cue("resolve")',
    where: "QuickTV.tsx useStorySound (reveal)",
    screen: "TV",
    ms: 4200,
    play: () => music.cue("resolve"),
  },
  {
    act: "Ending",
    caption: "The reveal card",
    when: "TV, the same moment as the resolve, as the real headline card comes up.",
    sound: 'playSfx("reveal")',
    where: "tvskin/EndingMontage.tsx",
    screen: "TV",
    ms: 3200,
    play: () => playSfx("reveal"),
  },
  {
    act: "Ending",
    caption: "Ending music: Hearthlight, soft",
    when: "TV, through the reveal and the keepsake: the warm track, very soft (intensity 0.1) after a gentle swell. Every game ends here.",
    sound: 'music.startStory("warm"), intensity 0.1, music.swell(0.5, 2500)',
    where: "QuickTV.tsx useStorySound (reveal / storybook)",
    screen: "TV",
    ms: 10000,
    music: true,
    play: () => {
      track("warm", 0.1);
      music.swell(0.5, 2500);
    },
  },
  {
    act: "Ending",
    caption: "The keepsake",
    when: "TV, when the keepsake screen (the storybook QR code) opens.",
    sound: 'playSfx("keepsake")',
    where: "QuickTV.tsx useStorySound (storybook)",
    screen: "TV",
    ms: 4000,
    play: () => playSfx("keepsake"),
  },

  // ---------------- in the engine, never played ----------------
  {
    act: "Not used",
    caption: "Thud",
    when: "Not used in the game. Nothing calls it (the old recordScratch / thud calls are gone).",
    sound: 'playSfx("thud")',
    where: "lib/sound/sfx.ts only",
    screen: "Nowhere",
    ms: 2800,
    unused: true,
    play: () => playSfx("thud"),
  },
  {
    act: "Not used",
    caption: "Boom",
    when: "Not used in the game. Nothing calls it.",
    sound: 'playSfx("boom")',
    where: "lib/sound/sfx.ts only",
    screen: "Nowhere",
    ms: 3200,
    unused: true,
    play: () => playSfx("boom"),
  },
  {
    act: "Not used",
    caption: "Swell",
    when: "Not used in the game. Only the switched-off Mirror, Mirror ending and an unused cold open call it (as sfx.choir).",
    sound: 'playSfx("swell")',
    where: "TV.tsx MirrorRevealCard (FEATURES.mirror off); QuickTV.tsx ColdOpen (never mounted)",
    screen: "Nowhere",
    ms: 3400,
    unused: true,
    play: () => playSfx("swell"),
  },
  {
    act: "Not used",
    caption: "Heartbeat",
    when: "Not used in the game. It is written for the final roll's ARM screen, but that code only mounts once the die has landed, so it never plays.",
    sound: 'sfx.heartbeat() = playSfx("heartbeat")',
    where: "QuickTV.tsx Final (dead branch)",
    screen: "Nowhere",
    ms: 2800,
    unused: true,
    play: () => playSfx("heartbeat"),
  },
  {
    act: "Not used",
    caption: "Count beats (3-2-1, go)",
    when: "Not used in the game. Written for the final 3-2-1 and SHAKE, in the same code that never mounts before the landing.",
    sound: 'sfx.countBeat(false) x3, then sfx.countBeat(true)',
    where: "QuickTV.tsx Final (dead branch)",
    screen: "Nowhere",
    ms: 4400,
    unused: true,
    play: (at) => {
      at(0, () => playSfx("countBeat"), "3");
      at(1000, () => playSfx("countBeat"), "2");
      at(2000, () => playSfx("countBeat"), "1");
      at(3000, () => playSfx("countBeat", { final: true }), "go");
    },
  },
  {
    act: "Not used",
    caption: "Drumroll",
    when: "Not used in the game. Written for the final die's tumble, in the same code that never mounts before the landing.",
    sound: 'sfx.drumroll(2100) = playSfx("drumroll", { ms: 2100 })',
    where: "QuickTV.tsx Final (dead branch)",
    screen: "Nowhere",
    ms: 3400,
    unused: true,
    play: () => playSfx("drumroll", { ms: 2100 }),
  },
];

const ACTS = STEPS.reduce<string[]>((a, s) => (a.includes(s.act) ? a : [...a, s.act]), []);
const GAP_MS = 450; // silence between steps, so the last fade never overlaps the next sound

export default function SoundTour() {
  const prefs = useSoundPrefs();
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [idx, setIdx] = useState(0);
  const [run, setRun] = useState(0);
  const [part, setPart] = useState("");
  const [lite, setLite] = useState(false);
  const [hasMeter, setHasMeter] = useState(false);
  const timers = useRef<number[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const silence = () => {
    clearTimers();
    music.cueStop(0.2);
    music.stop(0.35);
  };

  const playStep = useCallback((i: number, auto: boolean) => {
    silence();
    const st = STEPS[i];
    setIdx(i);
    setRun((r) => r + 1);
    setPart("");
    setDone(false);
    setPaused(false);
    timers.current.push(
      window.setTimeout(() => {
        const at: At = (ms, fn, label) => {
          timers.current.push(
            window.setTimeout(() => {
              if (label) setPart(label);
              try {
                fn();
              } catch {
                /* never let one sound stop the show */
              }
            }, ms),
          );
        };
        st.play(at);
        if (auto)
          timers.current.push(
            window.setTimeout(() => {
              if (i + 1 < STEPS.length) playStep(i + 1, true);
              else {
                silence();
                setDone(true);
              }
            }, st.ms),
          );
      }, GAP_MS),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tapAnalyser = () => {
    if (analyser.current) return;
    const b = getBuses();
    if (!b) return;
    try {
      const a = b.ctx.createAnalyser();
      a.fftSize = 1024;
      b.master.connect(a); // a read-only tap on the master bus (after mute, before the limiter); changes nothing
      analyser.current = a;
      setHasMeter(true);
    } catch {
      /* the pulsing bar takes over */
    }
  };

  const start = (from = idx) => {
    music.setLite(true); // the CD's laptop glitched under heavy audio
    setLite(music.isLite());
    tapAnalyser();
    setStarted(true);
    playStep(from, true);
  };
  const pause = () => {
    silence();
    setPaused(true);
  };
  const resume = () => playStep(idx, true);
  const replay = () => playStep(idx, true);
  const jump = (i: number) => {
    if (!started) {
      setIdx(i);
      return;
    }
    playStep(i, true);
  };

  // keyboard: space = pause / resume, arrows = previous / next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (paused || done) resume();
        else pause();
      } else if (e.key === "ArrowRight") jump(Math.min(STEPS.length - 1, idx + 1));
      else if (e.key === "ArrowLeft") jump(Math.max(0, idx - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // stop everything when leaving the page
  useEffect(
    () => () => {
      silence();
      const b = getBuses();
      if (b && analyser.current)
        try {
          b.master.disconnect(analyser.current);
        } catch {
          /* already gone */
        }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // the live waveform + level bar (about 30 fps, only while the show is running)
  useEffect(() => {
    if (!started || paused) return;
    let raf = 0;
    let last = 0;
    const buf = new Float32Array(1024);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      const a = analyser.current;
      const c = canvas.current;
      if (!a || !c) return;
      a.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const db = 20 * Math.log10(rms + 1e-9);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0, Math.min(1, (db + 60) / 50)).toFixed(3)})`;
      const g = c.getContext("2d");
      if (!g) return;
      const w = c.width;
      const h = c.height;
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,0.08)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
      g.strokeStyle = "#3de7ff";
      g.lineWidth = 2;
      g.beginPath();
      const gain = 4; // the mix sits low (about -27 dBFS); scale it up so the shape is visible
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * w;
        const y = h / 2 - Math.max(-1, Math.min(1, buf[i] * gain)) * (h / 2 - 4);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, paused]);

  const st = STEPS[idx];
  const live = started && !paused && !done;
  return (
    <main className="stour">
      <style>{CSS}</style>
      <header className="stour-head">
        <div>
          <p className="stour-kicker">Group Project · sound tour</p>
          <h1 className="stour-title">One game night, every sound</h1>
        </div>
        <p className="stour-meta">
          {STEPS.length} steps · one sound at a time · lite mode {lite ? "on" : started ? "off" : "turns on at Play"}
        </p>
      </header>

      <nav className="stour-timeline" aria-label="Steps">
        {ACTS.map((act) => (
          <div key={act} className="stour-act">
            <span className="stour-act-name">{act}</span>
            <div className="stour-dots">
              {STEPS.map((s, i) =>
                s.act !== act ? null : (
                  <button
                    key={i}
                    className={`stour-dot ${i === idx ? "on" : ""} ${i < idx ? "past" : ""} ${s.unused ? "unused" : ""} ${s.music ? "music" : ""}`}
                    title={`${i + 1}. ${s.caption}`}
                    aria-label={`Step ${i + 1}: ${s.caption}`}
                    aria-current={i === idx ? "step" : undefined}
                    onClick={() => jump(i)}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      {(prefs.muted || prefs.musicMuted) && (
        <div className="stour-warn" role="alert">
          {prefs.muted ? "All game sound is muted in this browser (the TV mute button). " : "Music is muted in this browser. "}
          <button className="stour-btn small" onClick={() => (prefs.muted ? prefs.toggleMuted() : prefs.toggleMusic())}>
            Unmute
          </button>
        </div>
      )}

      <section className={`stour-card ${st.unused ? "is-unused" : ""}`} key={`${idx}-${run}`}>
        <div className="stour-card-top">
          <span className="stour-num">
            Step {idx + 1} <small>of {STEPS.length}</small>
          </span>
          <span className="stour-act-tag">{st.act}</span>
          <span className={`stour-screen ${st.screen === "Phone" ? "phone" : ""}`}>{st.screen}</span>
          {st.music && <span className="stour-screen music">Music</span>}
          {st.unused && <span className="stour-screen unused">Not used in the game</span>}
        </div>
        <h2 className="stour-caption">{st.caption}</h2>
        <p className="stour-when">
          <b>Plays when:</b> {st.when}
        </p>
        <p className="stour-sound">
          <b>Sound:</b> <code>{st.sound}</code>
        </p>
        <p className="stour-where">
          <b>In the code:</b> {st.where}
        </p>

        <div className="stour-viz">
          {hasMeter || !started ? (
            <canvas ref={canvas} width={1200} height={140} className="stour-wave" aria-hidden />
          ) : (
            <div className={`stour-pulse ${live ? "live" : ""}`} aria-hidden />
          )}
          <div className="stour-level" aria-hidden>
            <div ref={bar} className="stour-level-fill" />
          </div>
          <p className="stour-part">{live ? part || " " : " "}</p>
        </div>

        <div className="stour-progress" aria-hidden>
          <div className="stour-progress-fill" style={{ animationDuration: `${st.ms + GAP_MS}ms`, animationPlayState: live ? "running" : "paused", opacity: started ? 1 : 0 }} />
        </div>
      </section>

      <div className="stour-controls">
        {!started ? (
          <button className="stour-btn play" onClick={() => start()}>
            ▶ Play the tour
          </button>
        ) : done ? (
          <>
            <p className="stour-done">That's every sound in the game.</p>
            <button className="stour-btn play" onClick={() => playStep(0, true)}>
              ▶ Start over
            </button>
          </>
        ) : (
          <>
            <button className="stour-btn" onClick={() => jump(Math.max(0, idx - 1))} disabled={idx === 0}>
              ◀ Back
            </button>
            {paused ? (
              <button className="stour-btn play" onClick={resume}>
                ▶ Resume
              </button>
            ) : (
              <button className="stour-btn" onClick={pause}>
                ❚❚ Pause
              </button>
            )}
            <button className="stour-btn" onClick={replay}>
              ↻ Replay this step
            </button>
            <button className="stour-btn" onClick={() => jump(Math.min(STEPS.length - 1, idx + 1))} disabled={idx === STEPS.length - 1}>
              Next ▶
            </button>
          </>
        )}
      </div>
      <p className="stour-hint">
        {started ? "Space pauses or resumes; the arrow keys step. Click any dot to jump." : "Pick a dot to start somewhere else, then press Play. Play also unlocks the browser's audio."}
      </p>

      <details className="stour-sheet">
        <summary>The cue sheet: all {STEPS.length} steps</summary>
        <ol>
          {STEPS.map((s, i) => (
            <li key={i} className={`${i === idx ? "on" : ""} ${s.unused ? "unused" : ""}`}>
              <button onClick={() => jump(i)}>
                <span className="n">{i + 1}</span>
                <span className="c">{s.caption}</span>
                <span className="s">{s.sound}</span>
                <span className="w">{s.unused ? "not used in the game" : s.where}</span>
              </button>
            </li>
          ))}
        </ol>
      </details>
    </main>
  );
}

const CSS = `
.stour { min-height: 100vh; max-width: 1180px; margin: 0 auto; padding: 28px 32px 64px; display: flex; flex-direction: column; gap: 18px; color: var(--parchment); }
.stour-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.stour-kicker { font-family: var(--font-ui), monospace; text-transform: uppercase; letter-spacing: 0.3em; font-size: 13px; color: var(--signal); margin: 0; }
.stour-title { font-family: var(--font-display), sans-serif; text-transform: uppercase; font-size: 40px; line-height: 1.05; margin: 4px 0 0; color: var(--gilt-bright); letter-spacing: 0.01em; }
.stour-meta { font-family: var(--font-ui), monospace; font-size: 13px; color: var(--ink-soft); margin: 0; }

.stour-timeline { display: flex; flex-wrap: wrap; gap: 10px 18px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
.stour-act { display: flex; flex-direction: column; gap: 6px; }
.stour-act-name { font-family: var(--font-heading), sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; color: var(--ink-soft); }
.stour-dots { display: flex; gap: 6px; }
.stour-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); background: transparent; padding: 0; cursor: pointer; transition: transform 0.15s, background 0.15s; }
.stour-dot:hover { transform: scale(1.25); border-color: var(--signal); }
.stour-dot.past { background: rgba(61,231,255,0.35); border-color: rgba(61,231,255,0.6); }
.stour-dot.music { border-radius: 4px; }
.stour-dot.unused { border-style: dashed; border-color: rgba(255,46,126,0.7); }
.stour-dot.on { background: var(--gilt-bright); border-color: var(--gilt-bright); box-shadow: 0 0 0 4px rgba(255,182,72,0.25), 0 0 16px rgba(255,182,72,0.7); transform: scale(1.2); }
.stour-dot:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }

.stour-warn { background: rgba(255,46,126,0.14); border: 1px solid var(--crimson); border-radius: 12px; padding: 10px 14px; font-size: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }

.stour-card { background: linear-gradient(180deg, var(--surface-2), var(--surface)); border: 1px solid var(--line); border-radius: 18px; padding: 26px 30px 0; display: flex; flex-direction: column; gap: 10px; overflow: hidden; animation: stour-in 0.35s ease both; }
.stour-card.is-unused { border-color: rgba(255,46,126,0.55); }
@keyframes stour-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.stour-card-top { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.stour-num { font-family: var(--font-ui), monospace; font-weight: 700; font-size: 16px; color: var(--gilt-bright); }
.stour-num small { font-weight: 400; color: var(--ink-soft); }
.stour-act-tag, .stour-screen { font-family: var(--font-ui), monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-soft); }
.stour-screen { color: var(--signal); border-color: rgba(61,231,255,0.45); }
.stour-screen.phone { color: var(--forest); border-color: rgba(44,245,192,0.45); }
.stour-screen.music { color: var(--gilt-bright); border-color: rgba(255,182,72,0.5); }
.stour-screen.unused { color: var(--crimson); border-color: rgba(255,46,126,0.6); }
.stour-caption { font-family: var(--font-display), sans-serif; text-transform: uppercase; font-size: clamp(34px, 5vw, 60px); line-height: 1.02; margin: 6px 0 4px; letter-spacing: 0.01em; }
.stour-when { font-size: 21px; line-height: 1.45; margin: 0; max-width: 62em; }
.stour-when b, .stour-sound b, .stour-where b { font-family: var(--font-heading), sans-serif; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85em; color: var(--gilt-bright); margin-right: 4px; }
.stour-sound { margin: 0; font-size: 17px; }
.stour-sound code { font-family: var(--font-ui), monospace; font-size: 15px; color: var(--signal); background: rgba(61,231,255,0.08); padding: 2px 8px; border-radius: 6px; word-break: break-word; }
.stour-where { margin: 0; font-family: var(--font-ui), monospace; font-size: 13px; color: var(--ink-soft); }
.stour-where b { font-size: 13px; color: var(--ink-soft); }

.stour-viz { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.stour-wave { width: 100%; height: 120px; display: block; background: rgba(0,0,0,0.25); border-radius: 12px; border: 1px solid var(--line); }
.stour-pulse { height: 120px; border-radius: 12px; border: 1px solid var(--line); background: rgba(0,0,0,0.25); position: relative; overflow: hidden; }
.stour-pulse::after { content: ""; position: absolute; left: 10%; right: 10%; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px; background: var(--signal); opacity: 0.25; }
.stour-pulse.live::after { animation: stour-pulse 0.9s ease-in-out infinite; }
@keyframes stour-pulse { 0%, 100% { transform: scaleY(1); opacity: 0.3; } 50% { transform: scaleY(7); opacity: 0.9; } }
.stour-level { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
.stour-level-fill { height: 100%; background: linear-gradient(90deg, var(--forest), var(--gilt-bright), var(--crimson)); transform-origin: left; transform: scaleX(0); transition: transform 0.08s linear; }
.stour-part { margin: 0; min-height: 1.4em; font-family: var(--font-heading), sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; font-size: 18px; color: var(--forest); }

.stour-progress { height: 4px; margin: 14px -30px 0; background: rgba(255,255,255,0.06); }
.stour-progress-fill { height: 100%; background: var(--gilt-bright); transform-origin: left; animation-name: stour-fill; animation-timing-function: linear; animation-fill-mode: both; }
@keyframes stour-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.stour-controls { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; }
.stour-btn { font-family: var(--font-heading), sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 18px; padding: 12px 20px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--parchment); cursor: pointer; }
.stour-btn:hover:not(:disabled) { border-color: var(--signal); }
.stour-btn:disabled { opacity: 0.4; cursor: default; }
.stour-btn.small { font-size: 14px; padding: 6px 12px; }
.stour-btn.play { font-size: 26px; padding: 16px 40px; background: var(--gilt); color: #1a0d00; border-color: var(--gilt-bright); box-shadow: 0 0 24px rgba(255,154,31,0.45); }
.stour-btn.play:hover { background: var(--gilt-bright); }
.stour-done { margin: 0; font-family: var(--font-heading), sans-serif; font-size: 22px; text-transform: uppercase; color: var(--forest); }
.stour-hint { text-align: center; margin: -4px 0 0; font-family: var(--font-ui), monospace; font-size: 13px; color: var(--ink-soft); }

.stour-sheet { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; }
.stour-sheet summary { cursor: pointer; font-family: var(--font-heading), sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 16px; color: var(--gilt-bright); }
.stour-sheet ol { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.stour-sheet li button { width: 100%; display: grid; grid-template-columns: 2.2em 1.2fr 1.4fr 1.2fr; gap: 12px; text-align: left; background: transparent; border: 0; border-radius: 8px; padding: 6px 8px; color: var(--parchment); cursor: pointer; font-size: 14px; align-items: baseline; }
.stour-sheet li button:hover { background: rgba(255,255,255,0.05); }
.stour-sheet li.on button { background: rgba(255,182,72,0.12); }
.stour-sheet .n { font-family: var(--font-ui), monospace; color: var(--ink-soft); }
.stour-sheet .s { font-family: var(--font-ui), monospace; font-size: 12px; color: var(--signal); word-break: break-word; }
.stour-sheet .w { font-family: var(--font-ui), monospace; font-size: 12px; color: var(--ink-soft); word-break: break-word; }
.stour-sheet li.unused .c, .stour-sheet li.unused .w { color: var(--crimson); }
@media (max-width: 760px) {
  .stour { padding: 18px 16px 48px; }
  .stour-card { padding: 20px 18px 0; }
  .stour-progress { margin: 14px -18px 0; }
  .stour-when { font-size: 18px; }
  .stour-sheet li button { grid-template-columns: 2em 1fr; }
  .stour-sheet .s, .stour-sheet .w { grid-column: 2; }
}
`;
