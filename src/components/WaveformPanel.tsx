import SampleWaveform from "@/components/SampleWaveform";
import { sliderControls } from "@/components/TrackControls";
import type { SequencerTrack, TrackSettings } from "@/types";

type Props = { track?: SequencerTrack; onChange: (trackId: number, settings: Partial<TrackSettings>) => void; onPreview: (track: SequencerTrack) => void; };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function WaveformPanel({ track, onChange, onPreview }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample playback settings.</p>;
  const sample = track.assignedSample;
  if (!sample) return <p className="hint">Assign a sample to this track first.</p>;
  const nudgeStart = (amount: number) => onChange(track.id, { startOffsetMs: clamp(track.settings.startOffsetMs + amount, 0, 2000) });
  return <div className="sample-editor"><div className="track-control-header"><div><p className="eyebrow">Sample Editor · {track.name}</p><h3>{sample.name}</h3><small>{sample.filename} · {sample.path} · {sample.category} · {sample.type}</small></div><button type="button" onClick={() => onPreview(track)}>Preview Sample</button></div><SampleWaveform sample={sample} settings={track.settings} /><div className="nudge-row"><button type="button" onClick={() => nudgeStart(-10)}>Start -10 ms</button><button type="button" onClick={() => nudgeStart(-1)}>Start -1 ms</button><button type="button" onClick={() => nudgeStart(1)}>Start +1 ms</button><button type="button" onClick={() => nudgeStart(10)}>Start +10 ms</button></div><div className="slider-stack">{sliderControls.map((control) => <label className="slider-control" key={control.key}><span className="slider-label"><strong>{control.label}</strong><em>{control.format(track.settings[control.key])}</em></span><input type="range" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={(event) => onChange(track.id, { [control.key]: Number(event.target.value) } as Partial<TrackSettings>)} /><input type="number" min={control.min} max={control.max} step={control.step} value={track.settings[control.key]} onChange={(event) => onChange(track.id, { [control.key]: Number(event.target.value) } as Partial<TrackSettings>)} /></label>)}</div><p className="hint">These controls edit the same selected track settings as Track Controls.</p></div>;
}
