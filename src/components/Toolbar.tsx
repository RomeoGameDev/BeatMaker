import type { Skin } from "@/types";
import SkinSelector from "./SkinSelector";

type Props = { bpm: number; isPlaying: boolean; status: string; skins: Skin[]; selectedSkinId: string; onPlay: () => void; onStop: () => void; onBpmChange: (bpm: number) => void; onSkinChange: (skinId: string) => void; onResetLayout: () => void };

export default function Toolbar({ bpm, isPlaying, status, skins, selectedSkinId, onPlay, onStop, onBpmChange, onSkinChange, onResetLayout }: Props) {
  return (
    <header className="toolbar">
      <h1>Dusty Workstation</h1>
      <button onClick={onPlay} disabled={isPlaying}>Play</button>
      <button onClick={onStop}>Stop</button>
      <label className="field-label">BPM
        <input type="number" min="60" max="220" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} />
      </label>
      <button onClick={onResetLayout}>Reset Layout</button>
      <SkinSelector skins={skins} selectedSkinId={selectedSkinId} onChange={onSkinChange} />
      <span className="status">{status}</span>
    </header>
  );
}
