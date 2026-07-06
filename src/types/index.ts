export type SampleCategory = "kick" | "snare" | "hat" | "clap" | "perc" | "bass" | "guitar" | "melody" | "other";

export type SampleType = "oneshot" | "loop";

export type TrackMode = "oneshot" | "keyboard";

export type SequencerStep = {
  active: boolean;
  note?: string;
  chord?: string;
  notes?: string[];
};

export type Sample = {
  id: string;
  filename: string;
  name: string;
  type: SampleType;
  category: SampleCategory;
  path: string;
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
  settings: TrackSettings;
  mode: TrackMode;
  rootNote: string;
  octaveRange: number;
  minNote?: string;
  maxNote?: string;
  effects: TrackEffect[];
};

export type PatternId = string;
export type ArrangementSlot = PatternId | "";
