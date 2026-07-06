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
import WindowPanel, { WindowPanelState } from "@/components/WindowPanel";
import { setBpm, startAudio, stopTransport, Tone, playSample, triggerSample } from "@/lib/audioEngine";
import { downloadBlob, renderTrackDryWav, safeFilename } from "@/lib/renderWav";
import { buildChord, semitoneDiff } from "@/lib/musicTheory";
import { skins } from "@/lib/skins";
import type { ArrangementSlot, PatternId, Sample, SequencerStep, SequencerTrack, TrackEffect, TrackSettings } from "@/types";

type PanelId = "library" | "sequencer" | "trackControls" | "arrangement" | "export" | "guitar";
const normalPanels: Record<PanelId, WindowPanelState> = { library: "normal", sequencer: "normal", trackControls: "normal", arrangement: "normal", export: "normal", guitar: "normal" };
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
  const [availablePatterns, setAvailablePatterns] = useState<PatternId[]>(["A"]);
  const [patterns, setPatterns] = useState<PatternSteps>(() => ({ A: {} }));
  const patternsRef = useRef<PatternSteps>({ A: {} });
  const [copiedPattern, setCopiedPattern] = useState<Record<number, SequencerStep[]> | undefined>();
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
      const nextTrack = { id: nextId, name: `Track ${nextId}`, assignedSample: undefined, steps: makeSteps(tracksRef.current[0]?.steps.length ?? 16), settings: { ...defaultTrackSettings }, mode: "oneshot" as const, rootNote: "C3", octaveRange: 1, effects: [] };
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
  function clearPattern(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: makeSteps(track.steps.length) } : track)); }
  function resetTrack(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, assignedSample: undefined, steps: makeSteps(track.steps.length), settings: { ...defaultTrackSettings }, mode: "oneshot", rootNote: "C3", octaveRange: 1, effects: [] } : track)); }
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

  function addPattern() {
    const next = String.fromCharCode(65 + availablePatterns.length);
    const stepCount = tracksRef.current[0]?.steps.length ?? 16;
    const currentSnapshot = Object.fromEntries(tracksRef.current.map((track) => [track.id, cloneSteps(track.steps)]));
    const emptySnapshot = Object.fromEntries(tracksRef.current.map((track) => [track.id, makeSteps(stepCount)]));
    const nextPatterns = { ...patternsRef.current, [activePatternRef.current]: currentSnapshot, [next]: emptySnapshot };
    patternsRef.current = nextPatterns;
    setPatterns(nextPatterns);
    setAvailablePatterns((old) => [...old, next]);
    activePatternRef.current = next;
    setActivePattern(next);
    skipNextPatternSyncRef.current = true;
    setTracks((oldTracks) => oldTracks.map((track) => ({ ...track, steps: makeSteps(stepCount) })));
    setStatus(`Added Pattern ${next}.`);
  }
  function removePattern(pattern: PatternId) { if (availablePatterns.length <= 1 || pattern === availablePatterns[0]) return; setAvailablePatterns((old) => old.filter((item) => item !== pattern)); setTimeline((old) => old.map((slot) => slot === pattern ? "" : slot)); setPatterns((old) => { const next = { ...old }; delete next[pattern]; return next; }); if (activePatternRef.current === pattern) loadPattern(availablePatterns[0]); }
  function copyPattern() { setCopiedPattern(Object.fromEntries(tracksRef.current.map((track) => [track.id, cloneSteps(track.steps)]))); setStatus(`Copied Pattern ${activePatternRef.current}.`); }
  function pastePattern() { if (!copiedPattern) return; const snapshot = copiedPattern; setTracks((oldTracks) => oldTracks.map((track) => ({ ...track, steps: snapshot[track.id] ? cloneSteps(snapshot[track.id]) : makeSteps(track.steps.length) }))); setStatus(`Pasted copied pattern into Pattern ${activePatternRef.current}.`); }
  function changeStepCount(count: number) { if (![4,8,16,24,32].includes(count)) return; setTracks((oldTracks) => oldTracks.map((track) => ({ ...track, steps: Array.from({ length: count }, (_, index) => track.steps[index] ? { ...track.steps[index], notes: track.steps[index].notes ? [...track.steps[index].notes] : undefined } : { active: false }) }))); }

  function cycleTimelineSlot(index: number) {
    const cycle: ArrangementSlot[] = ["", ...availablePatterns];
    setTimeline((old) => old.map((slot, i) => i === index ? cycle[(cycle.indexOf(slot) + 1) % cycle.length] : slot));
  }

  async function playArrangement() {
    const slots = timeline as PatternId[];
    if (!slots.length) { setStatus("Add pattern blocks to the arrangement timeline first."); return; }
    stopSequencer();
    await startAudio();
    setArrangementPlaying(true);
    let slotIndex = 0;
    const patternMs = ((tracksRef.current[0]?.steps.length ?? 16) * (60 / bpm) / 4) * 1000;
    const runSlot = () => {
      const pattern = slots[slotIndex];
      if (pattern) loadPattern(pattern);
      setStatus(pattern ? `Playing arrangement slot ${slotIndex + 1}: Pattern ${pattern}.` : `Playing arrangement slot ${slotIndex + 1}: empty.`);
      if (pattern) void startSequencer(); else { stopTransport(); disposeSequencer(); setCurrentStep(0); setIsPlaying(false); }
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
      step = (step + 1) % Math.max(1, tracksRef.current[0]?.steps.length ?? 16);
    }, "16n");
    Tone.Transport.start();
    setIsPlaying(true);
    setStatus("Playing.");
  }

  async function renderTrack(track: SequencerTrack, variant: "processed" | "dry") {
    try {
      const blob = await renderTrackDryWav(track);
      const suffix = variant === "dry" ? "dry" : "processed";
      downloadBlob(blob, `track-${track.id}-${safeFilename(track.assignedSample?.name ?? "sample")}-${suffix}.wav`);
      setStatus(`Downloaded ${track.name} ${suffix} WAV. FX render is coming soon; this uses trim/fade/pitch/volume.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not render WAV."); }
  }

  function exportProjectJson() {
    const project = { version: 1, bpm, selectedSkinId, tracks, patterns: { ...patternsRef.current, [activePatternRef.current]: Object.fromEntries(tracksRef.current.map((track) => [track.id, cloneSteps(track.steps)])) }, availablePatterns, activePattern, timeline };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "beatmaker-project.json");
    setStatus("Downloaded project JSON. Samples must still exist locally.");
  }

  function importProjectJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => { try { const project = JSON.parse(String(reader.result)); setBpmState(project.bpm ?? bpm); setSelectedSkinId(project.selectedSkinId ?? selectedSkinId); setAvailablePatterns(project.availablePatterns ?? ["A"]); setPatterns(project.patterns ?? { A: {} }); setTimeline(project.timeline ?? Array.from({ length: 16 }, () => "")); if (project.tracks) setTracks(project.tracks); setActivePattern(project.activePattern ?? "A"); setStatus("Imported project JSON. Audio files are referenced by local sample paths."); } catch { setStatus("Could not import project JSON."); } };
    reader.readAsText(file);
  }

  function setPanelState(panelId: PanelId, panelState: WindowPanelState) {
    setPanels((oldPanels) => ({ ...oldPanels, [panelId]: panelState }));
  }

  const themeStyle = selectedSkin.variables as CSSProperties;

  return (
    <main className="app-shell" style={themeStyle}>
      <Toolbar bpm={bpm} isPlaying={isPlaying} status={status} skins={skins} selectedSkinId={selectedSkinId} onPlay={startSequencer} onStop={stopSequencer} onBpmChange={setBpmState} onSkinChange={setSelectedSkinId} onResetLayout={() => setPanels(normalPanels)} />
      <div className="workspace-grid">
        <div className="left-column"><WindowPanel title="Sample Library" state={panels.library} onStateChange={(state) => setPanelState("library", state)} className="sample-window"><SampleLibrary samples={samples} onPreview={previewSample} onAssign={assignSample} /></WindowPanel><WindowPanel title="Guitar Tools" state={panels.guitar} onStateChange={(state) => setPanelState("guitar", state)}><GuitarTools /></WindowPanel><WindowPanel title="Export" state={panels.export} onStateChange={(state) => setPanelState("export", state)}><ExportPanel onExportProject={exportProjectJson} onImportProject={importProjectJson} onComingSoon={(feature) => setStatus(`Coming soon: ${feature}`)} /></WindowPanel></div>
        <div className="main-column"><WindowPanel title="Step Sequencer" state={panels.sequencer} onStateChange={(state) => setPanelState("sequencer", state)} className="sequencer-window"><StepSequencer tracks={tracks} currentStep={currentStep} selectedTrackId={selectedTrackId} selectedStepIndex={selectedStepIndex} onToggleStep={toggleStep} onSelectTrack={selectTrack} onAddTrack={addTrack} onRemoveTrack={removeTrack} activePattern={activePattern} stepCount={tracks[0]?.steps.length ?? 16} onStepCountChange={changeStepCount} /></WindowPanel>
        <WindowPanel title="Track Controls" state={panels.trackControls} onStateChange={(state) => setPanelState("trackControls", state)}><TrackControls track={selectedTrack} selectedStepIndex={selectedStepIndex} onChange={updateTrackSettings} onTrackChange={updateTrack} onStepNoteChange={updateStepNote} onStepChordChange={updateStepChord} onStepNotesChange={updateStepNotes} onEffectsChange={updateTrackEffects} onResetSettings={resetPlaybackSettings} onClearNotes={clearStepNotes} onClearPattern={clearPattern} onResetTrack={resetTrack} onPreview={previewTrack} onRenderTrack={renderTrack} onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} playheadMs={playheadMs} /></WindowPanel>
        <WindowPanel title="Arrangement" state={panels.arrangement} onStateChange={(state) => setPanelState("arrangement", state)}><ArrangementPanel activePattern={activePattern} patterns={availablePatterns} copiedPattern={copiedPattern ? "copied" : undefined} timeline={timeline} arrangementPlaying={arrangementPlaying} onSelectPattern={loadPattern} onAddPattern={addPattern} onRemovePattern={removePattern} onCopyPattern={copyPattern} onPastePattern={pastePattern} onCycleSlot={cycleTimelineSlot} onPlayArrangement={playArrangement} onStop={stopArrangement} /></WindowPanel></div>
      </div>
    </main>
  );
}
