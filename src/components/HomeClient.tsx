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
import type { Sample, SequencerTrack, TrackSettings } from "@/types";

type PanelId = "library" | "sequencer" | "trackControls" | "arrangement" | "waveform" | "export" | "guitar";
const normalPanels: Record<PanelId, WindowPanelState> = { library: "normal", sequencer: "normal", trackControls: "normal", arrangement: "normal", waveform: "normal", export: "normal", guitar: "normal" };

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
  const tracksRef = useRef(tracks);

  const selectedSkin = useMemo(() => skins.find((skin) => skin.id === selectedSkinId) ?? skins[0], [selectedSkinId]);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);

  useEffect(() => { setBpm(bpm); }, [bpm]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
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

  function updateStepNote(trackId: number, stepIndex: number, note: string) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => index === stepIndex ? { ...step, active: true, note, chord: undefined, notes: undefined } : step) } : track));
  }

  function updateStepChord(trackId: number, stepIndex: number, rootNote: string, chord: string) {
    const notes = buildChord(rootNote, chord);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step, index) => index === stepIndex ? { ...step, active: true, note: rootNote, chord, notes } : step) } : track));
  }

  function addTrack() {
    setTracks((oldTracks) => {
      const nextId = Math.max(0, ...oldTracks.map((track) => track.id)) + 1;
      const nextTrack = { id: nextId, name: `Track ${nextId}`, assignedSample: undefined, steps: makeSteps(), settings: { ...defaultTrackSettings }, mode: "oneshot" as const, rootNote: "C3", octaveRange: 1 };
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
  function clearStepNotes(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((step) => ({ active: step.active })) } : track)); }
  function clearPattern(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: makeSteps() } : track)); }
  function resetTrack(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, assignedSample: undefined, steps: makeSteps(), settings: { ...defaultTrackSettings }, mode: "oneshot", rootNote: "C3", octaveRange: 1 } : track)); }

  async function previewSample(sample: Sample) {
    const result = await playSample(sample);
    setStatus(result.ok ? `Previewing ${sample.name}.` : result.message);
  }

  async function previewTrack(track: SequencerTrack) {
    if (!track.assignedSample) {
      setStatus("Sample file missing or unsupported.");
      return;
    }

    const result = await triggerSample(track.assignedSample, track.settings, Tone.now());
    setStatus(result.ok ? "Playing." : result.message);
  }

  function triggerStep(step: number, time: Tone.Unit.Time) {
    const activeTracks = tracksRef.current;
    const hasSolo = activeTracks.some((track) => track.settings.solo);
    activeTracks.forEach((track) => {
      const stepData = track.steps[step];
      if (!stepData?.active || !track.assignedSample || track.settings.mute) return;
      if (hasSolo && !track.settings.solo) return;
      if (track.mode === "keyboard" && stepData.chord) {
        const chordNotes = stepData.notes?.length ? stepData.notes : buildChord(stepData.note ?? track.rootNote, stepData.chord);
        chordNotes.forEach((note) => {
          const pitchSemitones = track.settings.pitchSemitones + semitoneDiff(track.rootNote, note);
          void triggerSample(track.assignedSample, { ...track.settings, pitchSemitones }, time);
        });
        return;
      }
      const pitchSemitones = track.mode === "keyboard" ? track.settings.pitchSemitones + semitoneDiff(track.rootNote, stepData.note ?? track.rootNote) : track.settings.pitchSemitones;
      void triggerSample(track.assignedSample, { ...track.settings, pitchSemitones }, time);
    });
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
        <WindowPanel title="Track Controls" state={panels.trackControls} onStateChange={(state) => setPanelState("trackControls", state)}><TrackControls track={selectedTrack} selectedStepIndex={selectedStepIndex} onChange={updateTrackSettings} onTrackChange={updateTrack} onStepNoteChange={updateStepNote} onStepChordChange={updateStepChord} onResetSettings={resetPlaybackSettings} onClearNotes={clearStepNotes} onClearPattern={clearPattern} onResetTrack={resetTrack} onPreview={previewTrack} /></WindowPanel>
        <WindowPanel title="Arrangement" state={panels.arrangement} onStateChange={(state) => setPanelState("arrangement", state)}><ArrangementPanel /></WindowPanel>
        <WindowPanel title="Sample Editor" state={panels.waveform} onStateChange={(state) => setPanelState("waveform", state)}><WaveformPanel track={selectedTrack} onChange={updateTrackSettings} onPreview={previewTrack} /></WindowPanel>
        <WindowPanel title="Export" state={panels.export} onStateChange={(state) => setPanelState("export", state)}><ExportPanel onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} /></WindowPanel>
        <WindowPanel title="Guitar Tools" state={panels.guitar} onStateChange={(state) => setPanelState("guitar", state)}><GuitarTools /></WindowPanel>
      </div>
    </main>
  );
}
