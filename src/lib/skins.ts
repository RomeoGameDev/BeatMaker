import type { Skin } from "@/types";

export const skins: Skin[] = [
  {
    id: "dusty-purple",
    name: "Dusty Purple",
    variables: {
      "--color-bg": "#151020",
      "--color-panel": "#241832",
      "--color-text": "#f4eaff",
      "--color-accent": "#c77dff",
      "--color-border": "#6f4a8e",
    },
  },
  {
    id: "winamp-classic-inspired",
    name: "Winamp Classic Inspired",
    variables: {
      "--color-bg": "#161922",
      "--color-panel": "#252a36",
      "--color-text": "#e6edf3",
      "--color-accent": "#ffb000",
      "--color-border": "#6b7280",
    },
  },
  {
    id: "green-crt",
    name: "Green CRT",
    variables: {
      "--color-bg": "#061006",
      "--color-panel": "#0b1c0b",
      "--color-text": "#d7ffd7",
      "--color-accent": "#39ff14",
      "--color-border": "#1f7a1f",
    },
  },
];
