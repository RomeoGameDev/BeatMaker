# Dusty Workstation

Dusty Workstation is a beginner-friendly browser music workstation MVP inspired by early-2000s web tools, Winamp/QMMP skins, trackers, samplers, and simple guitar helpers.

## How to run

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. For a production/type check, run:

```bash
npm run build
```

## Samples

Automatic sample discovery scans these folders at build/server-render time:

```text
public/samples/oneshots/
public/samples/loops/
```

Supported extensions are `.wav`, `.mp3`, `.ogg`, and `.flac`. Categories are guessed from lowercase filenames such as `kick`, `snare`, `hat`, `clap`, `perc`, `bass`, `guitar`, `melody`, or `loop`; anything else is `other`.

## Layout and window panels

The simplified workflow is:

- **Left column:** Sample Library, Guitar Tools, Export.
- **Main area:** Step Sequencer, Track Controls, Arrangement.

Panels keep the retro window controls: minimize, maximize/restore, and no close button. **Reset Layout** restores every current panel to normal size. Drag-and-drop windows are intentionally not implemented.

## Track Controls

Track Controls is the main sound-editing area for the selected track. It includes sample editing and track rendering tools:

- Assigned sample name, filename, category, and type.
- Track mode, root note, and octave range for keyboard/chord mode.
- Original / Processed / Overlay waveform modes.
- Trim, fade, pitch, volume, mute, and solo controls.
- Fade curve selectors.
- FX Rack.
- Preview and render buttons.

The processed waveform currently approximates trim, fade, pitch-length changes, and volume. Full FX waveform rendering is marked as coming soon, but **Preview Track** uses the current track settings and FX chain during playback.

Track render buttons download files to your computer:

- **Render Selected Track WAV** downloads a processed dry WAV with trim/fade/pitch/volume.
- **Render Selected Track Dry WAV** downloads the same dry render with a `dry` suffix.
- **Render Selected Track With FX WAV** is intentionally disabled as coming soon.

Browser limitation: rendered files download to your computer. They do **not** automatically appear in `public/samples`, because there is no backend save endpoint.

## Step Sequencer

The Step Sequencer edits the active pattern. It supports dynamic tracks, step playback, keyboard mode, and chord mode.

Step count can be changed per active pattern using allowed values **4, 8, 16, 24, and 32**. Increasing the step count adds inactive steps. Decreasing the step count truncates extra steps while preserving earlier hits. Sequencer playback uses the current active pattern's step count.

## Arrangement

Arrangement is simplified around patterns:

- The app starts with **Pattern A**.
- **Add Pattern** creates the next pattern with empty steps for all tracks.
- **Remove Pattern** removes added patterns only; the default/last pattern cannot be removed.
- **Copy Pattern** copies all current track steps.
- **Paste Pattern** pastes copied steps into the active pattern.
- Timeline slots can be clicked to cycle through Empty and the available patterns.
- Toolbar **Play** plays the current pattern.
- **Play Arrangement** plays timeline slots left to right; empty slots act as silence for one pattern cycle.

## Export

The Export panel provides:

- **Export Project JSON**: implemented. Downloads tracks, patterns, arrangement, BPM, selected theme, and settings. It does not embed audio files.
- **Import Project JSON**: implemented. Restores the project data and expects referenced samples to exist locally.
- **Export Current Pattern Mix WAV**: coming soon.
- **Export Arrangement Mix WAV**: coming soon.
- **Export Stems ZIP**: coming soon.

Project JSON only references samples by their local paths, so the same sample files must exist under `public/samples` when reopening/importing a project.

## FX Rack and playback modes

Each track has an FX Rack with EQ, Reverb, Overdrive, Distortion, Compressor, Delay, Chorus, Bitcrusher, Filter, Limiter, and Noise Gate modules. Effects can be enabled, bypassed, reset, duplicated, reordered, or removed.

One-shot mode triggers samples like drum pads. Keyboard mode treats the assigned sample as a pitched instrument. Chord mode for keyboard steps can trigger several pitched hits at the same step.

## Known limitations

- FX waveform rendering and WAV export with FX are coming soon.
- Current pattern mix WAV, arrangement mix WAV, and stems ZIP are coming soon.
- Track WAV rendering is mono dry render with trim/fade/pitch/volume.
- Playhead sync is approximate and not sample-accurate.
- There is no backend save to `public/samples`.
- Cloud accounts, Winamp `.wsz` import, drag-and-drop windows, advanced DAW timelines, and full spectral analysis are intentionally not implemented.

## Manual test plan

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the app in the browser.
4. Confirm the Sample Editor panel is gone.
5. Select Track 1 with an assigned kick.
6. In Track Controls, switch waveform Original / Processed / Overlay, move Start/Fade/Volume, confirm visualization changes, and click Preview Track.
7. In Step Sequencer, set steps to 8, add hits, set steps to 16 and confirm old hits remain, then set max 32 and test playback.
8. In Arrangement, create Pattern B, edit Pattern A and B differently, copy/paste a pattern, fill timeline slots, and try Play Arrangement.
9. In Export, export project JSON, import project JSON, and try the current pattern WAV button to see the friendly coming-soon status.
10. Confirm Guitar Tools is in the left column before Export, minimize/maximize panels, and use Reset Layout.
