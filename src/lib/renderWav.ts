import type { SequencerTrack, TrackSettings } from "@/types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function curvePoint(curve: TrackSettings["fadeInCurve"], t: number) {
  return curve === "easeIn" ? t * t : curve === "easeOut" ? 1 - (1 - t) * (1 - t) : curve === "exponential" ? Math.pow(t, 3) : t;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
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
  const sourceBuffer = await context.decodeAudioData(await response.arrayBuffer());
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
