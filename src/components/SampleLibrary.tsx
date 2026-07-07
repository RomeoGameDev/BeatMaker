"use client";

import { useMemo, useState } from "react";
import type { Sample, SampleCategory, SampleType } from "@/types";

type SampleFilter = "all" | SampleType | SampleCategory;
type Props = { samples: Sample[]; onPreview: (sample: Sample) => void; onAssign: (sample: Sample) => void };

const filters: { label: string; value: SampleFilter }[] = [
  { label: "All", value: "all" },
  { label: "One-shots", value: "oneshot" },
  { label: "Loops", value: "loop" },
  { label: "Kick", value: "kick" },
  { label: "Snare", value: "snare" },
  { label: "Hat", value: "hat" },
  { label: "Bass", value: "bass" },
  { label: "Guitar", value: "guitar" },
  { label: "Other", value: "other" }
];

export default function SampleLibrary({ samples, onPreview, onAssign }: Props) {
  const [filter, setFilter] = useState<SampleFilter>("all");
  const filteredSamples = useMemo(() => samples.filter((sample) => filter === "all" || sample.type === filter || sample.category === filter), [filter, samples]);

  return (
    <div className="sample-library">
      <div className="filter-row">
        {filters.map((item) => <button key={item.value} className={filter === item.value ? "active-filter" : ""} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
      <div className="sample-list">
        {filteredSamples.map((sample) => (
          <article className="sample-row" key={sample.id}>
            <div><strong>{sample.name}</strong><small>File: {sample.filename}</small><small>Type: {sample.type} · Category: {sample.category}{sample.isRendered ? " · Rendered in app" : ""}</small><small>Duration: {sample.durationSeconds ? `${sample.durationSeconds.toFixed(2)}s` : "Duration not loaded yet"}</small><small>Path: {sample.path}</small></div>
            <button onClick={() => onPreview(sample)}>Preview</button>
            <button onClick={() => onAssign(sample)}>Assign</button>
          </article>
        ))}
        {filteredSamples.length === 0 && <p className="hint">No samples match this filter.</p>}
      </div>
    </div>
  );
}
