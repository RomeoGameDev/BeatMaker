import { normalizeSamplePath, SUPPORTED_AUDIO_EXTENSIONS } from "@/lib/samplePaths";
import type { Sample } from "@/types";

export type SampleLoadStatus = "not loaded" | "loading" | "loaded" | "fetch failed" | "decode failed";

export const PCM_WAV_HELPER_COMMAND = "ffmpeg -i input.wav -acodec pcm_s16le -ar 44100 output.wav";
export const PCM_WAV_DECODE_MESSAGE = `Found, but not WebAudio-decodable. Convert to PCM WAV for editing. ${PCM_WAV_HELPER_COMMAND}`;

export type LoadedSampleAudio = {
  audioBuffer: AudioBuffer;
  normalizedPath: string;
  fetchUrl: string;
  contentType: string;
  byteLength: number;
};

export class SampleLoadError extends Error {
  status!: SampleLoadStatus;
  normalizedPath!: string;
  fetchUrl!: string;
  httpStatus?: number;
  contentType?: string;
  extension?: string;
  decodeError?: unknown;

  constructor(message: string, details: Omit<SampleLoadError, "name" | "message">) {
    super(message);
    this.name = "SampleLoadError";
    Object.assign(this, details);
  }
}

function getExtension(url: string) {
  return url.split(/[?#]/, 1)[0].toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

function warnSampleLoadFailure(message: string, sample: Sample, details: Record<string, unknown>) {
  console.warn(message, {
    id: sample.id,
    name: sample.name,
    type: sample.type,
    category: sample.category,
    filename: sample.filename,
    path: sample.path,
    ...details
  });
}

export async function loadSampleAudioBuffer(sample: Sample): Promise<LoadedSampleAudio> {
  const normalizedPath = normalizeSamplePath(sample.path);
  const fetchUrl = normalizedPath;
  const extension = getExtension(fetchUrl);

  if (!/^(blob:|data:)/i.test(fetchUrl) && (!extension || !SUPPORTED_AUDIO_EXTENSIONS.has(extension))) {
    const message = `Sample file unsupported: ${fetchUrl}`;
    warnSampleLoadFailure(message, sample, { normalizedPath, fetchUrl, fileExtension: extension });
    throw new SampleLoadError(message, { status: "fetch failed", normalizedPath, fetchUrl, extension });
  }

  let response: Response;
  try {
    response = await fetch(fetchUrl);
  } catch (error) {
    const message = `Could not fetch ${fetchUrl}: ${error instanceof Error ? error.message : String(error)}`;
    warnSampleLoadFailure(message, sample, { normalizedPath, fetchUrl, fileExtension: extension, error });
    throw new SampleLoadError(message, { status: "fetch failed", normalizedPath, fetchUrl, extension });
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!response.ok) {
    const message = `Could not fetch ${fetchUrl}: HTTP ${response.status}`;
    warnSampleLoadFailure(message, sample, { normalizedPath, fetchUrl, httpStatus: response.status, contentType, fileExtension: extension });
    throw new SampleLoadError(message, { status: "fetch failed", normalizedPath, fetchUrl, httpStatus: response.status, contentType, extension });
  }

  const arrayBuffer = await response.arrayBuffer();
  console.debug("Fetched sample audio.", { path: sample.path, normalizedPath, fetchUrl, httpStatus: response.status, contentType, fileExtension: extension, byteLength: arrayBuffer.byteLength });
  if (arrayBuffer.byteLength === 0) {
    const message = `Could not fetch ${fetchUrl}: file was empty`;
    warnSampleLoadFailure(message, sample, { normalizedPath, fetchUrl, httpStatus: response.status, contentType, fileExtension: extension, byteLength: 0 });
    throw new SampleLoadError(message, { status: "fetch failed", normalizedPath, fetchUrl, httpStatus: response.status, contentType, extension });
  }

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    const message = PCM_WAV_DECODE_MESSAGE;
    warnSampleLoadFailure(message, sample, { normalizedPath, fetchUrl, httpStatus: response.status, contentType, fileExtension: extension, byteLength: arrayBuffer.byteLength });
    throw new SampleLoadError(message, { status: "decode failed", normalizedPath, fetchUrl, httpStatus: response.status, contentType, extension });
  }

  const context = new AudioContextClass();
  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    return { audioBuffer, normalizedPath, fetchUrl, contentType, byteLength: arrayBuffer.byteLength };
  } catch (decodeError) {
    const message = PCM_WAV_DECODE_MESSAGE;
    warnSampleLoadFailure(message, sample, { normalizedPath, fetchUrl, httpStatus: response.status, contentType, fileExtension: extension, byteLength: arrayBuffer.byteLength, decodeAudioDataError: decodeError });
    throw new SampleLoadError(message, { status: "decode failed", normalizedPath, fetchUrl, httpStatus: response.status, contentType, extension, decodeError });
  } finally {
    await context.close().catch(() => undefined);
  }
}
