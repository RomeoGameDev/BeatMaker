"use client";

import { useMemo, useState } from "react";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { Sample, SampleCategory, SampleType } from "@/types";

type SampleFilter = "all" | SampleType | SampleCategory;
type Props = { samples: Sample[]; onPreview: (sample: Sample) => void; onAssign: (sample: Sample) => void; onRemove?: (sample: Sample) => void };

function sampleStatusLabel(sample: Sample) {
  if (sample.loadStatus === "loaded") return "loaded = fully supported";
  if (sample.loadStatus === "decode failed") return "decode failed = preview fallback only";
  if (sample.loadStatus === "fetch failed") return "fetch failed = missing path/file";
  return sample.loadStatus ?? "not loaded";
}

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

export default function SampleLibrary({ samples, onPreview, onAssign, onRemove }: Props) {
  const [filter, setFilter] = useState<SampleFilter>("all");
  const [showDebug, setShowDebug] = useState(false);
  const filteredSamples = useMemo(() => samples.filter((sample) => filter === "all" || sample.type === filter || sample.category === filter), [filter, samples]);

  return (
    <div className="sample-library">
      <p className="hint">If a WAV is visible but will not play, convert it to PCM WAV.</p>
      <button type="button" className="debug-toggle" onClick={() => setShowDebug((old) => !old)}>{showDebug ? "Hide debug" : "Show debug"}</button>
      <div className="filter-row">
        {filters.map((item) => <button key={item.value} className={filter === item.value ? "active-filter" : ""} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
      <div className="sample-list">
        {filteredSamples.map((sample) => (
          <article className="sample-row" key={sample.id}>
            <div><strong>{sample.name}</strong><small>File: {sample.filename}</small><small>Type: {sample.type} · Category: {sample.category}{sample.isRendered ? " · Rendered in app" : ""}</small><small>Duration: {sample.durationSeconds ? `${sample.durationSeconds.toFixed(2)}s` : "Duration not loaded yet"}</small><small>Status: {sampleStatusLabel(sample)}</small>{sample.loadStatus === "decode failed" && <small>Found, but not WebAudio-decodable. Convert to PCM WAV for editing.</small>}{sample.loadStatus === "decode failed" && <small>Helper: <code>ffmpeg -i input.wav -acodec pcm_s16le -ar 44100 output.wav</code></small>}{sample.loadStatus === "fetch failed" && sample.lastErrorMessage && <small>{sample.lastErrorMessage}</small>}<small>Path: {sample.path}</small>{showDebug && <div className="sample-debug"><strong>Audio file debug</strong><dl><dt>id</dt><dd>{sample.id}</dd><dt>path</dt><dd>{sample.path}</dd><dt>normalized path</dt><dd>{sample.normalizedPath ?? normalizeSamplePath(sample.path)}</dd><dt>load status</dt><dd>{sample.loadStatus ?? "not loaded"}</dd><dt>last error</dt><dd>{sample.lastErrorMessage ?? "none"}</dd></dl></div>}{!(sample.isRendered || sample.source === "in-app") && <small>Remove from disk manually.</small>}</div>
            <button onClick={() => onPreview(sample)}>Preview</button>
            <button onClick={() => onAssign(sample)}>Assign</button>
            {(sample.isRendered || sample.source === "in-app") && <button onClick={() => onRemove?.(sample)}>Remove</button>}
          </article>
        ))}
        {filteredSamples.length === 0 && <p className="hint">No samples match this filter.</p>}
      </div>
    </div>
  );
}
