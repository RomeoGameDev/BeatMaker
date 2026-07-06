import type { ChangeEvent } from "react";
import { buildChord, buildNoteRange, CHORD_TYPES, CHROMATIC_NOTES, formatChordLabel, noteOptions } from "@/lib/musicTheory";
import type { SequencerTrack, TrackSettings, TrackMode } from "@/types";
import SampleWaveform from "@/components/SampleWaveform";

type Props = {
  track?: SequencerTrack;
  selectedStepIndex?: number;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
  onTrackChange: (trackId: number, updates: Partial<Pick<SequencerTrack, "mode" | "rootNote" | "octaveRange">>) => void;
  onStepNoteChange: (trackId: number, stepIndex: number, note: string) => void;
  onStepChordChange: (trackId: number, stepIndex: number, rootNote: string, chord: string) => void;
  onResetSettings: (trackId: number) => void;
  onClearNotes: (trackId: number) => void;
  onClearPattern: (trackId: number) => void;
  onResetTrack: (trackId: number) => void;
  onPreview: (track: SequencerTrack) => void;
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

export default function TrackControls({ track, selectedStepIndex, onChange, onTrackChange, onStepNoteChange, onStepChordChange, onResetSettings, onClearNotes, onClearPattern, onResetTrack, onPreview }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

  const selectedStep = selectedStepIndex === undefined ? undefined : track.steps[selectedStepIndex];
  const selectedNote = selectedStep?.note ?? track.rootNote;
  const selectedChord = selectedStep?.chord ?? "major";
  const stepPlayType = selectedStep?.chord ? "chord" : "single";
  const rootOptions = noteOptions(1, 6).filter((note) => /^C\d$/.test(note));
  const noteRange = buildNoteRange(track.rootNote, track.octaveRange);
  const chordNotes = buildChord(selectedNote, selectedChord);

  const updateNumber = (key: SliderControl["key"]) => (event: ChangeEvent<HTMLInputElement>) => onChange(track.id, { [key]: Number(event.target.value) } as Partial<TrackSettings>);
  const applyChord = (root = selectedNote, chord = selectedChord) => selectedStepIndex !== undefined && onStepChordChange(track.id, selectedStepIndex, root, chord);

  return (
    <div className="track-controls">
      <div className="track-control-header"><div><p className="eyebrow">{track.name}</p><h3>{track.assignedSample?.name ?? "No sample assigned"}</h3><small>{track.assignedSample ? `${track.assignedSample.filename} · ${track.assignedSample.category} · ${track.assignedSample.type}` : "Pick a sample from the library to play this track."}</small></div><button type="button" onClick={() => onPreview(track)} disabled={!track.assignedSample}>Preview Track</button></div>
      <div className="control-grid mode-grid"><label>Mode<select value={track.mode} onChange={(event) => onTrackChange(track.id, { mode: event.target.value as TrackMode })}><option value="oneshot">One-shot</option><option value="keyboard">Keyboard</option></select></label><label>Root Note<select value={track.rootNote} onChange={(event) => onTrackChange(track.id, { rootNote: event.target.value })}>{rootOptions.map((note) => <option key={note} value={note}>{note}</option>)}</select></label><label>Octave Range<select value={track.octaveRange} onChange={(event) => onTrackChange(track.id, { octaveRange: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label></div>
      {track.mode === "keyboard" && <div className="keyboard-editor"><p className="hint">Selected step: {selectedStepIndex === undefined ? "click a step" : selectedStepIndex + 1}. Active steps without notes use {track.rootNote}.</p><label className="field-label">Step Play Type<select value={stepPlayType} disabled={selectedStepIndex === undefined} onChange={(event) => { if (selectedStepIndex === undefined) return; event.target.value === "chord" ? applyChord() : onStepNoteChange(track.id, selectedStepIndex, selectedNote); }}><option value="single">Single Note</option><option value="chord">Chord</option></select></label>{stepPlayType === "single" ? <><div className="mini-keyboard">{CHROMATIC_NOTES.map((noteName) => { const note = noteRange.find((item) => item.replace(/-?\d+$/, "") === noteName) ?? `${noteName}${track.rootNote.slice(-1)}`; return <button type="button" key={noteName} className={selectedNote.replace(/-?\d+$/, "") === noteName ? "active-filter" : ""} disabled={selectedStepIndex === undefined} onClick={() => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, note)}>{noteName}</button>; })}</div><label className="field-label">Step note<select value={selectedNote} disabled={selectedStepIndex === undefined} onChange={(event) => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, event.target.value)}>{noteRange.map((note) => <option key={note} value={note}>{note}</option>)}</select></label></> : <div className="chord-editor"><label className="field-label">Chord Root<select value={selectedNote} disabled={selectedStepIndex === undefined} onChange={(event) => applyChord(event.target.value, selectedChord)}>{noteRange.map((note) => <option key={note} value={note}>{note}</option>)}</select></label><label className="field-label">Chord Type<select value={selectedChord} disabled={selectedStepIndex === undefined} onChange={(event) => applyChord(selectedNote, event.target.value)}>{CHORD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><p className="hint chord-preview">{formatChordLabel(selectedNote, selectedChord)} = {chordNotes.join(" ")}</p><button type="button" disabled={selectedStepIndex === undefined} onClick={() => applyChord()}>Apply chord to selected step</button></div>}</div>}
      <SampleWaveform sample={track.assignedSample} settings={track.settings} />
      <div className="slider-stack">{sliderControls.map((control) => <label className="slider-control" key={control.key}><span className="slider-label"><strong>{control.label}</strong><em>{control.format(track.settings[control.key])}</em></span><input type="range" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={updateNumber(control.key)} /><input type="number" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={updateNumber(control.key)} /></label>)}</div>
      <div className="toggle-row"><label><input type="checkbox" checked={track.settings.mute} onChange={(event) => onChange(track.id, { mute: event.target.checked })} /> Mute</label><label><input type="checkbox" checked={track.settings.solo} onChange={(event) => onChange(track.id, { solo: event.target.checked })} /> Solo</label></div>
      <div className="nudge-row"><button type="button" onClick={() => onResetSettings(track.id)}>Reset Settings</button><button type="button" onClick={() => onClearNotes(track.id)}>Clear Notes</button><button type="button" onClick={() => onClearPattern(track.id)}>Clear Pattern</button><button type="button" onClick={() => onResetTrack(track.id)}>Reset Track</button></div>
      <p className="hint">Keyboard mode calculates semitones from the root note, then adds the track pitch slider. Clear Notes keeps active steps and only removes note/chord data.</p>
    </div>
  );
}
