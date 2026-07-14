"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { normalizeSamplePath } from "@/lib/samplePaths";
import type { Sample, SampleCategory, SampleType } from "@/types";

type SampleFilter = "all" | SampleType | SampleCategory;
type Props = { samples: Sample[]; selectedSampleId?: string; onSelect?: (sample: Sample) => void; onPlay: (sample: Sample) => void; onAssign: (sample: Sample) => void; onRemove?: (sample: Sample) => void; onImport?: (file: File, type: "auto" | "oneshot" | "loop") => void };

function sampleStatusLabel(sample: Sample) {
  if (sample.loadStatus === "loaded") return "loaded = fully supported";
  if (sample.loadStatus === "decode-failed") return "decode-failed = preview fallback only";
  if (sample.loadStatus === "fetch-failed") return "fetch-failed = missing path/file";
  return sample.loadStatus ?? "idle";
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

export default function SampleLibrary({ samples, selectedSampleId, onSelect, onPlay, onAssign, onRemove, onImport }: Props) {
  const [filter, setFilter] = useState<SampleFilter>("all");
  const [showDebug, setShowDebug] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [importType, setImportType] = useState<"auto" | "oneshot" | "loop">("auto");
  const importFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onImport?.(file, importType); event.target.value = ""; };
  const filteredSamples = useMemo(() => samples.filter((sample) => filter === "all" || sample.type === filter || sample.category === filter), [filter, samples]);

  return (
    <div className="sample-library">
      <p className="hint helper-text">Import WAV/MP3/OGG/FLAC samples; browser-imported and rendered samples are saved locally with IndexedDB.</p><div className="import-sample-row"><label className="field-label">Import type<select value={importType} onChange={(event) => setImportType(event.target.value as "auto" | "oneshot" | "loop")}><option value="auto">auto</option><option value="oneshot">one-shot</option><option value="loop">loop</option></select></label><label className="import-button">Import Sample<input type="file" accept=".wav,.mp3,.ogg,.flac,audio/wav,audio/mpeg,audio/ogg,audio/flac" onChange={importFile} /></label></div>
      <div className="sample-view-toggle"><button type="button" className={!detailed ? "active-filter" : ""} onClick={() => setDetailed(false)}>Compact</button><button type="button" className={detailed ? "active-filter" : ""} onClick={() => setDetailed(true)}>Detailed</button><button type="button" className="debug-toggle" onClick={() => setShowDebug((old) => !old)}>{showDebug ? "Hide debug" : "Show debug"}</button></div>
      <div className="filter-row">
        {filters.map((item) => <button key={item.value} className={filter === item.value ? "active-filter" : ""} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
      <div className="sample-list">
        {filteredSamples.map((sample) => (
          <article className={`sample-row ${selectedSampleId === sample.id ? "selected-sample" : ""}`} key={sample.id} onClick={() => onSelect?.(sample)}>
            <div className="sample-main"><div className="sample-compact-line"><button type="button" className="expand-sample" onClick={(event) => { event.stopPropagation(); setExpanded((old) => ({ ...old, [sample.id]: !old[sample.id] })); }}>{expanded[sample.id] || detailed ? "▾" : "▸"}</button><strong>{sample.name}</strong><span className="mode-badge">{sample.type}</span><span className="mode-badge">{sample.category}</span>{sample.isImported && <span className="status-dot">Imported</span>}{sample.isRendered && <span className="status-dot">Rendered</span>}</div>{(detailed || expanded[sample.id]) && <div className="sample-details"><small>File: {sample.filename}</small><small>Type: {sample.type} · Category: {sample.category}{sample.isImported ? " · Imported" : sample.isRendered ? " · Rendered in app" : " · Disk sample"}</small><small>Duration: {sample.durationSeconds ? `${sample.durationSeconds.toFixed(2)}s` : "Duration not loaded yet"}</small><small>Status: {sampleStatusLabel(sample)}</small>{sample.loadStatus === "decode-failed" && <small className="helper-text">Found, but not WebAudio-decodable. Browser conversion is planned; use the ffmpeg helper below.</small>}{sample.source === "converted" && <small>Converted in memory from: {sample.originalPath}</small>}{sample.loadStatus === "decode-failed" && <small className="helper-text">Helper: <code>ffmpeg -y -i input.wav -acodec pcm_s16le -ar 44100 output.wav</code></small>}{sample.loadStatus === "fetch-failed" && sample.lastErrorMessage && <small>{sample.lastErrorMessage}</small>}<small>Path: {sample.path}</small>{showDebug && <div className="sample-debug"><strong>Audio file debug</strong><dl><dt>id</dt><dd>{sample.id}</dd><dt>path</dt><dd>{sample.path}</dd><dt>normalized path</dt><dd>{sample.normalizedPath ?? normalizeSamplePath(sample.path)}</dd><dt>load status</dt><dd>{sample.loadStatus ?? "idle"}</dd><dt>last error</dt><dd>{sample.lastErrorMessage ?? "none"}</dd></dl></div>}{sample.isImported && <small>Imported · saved locally</small>}{sample.isRendered && <small>Rendered in app · saved locally</small>}{!(sample.isRendered || sample.source === "in-app" || sample.source === "converted" || sample.source === "indexeddb") && <small className="hint helper-text">Remove from disk manually (not available from the browser).</small>}</div>}</div>
            <button className="sample-action" onClick={(event) => { event.stopPropagation(); onPlay(sample); }}>▶</button>
            <button className="sample-action" onClick={(event) => { event.stopPropagation(); onAssign(sample); }}>Assign</button>
            {(sample.isRendered || sample.source === "in-app" || sample.source === "converted" || sample.source === "indexeddb") && <button className="sample-action" onClick={(event) => { event.stopPropagation(); onRemove?.(sample); }}>×</button>}
          </article>
        ))}
        {filteredSamples.length === 0 && <p className="hint">No samples match this filter.</p>}
      </div>
    </div>
  );
}
