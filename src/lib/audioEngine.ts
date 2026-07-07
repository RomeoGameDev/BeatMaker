import * as Tone from "tone";
import { createToneEffectNodes } from "@/lib/effects";
import { semitoneDiff } from "@/lib/musicTheory";
import { loadSampleAudioBuffer, SampleLoadError } from "@/lib/sampleLoader";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { GuitarLabEffects, GuitarLabMode, NoteDuration, Sample, TrackEffect, TrackSettings } from "@/types";

const players = new Map<string, Tone.Player>();
const activePlayers = new Set<Tone.Player>();
const activeNodes = new Set<Tone.ToneAudioNode>();
const activeDisposals = new Set<ReturnType<typeof globalThis.setTimeout>>();
const fallbackPreviewElements = new Set<HTMLAudioElement>();

function disposeActivePlayer(player: Tone.Player | undefined, nodes: Tone.ToneAudioNode[] = []) {
  if (!player) return;
  try { player.stop(); } catch {}
  try { player.dispose(); } catch {}
  activePlayers.delete(player);
  nodes.forEach((node) => { try { node.dispose(); } catch {} activeNodes.delete(node); });
}

type OneShotStatus =
  | "playing"
  | "missing"
  | "not-loaded"
  | "start-after-end"
  | "invalid-duration"
  | "error"
  | "preview-fallback"
  | "decode-failed";

export type OneShotResult = {
  ok: boolean;
  status: OneShotStatus;
  message: string;
};

const oneShotResult = (ok: boolean, status: OneShotStatus, message: string): OneShotResult => ({ ok, status, message });
const isDevelopment = process.env.NODE_ENV !== "production";

function sampleDebug(sample: Sample, normalizedUrl: string) {
  return { id: sample.id, type: sample.type, category: sample.category, path: sample.path, normalizedUrl };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function sanitizeSettings(settings: TrackSettings) {
  return {
    startOffsetMs: clamp(settings.startOffsetMs, 0, Number.MAX_SAFE_INTEGER),
    endTrimMs: clamp(settings.endTrimMs, 0, Number.MAX_SAFE_INTEGER),
    fadeInMs: clamp(settings.fadeInMs, 0, Number.MAX_SAFE_INTEGER),
    fadeOutMs: clamp(settings.fadeOutMs, 0, Number.MAX_SAFE_INTEGER),
    volume: clamp(settings.volume, 0, 1.5),
    pitchSemitones: clamp(settings.pitchSemitones, -24, 24)
  };
}

export async function startAudio() {
  await Tone.start();
}

export function setBpm(bpm: number) {
  Tone.Transport.bpm.value = bpm;
}

export function getSamplePlayer(sample: Sample) {
  let player = players.get(sample.id);

  if (!player) {
    player = new Tone.Player({ url: normalizeSamplePath(sample.path), autostart: false }).toDestination();
    players.set(sample.id, player);
  }

  return player;
}

export async function playSample(sample: Sample) {
  await startAudio();
  const result = await triggerOneShot(sample, {
    startOffsetMs: 0,
    endTrimMs: 0,
    fadeInMs: 0,
    fadeOutMs: 5,
    fadeInCurve: "linear",
    fadeOutCurve: "linear",
    volume: 1,
    mute: false,
    solo: false,
    pitchSemitones: 0
  }, Tone.now());
  if (result.status === "decode-failed") return playHtmlAudioFallback(sample);
  return result;
}

export async function playHtmlAudioFallback(sample: Sample): Promise<OneShotResult> {
  if (!sample.path) return oneShotResult(false, "missing", "Sample file missing or unsupported.");
  const audio = new Audio(normalizeSamplePath(sample.path));
  audio.preload = "auto";
  fallbackPreviewElements.add(audio);
  const cleanup = () => fallbackPreviewElements.delete(audio);
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("pause", cleanup, { once: true });
  try {
    await audio.play();
    return oneShotResult(true, "preview-fallback", "Preview playing with browser audio fallback. Convert to PCM WAV for sequencing/editing.");
  } catch (error) {
    cleanup();
    console.warn("HTML audio fallback preview failed.", { sample, error });
    return oneShotResult(false, "error", "Found, but neither WebAudio nor browser audio preview could play it. Convert to PCM WAV for editing.");
  }
}

export async function triggerSample(sample: Sample | undefined, settings: TrackSettings, time: Tone.Unit.Time = Tone.now(), effects: TrackEffect[] = [], maxDurationSeconds?: number): Promise<OneShotResult & { player?: Tone.Player }> {
  if (!sample?.path) {
    const result = oneShotResult(false, "missing", "Sample file missing or unsupported.");
    console.warn(result.message, { sample });
    return result;
  }

  const safeSettings = sanitizeSettings(settings);
  let player: Tone.Player | undefined;
  let tempNodes: Tone.ToneAudioNode[] = [];

  try {
    await startAudio();

    // TODO: Optimize later with Tone.Players or decoded buffer caching. For now,
    // each hit gets a fresh Player so fast clicks and overlapping steps cannot
    // reuse a started/stopped source in an unsafe way.
    const sampleUrl = normalizeSamplePath(sample.path);
    if (isDevelopment) console.debug("Loading sample", sampleDebug(sample, sampleUrl));

    player = new Tone.Player({ autostart: false });
    try {
      const loaded = await loadSampleAudioBuffer(sample);
      player.buffer.set(loaded.audioBuffer);
    } catch (loadError) {
      disposeActivePlayer(player);
      const status = loadError instanceof SampleLoadError ? loadError.status : "error";
      const resultStatus = status === "fetch failed" ? "missing" : status === "decode failed" ? "decode-failed" : "error";
      const message = status === "decode failed" ? "Skipped hit: sample can preview with browser audio, but cannot be sequenced/edited until converted to PCM WAV." : loadError instanceof Error ? loadError.message : `Could not load ${sampleUrl}`;
      return oneShotResult(false, resultStatus, message);
    }

    if (!player.buffer.loaded) {
      disposeActivePlayer(player);
      const result = oneShotResult(false, "not-loaded", "Sample not loaded yet, try again.");
      console.warn(result.message, { sample });
      return result;
    }

    const bufferDuration = player.buffer.duration;
    const startOffsetSeconds = safeSettings.startOffsetMs / 1000;
    const endTrimSeconds = safeSettings.endTrimMs / 1000;

    if (startOffsetSeconds >= bufferDuration) {
      disposeActivePlayer(player);
      const result = oneShotResult(false, "start-after-end", "Skipped hit: start offset is beyond sample length.");
      console.warn(result.message, { sample, startOffsetSeconds, bufferDuration });
      return result;
    }

    const rawDuration = bufferDuration - startOffsetSeconds - endTrimSeconds;
    const duration = maxDurationSeconds && maxDurationSeconds > 0 ? Math.min(rawDuration, maxDurationSeconds) : rawDuration;
    if (duration <= 0) {
      disposeActivePlayer(player);
      const result = oneShotResult(false, "invalid-duration", "Skipped hit: start offset is beyond sample length.");
      console.warn(result.message, { sample, startOffsetSeconds, endTrimSeconds, bufferDuration });
      return result;
    }

    const trackGain = new Tone.Gain(safeSettings.volume);
    tempNodes = [trackGain];
    try {
      tempNodes.push(...createToneEffectNodes(effects));
      player.chain(...tempNodes, Tone.getDestination());
    } catch (routingError) {
      tempNodes.forEach((node) => { try { node.dispose(); } catch {} activeNodes.delete(node); });
      tempNodes = [];
      player.toDestination();
      player.volume.value = safeSettings.volume <= 0 ? -Infinity : Tone.gainToDb(safeSettings.volume);
      console.warn("FX chain failed; playing dry sample.", routingError);
    }
    player.fadeIn = safeSettings.fadeInMs / 1000;
    player.fadeOut = safeSettings.fadeOutMs / 1000;
    // TODO: Custom fade curve audio automation will be implemented later.
    player.playbackRate = Math.pow(2, safeSettings.pitchSemitones / 12);

    const startTime = typeof time === "number" && time < Tone.now() ? Tone.now() : time;
    activePlayers.add(player);
    tempNodes.forEach((node) => activeNodes.add(node));
    player.start(startTime, startOffsetSeconds, duration);
    const disposalDelayMs = ((duration / player.playbackRate) + player.fadeOut + 0.25) * 1000;
    const timeoutId = globalThis.setTimeout(() => { activeDisposals.delete(timeoutId); disposeActivePlayer(player, tempNodes); }, Math.max(250, disposalDelayMs));
    activeDisposals.add(timeoutId);

    return { ...oneShotResult(true, "playing", "Playing."), player };
  } catch (error) {
    disposeActivePlayer(player, tempNodes);
    const sampleUrl = sample?.path ? normalizeSamplePath(sample.path) : "sample";
    const result = oneShotResult(false, "error", `Could not load ${sampleUrl}`);
    console.warn(result.message, { sample, error });
    return result;
  }
}

export async function previewPitchedNotes({ sample, rootNote, notes, mode, bpm, noteDuration, settings, effects }: { sample?: Sample; rootNote: string; notes: string[]; mode: GuitarLabMode; bpm: number; noteDuration: NoteDuration; settings?: Partial<TrackSettings>; effects?: GuitarLabEffects; }): Promise<OneShotResult> {
  if (!sample) return oneShotResult(false, "missing", "Select a source sample to preview or render chords.");
  if (!notes.length) return oneShotResult(false, "missing", "Select at least one note to preview.");
  const stepSeconds = (60 / Math.max(1, bpm)) * ({ "1/4": 1, "1/8": 0.5, "1/16": 0.25 }[noteDuration] ?? 0.5);
  const baseSettings: TrackSettings = {
    startOffsetMs: 0, endTrimMs: 0, fadeInMs: 2, fadeOutMs: 12, fadeInCurve: "linear", fadeOutCurve: "linear",
    volume: effects?.volume ?? 1, mute: false, solo: false, pitchSemitones: effects?.pitchOffsetSemitones ?? 0, ...settings
  };
  const fx: TrackEffect[] = [
    effects?.reverbWet ? { id: "guitar-lab-reverb", type: "reverb", name: "Guitar Lab Reverb", enabled: true, params: { wet: effects.reverbWet, decay: 1.5 } } : undefined,
    effects?.delayWet ? { id: "guitar-lab-delay", type: "delay", name: "Guitar Lab Delay", enabled: true, params: { wet: effects.delayWet, delayTime: "8n", feedback: 0.25 } } : undefined,
    effects?.drive ? { id: "guitar-lab-drive", type: "distortion", name: "Guitar Lab Drive", enabled: true, params: { wet: Math.min(1, effects.drive), distortion: effects.drive } } : undefined,
    effects?.chorusWet ? { id: "guitar-lab-chorus", type: "chorus", name: "Guitar Lab Chorus", enabled: true, params: { wet: effects.chorusWet } } : undefined
  ].filter(Boolean) as TrackEffect[];
  try {
    await startAudio();
    const now = Tone.now() + 0.03;
    const results = await Promise.all(notes.map((note, index) => triggerSample(sample, { ...baseSettings, pitchSemitones: (baseSettings.pitchSemitones || 0) + semitoneDiff(rootNote, note) }, now + (mode === "riff" ? index * stepSeconds : 0), fx, mode === "riff" ? stepSeconds * 0.95 : undefined)));
    const failed = results.find((result) => !result.ok);
    return failed ?? oneShotResult(true, "playing", mode === "riff" ? "Riff preview playing." : "Chord preview playing.");
  } catch (error) {
    console.warn("Guitar Lab preview failed.", error);
    return oneShotResult(false, "error", "Could not preview Guitar Lab notes.");
  }
}

export function stopTransport() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export function stopAllAudio() {
  try { Tone.Transport.stop(); } catch {}
  try { Tone.Transport.cancel(); } catch {}
  activeDisposals.forEach((id) => { try { globalThis.clearTimeout(id); } catch {} });
  activeDisposals.clear();
  Array.from(activePlayers).forEach((player) => disposeActivePlayer(player));
  activePlayers.clear();
  Array.from(activeNodes).forEach((node) => { try { node.dispose(); } catch {} });
  activeNodes.clear();
  Array.from(fallbackPreviewElements).forEach((audio) => { try { audio.pause(); audio.currentTime = 0; audio.src = ""; audio.load(); } catch {} });
  fallbackPreviewElements.clear();
}

export { Tone };

export const triggerOneShot = triggerSample;
