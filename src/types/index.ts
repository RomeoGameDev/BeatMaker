export type SampleCategory = "kicks" | "snares" | "hats" | "bass" | "melody";

export type Sample = {
  id: string;
  name: string;
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
