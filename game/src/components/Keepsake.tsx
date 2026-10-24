"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { GameHost } from "@/lib/host";
import type { GameState } from "@/lib/types";
import { buildKeepsake, fitKeepsake } from "@/lib/keepsake";

/** Storybook "take it home" panel: a QR to /tale#<the whole story>. Nothing is uploaded anywhere. */
export function KeepsakeQR({ host, s, size = 300 }: { host: GameHost; s: GameState; size?: number }) {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const book = s.storybook;
  useEffect(() => {
    if (!book) return;
    let alive = true;
    const k = buildKeepsake(
      s,
      { cover: host.sceneImages[s.scenes.length - 1] ?? host.sceneImages[0], portraits: host.portraits },
      host.realStory,
    );
    if (!k) return;
    fitKeepsake(k)
      .then((hash) => {
        const full = `${location.origin}/tale#${hash}`;
        if (!alive) return;
        setUrl(full);
        return QRCode.toDataURL(full, { margin: 1, width: size * 2, errorCorrectionLevel: "L", color: { dark: "#0A0612", light: "#F5F1FF" } });
      })
      .then((d) => alive && d && setQr(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // The story is final once the storybook exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);
  if (!book) return null;
  return (
    <div className="flex flex-col items-center gap-2 text-center max-w-[22rem]">
      <p className="font-heading text-2xl uppercase text-[var(--signal)]">Take your tale home</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code: your storybook" className="rounded" style={{ width: size, height: size }} />
      ) : (
        <div className="rounded bg-[var(--surface-2)] animate-pulse" style={{ width: size, height: size }} />
      )}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="font-ui text-sm text-parchment/80 underline decoration-dotted">
          {location.host}/tale
        </a>
      )}
      <p className="font-ui text-xs text-parchment/60 leading-snug">This link holds your story. Nothing is stored on our servers.</p>
    </div>
  );
}
