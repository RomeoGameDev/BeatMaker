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

const effectNames: Record<TrackEffectType, string> = { eq: "EQ", reverb: "Reverb", overdrive: "Overdrive", distortion: "Distortion", compressor: "Compressor", delay: "Delay", chorus: "Chorus", bitcrusher: "Bitcrusher", filter: "Filter", limiter: "Limiter", noiseGate: "Noise Gate" };

export function getDefaultEffectParams(type: TrackEffectType): Record<string, unknown> {
  if (type === "eq") return { bandCount: 3, bands: defaultEq3Bands() };
  if (type === "reverb") return { wet: 0.25, decay: 2, preDelay: 0.02 };
  if (type === "overdrive") return { drive: 0.35, tone: 2200, wet: 0.5 };
  if (type === "distortion") return { amount: 0.25, wet: 0.5 };
  if (type === "compressor") return { threshold: -24, ratio: 4, attack: 0.01, release: 0.2, makeupGain: 0 };
  if (type === "delay") return { wet: 0.35, delayTime: 0.25, feedback: 0.35 };
  if (type === "chorus") return { wet: 0.4, frequency: 1.5, delayTime: 8, depth: 0.5 };
  if (type === "bitcrusher") return { bits: 8, wet: 0.5 };
  if (type === "filter") return { type: "lowpass", frequency: 8000, q: 1, gain: 0 };
  if (type === "limiter") return { threshold: -1 };
  return { threshold: -40, attack: 0.01, release: 0.1 };
}

export function makeTrackEffect(type: TrackEffectType): TrackEffect {
  const id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, type, name: effectNames[type], enabled: true, params: getDefaultEffectParams(type) };
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
      } else if (effect.type === "delay") {
        nodes.push(new Tone.FeedbackDelay({ wet: num(effect.params.wet, 0.35, 0, 1), delayTime: num(effect.params.delayTime, 0.25, 0.01, 1), feedback: num(effect.params.feedback, 0.35, 0, 0.95) }));
      } else if (effect.type === "chorus") {
        const chorus = new Tone.Chorus({ wet: num(effect.params.wet, 0.4, 0, 1), frequency: num(effect.params.frequency, 1.5, 0.1, 10), delayTime: num(effect.params.delayTime, 8, 1, 30), depth: num(effect.params.depth, 0.5, 0, 1) });
        chorus.start();
        nodes.push(chorus);
      } else if (effect.type === "bitcrusher") {
        // TODO: Add explicit dry/wet routing for BitCrusher; Tone.BitCrusher itself has no wet option in Tone 15.
        nodes.push(new Tone.BitCrusher(num(effect.params.bits, 8, 1, 16)));
      } else if (effect.type === "filter") {
        const type = ["lowpass", "highpass", "bandpass"].includes(String(effect.params.type)) ? effect.params.type as BiquadFilterType : "lowpass";
        nodes.push(new Tone.Filter({ type, frequency: num(effect.params.frequency, 8000, 20, 20000), Q: num(effect.params.q, 1, 0.1, 20), gain: num(effect.params.gain, 0, -24, 24) }));
      } else if (effect.type === "limiter") {
        nodes.push(new Tone.Limiter(num(effect.params.threshold, -1, -24, 0)));
      } else if (effect.type === "noiseGate") {
        // Tone.js does not include a dedicated simple gate node in every build.
        // A very low-ratio compressor safely approximates gating without crashing playback.
        nodes.push(new Tone.Compressor({ threshold: num(effect.params.threshold, -40, -80, 0), ratio: 20, attack: num(effect.params.attack, 0.01, 0.001, 0.2), release: num(effect.params.release, 0.1, 0.01, 1) }));
      }
    } catch (error) {
      console.warn("Bypassed failed FX module.", { effect, error });
    }
  }
  return nodes;
}
