# Consolidated Goldfish Review: server-code-sync

**Target:** `docs/design/server-code-sync.md` (first version). FeatureRange lines 1-86, DetailedRange lines 87-108.
**Mode:** Consolidated report, all five stages, run without stopping. Each reviewer started in a fresh context.
**Plugin:** Elephant-Goldfish Model `egm@egm` 0.1.0 (commit `403d888`). Claude Code 2.1.316.

## Stage results

| Stage | Reviewers | Report | Blocker | Major | Nit |
| --- | --- | --- | --- | --- | --- |
| 5 Initial zoom out | zoom-out | `zoom_out_report.md` | 0 | 2 | 4 |
| 6 Comprehension | comprehension | `comprehension_report.md` | 0 | 3 | 5 |
| 7 Critic | design, structural, style | `critic_report.md` | 1 | 9 | 10 |
| 8 Intermediate zoom out | zoom-out | `intermediate_zoom_out_report.md` | 1 | 4 | 4 |
| 9 Implementation readiness | implementation-readiness, codebase-details, style | `implementation_readiness_report.md` | 0 | 8 | 12 |

All reviewers completed. None failed or were retried.

## Consolidated actions (deduplicated)

### 🔴 Blocker

**B1. A stale server still dropped clip fields while the banner said "Your work is saved".**
Raised by Stage 7 (design) and Stage 8 (zoom-out); also Stage 5 Major and Stage 9 #19.
**Resolved in code.** Saves now get a 409 `server-outdated` when the code is stale or a save carries unknown clip fields. The app stores a recovery copy, and recovery copies keep unknown fields. The banner now says saving is paused and edits are in a recovery copy. Test: `tests/code-stamp.test.js`. Checked in the browser.

### 🟡 Major

| ID | Action | Raised by | Outcome |
| --- | --- | --- | --- |
| M1 | Say which run mode each mechanism covers and who sees the banner | 5, 6, 7, 8 | Added the "Which mechanism covers which case" table |
| M2 | State restart costs precisely: live buffer clips, and what "section" means | 5, 6, 7, 8 | Documented. A restart deletes undownloaded live-buffer clips (checked in `lib/live-buffer.js` `stop()`). Accepted for `npm run dev` only |
| M3 | The check only ran on page load | 7, 8 | **Code:** the app re-checks on window focus and on a refused save |
| M4 | A missing `codeStale` field was treated as "fresh" | 9 | **Code:** a missing field now counts as out of date |
| M5 | Describe the import scan exactly and guard it with a test | 5, 6, 7, 8, 9 | **Code:** moved to `lib/code-stamp.js`, which also matches bare `import './x.js'`. A guard test fails when a `lib/` module is unreachable. It found `lib/evaluation.js`, which is script-only and now listed as an exception |
| M6 | Risks had no mitigations | 7, 8 | Risks are now a table with a mitigation or acceptance for each |
| M7 | `.env` and other non-`.js` inputs | 7, 8 | Made a non-goal. Stage 8 noted that watching `.env` would restart on secret edits, against Goal 1 |
| M8 | No security statement | 7 | Added: the endpoint returns only true/false and the server listens on localhost only |
| M9 | The banner told everyone to run `npm run dev` | 6, 7 | The text now says "npm run dev (or npm start)" |
| M10 | Banner contrast failed in the Daylight theme | 9 | **Code:** fixed colours `#140904` on `#ffb020` |
| M11 | No automated test plan | 9 | Added `tests/code-stamp.test.js` (3 tests) |
| M12 | Plan files not tagged Create/Modify; previous `dev` value missing | 9 | The plan is now a file table with Create/Modify and the old `dev` value |
| M13 | Inconsistent terms for server modules and browser-only files; "every file it loaded" overclaims | 6, 7 | Both terms are defined once in the Problem section; the overclaim is removed |
| M14 | Verification not tied to goals; skipped tests unexplained | 6, 9 | Each check now names what it covers. The skips are the opt-in real-FFmpeg RTMP tests |

### 🟢 Nits

Undefined project terms (live buffer, filmstrip, clip fields), the plan anchored on `port`, hard-coded file counts, section names, out-of-order paragraphs, filler wording, heading case, and two names for one element. **Resolved by the rewrite.** "Plan is too code-level" (5, 8): partly accepted. The plan now lists files and responsibilities rather than expressions.

### Contested

- **Stage 7: "show a reload prompt when watch mode restarts the server under an open tab."** Not done. A restart under `npm run dev` leaves the API working and the browser code unchanged, so the open tab keeps working. Only an in-progress live buffer recording ends, and that is documented.
- **Stage 8: "Critic's alternatives are padding."** Partly accepted. Alternatives are cut to four, with "watch only, no detection" added first, as Stage 8 suggested.

## Traceability

| Raw finding | Action |
| --- | --- |
| zoom_out: silent data loss detected not prevented | B1 |
| zoom_out: live recording / who runs which command | M1, M2 |
| zoom_out: regex guard test | M5 |
| zoom_out: code-level plan, hard-coded count, missing simplest alternative | Nits, M12 |
| comprehension 1 / 2 / 3 | M1 / M2 / M5 |
| comprehension 4-8 | Nits, M13, M14 |
| critic Blocker | B1 |
| critic: reload prompt | Contested |
| critic: restart effects / risks / security / alternatives | M2 / M6 / M8 / Contested |
| critic: `.env` | M7 |
| critic: banner text / terms / overclaim | M9 / M13 |
| critic nits (9) | Nits |
| intermediate: Blocker | B1 |
| intermediate: `.env` non-goal / run mode / page-load only / risks | M7 / M1 / M3 / M6 |
| intermediate nits | Nits, M5 |
| readiness 1-2 (scan algorithm, stamp format) | M5 |
| readiness 3-4 (banner behaviour, missing field) | M3, M4 |
| readiness 5 (contrast) / 6 (tests) / 7 (verification) / 8 (file tags) | M10 / M11 / M14 / M12 |
| readiness 9-18, 20 | Nits |
| readiness 19 (root cause of field loss) | B1 |
