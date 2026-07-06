import * as Tone from "tone";
import { createToneEffectNodes } from "@/lib/effects";
import type { Sample, TrackEffect, TrackSettings } from "@/types";

const players = new Map<string, Tone.Player>();

type OneShotStatus =
  | "playing"
  | "missing"
  | "not-loaded"
  | "start-after-end"
  | "invalid-duration"
  | "error";

export type OneShotResult = {
  ok: boolean;
  status: OneShotStatus;
  message: string;
};

const oneShotResult = (ok: boolean, status: OneShotStatus, message: string): OneShotResult => ({ ok, status, message });
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
    player = new Tone.Player({ url: sample.path, autostart: false }).toDestination();
    players.set(sample.id, player);
  }

  return player;
}

export async function playSample(sample: Sample) {
  await startAudio();
  return triggerOneShot(sample, {
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
}

export async function triggerSample(sample: Sample | undefined, settings: TrackSettings, time: Tone.Unit.Time = Tone.now(), effects: TrackEffect[] = []): Promise<OneShotResult> {
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
    player = new Tone.Player({ autostart: false });
    await player.load(sample.path);

    if (!player.buffer.loaded) {
      player.dispose();
      const result = oneShotResult(false, "not-loaded", "Sample not loaded yet, try again.");
      console.warn(result.message, { sample });
      return result;
    }

    const bufferDuration = player.buffer.duration;
    const startOffsetSeconds = safeSettings.startOffsetMs / 1000;
    const endTrimSeconds = safeSettings.endTrimMs / 1000;

    if (startOffsetSeconds >= bufferDuration) {
      player.dispose();
      const result = oneShotResult(false, "start-after-end", "Skipped hit: start offset is beyond sample length.");
      console.warn(result.message, { sample, startOffsetSeconds, bufferDuration });
      return result;
    }

    const duration = bufferDuration - startOffsetSeconds - endTrimSeconds;
    if (duration <= 0) {
      player.dispose();
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
      tempNodes.forEach((node) => node.dispose());
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
    player.start(startTime, startOffsetSeconds, duration);
    const disposalDelayMs = ((duration / player.playbackRate) + player.fadeOut + 0.25) * 1000;
    globalThis.setTimeout(() => { player?.dispose(); tempNodes.forEach((node) => node.dispose()); }, Math.max(250, disposalDelayMs));

    return oneShotResult(true, "playing", "Playing.");
  } catch (error) {
    player?.dispose();
    tempNodes.forEach((node) => node.dispose());
    const result = oneShotResult(false, "error", "Sample file missing or unsupported.");
    console.warn(result.message, { sample, error });
    return result;
  }
}

export function stopTransport() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export { Tone };

export const triggerOneShot = triggerSample;
