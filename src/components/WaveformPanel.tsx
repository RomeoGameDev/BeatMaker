import type { Sample } from "@/types";

export default function WaveformPanel({ sample }: { sample?: Sample }) {
  const bars = [20, 45, 70, 38, 82, 55, 30, 65, 90, 42, 74, 58, 28, 50, 78, 35];
  return <div><p>Selected sample: <strong>{sample?.name ?? "None"}</strong></p><div className="waveform">{bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div><p className="hint">Slicing tools coming soon.</p></div>;
}
