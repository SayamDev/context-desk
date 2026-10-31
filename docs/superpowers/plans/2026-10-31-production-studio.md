# Production Studio Implementation Plan

> For agentic workers: execute this accepted plan task-by-task using superpowers:executing-plans. The user requested direct implementation; do not introduce another design approval round.

**Goal:** Apply the ultimate build brief to the existing Context Desk app, beginning with durable project and media recovery.

**Architecture:** SQLite-backed projects, model results, editor revisions and jobs; managed local assets. Existing browser editor remains; background discovery and subtitles use durable bounded workers.

**Tech Stack:** Node >=22.13, node:sqlite, browser JavaScript, FFmpeg, yt-dlp, existing Meta and optional VoiceStudio adapters.

**Spec:** docs/superpowers/specs/2026-10-31-production-studio-design.md

## Global constraints

- Preserve Context Desk and the working integrations; no framework rewrite.
- Six-hour recordings; 20 GB local uploads; 4 GB downloaded working files.
- API keys, footage, transcripts and SQLite files stay out of Git.
- Never mark saved before storage confirmation; never silently restart expensive calls after recovery.
- Timing arithmetic and queue counters are deterministic. Dialect hints are not guaranteed classifications.

## Review focus

- Refresh during edits must preserve acknowledged changes and reconcile pending saves.
- Restart during model work must retain completed outputs and label uncertain in-flight calls.
- Multiple tabs must not overwrite newer edits silently.
- Missing media and failed disk writes must show recoverable errors without deleting project metadata.
- New worker results must coexist with active editor changes.

## Task 1 — Durable storage and import recovery

Files: lib/store.js, lib/imports.js, tests/store.test.js, tests/imports.test.js.
Interfaces: openStore(root), projects CRUD/revisions, source records, stable asset IDs, managed media streams.
- [x] Write failing close/reopen, stale revision, path validation and media retention tests.
- [x] Implement transactional store and stable import directories; migrate readable legacy checkpoint/media metadata when safe.
- [x] Verify source byte ranges before/after process restart and retain current import validation tests.
- [x] Commit the tested slice.

## Task 2 — Project library and autosaved editor

Files: lib/projects.js, server.js, public/projects.js, public/app.js, public/index.html, public/style.css.
Interfaces: /api/projects, /api/projects/:id, /api/assets; revision-checked autosave with managed media references.
- [x] Test project creation/update/reopen, sorting and stale writes.
- [x] Integrate source staging, saved clips/cuts/settings/exports and live-window assets.
- [x] Add Library, real sorting/search, confirmed save status and source recovery.
- [x] Browser test edit + subtitle change + refresh + process restart; inspect actual recovered video.
- [x] Commit the tested slice.

## Task 3 — Durable subtitle and discovery jobs

Files: lib/subtitles.js, lib/discovery.js, lib/media-worker.js, server.js, public/app.js, tests/jobs.test.js.
Interfaces: durable jobs with idempotency keys, safe pause/retry/cancel and actual section/usage counters.
- [x] Test restart recovery, speech cache reuse, queue ordering and cancellation.
- [x] Restore subtitle records and parameters; move recording discovery into a bounded backend worker.
- [x] Reconcile newly generated moments with active edits, publish partial results and expose coherent Jobs counts.
- [x] Test three queued recordings and interruption; no automatic repeat of uncertain provider calls.
- [x] Commit the tested slice.

## Task 4 — Language, glossary, memory and Moment Map

Files: public/library.js, public/languages.js, lib/projects.js, server.js, tests/languages.test.js.
- [ ] Add source/dialect/output choices before import, supported bias construction and persistent glossary.
- [ ] Implement editable Story Memory with human/AI provenance and export/delete.
- [ ] Add translation modes, original/translated comparison, review flags and source coverage map.
- [ ] Verify source-time jumps, ascending/descending clip order and preferences after restart.
- [ ] Commit the tested slice.

## Task 5 — Editing, deterministic export and live reliability

Files: lib/exports.js, public/app.js, tests/exports.test.js, QA.md.
- [ ] Add undo/redo, split and 4:5 while preserving source edit decisions.
- [ ] Implement consistent FFmpeg export jobs, persistent output, progress/cancel and sidecar tracks.
- [ ] Persist actual live media segments and health state; benchmark tracking/fallback before claiming it works.
- [ ] Probe output audio, dimensions, caption timing and RTL rendering on real files.
- [ ] Commit the tested slice.

## Task 6 — Evaluation, performance and submission

- [ ] Add speech/reference evaluation tooling without fabricated dialect scores.
- [ ] Measure restore, first result, export latency and request counts on fixed fixtures.
- [ ] Perform responsive/accessibility checks; retain original artwork and useful familiar controls.
- [ ] Verify official competition requirements and prepare permissioned source-backed demo material.
- [ ] Update README, STATUS, QA, feature matrix and outstanding external validation; report actual evidence.
