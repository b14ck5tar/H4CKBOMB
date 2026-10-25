import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Keys live in ../.env.local (next to SPEC.md). Next only auto-loads env files from game/, and its loader
// caches the first result, so read the parent file directly. On Vercel the keys come from project settings.
// cwd is the game/ folder for `npm run dev` / `next build` (next.config.ts is transpiled, so __dirname is unreliable).
const parentEnv: Record<string, string> = {};
try {
  const text = fs.readFileSync(path.resolve(process.cwd(), "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) parentEnv[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no parent key file (e.g. on Vercel) */
}

// Locally, pass the parent file's keys through. On Vercel, server secrets are read at runtime from project
// settings, so only the public (browser-safe) values are passed here and secrets are never baked into a build.
const KEYS = process.env.VERCEL
  ? ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  : ["MODEL_API_KEY", "SERPAPI_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "ELEVENLABS_API_KEY", "TTS_PROVIDER", "ELEVENLABS_GAME_CREDITS", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "MCP_TOKEN"];
const env: Record<string, string> = {};
for (const k of KEYS) {
  // Defense in depth: never let an admin/secret key ride along in a NEXT_PUBLIC_ variable.
  if (k.startsWith("NEXT_PUBLIC_") && /^(sb_secret_|eyJ.*service_role)/.test(process.env[k] || parentEnv[k] || "")) continue;
  const v = process.env[k] || parentEnv[k];
  if (v) env[k] = v;
}

// A short build stamp for the DM's Notes footer, so everyone can tell which build is live.
let build = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
if (!build) {
  try {
    build = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    build = "dev";
  }
}
env.NEXT_PUBLIC_BUILD = build;

const nextConfig: NextConfig = {
  // Each dev server gets its own build folder so parallel test servers don't clobber each other.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env,
  // the judge stories' pre-voiced openers ship with the narrator route (read with fs at runtime)
  outputFileTracingIncludes: { "/api/tts": ["./voice-cache/**/*"] },
};

export default nextConfig;
