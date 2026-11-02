# Goldfish Review Report

**Target:** `/Users/chaimaenfif/code/context-desk/docs/design/server-code-sync.md` (`1-108`)

**Stage:** 8, Intermediate Zoom Out. Context: `zoom_out_report.md`, `comprehension_report.md`, `critic_report.md`.

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-zoom-out` | completed |

**Summary:** The core design (`node --watch` plus a modification-time stamp of the server's imported files, exposed as `codeStale` on `/api/status` and shown as a banner) is still the simplest approach that works, and it matches the code (`server.js:39-41`, `server.js:101`, `package.json:7`, `app.js:212`). The document has not changed in substance since Stages 5 and 7. All 6 Stage-5 findings are still open, none have regressed, and no Comprehension or Critic findings have been applied. The new risk is over-correction: adopting the Critic's recommendations in full would add machinery the problem does not need, and one of them (`--watch-path .env`) would break Goal 1.

Counts: 1 Blocker, 4 Major, 4 Nit.

## Prioritized Findings (Blockers -> Major -> Nits)

### Silent field loss on save is not prevented, and the banner says "Your work is saved" - Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 20-21, 29-30, 61-63, 77-85`
* **Discrepancy Description**: The loss itself still happens:
  * `cleanProjectState` (`lib/projects.js:17`) still drops any clip key that is not on the old `momentKeys` list, and the save still returns success.
  * The banner is only checked at page load (`app.js:1351`). If the server goes stale after the page has loaded, saves lose fields with no warning.
  * The banner tells the user their work is saved while fields are still being lost.

  This was the worst symptom in the incident. Stage 5 rated it Major and Stage 7 rated it a Blocker.
* **Rationale & Recommendation**: Add one guard in the `server.js` router before `projectApi` runs (line 79). When a POST or PUT to `/api/projects/...` arrives and `codeStamp() !== startupStamp`, return 409 with the restart message.
  * It reuses the existing stamp.
  * It covers both "stale at page load" and "went stale later".
  * It keeps `lib/projects.js` unaware of the stamp.
  * It costs roughly 36 `stat` calls per save.

  Remove "Your work is saved" from the banner, or keep it only once the guard exists. Add the guard to "Alternatives considered" and to Risks. Do not adopt the Critic's versioned save schema: the non-goal on line 37 already rules out version compatibility.

### Critic's `.env` watch recommendation would break Goal 1; make `.env` a non-goal instead - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 28, 34-39, 45-48`
* **Discrepancy Description**: In Node, `--watch-path` turns off watching of imported modules, so `npm run dev` would stop restarting when `lib/` changes. The server reads `.env` once at startup (`server.js:33`), and its existing messages already tell the user to restart after editing it (`server.js:109`). The incident never showed a need to watch `.mjs`, JSON or `.env` inputs.
* **Rationale & Recommendation**: Add one Non-goal line: "Changes to `.env` or other non-module startup inputs; the server's existing messages already ask for a restart." Do not add `--watch-path`.

### The doc does not say which run mode the banner is for, or what restarts cost - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 39, 45-52, 61-63, 81-82`
* **Discrepancy Description**: All three earlier stages raised this, and it is still open.
  * Under `npm run dev`, `codeStale` is almost always false, so the banner mainly serves `npm start` users. Yet it tells them to switch to `npm run dev`, where a restart ends a live buffer recording.
  * Line 51 says jobs "resume from the last completed section". The code does not support this: `server.js:89` maps `interrupted` to `paused`, which suggests the user resumes by hand.
* **Rationale & Recommendation**: Fix this with wording, not new mechanisms.
  1. State that `npm run dev` is for editing code and accepts that a restart ends recordings, and that `npm start` is for real working sessions.
  2. Change the banner to "restart the server the way you started it".
  3. Replace the resume claim with what the code actually does, or cite the module that auto-resumes jobs.

  Defer debouncing and watch suspension until a real problem shows up.

### Stale check runs only on page load: use the cheapest re-check, not a boot-ID protocol - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 36-38, 83-84`
* **Discrepancy Description**: For an open tab, the Critic proposed four mechanisms for one gap: a boot ID, a response header carrying it, re-checks on visibility and focus, and a re-check before every save. The reverse case (old tab, new server) is low risk, because the new server's allowlist is normally a superset of the old one. The forward case (stale server under an open tab) is already covered by the save guard in the Blocker finding.
* **Rationale & Recommendation**: Either call the existing `status()` again on `visibilitychange`, or state that the risk is accepted and why. Leave out the boot ID, the header and the per-save pre-check.

### Risks section has no mitigations or acceptances - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 77-85`
* **Discrepancy Description**: The bullets still have no mitigation or acceptance (Stage 7), and line 85 (`statSync` cost) is not a real risk (Stage 5). Three Critic points each deserve a sentence, but none needs code:
  * A syntax error leaves `--watch` running a crashed server.
  * A branch switch causes a burst of restarts.
  * Security: the server listens on 127.0.0.1 (`server.js:199`), and the new field is a single boolean.
* **Rationale & Recommendation**: Give each bullet a short "Accepted because:" or "Mitigation:" clause. Drop line 85. Add the crash, branch-switch and security notes as one line each. Do not grow the section into new features.

### Alternatives section misses "watch only, no banner"; Critic's additions are padding - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 68-75`
* **Discrepancy Description**: The simplest alternative, watch mode with no banner, is still not listed (Stage 5). That is the option that would justify building Goal 2 at all. The Critic's suggested additions (content hashing, nodemon, boot ID, schema versioning) would turn a short section into a catalogue.
* **Rationale & Recommendation**: Add these entries:
  * "Watch only": rejected because it does not cover `npm start`, servers started before this change, or failed restarts.
  * "Server rejects saves while stale": adopted.
  * Optionally, one line each rejecting nodemon (an extra dependency when Node has the feature built in) and content hashing (false positives from modification times are harmless).

  Skip the H3 regrouping.

### Implementation plan goes down to code level - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 91-94`
* **Discrepancy Description**: The plan names exact imports, a position in the file ("After `port`") and an exact expression. The Comprehension stage flagged that "`port`" is never introduced.
* **Rationale & Recommendation**: Describe it at component level: "server.js records a stamp of its imported files at startup and exposes `codeStale` on `/api/status`; the project-save route returns 409 while stale."

### Hard-coded "36 files" count - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 56, 85`
* **Discrepancy Description**: The count will drift as the code changes. Stage 5 and the Critic both flagged it.
* **Rationale & Recommendation**: Remove the count, or anchor it to a date or commit.

### Regex scanner guard test still missing; do not widen the scanner - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 56-58, 65-66, 79-80`
* **Discrepancy Description**: The single test recommended in Stage 5 is still not in the doc. Over-matching, such as imports in comments or `transform('./x.js')`, is harmless. Only missed imports matter.
* **Rationale & Recommendation**: State in one sentence that over-matching is harmless and missed imports are the risk. Add one test that checks the scan finds every relative `.js` import. Do not extend the scanner to `.mjs` or JSON.

## Scope Creep to Avoid (Critic recommendations, not yet in the doc)

* Boot ID, response header and per-save pre-check
* Versioned save schema
* `--watch-path .env`, which breaks Goal 1
* Restart debouncing and watch suspension
* Content hashing

## Smallest Change Set Closing the Blocker and Majors

* A 409 guard on project writes in the `server.js` router, reusing `codeStamp`
* Banner wording
* A statement of which run mode is for whom
* One line correcting the job-resume claim
* A `.env` non-goal
* Acceptance or mitigation lines in Risks
* Optionally, re-running `status()` on `visibilitychange`
