import type { ChangeEvent } from "react";
import { buildNoteRange, CHROMATIC_NOTES, noteOptions } from "@/lib/musicTheory";
import type { SequencerTrack, TrackSettings, TrackMode } from "@/types";
import SampleWaveform from "@/components/SampleWaveform";

type Props = {
  track?: SequencerTrack;
  selectedStepIndex?: number;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
  onTrackChange: (trackId: number, updates: Partial<Pick<SequencerTrack, "mode" | "rootNote" | "octaveRange">>) => void;
  onStepNoteChange: (trackId: number, stepIndex: number, note: string) => void;
  onPreview: (track: SequencerTrack) => void;
};

type SliderControl = {
  key: keyof Pick<TrackSettings, "volume" | "pitchSemitones" | "startOffsetMs" | "endTrimMs" | "fadeInMs" | "fadeOutMs">;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
};

const sliderControls: SliderControl[] = [
  { key: "volume", label: "Volume", min: 0, max: 1.5, step: 0.01, unit: "×" },
  { key: "pitchSemitones", label: "Pitch", min: -24, max: 24, step: 1, unit: "st" },
  { key: "startOffsetMs", label: "Start", min: 0, max: 2000, step: 10, unit: "ms" },
  { key: "endTrimMs", label: "End Trim", min: 0, max: 2000, step: 10, unit: "ms" },
  { key: "fadeInMs", label: "Fade In", min: 0, max: 500, step: 5, unit: "ms" },
  { key: "fadeOutMs", label: "Fade Out", min: 0, max: 500, step: 5, unit: "ms" }
];

export default function TrackControls({ track, selectedStepIndex, onChange, onTrackChange, onStepNoteChange, onPreview }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

  const selectedStep = selectedStepIndex === undefined ? undefined : track.steps[selectedStepIndex];
  const selectedNote = selectedStep?.note ?? track.rootNote;
  const rootOptions = noteOptions(1, 6).filter((note) => /^C\d$/.test(note));
  const noteRange = buildNoteRange(track.rootNote, track.octaveRange);

  const updateNumber = (key: SliderControl["key"]) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(track.id, { [key]: Number(event.target.value) } as Partial<TrackSettings>);
  };

  return (
    <div className="track-controls">
      <div className="track-control-header">
        <div>
          <p className="eyebrow">{track.name}</p>
          <h3>{track.assignedSample?.name ?? "No sample assigned"}</h3>
          <small>{track.assignedSample ? `${track.assignedSample.category} · ${track.assignedSample.type}` : "Pick a sample from the library to play this track."}</small>
        </div>
        <button type="button" onClick={() => onPreview(track)} disabled={!track.assignedSample}>Preview Track</button>
      </div>

      <div className="control-grid mode-grid">
        <label>Mode<select value={track.mode} onChange={(event) => onTrackChange(track.id, { mode: event.target.value as TrackMode })}><option value="oneshot">One-shot</option><option value="keyboard">Keyboard</option></select></label>
        <label>Root Note<select value={track.rootNote} onChange={(event) => onTrackChange(track.id, { rootNote: event.target.value })}>{rootOptions.map((note) => <option key={note} value={note}>{note}</option>)}</select></label>
        <label>Octave Range<select value={track.octaveRange} onChange={(event) => onTrackChange(track.id, { octaveRange: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
      </div>

      {track.mode === "keyboard" && (
        <div className="keyboard-editor">
          <p className="hint">Selected step: {selectedStepIndex === undefined ? "click a step" : selectedStepIndex + 1}. Active steps without notes use {track.rootNote}.</p>
          <div className="mini-keyboard">
            {CHROMATIC_NOTES.map((noteName) => {
              const note = noteRange.find((item) => item.replace(/-?\d+$/, "") === noteName) ?? `${noteName}${track.rootNote.slice(-1)}`;
              return <button type="button" key={noteName} className={selectedNote.replace(/-?\d+$/, "") === noteName ? "active-filter" : ""} disabled={selectedStepIndex === undefined} onClick={() => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, note)}>{noteName}</button>;
            })}
          </div>
          <label className="field-label">Step note<select value={selectedNote} disabled={selectedStepIndex === undefined} onChange={(event) => selectedStepIndex !== undefined && onStepNoteChange(track.id, selectedStepIndex, event.target.value)}>{noteRange.map((note) => <option key={note} value={note}>{note}</option>)}</select></label>
        </div>
      )}

      <SampleWaveform sample={track.assignedSample} settings={track.settings} />

      <div className="slider-stack">
        {sliderControls.map((control) => (
          <label className="slider-control" key={control.key}>
            <span className="slider-label"><strong>{control.label}</strong><em>{track.settings[control.key]} {control.unit}</em></span>
            <input type="range" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={updateNumber(control.key)} />
            <input type="number" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={updateNumber(control.key)} />
          </label>
        ))}
      </div>

      <div className="toggle-row">
        <label><input type="checkbox" checked={track.settings.mute} onChange={(event) => onChange(track.id, { mute: event.target.checked })} /> Mute</label>
        <label><input type="checkbox" checked={track.settings.solo} onChange={(event) => onChange(track.id, { solo: event.target.checked })} /> Solo</label>
      </div>
      <p className="hint">Keyboard mode calculates semitones from the root note, then adds the track pitch slider.</p>
    </div>
  );
}
