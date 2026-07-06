import type { Sample, TrackSettings } from "@/types";

type Props = {
  sample?: Sample;
  settings?: TrackSettings;
};

function makeBars(seedText = "empty") {
  let seed = 0;
  for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  return Array.from({ length: 48 }, (_, index) => {
    const value = Math.sin((seed + index * 17) * 0.13) * 0.5 + Math.sin((seed + index * 7) * 0.07) * 0.5;
    return 18 + Math.round(Math.abs(value) * 76);
  });
}

export default function SampleWaveform({ sample, settings }: Props) {
  const bars = makeBars(sample?.id ?? sample?.filename);
  const startPercent = Math.min(35, ((settings?.startOffsetMs ?? 0) / 2000) * 35);
  const endPercent = 100 - Math.min(35, ((settings?.endTrimMs ?? 0) / 2000) * 35);
  const fadeInPercent = Math.min(30, ((settings?.fadeInMs ?? 0) / 500) * 30);
  const fadeOutPercent = Math.min(30, ((settings?.fadeOutMs ?? 0) / 500) * 30);

  return (
    <div className="sample-waveform" aria-label="Deterministic sample waveform preview">
      <div className="fade-region fade-in" style={{ width: `${fadeInPercent}%` }} />
      <div className="fade-region fade-out" style={{ width: `${fadeOutPercent}%` }} />
      <div className="trim-marker start-marker" style={{ left: `${startPercent}%` }}><span>Start</span></div>
      <div className="trim-marker end-marker" style={{ left: `${endPercent}%` }}><span>End</span></div>
      <div className="sample-waveform-bars">
        {bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
      </div>
    </div>
  );
}
