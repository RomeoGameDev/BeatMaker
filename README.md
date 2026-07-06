# Dusty Workstation

Dusty Workstation is a beginner-friendly browser music workstation MVP inspired by early-2000s web tools, Winamp/QMMP skins, trackers, samplers, and simple guitar helpers.

## How to run

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. On the current test machine the target manual-test URL is:

```text
http://192.168.0.177:3000
```

For a production/type check, run:

```bash
npm run build
```

## Where to put samples

Automatic sample discovery scans these folders at build/server-render time:

```text
public/samples/oneshots/
public/samples/loops/
```

Supported file extensions are:

- `.wav`
- `.mp3`
- `.ogg`
- `.flac`

Any filename is allowed when the extension is supported. The app preserves the original filename and displays the sample name as the filename without its extension.

Example files:

```text
public/samples/oneshots/kick01.wav
public/samples/oneshots/my dusty snare.flac
public/samples/loops/guitar_loop_90bpm.mp3
```

Categories are guessed from the lowercase filename:

- `kick` → kick
- `snare` → snare
- `hat` or `hihat` → hat
- `clap` → clap
- `perc` → perc
- `bass` → bass
- `guitar` → guitar
- `melody`, `melodic`, or `loop` → melody
- anything else → other

## What window panels can do

The workspace uses simple retro window-like panels. Each panel has a title bar with controls:

- Minimize: collapses the panel to only the title bar.
- Maximize: expands the panel across most of the workspace.
- Restore: returns a maximized panel to normal grid size.
- Close button: currently minimizes the panel instead of removing it.
- Reset Layout: the toolbar button restores all panels to normal size.

Drag-and-drop window movement is intentionally not implemented yet, so the layout stays simple and responsive.

## How to test the sequencer duplicate-hit fix

1. Put two kick files in `public/samples/oneshots/`.
2. Run `npm install` if dependencies are not installed.
3. Run `npm run dev`.
4. Open `http://192.168.0.177:3000` or the URL printed by Next.js.
5. Confirm both kick samples appear in Sample Library.
6. Assign `kick01` to Track 1.
7. Enable only step 1 on Track 1.
8. Press Play and confirm there is one hit per cycle, not doubled or tripled.
9. Press Play multiple times; the button is guarded and the scheduler is cleaned before playback starts.
10. Press Stop, then Play again, and confirm playback starts cleanly.

## What is implemented now

- Retro dark Next.js + TypeScript app shell.
- Top toolbar with Play, Stop, BPM, Reset Layout, skin selector, and status text.
- Build-time sample discovery for one-shots and loops.
- Filename-based sample categorization and filters for All, One-shots, Loops, Kick, Snare, Hat, Bass, Guitar, and Other.
- Tone.js sample preview with friendly status messages if files are missing.
- Four-track, 16-step sequencer with clickable steps, selected track headers, and current-step highlighting.
- Safer sequencer scheduling with a single active Tone.Transport scheduler at a time.
- Per-track sample controls for start offset, end trim, fade in, fade out, volume, mute, solo, and pitch placeholder/playback rate.
- Window-like panels for Sample Library, Step Sequencer, Track Controls, Arrangement, Waveform/Slicer, Export, and Guitar Tools.
- Three CSS-variable skins: Dusty Purple, Winamp Classic Inspired, and Green CRT.
- Placeholder arrangement, waveform/slicer, export, and guitar tools panels.

## Planned next

- Real waveform view.
- Slicer tools.
- Export WAV.
- Export stems ZIP.
- Mixer/effects including reverb, delay, distortion, overdrive, and EQ3.
- Winamp/QMMP skin import.
- Guitar tab editor.
