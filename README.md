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
- Dynamic 16-step sequencer tracks with clickable steps, selected track headers, current-step highlighting, Add Track, and remove buttons for extra tracks.
- Safer sequencer scheduling with a single active Tone.Transport scheduler at a time.
- Per-track sample controls for start offset, end trim, fade in, fade out, volume, mute, solo, pitch playback rate, reset settings, clear notes, clear pattern, and reset track.
- Window-like panels for Sample Library, Step Sequencer, Track Controls, Arrangement, Waveform/Slicer, Export, and Guitar Tools.
- Three CSS-variable skins: Dusty Purple, Winamp Classic Inspired, and Green CRT.
- Real browser-decoded waveform display for assigned samples, plus placeholder arrangement, export, and guitar tools panels.

## Planned next

- Slicer tools.
- Export WAV.
- Export stems ZIP.
- Mixer/effects including reverb, delay, distortion, overdrive, and EQ3.
- Winamp/QMMP skin import.
- Guitar tab editor.

## Track playback modes

Each sequencer track can now play in beginner-friendly modes:

- **One-shot mode**: the default drum-pad behavior. Active steps trigger the assigned sample at its original pitch, plus any track pitch adjustment.
- **Keyboard mode**: treats the assigned sample like a simple pitched instrument. Pick a root note, choose an octave range, click steps, then assign note names to those steps.
- **Chord mode for keyboard steps**: selected keyboard steps can play a chord instead of one note. Choose a chord root and chord type, preview the expanded notes, and the sequencer triggers the sample once per chord note at the same step time.

### How to use keyboard mode

1. Assign a sample to a track from the Sample Library.
2. Select the track by clicking its header or one of its steps.
3. In Track Controls, change **Mode** to **Keyboard**.
4. Choose a **Root Note** such as `C3` and an **Octave Range** of 1, 2, or 3.
5. Click steps in the Step Sequencer to turn them on.
6. Select a step, then use the mini keyboard or step note selector to choose notes for that step.

If a keyboard step is active but has no note, it plays the track root note. Pitch is calculated from the semitone difference between the root note and the step note. Chord steps expand simple chord types such as major, minor, diminished, augmented, sus2, sus4, major7, minor7, and dominant7.

## Sample Editor

The Sample Editor panel edits the same selected track sample playback settings as Track Controls. It fetches the assigned sample in the browser, decodes it with AudioContext, draws a real purple canvas waveform, and overlays markers for start offset, end trim, fade in, and fade out. If a file cannot be fetched or decoded, the panel shows a friendly message instead of crashing.

### How to align a late sample

1. Select the track that has the late sample assigned.
2. Open Sample Editor and use the real waveform to find where the useful transient begins.
3. Move **Start Offset** with the slider or the **Start -1 ms / +1 ms / -10 ms / +10 ms** nudge buttons until the marker lines up with the transient.
4. Click **Preview Sample** to hear the current trim and fade settings.
5. Adjust **Fade In** and **Fade Out** if the trimmed sample clicks or needs a softer edge.

Real silence trimming, transient detection, upload, effects, and export are intentionally left for later.


## Track management and reset controls

- Click **+ Add Track** in the Step Sequencer to create the next empty one-shot track with 16 inactive steps and default playback settings.
- Click **Remove** on an added track row to remove it. The app keeps at least one track and automatically selects another track if the selected one is removed.
- In Track Controls, **Reset Settings** restores volume, pitch, start/end trim, fades, mute, and solo to defaults.
- **Clear Notes** removes note/chord data while keeping active steps active.
- **Clear Pattern** turns every step off and removes note/chord data.
- **Reset Track** clears the assigned sample, returns the mode to one-shot, resets settings, and clears the pattern.
