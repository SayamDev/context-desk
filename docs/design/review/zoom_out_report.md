# Goldfish Review Report

**Target:** `/Users/chaimaenfif/code/context-desk/docs/design/server-code-sync.md` (`full file, lines 1-109`; the brief said 1-108, but the file has 109 lines)

**Stage:** 5, Initial Zoom Out Review

**Standard:** `zoom-out-standard` (`/Users/chaimaenfif/.claude/plugins/cache/egm/egm/0.1.0/resources/document_standards/zoom-out-standard.md`)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-zoom-out` | completed |

**Summary:** The document passes the context-sufficiency check. The reviewer found that the objective is clear, and that the design is small, fits the codebase and uses a platform feature (`node --watch`). It checked the doc's claims against `server.js` (lines 39-41 and 101), `package.json`, `public/app.js` (`showServerStale`) and `lib/projects.js`, and they matched. There are 0 Blockers, 2 Major findings and 4 Nits.

## Prioritized Findings (Blockers -> Major -> Nits)

### Silent data loss is detected but not prevented - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 20-21` (Problem), `Lines 54-66` (Design: Stale-code detection), `Lines 83-84` (Risks)
* **Discrepancy Description**: The worst symptom in the Problem section is that saves appear to succeed while a stale server silently drops `cuts`, `hookVariants`, `captionAccents` and `splitCam`. The cause is the `momentKeys` allowlist in `lib/projects.js` (line 8), which removes unknown keys without any error. The design only adds a warning banner, and that banner is checked once, at page load. While the banner is showing, saves are still accepted and still lose those fields. If the server goes stale while a tab is already open (lines 83-84), edits are lost with no warning at all.
* **Rationale & Recommendation**: Goal 2 says the server should stop "half-working", but the save path that half-works is unchanged. Pick one of these options and state it in the doc:
  * (a) Return `codeStale` (or the startup stamp) in the project-save response, so the app can warn or block at the moment a save happens. This reuses the existing status mechanism.
  * (b) Have the app refuse to save, or warn, while `codeStale` is true.
  * (c) Mark silent field-stripping as out of scope and explain why that is acceptable.

  Also add the save-response option to "Alternatives considered".

### Auto-restart can end a live recording, and the doc does not say who should run which command - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 50-52` (Automatic restart in development), `Lines 81-82` (Risks), `Line 39` (Non-goals)
* **Discrepancy Description**: The incident behind this doc was a ten-hour working session on a real project in Studio. Under `npm run dev`, every save of a server file, including bursts of edits made by an agent, restarts the server and ends any active live buffer recording. The banner also tells users to "run npm run dev", which pushes people doing real work into the mode that kills recordings. The doc lists this as a risk but gives no mitigation. Line 51 says the recording will "pause" without saying what resumes and what is lost.
* **Rationale & Recommendation**: The design replaces one silent failure (lost fields) with another (lost recordings). State which command is for which audience: `npm run dev` for people editing the code, `npm start` for people using the tool. Change the banner to say "restart the server" or to name the command the user is already running. If losing a recording on restart is accepted in dev mode, say so explicitly. Reword "pause" on line 51 so it says exactly what is lost.

### Hand-written regex import scanner needs a guard test - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 56-57`, `Lines 65-66`, `Lines 79-80`; `server.js` line 39
* **Discrepancy Description**: The design builds its own crawler of the import graph using a regular expression, even though Node already tracks the same graph for `--watch`. The doc admits that the scan can miss imports written in other forms. The reviewer found no existing scanner in `scripts/` that could be reused instead.
* **Rationale & Recommendation**: A regex crawler is reasonable for a single-user local tool. However, when it fails, it fails by missing a file, so the banner does not appear, which is the very failure this design is meant to prevent. Keep the approach, but add one test that checks the scan finds every relative `.js` import under `server.js` and `lib/`. Do not switch to loader hooks: `module.registerHooks` is not guaranteed under the `>=22.13` engine range.

### Implementation plan goes down to code-level detail - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 91-94` (Detailed Implementation Plan)
* **Discrepancy Description**: The plan names specific imports (`readFileSync`, `statSync`), a position in the file ("After `port`") and an exact expression (`codeStamp()!==startupStamp`).
* **Rationale & Recommendation**: This adds no design information and will go out of date after any refactor. Describe it at component level instead, for example: "server.js computes a stamp of its imported files at startup and exposes `codeStale` on /api/status."

### Hard-coded file count, and a non-risk listed under Risks - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Line 56` ("36 files today"), `Line 85`
* **Discrepancy Description**: The file count will drift as the code changes. Running `statSync` on about 36 files once per page load is not a real risk.
* **Rationale & Recommendation**: This bullet makes the Risks section noisier and pulls attention from the real risks (the two Major findings). Remove the count, and remove or shorten the line 85 bullet.

### Simplest alternative missing from "Alternatives considered" - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 68-75` (Alternatives considered)
* **Discrepancy Description**: The section does not consider the most minimal option: watch mode alone, with no stale-code banner. It also does not explain why stale-code detection is still needed once `npm run dev` restarts automatically.
* **Rationale & Recommendation**: Add one bullet naming the cases watch mode does not cover, such as people running `npm start`, servers started before this change, and restarts that fail. That shows why Goal 2 is still worth building alongside Goal 1.
