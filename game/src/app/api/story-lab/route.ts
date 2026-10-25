import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// POST /api/story-lab (local dev only): the story lab page (/story-lab.html) saves the creative director's blind
// picks here. They are appended to design/30-story-engine-v2.md under "CD picks". 404 in production.

const FILE = path.resolve(process.cwd(), "..", "design", "30-story-engine-v2.md");
const clean = (x: unknown, n: number) => String(x ?? "").replace(/[<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "not found" }, { status: 404 });
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const picks = Array.isArray(b.picks) ? b.picks.slice(0, 10) : [];
  if (!picks.length) return NextResponse.json({ error: "no picks" }, { status: 400 });
  const lines = picks.map((p: Record<string, unknown>) => `- ${clean(p.story, 80)}: picked Version ${clean(p.letter, 2)} = **${clean(p.engine, 80)}**${p.note ? `. Note: ${clean(p.note, 400)}` : ""}`);
  const when = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" });
  const block = `\n### CD picks (${when} Austin)\n${lines.join("\n")}${b.overall ? `\n- Overall: ${clean(b.overall, 600)}` : ""}\n`;
  if (!fs.existsSync(FILE)) return NextResponse.json({ error: "design/30 not found" }, { status: 500 });
  fs.appendFileSync(FILE, block, "utf8");
  return NextResponse.json({ ok: true, saved: lines.length });
}
