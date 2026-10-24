"use client";
import { useEffect, useState } from "react";
import { GameHost } from "@/lib/host";
import { newCode } from "@/lib/transport";
import { TV } from "@/components/TV";

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
    try {
      const qs = new URLSearchParams(window.location.search);
      const party = qs.get("party")?.trim();
      const quest = qs.get("quest")?.trim();
      if (party) h.setPartyName(party);
      if (quest) h.chooseQuest(quest);
    } catch {}
    setHost(h);
    return () => h.close();
  }, []);
  if (!host) return null;
  return <TV host={host} />;
}
