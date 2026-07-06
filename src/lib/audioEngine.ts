import * as Tone from "tone";
import type { Sample } from "@/types";

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

export function stopTransport() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export { Tone };
