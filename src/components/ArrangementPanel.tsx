import type { ArrangementSlot, PatternId } from "@/types";

type Props = {
  activePattern: PatternId;
  timeline: ArrangementSlot[];
  arrangementPlaying: boolean;
  onSelectPattern: (pattern: PatternId) => void;
  onDuplicatePattern: (target: PatternId) => void;
  onClearPattern: () => void;
  onCycleSlot: (index: number) => void;
  onPlayArrangement: () => void;
  onStop: () => void;
};
const patterns: PatternId[] = ["A", "B", "C", "D"];

export default function ArrangementPanel({ activePattern, timeline, arrangementPlaying, onSelectPattern, onDuplicatePattern, onClearPattern, onCycleSlot, onPlayArrangement, onStop }: Props) {
  return <div className="arrangement-panel"><div className="track-control-header"><div><p className="eyebrow">Pattern Arrangement</p><h3>Pattern {activePattern}</h3><small>Sequencer edits the selected pattern. Timeline slots play one pattern cycle each.</small></div><div className="nudge-row">{patterns.map((pattern) => <button type="button" className={activePattern === pattern ? "active-filter" : ""} key={pattern} onClick={() => onSelectPattern(pattern)}>{pattern}</button>)}</div></div><div className="nudge-row"><label className="field-label">Duplicate current to<select defaultValue="" onChange={(e) => { if (!e.target.value) return; onDuplicatePattern(e.target.value as PatternId); e.currentTarget.value = ""; }}><option value="">Choose…</option>{patterns.filter((pattern) => pattern !== activePattern).map((pattern) => <option key={pattern}>{pattern}</option>)}</select></label><button type="button" onClick={onClearPattern}>Clear Pattern {activePattern}</button>{arrangementPlaying ? <button type="button" onClick={onStop}>Stop Arrangement</button> : <button type="button" onClick={onPlayArrangement}>Play Arrangement</button>}</div><div className="arrangement-timeline">{timeline.map((slot, index) => <button type="button" key={index} className={`arrangement-slot ${slot ? "filled" : ""}`} onClick={() => onCycleSlot(index)}><small>{index + 1}</small><strong>{slot || "Empty"}</strong></button>)}</div><p className="hint">Click a slot to cycle Empty → A → B → C → D. Normal Play still plays only the current pattern.</p></div>;
}
