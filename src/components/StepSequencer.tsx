import type { SequencerTrack, Sample, TrackSettings } from "@/types";

const defaultTrackSettings: TrackSettings = {
  startOffsetMs: 0,
  endTrimMs: 0,
  fadeInMs: 0,
  fadeOutMs: 5,
  volume: 1,
  mute: false,
  solo: false,
  pitchSemitones: 0
};

type Props = { tracks: SequencerTrack[]; currentStep: number; onToggleStep: (trackId: number, stepIndex: number) => void; onSelectTrack: (trackId: number) => void; selectedTrackId: number; };

export function makeInitialTracks(defaultSample?: Sample): SequencerTrack[] {
  return Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    name: `Track ${index + 1}`,
    assignedSample: index === 0 ? defaultSample : undefined,
    steps: Array(16).fill(false),
    settings: { ...defaultTrackSettings }
  }));
}

export default function StepSequencer({ tracks, currentStep, onToggleStep, onSelectTrack, selectedTrackId }: Props) {
  return (
    <div className="sequencer-panel">
      <div className="step-numbers">{Array.from({ length: 16 }, (_, step) => <span key={step}>{step + 1}</span>)}</div>
      {tracks.map((track) => (
        <div className={`track-row ${selectedTrackId === track.id ? "selected-track" : ""}`} key={track.id} onClick={() => onSelectTrack(track.id)}>
          <div className="track-label"><strong>{track.name}</strong><small>{track.assignedSample?.name ?? "No sample"}{track.settings.mute ? " · muted" : ""}</small></div>
          <div className="steps">
            {track.steps.map((isOn, stepIndex) => (
              <button key={stepIndex} className={`step ${isOn ? "on" : ""} ${currentStep === stepIndex ? "playing" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleStep(track.id, stepIndex); }} aria-label={`${track.name} step ${stepIndex + 1}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
