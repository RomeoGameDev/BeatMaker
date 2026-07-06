import type { ChangeEvent } from "react";
import { buildNoteRange, noteOptions } from "@/lib/musicTheory";
import type { SequencerTrack, TrackSettings, TrackMode, TrackEffect, FadeCurve } from "@/types";
import ChordComposer from "@/components/ChordComposer";
import FXRack from "@/components/FXRack";
import SampleWaveform from "@/components/SampleWaveform";

type Props = {
  track?: SequencerTrack;
  selectedStepIndex?: number;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
  onTrackChange: (trackId: number, updates: Partial<Pick<SequencerTrack, "mode" | "rootNote" | "octaveRange">>) => void;
  onStepNoteChange: (trackId: number, stepIndex: number, note: string) => void;
  onStepChordChange: (trackId: number, stepIndex: number, rootNote: string, chord: string) => void;
  onStepNotesChange: (trackId: number, stepIndex: number, notes: string[]) => void;
  onEffectsChange: (trackId: number, effects: TrackEffect[]) => void;
  onResetSettings: (trackId: number) => void;
  onClearNotes: (trackId: number) => void;
  onClearPattern: (trackId: number) => void;
  onResetTrack: (trackId: number) => void;
  onPreview: (track: SequencerTrack) => void;
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

export default function TrackControls({ track, selectedStepIndex, onChange, onTrackChange, onStepNoteChange, onStepNotesChange, onEffectsChange, onResetSettings, onClearNotes, onClearPattern, onResetTrack, onPreview, playheadMs }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

  const selectedStep = selectedStepIndex === undefined ? undefined : track.steps[selectedStepIndex];
  const selectedNote = selectedStep?.note ?? track.rootNote;
  const rootOptions = noteOptions(1, 6).filter((note) => /^C\d$/.test(note));

  const updateNumber = (key: SliderControl["key"]) => (event: ChangeEvent<HTMLInputElement>) => onChange(track.id, { [key]: Number(event.target.value) } as Partial<TrackSettings>);
  const composerNotes = selectedStep?.notes?.length ? selectedStep.notes : selectedStep?.note ? [selectedStep.note] : [];

  return (
    <div className="track-controls">
      <div className="track-control-header"><div><p className="eyebrow">{track.name}</p><h3>{track.assignedSample?.name ?? "No sample assigned"}</h3><small>{track.assignedSample ? `${track.assignedSample.filename} · ${track.assignedSample.category} · ${track.assignedSample.type}` : "Pick a sample from the library to play this track."}</small></div><button type="button" onClick={() => onPreview(track)} disabled={!track.assignedSample}>Preview Track</button></div>
      <div className="control-grid mode-grid"><label>Mode<select value={track.mode} onChange={(event) => onTrackChange(track.id, { mode: event.target.value as TrackMode })}><option value="oneshot">One-shot</option><option value="keyboard">Keyboard</option></select></label><label>Root Note<select value={track.rootNote} onChange={(event) => onTrackChange(track.id, { rootNote: event.target.value })}>{rootOptions.map((note) => <option key={note} value={note}>{note}</option>)}</select></label><label>Octave Range<select value={track.octaveRange} onChange={(event) => onTrackChange(track.id, { octaveRange: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label></div>
      {track.mode === "keyboard" && <div className="keyboard-editor"><p className="hint">Selected step: {selectedStepIndex === undefined ? "click a step" : selectedStepIndex + 1}. Active steps without notes use {track.rootNote}.</p><ChordComposer rootNote={track.rootNote} octaveRange={track.octaveRange} selectedNotes={composerNotes} disabled={selectedStepIndex === undefined} onNotesChange={(notes) => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, notes)} onApply={() => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, composerNotes.length ? composerNotes : [selectedNote])} onClear={() => selectedStepIndex !== undefined && onStepNotesChange(track.id, selectedStepIndex, [])} /><label className="field-label">Single Step Note<select value={selectedNote} disabled={selectedStepIndex === undefined} onChange={(event) => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, event.target.value)}>{buildNoteRange(track.rootNote, track.octaveRange).map((note) => <option key={note} value={note}>{note}</option>)}</select></label></div>}
      <SampleWaveform sample={track.assignedSample} settings={track.settings} playheadMs={playheadMs} />
      <div className="slider-stack">{sliderControls.map((control) => <label className="slider-control" key={control.key}><span className="slider-label"><strong>{control.label}</strong><em>{control.format(track.settings[control.key])}</em></span><input type="range" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={updateNumber(control.key)} /><input type="number" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={updateNumber(control.key)} /></label>)}</div>
      <div className="control-grid"><label>Fade In Curve<select value={track.settings.fadeInCurve} onChange={(event) => onChange(track.id, { fadeInCurve: event.target.value as FadeCurve })}>{fadeCurves.map((curve) => <option key={curve}>{curve}</option>)}</select></label><label>Fade Out Curve<select value={track.settings.fadeOutCurve} onChange={(event) => onChange(track.id, { fadeOutCurve: event.target.value as FadeCurve })}>{fadeCurves.map((curve) => <option key={curve}>{curve}</option>)}</select></label></div>
      <FXRack effects={track.effects} onChange={(effects) => onEffectsChange(track.id, effects)} />
      <div className="toggle-row"><label><input type="checkbox" checked={track.settings.mute} onChange={(event) => onChange(track.id, { mute: event.target.checked })} /> Mute</label><label><input type="checkbox" checked={track.settings.solo} onChange={(event) => onChange(track.id, { solo: event.target.checked })} /> Solo</label></div>
      <div className="nudge-row"><button type="button" onClick={() => onResetSettings(track.id)}>Reset Playback Settings</button><button type="button" onClick={() => onChange(track.id, { fadeInMs: 0, fadeOutMs: 5, fadeInCurve: "linear", fadeOutCurve: "linear" })}>Reset Fade</button><button type="button" onClick={() => onChange(track.id, { pitchSemitones: 0 })}>Reset Pitch</button><button type="button" onClick={() => onClearNotes(track.id)}>Clear Chord/Notes on Selected Step</button><button type="button" onClick={() => onClearPattern(track.id)}>Clear Pattern</button><button type="button" onClick={() => onResetTrack(track.id)}>Reset Track</button></div>
      <p className="hint">Keyboard mode calculates semitones from the root note, then adds the track pitch slider. Clear Notes keeps active steps and only removes note/chord data.</p>
    </div>
  );
}
