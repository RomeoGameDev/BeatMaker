import { normalizeSamplePath } from "@/lib/samplePaths";
import type { Sample } from "@/types";

const durationCache = new Map<string, Promise<Pick<Sample, "durationSeconds" | "durationMs" | "isLong">>>();

export function markSampleDuration(sample: Sample, durationSeconds: number): Sample {
  const safeSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined;
  if (!safeSeconds) return sample;
  const durationMs = Math.round(safeSeconds * 1000);
  return { ...sample, durationSeconds: safeSeconds, durationMs, isLong: safeSeconds > 2 };
}

export async function decodeSampleDuration(sample: Sample): Promise<Pick<Sample, "durationSeconds" | "durationMs" | "isLong">> {
  if (sample.durationSeconds && sample.durationMs) return { durationSeconds: sample.durationSeconds, durationMs: sample.durationMs, isLong: sample.isLong ?? sample.durationSeconds > 2 };
  const key = normalizeSamplePath(sample.path);
  if (!durationCache.has(key)) {
    durationCache.set(key, (async () => {
      const response = await fetch(key);
      if (!response.ok) {
        console.warn("Could not load sample duration.", { url: key, status: response.status });
        throw new Error(`Could not load ${key}`);
      }
      const audioContext = new AudioContext();
      try {
        let buffer: AudioBuffer;
        try {
          buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        } catch (decodeError) {
          console.warn("Could not decode sample duration.", { url: key, error: decodeError });
          throw decodeError;
        }
        const durationSeconds = buffer.duration;
        return { durationSeconds, durationMs: Math.round(durationSeconds * 1000), isLong: durationSeconds > 2 };
      } finally {
        await audioContext.close().catch(() => undefined);
      }
    })());
  }
  return durationCache.get(key)!;
}

export function formatDuration(seconds?: number) {
  return seconds && Number.isFinite(seconds) ? `${seconds.toFixed(2)}s` : "Duration not loaded yet";
}
