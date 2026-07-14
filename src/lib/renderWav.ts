import { getCachedAudioBuffer, loadSampleBuffer } from "@/lib/sampleCache";
import type { ArrangementSlot, PatternId, SequencerStep, SequencerTrack, TrackSettings } from "@/types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function curvePoint(curve: TrackSettings["fadeInCurve"], t: number) {
  return curve === "easeIn" ? t * t : curve === "easeOut" ? 1 - (1 - t) * (1 - t) : curve === "exponential" ? Math.pow(t, 3) : t;
}

export function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => Array.from(text).forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) { view.setInt16(offset, clamp(samples[index] ?? 0, -1, 1) * 0x7fff, true); offset += 2; }
  return new Blob([buffer], { type: "audio/wav" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(value: string) { return value.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample"; }

function mixBufferInto(output: Float32Array, buffer: AudioBuffer, track: SequencerTrack, stepSeconds = 0, event: { stepIndex?: number; slice?: { startMs: number; endMs: number; attackMs?: number; fadeInMs?: number; fadeOutMs?: number } } = {}) {
  const sampleRate = 44100;
  const startOut = Math.floor((event.stepIndex ?? 0) * stepSeconds * sampleRate);
  const pitchRate = Math.pow(2, clamp(track.settings.pitchSemitones, -24, 24) / 12);
  const start = Math.floor(clamp((event.slice?.startMs ?? track.settings.startOffsetMs) / 1000, 0, buffer.duration) * buffer.sampleRate);
  const end = event.slice ? Math.floor(clamp(event.slice.endMs / 1000, 0, buffer.duration) * buffer.sampleRate) : Math.max(start, buffer.length - Math.floor(clamp(track.settings.endTrimMs / 1000, 0, buffer.duration) * buffer.sampleRate));
  const length = Math.ceil(Math.max(0, end - start) / pitchRate);
  for (let index = 0; index < length && startOut + index < output.length; index += 1) {
    const sourceIndex = start + index * pitchRate;
    const left = Math.floor(sourceIndex);
    const frac = sourceIndex - left;
    let mixed = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      mixed += ((data[left] ?? 0) * (1 - frac)) + ((data[left + 1] ?? 0) * frac);
    }
    const ms = (index / sampleRate) * 1000;
    const remainingMs = ((length - index) / sampleRate) * 1000;
    const fadeInMs = event.slice?.attackMs ?? event.slice?.fadeInMs ?? track.settings.fadeInMs;
    const fadeOutMs = event.slice?.fadeOutMs ?? track.settings.fadeOutMs;
    const fade = Math.min(fadeInMs > 0 ? clamp(curvePoint(track.settings.fadeInCurve, ms / fadeInMs), 0, 1) : 1, fadeOutMs > 0 ? clamp(curvePoint(track.settings.fadeOutCurve, remainingMs / fadeOutMs), 0, 1) : 1);
    mixed = (mixed / Math.max(1, buffer.numberOfChannels)) * clamp(track.settings.volume, 0, 1.5) * fade;
    output[startOut + index] = clamp((output[startOut + index] ?? 0) + mixed, -1, 1);
  }
}

async function getBuffer(track: SequencerTrack) {
  if (!track.assignedSample) return undefined;
  return getCachedAudioBuffer(track.assignedSample) ?? (await loadSampleBuffer(track.assignedSample)).audioBuffer;
}

export async function renderTrackDryWav(track: SequencerTrack, durationSeconds?: number) {
  if (!track.assignedSample) throw new Error("No sample assigned.");
  const buffer = await getBuffer(track);
  if (!buffer) throw new Error("No sample assigned.");
  const sampleRate = 44100;
  const seconds = durationSeconds ?? Math.max(1, (buffer.duration - track.settings.startOffsetMs / 1000 - track.settings.endTrimMs / 1000) / Math.pow(2, clamp(track.settings.pitchSemitones, -24, 24) / 12));
  const output = new Float32Array(Math.ceil(seconds * sampleRate));
  mixBufferInto(output, buffer, track);
  return encodeWav(output, sampleRate);
}

export type PatternSteps = Record<PatternId, Record<number, SequencerStep[]>>;
export type RenderResult = { blob: Blob; skipped: string[] };

export async function renderPatternDryWav(tracks: SequencerTrack[], bpm: number, outputSeconds?: number): Promise<RenderResult> {
  const stepCount = Math.max(1, ...tracks.map((track) => track.steps.length || 0));
  const sampleRate = 44100;
  const stepSeconds = 60 / Math.max(1, bpm) / 4;
  const output = new Float32Array(Math.ceil((outputSeconds ?? (stepCount * stepSeconds + 8)) * sampleRate));
  const hasSolo = tracks.some((track) => track.settings.solo);
  const skipped: string[] = [];
  for (const track of tracks) {
    if (!track.assignedSample || track.settings.mute || (hasSolo && !track.settings.solo)) continue;
    let buffer: AudioBuffer | undefined;
    try { buffer = await getBuffer(track); } catch { skipped.push(track.assignedSample.name); continue; }
    if (!buffer) continue;
    const events = track.mode === "sliced" ? (track.slices ?? []).flatMap((slice) => (track.sliceSteps?.[slice.id] ?? []).map((step, stepIndex) => ({ step, stepIndex, slice })).filter((item) => item.step?.active)) : track.steps.map((step, stepIndex) => ({ step, stepIndex, slice: undefined })).filter((item) => item.step?.active);
    for (const event of events) mixBufferInto(output, buffer, track, stepSeconds, event);
  }
  let last = output.length - 1;
  while (last > sampleRate && Math.abs(output[last]) < 0.0001) last -= 1;
  return { blob: encodeWav(output.slice(0, Math.max(sampleRate, last + 1)), sampleRate), skipped };
}

export async function renderArrangementDryWav(tracks: SequencerTrack[], bpm: number, timeline: ArrangementSlot[], patterns: PatternSteps): Promise<RenderResult> {
  const stepCount = Math.max(1, tracks[0]?.steps.length ?? 16);
  const patternSeconds = stepCount * (60 / Math.max(1, bpm) / 4);
  const sampleRate = 44100;
  const output = new Float32Array(Math.ceil(Math.max(1, timeline.length * patternSeconds) * sampleRate));
  const skipped: string[] = [];
  for (let slotIndex = 0; slotIndex < timeline.length; slotIndex += 1) {
    const pattern = timeline[slotIndex];
    if (!pattern) continue;
    const patternTracks = tracks.map((track) => ({ ...track, steps: patterns[pattern]?.[track.id] ?? track.steps }));
    const result = await renderPatternDryWav(patternTracks, bpm, patternSeconds);
    skipped.push(...result.skipped);
    const buf = await result.blob.arrayBuffer();
    const audio = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const offset = Math.floor(slotIndex * patternSeconds * sampleRate);
    for (let i = 0; i < data.length && offset + i < output.length; i += 1) output[offset + i] = clamp((output[offset + i] ?? 0) + data[i], -1, 1);
  }
  return { blob: encodeWav(output, sampleRate), skipped };
}


export async function renderPitchedNotesWav({ sample, rootNote, notes, mode, bpm, noteDuration, volume = 1, pitchOffsetSemitones = 0 }: { sample: { path: string }; rootNote: string; notes: string[]; mode: "chord" | "riff"; bpm: number; noteDuration: "1/4" | "1/8" | "1/16"; volume?: number; pitchOffsetSemitones?: number; }) {
  const { loadSampleAudioBuffer } = await import("@/lib/sampleLoader");
  const { semitoneDiff } = await import("@/lib/musicTheory");
  const loaded = await loadSampleAudioBuffer(sample as never);
  const sourceBuffer = loaded.audioBuffer;
  const rate = sourceBuffer.sampleRate;
  const stepSeconds = (60 / Math.max(1, bpm)) * ({ "1/4": 1, "1/8": 0.5, "1/16": 0.25 }[noteDuration] ?? 0.5);
  const starts = notes.map((_, index) => mode === "riff" ? index * stepSeconds : 0);
  const renderedLengths = notes.map((note) => Math.ceil(sourceBuffer.length / Math.pow(2, (semitoneDiff(rootNote, note) + pitchOffsetSemitones) / 12)));
  const outputLength = Math.max(1, ...renderedLengths.map((length, index) => Math.ceil(starts[index] * rate) + length));
  const output = new Float32Array(outputLength);
  notes.forEach((note, noteIndex) => {
    const pitchRate = Math.pow(2, (semitoneDiff(rootNote, note) + pitchOffsetSemitones) / 12);
    const startSample = Math.floor(starts[noteIndex] * rate);
    const length = renderedLengths[noteIndex];
    for (let index = 0; index < length; index += 1) {
      const sourceIndex = index * pitchRate;
      const left = Math.floor(sourceIndex);
      const frac = sourceIndex - left;
      let mixed = 0;
      for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel += 1) {
        const data = sourceBuffer.getChannelData(channel);
        mixed += ((data[left] ?? 0) * (1 - frac)) + ((data[left + 1] ?? 0) * frac);
      }
      mixed /= Math.max(1, sourceBuffer.numberOfChannels);
      const fade = Math.min(1, index / Math.max(1, rate * 0.01), (length - index) / Math.max(1, rate * 0.02));
      output[startSample + index] = clamp((output[startSample + index] ?? 0) + mixed * fade * volume / Math.max(1, mode === "chord" ? notes.length * 0.7 : 1), -1, 1);
    }
  });
  return { blob: encodeWav(output, rate), durationSeconds: output.length / rate };
}
