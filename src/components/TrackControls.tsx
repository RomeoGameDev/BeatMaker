import type { ChangeEvent } from "react";
import type { SequencerTrack, TrackSettings } from "@/types";

type Props = {
  track?: SequencerTrack;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
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

const waveformBars = [28, 62, 38, 84, 54, 72, 34, 92, 46, 68, 30, 58, 42, 76, 36, 52];

export default function TrackControls({ track, onChange, onPreview }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

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

      <div className="mini-waveform" aria-label="Simple decorative waveform preview">
        {waveformBars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
      </div>

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
      <p className="hint">Preview and sequencer playback use the same safe one-shot engine, so missing or short samples are skipped instead of crashing.</p>
    </div>
  );
}
