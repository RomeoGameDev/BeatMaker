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
  onPreview: (track: SequencerTrack) => void;
  onRenderTrack: (track: SequencerTrack, variant: "processed" | "dry") => void;
  onComingSoon: (feature: string) => void;
  playheadMs?: number;
};

type SliderControl = { key: keyof Pick<TrackSettings, "volume" | "pitchSemitones" | "startOffsetMs" | "endTrimMs" | "fadeInMs" | "fadeOutMs">; label: string; min: number; max: number; step: number; format: (value: number) => string; };
export const sliderControls: SliderControl[] = [
  { key: "volume", label: "Volume", min: 0, max: 1.5, step: 0.01, format: (value) => `${value.toFixed(2)}x` },
  { key: "pitchSemitones", label: "Pitch", min: -24, max: 24, step: 1, format: (value) => `${value > 0 ? "+" : ""}${value} st` },
  { key: "startOffsetMs", label: "Start", min: 0, max: 2000, step: 10, format: (value) => `${value} ms` },
  { key: "endTrimMs", label: "End Trim", min: 0, max: 2000, step: 10, format: (value) => `${value} ms` },
  { key: "fadeInMs", label: "Fade In", min: 0, max: 500, step: 5, format: (value) => `${value} ms` },
  { key: "fadeOutMs", label: "Fade Out", min: 0, max: 500, step: 5, format: (value) => `${value} ms` }
];

const fadeCurves: FadeCurve[] = ["linear", "easeIn", "easeOut", "exponential"];

export default function TrackControls({ track, selectedStepIndex, onChange, onTrackChange, bpm, onStepNoteChange, onStepNotesChange, onEffectsChange, onResetSettings, onClearNotes, onClearPattern, onResetTrack, onPreview, onRenderTrack, onComingSoon, playheadMs }: Props) {
  const [waveformMode, setWaveformMode] = useState<WaveformMode>("overlay");
  const [loopControlsOpen, setLoopControlsOpen] = useState(false);

  useEffect(() => {
    if (!track?.assignedSample) { setLoopControlsOpen(false); return; }
    setLoopControlsOpen(track.assignedSample.type === "loop" || Boolean(track.assignedSample.isLong));
  }, [track?.assignedSample?.id, track?.assignedSample?.type, track?.assignedSample?.isLong]);

  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

  const selectedStep = selectedStepIndex === undefined ? undefined : track.steps[selectedStepIndex];
  const selectedNote = selectedStep?.note ?? track.rootNote;
  const rootOptions = noteOptions(1, 6).filter((note) => /^C\d$/.test(note));

  const sampleMs = track.assignedSample?.durationMs;
  const sampleSeconds = track.assignedSample?.durationSeconds;
  const regionSeconds = (60 / bpm / 4) * (track.loopLengthSteps ?? 16);
  const trimInvalid = Boolean(sampleMs && track.settings.startOffsetMs + track.settings.endTrimMs >= sampleMs);
  const formatMs = (value: number) => value >= 1000 ? `${value} ms / ${(value / 1000).toFixed(2)}s` : `${value} ms`;
  const dynamicControl = (control: SliderControl) => {
    if (control.key === "startOffsetMs" || control.key === "endTrimMs") return { ...control, max: sampleMs ?? 10000, format: formatMs };
    if (control.key === "fadeInMs" || control.key === "fadeOutMs") return { ...control, max: Math.min(sampleMs ?? 5000, 5000), format: formatMs };
    return control;
  };
  const updateNumber = (key: SliderControl["key"], max?: number) => (event: ChangeEvent<HTMLInputElement>) => onChange(track.id, { [key]: Math.min(Number(event.target.value), max ?? Number.MAX_SAFE_INTEGER) } as Partial<TrackSettings>);
  const composerNotes = selectedStep?.notes?.length ? selectedStep.notes : selectedStep?.note ? [selectedStep.note] : [];
  const decodeFailed = track.assignedSample?.loadStatus === "decode failed";

  return (
    <div className="track-controls">
      <div className="track-control-header"><div><p className="eyebrow">{track.name}</p><h3>{track.assignedSample?.name ?? "No sample assigned"}</h3><small>{track.assignedSample ? `${track.assignedSample.filename} · ${track.assignedSample.category} · ${track.assignedSample.type}` : "Pick a sample from the library to play this track."}</small><small>Sample length: {sampleSeconds ? `${sampleSeconds.toFixed(2)}s` : "Duration not loaded yet"}</small></div><button type="button" onClick={() => onPreview(track)} disabled={!track.assignedSample}>Preview Track</button></div>
      <div className="control-grid mode-grid"><label>Mode<select value={track.mode} onChange={(event) => onTrackChange(track.id, { mode: event.target.value as TrackMode })}><option value="oneshot">One-shot</option><option value="keyboard">Keyboard</option></select></label><label>Root Note<select value={track.rootNote} onChange={(event) => onTrackChange(track.id, { rootNote: event.target.value })}>{rootOptions.map((note) => <option key={note} value={note}>{note}</option>)}</select></label><label>Octave Range<select value={track.octaveRange} onChange={(event) => onTrackChange(track.id, { octaveRange: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label></div>
      {track.mode === "keyboard" && <div className="keyboard-editor"><p className="hint">Selected step: {selectedStepIndex === undefined ? "click a step" : selectedStepIndex + 1}. Active steps without notes use {track.rootNote}.</p><ChordComposer rootNote={track.rootNote} octaveRange={track.octaveRange} selectedNotes={composerNotes} disabled={selectedStepIndex === undefined} onNotesChange={(notes) => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, notes)} onApply={() => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, composerNotes.length ? composerNotes : [selectedNote])} onClear={() => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, [])} /><label className="field-label">Single Step Note<select value={selectedNote} disabled={selectedStepIndex === undefined} onChange={(event) => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, event.target.value)}>{buildNoteRange(track.rootNote, track.octaveRange).map((note) => <option key={note} value={note}>{note}</option>)}</select></label></div>}
      {decodeFailed && <p className="warning-text">This sample can preview with browser audio, but cannot be sequenced/edited until converted to PCM WAV.</p>}
      <div className="waveform-toolbar"><span>Waveform</span>{(["original", "processed", "overlay"] as WaveformMode[]).map((mode) => <button type="button" key={mode} className={waveformMode === mode ? "active-filter" : ""} onClick={() => setWaveformMode(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div><SampleWaveform sample={track.assignedSample} settings={track.settings} playheadMs={playheadMs} processed={waveformMode !== "original"} mode={waveformMode} /><p className="hint">Processed waveform approximates trim, fade, pitch length, and volume. FX waveform render coming soon.</p>
      <div className="slider-stack">{sliderControls.map((baseControl) => { const control = dynamicControl(baseControl); return <label className="slider-control" key={control.key}><span className="slider-label"><strong>{control.label}</strong><em>{control.format(track.settings[control.key])}</em></span><input type="range" min={control.min} max={control.max} step={control.step} value={Math.min(track.settings[control.key], control.max)} onChange={updateNumber(control.key, control.max)} /><input type="number" min={control.min} max={control.max} step={control.step} value={Math.min(track.settings[control.key], control.max)} onChange={updateNumber(control.key, control.max)} /></label>; })}</div>{trimInvalid && <p className="warning-text">Trim leaves no playable audio</p>}
      <div className="control-grid"><label>Fade In Curve<select value={track.settings.fadeInCurve} onChange={(event) => onChange(track.id, { fadeInCurve: event.target.value as FadeCurve })}>{fadeCurves.map((curve) => <option key={curve}>{curve}</option>)}</select></label><label>Fade Out Curve<select value={track.settings.fadeOutCurve} onChange={(event) => onChange(track.id, { fadeOutCurve: event.target.value as FadeCurve })}>{fadeCurves.map((curve) => <option key={curve}>{curve}</option>)}</select></label></div>
      <div className={`loop-controls ${loopControlsOpen ? "expanded" : "collapsed"}`}><div className="loop-controls-header"><div><h4>Loop Controls</h4><p className="loop-summary">Mode: {track.loopMode} · {track.loopLengthSteps ?? 16} steps · Sample: {sampleSeconds ? `${sampleSeconds.toFixed(2)}s` : "unknown"}</p></div><button type="button" onClick={() => setLoopControlsOpen((open) => !open)} aria-expanded={loopControlsOpen}>{loopControlsOpen ? "Collapse" : "Expand"}</button></div>{loopControlsOpen && <div className="loop-controls-body"><div className="control-grid"><label>Loop Mode<select value={track.loopMode} onChange={(event) => onTrackChange(track.id, { loopMode: event.target.value as LoopMode })}><option value="oneshot">One-shot</option><option value="play-full">Play Full</option><option value="cut-to-step-length">Cut to Step Length</option><option value="loop-region">Loop Region</option><option value="fit-to-steps-coming-soon" disabled>Fit to Steps (coming soon)</option></select></label><label>Loop Length Steps<select value={track.loopLengthSteps ?? 16} onChange={(event) => onTrackChange(track.id, { loopLengthSteps: Number(event.target.value) })}>{[1, 2, 4, 8, 16, 24, 32].map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div><label className="toggle-row"><input type="checkbox" checked={track.retriggerLoop ?? false} onChange={(event) => onTrackChange(track.id, { retriggerLoop: event.target.checked })} /> Retrigger Loop (stops previous loop and restarts)</label><p className="hint">Sample length: {sampleSeconds ? `${sampleSeconds.toFixed(2)}s` : "Duration not loaded yet"}. Region length at current BPM: {regionSeconds.toFixed(2)}s.</p>{sampleSeconds && <p className="warning-text">{sampleSeconds > regionSeconds ? `Sample is ${(sampleSeconds - regionSeconds).toFixed(2)}s longer than region.` : `Sample is ${(regionSeconds - sampleSeconds).toFixed(2)}s shorter than region.`}</p>}</div>}</div>
      <FXRack effects={track.effects} onChange={(effects) => onEffectsChange(track.id, effects)} />
      <div className="toggle-row"><label><input type="checkbox" checked={track.settings.mute} onChange={(event) => onChange(track.id, { mute: event.target.checked })} /> Mute</label><label><input type="checkbox" checked={track.settings.solo} onChange={(event) => onChange(track.id, { solo: event.target.checked })} /> Solo</label></div>
      <div className="nudge-row"><button type="button" onClick={() => onPreview(track)} disabled={!track.assignedSample}>Preview Track</button><button type="button" onClick={() => onRenderTrack(track, "processed")} disabled={!track.assignedSample || decodeFailed}>Render to New Sample</button><button type="button" onClick={() => onRenderTrack(track, "dry")} disabled={!track.assignedSample || decodeFailed}>Render to New Sample + Download WAV</button><button type="button" onClick={() => onComingSoon("Full FX render")} disabled={!track.assignedSample}>Full FX render</button><button type="button" onClick={() => onResetSettings(track.id)}>Reset Playback Settings</button><button type="button" onClick={() => onClearNotes(track.id)}>Clear Chord/Notes on Selected Step</button><button type="button" onClick={() => onClearPattern(track.id)}>Clear Pattern</button><button type="button" onClick={() => onResetTrack(track.id)}>Reset Track</button></div>
      <p className="hint">Keyboard mode calculates semitones from the root note, then adds the track pitch slider. Clear Notes keeps active steps and only removes note/chord data.</p>
    </div>
  );
}
