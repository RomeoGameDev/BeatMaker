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

export type SequencerTrack = {
  id: number;
  name: string;
  assignedSample?: Sample;
  steps: boolean[];
};
