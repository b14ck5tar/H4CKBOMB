export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 2 * 1024 * 1024;
const URL_ASR = "https://api.meta.ai/v1/asr/transcribe";

function fail(error: string, status = 502) {
  return Response.json({ text: "", error }, { status });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const key = process.env.MODEL_API_KEY;
  if (!key) return fail("MODEL_API_KEY is not set", 500);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return fail("audio too large (max 2 MB)", 413);
  const wav = new Uint8Array(await req.arrayBuffer());
  if (wav.byteLength > MAX_BYTES) return fail("audio too large (max 2 MB)", 413);
  const tag = (o: number) => String.fromCharCode(...wav.subarray(o, o + 4));
  if (wav.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    console.warn("[asr] bad WAV header", Array.from(wav.subarray(0, 12)));
    return fail("body is not a WAV file", 400);
  }

  try {
    const form = new FormData();
    form.append(
      "request",
      new Blob([JSON.stringify({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], {
        type: "application/json",
      }),
    );
    form.append("audio", new Blob([wav], { type: "audio/wav" }), "audio.wav");

    let res: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(URL_ASR, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status !== 429) break; // 429 is not billed: back off and retry
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
    if (!res || !res.ok) {
      const body = res ? (await res.text()).slice(0, 300) : "";
      console.error(`[asr] HTTP ${res?.status} ${body}`);
      return fail(`transcription failed (HTTP ${res?.status})`);
    }
    const j = await res.json();
    const text = String(j.transcript ?? "").trim();
    console.log(`[asr] ${Date.now() - t0}ms bytes=${wav.byteLength} audioMs=${j.audioDurationMs} chars=${text.length}`);
    return Response.json({ text });
  } catch (e) {
    console.error(`[asr] error after ${Date.now() - t0}ms`, e);
    return fail(e instanceof Error ? e.message : "transcription failed");
  }
}
