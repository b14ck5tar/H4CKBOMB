// Browser-only: record the mic and produce a RIFF/WAVE mono PCM16 16 kHz Blob
// (the only format the Meta ASR endpoint accepts). No MediaRecorder.

export type Recorder = {
  stop(): Promise<Blob>;
  cancel(): void;
  level(): number; // 0..1, for a mic meter
};

const TARGET_RATE = 16000;
const MAX_SECONDS = 15;

export async function startRecording(): Promise<Recorder> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not supported");
  }
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  // iOS Safari: the context must be created and resumed synchronously inside the user gesture,
  // i.e. BEFORE awaiting getUserMedia.
  const ctx = new AC();
  void ctx.resume().catch(() => {});

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (e) {
    void ctx.close().catch(() => {});
    throw e;
  }
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  const rate = ctx.sampleRate;
  const maxSamples = Math.floor(rate * MAX_SECONDS);
  const chunks: Float32Array[] = [];
  let total = 0;
  let lvl = 0;
  let done = false;

  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0; // processor must reach destination to fire on iOS; keep it silent
  proc.onaudioprocess = (ev) => {
    if (done) return;
    const input = ev.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    lvl = Math.min(1, Math.sqrt(sum / input.length) * 4);
    if (total >= maxSamples) return;
    const take = Math.min(input.length, maxSamples - total);
    chunks.push(new Float32Array(input.subarray(0, take))); // copy: buffer is reused
    total += take;
  };
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);

  function teardown() {
    done = true;
    lvl = 0;
    try {
      proc.onaudioprocess = null;
      source.disconnect();
      proc.disconnect();
      mute.disconnect();
    } catch {}
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  }

  return {
    level: () => lvl,
    cancel() {
      if (!done) teardown();
    },
    async stop() {
      if (!done) teardown();
      const merged = new Float32Array(total);
      let o = 0;
      for (const c of chunks) {
        merged.set(c, o);
        o += c.length;
      }
      chunks.length = 0;
      return encodeWav(downsample(merged, rate, TARGET_RATE), TARGET_RATE);
    },
  };
}

/** Downsample by averaging the source samples that fall in each output bin. */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  if (from < to) {
    // Rare (<16 kHz context): linear upsample.
    const n = Math.floor((input.length * to) / from);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = (i * from) / to;
      const i0 = Math.floor(p);
      const i1 = Math.min(i0 + 1, input.length - 1);
      out[i] = input[i0] + (input[i1] - input[i0]) * (p - i0);
    }
    return out;
  }
  const ratio = from / to;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.max(start + 1, Math.floor((i + 1) * ratio)), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / (end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataLen, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  v.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
