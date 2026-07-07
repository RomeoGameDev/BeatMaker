export const SUPPORTED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".flac"]);

export function normalizeSamplePath(samplePath: string): string {
  if (!samplePath) return samplePath;
  const trimmed = samplePath.trim();
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^data:/i.test(trimmed) || /^https?:/i.test(trimmed)) return trimmed;

  let normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
  const lower = normalized.toLowerCase();
  const publicSamplesIndex = lower.lastIndexOf("/public/samples/");

  if (publicSamplesIndex >= 0) {
    normalized = `/samples/${normalized.slice(publicSamplesIndex + "/public/samples/".length)}`;
  } else if (lower.startsWith("public/samples/")) {
    normalized = `/samples/${normalized.slice("public/samples/".length)}`;
  } else if (lower.startsWith("/samples/")) {
    normalized = normalized;
  } else if (lower.startsWith("samples/")) {
    normalized = `/${normalized}`;
  } else {
    const samplesIndex = lower.lastIndexOf("/samples/");
    normalized = samplesIndex >= 0 ? normalized.slice(samplesIndex) : `/samples/${normalized.replace(/^\/+/, "")}`;
  }

  return normalized.replace(/([^:])\/+/g, "$1/");
}
