import { buildChord, buildNoteRange, formatChordLabel } from "@/lib/musicTheory";

type Props = { rootNote: string; octaveRange: number; selectedNotes: string[]; disabled?: boolean; onNotesChange: (notes: string[]) => void; onApply: () => void; onClear: () => void; };
const presets = [{ label: "Major", type: "major" }, { label: "Minor", type: "minor" }, { label: "Sus2", type: "sus2" }, { label: "Sus4", type: "sus4" }, { label: "Maj7", type: "major7" }, { label: "Min7", type: "minor7" }, { label: "Dom7", type: "dominant7" }];
const isBlack = (note: string) => note.includes("#");
const compact = (notes: string[]) => notes.map((n) => n.replace(/-?\d+$/, "")).join(" ");

export default function ChordComposer({ rootNote, octaveRange, selectedNotes, disabled, onNotesChange, onApply, onClear }: Props) {
  const notes = buildNoteRange(rootNote, octaveRange);
  const root = selectedNotes[0] ?? rootNote;
  const toggle = (note: string) => onNotesChange(selectedNotes.includes(note) ? selectedNotes.filter((item) => item !== note) : [...selectedNotes, note]);
  return <section className="chord-composer"><p className="eyebrow">Chord Composer</p><p className="hint">Click piano keys, then apply them to the selected step.</p><div className="piano-keyboard">{notes.map((note) => <button type="button" key={note} disabled={disabled} className={`piano-key ${isBlack(note) ? "black" : "white"} ${selectedNotes.includes(note) ? "selected" : ""}`} onClick={() => toggle(note)}>{note.replace(/-?\d+$/, "")}</button>)}</div><p className="chord-selected">Selected: <strong>{selectedNotes.length ? selectedNotes.join(" ") : "none"}</strong>{selectedNotes.length > 1 ? <small>Step label: {compact(selectedNotes)}</small> : null}</p><div className="nudge-row"><button type="button" disabled={disabled} onClick={onClear}>Clear Chord</button><button type="button" disabled={disabled || selectedNotes.length === 0} onClick={onApply}>Apply to Selected Step</button>{presets.map((preset) => <button type="button" key={preset.type} disabled={disabled} onClick={() => onNotesChange(buildChord(root, preset.type))}>{preset.label}</button>)}</div>{selectedNotes.length > 1 && <p className="hint">Preset: {formatChordLabel(root, "major")} style buttons use the first selected note as root; you can edit keys afterward.</p>}</section>;
}
