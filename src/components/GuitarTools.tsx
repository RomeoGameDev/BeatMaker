"use client";

import { useMemo, useState } from "react";
import { buildChord, CHORD_TYPES, CHROMATIC_NOTES, formatChordLabel, midiToNote, noteToMidi, type ChordType } from "@/lib/musicTheory";
import type { SequencerTrack } from "@/types";

type Props = {
  track?: SequencerTrack;
  selectedStepIndex?: number;
  onStepNotesChange: (trackId: number, stepIndex: number, notes: string[]) => void;
};

const rootNotes = CHROMATIC_NOTES;
const standardTuning = ["E2", "A2", "D3", "G3", "B3", "E4"];
const stripOctave = (note: string) => note.replace(/-?\d+$/, "");

export default function GuitarTools({ track, selectedStepIndex, onStepNotesChange }: Props) {
  const [root, setRoot] = useState("G");
  const [chordType, setChordType] = useState<ChordType>("major");
  const [tab, setTab] = useState(`e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|`);
  const chordNotes = useMemo(() => buildChord(`${root}3`, chordType), [root, chordType]);
  const chordPitchClasses = new Set(chordNotes.map(stripOctave));
  const canSend = Boolean(track && track.mode === "keyboard" && selectedStepIndex !== undefined);
  const message = track?.mode !== "keyboard" ? "Switch selected track to Keyboard mode to send chords." : selectedStepIndex === undefined ? "Select a sequencer step to send notes." : "Ready to send to the selected step.";

  const sendNotes = (notes: string[]) => {
    if (!track || selectedStepIndex === undefined || track.mode !== "keyboard") return;
    onStepNotesChange(track.id, selectedStepIndex, notes);
  };

  return <div className="guitar-tools">
    <section className="guitar-tool-section">
      <p className="eyebrow">Chord Helper</p>
      <div className="control-grid compact-grid"><label>Root<select value={root} onChange={(event) => setRoot(event.target.value)}>{rootNotes.map((note) => <option key={note} value={note}>{note}</option>)}</select></label><label>Chord Type<select value={chordType} onChange={(event) => setChordType(event.target.value as ChordType)}>{CHORD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div>
      <p className="chord-preview"><strong>{root} {chordType}</strong> = {chordNotes.map(stripOctave).join(" ")}</p>
      <p className="hint">{message}</p>
      <div className="nudge-row"><button type="button" disabled={!canSend} onClick={() => sendNotes(chordNotes)}>Send Chord to Selected Step</button><button type="button" disabled={!canSend} onClick={() => sendNotes([`${root}3`])}>Send Root Note to Selected Step</button></div>
    </section>
    <section className="guitar-tool-section">
      <p className="eyebrow">Fretboard · Standard E A D G B e</p>
      <div className="fretboard" role="img" aria-label={`${formatChordLabel(`${root}3`, chordType)} notes on a 12 fret guitar fretboard`}>
        {standardTuning.slice().reverse().map((openNote) => <div className="fret-string" key={openNote}><span className="string-name">{stripOctave(openNote)}</span>{Array.from({ length: 13 }, (_, fret) => { const note = midiToNote(noteToMidi(openNote) + fret); const noteName = stripOctave(note); const active = chordPitchClasses.has(noteName); return <span key={`${openNote}-${fret}`} className={`fret ${active ? "active" : ""}`}>{active ? noteName : fret === 0 ? "0" : ""}</span>; })}</div>)}
      </div>
    </section>
    <section className="guitar-tool-section">
      <p className="eyebrow">Tab Scratchpad</p>
      <textarea className="tab-scratchpad" value={tab} onChange={(event) => setTab(event.target.value)} rows={6} spellCheck={false} />
      <div className="nudge-row"><button type="button" onClick={() => setTab("")}>Clear Tab</button><button type="button" onClick={() => setTab((old) => `${old}${old ? "\n" : ""}${root} ${chordType} (${chordNotes.map(stripOctave).join(" ")})`)}>Insert Chord Name</button></div>
    </section>
  </div>;
}
