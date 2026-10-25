"use client";
import { useEffect, useState } from "react";
import { GameHost } from "@/lib/host";
import { newCode } from "@/lib/transport";
import { TV } from "@/components/TV";
import { Narrator } from "@/components/Narrator";

export default function TVPage() {
  const [host, setHost] = useState<GameHost | null>(null);
  useEffect(() => {
    let code = "";
    try {
      code = sessionStorage.getItem("ouar-code") ?? "";
    } catch {}
    if (!/^[A-Z]{4}$/.test(code)) {
      code = newCode();
      try {
        sessionStorage.setItem("ouar-code", code);
      } catch {}
    }
    const h = new GameHost(code);
    // Connector link contract: /tv?party=<name>&quest=<seed id>. Unknown quest ids are ignored.
    // A refreshed tab resumes its saved game: the link only fills in what the lobby doesn't have yet,
    // and never touches a game that's already under way (re-choosing the quest would wipe the scenes).
    if (h.state.phase === "lobby")
      try {
        const qs = new URLSearchParams(window.location.search);
        const party = qs.get("party")?.trim();
        const quest = qs.get("quest")?.trim();
        if (party && !(h.restored && h.state.partyName)) h.setPartyName(party);
        if (quest && quest !== h.state.questId) h.chooseQuest(quest);
      } catch {}
    setHost(h);
    return () => h.close();
  }, []);
  if (!host) return null;
  return (
    <>
      <TV host={host} />
      <Narrator host={host} />
    </>
  );
}
