import { PCM_WAV_DECODE_MESSAGE } from "@/lib/sampleLoader";
import type { SequencerTrack, TrackSettings } from "@/types";

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

export async function renderTrackDryWav(track: SequencerTrack) {
  if (!track.assignedSample) throw new Error("No sample assigned.");
  const response = await fetch(track.assignedSample.path);
  if (!response.ok) throw new Error("Could not load sample.");
  const context = new OfflineAudioContext(1, 1, 44100);
  let sourceBuffer: AudioBuffer;
  try {
    sourceBuffer = await context.decodeAudioData(await response.arrayBuffer());
  } catch {
    throw new Error(PCM_WAV_DECODE_MESSAGE);
  }
  const rate = sourceBuffer.sampleRate;
  const start = Math.floor(clamp(track.settings.startOffsetMs / 1000, 0, sourceBuffer.duration) * rate);
  const end = Math.max(start, sourceBuffer.length - Math.floor(clamp(track.settings.endTrimMs / 1000, 0, sourceBuffer.duration) * rate));
  const pitchRate = Math.pow(2, clamp(track.settings.pitchSemitones, -24, 24) / 12);
  const outputLength = Math.max(1, Math.ceil((end - start) / pitchRate));
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = start + index * pitchRate;
    const left = Math.floor(sourceIndex);
    const frac = sourceIndex - left;
    let mixed = 0;
    for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel += 1) {
      const data = sourceBuffer.getChannelData(channel);
      mixed += ((data[left] ?? 0) * (1 - frac)) + ((data[left + 1] ?? 0) * frac);
    }
    mixed /= Math.max(1, sourceBuffer.numberOfChannels);
    const ms = (index / rate) * 1000;
    const remainingMs = ((outputLength - index) / rate) * 1000;
    const fadeIn = track.settings.fadeInMs > 0 ? clamp(curvePoint(track.settings.fadeInCurve, ms / track.settings.fadeInMs), 0, 1) : 1;
    const fadeOut = track.settings.fadeOutMs > 0 ? clamp(curvePoint(track.settings.fadeOutCurve, remainingMs / track.settings.fadeOutMs), 0, 1) : 1;
    output[index] = mixed * Math.min(fadeIn, fadeOut) * clamp(track.settings.volume, 0, 1.5);
  }
  return encodeWav(output, rate);
}

export async function renderPatternDryWav(tracks: SequencerTrack[], bpm: number) {
  const stepCount = Math.max(1, ...tracks.map((track) => track.steps.length || 0));
  const sampleRate = 44100;
  const stepSeconds = 60 / Math.max(1, bpm) / 4;
  const output = new Float32Array(Math.ceil((stepCount * stepSeconds + 8) * sampleRate));
  const hasSolo = tracks.some((track) => track.settings.solo);
  for (const track of tracks) {
    if (!track.assignedSample || track.settings.mute || (hasSolo && !track.settings.solo)) continue;
    let buffer: AudioBuffer;
    try {
      const response = await fetch(track.assignedSample.path);
      if (!response.ok) continue;
      const context = new OfflineAudioContext(1, 1, sampleRate);
      buffer = await context.decodeAudioData(await response.arrayBuffer());
    } catch { continue; }
    const events = track.mode === "sliced" ? (track.slices ?? []).flatMap((slice) => (track.sliceSteps?.[slice.id] ?? []).map((step, stepIndex) => ({ step, stepIndex, slice })).filter((event) => event.step?.active)) : track.steps.map((step, stepIndex) => ({ step, stepIndex, slice: undefined })).filter((event) => event.step?.active);
    for (const event of events) {
      const stepIndex = event.stepIndex;
      const startOut = Math.floor(stepIndex * stepSeconds * sampleRate);
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
        const ms = (index / sampleRate) * 1000; const remainingMs = ((length - index) / sampleRate) * 1000; const fadeInMs = event.slice?.attackMs ?? event.slice?.fadeInMs ?? track.settings.fadeInMs; const fadeOutMs = event.slice?.fadeOutMs ?? track.settings.fadeOutMs; const fade = Math.min(fadeInMs > 0 ? clamp(ms / fadeInMs, 0, 1) : 1, fadeOutMs > 0 ? clamp(remainingMs / fadeOutMs, 0, 1) : 1);
        mixed = (mixed / Math.max(1, buffer.numberOfChannels)) * clamp(track.settings.volume, 0, 1.5) * fade;
        output[startOut + index] = clamp((output[startOut + index] ?? 0) + mixed, -1, 1);
      }
    }
  }
  let last = output.length - 1;
  while (last > 0 && Math.abs(output[last]) < 0.0001) last -= 1;
  return encodeWav(output.slice(0, Math.max(sampleRate, last + 1)), sampleRate);
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
