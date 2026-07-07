import type { ChangeEvent } from "react";

type Props = {
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onExportPatternWav: () => void;
  onExportArrangementWav: () => void;
  onExportStemsZip: () => void;
};

export default function ExportPanel({ onExportProject, onImportProject, onExportPatternWav, onExportArrangementWav, onExportStemsZip }: Props) {
  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportProject(file);
    event.target.value = "";
  };
  return <div className="export-panel"><button type="button" onClick={onExportPatternWav}>Export Current Pattern WAV</button><button type="button" onClick={onExportArrangementWav}>Export Arrangement WAV</button><button type="button" onClick={onExportStemsZip}>Export Stems ZIP</button><button type="button" onClick={onExportProject}>Export Project JSON</button><label className="import-button">Import Project JSON<input type="file" accept="application/json,.json" onChange={importJson} /></label><p className="hint">Every export button now downloads a file or reports a clear status. Project JSON stores tracks, patterns, arrangement, BPM, theme, FX/settings, note/chord data, sample references, and rendered/converted sample metadata; large audio blobs are not embedded.</p></div>;
}
