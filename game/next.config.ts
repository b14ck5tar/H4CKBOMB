import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Keys live in ../.env.local (next to SPEC.md). Next's dev workers don't inherit variables loaded here,
// so pass the ones that are set through `env` (on Vercel they come from the project settings instead).
loadEnvConfig(path.resolve(__dirname, ".."));

const KEYS = ["MODEL_API_KEY", "SERPAPI_KEY", "GEMINI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

const nextConfig: NextConfig = {
  env: Object.fromEntries(KEYS.filter((k) => process.env[k]).map((k) => [k, process.env[k] as string])),
};

export default nextConfig;
