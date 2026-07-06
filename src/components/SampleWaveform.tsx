"use client";

import { useEffect, useRef, useState } from "react";
import type { Sample, TrackSettings } from "@/types";

type Props = { sample?: Sample; settings?: TrackSettings; playheadMs?: number; };
type Peak = { min: number; max: number };
type WaveformState = { status: "idle" | "loading" | "ready" | "unavailable" | "decode-error"; peaks: Peak[]; durationMs: number; };

const BAR_COUNT = 320;
const peakCache = new Map<string, { peaks: Peak[]; durationMs: number }>();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function downsample(buffer: AudioBuffer) {
  const length = buffer.length;
  const samplesPerBar = Math.max(1, Math.floor(length / BAR_COUNT));
  return Array.from({ length: BAR_COUNT }, (_, bar) => {
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
function curvePoint(curve: TrackSettings["fadeInCurve"], t: number) { return curve === "easeIn" ? t * t : curve === "easeOut" ? 1 - ((1 - t) * (1 - t)) : curve === "exponential" ? Math.pow(t, 3) : t; }

export default function SampleWaveform({ sample, settings, playheadMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<WaveformState>({ status: "idle", peaks: [], durationMs: 0 });

  useEffect(() => {
    if (!sample?.path) { setWaveform({ status: "idle", peaks: [], durationMs: 0 }); return; }
    let cancelled = false;
    const samplePath = sample.path;
    async function loadWaveform() {
      const cached = peakCache.get(samplePath);
      if (cached) { setWaveform({ status: "ready", ...cached }); return; }
      setWaveform({ status: "loading", peaks: [], durationMs: 0 });
      try {
        const response = await fetch(samplePath);
        if (!response.ok) { if (!cancelled) setWaveform({ status: "unavailable", peaks: [], durationMs: 0 }); return; }
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) { if (!cancelled) setWaveform({ status: "decode-error", peaks: [], durationMs: 0 }); return; }
        const context = new AudioContextClass();
        const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
        await context.close();
        const decoded = { peaks: downsample(audioBuffer), durationMs: audioBuffer.duration * 1000 };
        peakCache.set(samplePath, decoded);
        if (!cancelled) setWaveform({ status: "ready", ...decoded });
      } catch {
        if (!cancelled) setWaveform({ status: "decode-error", peaks: [], durationMs: 0 });
      }
    }
    void loadWaveform();
    return () => { cancelled = true; };
  }, [sample?.path]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.status !== "ready") return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = canvas.clientWidth * window.devicePixelRatio;
    const height = canvas.clientHeight * window.devicePixelRatio;
    canvas.width = width; canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#050507"; context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,.18)"; context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
    context.fillStyle = "rgba(168,85,247,.10)"; context.fillRect(width * startPercent / 100, 0, width * Math.max(0, endPercent - startPercent) / 100, height);
    const barWidth = width / waveform.peaks.length;
    waveform.peaks.forEach((peak, index) => {
      const x = index * barWidth;
      const y = height / 2 + peak.min * height * 0.43;
      const barHeight = Math.max(2, (peak.max - peak.min) * height * 0.43);
      const gradient = context.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, "#f0b6ff"); gradient.addColorStop(.5, "#a855f7"); gradient.addColorStop(1, "#4c1d95");
      context.fillStyle = gradient;
      context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [waveform, settings]);

  const durationMs = Math.max(waveform.durationMs, 1);
  const startPercent = clamp(((settings?.startOffsetMs ?? 0) / durationMs) * 100, 0, 100);
  const endPercent = clamp(100 - (((settings?.endTrimMs ?? 0) / durationMs) * 100), 0, 100);
  const fadeInPercent = clamp(((settings?.fadeInMs ?? 0) / durationMs) * 100, 0, 100);
  const fadeOutPercent = clamp(((settings?.fadeOutMs ?? 0) / durationMs) * 100, 0, 100);
  const message = waveform.status === "loading" ? "Loading waveform…" : waveform.status === "unavailable" ? "Waveform unavailable" : waveform.status === "decode-error" ? "Could not decode sample" : !sample ? "Assign a sample to see its waveform" : "";

  return (
    <div className="sample-waveform" aria-label="Real sample waveform preview">
      {waveform.status === "ready" ? <canvas ref={canvasRef} className="sample-waveform-canvas" /> : <div className="waveform-message">{message}</div>}
      {waveform.status === "ready" && <>
        <div className="fade-region fade-in" style={{ left: `${startPercent}%`, width: `${fadeInPercent}%` }} />
        <div className="fade-region fade-out" style={{ left: `${Math.max(startPercent, endPercent - fadeOutPercent)}%`, width: `${fadeOutPercent}%` }} />
        <svg className="fade-curves" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={`0,100 ${Array.from({ length: 12 }, (_, i) => `${(fadeInPercent / 11) * i},${100 - curvePoint(settings?.fadeInCurve ?? "linear", i / 11) * 100}`).join(" ")}`} /><polyline points={Array.from({ length: 12 }, (_, i) => `${endPercent - fadeOutPercent + (fadeOutPercent / 11) * i},${curvePoint(settings?.fadeOutCurve ?? "linear", i / 11) * 100}`).join(" ")} /></svg>
        {playheadMs !== undefined && <div className="playhead-marker" style={{ left: `${clamp((playheadMs / durationMs) * 100, 0, 100)}%` }}><span>Play</span></div>}
        <div className="trim-marker start-marker" style={{ left: `${startPercent}%` }}><span>Start</span></div>
        <div className="trim-marker end-marker" style={{ left: `${endPercent}%` }}><span>End</span></div>
      </>}
    </div>
  );
}
