const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export const CHROMATIC_NOTES = [...NOTE_NAMES];

export function noteToMidi(note: string): number {
  const match = /^([A-G]#?)(-?\d+)$/.exec(note.trim());
  if (!match) return 48;
  const [, name, octaveText] = match;
  const noteIndex = NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number]);
  if (noteIndex < 0) return 48;
  return (Number(octaveText) + 1) * 12 + noteIndex;
}

export function midiToNote(midi: number): string {
  const safeMidi = Math.max(0, Math.min(127, Math.round(Number.isFinite(midi) ? midi : 48)));
  const noteName = NOTE_NAMES[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return `${noteName}${octave}`;
}

export function semitoneDiff(fromNote: string, toNote: string): number {
  return noteToMidi(toNote) - noteToMidi(fromNote);
}

export function buildNoteRange(rootNote: string, octaveRange: number): string[] {
  const rootMidi = noteToMidi(rootNote);
  const octaves = Math.max(1, Math.min(3, Math.round(octaveRange || 1)));
  return Array.from({ length: octaves * 12 }, (_, index) => midiToNote(rootMidi + index));
}

export function noteOptions(fromOctave = 1, toOctave = 6): string[] {
  const notes: string[] = [];
  for (let octave = fromOctave; octave <= toOctave; octave += 1) {
    NOTE_NAMES.forEach((name) => notes.push(`${name}${octave}`));
  }
  return notes;
}
