/**
 * Test players for playtesting with fewer people: up to 3 bots run by the TV itself (no phones). They act like
 * real people at the table: suggest moves, pick their own or a friend's idea, back a plan, roll, react, all after
 * human-ish delays. They only send the same intents a phone sends, so they can never block the game: if a bot
 * stalls, the normal timers and autopilot cover for it, exactly as for a person.
 */
import type { Msg } from "./transport";
import type { GameState } from "./types";

export interface BotPersona {
  name: string;
  persona: string; // for the AI: who they are and how they type
  skill: string; // the "secret talent" answer
  emoji: string[];
  friendIdea: number; // chance they pick a friend's idea on their own turn
  typo: number; // chance of one small typo
  canned: string[]; // fallbacks if the AI call fails
  story: { title: string; setup: string; steps: string; ending: string }; // their "Our stories" entry
}

export const BOT_PEOPLE: BotPersona[] = [
  {
    name: "Riley",
    persona: "Riley, the joker: short funny ideas, all lowercase, sometimes adds lol",
    skill: "making people laugh at funerals",
    emoji: ["😂", "💀", "🔥", "😱"],
    friendIdea: 0.35,
    typo: 0.25,
    canned: ["distract it with a terrible dance", "yell for help lol", "offer it my last snack", "poke it with a stick"],
    story: { title: "The locked-out barbecue", setup: "I locked my keys in the car at a family barbecue with the burgers inside", steps: "my cousin tried a coat hanger and my uncle tried a tennis ball trick", ending: "my little sister climbed in through the sunroof and the burgers were fine" },
  },
  {
    name: "Sam",
    persona: "Sam, the planner: sensible, practical, builds on what friends just said",
    skill: "organizing group trips",
    emoji: ["👏", "😮", "👍", "🙌"],
    friendIdea: 0.6,
    typo: 0.05,
    canned: ["ask someone nearby what they saw", "look for another way around", "check what's blocking it first", "use a rope to pull it free"],
    story: { title: "The wrong bus", setup: "I took the wrong bus on my first day at a new job", steps: "I ended up at the end of the line and the driver was on his lunch break", ending: "the driver drove me back on his break and I was only five minutes late" },
  },
  {
    name: "Jo",
    persona: "Jo, the dreamer: big weird ideas, enthusiastic, likes talking to things",
    skill: "talking to dogs",
    emoji: ["✨", "😍", "🤯", "❤️"],
    friendIdea: 0.45,
    typo: 0.15,
    canned: ["sing to it until it calms down", "ask it nicely what it wants", "build a tiny ramp out of boxes", "follow the strange glow"],
    story: { title: "The dog that took my sandwich", setup: "A neighbor's dog stole my sandwich at the park and ran off with it", steps: "I chased it across the whole park and through a kids' soccer game", ending: "the dog dropped it at its owner's feet and the owner bought me a new one" },
  },
];

export interface BotHost {
  state(): GameState;
  inject(m: Msg): void;
  owner(): string;
  freeHeroIds(): string[];
  storySoFar(): object;
  deadline(): number; // when the current phase's timer runs out (ms since epoch), 0 if none
  turnMs(): number;
  humansPlaying(): boolean;
  ask(input: object): Promise<string>;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const READING = new Set(["narrating", "outcome", "epilogue", "reveal", "final_result"]);

/** One small, human typo: a doubled or swapped letter. */
function typo(text: string) {
  const words = text.split(" ");
  const i = words.findIndex((w) => w.length > 4);
  if (i < 0) return text;
  const w = words[i];
  const k = 1 + Math.floor(Math.random() * (w.length - 2));
  words[i] = Math.random() < 0.5 ? w.slice(0, k) + w[k] + w.slice(k) : w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2);
  return words.join(" ");
}

/** Two moves are "the same idea" when most of their words match. */
function similar(a: string, b: string) {
  const w = (x: string) => new Set(String(x ?? "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((t) => t.length > 2));
  const A = w(a);
  const B = w(b);
  if (!A.size || !B.size) return false;
  let both = 0;
  A.forEach((t) => B.has(t) && both++);
  return both / Math.min(A.size, B.size) >= 0.6;
}

export class Bots {
  private list: { pid: string; who: BotPersona; done: Set<string>; lastPing: number }[] = [];
  private iv: ReturnType<typeof setInterval> | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** Every move a bot has suggested tonight, so they don't repeat themselves. */
  private said: string[] = [];

  isBot(pid: string) {
    return this.list.some((b) => b.pid === pid);
  }

  constructor(private host: BotHost) {}

  count() {
    return this.list.length;
  }

  /** Add one test player in the lobby. Returns its name, or "" when there's no room. */
  add() {
    const s = this.host.state();
    if (s.phase !== "lobby" || this.list.length >= BOT_PEOPLE.length || s.players.length >= 6) return "";
    const who = BOT_PEOPLE[this.list.length];
    const pid = `bot-${who.name.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
    this.list.push({ pid, who, done: new Set(), lastPing: 0 });
    this.host.inject({ type: "join", pid, name: who.name });
    this.later(rnd(800, 2000), () => {
      const hero = pick(this.host.freeHeroIds());
      if (hero) this.host.inject({ type: "pick", pid, heroId: hero });
      this.later(rnd(600, 1500), () => this.host.inject({ type: "real", pid, skill: who.skill, fear: "" }));
    });
    if (!this.iv) this.iv = setInterval(() => this.tick(), 1000);
    return who.name;
  }

  stop() {
    if (this.iv) clearInterval(this.iv);
    this.iv = null;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      try {
        fn();
      } catch {
        // a bot never takes the table down
      }
    }, ms);
    this.timers.add(t);
  }

  /** Do `fn` once per key, after a human-ish delay, if the game is still where it was. */
  private once(b: (typeof this.list)[number], key: string, ms: number, still: () => boolean, fn: () => void) {
    if (b.done.has(key)) return;
    b.done.add(key);
    this.later(ms, () => still() && fn());
  }

  private tick() {
    const s = this.host.state();
    const now = Date.now();
    for (const b of this.list) {
      const me = s.players.find((p) => p.id === b.pid);
      if (!me) continue;
      // Stay "present" like a phone does.
      if (now - b.lastPing > 2500) {
        b.lastPing = now;
        this.host.inject({ type: "ping", pid: b.pid });
      }
      if (!me.hero) continue;
      const phase = s.phase;
      const tag = `${phase}-${s.turnIndex}-${s.finale ? "f" : ""}`;
      if (phase === "story_vote" && s.storyOptions.length) {
        this.once(b, `sv-${s.storyOptions.map((o) => o.id).join()}`, rnd(3000, 9000), () => this.host.state().phase === "story_vote", () =>
          this.host.inject({ type: "vote", pid: b.pid, id: pick(this.host.state().storyOptions).id }),
        );
      }
      if (phase === "story_write" && !s.written.includes(b.pid)) {
        this.once(b, `sw-${tag}`, rnd(6000, 15000), () => this.host.state().phase === "story_write", () => this.host.inject({ type: "story", pid: b.pid, ...b.who.story }));
      }
      if (phase === "turn") this.turn(b, s, tag);
      if (phase === "pitch") {
        this.once(b, `fp-${tag}`, rnd(5000, 15000), () => this.host.state().phase === "pitch", async () => {
          this.host.inject({ type: "typing", pid: b.pid });
          const text = await this.idea(b, "finale", me.hero!.name, me.hero!.ability?.text ?? "");
          if (this.host.state().phase === "pitch") this.host.inject({ type: "pitch", pid: b.pid, text });
        });
      }
      if (phase === "vote") {
        this.once(b, `fv-${tag}`, rnd(4000, 10000), () => this.host.state().phase === "vote", () => {
          const others = this.host.state().pitches.filter((p) => p.playerId !== b.pid && !p.auto);
          const choice = others.length ? pick(others) : null;
          if (choice) this.host.inject({ type: "vote", pid: b.pid, id: choice.id });
        });
      }
      if (phase === "roll" && s.rolls[0]?.playerId === b.pid && !s.revealed.includes(b.pid)) {
        this.once(b, `roll-${tag}`, rnd(1500, 4500), () => this.host.state().phase === "roll", () => this.host.inject({ type: "roll", pid: b.pid }));
      }
      if (phase === "final_roll") {
        const stage = s.final?.stage;
        if (stage === "arm") this.once(b, `arm-${tag}`, rnd(1000, 3500), () => this.host.state().final?.stage === "arm", () => this.host.inject({ type: "arm", pid: b.pid }));
        if (stage === "shake") this.once(b, `shake-${tag}`, rnd(400, 2200), () => this.host.state().final?.stage === "shake", () => this.host.inject({ type: "roll", pid: b.pid }));
      }
      if (READING.has(phase)) {
        // Now and then a reaction, like a person laughing at their phone.
        if (Math.random() < 0.5) this.once(b, `re-${tag}`, rnd(2000, 7000), () => this.host.state().phase === phase, () => this.host.inject({ type: "react", pid: b.pid, emoji: pick(b.who.emoji) }));
        else b.done.add(`re-${tag}`);
      }
      if (phase === "roll" && s.revealed.length) {
        if (Math.random() < 0.4) this.once(b, `rr-${tag}`, rnd(1500, 4000), () => this.host.state().phase === "roll", () => this.host.inject({ type: "react", pid: b.pid, emoji: pick(b.who.emoji) }));
        else b.done.add(`rr-${tag}`);
      }
    }
  }

  /** A turn: the owner waits for ideas, then picks one (sometimes a friend's); everyone else suggests one. */
  private turn(b: (typeof this.list)[number], s: GameState, tag: string) {
    const owner = this.host.owner();
    const still = () => this.host.state().phase === "turn" && this.host.state().turnIndex === s.turnIndex;
    if (owner === b.pid) {
      // Like a polite person: wait for every human's suggestion (or ~70% of the timer), never while one is typing.
      const key = `own-${tag}`;
      if (b.done.has(key)) return;
      const st = this.host.state();
      const humans = st.players.filter((p) => p.hero && !p.away && p.id !== b.pid && !this.isBot(p.id));
      const left = this.host.deadline() ? this.host.deadline() - Date.now() : 0;
      const used = left > 0 ? 1 - left / this.host.turnMs() : 1;
      const typing = st.typing.some((id) => !this.isBot(id));
      const allIn = humans.every((h) => st.ideas[h.id]);
      const ideasIn = Object.keys(st.ideas).length > 0;
      const go = (allIn && ideasIn && used > 0.2 && !typing) || (used >= 0.7 && !typing) || used >= 0.9;
      if (!go) return;
      this.once(b, key, rnd(1500, 3500), still, async () => {
        const now = this.host.state();
        const friends = Object.entries(now.ideas).filter(([id]) => id !== b.pid);
        // A human's idea is the friendlier pick; bots still sometimes go with their own.
        const human = friends.filter(([id]) => !this.isBot(id));
        if (friends.length && Math.random() < Math.max(b.who.friendIdea, human.length ? 0.6 : 0)) {
          const [creditId, text] = pick(human.length ? human : friends);
          this.host.inject({ type: "pitch", pid: b.pid, text, creditId });
          return;
        }
        this.host.inject({ type: "typing", pid: b.pid });
        const me = now.players.find((p) => p.id === b.pid)!;
        const text = await this.idea(b, "own", me.hero!.name, me.hero!.ability?.text ?? "");
        if (still()) this.host.inject({ type: "pitch", pid: b.pid, text });
      });
      return;
    }
    const ownerHero = s.players.find((p) => p.id === owner)?.hero;
    if (!ownerHero) return;
    this.once(b, `idea-${tag}`, rnd(4000, 13000), still, async () => {
      this.host.inject({ type: "typing", pid: b.pid });
      const text = await this.idea(b, "suggest", ownerHero.name, ownerHero.ability?.text ?? "");
      if (still()) this.host.inject({ type: "idea", pid: b.pid, text });
    });
  }

  /** A move in this bot's voice (Muse Spark, minimal), or a canned one. Never longer than 12 words. */
  private async idea(b: (typeof this.list)[number], role: "suggest" | "own" | "finale", hero: string, power: string) {
    const s = this.host.state();
    let text = "";
    try {
      text = await this.host.ask({
        persona: b.who.persona,
        role,
        hero: { name: hero, power },
        story: { ...this.host.storySoFar(), right_now: s.nowGoal || s.goal, situation: s.situation, just_happened: s.outcome || "", already_happened: s.log.slice(-3).map((l) => l.narration) },
        already_suggested_do_not_repeat: [...this.said.slice(-8), ...Object.values(s.ideas)],
      });
    } catch {
      text = "";
    }
    text = String(text ?? "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim().split(" ").slice(0, 12).join(" ");
    // Never the same idea twice (or one somebody already tried): fall back to an unused canned move.
    const seen = [...this.said, ...Object.values(s.ideas), ...s.log.map((l) => l.pitch)];
    // A real suggestion is a little sentence: under 3 words ("Idk", "Meow") never goes out.
    if (text.split(/\s+/).filter(Boolean).length < 3) text = "";
    if (!text || seen.some((x) => similar(x, text))) {
      const fresh = b.who.canned.filter((c) => !seen.some((x) => similar(x, c)));
      text = pick(fresh.length ? fresh : b.who.canned);
    }
    this.said = [...this.said, text].slice(-20);
    // With real people at the table, test players write clean, plain ideas (no "lol", no typos).
    if (this.host.humansPlaying()) return text.replace(/\s*\b(lol|lmao|haha+)\b\s*/gi, " ").trim();
    return Math.random() < b.who.typo ? typo(text) : text;
  }
}
