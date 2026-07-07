"use client";

import { useEffect, useRef, useState } from "react";
import { loadSampleAudioBuffer } from "@/lib/sampleLoader";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { Sample, TrackSettings } from "@/types";

export type WaveformMode = "original" | "processed" | "overlay";
type Props = { sample?: Sample; settings?: Partial<TrackSettings>; playheadMs?: number; processed?: boolean; mode?: WaveformMode; };
export type Peak = { min: number; max: number };
type WaveformState = { status: "idle" | "loading" | "ready" | "unavailable" | "decode-error"; peaks: Peak[]; durationMs: number; };

const BAR_COUNT = 320;
const peakCache = new Map<string, { peaks: Peak[]; durationMs: number }>();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function downsample(buffer: AudioBuffer, barCount = BAR_COUNT) {
  const length = buffer.length;
  const samplesPerBar = Math.max(1, Math.floor(length / barCount));
  return Array.from({ length: barCount }, (_, bar) => {
    const start = bar * samplesPerBar;
    const end = Math.min(length, start + samplesPerBar);
    let min = 1; let max = -1;
    for (let index = start; index < end; index += 1) {
      let sample = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) sample += buffer.getChannelData(channel)[index] ?? 0;
      sample /= Math.max(1, buffer.numberOfChannels);
      min = Math.min(min, sample); max = Math.max(max, sample);
    }
    return { min, max };
  });
}
function curvePoint(curve: TrackSettings["fadeInCurve"] = "linear", t: number) { return curve === "easeIn" ? t * t : curve === "easeOut" ? 1 - ((1 - t) * (1 - t)) : curve === "exponential" ? Math.pow(t, 3) : t; }
function processPeaks(peaks: Peak[], durationMs: number, settings?: Partial<TrackSettings>) {
  if (!settings) return peaks;
  const start = clamp((settings.startOffsetMs ?? 0) / Math.max(1, durationMs), 0, 1);
  const end = clamp(1 - ((settings.endTrimMs ?? 0) / Math.max(1, durationMs)), start, 1);
  const gain = clamp(settings.volume ?? 1, 0, 1.5);
  const fadeIn = (settings.fadeInMs ?? 0) / Math.max(1, durationMs);
  const fadeOut = (settings.fadeOutMs ?? 0) / Math.max(1, durationMs);
  return peaks.map((peak, index) => {
    const pos = peaks.length <= 1 ? 0 : index / (peaks.length - 1);
    if (pos < start || pos > end) return { min: 0, max: 0 };
    const inLocal = pos - start;
    const outLocal = end - pos;
    const fadeInAmp = fadeIn > 0 ? clamp(curvePoint(settings.fadeInCurve, inLocal / fadeIn), 0, 1) : 1;
    const fadeOutAmp = fadeOut > 0 ? clamp(curvePoint(settings.fadeOutCurve, outLocal / fadeOut), 0, 1) : 1;
    const amp = Math.min(fadeInAmp, fadeOutAmp) * gain;
    return { min: clamp(peak.min * amp, -1, 1), max: clamp(peak.max * amp, -1, 1) };
  });
}

export default function SampleWaveform({ sample, settings, playheadMs, processed = false, mode = "original" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<WaveformState>({ status: "idle", peaks: [], durationMs: 0 });

  useEffect(() => {
    if (!sample?.path) { setWaveform({ status: "idle", peaks: [], durationMs: 0 }); return; }
    let cancelled = false;
    const activeSample = sample;
    const samplePath = normalizeSamplePath(activeSample.path);
    async function loadWaveform() {
      const cached = peakCache.get(samplePath);
      if (cached) { setWaveform({ status: "ready", ...cached }); return; }
      setWaveform({ status: "loading", peaks: [], durationMs: 0 });
      try {
        const loaded = await loadSampleAudioBuffer(activeSample);
        const decoded = { peaks: downsample(loaded.audioBuffer), durationMs: loaded.audioBuffer.duration * 1000 };
        peakCache.set(samplePath, decoded);
        if (!cancelled) setWaveform({ status: "ready", ...decoded });
      } catch (error) { if (!cancelled) setWaveform({ status: error instanceof Error && error.message.startsWith("Could not fetch") ? "unavailable" : "decode-error", peaks: [], durationMs: 0 }); }
    }
    void loadWaveform();
    return () => { cancelled = true; };
  }, [sample?.path]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.status !== "ready") return;
    const context = canvas.getContext("2d"); if (!context) return;
    const width = canvas.clientWidth * window.devicePixelRatio; const height = canvas.clientHeight * window.devicePixelRatio;
    const styles = getComputedStyle(canvas);
    canvas.width = width; canvas.height = height; context.clearRect(0, 0, width, height); context.fillStyle = styles.getPropertyValue("--color-panel-2").trim() || "#050507"; context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,.18)"; context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
    const processedPeaks = processPeaks(waveform.peaks, waveform.durationMs, settings);
    const draw = (peaks: Peak[], color: string, alpha: number) => { const barWidth = width / peaks.length; context.globalAlpha = alpha; context.fillStyle = color; peaks.forEach((peak, index) => { const x = index * barWidth; const y = height / 2 + peak.min * height * 0.43; const barHeight = Math.max(1, (peak.max - peak.min) * height * 0.43); context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight); }); context.globalAlpha = 1; };
    const original = styles.getPropertyValue("--color-waveform-original").trim() || "#2dd4ff";
    const edited = styles.getPropertyValue("--color-waveform-processed").trim() || "#facc15";
    if (processed && mode === "overlay") { draw(waveform.peaks, original, .55); draw(processedPeaks, edited, .72); }
    else if (processed && mode === "processed") draw(processedPeaks, edited, .9);
    else draw(waveform.peaks, original, .85);
  }, [waveform, settings, processed, mode]);

  const durationMs = Math.max(waveform.durationMs, 1);
  const startPercent = clamp(((settings?.startOffsetMs ?? 0) / durationMs) * 100, 0, 100);
  const endPercent = clamp(100 - (((settings?.endTrimMs ?? 0) / durationMs) * 100), 0, 100);
  const fadeInPercent = clamp(((settings?.fadeInMs ?? 0) / durationMs) * 100, 0, 100);
  const fadeOutPercent = clamp(((settings?.fadeOutMs ?? 0) / durationMs) * 100, 0, 100);
  const message = waveform.status === "loading" ? "Loading waveform…" : waveform.status === "unavailable" ? "Waveform unavailable" : waveform.status === "decode-error" ? "Could not decode sample" : !sample ? "Choose a sample to see its waveform" : "";
  return <div className="sample-waveform" aria-label="Real sample waveform preview">{waveform.status === "ready" ? <canvas ref={canvasRef} className="sample-waveform-canvas" /> : <div className="waveform-message">{message}</div>}{waveform.status === "ready" && <><div className="fade-region fade-in" style={{ left: `${startPercent}%`, width: `${fadeInPercent}%` }} /><div className="fade-region fade-out" style={{ left: `${Math.max(startPercent, endPercent - fadeOutPercent)}%`, width: `${fadeOutPercent}%` }} /><svg className="fade-curves" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={`0,100 ${Array.from({ length: 12 }, (_, i) => `${(fadeInPercent / 11) * i},${100 - curvePoint(settings?.fadeInCurve, i / 11) * 100}`).join(" ")}`} /><polyline points={Array.from({ length: 12 }, (_, i) => `${endPercent - fadeOutPercent + (fadeOutPercent / 11) * i},${curvePoint(settings?.fadeOutCurve, i / 11) * 100}`).join(" ")} /></svg>{playheadMs !== undefined && <div className="playhead-marker" style={{ left: `${clamp((playheadMs / durationMs) * 100, 0, 100)}%` }}><span>Play</span></div>}<div className="trim-marker start-marker" style={{ left: `${startPercent}%` }}><span>Start</span></div><div className="trim-marker end-marker" style={{ left: `${endPercent}%` }}><span>End</span></div></>}</div>;
}
