import * as Tone from "tone";
import { loadSampleAudioBuffer, SampleLoadError } from "@/lib/sampleLoader";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { PatternId, Sample, SequencerTrack } from "@/types";

type CacheEntry = { key: string; buffer?: Tone.ToneAudioBuffer; promise?: Promise<void>; error?: string; status: "loading" | "loaded" | "error" };
const cache = new Map<string, CacheEntry>();
let lastPreloadMs = 0;

export const getSampleCacheKey = (sample: Sample) => sample.id || normalizeSamplePath(sample.path);

export function getCachedBuffer(sample?: Sample) {
  if (!sample) return undefined;
  const entry = cache.get(getSampleCacheKey(sample));
  return entry?.status === "loaded" ? entry.buffer : undefined;
}

export function getSampleCacheStats() {
  return { cachedSampleCount: Array.from(cache.values()).filter((entry) => entry.status === "loaded").length, loadingSampleCount: Array.from(cache.values()).filter((entry) => entry.status === "loading").length, failedSampleCount: Array.from(cache.values()).filter((entry) => entry.status === "error").length, lastPreloadMs };
}

export function clearSampleCache() {
  cache.forEach((entry) => { try { entry.buffer?.dispose(); } catch {} });
  cache.clear();
  lastPreloadMs = 0;
}

export async function preloadSamples(samples: Array<Sample | undefined>): Promise<void> {
  const unique = samples.filter((sample): sample is Sample => Boolean(sample?.path));
  const started = performance.now();
  await Promise.all(unique.map(async (sample) => {
    const key = getSampleCacheKey(sample);
    const existing = cache.get(key);
    if (existing?.status === "loaded") return;
    if (existing?.promise) return existing.promise;
    const entry: CacheEntry = { key, status: "loading" };
    entry.promise = loadSampleAudioBuffer(sample).then((loaded) => {
      // Sequencer ticks only read this decoded ToneAudioBuffer; they never fetch/decode.
      entry.buffer = new Tone.ToneAudioBuffer(loaded.audioBuffer);
      entry.status = "loaded";
      entry.error = undefined;
    }).catch((error) => {
      entry.status = "error";
      entry.error = error instanceof SampleLoadError || error instanceof Error ? error.message : "Sample not loaded yet.";
    }).finally(() => { entry.promise = undefined; });
    cache.set(key, entry);
    return entry.promise;
  }));
  lastPreloadMs = Math.round(performance.now() - started);
}

export async function preloadProjectAudio(tracks: SequencerTrack[], _patterns?: unknown, _activePattern?: PatternId) {
  const activeSamples = tracks.filter((track) => !track.settings.mute && track.assignedSample && (track.mode === "sliced" ? Object.values(track.sliceSteps ?? {}).some((steps) => steps.some((step) => step.active)) : track.steps.some((step) => step.active))).map((track) => track.assignedSample);
  await preloadSamples(activeSamples);
}
