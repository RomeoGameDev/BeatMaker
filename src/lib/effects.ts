import * as Tone from "tone";
import type { EqBand, TrackEffect, TrackEffectType } from "@/types";

export const defaultEq3Bands = (): EqBand[] => [
  { label: "Low", frequencyHz: 120, gainDb: 0, q: 0.7 },
  { label: "Mid", frequencyHz: 1000, gainDb: 0, q: 1 },
  { label: "High", frequencyHz: 8000, gainDb: 0, q: 0.7 }
];
export const defaultEq4Bands = (): EqBand[] => [
  { label: "Low", frequencyHz: 100, gainDb: 0, q: 0.7 },
  { label: "Low Mid", frequencyHz: 500, gainDb: 0, q: 1 },
  { label: "High Mid", frequencyHz: 2500, gainDb: 0, q: 1 },
  { label: "High", frequencyHz: 9000, gainDb: 0, q: 0.7 }
];

const effectNames: Record<TrackEffectType, string> = { eq: "EQ", reverb: "Reverb", overdrive: "Overdrive", distortion: "Distortion", compressor: "Compressor" };
export function makeTrackEffect(type: TrackEffectType): TrackEffect {
  const id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const params: Record<string, unknown> = type === "eq" ? { bandCount: 3, bands: defaultEq3Bands() }
    : type === "reverb" ? { wet: 0.25, decay: 2, preDelay: 0.02 }
    : type === "overdrive" ? { drive: 0.35, tone: 2200, wet: 0.5 }
    : type === "distortion" ? { amount: 0.25, wet: 0.5 }
    : { threshold: -24, ratio: 4, attack: 0.01, release: 0.2, makeupGain: 0 };
  return { id, type, name: effectNames[type], enabled: true, params };
}

const num = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, typeof value === "number" && Number.isFinite(value) ? value : fallback));

export function createToneEffectNodes(effects: TrackEffect[] = []): Tone.ToneAudioNode[] {
  const nodes: Tone.ToneAudioNode[] = [];
  for (const effect of effects.filter((item) => item.enabled)) {
    try {
      if (effect.type === "eq") {
        const bands = Array.isArray(effect.params.bands) ? effect.params.bands as EqBand[] : defaultEq3Bands();
        bands.forEach((band) => nodes.push(new Tone.Filter({ type: "peaking", frequency: num(band.frequencyHz, 1000, 20, 20000), gain: num(band.gainDb, 0, -24, 24), Q: num(band.q, 1, 0.1, 10) })));
      } else if (effect.type === "reverb") {
        nodes.push(new Tone.Reverb({ wet: num(effect.params.wet, 0.25, 0, 1), decay: num(effect.params.decay, 2, 0.1, 10), preDelay: num(effect.params.preDelay, 0.02, 0, 1) }));
      } else if (effect.type === "overdrive") {
        const drive = num(effect.params.drive, 0.35, 0, 1);
        nodes.push(new Tone.Distortion({ distortion: drive * 0.8, wet: num(effect.params.wet, 0.5, 0, 1) }));
        nodes.push(new Tone.Filter({ type: "lowpass", frequency: num(effect.params.tone, 2200, 100, 8000) }));
      } else if (effect.type === "distortion") {
        nodes.push(new Tone.Distortion({ distortion: num(effect.params.amount, 0.25, 0, 1), wet: num(effect.params.wet, 0.5, 0, 1) }));
      } else if (effect.type === "compressor") {
        nodes.push(new Tone.Compressor({ threshold: num(effect.params.threshold, -24, -60, 0), ratio: num(effect.params.ratio, 4, 1, 20), attack: num(effect.params.attack, 0.01, 0.001, 0.5), release: num(effect.params.release, 0.2, 0.01, 2) }));
        const makeupGain = num(effect.params.makeupGain, 0, 0, 24);
        if (makeupGain > 0) nodes.push(new Tone.Gain(Tone.dbToGain(makeupGain)));
      }
    } catch (error) {
      console.warn("Bypassed failed FX module.", { effect, error });
    }
  }
  return nodes;
}
