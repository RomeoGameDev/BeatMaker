"use client";

import { useEffect, useRef, useState } from "react";
import type { Sample, TrackSettings } from "@/types";

type Props = { sample?: Sample; settings?: TrackSettings; };
type WaveformState = { status: "idle" | "loading" | "ready" | "unavailable" | "decode-error"; peaks: number[]; durationMs: number; };

const BAR_COUNT = 160;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function downsample(channelData: Float32Array) {
  const samplesPerBar = Math.max(1, Math.floor(channelData.length / BAR_COUNT));
  return Array.from({ length: BAR_COUNT }, (_, bar) => {
    const start = bar * samplesPerBar;
    const end = Math.min(channelData.length, start + samplesPerBar);
    let peak = 0;
    for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(channelData[index]));
    return peak;
  });
}

export default function SampleWaveform({ sample, settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<WaveformState>({ status: "idle", peaks: [], durationMs: 0 });

  useEffect(() => {
    if (!sample?.path) { setWaveform({ status: "idle", peaks: [], durationMs: 0 }); return; }
    let cancelled = false;
    const samplePath = sample.path;
    async function loadWaveform() {
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
        if (!cancelled) setWaveform({ status: "ready", peaks: downsample(audioBuffer.getChannelData(0)), durationMs: audioBuffer.duration * 1000 });
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
    const barWidth = width / waveform.peaks.length;
    waveform.peaks.forEach((peak, index) => {
      const barHeight = Math.max(2, peak * height * 0.86);
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      const gradient = context.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, "#f0b6ff"); gradient.addColorStop(.5, "#a855f7"); gradient.addColorStop(1, "#4c1d95");
      context.fillStyle = gradient;
      context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [waveform]);

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
        <div className="fade-region fade-in" style={{ width: `${fadeInPercent}%` }} />
        <div className="fade-region fade-out" style={{ width: `${fadeOutPercent}%` }} />
        <div className="trim-marker start-marker" style={{ left: `${startPercent}%` }}><span>Start</span></div>
        <div className="trim-marker end-marker" style={{ left: `${endPercent}%` }}><span>End</span></div>
      </>}
    </div>
  );
}
