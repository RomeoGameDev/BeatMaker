# Workstation Music

Workstation Music is a beginner-friendly browser music workstation MVP inspired by early-2000s web tools, Winamp/QMMP skins, trackers, samplers, and simple guitar helpers.

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

Put one-shot samples in `public/samples/oneshots/` and loop samples in `public/samples/loops/`. They are served in the browser as `/samples/oneshots/...` and `/samples/loops/...`, so WAV filenames such as `kick01.wav` and `kick02.wav` work from the one-shot folder. New samples start in an idle state; selecting, assigning, previewing, or starting playback preloads and decodes them into an in-memory cache so subsequent playback starts immediately. The first play after adding a file may show **Loading sample...** while the browser fetches and decodes audio, but the result is cached and reused until the page is refreshed.

Supported extensions are `.wav`, `.mp3`, `.ogg`, and `.flac` when the current browser can decode that exact file/codec through Web Audio. PCM WAV is the safest format. Categories are guessed from lowercase filenames such as `kick`, `snare`, `hat`, `clap`, `perc`, `bass`, `guitar`, `melody`, or `loop`; anything else is `other`.

## Layout, tabs, and UI density

Workstation Music now uses a denser, DAW-style layout:

- **Top toolbar:** app title, global Play/Stop, BPM, skin selector, layout mode, Font size (Small / Normal / Large), helper text toggle, and Reset Layout.
- **Library / Export tabs:** Sample Library and Export share the left tool area.
- **Tools tabs:** Track Controls, Waveform / Slicer, and Guitar Tools share the central tool area.
- **Arrangement:** is grouped as a compact strip directly above the Step Sequencer.
- **Step Sequencer:** spans the full width at the bottom and can scroll horizontally for longer patterns.

Window minimize/maximize controls were removed from panel title bars. Collapsible sections inside panels, such as Region and Loop Controls, remain available.

### Persisted UI preferences

The browser remembers these settings in `localStorage`: selected skin, font size, layout mode, helper text visibility, and the selected Library/Export and Tools tabs.

### Font size and density

The toolbar Font setting supports **Small**, **Normal**, and **Large**. Small makes text and controls denser, Normal is the default, and Large improves readability. The selected font size is persisted in `localStorage` and applied with `font-small`, `font-normal`, and `font-large` CSS classes. Layout modes remain **Compact**, **Balanced**, and **Spacious**; button and step compactness now follows the active layout/font CSS instead of a persistent Compact Buttons toolbar option.

### Helper text toggle

Long instructional copy is wrapped as helper text and can be hidden globally with **Hide Helpers**. Warnings, errors, labels, and critical statuses stay visible.

## Track Controls

Track Controls is the main sound-editing tab for the selected track. It includes sample editing and track rendering tools:

- Assigned sample name, filename, category, and type.
- Track mode, root note, and octave range for keyboard/chord mode.
- Original / Processed / Overlay waveform modes.
- Collapsible **Region** and **Loop Controls** sections with compact `▸` / `▾` header toggles, summaries, spacing, and padding.
- Region-based sample selection with **Region Start**, **Region End**, and **Region Length** readouts, plus fade, pitch, volume, mute, and solo controls.
- Fade curve selectors.
- FX Rack.
- Simplified primary actions: **Play**, **Render to New Sample**, and **Reset**. Advanced destructive/cleanup actions live in an expandable Advanced section.

The collapsible region controls are useful for cutting one hit from a long loop: set **Region Start** near the hit, set **Region End** just after it, and use **Region Length** to confirm the selected duration in milliseconds and seconds. The old trim model remains compatible internally: `startOffsetMs` maps to Region Start and `endTrimMs` maps to `sampleDurationMs - Region End`.

The processed waveform currently approximates the selected region, fade, pitch-length changes, and volume. Full FX waveform rendering is marked as coming soon, but **Play Track** uses the current track settings and FX chain during playback.

Track render buttons download files to your computer:

- **Render Selected Track WAV** downloads a processed dry WAV with selected-region/fade/pitch/volume.
- **Render Selected Track Dry WAV** downloads the same dry render with a `dry` suffix.
- **Render Selected Track With FX WAV** is intentionally disabled as coming soon.

Browser limitation: rendered files download to your computer. They do **not** automatically appear in `public/samples`, because there is no backend save endpoint.

## Step Sequencer

The full-width bottom Step Sequencer edits the active pattern with compact tracker-style step blocks and exposes quick per-track volume and pitch controls on the right side of each track row. It supports dynamic tracks, step playback, keyboard mode, and chord mode.

Step count can be changed per active pattern using allowed values **4, 8, 16, 24, and 32**. Increasing the step count adds inactive steps. Decreasing the step count truncates extra steps while preserving earlier hits. Sequencer playback uses the current active pattern's step count.

## Arrangement

Arrangement is visually grouped with the Step Sequencer as a compact strip directly above the main step grid and is simplified around patterns:

- The app starts with **Pattern A**.
- **Add Pattern** creates the next pattern with empty steps for all tracks.
- **Remove Pattern** removes added patterns only; the default/last pattern cannot be removed.
- **Copy Pattern** copies all current track steps.
- **Paste Pattern** pastes copied steps into the active pattern.
- Timeline slots can be clicked to cycle through Empty and the available patterns.
- Toolbar **Play** plays the current pattern.
- **Play Arrangement** plays timeline slots left to right; empty slots act as silence for one pattern cycle.

## Export

The Export panel provides status-driven exports:

- **Export Current Pattern WAV**: implemented as a dry mono mix. It preloads all active-pattern samples, respects one-shot/keyboard/sliced tracks, imported/rendered samples, track volume, pitch, selected regions, fades, and mute/solo, then downloads `workstation-current-pattern.wav`.
- **Export Arrangement WAV**: implemented as a basic dry mono arrangement render. Timeline slots render sequentially, empty slots render silence, each slot uses the active pattern step duration at the current BPM, and the download is `workstation-arrangement.wav`.
- **Export Selected Track WAV**: implemented from the selected track's assigned sample and current region/fade/pitch/volume settings. The downloaded filename starts with the rendered track/sample name.
- **Export Stems ZIP**: disabled with an honest coming-soon label in this pass because the `jszip` dependency was not available in the current package registry environment.
- **Export Project JSON**: implemented. Downloads tracks, patterns, arrangement, BPM, selected theme, and settings. It does not embed audio files.
- **Import Project JSON**: implemented. Restores the project data and expects referenced samples to exist locally.

Export limitations: FX are rendered dry for now, decode-failed or missing samples are skipped with a toolbar warning, and large files/projects may take time to preload and render. Project JSON only references samples by their local paths, so the same sample files must exist under `public/samples` when reopening/importing a project.

## FX Rack and playback modes

Each track has an FX Rack with EQ, Reverb, Overdrive, Distortion, Compressor, Delay, Chorus, Bitcrusher, Filter, Limiter, and Noise Gate modules. Effects can be enabled, bypassed, reset, duplicated, reordered, or removed.

One-shot mode triggers samples like drum pads. Keyboard mode treats the assigned sample as a pitched instrument. Chord mode for keyboard steps can trigger several pitched hits at the same step.

## Known limitations

- FX waveform rendering and WAV export with FX are coming soon.
- Stems ZIP is coming soon until JSZip is available.
- Pattern, arrangement, and track WAV rendering are mono dry renders with selected-region/fade/pitch/volume; FX export is not included yet.
- Decode-failed samples are skipped from render/export and should be converted to browser-decodable PCM WAV.
- Large sample files may take noticeable time to fetch/decode/render; status messages indicate preload/export progress.
- Playhead sync is approximate and scoped to the active preview/track context.
- There is no backend save to `public/samples`.
- Cloud accounts, Winamp `.wsz` import, drag-and-drop windows, advanced DAW timelines, and full spectral analysis are intentionally not implemented.

## Manual test plan

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the app in the browser.
4. Confirm the Sample Editor panel is gone.
5. Select Track 1 with an assigned kick.
6. In Track Controls, switch waveform Original / Processed / Overlay, move Start/Fade/Volume, confirm visualization changes, and click Play Track.
7. In Step Sequencer, set steps to 8, add hits, set steps to 16 and confirm old hits remain, then set max 32 and test playback.
8. In Arrangement, create Pattern B, edit Pattern A and B differently, copy/paste a pattern, fill timeline slots, and try Play Arrangement.
9. In Export, export Current Pattern WAV, Arrangement WAV, Selected Track WAV, and Project JSON; confirm Stems ZIP is visibly disabled as coming soon.
10. Confirm Guitar Tools is in the left column before Export, minimize/maximize panels, and use Reset Layout.

## Guitar Tools

Guitar Tools currently supports **chords/stabs**. Riff mode, sequential note/riff UI, **Generate Tab from Riff**, **Render Riff**, and riff preview are hidden for now; riff tools are planned later.

Workflow:

1. Select a **Source Sample** from discovered one-shots, loops, or rendered in-app samples.
2. Choose notes with the Chord Helper, compact piano, or the 0-12 fret standard-tuning fretboard (`E A D G B e`).
3. Play selected notes or the Chord Helper chord using the source sample and current app BPM.
4. Add optional **Guitar Lab FX**. Play supports safe mini FX routing where available; render currently applies volume and pitch offset, with time/modulation FX marked as TODO/bypass.
5. Render the chord/stab to a new locally saved rendered sample, or send the chord/selected notes to the selected Keyboard-mode sequencer step.

Rendered Guitar Tools samples appear in Sample Library immediately, are saved locally in browser IndexedDB, survive refresh, remain previewable/assignable after reload, and can be removed from Sample Library.

The old manual Tab Scratchpad is now a collapsed **Generated Tab** output area. It generates copyable ASCII tab from selected fretboard notes. If notes only came from the piano/chord helper, it asks you to select notes on the fretboard to generate exact tab.

## Playback, Loops, and Rendered Samples

- **Global Stop stops all audio and visuals.** The main Stop button now stops the Tone transport, clears sequencer scheduling, stops arrangement playback, disposes currently playing preview/track players, cancels waveform playhead animation frames, and clears the playhead marker so long previews do not continue in the background visually or audibly.
- **One-shots vs loops.** One-shot samples keep the normal step-trigger behavior. Loop or long samples can use loop controls so a trigger step claims a region instead of retriggering every cycle.
- **Collapsible Region and Loop Controls.** Track Controls shows Region and Loop Controls as compact collapsible sections. Region summarizes start/end/length, and Loop Controls summarizes mode, loop length, and sample length. Loop Controls opens by default for loop or long samples and stays compact for short one-shots.
- **Loop length in steps.** Loop tracks can choose 1, 2, 4, 8, 16, 24, or 32 steps. The sequencer shades the occupied steps after the trigger step. Step duration is based on the current BPM using 16th notes.
- **Loop retrigger behavior.** Retrigger Loop is off by default to prevent overlapping long loops on the same track. Turning it on stops the previous loop on that track and restarts from the new trigger.
- **Dynamic sample trim ranges.** The browser decodes sample duration when a sample is previewed, assigned, or selected. Start Offset and End Trim ranges expand to the actual sample length, while Fade In/Out allow up to the shorter of the sample length or 5000 ms. If duration is not loaded yet, the app uses safe fallback ranges.
- **Render to New Sample.** Track Controls can render the selected track's current sample into a new in-app sample using trim, fade, pitch, and volume. FX rendering into the new sample is not included yet; normal playback FX remain unchanged.
- **Rendered sample persistence.** Rendered in-app samples are saved locally in this browser via IndexedDB. They survive F5/page reload, are previewable/assignable after reload, and can be removed from Sample Library. Removing a rendered sample deletes it from IndexedDB, revokes its object URL, and unassigns it from tracks safely.
- **Physical sample files.** Browser apps cannot delete files in `public/samples`; remove physical sample files from disk manually.
- **Arrangement slot count.** Arrangement timelines can be resized to 4, 8, 16, 24, 32, or 64 slots. Increasing adds empty slots; decreasing truncates only the extra slots, and Project JSON saves both the slot count and slot contents.
- **Project JSON and rendered samples.** Project JSON stores rendered sample references/metadata, but not raw audio blobs. Rendered audio remains local to this browser in IndexedDB; import reconnects samples that exist locally and warns when a referenced rendered sample is missing.

### Audio troubleshooting: browser-decodable WAVs

Some WAV files are not browser-decodable even when they play correctly in DAWs or desktop audio tools. The app can find those files by path, but Web Audio `decodeAudioData` may still reject their encoding. When that happens, the Sample Library labels the file as **decode failed = preview fallback only** instead of missing. The Play button may still audition it through browser audio, but waveform, trim, sequencing, and render/export features require a WebAudio-decodable file.

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

## Guitar Tools cleanup notes

- Guitar Tools now uses one shared selected-notes state for both the fretboard and piano keyboard, so selecting a note in either view highlights it in both places where that exact note appears.
- The fretboard is a compact visual helper with fret numbers 0–12, single marker dots on frets 3, 5, 7, and 9, and a double marker at fret 12. Open strings use a distinct nut/open-string style.
- The Generated Tab section is collapsed by default and provides Generate from Selected Notes, Copy, and Clear actions.
- Sample Library audio-file debug details are hidden by default after refresh and can be opened with the Show debug toggle.
- Rendered/in-app samples are marked as removable and are saved in IndexedDB. Object URLs are revoked when removed.
- Physical files in `public/samples` cannot be deleted from the browser without a backend; remove those from disk manually.
- The workspace includes Compact Left, Balanced, and Wide Left layout modes, persisted in localStorage, to make the left Guitar Tools column easier to work with.


## Generated Tab workflow

Guitar Tools includes a collapsed-by-default **Generated Tab** section. It is output-only: select notes by clicking fretboard cells, then use **Generate Tab from Selected Notes** for a chord-style vertical stack. Use **Copy Tab to Clipboard** to copy the ASCII tab; the app uses `navigator.clipboard.writeText` when available and falls back to selecting the textarea plus `document.execCommand("copy")`. If you only click piano keys or use the chord helper, the app asks you to select fretboard positions first so it can preserve exact string/fret choices.

## Browser PCM WAV conversion workflow

Browser conversion is planned. The broken in-app conversion buttons are hidden for now. When a sample is found but WebAudio cannot decode it, Sample Library keeps this manual helper command visible:

```bash
ffmpeg -y -i input.wav -acodec pcm_s16le -ar 44100 output.wav
```

Limitations:

- The browser cannot delete or overwrite old files in `public/samples` without a backend.
- To permanently use a converted sample, run ffmpeg manually and place the WAV in `public/samples/oneshots/` or `public/samples/loops/`.


## Waveform / Slicer, imports, and track mute/solo

### Importing custom samples
- Use **Sample Library → Import Sample** to load `.wav`, `.mp3`, `.ogg`, or `.flac` files from your browser.
- Imported samples are saved in the browser with IndexedDB, so they survive refresh/F5 in the same browser profile.
- The import type can be forced to **one-shot** or **loop**, or left as **auto**. Auto treats files longer than 2 seconds as loops.
- Imported, rendered, and converted in-app samples show local-storage labels and can be removed from the app. Removing deletes the IndexedDB record, revokes the object URL for the current session, and unassigns that sample from tracks.
- Disk samples from `public/samples` cannot be deleted by browser-only code; remove those files manually or add a backend later.
- If a file imports but WebAudio cannot decode it, it remains in the library for browser preview fallback and shows: “Imported, but not WebAudio-decodable. Convert to PCM WAV for editing.”

### Waveform / Slicer workflow
1. Select a sample in the Sample Library.
2. Open **Waveform / Slicer** to see the decoded waveform.
3. Choose an equal split size: 2, 4, 8, or 16.
4. Click **Split** to create slices such as `1/4`, `2/4`, `3/4`, `4/4`.
5. Each slice stores start/end milliseconds plus attack/fade values.
6. Drag across the waveform to select a custom region; the selection overlay shows start, end, and length.
7. Use **Play Selection** to audition only that selected region, **Add Selection as Slice** to create a `Custom N` slice, or **Clear Selection** to remove the overlay.
8. Adjust slice boundaries by dragging the basic waveform start/end handles or by editing numeric Start/End values in the slice list. Slice playback, sliced-track creation, and export use the updated boundaries.
9. Play individual slices, rename/duplicate/remove slices, sort if needed, then click **Create Sliced Track**.
10. The Step Sequencer adds one parent sliced track with a row for each slice. Trigger each slice independently on steps.

All Play buttons are exclusive: starting Sample Library, Track Controls, Waveform / Slicer, slice, Guitar Tools, Arrangement, or Sequencer playback first stops currently playing audio, preview players, playheads, and transport scheduling. The global Stop button stops everything and clears playheads.

### Mute and Solo
- Mute and Solo controls now live directly on each Step Sequencer track header.
- Muted tracks stay visible/editable but do not play or export.
- If any track is soloed, only soloed tracks play/export. Multiple tracks may be soloed.
- This applies to one-shot, keyboard, loop, and sliced tracks. Track Controls now focuses on sound settings, region controls, pitch/volume, and FX rather than row-level mute/solo.

### Export status
- **Export Current Pattern WAV** renders the current pattern mix dry and respects mute/solo. It includes one-shot, keyboard, loop, sliced, imported, and rendered samples when WebAudio can decode them.
- **Export Arrangement WAV** is intentionally disabled with a coming-soon message until arrangement rendering is stable.
- **Export Stems ZIP** is intentionally disabled with a coming-soon message until stem packaging is implemented.
- FX export may be dry for now; full FX rendering in export is a later pass.

### Current limitations
- Slice drag handles are a basic MVP; advanced snapping and neighbor-aware boundary constraints are planned later. Overlapping slices are currently allowed.
- Transient detection / auto-chop is not implemented yet.
- Some export paths are dry if FX offline rendering is unavailable.
- Browser-only apps cannot save imported files into `public/samples` or delete physical disk samples without a backend.

## Compact Sample Library and Export tab

Sample Library is compact by default. Rows show the sample name, type/category badges, Play, Assign, and local Remove only when the sample is imported/rendered/local. Expand a row or switch to Detailed mode to see filename, duration, status, path, conversion helper text, and debug info. Disk samples still cannot be destructively removed from the browser.

Export moved next to Sample Library in the **Library / Export** tabs. Export Current Pattern Mix WAV, Project JSON export, and Project JSON import remain active. Arrangement WAV and Stems ZIP stay disabled with clear Coming Soon labels until implemented.


## 2026 compact layout cleanup

- GUI scale +/- controls, percentage display, reset scale icon, and the persistent Compact Buttons toolbar option were removed. Font size now uses Small / Normal / Large and persists via `localStorage` with `font-small`, `font-normal`, and `font-large` classes.
- The Step Sequencer now uses a denser tracker/drum-machine style with smaller flatter cells, compact step numbers, current-step outlines, and right-side vertical Vol/Pitch/Mute/Solo/Remove controls.
- Fresh projects start with **2 tracks**. Track 1 and Track 2 use different default colors, new tracks cycle through a color palette, and project JSON preserves track colors.
- Arrangement is grouped directly above Step Sequencer so pattern slots and step editing share one lower workspace level.
- Sample Library rows are compact list items with small Play/Assign/Remove buttons, truncated names, expandable details/debug information, and a scrolling list container.
- Export remains beside Sample Library but uses compact spacing and small action buttons.
- Old panel maximize/minimize/close icons are not used; only purposeful collapsible section arrows/details remain.

## Playback performance and layout cleanup

The Step Sequencer live path now preloads project audio before starting Tone.Transport. Samples used by active tracks, including sliced-track source samples and browser-local rendered/imported samples, are decoded once and read from a shared sample cache during playback. Sequencer ticks skip unloaded or decode-failed samples with a friendly “Sample not loaded yet.” status instead of fetching or decoding inside the timing callback.

Live sequencer triggering now prioritizes stable timing: one Transport scheduler is cleared before every new play, Stop cancels scheduling and active players, and ticks use Tone's scheduled time argument while avoiding sample fetch/decode work. Per-hit live FX are bypassed for now to avoid rebuilding expensive FX chains on every 16th-note; preview and dry export paths remain available, and live FX reuse can be optimized in a later pass.

UI work during playback has also been reduced. The current step indicator remains lightweight, waveform playhead animation is not passed into hidden Tools tabs, and the performance debug readout is hidden behind the helper/debug toggle. The debug readout shows cached sample count, loading/failed samples, currently active players, scheduler state, and last preload time.

Layout changes:

- The bottom full-width workspace now has tabs for **Step Sequencer** and **Arrangement**.
- Arrangement is no longer a separate panel above the sequencer; its existing controls live inside the Arrangement bottom tab.
- **Library / Export** and **Tools** panels have compact ▾ / ▸ collapse buttons in their title bars, and their collapsed state is saved in localStorage.

Known limitation: live sequencer playback may be dry when track FX are enabled. This is intentional for the performance pass so timing stays tight while per-track reusable live FX chains are optimized later.
