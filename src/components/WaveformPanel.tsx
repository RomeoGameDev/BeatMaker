import SampleWaveform from "@/components/SampleWaveform";
import type { SequencerTrack, TrackSettings } from "@/types";

type Props = {
  track?: SequencerTrack;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
  onPreview: (track: SequencerTrack) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function WaveformPanel({ track, onChange, onPreview }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample playback settings.</p>;

  const sample = track.assignedSample;
  const nudgeStart = (amount: number) => onChange(track.id, { startOffsetMs: clamp(track.settings.startOffsetMs + amount, 0, 2000) });

  return (
    <div className="sample-editor">
      <div className="track-control-header">
        <div>
          <p className="eyebrow">Sample Editor</p>
          <h3>{sample?.name ?? "No sample assigned"}</h3>
          <small>{sample ? `${sample.path} · ${sample.category} · ${sample.type} · ${track.mode}` : "Assign a sample to this selected track first."}</small>
        </div>
        <button type="button" onClick={() => onPreview(track)} disabled={!sample}>Preview Sample</button>
      </div>

      <SampleWaveform sample={sample} settings={track.settings} />

      <div className="nudge-row">
        <button type="button" onClick={() => nudgeStart(-10)}>Start -10 ms</button>
        <button type="button" onClick={() => nudgeStart(-1)}>Start -1 ms</button>
        <button type="button" onClick={() => nudgeStart(1)}>Start +1 ms</button>
        <button type="button" onClick={() => nudgeStart(10)}>Start +10 ms</button>
      </div>

      <div className="slider-stack">
        {[
          ["startOffsetMs", "Start Offset", 0, 2000, 1, "ms"],
          ["endTrimMs", "End Trim", 0, 2000, 1, "ms"],
          ["fadeInMs", "Fade In", 0, 500, 1, "ms"],
          ["fadeOutMs", "Fade Out", 0, 500, 1, "ms"],
          ["volume", "Volume", 0, 1.5, 0.01, "×"],
          ["pitchSemitones", "Pitch", -24, 24, 1, "st"]
        ].map(([key, label, min, max, step, unit]) => (
          <label className="slider-control" key={key as string}>
            <span className="slider-label"><strong>{label}</strong><em>{track.settings[key as keyof TrackSettings]} {unit}</em></span>
            <input type="range" min={min as number} max={max as number} step={step as number} value={track.settings[key as keyof TrackSettings] as number} onChange={(event) => onChange(track.id, { [key as string]: Number(event.target.value) } as Partial<TrackSettings>)} />
            <input type="number" min={min as number} max={max as number} step={step as number} value={track.settings[key as keyof TrackSettings] as number} onChange={(event) => onChange(track.id, { [key as string]: Number(event.target.value) } as Partial<TrackSettings>)} />
          </label>
        ))}
      </div>

      <div className="nudge-row">
        <button type="button" onClick={() => onChange(track.id, { startOffsetMs: 0, endTrimMs: 0, fadeInMs: 0, fadeOutMs: 5 })}>Reset Trim</button>
        <button type="button" disabled>Trim silence coming soon</button>
        <button type="button" disabled>Detect transient coming soon</button>
      </div>
    </div>
  );
}
