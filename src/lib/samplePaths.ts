export const SUPPORTED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".flac"]);

export function normalizeSamplePath(samplePath: string): string {
  if (!samplePath) return samplePath;
  if (/^(blob:|data:|https?:)/i.test(samplePath)) return samplePath;

  let normalized = samplePath.replace(/\\/g, "/").trim();
  normalized = normalized.replace(/\/+/g, "/");

  const publicSamplesIndex = normalized.toLowerCase().lastIndexOf("/public/samples/");
  if (publicSamplesIndex >= 0) {
    normalized = normalized.slice(publicSamplesIndex + "/public".length);
  }

  const samplesIndex = normalized.toLowerCase().lastIndexOf("/samples/");
  if (samplesIndex >= 0) {
    normalized = normalized.slice(samplesIndex);
  } else {
    normalized = `/samples/${normalized.replace(/^\/+/, "")}`;
  }

  return normalized.replace(/\/+/g, "/");
}
