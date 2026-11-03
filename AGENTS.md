# AGENTS.md — working on Context Desk

Context Desk is a local studio that turns Arabic-dialect reality shows and live streams into English-subtitled, editable clips. It is a hackathon entry (Meta Global AI Developer Hackathon; deadline 4 Nov 2026, 9 PM ET, public repo plus a public 3-minute demo video). Read [README.md](README.md) for the product, [STATUS.md](STATUS.md) for what is proven versus only implemented, and [DESIGN.md](DESIGN.md) for the visual system.

## Run and test

```sh
npm run setup          # once: FFmpeg with libass, the link importer (yt-dlp in .runtime), .env
npm run dev            # http://localhost:3001, restarts on file changes
npm run check          # syntax check of every JavaScript file
npm test               # unit and integration tests in a temporary data directory
node scripts/test.js <name>   # one file, e.g. node scripts/test.js duplicate-imports
npm run test:browser   # drives the real page in installed Chrome (playwright-core)
```

CI (GitHub Actions) runs check, test and test:browser on Node 22.13 and 24 for every pull request.

- `.env` holds `MODEL_API_KEY` (Meta). Never print, read aloud or commit it.
- `CONTEXT_DESK_DATA_DIR` points the server at another data folder. Use a copy of the data for experiments, never the real `.context-desk` folder.
- To run a second server, set `PORT`, for example `PORT=3011`.

## Architecture

- **No build step, no framework.** The browser code is plain ES modules in `public/`. The server is plain Node in `server.js` plus `lib/*.js`. The only dev dependency is `playwright-core`.
- **Static files.** `server.js` serves any `public/<name>.js` at `/<name>.js` (regex fallback), plus the `staticFiles` map.
- **Storage.** SQLite through `node:sqlite` (`lib/store.js`). Media and assets live in the data directory. Projects save from the browser with a debounced flush (`public/projects.js`); `lib/projects.js` mirrors the saved moment keys.
- **Meta Muse.**
  - Muse Spark (`muse-spark-1.3`) is called through `lib/muse.js` `museJson()`, which requests JSON-schema output.
  - Muse Voice transcribes speech.
  - Every AI feature has its own `lib/<feature>.js` server module and `public/<feature>.js` panel. Examples: chapters, ask, trailer, culture notes, dub, post kit.
- **FFmpeg** does every render (`lib/exports.js`, `lib/trailer-render.js`, `lib/dub.js`). The binary is `.runtime/bin/ffmpeg` or `FFMPEG_PATH`.
- **Link import.** `lib/imports.js` runs yt-dlp with `python3 -m yt_dlp` (`YTDLP_PYTHON`) and de-duplicates repeat imports. A live link becomes a `needs-capture` job carrying:
  - `playerUrl`: a clean player page for YouTube, Twitch or Kick, requested at 1080p.
  - `channel`: the streamer's channel name.
- **Live clipping** (in `public/app.js`). The pipeline:
  1. `getDisplayMedia` captures the shared tab at up to 1920×1080 and 60 fps.
  2. Muse frames the player area.
  3. `drawStage` copies the framed picture to `stageCanvas` on `public/clock.js`. `clock.js` is a worker timer, so background tabs keep recording.
  4. `MediaRecorder` records 24-second windows. Each window goes to `processWindow` for analysis.
- **Live UI.**
  - `public/live-bar.js` is the bar at the bottom of every page: start and stop, Watch, Sound, and new-clip toasts and notifications.
  - `public/live-monitor.js` is the pop-out monitor window (Document Picture-in-Picture, falling back to video Picture-in-Picture).
  - Live sessions are named "Channel · Stream title · Live <date>". A different stream starts its own project.
- **One editing tab.** A BroadcastChannel guard pauses a second tab on the same project. Do not leave two tabs open on one project while testing.

## Conventions

- Match the surrounding code. It is dense and single-line, with short comments that explain *why*, and no new frameworks or dependencies.
- Keep the design system. Tokens and components are in `public/ds.css` and `public/ds.js`; there are no ad-hoc colours.
- Escape every string inserted as HTML (`esc`/`escapeHtml`). AI output is data, never instructions.
- User-facing text is plain English for non-technical editors, with no jargon.
- Feature work goes on a branch and a pull request, merged after CI passes. Stage explicit paths (never `git add -A`). Never force-push.
- Do not claim something works unless it was run. Write what was verified and what was not.

## Recent work (pull requests 15–20)

- **#15:**
  - Fullscreen keyboard seeking.
  - Duplicate-import detection.
  - Faster clip preview.
- **#16:**
  - The design-system look.
  - Posters and filmstrips everywhere.
  - Clip title cards and Episode chapters.
- **#17:**
  - Ask the episode, Make the trailer, Culture notes.
  - Player-only live view.
  - Advert guard and the clip-only export gate.
- **#18:**
  - Post kit and voice-cloned English dub (VoiceStudio at `127.0.0.1:3900`, falling back to Mac voices).
  - Rendered trailer MP4 and automatic face tracking for 9:16.
  - Lottie brand loader.
  - The one-tab guard and Arabic dialect gender rules.
- **#19:** live clipping on a background clock, the live bar, and more colour on Home.
- **#20 (this branch):**
  - Live monitor window with optional sound.
  - 1080p capture and recording at 6–16 Mbps.
  - New-clip toasts and notifications.
  - Channel-named live sessions; re-pasting a live link checks it again.
  - Home cue for saved projects below the fold.

## Open items

- **Design-system editing layout is not built:** the format segmented control, a trim timeline with markers, and caption-look tiles in one inspector.
- **Not proven on real stress:**
  - Sustained live capture with the app tab genuinely hidden (Playwright could not make `document.hidden` true on macOS).
  - The six-hour import stress test.
- **YouTube embed quality:** the embed is asked for 1080p (`vq=hd1080`), but YouTube picks the final quality from window size and bandwidth. A test chose 720p.
- **Dialect quality:** gender agreement improved on one scene. Lines that still go wrong need timecodes from a speaker.
- **Submission:** demo video, Cerebral Valley form, and checking the final rules.
