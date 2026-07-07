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

## Themes and skins

The Skin selector includes the existing built-in themes, a readable **Modern Retro 2000s** theme, and three CSS-only themes inspired by classic Windows UI eras:

- **Modern Retro 2000s** — modern dark charcoal/deep-blue panels with readable text, early-2000s glossy titlebars, neon cyan accents, warm orange highlights, darker section boxes, higher-contrast inputs/sliders, cyan/blue original waveforms, and orange/gold processed waveforms.
- **Aero Glass** — Vista-era glass inspiration with translucent blue/purple panels, glossy gradients, cyan accents, cyan/blue original waveforms, and warm gold processed waveforms.
- **XP Royale** — cleaner XP/Royale inspiration with bright blue title bars, cream panel surfaces, rounded controls, royal-blue accents, green secondary accents, blue original waveforms, and orange processed waveforms.
- **Seven Glass** — Windows 7 Aero inspiration with darker blue/grey glass panels, restrained gradients, clean borders, sky-blue accents, light-blue original waveforms, and amber processed waveforms.

These skins are visual homages only. They do not use Microsoft logos, wallpapers, icons, or external image assets; the look is built from CSS variables, gradients, borders, transparency, and shadows. Switching skins updates the whole app instantly without a reload. The selected skin id is remembered in browser `localStorage`, so refreshing the page keeps the same theme unless that theme no longer exists.

## Samples

Automatic sample discovery scans these folders at build/server-render time:

```text
public/samples/oneshots/
public/samples/loops/
```

Put one-shot samples in `public/samples/oneshots/` and loop samples in `public/samples/loops/`. They are served in the browser as `/samples/oneshots/...` and `/samples/loops/...`, so WAV filenames such as `kick01.wav` and `kick02.wav` work from the one-shot folder.

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
- Collapsible **Region** and **Loop Controls** sections with compact `▸` / `▾` header toggles, summaries, spacing, and padding.
- Region-based sample selection with **Region Start**, **Region End**, and **Region Length** readouts, plus fade, pitch, volume, mute, and solo controls.
- Fade curve selectors.
- FX Rack.
- Preview and render buttons.

The collapsible region controls are useful for cutting one hit from a long loop: set **Region Start** near the hit, set **Region End** just after it, and use **Region Length** to confirm the selected duration in milliseconds and seconds. The old trim model remains compatible internally: `startOffsetMs` maps to Region Start and `endTrimMs` maps to `sampleDurationMs - Region End`.

The processed waveform currently approximates the selected region, fade, pitch-length changes, and volume. Full FX waveform rendering is marked as coming soon, but **Preview Track** uses the current track settings and FX chain during playback.

Track render buttons download files to your computer:

- **Render Selected Track WAV** downloads a processed dry WAV with selected-region/fade/pitch/volume.
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
- Track WAV rendering is mono dry render with selected-region/fade/pitch/volume.
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

## Guitar Tools

Guitar Tools is a compact helper in the left column:

- **Chord Helper** with root note and chord type selectors for major, minor, dominant7, major7, minor7, sus2, sus4, diminished, and augmented chords.
- **Send Chord to Selected Step** writes the current chord notes to the selected sequencer step when the selected track is in Keyboard mode.
- **Send Root Note to Selected Step** writes a single root note to the selected step.
- **Fretboard View** shows standard tuning (`E A D G B e`) across 12 frets and highlights the current chord tones.
- **Tab Scratchpad** provides a simple ASCII tab textarea with Clear Tab and Insert Chord Name buttons.

Known limitation: Guitar Tools does not parse tabs or synthesize guitar audio yet; it only helps choose notes and send them to Keyboard-mode sequencer steps.

## Playback, Loops, and Rendered Samples

- **Global Stop stops all audio and visuals.** The main Stop button now stops the Tone transport, clears sequencer scheduling, stops arrangement playback, disposes currently playing preview/track players, cancels waveform playhead animation frames, and clears the playhead marker so long previews do not continue in the background visually or audibly.
- **One-shots vs loops.** One-shot samples keep the normal step-trigger behavior. Loop or long samples can use loop controls so a trigger step claims a region instead of retriggering every cycle.
- **Collapsible Region and Loop Controls.** Track Controls shows Region and Loop Controls as compact collapsible sections. Region summarizes start/end/length, and Loop Controls summarizes mode, loop length, and sample length. Loop Controls opens by default for loop or long samples and stays compact for short one-shots.
- **Loop length in steps.** Loop tracks can choose 1, 2, 4, 8, 16, 24, or 32 steps. The sequencer shades the occupied steps after the trigger step. Step duration is based on the current BPM using 16th notes.
- **Loop retrigger behavior.** Retrigger Loop is off by default to prevent overlapping long loops on the same track. Turning it on stops the previous loop on that track and restarts from the new trigger.
- **Dynamic sample trim ranges.** The browser decodes sample duration when a sample is previewed, assigned, or selected. Start Offset and End Trim ranges expand to the actual sample length, while Fade In/Out allow up to the shorter of the sample length or 5000 ms. If duration is not loaded yet, the app uses safe fallback ranges.
- **Render to New Sample.** Track Controls can render the selected track's current sample into a new in-app sample using trim, fade, pitch, and volume. FX rendering into the new sample is not included yet; normal playback FX remain unchanged.
- **Download rendered WAVs for permanence.** Rendered in-app samples work immediately in the current session and appear in Sample Library, but browser apps cannot write directly into `public/samples` without a backend. Use **Render to New Sample + Download WAV** for permanent saving, then manually move the downloaded WAV into `public/samples/oneshots` or `public/samples/loops` if you want it discovered on the next app start.
- **Arrangement slot count.** Arrangement timelines can be resized to 4, 8, 16, 24, 32, or 64 slots. Increasing adds empty slots; decreasing truncates only the extra slots, and Project JSON saves both the slot count and slot contents.
- **Project JSON limitation.** Project JSON can store rendered sample metadata, but it cannot persist the temporary blob/object URL audio after refresh. Download rendered samples before closing or refreshing the page.

### Audio troubleshooting: browser-decodable WAVs

Some WAV files are not browser-decodable even when they play correctly in DAWs or desktop audio tools. The app can find those files by path, but Web Audio `decodeAudioData` may still reject their encoding. When that happens, the Sample Library labels the file as **decode failed = preview fallback only** instead of missing. The Preview button may still audition it through browser audio, but waveform, trim, sequencing, and render/export features require a WebAudio-decodable file.

Convert problem WAVs to PCM WAV with ffmpeg:

```bash
ffmpeg -y -i input.wav -acodec pcm_s16le -ar 44100 output.wav
```

Recommended formats:

- PCM WAV
- 16-bit
- 44.1 kHz or 48 kHz
- mono or stereo

For example, if `public/samples/oneshots/kick01.wav` is decode-failed but `kick01_pcm.wav` works, keep using the PCM version for editing/sequencing or replace the original with a converted PCM WAV.
