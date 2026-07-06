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
    background: string;
    panelBackground: string;
    textColor: string;
    accentColor: string;
    borderColor: string;
  };
};

export type SequencerTrack = {
  id: number;
  name: string;
  assignedSample?: Sample;
  steps: boolean[];
};
