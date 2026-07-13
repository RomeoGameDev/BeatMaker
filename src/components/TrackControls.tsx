import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { buildNoteRange, noteOptions } from "@/lib/musicTheory";
import type { SequencerTrack, TrackSettings, TrackMode, TrackEffect, FadeCurve, LoopMode } from "@/types";
import type { WaveformMode } from "@/components/SampleWaveform";
import ChordComposer from "@/components/ChordComposer";
import FXRack from "@/components/FXRack";
import SampleWaveform from "@/components/SampleWaveform";

type Props = {
  track?: SequencerTrack;
  selectedStepIndex?: number;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
  onTrackChange: (trackId: number, updates: Partial<Pick<SequencerTrack, "mode" | "rootNote" | "octaveRange" | "loopMode" | "loopLengthSteps" | "retriggerLoop">>) => void;
  bpm: number;
  onStepNoteChange: (trackId: number, stepIndex: number, note: string) => void;
  onStepChordChange: (trackId: number, stepIndex: number, rootNote: string, chord: string) => void;
  onStepNotesChange: (trackId: number, stepIndex: number, notes: string[]) => void;
  onEffectsChange: (trackId: number, effects: TrackEffect[]) => void;
  onResetSettings: (trackId: number) => void;
  onClearNotes: (trackId: number) => void;
  onClearPattern: (trackId: number) => void;
  onResetTrack: (trackId: number) => void;
  onPlay: (track: SequencerTrack) => void;
  onRenderTrack: (track: SequencerTrack, variant: "processed" | "dry") => void;
  onComingSoon: (feature: string) => void;
  playheadMs?: number;
};

type SliderControl = { key: keyof Pick<TrackSettings, "volume" | "pitchSemitones" | "fadeInMs" | "fadeOutMs">; label: string; min: number; max: number; step: number; format: (value: number) => string; };
export const sliderControls: SliderControl[] = [
  { key: "volume", label: "Volume", min: 0, max: 1.5, step: 0.01, format: (value) => `${value.toFixed(2)}x` },
  { key: "pitchSemitones", label: "Pitch", min: -24, max: 24, step: 1, format: (value) => `${value > 0 ? "+" : ""}${value} st` },
  { key: "fadeInMs", label: "Fade In", min: 0, max: 500, step: 5, format: (value) => `${value} ms` },
  { key: "fadeOutMs", label: "Fade Out", min: 0, max: 500, step: 5, format: (value) => `${value} ms` }
];

const fadeCurves: FadeCurve[] = ["linear", "easeIn", "easeOut", "exponential"];
const fallbackSampleMs = 10000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatMs = (value: number) => `${Math.round(value)} ms / ${(value / 1000).toFixed(2)}s`;

export default function TrackControls({ track, selectedStepIndex, onChange, onTrackChange, bpm, onStepNoteChange, onStepNotesChange, onEffectsChange, onResetSettings, onClearNotes, onClearPattern, onResetTrack, onPlay, onRenderTrack, onComingSoon, playheadMs }: Props) {
  const [waveformMode, setWaveformMode] = useState<WaveformMode>("overlay");
  const [regionControlsOpen, setRegionControlsOpen] = useState(true);
  const [loopControlsOpen, setLoopControlsOpen] = useState(false);

  useEffect(() => {
    if (!track?.assignedSample) { setLoopControlsOpen(false); return; }
    setLoopControlsOpen(track.assignedSample.type === "loop" || Boolean(track.assignedSample.isLong));
  }, [track?.assignedSample?.id, track?.assignedSample?.type, track?.assignedSample?.isLong]);

  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

  const selectedStep = selectedStepIndex === undefined ? undefined : track.steps[selectedStepIndex];
  const selectedNote = selectedStep?.note ?? track.rootNote;
  const rootOptions = noteOptions(1, 6).filter((note) => /^C\d$/.test(note));

  const sampleMs = Math.max(1, Math.round(track.assignedSample?.durationMs ?? fallbackSampleMs));
  const sampleSeconds = track.assignedSample?.durationSeconds;
  const regionStart = clamp(track.settings.startOffsetMs ?? 0, 0, sampleMs - 1);
  const regionEnd = clamp(sampleMs - (track.settings.endTrimMs ?? 0), regionStart + 1, sampleMs);
  const regionLength = regionEnd - regionStart;
  const regionSeconds = (60 / bpm / 4) * (track.loopLengthSteps ?? 16);
  const trimInvalid = regionLength <= 0;
  const stepMs = (60 / bpm / 4) * 1000;
  const setRegion = (start: number, end: number) => {
    const nextStart = clamp(Math.round(start), 0, sampleMs - 1);
    const nextEnd = clamp(Math.round(end), nextStart + 1, sampleMs);
    onChange(track.id, { startOffsetMs: nextStart, endTrimMs: Math.max(0, sampleMs - nextEnd) });
  };
  const setRegionStart = (value: number) => setRegion(value, regionEnd);
  const setRegionEnd = (value: number) => setRegion(regionStart, value);
  const setQuickSteps = (steps: number) => setRegion(regionStart, regionStart + stepMs * steps);
  const dynamicControl = (control: SliderControl) => {
    if (control.key === "fadeInMs" || control.key === "fadeOutMs") return { ...control, max: Math.min(regionLength, 5000), format: formatMs };
    return control;
  };
  const updateNumber = (key: SliderControl["key"], max?: number) => (event: ChangeEvent<HTMLInputElement>) => onChange(track.id, { [key]: Math.min(Number(event.target.value), max ?? Number.MAX_SAFE_INTEGER) } as Partial<TrackSettings>);
  const composerNotes = selectedStep?.notes?.length ? selectedStep.notes : selectedStep?.note ? [selectedStep.note] : [];
  const decodeFailed = track.assignedSample?.loadStatus === "decode failed";

  return (
    <div className="track-controls">
      <div className="track-control-header"><div><p className="eyebrow">{track.name}</p><h3>{track.assignedSample?.name ?? "No sample assigned"}</h3><small>{track.assignedSample ? `${track.assignedSample.filename} · ${track.assignedSample.category} · ${track.assignedSample.type}` : "Pick a sample from the library to play this track."}</small><small>Sample length: {sampleSeconds ? `${sampleSeconds.toFixed(2)}s` : "Duration not loaded yet"}</small></div><button type="button" onClick={() => onPlay(track)} disabled={!track.assignedSample}>Play Track</button></div>
      {track.mode === "sliced" ? <div className="sliced-track-summary"><strong>Sliced track</strong><small>Source: {track.assignedSample?.name ?? "No source"}</small><small>{track.slices?.length ?? 0} slices. Edit slices in Waveform / Slicer.</small></div> : <div className="control-grid mode-grid"><label>Mode<select value={track.mode} onChange={(event) => onTrackChange(track.id, { mode: event.target.value as TrackMode })}><option value="oneshot">One-shot</option><option value="keyboard">Keyboard</option></select></label><label>Root Note<select value={track.rootNote} onChange={(event) => onTrackChange(track.id, { rootNote: event.target.value })}>{rootOptions.map((note) => <option key={note} value={note}>{note}</option>)}</select></label><label>Octave Range<select value={track.octaveRange} onChange={(event) => onTrackChange(track.id, { octaveRange: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label></div>}
      {track.mode === "keyboard" && <div className="keyboard-editor"><p className="hint">Selected step: {selectedStepIndex === undefined ? "click a step" : selectedStepIndex + 1}. Active steps without notes use {track.rootNote}.</p><ChordComposer rootNote={track.rootNote} octaveRange={track.octaveRange} selectedNotes={composerNotes} disabled={selectedStepIndex === undefined} onNotesChange={(notes) => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, notes)} onApply={() => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, composerNotes.length ? composerNotes : [selectedNote])} onClear={() => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, [])} /><label className="field-label">Single Step Note<select value={selectedNote} disabled={selectedStepIndex === undefined} onChange={(event) => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, event.target.value)}>{buildNoteRange(track.rootNote, track.octaveRange).map((note) => <option key={note} value={note}>{note}</option>)}</select></label></div>}
      {decodeFailed && <p className="warning-text">This sample can preview with browser audio, but cannot be sequenced/edited until converted to PCM WAV.</p>}
      <div className="waveform-toolbar"><span>Waveform</span>{(["original", "processed", "overlay"] as WaveformMode[]).map((mode) => <button type="button" key={mode} className={waveformMode === mode ? "active-filter" : ""} onClick={() => setWaveformMode(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div><SampleWaveform sample={track.assignedSample} settings={track.settings} playheadMs={playheadMs} processed={waveformMode !== "original"} mode={waveformMode} /><p className="hint helper-text">Processed waveform approximates selected region, fade, pitch length, and volume. FX waveform render coming soon.</p>
      <section className={`collapsible-section region-controls ${regionControlsOpen ? "expanded" : "collapsed"}`} aria-label="Sample region selection"><div className="collapsible-header"><div><h4>Region</h4><p className="section-summary">Start: {(regionStart / 1000).toFixed(2)}s · End: {(regionEnd / 1000).toFixed(2)}s · Length: {(regionLength / 1000).toFixed(2)}s</p></div><button type="button" className="section-toggle" onClick={() => setRegionControlsOpen((open) => !open)} aria-expanded={regionControlsOpen} aria-label={regionControlsOpen ? "Collapse Region" : "Expand Region"}>{regionControlsOpen ? "▾" : "▸"}</button></div>{regionControlsOpen && <div className="collapsible-body"><label className="slider-control"><span className="slider-label"><strong>Region Start</strong><em>{formatMs(regionStart)}</em></span><input type="range" min={0} max={sampleMs - 1} step={10} value={regionStart} onChange={(event) => setRegionStart(Number(event.target.value))} /><input type="number" min={0} max={sampleMs - 1} step={10} value={regionStart} onChange={(event) => setRegionStart(Number(event.target.value))} /></label><label className="slider-control"><span className="slider-label"><strong>Region End</strong><em>{formatMs(regionEnd)}</em></span><input type="range" min={1} max={sampleMs} step={10} value={regionEnd} onChange={(event) => setRegionEnd(Number(event.target.value))} /><input type="number" min={1} max={sampleMs} step={10} value={regionEnd} onChange={(event) => setRegionEnd(Number(event.target.value))} /></label><div className="nudge-row"><button type="button" onClick={() => setRegionStart(regionStart - 10)}>Start -10ms</button><button type="button" onClick={() => setRegionStart(regionStart + 10)}>Start +10ms</button><button type="button" onClick={() => setRegionEnd(regionEnd - 10)}>End -10ms</button><button type="button" onClick={() => setRegionEnd(regionEnd + 10)}>End +10ms</button><button type="button" onClick={() => setQuickSteps(1)}>Quick 1 Step</button><button type="button" onClick={() => setQuickSteps(2)}>Quick 2 Steps</button><button type="button" onClick={() => setQuickSteps(4)}>Quick 4 Steps</button><button type="button" onClick={() => setRegion(0, sampleMs)}>Set Region to Full Sample</button></div></div>}</section>
      <div className={`collapsible-section loop-controls ${loopControlsOpen ? "expanded" : "collapsed"}`}><div className="collapsible-header"><div><h4>Loop Controls</h4><p className="section-summary">Mode: {track.loopMode} · {track.loopLengthSteps ?? 16} steps · Sample: {sampleSeconds ? `${sampleSeconds.toFixed(2)}s` : "unknown"}</p></div><button type="button" className="section-toggle" onClick={() => setLoopControlsOpen((open) => !open)} aria-expanded={loopControlsOpen} aria-label={loopControlsOpen ? "Collapse Loop Controls" : "Expand Loop Controls"}>{loopControlsOpen ? "▾" : "▸"}</button></div>{loopControlsOpen && <div className="collapsible-body"><div className="control-grid"><label>Loop Mode<select value={track.loopMode} onChange={(event) => onTrackChange(track.id, { loopMode: event.target.value as LoopMode })}><option value="oneshot">One-shot</option><option value="play-full">Play Full</option><option value="cut-to-step-length">Cut to Step Length</option><option value="loop-region">Loop Region</option><option value="fit-to-steps-coming-soon" disabled>Fit to Steps (coming soon)</option></select></label><label>Loop Length Steps<select value={track.loopLengthSteps ?? 16} onChange={(event) => onTrackChange(track.id, { loopLengthSteps: Number(event.target.value) })}>{[1, 2, 4, 8, 16, 24, 32].map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div><label className="toggle-row"><input type="checkbox" checked={track.retriggerLoop ?? false} onChange={(event) => onTrackChange(track.id, { retriggerLoop: event.target.checked })} /> Retrigger Loop (stops previous loop and restarts)</label><p className="hint">Sample length: {sampleSeconds ? `${sampleSeconds.toFixed(2)}s` : "Duration not loaded yet"}. Region length at current BPM: {regionSeconds.toFixed(2)}s.</p>{sampleSeconds && <p className="warning-text">{sampleSeconds > regionSeconds ? `Sample is ${(sampleSeconds - regionSeconds).toFixed(2)}s longer than region.` : `Sample is ${(regionSeconds - sampleSeconds).toFixed(2)}s shorter than region.`}</p>}</div>}</div>
      <div className="slider-stack">{sliderControls.map((baseControl) => { const control = dynamicControl(baseControl); return <label className="slider-control" key={control.key}><span className="slider-label"><strong>{control.label}</strong><em>{control.format(track.settings[control.key])}</em></span><input type="range" min={control.min} max={control.max} step={control.step} value={Math.min(track.settings[control.key], control.max)} onChange={updateNumber(control.key, control.max)} /><input type="number" min={control.min} max={control.max} step={control.step} value={Math.min(track.settings[control.key], control.max)} onChange={updateNumber(control.key, control.max)} /></label>; })}</div>{trimInvalid && <p className="warning-text">Region leaves no playable audio</p>}
      <div className="control-grid"><label>Fade In Curve<select value={track.settings.fadeInCurve} onChange={(event) => onChange(track.id, { fadeInCurve: event.target.value as FadeCurve })}>{fadeCurves.map((curve) => <option key={curve}>{curve}</option>)}</select></label><label>Fade Out Curve<select value={track.settings.fadeOutCurve} onChange={(event) => onChange(track.id, { fadeOutCurve: event.target.value as FadeCurve })}>{fadeCurves.map((curve) => <option key={curve}>{curve}</option>)}</select></label></div>
      <FXRack effects={track.effects} onChange={(effects) => onEffectsChange(track.id, effects)} />
      <div className="nudge-row primary-track-actions"><button type="button" onClick={() => onPlay(track)} disabled={!track.assignedSample}>Play</button><button type="button" onClick={() => onRenderTrack(track, "processed")} disabled={!track.assignedSample || decodeFailed}>Render to New Sample</button><button type="button" onClick={() => onResetSettings(track.id)}>Reset</button></div><details className="advanced-actions"><summary>Advanced</summary><div className="nudge-row"><button type="button" onClick={() => onRenderTrack(track, "dry")} disabled={!track.assignedSample || decodeFailed}>Render + Download WAV</button><button type="button" onClick={() => onClearNotes(track.id)}>Clear Chord/Notes</button><button type="button" onClick={() => onClearPattern(track.id)}>Clear Pattern</button><button type="button" onClick={() => onResetTrack(track.id)}>Reset Entire Track</button></div></details>
      <p className="hint helper-text">Keyboard mode calculates semitones from the root note, then adds the track pitch slider. Clear Notes keeps active steps and only removes note/chord data.</p>
    </div>
  );
}
