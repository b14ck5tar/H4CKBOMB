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
    setHost(h);
    return () => h.close();
  }, []);
  if (!host) return null;
  return <TV host={host} />;
}
