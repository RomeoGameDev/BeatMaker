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

export const makeSteps = (count = 16): SequencerStep[] => Array.from({ length: count }, () => ({ active: false }));

type Props = {
  tracks: SequencerTrack[];
  bpm: number;
  currentStep: number;
  selectedTrackId: number;
  selectedStepIndex?: number;
  onToggleStep: (trackId: number, stepIndex: number) => void;
  onToggleSliceStep: (trackId: number, sliceId: string, stepIndex: number) => void;
  onToggleMute: (trackId: number) => void;
  onToggleSolo: (trackId: number) => void;
  onSelectTrack: (trackId: number) => void;
  onAddTrack: () => void;
  onRemoveTrack: (trackId: number) => void;
  activePattern: string;
  stepCount: number;
  onStepCountChange: (count: number) => void;
  onTrackSettingsChange: (trackId: number, settings: Partial<TrackSettings>) => void;
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
    effects: [],
    loopMode: defaultSample?.type === "loop" ? "play-full" : "oneshot",
    loopLengthSteps: defaultSample?.type === "loop" ? 16 : 16,
    retriggerLoop: false
  }));
}

export default function StepSequencer({ tracks, bpm, currentStep, selectedTrackId, selectedStepIndex, onToggleStep, onToggleSliceStep, onToggleMute, onToggleSolo, onSelectTrack, onAddTrack, onRemoveTrack, activePattern, stepCount, onStepCountChange, onTrackSettingsChange }: Props) {
  return (
    <div className="sequencer-panel">
      <div className="sequencer-actions"><strong>Editing Pattern {activePattern}</strong><label className="field-label">Steps<select value={stepCount} onChange={(event) => onStepCountChange(Number(event.target.value))}>{[4, 8, 16, 24, 32].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><button type="button" onClick={onAddTrack}>+ Add Track</button></div>
      <div className="step-numbers" style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}>{Array.from({ length: stepCount }, (_, step) => <span key={step}>{step + 1}</span>)}</div>
      {tracks.map((track) => (
        <div className={`track-row ${selectedTrackId === track.id ? "selected-track" : ""} ${track.mode === "sliced" ? "sliced-track" : ""}`} key={track.id} onClick={() => onSelectTrack(track.id)}>
          <div className="track-label"><strong>{track.name}</strong><span className="mode-badge">{track.mode}</span><small>{track.mode === "sliced" ? `Sliced · ${track.slices?.length ?? 0} slices · ${track.assignedSample?.name ?? "No source"}` : track.mode === "keyboard" ? `Keyboard · ${track.assignedSample?.name ?? "No sample"}` : (track.assignedSample?.type === "loop" || track.assignedSample?.isLong ? `Loop · ${track.loopLengthSteps ?? 16} steps · ${track.assignedSample?.name ?? "No sample"}` : `One-shot · ${track.assignedSample?.name ?? "No sample"}`)}</small><label className="quick-volume" onClick={(event) => event.stopPropagation()}>Vol <input type="range" min={0} max={1.5} step={0.01} value={track.settings.volume} onChange={(event) => onTrackSettingsChange(track.id, { volume: Number(event.target.value) })} /><em>{Math.round(track.settings.volume * 100)}%</em></label><label className="quick-volume" onClick={(event) => event.stopPropagation()}>Pitch <input type="range" min={-24} max={24} step={1} value={track.settings.pitchSemitones} onChange={(event) => onTrackSettingsChange(track.id, { pitchSemitones: Number(event.target.value) })} /><em>{track.settings.pitchSemitones}</em></label><div className="track-header-buttons"><button type="button" className={track.settings.mute ? "mute-button active" : "mute-button"} onClick={(event) => { event.stopPropagation(); onToggleMute(track.id); }}>Mute</button><button type="button" className={track.settings.solo ? "solo-button active" : "solo-button"} onClick={(event) => { event.stopPropagation(); onToggleSolo(track.id); }}>Solo</button>{tracks.length > 1 && <button type="button" className="remove-track" onClick={(event) => { event.stopPropagation(); onRemoveTrack(track.id); }}>Remove</button>}</div></div>
          {track.mode === "sliced" ? <div className="slice-step-rows">{(track.slices ?? []).map((slice) => <div className="slice-step-row" key={slice.id}><div className="slice-step-label"><span className="slice-dot" style={{ background: slice.color }} />{slice.name}</div><div className="steps" style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}>{(track.sliceSteps?.[slice.id] ?? []).map((step, stepIndex) => <button key={stepIndex} className={`step ${step.active ? "on" : ""} ${currentStep === stepIndex ? "playing" : ""}`} style={step.active ? { backgroundColor: slice.color } : undefined} onClick={(event) => { event.stopPropagation(); onToggleSliceStep(track.id, slice.id, stepIndex); }} aria-label={`${track.name} ${slice.name} step ${stepIndex + 1}`} />)}</div></div>)}</div> : <div className="steps" style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}>
            {track.steps.map((step, stepIndex) => {
              const isLoopTrack = Boolean(track.assignedSample && (track.assignedSample.type === "loop" || track.assignedSample.isLong || track.loopMode !== "oneshot")); const occupied = isLoopTrack && track.steps.some((candidate, candidateIndex) => candidate.active && stepIndex >= candidateIndex && stepIndex < candidateIndex + (track.loopLengthSteps ?? 16)); const isTrigger = step.active; const isSelected = selectedTrackId === track.id && selectedStepIndex === stepIndex; const label = track.mode === "keyboard" && step.active ? (step.chord && step.note ? formatChordLabel(step.note, step.chord) : step.notes?.length ? step.notes.map((note) => note.replace(/-?\d+$/, "")).join("-") : (step.note ?? track.rootNote)) : "";
              return <button key={stepIndex} className={`step ${isTrigger ? "on" : ""} ${occupied && !isTrigger ? "loop-occupied" : ""} ${currentStep === stepIndex ? "playing" : ""} ${isSelected ? "selected-step" : ""} ${track.mode === "keyboard" ? "keyboard-step" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleStep(track.id, stepIndex); }} aria-label={`${track.name} step ${stepIndex + 1}${label ? ` ${label}` : ""}`}>{label && <span>{label}</span>}</button>;
            })}
          </div>}
        </div>
      ))}
    </div>
  );
}
