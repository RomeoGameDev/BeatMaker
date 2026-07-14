import type { ChangeEvent } from "react";

type Props = {
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onExportPatternWav: () => void;
  onExportArrangementWav: () => void;
  onExportStemsZip: () => void;
  onExportSelectedTrackWav: () => void;
  selectedTrackName?: string;
};

export default function ExportPanel({ onExportProject, onImportProject, onExportPatternWav, onExportArrangementWav, onExportStemsZip, onExportSelectedTrackWav, selectedTrackName }: Props) {
  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportProject(file);
    event.target.value = "";
  };
  return <div className="export-panel"><button type="button" onClick={onExportPatternWav}>Export Current Pattern WAV</button><button type="button" onClick={onExportArrangementWav}>Export Arrangement WAV</button><button type="button" disabled onClick={onExportStemsZip} title="Coming soon: Stems ZIP export.">Export Stems ZIP · Coming soon</button><button type="button" onClick={onExportSelectedTrackWav} disabled={!selectedTrackName}>Export Selected Track WAV</button><button type="button" onClick={onExportProject}>Export Project JSON</button><label className="import-button">Import Project JSON<input type="file" accept="application/json,.json" onChange={importJson} /></label><p className="hint">Exports preload samples first and show status in the toolbar. Current pattern, arrangement, and selected track render dry WAV files with track volume, pitch, regions, fades, mute/solo, one-shot, keyboard, sliced, imported, and rendered samples where supported. Stems ZIP is disabled honestly until JSZip is available. Decode-failed or missing samples are skipped with a warning.</p></div>;
}
