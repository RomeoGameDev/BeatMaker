"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ArrangementPanel, { arrangementSlotCounts, type ArrangementSlotCount } from "@/components/ArrangementPanel";
import ExportPanel from "@/components/ExportPanel";
import GuitarTools from "@/components/GuitarTools";
import SampleLibrary from "@/components/SampleLibrary";
import WaveformSlicer from "@/components/WaveformSlicer";
import StepSequencer, { defaultTrackSettings, makeInitialTracks, makeSteps } from "@/components/StepSequencer";
import Toolbar from "@/components/Toolbar";
import TrackControls from "@/components/TrackControls";
import WindowPanel, { WindowPanelState } from "@/components/WindowPanel";
import TabbedPanel from "@/components/TabbedPanel";
import { setBpm, startAudio, stopTransport, stopAllAudio, Tone, playSample, playHtmlAudioFallback, triggerSample, triggerSampleRegion, playSampleRegionExclusive } from "@/lib/audioEngine";
import { downloadBlob, renderPatternDryWav, renderTrackDryWav, safeFilename } from "@/lib/renderWav";
import { deleteRenderedSample, hasRenderedSample, loadRenderedSamples, saveRenderedSample } from "@/lib/renderedSampleStore";
import { SampleLoadError } from "@/lib/sampleLoader";
import { decodeSampleDuration, markSampleDuration } from "@/lib/sampleDuration";
import { buildChord, semitoneDiff } from "@/lib/musicTheory";
import { skins } from "@/lib/skins";
import type { ArrangementSlot, PatternId, Sample, SequencerStep, SequencerTrack, Slice, TrackEffect, TrackSettings } from "@/types";

type PanelId = "library" | "slicer" | "sequencer" | "trackControls" | "arrangement" | "export" | "guitar";
const normalPanels: Record<PanelId, WindowPanelState> = { library: "normal", slicer: "normal", sequencer: "normal", trackControls: "normal", arrangement: "normal", export: "normal", guitar: "normal" };
type PatternSteps = Record<PatternId, Record<number, SequencerStep[]>>;
const cloneSteps = (steps: SequencerStep[]) => steps.map((step) => ({ ...step, notes: step.notes ? [...step.notes] : undefined }));
const THEME_STORAGE_KEY = "beatmaker.selectedSkinId";
const LAYOUT_STORAGE_KEY = "beatmaker.layoutMode";
const GUI_SCALE_STORAGE_KEY = "beatmaker.guiScale";
const BUTTON_STYLE_STORAGE_KEY = "beatmaker.compactButtons";
const STEP_STYLE_STORAGE_KEY = "beatmaker.compactSteps";
const HELPERS_STORAGE_KEY = "beatmaker.showHelpers";
const LIBRARY_TAB_STORAGE_KEY = "beatmaker.libraryTab";
const TOOL_TAB_STORAGE_KEY = "beatmaker.toolTab";
type LayoutMode = "compact" | "balanced" | "spacious";
type LibraryTab = "library" | "export";
type ToolTab = "trackControls" | "slicer" | "guitar";
type PlayheadSource = "track-controls" | "slicer" | "sequencer" | "sample-library" | "arrangement" | "guitar-tools";

export default function HomeClient({ samples: initialSamples }: { samples: Sample[] }) {
  const [samples, setSamples] = useState<Sample[]>(initialSamples);
  const [bpm, setBpmState] = useState(105);
  const [status, setStatus] = useState("Ready. Add samples to public/samples to hear audio.");
  const [selectedSkinId, setSelectedSkinId] = useState(skins[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [selectedSampleId, setSelectedSampleId] = useState<string | undefined>(initialSamples[0]?.id);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | undefined>(undefined);
  const [tracks, setTracks] = useState<SequencerTrack[]>(() => makeInitialTracks(samples[0]));
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [panels, setPanels] = useState<Record<PanelId, WindowPanelState>>(normalPanels);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("balanced");
  const [guiScale, setGuiScale] = useState(100);
  const [compactButtons, setCompactButtons] = useState(false);
  const [compactSteps, setCompactSteps] = useState(true);
  const [showHelpers, setShowHelpers] = useState(true);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("library");
  const [toolTab, setToolTab] = useState<ToolTab>("trackControls");
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
  const [playheadMs, setPlayheadMs] = useState<{ source: PlayheadSource; sampleId?: string; trackId?: number; valueMs: number } | undefined>(undefined);
  const activeLoopPlayersRef = useRef(new Map<number, { player?: Tone.Player; untilStep: number }>());
  const playheadFrameRef = useRef<number | null>(null);

  const selectedSkin = useMemo(() => skins.find((skin) => skin.id === selectedSkinId) ?? skins[0], [selectedSkinId]);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);
  const selectedSample = samples.find((sample) => sample.id === selectedSampleId) ?? selectedTrack?.assignedSample ?? samples[0];

  useEffect(() => {
    const savedSkinId = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedSkinId && skins.some((skin) => skin.id === savedSkinId)) setSelectedSkinId(savedSkinId);
    const savedLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout === "compact" || savedLayout === "balanced" || savedLayout === "spacious") setLayoutMode(savedLayout);
    const savedScale = Number(window.localStorage.getItem(GUI_SCALE_STORAGE_KEY));
    if ([75, 85, 90, 100, 110, 125, 150].includes(savedScale)) setGuiScale(savedScale);
    setCompactButtons(window.localStorage.getItem(BUTTON_STYLE_STORAGE_KEY) === "true");
    setCompactSteps(window.localStorage.getItem(STEP_STYLE_STORAGE_KEY) !== "false");
    setShowHelpers(window.localStorage.getItem(HELPERS_STORAGE_KEY) !== "false");
    const savedLibraryTab = window.localStorage.getItem(LIBRARY_TAB_STORAGE_KEY);
    if (savedLibraryTab === "library" || savedLibraryTab === "export") setLibraryTab(savedLibraryTab);
    const savedToolTab = window.localStorage.getItem(TOOL_TAB_STORAGE_KEY);
    if (savedToolTab === "trackControls" || savedToolTab === "slicer" || savedToolTab === "guitar") setToolTab(savedToolTab);
  }, []);
  useEffect(() => { window.localStorage.setItem(THEME_STORAGE_KEY, selectedSkin.id); }, [selectedSkin.id]);
  useEffect(() => { window.localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode); }, [layoutMode]);
  useEffect(() => { window.localStorage.setItem(GUI_SCALE_STORAGE_KEY, String(guiScale)); }, [guiScale]);
  useEffect(() => { window.localStorage.setItem(BUTTON_STYLE_STORAGE_KEY, String(compactButtons)); }, [compactButtons]);
  useEffect(() => { window.localStorage.setItem(STEP_STYLE_STORAGE_KEY, String(compactSteps)); }, [compactSteps]);
  useEffect(() => { window.localStorage.setItem(HELPERS_STORAGE_KEY, String(showHelpers)); }, [showHelpers]);
  useEffect(() => { window.localStorage.setItem(LIBRARY_TAB_STORAGE_KEY, libraryTab); }, [libraryTab]);
  useEffect(() => { window.localStorage.setItem(TOOL_TAB_STORAGE_KEY, toolTab); }, [toolTab]);
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
    setSelectedSampleId(sample.id);
    void ensureDuration(sample);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === selectedTrackId ? { ...track, assignedSample: { ...sample, normalizedPath: sample.normalizedPath }, loopMode: (sample.type === "loop" || sample.isLong) ? "play-full" : "oneshot", loopLengthSteps: track.loopLengthSteps ?? 16, retriggerLoop: track.retriggerLoop ?? false } : track));
    setStatus(`${sample.name} assigned to Track ${selectedTrackId}.`);
  }

  function toggleSliceStep(trackId: number, sliceId: string, stepIndex: number) {
    setSelectedTrackId(trackId); setSelectedStepIndex(stepIndex);
    setTracks((oldTracks) => oldTracks.map((track) => track.id === trackId ? { ...track, sliceSteps: { ...(track.sliceSteps ?? {}), [sliceId]: (track.sliceSteps?.[sliceId] ?? makeSteps(track.steps.length)).map((step, index) => index === stepIndex ? { ...step, active: !step.active } : step) } } : track));
  }
  function toggleMute(trackId: number) { updateTrackSettings(trackId, { mute: !tracksRef.current.find((track) => track.id === trackId)?.settings.mute }); }
  function toggleSolo(trackId: number) { updateTrackSettings(trackId, { solo: !tracksRef.current.find((track) => track.id === trackId)?.settings.solo }); }

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

  async function importSample(file: File, requestedType: "auto" | "oneshot" | "loop") {
    const objectUrl = URL.createObjectURL(file);
    const base = file.name.replace(/\.[^.]+$/, "");
    const lower = base.toLowerCase();
    const category = lower.includes("kick") ? "kick" : lower.includes("snare") ? "snare" : lower.includes("hat") || lower.includes("hihat") ? "hat" : lower.includes("clap") ? "clap" : lower.includes("perc") ? "perc" : lower.includes("bass") ? "bass" : lower.includes("guitar") ? "guitar" : lower.includes("melody") || lower.includes("melodic") || lower.includes("loop") ? "melody" : "other";
    let durationSeconds: number | undefined; let loadStatus: Sample["loadStatus"] = "loaded"; let lastErrorMessage: string | undefined;
    try { const meta = await decodeSampleDuration({ id: "temp", name: base, filename: file.name, type: "oneshot", category, path: objectUrl }); durationSeconds = meta.durationSeconds; } catch (error) { loadStatus = "decode failed"; lastErrorMessage = error instanceof Error ? error.message : String(error); }
    const type = requestedType === "auto" ? ((durationSeconds ?? 0) > 2 ? "loop" : "oneshot") : requestedType;
    const id = `imported-${Date.now()}`;
    const sample = markSampleDuration({ id, name: base, filename: file.name, type, category, path: objectUrl, isImported: true, source: "indexeddb", createdAt: Date.now(), loadStatus, lastErrorMessage }, durationSeconds ?? 0);
    setSamples((old) => [sample, ...old]); setSelectedSampleId(id);
    try { await saveRenderedSample({ id, name: base, filename: file.name, type, category, durationMs: sample.durationMs, createdAt: sample.createdAt ?? Date.now(), audio: file, metadata: { source: "imported-sample", decodeStatus: loadStatus }, isImported: true }); setStatus(loadStatus === "decode failed" ? "Imported, but not WebAudio-decodable. Convert to PCM WAV for editing." : `${base} imported and saved locally.`); }
    catch (error) { console.warn("Could not save imported sample.", error); setStatus("Imported for this session only; IndexedDB save failed."); }
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
      return { ...track, assignedSample: undefined, slices: undefined, sliceSteps: undefined, mode: track.mode === "sliced" ? "oneshot" : track.mode };
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
  function playExclusive(callback: () => void | Promise<void>) {
    stopSequencer(false);
    clearPlayhead();
    return callback();
  }

  function animateRegionPlayhead(start: number, end: number, source: PlayheadSource, sampleId?: string, trackId?: number) {
    clearPlayhead();
    const duration = Math.max(120, end - start);
    const started = performance.now();
    const tick = () => { const elapsed = performance.now() - started; setPlayheadMs({ source, sampleId, trackId, valueMs: start + Math.min(duration, elapsed) }); if (elapsed < duration) playheadFrameRef.current = requestAnimationFrame(tick); else playheadFrameRef.current = null; };
    tick();
  }

  function animatePlayhead(track: SequencerTrack, source: PlayheadSource = "track-controls") {
    clearPlayhead();
    const sampleMs = track.assignedSample?.durationMs ?? 10000;
    const start = Math.min(track.settings.startOffsetMs, Math.max(0, sampleMs - 1));
    const end = Math.max(start + 1, sampleMs - track.settings.endTrimMs);
    const duration = Math.max(120, end - start);
    const started = performance.now();
    // TODO: Replace this approximate visual timer with sample-accurate playhead sync later.
    const tick = () => {
      const elapsed = performance.now() - started;
      setPlayheadMs({ source, sampleId: track.assignedSample?.id, trackId: track.id, valueMs: start + Math.min(duration, elapsed) });
      if (elapsed < duration) playheadFrameRef.current = requestAnimationFrame(tick);
      else playheadFrameRef.current = null;
    };
    tick();
  }

  async function previewSample(sample: Sample) {
    await playExclusive(async () => {
      const updated = await ensureDuration(sample);
      animateRegionPlayhead(0, updated.durationMs ?? 10000, "sample-library", updated.id);
      const result = await playSample(updated);
      setStatus(result.ok ? "Playing sample." : result.message);
    });
  }

  async function previewTrack(track: SequencerTrack) {
    if (!track.assignedSample) {
      setStatus("Sample file missing or unsupported.");
      return;
    }

    await playExclusive(async () => {
    animatePlayhead(track, "track-controls");
    const updated = await ensureDuration(track.assignedSample!);
    const result = await triggerSample(updated, track.settings, Tone.now(), track.effects);
    if (result.status === "decode-failed") {
      const fallbackResult = await playHtmlAudioFallback(updated);
      setStatus(fallbackResult.ok ? fallbackResult.message : result.message);
      return;
    }
    setStatus(result.ok ? "Playing track." : result.message);
    });
  }

  function triggerStep(step: number, time: Tone.Unit.Time, absoluteStep = step) {
    const activeTracks = tracksRef.current;
    const hasSolo = activeTracks.some((track) => track.settings.solo);
    activeTracks.forEach((track) => {
      if (!track.assignedSample || track.settings.mute) return;
      if (track.mode === "sliced") {
        if (hasSolo && !track.settings.solo) return;
        (track.slices ?? []).forEach((slice) => { if (!track.sliceSteps?.[slice.id]?.[step]?.active) return; void triggerSampleRegion({ sample: track.assignedSample, startMs: slice.startMs, endMs: slice.endMs, time, volume: track.settings.volume, pitchSemitones: track.settings.pitchSemitones, fadeInMs: slice.attackMs ?? slice.fadeInMs, fadeOutMs: slice.fadeOutMs, effects: track.effects }).then((result) => { if (!result.ok && result.status === "decode-failed" && track.id === selectedTrackId) setStatus(result.message); }).catch(() => setStatus("Skipped slice: sample could not be decoded.")); });
        return;
      }
      const stepData = track.steps[step];
      if (!stepData?.active) return;
      if (hasSolo && !track.settings.solo) return;
      if (track.mode === "keyboard" && (stepData.notes?.length || stepData.chord)) {
        const chordNotes = stepData.notes?.length ? stepData.notes : buildChord(stepData.note ?? track.rootNote, stepData.chord ?? "major");
        if (track.id === selectedTrackId) animatePlayhead(track, "sequencer");
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
      if (track.id === selectedTrackId) animatePlayhead(track, "sequencer");
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
  function changeStepCount(count: number) { if (![4,8,16,24,32].includes(count)) return; setTracks((oldTracks) => oldTracks.map((track) => ({ ...track, steps: Array.from({ length: count }, (_, index) => track.steps[index] ? { ...track.steps[index], notes: track.steps[index].notes ? [...track.steps[index].notes] : undefined } : { active: false }), sliceSteps: track.sliceSteps ? Object.fromEntries(Object.entries(track.sliceSteps).map(([id, steps]) => [id, Array.from({ length: count }, (_, index) => steps[index] ? { ...steps[index] } : { active: false })])) : undefined }))); }

  function changeArrangementSlotCount(count: ArrangementSlotCount) {
    if (!arrangementSlotCounts.includes(count)) return;
    setTimeline((old) => Array.from({ length: count }, (_, index) => old[index] ?? ""));
  }

  function cycleTimelineSlot(index: number) {
    const cycle: ArrangementSlot[] = ["", ...availablePatterns];
    setTimeline((old) => old.map((slot, i) => i === index ? cycle[(cycle.indexOf(slot) + 1) % cycle.length] : slot));
  }

  async function playArrangement() {
    await playExclusive(async () => {});
    const slots = timeline.slice(0, timeline.length) as PatternId[];
    if (!slots.length) { setStatus("Add pattern blocks to the arrangement timeline first."); return; }
    await startAudio();
    setArrangementPlaying(true);
    let slotIndex = 0;
    const patternMs = ((tracksRef.current[0]?.steps.length ?? 16) * (60 / bpm) / 4) * 1000;
    const runSlot = () => {
      const pattern = slots[slotIndex];
      if (pattern) loadPattern(pattern);
      setStatus(pattern ? `Playing arrangement slot ${slotIndex + 1}: Pattern ${pattern}.` : `Playing arrangement slot ${slotIndex + 1}: empty.`);
      if (pattern) void startSequencer(false); else { stopTransport(); disposeSequencer(); setCurrentStep(0); setIsPlaying(false); }
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

  function stopSequencer(updateStatus = true) {
    if (arrangementTimerRef.current !== null) { window.clearTimeout(arrangementTimerRef.current); arrangementTimerRef.current = null; setArrangementPlaying(false); }
    stopAllAudio();
    clearPlayhead();
    disposeSequencer();
    activeLoopPlayersRef.current.clear();
    setCurrentStep(0);
    setIsPlaying(false);
    if (updateStatus) setStatus("Stopped all audio.");
  }

  async function startSequencer(exclusive = true) {
    await startAudio();
    if (exclusive) stopSequencer(false); else disposeSequencer();
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
    setStatus("Playing sequencer.");
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

  async function previewSlice(slice: Slice) { if (!selectedSample) { setStatus("Select a sample first."); return; } await playExclusive(async () => { animateRegionPlayhead(slice.startMs, slice.endMs, "slicer", selectedSample.id); const result = await playSampleRegionExclusive(selectedSample, slice.startMs, slice.endMs, { fadeInMs: slice.attackMs ?? slice.fadeInMs, fadeOutMs: slice.fadeOutMs }); setStatus(result.ok ? "Playing slice." : result.message); }); }
  async function playSelection(region: { startMs: number; endMs: number }) { if (!selectedSample) { setStatus("Select a sample first."); return; } await playExclusive(async () => { animateRegionPlayhead(region.startMs, region.endMs, "slicer", selectedSample.id); const result = await playSampleRegionExclusive(selectedSample, region.startMs, region.endMs); setStatus(result.ok ? "Playing selection." : result.message); }); }
  function createSlicedTrack(sample: Sample, slices: Slice[]) { if (!slices.length) { setStatus("Create slices first."); return; } setTracks((old) => { const nextId = Math.max(0, ...old.map((track) => track.id)) + 1; const stepCount = old[0]?.steps.length ?? 16; const next = { id: nextId, name: sample.name, assignedSample: sample, steps: makeSteps(stepCount), slices: slices.map((slice) => ({ ...slice })), sliceSteps: Object.fromEntries(slices.map((slice) => [slice.id, makeSteps(stepCount)])), settings: { ...defaultTrackSettings }, mode: "sliced" as const, rootNote: "C3", octaveRange: 1, effects: [], loopMode: "oneshot" as const, loopLengthSteps: 16, retriggerLoop: false }; setSelectedTrackId(nextId); return [...old, next]; }); setStatus(`Created sliced track from ${sample.name}.`); }

  async function exportCurrentPatternWav() {
    try {
      const blob = await renderPatternDryWav(tracksRef.current, bpm);
      downloadBlob(blob, "workstation-music-current-pattern.wav");
      setStatus("Pattern WAV exported. FX export coming soon; exported dry pattern.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Export render failed."); }
  }

  function exportProjectJson() {
    const scrubSample = (sample?: Sample) => sample?.isRendered ? { ...sample, path: "", audioStoredLocally: sample.source === "indexeddb" } : sample;
    const exportTracks = tracks.map((track) => ({ ...track, assignedSample: scrubSample(track.assignedSample) }));
    const project = { version: 1, bpm, selectedSkinId, tracks: exportTracks, patterns: { ...patternsRef.current, [activePatternRef.current]: Object.fromEntries(tracksRef.current.map((track) => [track.id, cloneSteps(track.steps)])) }, availablePatterns, activePattern, arrangementSlotCount: timeline.length, timeline, stepCountPerPattern: tracksRef.current[0]?.steps.length ?? 16, sampleReferences: tracksRef.current.map((track) => track.assignedSample ? { trackId: track.id, name: track.assignedSample.name, path: track.assignedSample.path } : undefined).filter(Boolean), renderedSampleWarning: "Rendered samples are stored locally in this browser via IndexedDB. Project JSON references them but does not contain audio." };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "workstation-music-project.json");
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

  const themeStyle = { ...selectedSkin.variables, "--ui-scale": `${guiScale}%` } as CSSProperties;
  const appClasses = [`app-shell`, `layout-${layoutMode}`, compactButtons ? "buttons-compact" : "", compactSteps ? "steps-compact" : "steps-normal", showHelpers ? "" : "helpers-hidden"].filter(Boolean).join(" ");

  return (
    <main className={appClasses} style={themeStyle}>
      <Toolbar bpm={bpm} isPlaying={isPlaying} status={status} skins={skins} selectedSkinId={selectedSkinId} guiScale={guiScale} layoutMode={layoutMode} compactButtons={compactButtons} compactSteps={compactSteps} showHelpers={showHelpers} onPlay={startSequencer} onStop={stopSequencer} onBpmChange={setBpmState} onSkinChange={setSelectedSkinId} onGuiScaleChange={setGuiScale} onLayoutModeChange={setLayoutMode} onCompactButtonsChange={setCompactButtons} onCompactStepsChange={setCompactSteps} onShowHelpersChange={setShowHelpers} onResetLayout={() => { setLayoutMode("balanced"); setGuiScale(100); setCompactButtons(false); setCompactSteps(true); setShowHelpers(true); setLibraryTab("library"); setToolTab("trackControls"); }} />
      <div className="workspace-grid">
        <div className="library-column"><TabbedPanel<LibraryTab> title="Library / Export" activeTab={libraryTab} onTabChange={setLibraryTab} tabs={[{ id: "library", label: "Sample Library", content: <SampleLibrary samples={samples} selectedSampleId={selectedSampleId} onSelect={(sample) => setSelectedSampleId(sample.id)} onPlay={previewSample} onAssign={assignSample} onRemove={removeSample} onImport={importSample} /> }, { id: "export", label: "Export", content: <ExportPanel onExportProject={exportProjectJson} onImportProject={importProjectJson} onExportPatternWav={exportCurrentPatternWav} /> }]} /></div>
        <div className="tools-column"><TabbedPanel<ToolTab> title="Tools" activeTab={toolTab} onTabChange={setToolTab} tabs={[{ id: "trackControls", label: "Track Controls", content: <TrackControls track={selectedTrack} selectedStepIndex={selectedStepIndex} onChange={updateTrackSettings} onTrackChange={updateTrack} bpm={bpm} onStepNoteChange={updateStepNote} onStepChordChange={updateStepChord} onStepNotesChange={updateStepNotes} onEffectsChange={updateTrackEffects} onResetSettings={resetPlaybackSettings} onClearNotes={clearStepNotes} onClearPattern={clearPattern} onResetTrack={resetTrack} onPlay={previewTrack} onRenderTrack={renderTrack} onComingSoon={(feature) => setStatus(`${feature} is coming soon.`)} playheadMs={(playheadMs?.source === "track-controls" || (playheadMs?.source === "sequencer" && playheadMs.trackId === selectedTrack?.id)) ? playheadMs.valueMs : undefined} /> }, { id: "slicer", label: "Waveform / Slicer", content: <WaveformSlicer selectedSample={selectedSample} onEnsureDuration={ensureDuration} onPlaySample={previewSample} onPlaySlice={previewSlice} onPlaySelection={playSelection} onStopPreview={() => stopSequencer()} onCreateSlicedTrack={createSlicedTrack} onStatus={setStatus} playheadMs={playheadMs?.source === "slicer" && playheadMs.sampleId === selectedSample?.id ? playheadMs.valueMs : undefined} /> }, { id: "guitar", label: "Guitar Tools", content: <GuitarTools samples={samples} bpm={bpm} onPlayExclusive={playExclusive} track={selectedTrack} selectedStepIndex={selectedStepIndex} onStepNotesChange={updateStepNotes} onAddRenderedSample={addRenderedSampleFromBlob} onStatus={setStatus} /> }]} /></div>
        <div className="arrangement-column"><WindowPanel title="Arrangement"><ArrangementPanel activePattern={activePattern} patterns={availablePatterns} copiedPattern={copiedPattern ? "copied" : undefined} timeline={timeline} arrangementPlaying={arrangementPlaying} onSelectPattern={loadPattern} onAddPattern={addPattern} onRemovePattern={removePattern} onCopyPattern={copyPattern} onPastePattern={pastePattern} onCycleSlot={cycleTimelineSlot} onSlotCountChange={changeArrangementSlotCount} onPlayArrangement={playArrangement} onStop={stopArrangement} /></WindowPanel></div>
      </div>
      <WindowPanel title="Step Sequencer" className="sequencer-window bottom-sequencer"><StepSequencer tracks={tracks} bpm={bpm} currentStep={currentStep} selectedTrackId={selectedTrackId} selectedStepIndex={selectedStepIndex} onToggleStep={toggleStep} onToggleSliceStep={toggleSliceStep} onToggleMute={toggleMute} onToggleSolo={toggleSolo} onSelectTrack={selectTrack} onAddTrack={addTrack} onRemoveTrack={removeTrack} activePattern={activePattern} stepCount={tracks[0]?.steps.length ?? 16} onStepCountChange={changeStepCount} onTrackSettingsChange={updateTrackSettings} /></WindowPanel>
    </main>
  );
}