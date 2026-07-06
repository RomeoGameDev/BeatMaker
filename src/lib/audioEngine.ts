import * as Tone from "tone";
import type { Sample, TrackSettings } from "@/types";

const players = new Map<string, Tone.Player>();

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
  const player = getSamplePlayer(sample);
  await Tone.loaded();
  player.start();
}

export function triggerOneShot(sample: Sample, settings: TrackSettings, time: Tone.Unit.Time) {
  const player = getSamplePlayer(sample);
  const startOffsetSeconds = Math.max(0, settings.startOffsetMs / 1000);
  const fadeOutSeconds = Math.max(0, settings.fadeOutMs / 1000);

  player.volume.value = settings.volume <= 0 ? -Infinity : Tone.gainToDb(settings.volume);
  player.fadeIn = Math.max(0, settings.fadeInMs / 1000);
  player.fadeOut = fadeOutSeconds;
  player.playbackRate = Math.pow(2, settings.pitchSemitones / 12);

  const bufferDuration = player.buffer.loaded ? player.buffer.duration : 0;
  const duration = bufferDuration > startOffsetSeconds
    ? Math.max(0.01, bufferDuration - startOffsetSeconds - Math.max(0, settings.endTrimMs / 1000))
    : undefined;

  player.start(time, startOffsetSeconds, duration);
}

export function stopTransport() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export { Tone };
