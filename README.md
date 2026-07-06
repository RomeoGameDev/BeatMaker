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
- Ten CSS-variable skins: Dusty Purple, Winamp Classic Inspired, Green CRT, Acid Green, Amber Terminal, Blue Steel, Hot Pink Tracker, Grey Reaper-ish, Cyber Yellow, and Midnight Red.
- Real browser-decoded waveform display for assigned samples and independent Sample Editor original/processed waveform comparison.
- Basic pattern arrangement with Patterns A-D, duplicate/clear pattern actions, 16 timeline slots, and simple arrangement playback.

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

The Sample Editor panel is now independent from Track Controls. It fetches the assigned sample in the browser, decodes it with AudioContext, draws a real purple canvas waveform, and overlays markers for start offset, end trim, fade in, and fade out. If a file cannot be fetched or decoded, the panel shows a friendly message instead of crashing.

### How to align a late sample

1. Select the track that has the late sample assigned.
2. Open Sample Editor and use the real waveform to find where the useful transient begins.
3. Move **Start Offset** with the slider or the **Start -1 ms / +1 ms / -10 ms / +10 ms** nudge buttons until the marker lines up with the transient.
4. Click **Preview Edited** to hear the current trim, fade, gain, and pitch settings.
5. Adjust **Fade In** and **Fade Out** if the trimmed sample clicks or needs a softer edge.

Use **Preview Original** to compare against the untouched source. Switch waveform mode between **Original**, **Processed**, and **Overlay**. **Download Edited WAV** creates a browser download named like `originalname_edited.wav`; it does not write directly to `public/samples` or any server folder. Real silence trimming, transient detection, upload, and editor FX are intentionally left for later.


## Track management and reset controls

- Click **+ Add Track** in the Step Sequencer to create the next empty one-shot track with 16 inactive steps and default playback settings.
- Click **Remove** on an added track row to remove it. The app keeps at least one track and automatically selects another track if the selected one is removed.
- In Track Controls, **Reset Settings** restores volume, pitch, start/end trim, fades, mute, and solo to defaults.
- **Clear Notes** removes note/chord data while keeping active steps active.
- **Clear Pattern** turns every step off and removes note/chord data.
- **Reset Track** clears the assigned sample, returns the mode to one-shot, resets settings, and clears the pattern.

## Retro DAW/Sampler MVP improvements

The app has been extended toward a small retro DAW/sampler workflow while keeping the original one-shot, track assignment, sequencer, and keyboard basics intact.

### Better waveform preview and playhead

- Assigned samples are fetched and decoded in the browser with `AudioContext`.
- The waveform is drawn on canvas from real audio data using min/max peak downsampling instead of fake/random bars.
- Stereo files are visually mixed across available channels.
- Decoded peak data is cached by sample path so trim, fade, pitch, and volume slider changes do not re-decode the sample.
- The waveform shows a dark retro background, purple peaks, a center line, selected playback region, start marker, end trim marker, fade regions, fade curves, and an approximate yellow playback playhead.
- Loading, unavailable, decode-error, and no-sample states show friendly messages.

### Fade curves

Track settings now include fade amount and visual curve shape:

- `fadeInMs`
- `fadeOutMs`
- `fadeInCurve`
- `fadeOutCurve`

Available curve shapes are `linear`, `easeIn`, `easeOut`, and `exponential`. Tone.Player still uses simple fade-in/fade-out timing for audio; custom fade curve audio automation is planned for later.

### FX Rack

Each track now has a simple Reaper-inspired FX chain. You can:

- Add EQ, Reverb, Overdrive, Distortion, Compressor, Delay, Chorus, Bitcrusher, Filter, Limiter, or Noise Gate.
- Add the same effect more than once.
- Enable/bypass each effect instance.
- Edit each instance independently.
- Reset, duplicate, remove, move up, and move down modules.
- Bypass all FX, reset all FX params, or remove all FX.

The audio engine attempts safe per-hit routing for enabled FX and falls back to dry playback if an FX node or chain fails, so the sequencer should keep running.

### MVP effects

- **EQ**: 3-band or 4-band peaking-filter chain with per-band frequency, gain, and Q controls.
- **Reverb**: wet, decay, and pre-delay.
- **Overdrive**: drive, tone, and wet using a simple distortion + tone filter approach.
- **Distortion**: amount and wet.
- **Compressor**: threshold, ratio, attack, release, and optional makeup gain.
- **Delay**: wet, delay time, and feedback.
- **Chorus**: wet, modulation frequency, delay time, and depth.
- **Bitcrusher**: bits and wet UI. Tone 15 does not expose direct wet on the BitCrusher node yet, so playback currently applies the crusher itself and keeps a TODO for dry/wet routing.
- **Filter**: lowpass, highpass, or bandpass with frequency, Q, and gain.
- **Limiter**: threshold.
- **Noise Gate**: threshold, attack, and release UI with a safe Tone.js compressor-based approximation for now.

Each effect has a per-instance **Reset** button powered by `getDefaultEffectParams(effectType)`. These are intentionally simple MVP effects, not final mastering-grade plugins.

### Clickable Chord Composer

Keyboard mode now includes a clickable piano-style Chord Composer:

1. Select a track.
2. Set **Mode** to **Keyboard**.
3. Click a step in the sequencer.
4. Click piano keys such as `C3`, `E3`, and `G3`.
5. Click **Apply to Selected Step**.
6. Press **Play** to trigger multiple pitched hits at that step.

Preset buttons are available for Major, Minor, Sus2, Sus4, Maj7, Min7, and Dom7 chords. After choosing a preset, you can still manually add or remove piano keys.

## Known limitations

- The waveform is real audio data, but a spectrum analyzer is planned later.
- Playhead sync is approximate for MVP and is not sample-accurate yet.
- FX are simple MVP modules and may sound different from full DAW plugins.
- Custom fade curve audio automation is planned later; curve shapes are currently visual while Tone.Player uses simple fade values.
- Export WAV and stems ZIP are not implemented yet.
- Full piano roll editing is not implemented yet.


## Basic Arrangement workflow

- Use the Pattern selector in the Arrangement panel to switch between Patterns **A**, **B**, **C**, and **D**.
- The Step Sequencer edits the currently selected pattern.
- **Duplicate current to** copies the current pattern steps into another pattern.
- **Clear Pattern** empties the active pattern without changing samples, FX, or track controls.
- The 16 timeline slots can be clicked to cycle through Empty, A, B, C, and D.
- **Play Arrangement** plays non-empty slots from left to right, one 16-step pattern cycle per slot. Normal toolbar **Play** still plays only the current pattern.

## Current theme list

- Dusty Purple
- Winamp Classic Inspired
- Green CRT
- Acid Green
- Amber Terminal
- Blue Steel
- Hot Pink Tracker
- Grey Reaper-ish
- Cyber Yellow
- Midnight Red

## Manual test plan for this pass

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the app in the browser.
4. FX: add Delay, change params, click Reset, duplicate Delay, remove one instance, add Bitcrusher/Filter/Limiter, and confirm playback does not crash.
5. Sample Editor: choose a kick sample, Preview Original, change start/fade/gain, Preview Edited, switch Original/Processed/Overlay, and Download Edited WAV.
6. Themes: switch through every skin and confirm controls remain readable.
7. Arrangement: switch Pattern A/B/C/D, create different steps, duplicate a pattern, fill timeline slots, try Play Arrangement, then confirm normal Play still works.

## Known limitations added in this pass

- Edited sample download is browser-only and does not save directly to the server sample folder.
- Processed waveform pitch rendering is approximate/TODO; trim, fade, and gain are represented visually.
- Editor FX are not implemented yet.
- Bitcrusher wet mix and Noise Gate audio are safe MVP approximations around Tone.js limitations.
