import type { Sample, SequencerStep, Slice } from "@/types";

export const SLICE_COLORS = ["#22d3ee", "#a78bfa", "#f97316", "#84cc16", "#f43f5e", "#14b8a6", "#eab308", "#60a5fa", "#fb7185", "#34d399", "#c084fc", "#facc15", "#38bdf8", "#fb923c", "#4ade80", "#f472b6"];
export const makeSliceSteps = (count = 16): SequencerStep[] => Array.from({ length: count }, () => ({ active: false }));

export function createEqualSlices(sample: Sample | undefined, parts: number): { slices: Slice[]; error?: string } {
  const durationMs = sample?.durationMs ?? (sample?.durationSeconds ? sample.durationSeconds * 1000 : undefined);
  if (!sample || !durationMs || durationMs <= 0) return { slices: [], error: "Load/decode sample before slicing." };
  const safeParts = [2, 4, 8, 16].includes(parts) ? parts : 4;
  const segment = durationMs / safeParts;
  return { slices: Array.from({ length: safeParts }, (_, index) => ({
    id: `slice-${Date.now()}-${index + 1}`,
    name: `${index + 1}/${safeParts}`,
    startMs: Math.round(index * segment),
    endMs: Math.round(index === safeParts - 1 ? durationMs : (index + 1) * segment),
    fadeInMs: 0,
    fadeOutMs: 5,
    attackMs: 0,
    color: SLICE_COLORS[index % SLICE_COLORS.length]
  })) };
}
