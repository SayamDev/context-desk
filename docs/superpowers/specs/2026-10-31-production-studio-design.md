# Context Desk production studio design

Source brief: https://chatgpt.com/share/6ae65f90-6c74-83eb-99f0-96e0c7cefcb8 — explicitly adopted by the user. This extends PROJECT-BRIEF.md; it does not replace the product or its name.

## Intent and baseline

Make the existing studio dependable across refreshes, restarts and multiple recordings. Preserve original artwork, local-first operation, truthful source evidence, editable results and meaningful Meta usage. Baseline commit: 06f3efc; 21 tests pass. Current source records use a temporary directory; clips and edits are browser-only; subtitle checkpoint JSON is written but not restored. These are the primary causes of lost work.

## Approach

Keep Node and the existing browser app. Add the built-in node:sqlite interface (Node >=22.13) with WAL, transactions, schema versioning and revision checks. Managed media lives under ignored `.context-desk/`, with an optional CONTEXT_DESK_DATA_DIR override. SQLite is authoritative; media is referenced through stable IDs. Browser localStorage may hold a last-opened ID but is never authoritative.

A framework rewrite adds migration risk without fixing storage. Browser-only persistence cannot reliably own large media or server jobs. Therefore native SQLite plus managed files is the chosen implementation approach, based on the existing stack and the accepted brief.

## Storage and recovery

Projects preserve source references, language/dialect/preferences, editor state, clip decisions, subtitle corrections, story cuts and export history. Model results and user edits are stored separately so newly completed background work cannot overwrite editing. Revision checks detect competing tab edits. Autosave acknowledges success only after a committed write. Raw captured windows and exports are managed media assets, not transient Blob URLs.

Imports retain stable source IDs and readable media after restart. Saved project media is excluded from cache expiry. Interrupted operations become explicitly interrupted/paused; no external request is described as resumed mid-request. Subtitle jobs retain their options, section records and reusable source recognition results. Discovery runs on the server with durable planned/completed sections and bounded workers, so navigation does not cancel work.

## Product surfaces

Library: searchable projects with real ascending/descending sorting and saved preferences. Discover: exact recording length, sampled/story coverage, candidates, remaining sections and a clickable Moment Map. Studio: existing editor with autosave, undo/redo, caption comparisons and deterministic edit data. Jobs: coherent waiting/running/paused/failed/completed counts, safe retry/cancel/reorder. Import settings expose spoken language, dialect hints, output subtitles and glossary before automatic discovery.

Story Memory stores editable user-confirmed facts and notes with provenance. It does not guess participant identity. Dialect choices guide interpretation and approved language biasing; no unsupported dialect confidence or native word timings are invented.

## Limits and validation

Keep six-hour duration, 20 GB local upload, and 4 GB downloaded working file limits. API keys stay server-side. Paths are managed IDs; no arbitrary local path API. No unlicensed reference assets or private competitor code. Actual media health, audio, exported subtitles and costs require evidence. Full dialect evaluation needs permissioned audio and validated references; software tests alone cannot establish accuracy.

Each vertical slice must retain passing tests and receive actual UI/media QA where relevant. Required scenarios include refresh, server restart, multiple projects, sorting, queue accounting, source relinking, stale saves, failures, cancellation and bounded model reuse.

## Further brief coverage

After recovery/library/jobs/language foundations: transcript-guided discovery and Moment Map; Story Memory/glossary and translation modes; reliable FFmpeg exports, undo/redo and 4:5; opt-in evaluated tracking; robust durable live segments; speech evaluation tooling; measured performance, accessibility and competition demo/compliance review. These remain requirements until implemented or explicitly documented as externally blocked. No win, virality, complete dialect support or platform universality is promised.

SQLite API source: https://nodejs.org/api/sqlite.html. The local runtime was verified as Node 26.5.0 with DatabaseSync available.
