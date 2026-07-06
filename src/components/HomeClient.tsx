"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ArrangementPanel from "@/components/ArrangementPanel";
import ExportPanel from "@/components/ExportPanel";
import GuitarTools from "@/components/GuitarTools";
import SampleLibrary from "@/components/SampleLibrary";
import StepSequencer, { defaultTrackSettings, makeInitialTracks, makeSteps } from "@/components/StepSequencer";
import Toolbar from "@/components/Toolbar";
import TrackControls from "@/components/TrackControls";
import WaveformPanel from "@/components/WaveformPanel";
import WindowPanel, { WindowPanelState } from "@/components/WindowPanel";
import { setBpm, startAudio, stopTransport, Tone, playSample, triggerSample } from "@/lib/audioEngine";
import { buildChord, semitoneDiff } from "@/lib/musicTheory";
import { skins } from "@/lib/skins";
import type { ArrangementSlot, PatternId, Sample, SequencerStep, SequencerTrack, TrackEffect, TrackSettings } from "@/types";

type PanelId = "library" | "sequencer" | "trackControls" | "arrangement" | "waveform" | "export" | "guitar";
const normalPanels: Record<PanelId, WindowPanelState> = { library: "normal", sequencer: "normal", trackControls: "normal", arrangement: "normal", waveform: "normal", export: "normal", guitar: "normal" };
const patternIds: PatternId[] = ["A", "B", "C", "D"];
type PatternSteps = Record<PatternId, Record<number, SequencerStep[]>>;
const cloneSteps = (steps: SequencerStep[]) => steps.map((step) => ({ ...step, notes: step.notes ? [...step.notes] : undefined }));

export default function HomeClient({ samples }: { samples: Sample[] }) {
  const [bpm, setBpmState] = useState(105);
  const [status, setStatus] = useState("Ready. Add samples to public/samples to hear audio.");
  const [selectedSkinId, setSelectedSkinId] = useState(skins[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | undefined>(undefined);
  const [tracks, setTracks] = useState<SequencerTrack[]>(() => makeInitialTracks(samples[0]));
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [panels, setPanels] = useState<Record<PanelId, WindowPanelState>>(normalPanels);
  const schedulerIdRef = useRef<number | null>(null);
  const arrangementTimerRef = useRef<number | null>(null);
  const tracksRef = useRef(tracks);
  const [activePattern, setActivePattern] = useState<PatternId>("A");
  const activePatternRef = useRef<PatternId>("A");
  const [patterns, setPatterns] = useState<PatternSteps>(() => ({ A: {}, B: {}, C: {}, D: {} }));
  const patternsRef = useRef<PatternSteps>({ A: {}, B: {}, C: {}, D: {} });
  const skipNextPatternSyncRef = useRef(false);
  const [timeline, setTimeline] = useState<ArrangementSlot[]>(() => Array.from({ length: 16 }, () => ""));
  const [arrangementPlaying, setArrangementPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState<number | undefined>(undefined);
  const playheadFrameRef = useRef<number | null>(null);

  const selectedSkin = useMemo(() => skins.find((skin) => skin.id === selectedSkinId) ?? skins[0], [selectedSkinId]);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);

  useEffect(() => { setBpm(bpm); }, [bpm]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { activePatternRef.current = activePattern; }, [activePattern]);
  useEffect(() => {
    if (skipNextPatternSyncRef.current) { skipNextPatternSyncRef.current = false; return; }
    setPatterns((old) => ({ ...old, [activePatternRef.current]: Object.fromEntries(tracks.map((track) => [track.id, cloneSteps(track.steps)])) } as PatternSteps));
  }, [tracks]);
  useEffect(() => () => disposeSequencer(), []);

  function assignSample(sample: Sample) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === selectedTrackId ? { ...track, assignedSample: sample } : track));
    setStatus(`${sample.name} assigned to Track ${selectedTrackId}.`);
  }

  function toggleStep(trackId: number, stepIndex: number) {
    setSelectedTrackId(trackId);
    setSelectedStepIndex(stepIndex);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => index === stepIndex ? { ...step, active: !step.active } : step) } : track));
  }

  function selectTrack(trackId: number) {
    setSelectedTrackId(trackId);
    setSelectedStepIndex(undefined);
  }

  function updateTrackSettings(trackId: number, settings: Partial<TrackSettings>) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, settings: { ...track.settings, ...settings } } : track));
  }

  function updateTrack(trackId: number, updates: Partial<Pick<SequencerTrack, "mode" | "rootNote" | "octaveRange">>) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, ...updates } : track));
  }
  function updateTrackEffects(trackId: number, effects: TrackEffect[]) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, effects } : track));
  }

  function updateStepNote(trackId: number, stepIndex: number, note: string) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => index === stepIndex ? { ...step, active: true, note, chord: undefined, notes: undefined } : step) } : track));
  }

  function updateStepChord(trackId: number, stepIndex: number, rootNote: string, chord: string) {
    const notes = buildChord(rootNote, chord);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => index === stepIndex ? { ...step, active: true, note: rootNote, chord, notes } : step) } : track));
  }
  function updateStepNotes(trackId: number, stepIndex: number, notes: string[]) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => index === stepIndex ? { active: notes.length > 0, note: notes[0], notes, chord: undefined } : step) } : track));
  }

  function addTrack() {
    setTracks((oldTracks) => {
      const nextId = Math.max(0, ...oldTracks.map((track) => track.id)) + 1;
      const nextTrack = { id: nextId, name: `Track ${nextId}`, assignedSample: undefined, steps: makeSteps(), settings: { ...defaultTrackSettings }, mode: "oneshot" as const, rootNote: "C3", octaveRange: 1, effects: [] };
      setSelectedTrackId(nextId);
      setSelectedStepIndex(undefined);
      return [...oldTracks, nextTrack];
    });
  }

  function removeTrack(trackId: number) {
    setTracks((oldTracks) => {
      if (oldTracks.length <= 1) return oldTracks;
      const remaining = oldTracks.filter((track) => track.id !== trackId);
      if (selectedTrackId === trackId) {
        setSelectedTrackId(remaining[0].id);
        setSelectedStepIndex(undefined);
      }
      return remaining;
    });
  }

  function resetPlaybackSettings(trackId: number) { updateTrackSettings(trackId, defaultTrackSettings); }
  function clearStepNotes(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => selectedStepIndex === undefined || index === selectedStepIndex ? ({ active: step.active }) : step) } : track)); }
  function clearPattern(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: makeSteps() } : track)); }
  function resetTrack(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, assignedSample: undefined, steps: makeSteps(), settings: { ...defaultTrackSettings }, mode: "oneshot", rootNote: "C3", octaveRange: 1, effects: [] } : track)); }
  function animatePlayhead(track: SequencerTrack) {
    if (playheadFrameRef.current !== null) cancelAnimationFrame(playheadFrameRef.current);
    const start = track.settings.startOffsetMs;
    const duration = Math.max(120, 2000 - track.settings.endTrimMs - start);
    const started = performance.now();
    // TODO: Replace this approximate visual timer with sample-accurate playhead sync later.
    const tick = () => {
      const elapsed = performance.now() - started;
      setPlayheadMs(start + Math.min(duration, elapsed));
      if (elapsed < duration) playheadFrameRef.current = requestAnimationFrame(tick);
      else playheadFrameRef.current = null;
    };
    tick();
  }

  async function previewSample(sample: Sample) {
    const result = await playSample(sample);
    setStatus(result.ok ? `Previewing ${sample.name}.` : result.message);
  }

  async function previewTrack(track: SequencerTrack) {
    if (!track.assignedSample) {
      setStatus("Sample file missing or unsupported.");
      return;
    }

    animatePlayhead(track);
    const result = await triggerSample(track.assignedSample, track.settings, Tone.now(), track.effects);
    setStatus(result.ok ? "Playing." : result.message);
  }

  function triggerStep(step: number, time: Tone.Unit.Time) {
    const activeTracks = tracksRef.current;
    const hasSolo = activeTracks.some((track) => track.settings.solo);
    activeTracks.forEach((track) => {
      const stepData = track.steps[step];
      if (!stepData?.active || !track.assignedSample || track.settings.mute) return;
      if (hasSolo && !track.settings.solo) return;
      if (track.mode === "keyboard" && (stepData.notes?.length || stepData.chord)) {
        const chordNotes = stepData.notes?.length ? stepData.notes : buildChord(stepData.note ?? track.rootNote, stepData.chord ?? "major");
        if (track.id === selectedTrackId) animatePlayhead(track);
        chordNotes.forEach((note) => {
          const pitchSemitones = track.settings.pitchSemitones + semitoneDiff(track.rootNote, note);
          void triggerSample(track.assignedSample, { ...track.settings, pitchSemitones }, time, track.effects);
        });
        return;
      }
      const pitchSemitones = track.mode === "keyboard" ? track.settings.pitchSemitones + semitoneDiff(track.rootNote, stepData.note ?? track.rootNote) : track.settings.pitchSemitones;
      if (track.id === selectedTrackId) animatePlayhead(track);
      void triggerSample(track.assignedSample, { ...track.settings, pitchSemitones }, time, track.effects);
    });
  }

  function loadPattern(pattern: PatternId) {
    const currentPattern = activePatternRef.current;
    const currentTracks = tracksRef.current;
    const saved = { ...patternsRef.current, [currentPattern]: Object.fromEntries(currentTracks.map((track) => [track.id, cloneSteps(track.steps)])) } as PatternSteps;
    patternsRef.current = saved;
    setPatterns(saved);
    const source = saved[pattern];
    activePatternRef.current = pattern;
    setActivePattern(pattern);
    skipNextPatternSyncRef.current = true;
    setTracks((oldTracks) => oldTracks.map((track) => ({ ...track, steps: source[track.id] ? cloneSteps(source[track.id]) : makeSteps() })));
    setStatus(`Editing Pattern ${pattern}.`);
  }

  function duplicatePattern(target: PatternId) {
    const snapshot = Object.fromEntries(tracksRef.current.map((track) => [track.id, cloneSteps(track.steps)]));
    setPatterns((old) => ({ ...old, [target]: snapshot } as PatternSteps));
    setStatus(`Duplicated Pattern ${activePatternRef.current} to Pattern ${target}.`);
  }

  function clearActivePattern() {
    setTracks((oldTracks) => oldTracks.map((track) => ({ ...track, steps: makeSteps() })));
    setStatus(`Cleared Pattern ${activePatternRef.current}.`);
  }

  function cycleTimelineSlot(index: number) {
    const cycle: ArrangementSlot[] = ["", ...patternIds];
    setTimeline((old) => old.map((slot, i) => i === index ? cycle[(cycle.indexOf(slot) + 1) % cycle.length] : slot));
  }

  async function playArrangement() {
    const slots = timeline.filter(Boolean) as PatternId[];
    if (!slots.length) { setStatus("Add pattern blocks to the arrangement timeline first."); return; }
    stopSequencer();
    await startAudio();
    setArrangementPlaying(true);
    let slotIndex = 0;
    const patternMs = (60 / bpm) * 4 * 1000;
    const runSlot = () => {
      const pattern = slots[slotIndex];
      loadPattern(pattern);
      setStatus(`Playing arrangement slot ${slotIndex + 1}: Pattern ${pattern}.`);
      void startSequencer();
      slotIndex += 1;
      if (slotIndex >= slots.length) { arrangementTimerRef.current = window.setTimeout(() => { stopSequencer(); setArrangementPlaying(false); arrangementTimerRef.current = null; setStatus("Arrangement finished."); }, patternMs); return; }
      arrangementTimerRef.current = window.setTimeout(runSlot, patternMs);
    };
    runSlot();
  }

  function stopArrangement() {
    if (arrangementTimerRef.current !== null) window.clearTimeout(arrangementTimerRef.current);
    arrangementTimerRef.current = null;
    setArrangementPlaying(false);
    stopSequencer();
  }

  function disposeSequencer() {
    // Always clear the stored scheduler before making a new one. This prevents
    // duplicate Tone.Transport callbacks from stacking after repeated Play clicks
    // or React re-renders.
    if (schedulerIdRef.current !== null) {
      Tone.Transport.clear(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    Tone.Transport.cancel();
  }

  function stopSequencer() {
    if (arrangementTimerRef.current !== null) { window.clearTimeout(arrangementTimerRef.current); arrangementTimerRef.current = null; setArrangementPlaying(false); }
    stopTransport();
    disposeSequencer();
    setCurrentStep(0);
    setIsPlaying(false);
    setStatus("Stopped.");
  }

  async function startSequencer() {
    await startAudio();
    disposeSequencer();
    stopTransport();
    setBpm(bpm);
    let step = 0;
    schedulerIdRef.current = Tone.Transport.scheduleRepeat((time) => {
      setCurrentStep(step);
      triggerStep(step, time);
      step = (step + 1) % 16;
    }, "16n");
    Tone.Transport.start();
    setIsPlaying(true);
    setStatus("Playing.");
  }

  function setPanelState(panelId: PanelId, panelState: WindowPanelState) {
    setPanels((oldPanels) => ({ ...oldPanels, [panelId]: panelState }));
  }

  const themeStyle = selectedSkin.variables as CSSProperties;

  return (
    <main className="app-shell" style={themeStyle}>
      <Toolbar bpm={bpm} isPlaying={isPlaying} status={status} skins={skins} selectedSkinId={selectedSkinId} onPlay={startSequencer} onStop={stopSequencer} onBpmChange={setBpmState} onSkinChange={setSelectedSkinId} onResetLayout={() => setPanels(normalPanels)} />
      <div className="workspace-grid">
        <WindowPanel title="Sample Library" state={panels.library} onStateChange={(state) => setPanelState("library", state)} className="sample-window"><SampleLibrary samples={samples} onPreview={previewSample} onAssign={assignSample} /></WindowPanel>
        <WindowPanel title="Step Sequencer" state={panels.sequencer} onStateChange={(state) => setPanelState("sequencer", state)} className="sequencer-window"><StepSequencer tracks={tracks} currentStep={currentStep} selectedTrackId={selectedTrackId} selectedStepIndex={selectedStepIndex} onToggleStep={toggleStep} onSelectTrack={selectTrack} onAddTrack={addTrack} onRemoveTrack={removeTrack} /></WindowPanel>
        <WindowPanel title="Track Controls" state={panels.trackControls} onStateChange={(state) => setPanelState("trackControls", state)}><TrackControls track={selectedTrack} selectedStepIndex={selectedStepIndex} onChange={updateTrackSettings} onTrackChange={updateTrack} onStepNoteChange={updateStepNote} onStepChordChange={updateStepChord} onStepNotesChange={updateStepNotes} onEffectsChange={updateTrackEffects} onResetSettings={resetPlaybackSettings} onClearNotes={clearStepNotes} onClearPattern={clearPattern} onResetTrack={resetTrack} onPreview={previewTrack} playheadMs={playheadMs} /></WindowPanel>
        <WindowPanel title="Arrangement" state={panels.arrangement} onStateChange={(state) => setPanelState("arrangement", state)}><ArrangementPanel activePattern={activePattern} timeline={timeline} arrangementPlaying={arrangementPlaying} onSelectPattern={loadPattern} onDuplicatePattern={duplicatePattern} onClearPattern={clearActivePattern} onCycleSlot={cycleTimelineSlot} onPlayArrangement={playArrangement} onStop={stopArrangement} /></WindowPanel>
        <WindowPanel title="Sample Editor" state={panels.waveform} onStateChange={(state) => setPanelState("waveform", state)}><WaveformPanel samples={samples} onPreviewOriginal={previewSample} onStatus={setStatus} /></WindowPanel>
        <WindowPanel title="Export" state={panels.export} onStateChange={(state) => setPanelState("export", state)}><ExportPanel onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} /></WindowPanel>
        <WindowPanel title="Guitar Tools" state={panels.guitar} onStateChange={(state) => setPanelState("guitar", state)}><GuitarTools /></WindowPanel>
      </div>
    </main>
  );
}
