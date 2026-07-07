import type { ChangeEvent } from "react";

type Props = {
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onExportPatternWav: () => void;
};

export default function ExportPanel({ onExportProject, onImportProject, onExportPatternWav }: Props) {
  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportProject(file);
    event.target.value = "";
  };
  return <div className="export-panel"><button type="button" onClick={onExportPatternWav}>Export Current Pattern WAV</button><button type="button" disabled title="Coming soon: arrangement WAV export.">Export Arrangement WAV · Coming soon</button><button type="button" disabled title="Coming soon: stems ZIP export.">Export Stems ZIP · Coming soon</button><button type="button" onClick={onExportProject}>Export Project JSON</button><label className="import-button">Import Project JSON<input type="file" accept="application/json,.json" onChange={importJson} /></label><p className="hint">Export Current Pattern WAV downloads a dry WAV. Arrangement WAV and Stems ZIP are disabled until stable. Project JSON stores tracks, patterns, arrangement, BPM, theme, FX/settings, note/chord data, sample references, and rendered/converted sample metadata; large audio blobs are not embedded. Rendered samples are stored locally in this browser via IndexedDB; Project JSON references them but does not contain audio.</p></div>;
}
