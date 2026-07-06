import type { ChangeEvent } from "react";
import type { SequencerTrack, TrackSettings } from "@/types";

type Props = {
  track?: SequencerTrack;
  onChange: (trackId: number, settings: Partial<TrackSettings>) => void;
};

export default function TrackControls({ track, onChange }: Props) {
  if (!track) return <p className="hint">Select a track to edit sample trim and playback settings.</p>;

  const updateNumber = (key: keyof TrackSettings) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(track.id, { [key]: Number(event.target.value) } as Partial<TrackSettings>);
  };

  return (
    <div className="track-controls">
      <p><strong>{track.name}</strong> sample: <strong>{track.assignedSample?.name ?? "None assigned"}</strong></p>
      <div className="control-grid">
        <label>Start ms<input type="number" min="0" value={track.settings.startOffsetMs} onChange={updateNumber("startOffsetMs")} /></label>
        <label>End trim ms<input type="number" min="0" value={track.settings.endTrimMs} onChange={updateNumber("endTrimMs")} /></label>
        <label>Fade in ms<input type="number" min="0" value={track.settings.fadeInMs} onChange={updateNumber("fadeInMs")} /></label>
        <label>Fade out ms<input type="number" min="0" value={track.settings.fadeOutMs} onChange={updateNumber("fadeOutMs")} /></label>
        <label>Volume<input type="number" min="0" max="2" step="0.05" value={track.settings.volume} onChange={updateNumber("volume")} /></label>
        <label>Pitch semitones<input type="number" min="-24" max="24" value={track.settings.pitchSemitones} onChange={updateNumber("pitchSemitones")} /></label>
      </div>
      <div className="toggle-row">
        <label><input type="checkbox" checked={track.settings.mute} onChange={(event) => onChange(track.id, { mute: event.target.checked })} /> Mute</label>
        <label><input type="checkbox" checked={track.settings.solo} onChange={(event) => onChange(track.id, { solo: event.target.checked })} /> Solo</label>
      </div>
      <p className="hint">End trim is stored now and applied as a simple player duration cap when the buffer length is ready. TODO: move this into a visual waveform editor with mixer/effects routing.</p>
    </div>
  );
}
