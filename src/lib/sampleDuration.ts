import { loadSampleAudioBuffer } from "@/lib/sampleLoader";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { Sample } from "@/types";

const durationCache = new Map<string, Promise<Pick<Sample, "durationSeconds" | "durationMs" | "isLong" | "normalizedPath" | "loadStatus" | "lastErrorMessage">>>();

export function markSampleDuration(sample: Sample, durationSeconds: number): Sample {
  const safeSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined;
  if (!safeSeconds) return sample;
  const durationMs = Math.round(safeSeconds * 1000);
  return { ...sample, durationSeconds: safeSeconds, durationMs, isLong: safeSeconds > 2, normalizedPath: normalizeSamplePath(sample.path), loadStatus: "loaded", lastErrorMessage: undefined };
}

export async function decodeSampleDuration(sample: Sample): Promise<Pick<Sample, "durationSeconds" | "durationMs" | "isLong" | "normalizedPath" | "loadStatus" | "lastErrorMessage">> {
  if (sample.durationSeconds && sample.durationMs) return { durationSeconds: sample.durationSeconds, durationMs: sample.durationMs, isLong: sample.isLong ?? sample.durationSeconds > 2, normalizedPath: normalizeSamplePath(sample.path), loadStatus: "loaded", lastErrorMessage: undefined };
  const key = normalizeSamplePath(sample.path);
  if (!durationCache.has(key)) {
    durationCache.set(key, (async () => {
      const loaded = await loadSampleAudioBuffer(sample);
      const durationSeconds = loaded.audioBuffer.duration;
      return { durationSeconds, durationMs: Math.round(durationSeconds * 1000), isLong: durationSeconds > 2, normalizedPath: loaded.normalizedPath, loadStatus: "loaded" as const, lastErrorMessage: undefined };
    })());
  }
  return durationCache.get(key)!;
}

export function formatDuration(seconds?: number) {
  return seconds && Number.isFinite(seconds) ? `${seconds.toFixed(2)}s` : "Duration not loaded yet";
}
