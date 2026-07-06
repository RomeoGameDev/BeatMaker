# Dusty Workstation

Dusty Workstation is a beginner-friendly browser music workstation MVP inspired by early-2000s web tools, Winamp/QMMP skins, trackers, samplers, and simple guitar helpers.

## What is implemented

- Retro dark Next.js + TypeScript app shell.
- Top toolbar with Play, Stop, BPM, skin selector, and status text.
- Hardcoded sample library for kicks, snares, hats, bass, and melody.
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

Create these folders under `public/` and add your WAV files:

```text
public/samples/kicks/kick01.wav
public/samples/snares/snare01.wav
public/samples/hats/hat01.wav
public/samples/bass/bass01.wav
public/samples/melody/melody01.wav
```

The app still loads if the files are not there. Preview or sequencer playback will show an error/status message until the sample files are added.

## What to test first

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the app in your browser.
4. Click steps in the sequencer grid.
5. Press Play and Stop.
6. Change the BPM.
7. Switch between the three skins.
8. Add WAV files to `public/samples/...` and try Preview.

## Planned next

- Better sample loading and reuse for smoother playback.
- Real waveform display and slicing.
- Pattern save/load inside the browser.
- WAV mix export and ZIP stem export.
- Optional WaveSurfer.js, JSZip, and Winamp `.wsz` skin import later.
