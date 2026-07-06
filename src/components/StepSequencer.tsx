import type { SequencerTrack, Sample } from "@/types";

type Props = { tracks: SequencerTrack[]; currentStep: number; onToggleStep: (trackId: number, stepIndex: number) => void; onSelectTrack: (trackId: number) => void; selectedTrackId: number; };

export function makeInitialTracks(defaultSample?: Sample): SequencerTrack[] {
  return Array.from({ length: 4 }, (_, index) => ({ id: index + 1, name: `Track ${index + 1}`, assignedSample: index === 0 ? defaultSample : undefined, steps: Array(16).fill(false) }));
}

export default function StepSequencer({ tracks, currentStep, onToggleStep, onSelectTrack, selectedTrackId }: Props) {
  return (
    <section className="panel sequencer-panel">
      <h2>Step Sequencer</h2>
      <div className="step-numbers">{Array.from({ length: 16 }, (_, step) => <span key={step}>{step + 1}</span>)}</div>
      {tracks.map((track) => (
        <div className={`track-row ${selectedTrackId === track.id ? "selected-track" : ""}`} key={track.id} onClick={() => onSelectTrack(track.id)}>
          <div className="track-label"><strong>{track.name}</strong><small>{track.assignedSample?.name ?? "No sample"}</small></div>
          <div className="steps">
            {track.steps.map((isOn, stepIndex) => (
              <button key={stepIndex} className={`step ${isOn ? "on" : ""} ${currentStep === stepIndex ? "playing" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleStep(track.id, stepIndex); }} aria-label={`${track.name} step ${stepIndex + 1}`} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
