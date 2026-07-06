import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Sample, SampleCategory, SampleType } from "@/types";

const SAMPLE_ROOT = path.join(process.cwd(), "public", "samples");
const SUPPORTED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".aif", ".aiff", ".flac", ".ogg", ".m4a"]);

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function guessType(relativeDirectory: string): SampleType {
  const folder = relativeDirectory.toLowerCase();
  return folder.includes("loop") ? "loop" : "oneshot";
}

function guessCategory(filename: string): SampleCategory {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.includes("kick")) return "kick";
  if (lowerFilename.includes("snare")) return "snare";
  if (lowerFilename.includes("hat") || lowerFilename.includes("hihat")) return "hat";
  if (lowerFilename.includes("clap")) return "clap";
  if (lowerFilename.includes("perc")) return "perc";
  if (lowerFilename.includes("bass")) return "bass";
  if (lowerFilename.includes("guitar")) return "guitar";
  if (lowerFilename.includes("melody") || lowerFilename.includes("melodic") || lowerFilename.includes("loop")) return "melody";

  return "other";
}

function discoverSamples(directory = SAMPLE_ROOT, discoveredSamples: Sample[] = []): Sample[] {
  let entries: string[];

  try {
    entries = readdirSync(directory);
  } catch {
    return discoveredSamples;
  }

  entries.forEach((entry) => {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      discoverSamples(fullPath, discoveredSamples);
      return;
    }

    if (!stats.isFile()) return;

    const extension = path.extname(entry);
    if (!SUPPORTED_AUDIO_EXTENSIONS.has(extension.toLowerCase())) return;

    const relativePath = path.relative(SAMPLE_ROOT, fullPath).split(path.sep);
    const relativeDirectory = relativePath.slice(0, -1).join("/");
    const containingFolder = relativePath[0] ?? "samples";
    const name = path.basename(entry, extension);

    discoveredSamples.push({
      id: `${slugify(containingFolder)}-${slugify(name)}`,
      filename: entry,
      name,
      type: guessType(relativeDirectory),
      category: guessCategory(entry),
      path: `/samples/${relativePath.join("/")}`
    });
  });

  return discoveredSamples;
}

export const samples: Sample[] = discoverSamples().sort((first, second) => first.path.localeCompare(second.path));
