export type SampleCategory = "kick" | "snare" | "hat" | "clap" | "perc" | "bass" | "guitar" | "melody" | "rendered" | "other";

export type SampleType = "oneshot" | "loop";

export type TrackMode = "oneshot" | "keyboard" | "sliced";
export type LoopMode = "oneshot" | "loop-region" | "cut-to-step-length" | "play-full" | "fit-to-steps-coming-soon";

export type SequencerStep = {
  active: boolean;
  note?: string;
  chord?: string;
  notes?: string[];
};

export type Slice = {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  attackMs?: number;
  color?: string;
};

export type Sample = {
  id: string;
  filename: string;
  name: string;
  type: SampleType;
  category: SampleCategory;
  path: string;
  durationSeconds?: number;
  durationMs?: number;
  isLong?: boolean;
  isRendered?: boolean;
  isImported?: boolean;
  source?: "in-app" | "public" | "converted" | "indexeddb";
  createdAt?: number;
  metadata?: Record<string, unknown>;
  originalPath?: string;
  normalizedPath?: string;
  loadStatus?: import("@/lib/sampleLoader").SampleLoadStatus;
  lastErrorMessage?: string;
};

export type Skin = {
  id: string;
  name: string;
  variables: {
    "--color-bg": string;
    "--color-panel": string;
    "--color-panel-2"?: string;
    "--color-titlebar"?: string;
    "--color-text": string;
    "--color-accent": string;
    "--color-accent-2"?: string;
    "--color-border": string;
    "--color-button"?: string;
    "--color-button-hover"?: string;
    "--color-muted"?: string;
    "--color-waveform-original"?: string;
    "--color-waveform-processed"?: string;
    "--panel-gradient"?: string;
    "--titlebar-gradient"?: string;
    "--button-gradient"?: string;
    "--app-background"?: string;
    "--panel-shadow"?: string;
  };
};

export type TrackSettings = {
  startOffsetMs: number;
  endTrimMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  volume: number;
  mute: boolean;
  solo: boolean;
  pitchSemitones: number;
  fadeInCurve: FadeCurve;
  fadeOutCurve: FadeCurve;
};

export type FadeCurve = "linear" | "easeIn" | "easeOut" | "exponential";
export type TrackEffectType = "eq" | "reverb" | "overdrive" | "distortion" | "compressor" | "delay" | "chorus" | "bitcrusher" | "filter" | "limiter" | "noiseGate";
export type EqBand = { label: string; frequencyHz: number; gainDb: number; q: number; };
export type TrackEffect = { id: string; type: TrackEffectType; name: string; enabled: boolean; params: Record<string, unknown>; };

export type SequencerTrack = {
  id: number;
  name: string;
  assignedSample?: Sample;
  steps: SequencerStep[];
  slices?: Slice[];
  sliceSteps?: Record<string, SequencerStep[]>;
  settings: TrackSettings;
  mode: TrackMode;
  rootNote: string;
  octaveRange: number;
  minNote?: string;
  maxNote?: string;
  effects: TrackEffect[];
  loopMode: LoopMode;
  loopLengthSteps: number;
  retriggerLoop: boolean;
};

export type PatternId = string;
export type GuitarLabMode = "chord" | "riff";
export type NoteDuration = "1/4" | "1/8" | "1/16";
export type GuitarLabEffects = { volume: number; pitchOffsetSemitones: number; reverbWet: number; delayWet: number; drive: number; chorusWet: number; };

export type ArrangementSlot = PatternId | "";
