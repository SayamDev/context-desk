# Keeping the local server in step with the app code

Status: implemented on `feat/live-buffer-studio`. Reviewed with the Elephant-Goldfish consolidated
review, and revised (see `docs/design/review/consolidated_review_report.md`).

## Problem

Context Desk is one Node process (`server.js`). It serves the browser app from `public/` and runs
the API from `lib/`. The browser reads `public/` files again on every page load, because the server
sends them with `Cache-Control: no-store`. The server's own modules are loaded once, at startup:
`server.js`, the `lib/` modules it imports, and the shared `public/` modules that those import
(for example `public/caption-styles.js`). This document calls these the **server modules**. Every
other file in `public/` is a **browser-only file**.

If the server modules change on disk while the old process keeps running, a refresh pairs new
browser code with an old server. On 2 November 2026 the server on port 3001 had been running for
ten hours across seven commits. After a refresh:

- `GET /api/import/:id/frame` returned 404, so the timeline filmstrip (a strip of stills under the
  trim handles) and clip-card thumbnails were empty.
- `GET /assets/fonts/NotoEmoji.ttf` returned 404, so emoji in captions could not render.
- Saves returned success, but the old server keeps only the clip fields it knows about. It removed
  four newer ones: `cuts` (removed pauses), `hookVariants` (A/B hooks), `captionAccents` (keyword
  and emoji highlights) and `splitCam` (streamer layout). The user was not told.

## Goals

1. During development, a change to a server module reaches the running server without a manual
   restart.
2. A server running older code than is on disk never saves part of an edit. It refuses the save,
   the edit is kept whole, and the user is told to restart.
3. Changing only a browser-only file never triggers that warning, because a page refresh already
   picks it up.

## Non-goals

- Reloading the browser automatically. A refresh already loads the newest browser-only files.
- Detecting changes to `.env` or other non-JavaScript startup inputs. Watching `.env` would restart
  the server on secret edits. Restarting after editing `.env` stays a manual step, as the README
  says.
- Running different versions of the browser app and the API side by side. This is a local,
  single-user tool, and they always ship together.

## Design

### Which mechanism covers which case

| How the server was started | Code changes while running | What happens |
| --- | --- | --- |
| `npm run dev` | Server module edited | Node restarts the server. No banner. |
| `npm run dev` | Only browser-only files edited | Nothing restarts. A refresh loads them. |
| `npm start` | Server module edited | The server keeps running old code. It refuses saves, and the app shows the banner. |
| A server older than this change | Anything | Its `/api/status` has no `codeStale` field. The app shows the banner. |

### Automatic restart during development

`npm run dev` was `node server.js`. It is now `node --watch --watch-preserve-output server.js`.
Node's watch mode restarts the process when any module in the server's import graph changes, which
covers exactly the server modules. `npm start` is still `node server.js`, so ordinary use never
restarts unexpectedly.

A restart ends work held in memory:

- **Live buffer** (recording a live stream, keeping its last 5 minutes and cutting clips from it).
  The recording stops, and its temporary folder, including any clips not yet downloaded, is
  deleted. Only a developer editing server code triggers this. We accept that cost for development.
- **Export, whole-video subtitle and clip-discovery jobs.** Each saves a checkpoint to SQLite after
  every finished unit: one clip for exports, one speech section (about 45 seconds of audio) for
  subtitles and discovery. After a restart they resume from the last checkpoint, and the unit in
  progress is redone.

### Detecting out-of-date code

At startup, `lib/code-stamp.js` lists the server modules. It starts at `server.js` and follows
relative imports of `.js` files whose path starts with `./` or `../`. Three forms count:
`from './x.js'`, `import './x.js'` and `import('./x.js')` with a literal path. Package imports such
as `node:fs` are skipped. The "stamp" is each listed file's path and modification time. The server
keeps the stamp it took at startup.

- `GET /api/status` takes the stamp again and returns `codeStale: true` when it differs.
- `PUT /api/projects/:id` (save) answers `409` with `code: 'server-outdated'` when the code is
  stale. It also answers `409` when the saved clips carry a field the server does not know, so a
  version mismatch is caught even before a restart is detected. It never saves part of the edit.
- On a `409`, the app does what it already did for edit conflicts: it stores a recovery copy
  through `POST /api/projects/:id` (`action: 'recovery'`) and stops saving in that tab. Recovery
  copies now keep unknown clip fields as they are, so nothing is lost. The user opens the copy from
  the Library after restarting.

### What the user sees

The app checks `/api/status` when the page loads and again whenever the tab regains focus. It shows
a banner when `codeStale` is true, when the field is missing (the server is older than this
feature), or when a save was refused as `server-outdated`:

> **Restart Context Desk to finish updating.** The local server is running older code. Stop it in
> its terminal (Ctrl+C) and start it again with npm run dev (or npm start). Until then, saving is
> paused and your edits are kept as a recovery copy in the Library.

The status line reads "Server out of date — restart it; your edits are in a recovery copy in
Library". The banner uses fixed colours (`#140904` text on `#ffb020`) so it is readable in both the
dark and the Daylight themes.

### Security

`/api/status` returns only a true/false value, not file paths or times. The server listens on
`127.0.0.1` only. The import scan reads files inside the repository.

## Alternatives considered

- **Watch mode only, no detection.** Simplest, but it does nothing for `npm start` or for servers
  started before this change, which is how the incident happened.
- **A version number or git commit compared between browser and server.** The browser would need
  its own copy, and uncommitted edits would not be detected.
- **Stamping every file in `public/`.** This was the first version. A browser-only edit then showed
  the banner although no restart was needed.
- **Reloading `lib/` modules inside the running process.** Node cannot unload ES modules, and live
  state (jobs, the live buffer) would be split across two copies of the code.

## Risks

| Risk | Mitigation or acceptance |
| --- | --- |
| An import the scan cannot read (a path built at runtime, or a server module outside `lib/`) is left out of the stamp. | `tests/code-stamp.test.js` fails if any `lib/` module is unreachable from `server.js`. `lib/evaluation.js` is the one listed exception: only `scripts/evaluate-speech.js` uses it. |
| Several saves in a row restart the server several times in development, and each restart ends a live buffer recording. | Accepted for development. `npm start` does not watch. |
| A file's modification time changes without its content changing (for example after `git checkout`). | It shows a banner that a restart clears. Accepted. |
| A server goes out of date while a tab stays open. | The app re-checks when the tab regains focus. Saves are refused regardless, so no data is lost. |
| Saves stop until a restart. | Intended: refusing a save is safer than saving part of it. |

## Detailed Implementation Plan

| File | Change |
| --- | --- |
| `lib/code-stamp.js` | **Create.** `serverModules(entry)` lists server modules as described above. `createCodeStamp(entry)` returns `{files, stale}`, and a missing file counts as changed. |
| `server.js` | **Modify.** Import `createCodeStamp` and create `codeStamp` from `server.js`. Add `codeStale: codeStamp.stale()` to `/api/status`. Pass `{codeStale: () => codeStamp.stale()}` to `createProjectApi`. |
| `lib/projects.js` | **Modify.** Export `unknownMomentKeys(state)`. `createProjectApi(store, {codeStale})` answers a save with 409 `server-outdated` when the code is stale or the save has unknown clip fields. `cleanProjectState(…, {keepUnknown: true})` is used for recovery copies. |
| `public/projects.js` | **Modify.** `requestJson` copies `code` onto errors. On a `server-outdated` 409, the save session sends a `context-desk:server-outdated` event and sets the status text. |
| `public/app.js` | **Modify.** `showServerStale(stale)` adds or removes a single `#serverStale` banner (`role="alert"`). It runs from `status()` once per page load, on window `focus`, and on the `server-outdated` event. |
| `public/ds.css` | **Modify.** `.server-stale` is sticky at the top, with `#140904` text on `#ffb020`. |
| `package.json` | **Modify.** `dev` changes from `node server.js` to `node --watch --watch-preserve-output server.js`. |
| `tests/code-stamp.test.js` | **Create.** Scanner coverage and the guard above, stale detection with temporary files, a refused save, the recovery copy keeping an unknown field, and a save succeeding again once fresh. |

### Verification

- `npm test`: 240 tests, 238 pass and 2 are skipped. The skipped ones are the opt-in real-FFmpeg
  RTMP live-ingest tests, which this change does not touch.
- In the browser, on a copy of the real project with the server made out of date: an edited hook
  was refused (the saved hook stayed unchanged), the banner and status text appeared, and the
  recovery copy contained the edit.
- With `npm run dev`, editing a server module restarted the server, and `/api/status` then reported
  `codeStale: false`.
- Four refreshes in a row in Studio each restored the project, its 3805 caption lines, the video and
  "All changes saved". An edit made after a refresh was saved. This guards against the field-loss
  symptom above.
