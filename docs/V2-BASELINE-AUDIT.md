# Context Desk V2 baseline audit

Source audit: 1 November 2026. Scope: public application code, project/job/history modules, server routes, and README, STATUS, QA, RESEARCH, EDITORIAL-FOUNDATIONS, DESIGN and ARTWORK. No private configuration, saved recordings, transcripts or provider requests were inspected or used. This is an implementation baseline, not fresh live-capture or editorial-quality validation.

## Keep the production engine

- Keep Node HTTP + browser ES modules + vanilla HTML/CSS. `package.json:1`, `server.js:1–47`. No framework migration is needed for this redesign.
- SQLite owns projects, revisions, managed assets, worker checkpoints and recovery copies; browser state is an editable working view. `lib/projects.js:10–82`, `public/projects.js:5–37`, `public/app.js:853–888`.
- A project ID, source/import ID, moment ID and job ID have different ownership. Discovery checks that the project owns its source, creates deterministic moments as `jobId-sectionIndex`, and saves results directly into that project. Export snapshots saved moments, so later edits do not alter an active render. `lib/discovery.js:32–43`, `lib/exports.js:26–42`.
- Live capture stages managed media before analysis. Completion is addressed to the original project/moment/request token and merges human edits against a baseline. Preserve this even if the producer navigates or changes source while a result arrives. `public/app.js:354–412`, `public/moment-results.js:1–10`, `lib/projects.js:58–69`.
- Workers are independent: one discovery, subtitle and export worker can run concurrently. A restart converts queued/running work to an explicit interrupted state; ambiguous requests must never retry merely because a view opens. `lib/jobs.js:3–37`.

## Canonical UI and event ownership

Baseline `public/index.html` has **206 unique IDs**. `public/app.js` directly references 205 IDs; `acceptArc`, `dismissArc`, `downloadBatchPlan` and `renderBatchDrafts` are intentionally generated later. Preserve existing IDs and one live instance of each control. Do not clone an input to make a second layout.

| Region | Canonical nodes and owner |
| --- | --- |
| Navigation and save | `.workspace-nav button[data-workspace]`, `workspaceTitle`, `workspaceDescription`, `projectTitle`, `saveStatus`, `retryProjectSave`; `public/app.js:17–23,853–888`, `public/projects.js` |
| Import and capture | `linkForm`, `streamUrl`, `openStream`, `autoGenerate`, `fileInput`, `screenButton`, `scanButton`, `disconnectButton`, `markButton`, `cancelImport`, `captureFallback`; direct handlers in `public/app.js:55–101,235–253` |
| Source picture | `program`, `stageCanvas`, `monitor`, crop controls, `sourceQuality`, `liveCaptions`; `public/app.js:39–54,103–253` |
| Discovery | `queue`, `queueCount`, `batchPanel`, `clipTarget`, `batchButton`, `batchProgress`, `batchResults`, `batchDownloads`, `momentMapTrack`, `clipDirection`; rendering replaces children and rebinds generated actions in `public/app.js:258–352,484,890–892` |
| Studio monitor and edits | `previewCanvas`, `clipVideo`, `playPause`, `restartClip`, `loopClip`, `seekBar`, `trimIn`, `trimOut`, `aspectSelect`, framing/hook controls; `public/app.js:486–660` |
| Subtitle work | `captionLines`, `captionsInput`, language/style/dialect controls, `captionOffset`, `captionReviewed`, `showCaptions`, `maskSourceCaptions`; row events are delegated on the persistent `captionLines` node; `public/app.js:660–707` |
| Export and story cut | `exportButton`, `srtButton`, `notesButton`, `saveSourceButton`, `approveBatch`, `addToCut`, `cutList`, `exportSequence`; `public/app.js:715–799` |
| Whole recording | `wholeSubtitles`, `wholeJobSelect`, `wholePreview`, `wholeTrack`, review/download/apply actions; `public/app.js:802–845` |
| Library | `libraryRows`, search/sort/direction/Trash, `recoveryPanel`, `relinkPanel`; delegated row actions in `public/app.js:869–885` |
| Jobs | `jobRows`, `jobCounts`, `jobsStatus`, `refreshJobs`; `public/jobs.js:18–47`, mounted by `public/app.js:908–919` |
| Story Memory | Existing select/rows/actions; `public/story-memory.js`, mounted in `public/app.js:894–895`; confirmed notes alone enter model context |

Important structural dependencies:

1. Startup reparents `linkForm` and `.source-controls` inside `.monitor-panel`, then moves the existing speech/output-language labels into `.language-quick`. Either retain this parent relationship or intentionally replace those lines with the new structure; moving only HTML is insufficient. `public/app.js:20–23`.
2. Durable workspace values are `source`, `clips`, `edit`, `library`, `jobs` in both browser and server serializers. Use visible labels **Add video / Discover / Studio** while retaining those values. New stored values require migration in both serializers and restore paths. `public/projects.js:1`, `public/app.js:17,853–865`, `lib/projects.js:12`.
3. Undo captures inputs inside `.editor` and `.cut-section` using document capture/bubble listeners. Retain these classes around moved inputs; button mutations must use `performEdit` where applicable. Undo itself is session-local. `public/app.js:897–906`, `public/history.js:1`.
4. Preview renders to a canvas from the hidden `clipVideo`. Imported moments seek at `mediaStart + local trim`; captured windows use a local clock. A source-time label must not replace that conversion. `public/app.js:497–501,580–628`.
5. Jobs polling preserves unchanged completed rows so a finished export can play while another job progresses. Avoid rebuilding the entire job panel on each poll. `public/jobs.js:24–33`.

## What the current layout gets in the way of

- Discover hides `.monitor-panel` outright, so there is no visible source video while reviewing discovery. Queue tiles and the separate batch result list repeat the same moments and compete with the Moment Map. `public/style.css:123–130`, `public/app.js:275–284,484`.
- Studio uses a vertically expansive page title, history header, preview, story form, subtitle disclosure and optional story-cut section. The actual picture and transcript compete for the first viewport. `public/index.html:11–12`, `public/style.css:128–138,151–158`.
- The stylesheet accumulates successive design overrides: 192 dense lines with multiple conflicting source, workspace and responsive layouts. Consolidate V2 into one clear layout layer; adding another competing override block makes visibility and sizing harder to verify. `public/style.css:1–192`.
- Source controls are buried by screen size and source presence rules; Discover instructions send live users back to Add video to start scanning. A persistent source/status strip would expose the existing active source and capture state without repeating setup. `public/app.js:484`, `public/style.css:143–149`.
- Moment Map buttons can be only four pixels wide, overlap, and rely heavily on colour. Keep source-time navigation but add a textual status legend and equivalent list access. `public/app.js:891`, `public/style.css:179,183`.

## Practical video-first V2

**Discover (`clips`)**: compact project/source/status strip; a large original-video monitor with source-time transport; an adjacent scrollable results rail using real saved thumbnails; the existing Moment Map directly below the monitor; a compact discovery bar with target/depth/start or job status. Keep one primary representation of each candidate. Put checked-but-rejected windows behind an explicit filter while retaining them and their evidence. The selected result opens Studio through `selectMoment`; do not invent a second analysis/edit store. On mobile, monitor → transport/map → results, with source settings in a disclosure.

**Studio (`edit`)**: compact back/project/history row; preview as the dominant left pane; transcript/subtitle correction as a right pane; trim/seek directly beneath the preview; a compact inspector for framing, hook and evidence. Keep current caption review and uncertainty controls visible beside export. Story cut stays an optional lower section. On mobile retain preview first, then transport/trim, transcript, inspector and export. Editing a local file may pause its playback scan; editing a captured live window must not stop the shared-live recorder (`public/app.js:486–493`).

**Add video, Library and Jobs** stay separate functional workspaces. Brand artwork belongs only on the empty Add video view. It must never cover actual source/clip frames or serve as a fake thumbnail. Provenance for the existing original asset is in `public/assets/ARTWORK.md`; adding new served assets requires the static route allowlist in `server.js:20`.

## P0 invariants and open gates

No new data-loss defect was established by this read-only audit. The following are redesign release blockers if broken:

- Source switching flushes existing edits, finalizes a live window before leaving, aborts stale uploads and ignores stale media readiness callbacks. `public/app.js:54–101`, `public/projects.js:20–31`.
- Immediate refresh retains button edits; stale tabs cannot overwrite newer revisions; recovery creates a separate project; late analysis retains human edits. Existing regression coverage: `tests/editor-actions.test.js`, `tests/projects.test.js`, `tests/session-recovery.test.js`, `tests/moment-results.test.js`.
- Captioned exports remain blocked until every active-language line is reviewed and uncertainty is resolved; wording/timing changes invalidate that review. Preview, SRT and FFmpeg share the same offset/trim basis. `public/app.js:688–725`, `lib/exports.js:6–7`, `tests/timing.test.js`, `tests/exports.test.js`.
- Job start/pause/resume/cancel/reorder remain real server actions. Opening a project or refreshing the view must not initiate paid processing. Missing sources and interrupted requests remain visible and actionable, without fake success. `public/jobs.js:35–45`, `lib/jobs.js`, `public/app.js:857–865,879–885`.
- Controls keep labels, focus visibility, reduced-motion support and a usable 390px layout. Keyboard Space/R/I/O/A/M and Undo/Redo still have their correct edit/input guards. `public/app.js:603–618,906`, `public/style.css:185–192`.

Still unproven before V2 and unaffected by styling: producer-validated complete reality-episode yield; dialect-rich Arabic/overlap/translation quality; sustained live picture/audio/background-tab reliability; six-hour/20 GB and large-library stress; final accepted-participant official-rule checks. `STATUS.md:20–33`. Do not relabel “Meta configured” as a successful live request or portray vendor research as measured engagement improvement.

## Checks

- Fresh baseline `npm run check`: **24 JavaScript files passed**.
- Fresh baseline `npm test`: **55 passed, zero failed/skipped**; includes actual local FFmpeg render and isolated temporary SQLite stores. No paid/provider calls were made.
- Static DOM inventory: **206 IDs, all unique**; only the four intentionally generated IDs above are absent from initial HTML.
- V2 browser acceptance still needed: Add video empty/ready; Discover empty/processing/suggested/rejected/interrupted; Studio playback/trim/caption correction/review/Undo/split/export; Library search/sort/relink/recovery/Trash; Jobs preview playback during polling; desktop and 390px keyboard/focus/overflow. Use synthetic local fixtures and mocked provider responses for this pass, with auto-generation disabled.

This audit did not read `.env`, managed footage/transcript assets, call providers, mutate Git, or change production code.
