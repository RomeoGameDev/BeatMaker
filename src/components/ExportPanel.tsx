export default function ExportPanel({ onComingSoon }: { onComingSoon: (feature: string) => void }) {
  return <div><button onClick={() => onComingSoon("Export Mix WAV")}>Export Mix WAV</button><button onClick={() => onComingSoon("Export Stems ZIP")}>Export Stems ZIP</button></div>;
}
