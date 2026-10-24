"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ai<T>(task: string, input: any): Promise<{ data: T; fallback: boolean }> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, input }),
  });
  if (!res.ok) throw new Error(`ai ${task} HTTP ${res.status}`);
  return res.json();
}

/** Returns a data URL, or null if generation failed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function image(body: any): Promise<string | null> {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return `data:${j.mime};base64,${j.b64}`;
  } catch {
    return null;
  }
}

/** Shrinks an image to a small JPEG so it fits in a realtime message to phones. */
export function thumbnail(dataUrl: string, width = 240, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const h = Math.round((img.height / img.width) * width);
      const c = document.createElement("canvas");
      c.width = width;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, width, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

export function withTimeout<T>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback()), ms))]).catch(() => fallback());
}
