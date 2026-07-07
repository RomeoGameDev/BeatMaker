"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ArrangementPanel, { arrangementSlotCounts, type ArrangementSlotCount } from "@/components/ArrangementPanel";
import ExportPanel from "@/components/ExportPanel";
import GuitarTools from "@/components/GuitarTools";
import SampleLibrary from "@/components/SampleLibrary";
import StepSequencer, { defaultTrackSettings, makeInitialTracks, makeSteps } from "@/components/StepSequencer";
import Toolbar from "@/components/Toolbar";
import TrackControls from "@/components/TrackControls";
import WindowPanel, { WindowPanelState } from "@/components/WindowPanel";
import { setBpm, startAudio, stopTransport, stopAllAudio, Tone, playSample, playHtmlAudioFallback, triggerSample } from "@/lib/audioEngine";
import { downloadBlob, renderPatternDryWav, renderTrackDryWav, safeFilename } from "@/lib/renderWav";
import { deleteRenderedSample, hasRenderedSample, loadRenderedSamples, saveRenderedSample } from "@/lib/renderedSampleStore";
import { SampleLoadError } from "@/lib/sampleLoader";
import { decodeSampleDuration, markSampleDuration } from "@/lib/sampleDuration";
import { buildChord, semitoneDiff } from "@/lib/musicTheory";
import { skins } from "@/lib/skins";
import type { ArrangementSlot, PatternId, Sample, SequencerStep, SequencerTrack, TrackEffect, TrackSettings } from "@/types";

type PanelId = "library" | "sequencer" | "trackControls" | "arrangement" | "export" | "guitar";
const normalPanels: Record<PanelId, WindowPanelState> = { library: "normal", sequencer: "normal", trackControls: "normal", arrangement: "normal", export: "normal", guitar: "normal" };
type PatternSteps = Record<PatternId, Record<number, SequencerStep[]>>;
const cloneSteps = (steps: SequencerStep[]) => steps.map((step) => ({ ...step, notes: step.notes ? [...step.notes] : undefined }));
const THEME_STORAGE_KEY = "beatmaker.selectedSkinId";
const LAYOUT_STORAGE_KEY = "beatmaker.layoutMode";
type LayoutMode = "compact" | "balanced" | "wide";

export default function HomeClient({ samples: initialSamples }: { samples: Sample[] }) {
  const [samples, setSamples] = useState<Sample[]>(initialSamples);
  const [bpm, setBpmState] = useState(105);
  const [status, setStatus] = useState("Ready. Add samples to public/samples to hear audio.");
  const [selectedSkinId, setSelectedSkinId] = useState(skins[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | undefined>(undefined);
  const [tracks, setTracks] = useState<SequencerTrack[]>(() => makeInitialTracks(samples[0]));
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [panels, setPanels] = useState<Record<PanelId, WindowPanelState>>(normalPanels);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("balanced");
  const schedulerIdRef = useRef<number | null>(null);
  const arrangementTimerRef = useRef<number | null>(null);
  const tracksRef = useRef(tracks);
  const samplesRef = useRef(samples);
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
  const activeLoopPlayersRef = useRef(new Map<number, { player?: Tone.Player; untilStep: number }>());
  const playheadFrameRef = useRef<number | null>(null);

  const selectedSkin = useMemo(() => skins.find((skin) => skin.id === selectedSkinId) ?? skins[0], [selectedSkinId]);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);

  useEffect(() => {
    const savedSkinId = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedSkinId && skins.some((skin) => skin.id === savedSkinId)) setSelectedSkinId(savedSkinId);
    const savedLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout === "compact" || savedLayout === "balanced" || savedLayout === "wide") setLayoutMode(savedLayout);
  }, []);
  useEffect(() => { window.localStorage.setItem(THEME_STORAGE_KEY, selectedSkin.id); }, [selectedSkin.id]);
  useEffect(() => { window.localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode); }, [layoutMode]);
  useEffect(() => { setBpm(bpm); }, [bpm]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { samplesRef.current = samples; }, [samples]);
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { activePatternRef.current = activePattern; }, [activePattern]);
  useEffect(() => {
    let cancelled = false;
    loadRenderedSamples()
      .then((stored) => {
        if (!cancelled && stored.length) {
          setSamples((old) => [...stored, ...old.filter((sample) => !stored.some((item) => item.id === sample.id))]);
          setStatus(`Loaded ${stored.length} rendered sample${stored.length === 1 ? "" : "s"} from local browser storage.`);
        }
      })
      .catch((error) => { console.warn("IndexedDB rendered sample load failed.", error); setStatus("Rendered sample local storage unavailable; new renders will only last for this session."); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (skipNextPatternSyncRef.current) { skipNextPatternSyncRef.current = false; return; }
    setPatterns((old) => ({ ...old, [activePatternRef.current]: Object.fromEntries(tracks.map((track) => [track.id, cloneSteps(track.steps)])) } as PatternSteps));
  }, [tracks]);
  useEffect(() => () => { clearPlayhead(); disposeSequencer(); samplesRef.current.forEach((sample) => { if (sample.path.startsWith("blob:")) URL.revokeObjectURL(sample.path); }); }, []);

  function clearPlayhead() {
    if (playheadFrameRef.current !== null) {
      cancelAnimationFrame(playheadFrameRef.current);
      playheadFrameRef.current = null;
    }
    setPlayheadMs(undefined);
  }

  function applySampleDuration(updated: Sample) {
    setSamples((old) => old.map((sample) => sample.path === updated.path ? { ...sample, ...updated } : sample));
    setTracks((old) => old.map((track) => track.assignedSample?.path === updated.path ? { ...track, assignedSample: { ...track.assignedSample, ...updated } } : track));
  }

  async function ensureDuration(sample: Sample) {
    const loadingSample = { ...sample, normalizedPath: sample.normalizedPath, loadStatus: "loading" as const, lastErrorMessage: undefined };
    applySampleDuration(loadingSample);
    try { const meta = await decodeSampleDuration(sample); const updated = { ...sample, ...meta }; applySampleDuration(updated); return updated; }
    catch (error) {
      const lastErrorMessage = error instanceof Error ? error.message : String(error);
      const loadStatus = error instanceof SampleLoadError ? error.status : "decode failed";
      const failedSample = { ...sample, normalizedPath: error instanceof SampleLoadError ? error.normalizedPath : sample.normalizedPath, loadStatus, lastErrorMessage };
      applySampleDuration(failedSample);
      console.warn("Could not decode sample duration.", error);
      return failedSample;
    }
  }

  function assignSample(sample: Sample) {
    void ensureDuration(sample);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === selectedTrackId ? { ...track, assignedSample: { ...sample, normalizedPath: sample.normalizedPath }, loopMode: (sample.type === "loop" || sample.isLong) ? "play-full" : "oneshot", loopLengthSteps: track.loopLengthSteps ?? 16, retriggerLoop: track.retriggerLoop ?? false } : track));
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

  function updateTrack(trackId: number, updates: Partial<Pick<SequencerTrack, "mode" | "rootNote" | "octaveRange" | "loopMode" | "loopLengthSteps" | "retriggerLoop">>) {
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

  async function removeSample(sample: Sample) {
    if (!(sample.isRendered || sample.source === "in-app" || sample.source === "converted" || sample.source === "indexeddb")) { setStatus("Physical samples must be removed from public/samples manually."); return; }
    if (sample.source === "indexeddb" || sample.isRendered) {
      try { await deleteRenderedSample(sample.id); } catch (error) { console.warn("Could not delete rendered sample from IndexedDB.", error); setStatus("Could not remove rendered sample from local storage."); return; }
    }
    if (sample.path.startsWith("blob:")) URL.revokeObjectURL(sample.path);
    setSamples((old) => old.filter((item) => item.id !== sample.id));
    let wasAssigned = false;
    setTracks((old) => old.map((track) => {
      if (track.assignedSample?.id !== sample.id) return track;
      wasAssigned = true;
      return { ...track, assignedSample: undefined };
    }));
    setStatus(wasAssigned ? `${sample.name} removed from local storage and unassigned from tracks.` : `${sample.name} removed from local rendered sample storage.`);
  }

  async function addRenderedSampleFromBlob({ blob, id, name, filename, type, category, durationSeconds, metadata }: { blob: Blob; id: string; name: string; filename: string; type: Sample["type"]; category: Sample["category"]; durationSeconds?: number; metadata?: Record<string, unknown> }) {
    const objectUrl = URL.createObjectURL(blob);
    const sample = markSampleDuration({ id, name, filename, type, category, path: objectUrl, isRendered: true, source: "indexeddb", createdAt: Date.now(), metadata, loadStatus: "loaded" }, durationSeconds ?? 0);
    setSamples((old) => [sample, ...old.filter((item) => item.id !== id)]);
    try { await saveRenderedSample({ id, name, filename, type, category, durationMs: sample.durationMs, createdAt: sample.createdAt ?? Date.now(), audio: blob, metadata }); }
    catch (error) { console.warn("Could not save rendered sample to IndexedDB.", error); setSamples((old) => old.map((item) => item.id === id ? { ...item, source: "in-app" } : item)); setStatus("Rendered sample added for this session only; IndexedDB save failed."); }
    return sample;
  }

  function addTrack() {
    setTracks((oldTracks) => {
      const nextId = Math.max(0, ...oldTracks.map((track) => track.id)) + 1;
      const nextTrack = { id: nextId, name: `Track ${nextId}`, assignedSample: undefined, steps: makeSteps(tracksRef.current[0]?.steps.length ?? 16), settings: { ...defaultTrackSettings }, mode: "oneshot" as const, rootNote: "C3", octaveRange: 1, effects: [], loopMode: "oneshot" as const, loopLengthSteps: 16, retriggerLoop: false };
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
  function resetTrack(trackId: number) { setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, assignedSample: undefined, steps: makeSteps(track.steps.length), settings: { ...defaultTrackSettings }, mode: "oneshot", rootNote: "C3", octaveRange: 1, effects: [], loopMode: "oneshot", loopLengthSteps: 16, retriggerLoop: false } : track)); }
  function animatePlayhead(track: SequencerTrack) {
    clearPlayhead();
    const sampleMs = track.assignedSample?.durationMs ?? 10000;
    const start = Math.min(track.settings.startOffsetMs, Math.max(0, sampleMs - 1));
    const end = Math.max(start + 1, sampleMs - track.settings.endTrimMs);
    const duration = Math.max(120, end - start);
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
    stopAllAudio();
    clearPlayhead();
    setStatus("Preview stopped.");
    const updated = await ensureDuration(sample);
    const result = await playSample(updated);
    setStatus(result.ok ? "Preview playing." : result.message);
  }

  async function previewTrack(track: SequencerTrack) {
    if (!track.assignedSample) {
      setStatus("Sample file missing or unsupported.");
      return;
    }

    animatePlayhead(track);
    const updated = await ensureDuration(track.assignedSample);
    const result = await triggerSample(updated, track.settings, Tone.now(), track.effects);
    if (result.status === "decode-failed") {
      const fallbackResult = await playHtmlAudioFallback(updated);
      setStatus(fallbackResult.ok ? fallbackResult.message : result.message);
      return;
    }
    setStatus(result.ok ? "Playing." : result.message);
  }

  function triggerStep(step: number, time: Tone.Unit.Time, absoluteStep = step) {
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
          void triggerSample(track.assignedSample, { ...track.settings, pitchSemitones }, time, track.effects).then((result) => { if (!result.ok && result.status === "decode-failed" && track.id === selectedTrackId) setStatus(result.message); });
        });
        return;
      }
      const pitchSemitones = track.mode === "keyboard" ? track.settings.pitchSemitones + semitoneDiff(track.rootNote, stepData.note ?? track.rootNote) : track.settings.pitchSemitones;
      const isLoop = track.assignedSample.type === "loop" || track.assignedSample.isLong || track.loopMode !== "oneshot";
      const loopLength = track.loopLengthSteps ?? 16;
      const activeLoop = activeLoopPlayersRef.current.get(track.id);
      if (isLoop && activeLoop && activeLoop.untilStep > absoluteStep) {
        if (!track.retriggerLoop) return;
        try { activeLoop.player?.stop(); activeLoop.player?.dispose(); } catch {}
      }
      if (track.id === selectedTrackId) animatePlayhead(track);
      const regionSeconds = (60 / bpm / 4) * loopLength;
      const duration = isLoop && (track.loopMode === "cut-to-step-length" || track.loopMode === "loop-region") ? regionSeconds : undefined;
      void triggerSample(track.assignedSample, { ...track.settings, pitchSemitones }, time, track.effects, duration).then((result) => { if (isLoop && result.ok) activeLoopPlayersRef.current.set(track.id, { player: result.player, untilStep: absoluteStep + loopLength }); if (!result.ok && result.status === "decode-failed" && track.id === selectedTrackId) setStatus(result.message); });
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

  function changeArrangementSlotCount(count: ArrangementSlotCount) {
    if (!arrangementSlotCounts.includes(count)) return;
    setTimeline((old) => Array.from({ length: count }, (_, index) => old[index] ?? ""));
  }

  function cycleTimelineSlot(index: number) {
    const cycle: ArrangementSlot[] = ["", ...availablePatterns];
    setTimeline((old) => old.map((slot, i) => i === index ? cycle[(cycle.indexOf(slot) + 1) % cycle.length] : slot));
  }

  async function playArrangement() {
    const slots = timeline.slice(0, timeline.length) as PatternId[];
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
    stopAllAudio();
    clearPlayhead();
    disposeSequencer();
    activeLoopPlayersRef.current.clear();
    setCurrentStep(0);
    setIsPlaying(false);
    setStatus("Stopped all audio.");
  }

  async function startSequencer() {
    await startAudio();
    disposeSequencer();
    stopAllAudio();
    clearPlayhead();
    setBpm(bpm);
    let absoluteStep = 0;
    schedulerIdRef.current = Tone.Transport.scheduleRepeat((time) => {
      const stepCount = Math.max(1, tracksRef.current[0]?.steps.length ?? 16);
      const step = absoluteStep % stepCount;
      setCurrentStep(step);
      triggerStep(step, time, absoluteStep);
      absoluteStep += 1;
    }, "16n");
    Tone.Transport.start();
    setIsPlaying(true);
    setStatus("Playing.");
  }

  async function renderTrack(track: SequencerTrack, variant: "processed" | "dry") {
    try {
      const blob = await renderTrackDryWav(track);
      const suffix = variant === "dry" ? "dry" : "processed";
      const baseName = `${safeFilename(track.assignedSample?.name ?? "sample")}-rendered-${Date.now()}`;
      await addRenderedSampleFromBlob({ blob, id: `rendered-${Date.now()}`, name: `${track.assignedSample?.name ?? "sample"}_rendered`, filename: `${baseName}.wav`, type: track.assignedSample?.type ?? "oneshot", category: "rendered", durationSeconds: blob.size ? (track.assignedSample?.durationSeconds ?? 0) : 0, metadata: { source: "track-render", trackId: track.id, variant } });
      if (variant === "dry") downloadBlob(blob, `${baseName}.wav`);
      setStatus(variant === "dry" ? "Rendered new sample and downloaded WAV. FX rendering into new sample coming soon." : "Rendered new sample in the Sample Library. FX rendering into new sample coming soon.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not render WAV."); }
  }

  async function exportCurrentPatternWav() {
    try {
      const blob = await renderPatternDryWav(tracksRef.current, bpm);
      downloadBlob(blob, "dusty-current-pattern.wav");
      setStatus("Pattern WAV exported. FX export coming soon; exported dry pattern.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Export render failed."); }
  }

  function exportProjectJson() {
    const scrubSample = (sample?: Sample) => sample?.isRendered ? { ...sample, path: "", audioStoredLocally: sample.source === "indexeddb" } : sample;
    const exportTracks = tracks.map((track) => ({ ...track, assignedSample: scrubSample(track.assignedSample) }));
    const project = { version: 1, bpm, selectedSkinId, tracks: exportTracks, patterns: { ...patternsRef.current, [activePatternRef.current]: Object.fromEntries(tracksRef.current.map((track) => [track.id, cloneSteps(track.steps)])) }, availablePatterns, activePattern, arrangementSlotCount: timeline.length, timeline, stepCountPerPattern: tracksRef.current[0]?.steps.length ?? 16, sampleReferences: tracksRef.current.map((track) => track.assignedSample ? { trackId: track.id, name: track.assignedSample.name, path: track.assignedSample.path } : undefined).filter(Boolean), renderedSampleWarning: "Rendered samples are stored locally in this browser via IndexedDB. Project JSON references them but does not contain audio." };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "beatmaker-project.json");
    setStatus("Project JSON exported. Rendered samples are stored locally via IndexedDB; JSON references them but does not contain audio.");
  }

  function importProjectJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => { void (async () => { try { const project = JSON.parse(String(reader.result)); setBpmState(project.bpm ?? bpm); setSelectedSkinId(project.selectedSkinId ?? selectedSkinId); setAvailablePatterns(project.availablePatterns ?? ["A"]); setPatterns(project.patterns ?? { A: {} }); setTimeline(Array.from({ length: project.arrangementSlotCount && arrangementSlotCounts.includes(project.arrangementSlotCount) ? project.arrangementSlotCount : (project.timeline?.length ?? 16) }, (_, index) => project.timeline?.[index] ?? "")); const importedTracks = project.tracks ?? tracks; const missing: string[] = []; for (const track of importedTracks) { const sample = track.assignedSample as Sample | undefined; if (sample?.isRendered && !(await hasRenderedSample(sample.id))) missing.push(sample.name); } if (project.tracks) {
          const sampleById = new Map(samples.map((sample) => [sample.id, sample]));
          setTracks(importedTracks.map((track: SequencerTrack) => {
            const assigned = track.assignedSample as Sample | undefined;
            if (!assigned?.isRendered) return track;
            const localSample = sampleById.get(assigned.id);
            return localSample ? { ...track, assignedSample: localSample } : { ...track, assignedSample: undefined };
          }));
        }
        setActivePattern(project.activePattern ?? "A"); setStatus(missing.length ? `Project imported. Rendered sample ${missing.join(", ")} is not available in this browser.` : "Project imported. Rendered sample audio is reconnected when it exists in this browser IndexedDB."); } catch { setStatus("Could not import project JSON."); } })(); };
    reader.readAsText(file);
  }

  function setPanelState(panelId: PanelId, panelState: WindowPanelState) {
    setPanels((oldPanels) => ({ ...oldPanels, [panelId]: panelState }));
  }

  const themeStyle = selectedSkin.variables as CSSProperties;

  return (
    <main className="app-shell" style={themeStyle}>
      <Toolbar bpm={bpm} isPlaying={isPlaying} status={status} skins={skins} selectedSkinId={selectedSkinId} onPlay={startSequencer} onStop={stopSequencer} onBpmChange={setBpmState} onSkinChange={setSelectedSkinId} onResetLayout={() => setPanels(normalPanels)} />
      <div className="layout-mode-control"><span>Layout:</span><button className={layoutMode === "compact" ? "active-filter" : ""} onClick={() => setLayoutMode("compact")}>Compact Left</button><button className={layoutMode === "balanced" ? "active-filter" : ""} onClick={() => setLayoutMode("balanced")}>Balanced</button><button className={layoutMode === "wide" ? "active-filter" : ""} onClick={() => setLayoutMode("wide")}>Wide Left</button></div>
      <div className={`workspace-grid layout-${layoutMode}`}>
        <div className="left-column"><WindowPanel title="Sample Library" state={panels.library} onStateChange={(state) => setPanelState("library", state)} className="sample-window"><SampleLibrary samples={samples} onPreview={previewSample} onAssign={assignSample} onRemove={removeSample} /></WindowPanel><WindowPanel title="Guitar Tools" state={panels.guitar} onStateChange={(state) => setPanelState("guitar", state)}><GuitarTools samples={samples} bpm={bpm} track={selectedTrack} selectedStepIndex={selectedStepIndex} onStepNotesChange={updateStepNotes} onAddRenderedSample={addRenderedSampleFromBlob} onStatus={setStatus} /></WindowPanel><WindowPanel title="Export" state={panels.export} onStateChange={(state) => setPanelState("export", state)}><ExportPanel onExportProject={exportProjectJson} onImportProject={importProjectJson} onExportPatternWav={exportCurrentPatternWav} /></WindowPanel></div>
        <div className="main-column"><WindowPanel title="Step Sequencer" state={panels.sequencer} onStateChange={(state) => setPanelState("sequencer", state)} className="sequencer-window"><StepSequencer tracks={tracks} bpm={bpm} currentStep={currentStep} selectedTrackId={selectedTrackId} selectedStepIndex={selectedStepIndex} onToggleStep={toggleStep} onSelectTrack={selectTrack} onAddTrack={addTrack} onRemoveTrack={removeTrack} activePattern={activePattern} stepCount={tracks[0]?.steps.length ?? 16} onStepCountChange={changeStepCount} /></WindowPanel>
        <WindowPanel title="Track Controls" state={panels.trackControls} onStateChange={(state) => setPanelState("trackControls", state)}><TrackControls track={selectedTrack} selectedStepIndex={selectedStepIndex} onChange={updateTrackSettings} onTrackChange={updateTrack} bpm={bpm} onStepNoteChange={updateStepNote} onStepChordChange={updateStepChord} onStepNotesChange={updateStepNotes} onEffectsChange={updateTrackEffects} onResetSettings={resetPlaybackSettings} onClearNotes={clearStepNotes} onClearPattern={clearPattern} onResetTrack={resetTrack} onPreview={previewTrack} onRenderTrack={renderTrack} onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} playheadMs={playheadMs} /></WindowPanel>
        <WindowPanel title="Arrangement" state={panels.arrangement} onStateChange={(state) => setPanelState("arrangement", state)}><ArrangementPanel activePattern={activePattern} patterns={availablePatterns} copiedPattern={copiedPattern ? "copied" : undefined} timeline={timeline} arrangementPlaying={arrangementPlaying} onSelectPattern={loadPattern} onAddPattern={addPattern} onRemovePattern={removePattern} onCopyPattern={copyPattern} onPastePattern={pastePattern} onCycleSlot={cycleTimelineSlot} onSlotCountChange={changeArrangementSlotCount} onPlayArrangement={playArrangement} onStop={stopArrangement} /></WindowPanel></div>
      </div>
    </main>
  );
}
