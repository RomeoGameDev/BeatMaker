import type { Skin } from "@/types";
import SkinSelector from "./SkinSelector";

const scales = [75, 85, 90, 100, 110, 125, 150];
type LayoutMode = "compact" | "balanced" | "spacious";

type Props = { bpm: number; isPlaying: boolean; status: string; skins: Skin[]; selectedSkinId: string; guiScale: number; layoutMode: LayoutMode; compactButtons: boolean; compactSteps: boolean; showHelpers: boolean; onPlay: () => void; onStop: () => void; onBpmChange: (bpm: number) => void; onSkinChange: (skinId: string) => void; onGuiScaleChange: (scale: number) => void; onLayoutModeChange: (mode: LayoutMode) => void; onCompactButtonsChange: (value: boolean) => void; onCompactStepsChange: (value: boolean) => void; onShowHelpersChange: (value: boolean) => void; onResetLayout: () => void };

export default function Toolbar({ bpm, isPlaying, status, skins, selectedSkinId, guiScale, layoutMode, compactButtons, compactSteps, showHelpers, onPlay, onStop, onBpmChange, onSkinChange, onGuiScaleChange, onLayoutModeChange, onCompactButtonsChange, onCompactStepsChange, onShowHelpersChange, onResetLayout }: Props) {
  const scaleIndex = scales.indexOf(guiScale);
  return (
    <header className="toolbar">
      <h1>Workstation Music</h1>
      <button onClick={onPlay} disabled={isPlaying}>Play</button><button onClick={onStop}>Stop</button>
      <label className="field-label">BPM<input type="number" min="60" max="220" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
      <SkinSelector skins={skins} selectedSkinId={selectedSkinId} onChange={onSkinChange} />
      <label className="field-label">Layout<select value={layoutMode} onChange={(event) => onLayoutModeChange(event.target.value as LayoutMode)}><option value="compact">Compact</option><option value="balanced">Balanced</option><option value="spacious">Spacious</option></select></label>
      <button className={compactButtons ? "active-filter" : ""} onClick={() => onCompactButtonsChange(!compactButtons)}>Compact Buttons</button>
      <button className={compactSteps ? "active-filter" : ""} onClick={() => onCompactStepsChange(!compactSteps)}>Compact Steps</button>
      <button className={!showHelpers ? "active-filter" : ""} onClick={() => onShowHelpersChange(!showHelpers)}>{showHelpers ? "Hide Helpers" : "Show Helpers"}</button>
      <div className="gui-scale-control"><button onClick={() => onGuiScaleChange(scales[Math.max(0, scaleIndex - 1)] ?? 100)}>-</button><strong>{guiScale}%</strong><button onClick={() => onGuiScaleChange(scales[Math.min(scales.length - 1, scaleIndex + 1)] ?? 100)}>+</button><button onClick={() => onGuiScaleChange(100)}>100%</button></div>
      <button onClick={onResetLayout}>Reset Layout</button>
      <span className="status">{status}</span>
    </header>
  );
}
