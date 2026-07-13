import type { Skin } from "@/types";
import SkinSelector from "./SkinSelector";

type LayoutMode = "compact" | "balanced" | "spacious";
export type FontSizeMode = "small" | "normal" | "large";

type Props = { bpm: number; isPlaying: boolean; status: string; skins: Skin[]; selectedSkinId: string; fontSize: FontSizeMode; layoutMode: LayoutMode; showHelpers: boolean; onPlay: () => void; onStop: () => void; onBpmChange: (bpm: number) => void; onSkinChange: (skinId: string) => void; onFontSizeChange: (size: FontSizeMode) => void; onLayoutModeChange: (mode: LayoutMode) => void; onShowHelpersChange: (value: boolean) => void; onResetLayout: () => void };

export default function Toolbar({ bpm, isPlaying, status, skins, selectedSkinId, fontSize, layoutMode, showHelpers, onPlay, onStop, onBpmChange, onSkinChange, onFontSizeChange, onLayoutModeChange, onShowHelpersChange, onResetLayout }: Props) {
  return (
    <header className="toolbar">
      <h1>Workstation Music</h1>
      <button onClick={onPlay} disabled={isPlaying}>Play</button><button onClick={onStop}>Stop</button>
      <label className="field-label">BPM<input type="number" min="60" max="220" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
      <SkinSelector skins={skins} selectedSkinId={selectedSkinId} onChange={onSkinChange} />
      <label className="field-label">Layout<select value={layoutMode} onChange={(event) => onLayoutModeChange(event.target.value as LayoutMode)}><option value="compact">Compact</option><option value="balanced">Balanced</option><option value="spacious">Spacious</option></select></label>
      <label className="field-label">Font<select value={fontSize} onChange={(event) => onFontSizeChange(event.target.value as FontSizeMode)}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></label>
      <button className={!showHelpers ? "active-filter" : ""} onClick={() => onShowHelpersChange(!showHelpers)}>{showHelpers ? "Hide Helpers" : "Show Helpers"}</button>
      <button onClick={onResetLayout}>Reset Layout</button>
      <span className="status">{status}</span>
    </header>
  );
}
