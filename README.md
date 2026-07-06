# Dusty Workstation

Dusty Workstation is a beginner-friendly browser music workstation MVP inspired by early-2000s web tools, Winamp/QMMP skins, trackers, samplers, and simple guitar helpers.

## What is implemented

- Retro dark Next.js + TypeScript app shell.
- Top toolbar with Play, Stop, BPM, skin selector, and status text.
- Build-time sample discovery for one-shots and loops with filename-based categorization.
- Tone.js sample preview with friendly status messages if files are missing.
- Four-track, 16-step sequencer with clickable steps and current-step highlighting.
- Three CSS-variable skins: Dusty Purple, Winamp Classic Inspired, and Green CRT.
- Placeholder arrangement, waveform/slicer, export, and guitar tools panels.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open the local address printed by Next.js, usually <http://localhost:3000>.

## Build check

```bash
npm run build
```

## Where to put samples

Create folders under `public/samples/` and add supported audio files (`.wav`, `.mp3`, `.aif`, `.aiff`, `.flac`, `.ogg`, or `.m4a`). The scanner preserves the original filename, so any filename is allowed as long as it uses a supported audio extension.

```text
public/samples/oneshots/Kick23.WAV
public/samples/oneshots/dirty_snare_02.wav
public/samples/loops/melodic_loop_90bpm.mp3
```

Samples in folders with `loop` in the path are marked as loops; all others are marked as one-shots. Categories are guessed from lowercase filename matches such as `kick`, `snare`, `hat`/`hihat`, `clap`, `perc`, `bass`, `guitar`, `melody`/`melodic`/`loop`, or `other`. The app still loads if files are not there. Preview or sequencer playback will show an error/status message until sample files are added.

## What to test first

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the app in your browser.
4. Click steps in the sequencer grid.
5. Press Play and Stop.
6. Change the BPM.
7. Switch between the three skins.
8. Add supported audio files to `public/samples/...` and try Preview.

## Planned next

- Better sample loading and reuse for smoother playback.
- Real waveform display and slicing.
- Pattern save/load inside the browser.
- WAV mix export and ZIP stem export.
- Optional WaveSurfer.js, JSZip, and Winamp `.wsz` skin import later.
