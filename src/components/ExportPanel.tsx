import type { ChangeEvent } from "react";

type Props = {
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onComingSoon: (feature: string) => void;
};

export default function ExportPanel({ onExportProject, onImportProject, onComingSoon }: Props) {
  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportProject(file);
    event.target.value = "";
  };
  return <div className="export-panel"><button type="button" onClick={() => onComingSoon("current pattern WAV export")}>Export Current Pattern Mix WAV</button><button type="button" onClick={() => onComingSoon("arrangement WAV export")}>Export Arrangement Mix WAV</button><button type="button" onClick={() => onComingSoon("stems ZIP export")}>Export Stems ZIP</button><button type="button" onClick={onExportProject}>Export Project JSON</button><label className="import-button">Import Project JSON<input type="file" accept="application/json,.json" onChange={importJson} /></label><p className="hint">Project JSON stores tracks, patterns, arrangement, BPM, and theme. It references sample paths but does not embed audio files.</p></div>;
}
