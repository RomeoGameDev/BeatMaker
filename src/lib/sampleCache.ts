import * as Tone from "tone";
import { loadSampleAudioBuffer, SampleLoadError } from "@/lib/sampleLoader";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { PatternId, Sample, SequencerTrack } from "@/types";

export type LoadedSampleResult = {
  sample: Sample;
  audioBuffer: AudioBuffer;
  toneBuffer: Tone.ToneAudioBuffer;
  durationSeconds: number;
  durationMs: number;
  normalizedPath: string;
};

type CacheEntry = { key: string; toneBuffer?: Tone.ToneAudioBuffer; audioBuffer?: AudioBuffer; promise?: Promise<LoadedSampleResult>; error?: string; status: Sample["loadStatus"] };
const cache = new Map<string, CacheEntry>();
let lastPreloadMs = 0;

export const getSampleCacheKey = (sampleOrId: Sample | string) => typeof sampleOrId === "string" ? sampleOrId : (sampleOrId.id || normalizeSamplePath(sampleOrId.path));

export function getCachedSample(sampleOrId?: Sample | string) {
  if (!sampleOrId) return undefined;
  const entry = cache.get(getSampleCacheKey(sampleOrId));
  return entry?.status === "loaded" ? entry : undefined;
}

export function getCachedBuffer(sample?: Sample) { return getCachedSample(sample)?.toneBuffer; }
export function getCachedAudioBuffer(sample?: Sample) { return getCachedSample(sample)?.audioBuffer; }
export function getSampleDuration(sample?: Sample) {
  if (sample?.durationMs) return sample.durationMs;
  const duration = sample ? getCachedSample(sample)?.audioBuffer?.duration : undefined;
  return duration ? duration * 1000 : undefined;
}

export function getSampleCacheStats() {
  const values = Array.from(cache.values());
  return { cachedSampleCount: values.filter((entry) => entry.status === "loaded").length, loadingSampleCount: values.filter((entry) => entry.status === "loading").length, failedSampleCount: values.filter((entry) => entry.status === "decode-failed" || entry.status === "fetch-failed").length, lastPreloadMs };
}

export function clearSampleCache() {
  cache.forEach((entry) => { try { entry.toneBuffer?.dispose(); } catch {} });
  cache.clear();
  lastPreloadMs = 0;
}

export async function loadSampleBuffer(sample: Sample): Promise<LoadedSampleResult> {
  const key = getSampleCacheKey(sample);
  const existing = cache.get(key);
  if (existing?.status === "loaded" && existing.audioBuffer && existing.toneBuffer) {
    const durationSeconds = existing.audioBuffer.duration;
    return { sample, audioBuffer: existing.audioBuffer, toneBuffer: existing.toneBuffer, durationSeconds, durationMs: Math.round(durationSeconds * 1000), normalizedPath: normalizeSamplePath(sample.path) };
  }
  if (existing?.promise) return existing.promise;
  const entry: CacheEntry = existing ?? { key, status: "loading" };
  entry.status = "loading";
  entry.error = undefined;
  entry.promise = loadSampleAudioBuffer(sample).then((loaded) => {
    const durationSeconds = loaded.audioBuffer.duration;
    entry.audioBuffer = loaded.audioBuffer;
    entry.toneBuffer = new Tone.ToneAudioBuffer(loaded.audioBuffer);
    entry.status = "loaded";
    entry.error = undefined;
    return { sample, audioBuffer: loaded.audioBuffer, toneBuffer: entry.toneBuffer, durationSeconds, durationMs: Math.round(durationSeconds * 1000), normalizedPath: loaded.normalizedPath };
  }).catch((error) => {
    entry.status = error instanceof SampleLoadError && error.status === "fetch-failed" ? "fetch-failed" : "decode-failed";
    entry.error = error instanceof Error ? error.message : String(error);
    throw error;
  }).finally(() => { entry.promise = undefined; });
  cache.set(key, entry);
  return entry.promise;
}

export async function preloadSamples(samples: Array<Sample | undefined>): Promise<void> {
  const unique = Array.from(new Map(samples.filter((sample): sample is Sample => Boolean(sample?.path)).map((sample) => [getSampleCacheKey(sample), sample])).values());
  const started = performance.now();
  await Promise.allSettled(unique.map((sample) => loadSampleBuffer(sample)));
  lastPreloadMs = Math.round(performance.now() - started);
}

export async function preloadProjectAudio(tracks: SequencerTrack[], _patterns?: unknown, _activePattern?: PatternId) {
  const hasSolo = tracks.some((track) => track.settings.solo);
  const activeSamples = tracks.filter((track) => !track.settings.mute && (!hasSolo || track.settings.solo) && track.assignedSample && (track.mode === "sliced" ? Object.values(track.sliceSteps ?? {}).some((steps) => steps.some((step) => step.active)) : track.steps.some((step) => step.active))).map((track) => track.assignedSample);
  await preloadSamples(activeSamples);
}
