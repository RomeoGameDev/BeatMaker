"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import ArrangementPanel from "@/components/ArrangementPanel";
import ExportPanel from "@/components/ExportPanel";
import GuitarTools from "@/components/GuitarTools";
import SampleLibrary from "@/components/SampleLibrary";
import StepSequencer, { makeInitialTracks } from "@/components/StepSequencer";
import Toolbar from "@/components/Toolbar";
import WaveformPanel from "@/components/WaveformPanel";
import { getSamplePlayer, playSample, setBpm, startAudio, stopTransport, Tone } from "@/lib/audioEngine";
import { skins } from "@/lib/skins";
import type { Sample, SequencerTrack } from "@/types";

export default function HomeClient({ samples }: { samples: Sample[] }) {
  const [bpm, setBpmState] = useState(105);
  const [status, setStatus] = useState("Ready. Add samples to public/samples to hear audio.");
  const [selectedSkinId, setSelectedSkinId] = useState(skins[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [selectedSample, setSelectedSample] = useState<Sample | undefined>(samples[0]);
  const [tracks, setTracks] = useState<SequencerTrack[]>(() => makeInitialTracks(samples[0]));
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedSkin = useMemo(() => skins.find((skin) => skin.id === selectedSkinId) ?? skins[0], [selectedSkinId]);

  useEffect(() => { setBpm(bpm); }, [bpm]);

  function assignSample(sample: Sample) {
    setSelectedSample(sample);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === selectedTrackId ? { ...track, assignedSample: sample } : track));
    setStatus(`${sample.name} assigned to Track ${selectedTrackId}.`);
  }

  function toggleStep(trackId: number, stepIndex: number) {
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, steps: track.steps.map((isOn, index) => index === stepIndex ? !isOn : isOn) } : track));
  }

  async function previewSample(sample: Sample) {
    try { await playSample(sample); setSelectedSample(sample); setStatus(`Previewing ${sample.name}.`); }
    catch { setStatus(`Could not play ${sample.name}. Make sure the file exists at ${sample.path}.`); }
  }

  async function playSequence() {
    await startAudio();
    stopTransport();
    setBpm(bpm);
    Tone.Transport.scheduleRepeat((time) => {
      const step = Math.floor(Tone.Transport.ticks / Tone.Transport.PPQ) % 16;
      setCurrentStep(step);
      tracks.forEach((track) => {
        if (track.steps[step] && track.assignedSample) {
          const player = getSamplePlayer(track.assignedSample);
          player.start(time);
        }
      });
    }, "16n");
    Tone.Transport.start();
    setIsPlaying(true);
    setStatus("Playing sequence.");
  }

  function stopSequence() {
    stopTransport();
    setCurrentStep(-1);
    setIsPlaying(false);
    setStatus("Stopped.");
  }

  const themeStyle = selectedSkin.variables as CSSProperties;

  return (
    <main className="app-shell" style={themeStyle}>
      <Toolbar bpm={bpm} isPlaying={isPlaying} status={status} skins={skins} selectedSkinId={selectedSkinId} onPlay={playSequence} onStop={stopSequence} onBpmChange={setBpmState} onSkinChange={setSelectedSkinId} />
      <div className="workspace-grid">
        <SampleLibrary samples={samples} onPreview={previewSample} onAssign={assignSample} />
        <StepSequencer tracks={tracks} currentStep={currentStep} selectedTrackId={selectedTrackId} onToggleStep={toggleStep} onSelectTrack={setSelectedTrackId} />
        <ArrangementPanel />
        <WaveformPanel sample={selectedSample} />
        <ExportPanel onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} />
        <GuitarTools />
      </div>
    </main>
  );
}
