export type SampleCategory = "kick" | "snare" | "hat" | "clap" | "perc" | "bass" | "guitar" | "melody" | "other";

export type SampleType = "oneshot" | "loop";

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
    "--color-text": string;
    "--color-accent": string;
    "--color-border": string;
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
};

export type SequencerTrack = {
  id: number;
  name: string;
  assignedSample?: Sample;
  steps: boolean[];
  settings: TrackSettings;
};
