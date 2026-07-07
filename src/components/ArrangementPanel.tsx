import type { ArrangementSlot, PatternId } from "@/types";

export const arrangementSlotCounts = [4, 8, 16, 24, 32, 64] as const;

export type ArrangementSlotCount = typeof arrangementSlotCounts[number];

type Props = {
  activePattern: PatternId;
  patterns: PatternId[];
  copiedPattern?: PatternId;
  timeline: ArrangementSlot[];
  arrangementPlaying: boolean;
  onSelectPattern: (pattern: PatternId) => void;
  onAddPattern: () => void;
  onRemovePattern: (pattern: PatternId) => void;
  onCopyPattern: () => void;
  onPastePattern: () => void;
  onCycleSlot: (index: number) => void;
  onSlotCountChange: (count: ArrangementSlotCount) => void;
  onPlayArrangement: () => void;
  onStop: () => void;
};

export default function ArrangementPanel({ activePattern, patterns, copiedPattern, timeline, arrangementPlaying, onSelectPattern, onAddPattern, onRemovePattern, onCopyPattern, onPastePattern, onCycleSlot, onSlotCountChange, onPlayArrangement, onStop }: Props) {
  return <div className="arrangement-panel"><div className="track-control-header"><div><p className="eyebrow">Pattern Arrangement</p><h3>Pattern {activePattern}</h3><small>Step Sequencer edits the active pattern. Timeline slots play one pattern cycle each.</small></div><div className="nudge-row">{patterns.map((pattern) => <button type="button" className={activePattern === pattern ? "active-filter" : ""} key={pattern} onClick={() => onSelectPattern(pattern)}>Pattern {pattern}</button>)}</div></div><div className="nudge-row"><button type="button" onClick={onAddPattern}>Add Pattern</button><button type="button" onClick={() => onRemovePattern(activePattern)} disabled={patterns.length <= 1 || activePattern === patterns[0]}>Remove Pattern</button><button type="button" onClick={onCopyPattern}>Copy Pattern</button><button type="button" onClick={onPastePattern} disabled={!copiedPattern}>Paste{copiedPattern ? ` ${copiedPattern} into ${activePattern}` : " Pattern"}</button>{arrangementPlaying ? <button type="button" onClick={onStop}>Stop Arrangement</button> : <button type="button" onClick={onPlayArrangement}>Play Arrangement</button>}<label className="slot-count-control">Timeline Slots<select value={timeline.length} onChange={(event) => onSlotCountChange(Number(event.target.value) as ArrangementSlotCount)}>{arrangementSlotCounts.map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div><div className="arrangement-timeline">{timeline.map((slot, index) => <button type="button" key={index} className={`arrangement-slot ${slot ? "filled" : ""}`} onClick={() => onCycleSlot(index)}><small>{index + 1}</small><strong>{slot ? `Pattern ${slot}` : "Empty"}</strong></button>)}</div><p className="hint">Click a slot to cycle Empty → available patterns → Empty. Normal Play still plays only Pattern {activePattern}.</p></div>;
}
