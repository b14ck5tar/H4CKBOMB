"use client";
/**
 * Standalone review page for the new lobby (components/Lobby.tsx), with fake players. No GameHost, no network.
 *   /lobby-preview?n=0        attract mode (nobody joined)
 *   /lobby-preview?n=1        one hero      ?n=4  four heroes + START      ?picking=1  last player still picking
 *   /lobby-preview?demo=1     players join one by one (hear the pop-in sound after one click)
 *   /lobby-preview?n=4&autostart=1   clicks START to show the 3-2-1 countdown
 * Keys: J = someone joins, H = next card flips to its hero, R = reset, C = toggle "story loaded" (canStart).
 */
import { useCallback, useEffect, useState } from "react";
import { Lobby, type StorySource } from "@/components/Lobby";
import quick from "@/data/quickstart_heroes_v2.json";
import type { GameMode, Hero, Player, Rating } from "@/lib/types";

const HEROES = quick as { id: string; hero: Hero }[];
const NAMES = ["Maya", "Dev", "Priya", "Jordan", "Sam", "Luis"];
const COLORS = ["#ff2e7e", "#3de7ff", "#ffad3b", "#c6ff2e", "#b46bff", "#ff6b3d"];

function fake(i: number, withHero: boolean): Player {
  const q = HEROES[i % HEROES.length];
  return {
    id: `p${i}-${q.id}`,
    name: NAMES[i % NAMES.length],
    color: COLORS[i % COLORS.length],
    status: withHero ? "ready" : "joined",
    pick: q.id,
    hero: withHero ? q.hero : undefined,
    hasPortrait: withHero,
    abilityAvailable: true,
    heart: 1,
    titles: [],
    peril: "",
  };
}

export default function LobbyPreview() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mode, setMode] = useState<GameMode>("quick");
  const [source, setSource] = useState<StorySource>("news");
  const [rating, setRating] = useState<Rating>("teens");
  const [loaded, setLoaded] = useState(true);
  const [started, setStarted] = useState(false);
  const [bots, setBots] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const n = Math.min(6, Number(qs.get("n") ?? 0) || 0);
    const picking = qs.has("picking");
    setBots(qs.has("bots"));
    if (qs.has("autostart")) setTimeout(() => document.querySelector<HTMLButtonElement>(".lb-start")?.click(), 1500);
    setPlayers(Array.from({ length: n }, (_, i) => fake(i, !(picking && i === n - 1))));
    if (qs.has("demo")) {
      let k = 0;
      const iv = setInterval(() => {
        if (k >= 4) return clearInterval(iv);
        const i = k++;
        setPlayers((ps) => [...ps, fake(i, false)]);
        setTimeout(() => setPlayers((ps) => ps.map((p) => (p.id === fake(i, false).id ? fake(i, true) : p))), 1800);
      }, 2600);
      return () => clearInterval(iv);
    }
  }, []);

  const join = useCallback(() => setPlayers((ps) => (ps.length >= 6 ? ps : [...ps, fake(ps.length, false)])), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "j") join();
      if (k === "h")
        setPlayers((ps) => {
          const i = ps.findIndex((p) => !p.hero);
          return i < 0 ? ps : ps.map((p, j) => (j === i ? fake(i, true) : p));
        });
      if (k === "r") {
        setPlayers([]);
        setStarted(false);
      }
      if (k === "c") setLoaded((x) => !x);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [join]);

  if (started)
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#07040d", color: "#fff", fontFamily: "var(--font-display)", fontSize: "6vw" }}>
        begin() called · press R
      </div>
    );

  return (
    <Lobby
      code="KRAB"
      players={players}
      mode={mode}
      source={source}
      rating={rating}
      portraitOf={(p) => (p.pick ? `/heroes/v2/${p.pick}.webp` : undefined)}
      onMode={setMode}
      onSource={setSource}
      onRating={setRating}
      canStart={loaded && players.some((p) => p.hero)}
      onStart={() => setStarted(true)}
      shortUrl="groupproject-game.vercel.app/play"
      joinUrl="https://groupproject-game.vercel.app/play?code=KRAB"
      onAddBot={bots ? join : undefined}
      onKick={(id) => setPlayers((ps) => ps.filter((p) => p.id !== id))}
    />
  );
}
