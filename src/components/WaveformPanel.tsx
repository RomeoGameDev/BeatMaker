"use client";

import { useState } from "react";
import SampleWaveform, { WaveformMode } from "@/components/SampleWaveform";
import { defaultTrackSettings } from "@/components/StepSequencer";
import type { FadeCurve, Sample, TrackSettings } from "@/types";

type Props = { samples: Sample[]; onPreviewOriginal: (sample: Sample) => void; onStatus: (message: string) => void; };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const editorDefaults = { ...defaultTrackSettings, fadeOutMs: 0 };
const controls: { key: keyof Pick<TrackSettings, "startOffsetMs" | "endTrimMs" | "fadeInMs" | "fadeOutMs" | "volume" | "pitchSemitones">; label: string; min: number; max: number; step: number; format: (value: number) => string; }[] = [
  { key: "startOffsetMs", label: "Start Offset", min: 0, max: 2000, step: 1, format: (v) => `${v} ms` },
  { key: "endTrimMs", label: "End Trim", min: 0, max: 2000, step: 1, format: (v) => `${v} ms` },
  { key: "fadeInMs", label: "Fade In", min: 0, max: 2000, step: 1, format: (v) => `${v} ms` },
  { key: "fadeOutMs", label: "Fade Out", min: 0, max: 2000, step: 1, format: (v) => `${v} ms` },
  { key: "volume", label: "Gain", min: 0, max: 1.5, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { key: "pitchSemitones", label: "Pitch", min: -24, max: 24, step: 1, format: (v) => `${v} st` }
];

async function decodeSample(sample: Sample) {
  const response = await fetch(sample.path);
  const data = await response.arrayBuffer();
  const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const context = new Context();
  const buffer = await context.decodeAudioData(data.slice(0));
  await context.close();
  return buffer;
}
function curve(curveName: FadeCurve, t: number) { return curveName === "easeIn" ? t * t : curveName === "easeOut" ? 1 - ((1 - t) * (1 - t)) : curveName === "exponential" ? Math.pow(t, 3) : t; }
function audioBufferToWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels; const sampleRate = buffer.sampleRate; const length = buffer.length * channels * 2 + 44; const ab = new ArrayBuffer(length); const view = new DataView(ab);
  const write = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, length - 8, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length - 44, true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) for (let ch = 0; ch < channels; ch += 1) { const s = clamp(buffer.getChannelData(ch)[i] ?? 0, -1, 1); view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); offset += 2; }
  return new Blob([ab], { type: "audio/wav" });
}
async function renderEdited(sample: Sample, settings: TrackSettings) {
  const source = await decodeSample(sample);
  const start = Math.floor((settings.startOffsetMs / 1000) * source.sampleRate);
  const endTrim = Math.floor((settings.endTrimMs / 1000) * source.sampleRate);
  const length = Math.max(1, source.length - start - endTrim);
  const output = new AudioContext().createBuffer(source.numberOfChannels, length, source.sampleRate);
  for (let ch = 0; ch < output.numberOfChannels; ch += 1) {
    const input = source.getChannelData(ch); const dest = output.getChannelData(ch); const fadeIn = Math.floor((settings.fadeInMs / 1000) * source.sampleRate); const fadeOut = Math.floor((settings.fadeOutMs / 1000) * source.sampleRate);
    for (let i = 0; i < length; i += 1) { const fadeInAmp = fadeIn > 0 ? curve(settings.fadeInCurve, Math.min(1, i / fadeIn)) : 1; const fadeOutAmp = fadeOut > 0 ? curve(settings.fadeOutCurve, Math.min(1, (length - i) / fadeOut)) : 1; dest[i] = clamp((input[start + i] ?? 0) * settings.volume * Math.min(fadeInAmp, fadeOutAmp), -1, 1); }
  }
  return output;
}

export default function WaveformPanel({ samples, onPreviewOriginal, onStatus }: Props) {
  const [sampleId, setSampleId] = useState(samples[0]?.id ?? "");
  const [settings, setSettings] = useState<TrackSettings>(editorDefaults);
  const [mode, setMode] = useState<WaveformMode>("overlay");
  const sample = samples.find((item) => item.id === sampleId);
  const update = (patch: Partial<TrackSettings>) => setSettings((old) => ({ ...old, ...patch }));
  async function previewEdited() {
    if (!sample) return;
    const buffer = await renderEdited(sample, settings);
    const ctx = new AudioContext(); const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = Math.pow(2, settings.pitchSemitones / 12); source.connect(ctx.destination); source.start(); onStatus(`Previewing edited ${sample.name}.`);
  }
  async function download() {
    if (!sample) return;
    const buffer = await renderEdited(sample, settings); const blob = audioBufferToWav(buffer); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${sample.filename.replace(/\.[^.]+$/, "")}_edited.wav`; a.click(); URL.revokeObjectURL(url); onStatus("Downloaded edited WAV. Browser download only; project sample folder is unchanged.");
  }
  return <div className="sample-editor"><div className="track-control-header"><div><p className="eyebrow">Independent Sample Editor</p><h3>{sample?.name ?? "Choose a sample"}</h3><small>Edits are non-destructive and separate from Track Controls.</small></div><label className="field-label">Sample<select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>{samples.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>{sample && <><div className="nudge-row"><button type="button" onClick={() => onPreviewOriginal(sample)}>Preview Original</button><button type="button" onClick={() => void previewEdited()}>Preview Edited</button><button type="button" onClick={() => setSettings(editorDefaults)}>Reset Editor</button><button type="button" onClick={() => void download()}>Download Edited WAV</button><button type="button" disabled>Save to project · coming soon</button></div><div className="nudge-row waveform-modes">{(["original", "processed", "overlay"] as WaveformMode[]).map((item) => <button type="button" className={mode === item ? "active-filter" : ""} key={item} onClick={() => setMode(item)}>{item === "original" ? "Original" : item === "processed" ? "Processed" : "Overlay"}</button>)}</div><SampleWaveform sample={sample} settings={settings} processed mode={mode} /><div className="slider-stack">{controls.map((control) => <label className="slider-control" key={control.key}><span className="slider-label"><strong>{control.label}</strong><em>{control.format(Number(settings[control.key]))}</em></span><input type="range" min={control.min} max={control.max} step={control.step} value={Number(settings[control.key])} onChange={(event) => update({ [control.key]: Number(event.target.value) } as Partial<TrackSettings>)} /><input type="number" min={control.min} max={control.max} step={control.step} value={Number(settings[control.key])} onChange={(event) => update({ [control.key]: Number(event.target.value) } as Partial<TrackSettings>)} /></label>)}</div><div className="control-grid"><label>Fade In Curve<select value={settings.fadeInCurve} onChange={(event) => update({ fadeInCurve: event.target.value as FadeCurve })}>{["linear", "easeIn", "easeOut", "exponential"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Fade Out Curve<select value={settings.fadeOutCurve} onChange={(event) => update({ fadeOutCurve: event.target.value as FadeCurve })}>{["linear", "easeIn", "easeOut", "exponential"].map((item) => <option key={item}>{item}</option>)}</select></label></div><p className="hint">Processed waveform is a visual approximation for trim, fade, and gain. Pitch affects preview playback; exact pitch-stretched waveform rendering is TODO.</p></>}</div>;
}
