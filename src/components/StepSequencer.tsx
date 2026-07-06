import type { SequencerTrack, Sample, TrackSettings, SequencerStep } from "@/types";
import { formatChordLabel } from "@/lib/musicTheory";

export const defaultTrackSettings: TrackSettings = {
  startOffsetMs: 0,
  endTrimMs: 0,
  fadeInMs: 0,
  fadeOutMs: 5,
  fadeInCurve: "linear",
  fadeOutCurve: "linear",
  volume: 1,
  mute: false,
  solo: false,
  pitchSemitones: 0
};

export const makeSteps = (): SequencerStep[] => Array.from({ length: 16 }, () => ({ active: false }));

type Props = {
  tracks: SequencerTrack[];
  currentStep: number;
  selectedTrackId: number;
  selectedStepIndex?: number;
  onToggleStep: (trackId: number, stepIndex: number) => void;
  onSelectTrack: (trackId: number) => void;
  onAddTrack: () => void;
  onRemoveTrack: (trackId: number) => void;
};

export function makeInitialTracks(defaultSample?: Sample): SequencerTrack[] {
  return Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    name: `Track ${index + 1}`,
    assignedSample: index === 0 ? defaultSample : undefined,
    steps: makeSteps(),
    settings: { ...defaultTrackSettings },
    mode: "oneshot",
    rootNote: "C3",
    octaveRange: 1,
    effects: []
  }));
}

export default function StepSequencer({ tracks, currentStep, selectedTrackId, selectedStepIndex, onToggleStep, onSelectTrack, onAddTrack, onRemoveTrack }: Props) {
  return (
    <div className="sequencer-panel">
      <div className="sequencer-actions"><button type="button" onClick={onAddTrack}>+ Add Track</button></div>
      <div className="step-numbers">{Array.from({ length: 16 }, (_, step) => <span key={step}>{step + 1}</span>)}</div>
      {tracks.map((track) => (
        <div className={`track-row ${selectedTrackId === track.id ? "selected-track" : ""}`} key={track.id} onClick={() => onSelectTrack(track.id)}>
          <div className="track-label"><strong>{track.name}</strong><small>{track.mode === "keyboard" ? "Keyboard" : "One-shot"} · {track.assignedSample?.name ?? "No sample"}{track.settings.mute ? " · muted" : ""}</small>{tracks.length > 1 && <button type="button" className="remove-track" onClick={(event) => { event.stopPropagation(); onRemoveTrack(track.id); }}>Remove</button>}</div>
          <div className="steps">
            {track.steps.map((step, stepIndex) => {
              const isSelected = selectedTrackId === track.id && selectedStepIndex === stepIndex;
              const label = track.mode === "keyboard" && step.active ? (step.chord && step.note ? formatChordLabel(step.note, step.chord) : step.notes?.length ? step.notes.map((note) => note.replace(/-?\d+$/, "")).join("-") : (step.note ?? track.rootNote)) : "";
              return (
                <button key={stepIndex} className={`step ${step.active ? "on" : ""} ${currentStep === stepIndex ? "playing" : ""} ${isSelected ? "selected-step" : ""} ${track.mode === "keyboard" ? "keyboard-step" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleStep(track.id, stepIndex); }} aria-label={`${track.name} step ${stepIndex + 1}${label ? ` ${label}` : ""}`}>
                  {label && <span>{label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
