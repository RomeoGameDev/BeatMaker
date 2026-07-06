"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ArrangementPanel from "@/components/ArrangementPanel";
import ExportPanel from "@/components/ExportPanel";
import GuitarTools from "@/components/GuitarTools";
import SampleLibrary from "@/components/SampleLibrary";
import StepSequencer, { makeInitialTracks } from "@/components/StepSequencer";
import Toolbar from "@/components/Toolbar";
import TrackControls from "@/components/TrackControls";
import WaveformPanel from "@/components/WaveformPanel";
import WindowPanel, { WindowPanelState } from "@/components/WindowPanel";
import { setBpm, startAudio, stopTransport, Tone, playSample, triggerOneShot } from "@/lib/audioEngine";
import { skins } from "@/lib/skins";
import type { Sample, SequencerTrack, TrackSettings } from "@/types";

type PanelId = "library" | "sequencer" | "trackControls" | "arrangement" | "waveform" | "export" | "guitar";
const normalPanels: Record<PanelId, WindowPanelState> = { library: "normal", sequencer: "normal", trackControls: "normal", arrangement: "normal", waveform: "normal", export: "normal", guitar: "normal" };

export default function HomeClient({ samples }: { samples: Sample[] }) {
  const [bpm, setBpmState] = useState(105);
  const [status, setStatus] = useState("Ready. Add samples to public/samples to hear audio.");
  const [selectedSkinId, setSelectedSkinId] = useState(skins[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [selectedSample, setSelectedSample] = useState<Sample | undefined>(samples[0]);
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
    setSelectedSample(sample);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === selectedTrackId ? { ...track, assignedSample: sample } : track));
    setStatus(`${sample.name} assigned to Track ${selectedTrackId}.`);
  }

  function toggleStep(trackId: number, stepIndex: number) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((isOn, index) => index === stepIndex ? !isOn : isOn) } : track));
  }

  function updateTrackSettings(trackId: number, settings: Partial<TrackSettings>) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, settings: { ...track.settings, ...settings } } : track));
  }

  async function previewSample(sample: Sample) {
    const result = await playSample(sample);
    setSelectedSample(sample);
    setStatus(result.ok ? `Previewing ${sample.name}.` : result.message);
  }

  async function previewTrack(track: SequencerTrack) {
    if (!track.assignedSample) {
      setStatus("Sample file missing or unsupported.");
      return;
    }

    const result = await triggerOneShot(track.assignedSample, track.settings, Tone.now());
    setStatus(result.ok ? "Playing." : result.message);
  }

  function triggerStep(step: number, time: Tone.Unit.Time) {
    const activeTracks = tracksRef.current;
    const hasSolo = activeTracks.some((track) => track.settings.solo);
    activeTracks.forEach((track) => {
      if (!track.steps[step] || !track.assignedSample || track.settings.mute) return;
      if (hasSolo && !track.settings.solo) return;
      // One Tone scheduler calls this function once per 16th note, so each active
      // track/step gets exactly one player.start(time, ...) call per cycle.
      void triggerOneShot(track.assignedSample, track.settings, time);
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
        <WindowPanel title="Step Sequencer" state={panels.sequencer} onStateChange={(state) => setPanelState("sequencer", state)} className="sequencer-window"><StepSequencer tracks={tracks} currentStep={currentStep} selectedTrackId={selectedTrackId} onToggleStep={toggleStep} onSelectTrack={setSelectedTrackId} /></WindowPanel>
        <WindowPanel title="Track Controls" state={panels.trackControls} onStateChange={(state) => setPanelState("trackControls", state)}><TrackControls track={selectedTrack} onChange={updateTrackSettings} onPreview={previewTrack} /></WindowPanel>
        <WindowPanel title="Arrangement" state={panels.arrangement} onStateChange={(state) => setPanelState("arrangement", state)}><ArrangementPanel /></WindowPanel>
        <WindowPanel title="Waveform / Slicer" state={panels.waveform} onStateChange={(state) => setPanelState("waveform", state)}><WaveformPanel sample={selectedSample} /></WindowPanel>
        <WindowPanel title="Export" state={panels.export} onStateChange={(state) => setPanelState("export", state)}><ExportPanel onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} /></WindowPanel>
        <WindowPanel title="Guitar Tools" state={panels.guitar} onStateChange={(state) => setPanelState("guitar", state)}><GuitarTools /></WindowPanel>
      </div>
    </main>
  );
}
