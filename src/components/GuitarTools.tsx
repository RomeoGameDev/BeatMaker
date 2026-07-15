"use client";

import { useMemo, useState, type ReactNode } from "react";
import { playHtmlAudioFallback, previewPitchedNotes } from "@/lib/audioEngine";
import { renderPitchedNotesWav, safeFilename } from "@/lib/renderWav";
import { buildChord, buildNoteRange, CHORD_TYPES, CHROMATIC_NOTES, formatChordLabel, midiToNote, noteToMidi, type ChordType } from "@/lib/musicTheory";
import type { GuitarLabEffects, NoteDuration, Sample, SequencerTrack } from "@/types";

type FretNote = { stringIndex: number; fret: number; note: string; midi: number };
type Props = { samples: Sample[]; bpm: number; onPlayExclusive?: (callback: () => void | Promise<void>) => void | Promise<void>; track?: SequencerTrack; selectedStepIndex?: number; onStepNotesChange: (trackId: number, stepIndex: number, notes: string[]) => void; onAddRenderedSample: (input: { blob: Blob; id: string; name: string; filename: string; type: Sample["type"]; category: Sample["category"]; durationSeconds?: number; metadata?: Record<string, unknown> }) => Promise<Sample>; onStatus: (message: string) => void; };
const standardTuning = ["E2", "A2", "D3", "G3", "B3", "E4"];
const stripOctave = (note: string) => note.replace(/-?\d+$/, "");
const defaultFx: GuitarLabEffects = { volume: 1, pitchOffsetSemitones: 0, reverbWet: 0, delayWet: 0, drive: 0.5, driveOutput: 1, driveTone: 5000, driveMix: 0.75, chorusWet: 0 };
const fxLabels: Record<keyof GuitarLabEffects, string> = { volume: "Volume", pitchOffsetSemitones: "Pitch", reverbWet: "Reverb Mix", delayWet: "Delay Mix", drive: "Drive", driveTone: "Tone", driveMix: "Mix", driveOutput: "Output", chorusWet: "Chorus Mix" };
function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) { const [open, setOpen] = useState(defaultOpen); return <section className="guitar-tool-section"><button className="collapse-title" type="button" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} {title}</button>{open ? children : null}</section>; }

export default function GuitarTools({ samples, bpm, onPlayExclusive, track, selectedStepIndex, onStepNotesChange, onAddRenderedSample, onStatus }: Props) {
  const [sourceId, setSourceId] = useState("");
  const noteDuration: NoteDuration = "1/8";
  const [root, setRoot] = useState("G");
  const [octave, setOctave] = useState(3);
  const [chordType, setChordType] = useState<ChordType>("major");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [selectedFrets, setSelectedFrets] = useState<FretNote[]>([]);
  const [fx, setFx] = useState<GuitarLabEffects>(defaultFx);
  const [tab, setTab] = useState("");
  const source = samples.find((sample) => sample.id === sourceId);
  const chordNotes = useMemo(() => buildChord(`${root}${octave}`, chordType), [root, octave, chordType]);
  const playableNotes = selectedNotes.length ? selectedNotes : chordNotes;
  const rootNote = `${root}${octave}`;
  const canSend = Boolean(track && track.mode === "keyboard" && selectedStepIndex !== undefined);
  const fretKey = (stringIndex: number, fret: number) => `${stringIndex}:${fret}`;
  const selectedFretKeys = new Set(selectedFrets.map((item) => fretKey(item.stringIndex, item.fret)));
  const selectedNoteSet = new Set(selectedNotes);
  const chordPitchClasses = new Set(chordNotes.map(stripOctave));
  const sourceWarning = source?.loadStatus === "decode-failed" ? "This sample cannot be pitch-rendered until converted to PCM WAV." : undefined;
  function setChordSelection(notes = chordNotes) { setSelectedNotes(notes); setSelectedFrets([]); }
  async function preview(notes = playableNotes) { if (!source) { onStatus("Select a source sample to play or render chords."); return; } await (onPlayExclusive?.(async () => { const result = await previewPitchedNotes({ sample: source, rootNote, notes, mode: "chord", bpm, noteDuration, effects: fx }); if (result.status === "decode-failed") { await playHtmlAudioFallback(source); onStatus(sourceWarning ?? result.message); } else onStatus(result.ok ? "Playing Guitar Tools." : result.message); }) ?? (async () => { const result = await previewPitchedNotes({ sample: source, rootNote, notes, mode: "chord", bpm, noteDuration, effects: fx }); onStatus(result.message); })()); }
  async function render(notes = playableNotes) { if (!source) { onStatus("Select a source sample to preview or render chords."); return; } try { const rendered = await renderPitchedNotesWav({ sample: source, rootNote, notes, mode: "chord", bpm, noteDuration, volume: fx.volume, pitchOffsetSemitones: fx.pitchOffsetSemitones }); const timestamp = Date.now(); const notesName = notes.map(stripOctave).join("-").toLowerCase() || timestamp; const name = `guitar_chord_${notesName}`; const filename = `${safeFilename(name)}.wav`; await onAddRenderedSample({ blob: rendered.blob, id: `guitar-render-${timestamp}`, name, filename, type: rendered.durationSeconds > 4 ? "loop" : "oneshot", category: "guitar", durationSeconds: rendered.durationSeconds, metadata: { source: "guitar-tools", notes } }); onStatus("Rendered Guitar Tools chord/stab into the Sample Library and saved it locally. FX render is volume/pitch only for now."); } catch (error) { onStatus(error instanceof Error ? error.message : "Could not render Guitar Tools WAV."); } }
  function send(notes = playableNotes, requireExplicitSelection = false) {
    if (selectedStepIndex === undefined) { onStatus("Select a step in the sequencer first."); return; }
    if (!track || track.mode !== "keyboard") { onStatus("Switch selected track to Keyboard mode to send notes."); return; }
    if (requireExplicitSelection && !selectedNotes.length) { onStatus("Select notes first."); return; }
    if (!notes.length) { onStatus("Select notes first."); return; }
    onStepNotesChange(track.id, selectedStepIndex, notes); onStatus("Sent selected chord/notes to the selected step.");
  }
  function toggleNote(note: string) { setSelectedNotes((old) => { const removing = old.includes(note); if (removing) setSelectedFrets((frets) => frets.filter((item) => item.note !== note)); return removing ? old.filter((n) => n !== note) : [...old, note]; }); }
  function toggleFret(stringIndex: number, fret: number) { const midi = noteToMidi(standardTuning[stringIndex]) + fret; const item = { stringIndex, fret, note: midiToNote(midi), midi }; toggleNote(item.note); setSelectedFrets((old) => old.some((n) => n.stringIndex === stringIndex && n.fret === fret) ? old.filter((n) => !(n.stringIndex === stringIndex && n.fret === fret)) : [...old, item]); }
  function clearSelected() { setSelectedNotes([]); setSelectedFrets([]); }
  function emptyTab(width = 12) { return ["e", "B", "G", "D", "A", "E"].map((name) => `${name}|${"-".repeat(width)}|`); }
  function generateChordTab() {
    if (!selectedFrets.length) { setTab("Select notes on the fretboard to generate exact tab."); onStatus("Select notes on the fretboard to generate exact tab."); return; }
    const fretsByString = new Map(selectedFrets.map((item) => [item.stringIndex, item.fret]));
    setTab([5,4,3,2,1,0].map((stringIndex) => {
      const label = ["E", "A", "D", "G", "B", "e"][stringIndex];
      const fret = fretsByString.get(stringIndex);
      return `${label}|--${fret ?? "-"}--|`;
    }).join("\n"));
    onStatus("Generated tab from selected fretboard notes.");
  }
  async function copyTab() { if (!tab) { onStatus("Generate a tab first."); return; } try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(tab); else throw new Error("Clipboard API unavailable."); onStatus("Tab copied."); } catch { const textarea = document.querySelector<HTMLTextAreaElement>(".tab-scratchpad"); textarea?.focus(); textarea?.select(); const copied = document.execCommand("copy"); window.getSelection()?.removeAllRanges(); onStatus(copied ? "Tab copied." : "Could not copy tab."); } }
  return <div className="guitar-tools"><p className="hint">Guitar Tools currently supports chords/stabs. Riff tools are planned later.</p>
    <Section title="Source"><label className="field-label">Source Sample<select value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">Select source…</option>{samples.filter((s) => s.type === "oneshot" || s.type === "loop" || s.isRendered).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{source ? <p className="hint"><strong>{source.name}</strong><br />{source.type} · {source.category}{source.durationSeconds ? ` · ${source.durationSeconds.toFixed(2)}s` : " · duration unknown"}<br />Status: {source.loadStatus ?? "idle"}</p> : <p className="hint">Select a source sample to preview or render chords.</p>}{sourceWarning && <p className="warning-text">{sourceWarning}</p>}</Section>
    <Section title="Chord Helper"><div className="control-grid compact-grid"><label>Root<select value={root} onChange={(e) => setRoot(e.target.value)}>{CHROMATIC_NOTES.map((n) => <option key={n}>{n}</option>)}</select></label><label>Type<select value={chordType} onChange={(e) => setChordType(e.target.value as ChordType)}>{CHORD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><label>Octave<select value={octave} onChange={(e) => setOctave(Number(e.target.value))}>{[1,2,3,4,5].map((o) => <option key={o}>{o}</option>)}</select></label></div><p className="chord-preview"><strong>{formatChordLabel(rootNote, chordType)}</strong> = {chordNotes.join(" ")}</p><div className="nudge-row"><button onClick={() => { setChordSelection(); void preview(chordNotes); }}>Play Chord</button><button onClick={() => { setChordSelection(); void render(chordNotes); }}>Render Chord</button><button onClick={() => { setChordSelection(); send(chordNotes); }} disabled={!canSend}>Send Chord to Selected Step</button></div></Section>
    <Section title="Fretboard / Piano"><div className="fretboard"><div className="fret-numbers"><span />{Array.from({ length: 13 }, (_, fret) => <span key={fret}>{fret}</span>)}</div><div className="fret-markers"><span />{Array.from({ length: 13 }, (_, fret) => <span key={fret} className="marker-cell">{[3,5,7,9].includes(fret) && <i />} {fret === 12 && <><i /><i /></>}</span>)}</div>{standardTuning.slice().reverse().map((openNote, rev) => { const stringIndex = standardTuning.length - 1 - rev; return <div className="fret-string" key={openNote}><span className="string-name">{openNote.replace("4", "e").replace(/\d/, "")}</span>{Array.from({ length: 13 }, (_, fret) => { const note = midiToNote(noteToMidi(openNote) + fret); const selected = selectedNoteSet.has(note) || selectedFretKeys.has(fretKey(stringIndex, fret)); const suggested = chordPitchClasses.has(stripOctave(note)); return <button type="button" key={fret} className={`fret ${fret === 0 ? "open" : ""} ${selected ? "selected" : suggested ? "active" : ""}`} onClick={() => toggleFret(stringIndex, fret)}>{selected || suggested || fret === 0 ? stripOctave(note) : ""}</button>; })}</div>; })}</div><div className="piano-keyboard">{buildNoteRange("C3", 2).map((note) => <button key={note} type="button" className={`piano-key ${note.includes("#") ? "black" : "white"} ${selectedNoteSet.has(note) ? "selected" : chordPitchClasses.has(stripOctave(note)) ? "active" : ""}`} onClick={() => toggleNote(note)}>{stripOctave(note)}</button>)}</div><p className="chord-selected">Selected: <strong>{selectedNotes.length ? selectedNotes.join(" ") : "none"}</strong></p><div className="nudge-row"><button onClick={clearSelected}>Clear Selected Notes</button><button onClick={() => send(selectedNotes, true)}>Send to Selected Step</button><button onClick={() => void preview()}>Play Selected Notes</button><button onClick={() => void render()}>Render to New Sample</button></div></Section>
    <Section title="Guitar Lab FX" defaultOpen={false}><div className="slider-stack">{([['volume',0,1.5,.01],['pitchOffsetSemitones',-24,24,1],['reverbWet',0,1,.01],['delayWet',0,1,.01],['drive',0,5,.01],['driveTone',100,10000,10],['driveMix',0,1,.01],['driveOutput',0,1.5,.01],['chorusWet',0,1,.01]] as const).map(([key,min,max,step]) => <label className="slider-control compact" key={key}><span className="slider-label">{fxLabels[key]} <em>{fx[key]}</em></span><input type="range" min={min} max={max} step={step} value={fx[key]} onChange={(e) => setFx((old) => ({ ...old, [key]: Number(e.target.value) }))} /></label>)}</div><button onClick={() => setFx(defaultFx)}>Reset Guitar FX</button><p className="hint">Play uses these FX where routing is supported. Drive now reaches a stronger range for strings/pads; use Output to control loudness after heavy drive. Render currently applies volume and pitch offset; time FX are TODO/bypass.</p></Section>
    <Section title="Generated Tab" defaultOpen={false}><p className="hint">Generated ASCII tab from Guitar Tools selections. Click fretboard cells for exact string/fret output; piano-only notes need fretboard positions first.</p><textarea className="tab-scratchpad" value={tab} readOnly placeholder="Generate tab from selected fretboard notes." rows={6} spellCheck={false} /><div className="nudge-row"><button onClick={generateChordTab}>Generate Tab from Selected Notes</button><button onClick={() => void copyTab()} disabled={!tab}>Copy Tab to Clipboard</button><button onClick={() => { setTab(""); onStatus("Generated tab cleared."); }}>Clear Generated Tab</button></div></Section>
  </div>;
}
