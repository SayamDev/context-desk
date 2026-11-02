# Goldfish Review Report

**Target:** `/Users/chaimaenfif/code/context-desk/docs/design/server-code-sync.md` (`FeatureRange, lines 1-86`; lines 87-108 not reviewed)

**Stage:** 7 — Critic Review (antagonistic). Standard for `egm-design` and `egm-structural`: `feature-spec-standard`. `egm-style` had no standard.

**Grounding context:** `server.js`, `package.json`, `public/app.js`. `lib/` was outside the allowed context, so claims that depend on it are marked unverified.

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-design` | completed |
| `egm-structural` | completed |
| `egm-style` | completed |

**Severity breakdown (after deduplication):** 1 Blocker, 9 Major, 10 Nit.

**Confirmed against code (all three reviewers):**
- The `dev` script (package.json:7) and `start` running `node server.js`.
- `Cache-Control: no-store` on static files (server.js:196).
- `serverFiles`, `codeStamp` and `startupStamp` (server.js:39-41).
- `codeStale` in `/api/status` (server.js:101).
- The banner text and `role="alert"` (app.js:212).
- `status()` runs once on page load (app.js:213, 1351).

## Prioritized Findings (Blockers -> Major -> Nits)

### The stale banner promises "Your work is saved" while saves still lose data - Severity: Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** `Lines 20-21, 29-30, 61-63`
* **Discrepancy Description**: The worst symptom in the Problem section is silent field loss on save: the old server dropped `cuts`, `hookVariants`, `captionAccents` and `splitCam`. The design does not prevent this. It only adds a banner. `/api/status` returns a boolean, and nothing blocks or flags saves while the server is stale. While the banner is showing, saves still go to the old server and still drop fields, and the banner tells the user "Your work is saved". Goal 2 ("instead of half-working") is not met.
* **Rationale & Recommendation**: Choose one:
  * Block writes while the server is stale. The client can disable or queue saves when `codeStale` is true, or the server can reject writes with 409 when `codeStamp() !== startupStamp`.
  * Remove "Your work is saved" from the banner.

  In either case, add silent field loss to Risks, with its mitigation.

### No reload prompt when watch mode restarts the server under an open tab - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** `Lines 36-38, 45-48, 83-84`
* **Discrepancy Description**: Watch mode creates the reverse mismatch. A tab that is already open keeps the old browser code while `--watch` replaces the server underneath it. The new server's stamp matches the disk, so `codeStale` is false. The tab also never calls `/api/status` again (app.js:1351 runs only on load). Saves from the old tab to the new server can silently drop fields. The non-goal that browser and API "always ship together" is contradicted by the design itself. Lines 83-84 also give no mitigation for detection running only on load.
* **Rationale & Recommendation**: Have the server expose a per-process boot ID in `/api/status`, and as a response header if possible. The client compares it with the value it saw on load and asks the user to reload when it changes. Check again on `visibilitychange`/focus and before saves. Revise the non-goal and Risks to match.

### Restart effects are not proven, softened, and incomplete - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style`, `egm-structural`
* **Affected Scope:** `Lines 50-52`
* **Discrepancy Description**:
  * Nothing in the allowed context supports the claim that jobs "save checkpoints to SQLite and resume from the last completed section". The code suggests the opposite: server.js:89 counts `interrupted` jobs as `paused`, which implies the user resumes them by hand.
  * "Pause" is a euphemism: the process is killed.
  * "Section" is not defined.
  * The scope of "these jobs" is unclear. Does the live buffer resume?
  * Several affected services are not listed:
    * Creative and bundle jobs (server.js:62-63, 89).
    * Live ingest shutdown (server.js:198).
    * Paid live analysis that is reserved before the request and never auto-replayed (server.js:70-71).
    * In-flight saves and Meta calls, which the 2-second hard `process.exit` cuts off (server.js:198).
* **Rationale & Recommendation**: State whether resume is automatic or manual, and cite the module that implements it. List every service a restart affects. Say what happens to an in-flight save or paid request. The "Your work is saved" claim depends on this.

### Risks have no mitigations and miss failure modes - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-design`
* **Affected Scope:** `Lines 77-85`
* **Discrepancy Description**: The standard requires each failure mode to come with "how they will be mitigated". None of the four bullets gives a mitigation or an explicit acceptance:
  * Missed dynamic import.
  * Repeated restarts ending a live recording.
  * Detection only on load.
  * `statSync` cost.

  Two failure modes are missing:
  * A syntax error on save leaves `--watch` holding a crashed server. `/api/status` then fails and the app shows a connection error with no guidance.
  * A branch switch or rebase causes a burst of restarts.
* **Rationale & Recommendation**: Give every bullet a "Mitigation:" or "Accepted because:" clause. Possible mitigations:
  * Debounce restarts, or allow watch to be suspended while recording live.
  * A test that checks the scan list against the modules actually loaded.
  * Re-checking on visibility change.

  Add the crash and burst-restart cases. Rename the section "Risks and mitigations".

### No security statement - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-design`
* **Affected Scope:** `Lines 77-85`
* **Discrepancy Description**: The standard requires security implications to be stated explicitly. The doc says nothing about two points:
  * The new `codeStale` field on an unauthenticated `/api/status`.
  * The scan resolving relative paths. `path.resolve` on `../` paths is not confined to the repo root.
* **Rationale & Recommendation**: Add a one-line security bullet, for example: localhost-bound (127.0.0.1), single user, the field exposes only a boolean, and the scan's path reach is either stated or bounded.

### Alternatives are weak and not organized by component - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** `Lines 68-75`
* **Discrepancy Description**: The three alternatives listed are variants of the chosen design or straw men. Lines 70-73 cover detection and lines 74-75 cover restart, with no grouping. Credible options that are missing:
  * Boot ID with client re-checks.
  * A versioned save schema that the server rejects on mismatch, which fixes the Blocker at its root.
  * Content hashing instead of mtime.
  * Watching `.env`.
  * nodemon or an external supervisor instead of `node --watch`.
* **Rationale & Recommendation**: Group the alternatives under H3s "For automatic restart" and "For stale-code detection". Add the missing options with rejection reasons, or adopt the ones that close the Blocker and the open-tab finding.

### `.env` and other non-`.js` startup inputs are not detected - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** `Lines 28, 45-48, 65`
* **Discrepancy Description**: The server reads `.env` once at startup (server.js:33), and its own error messages tell users to restart after editing it (server.js:109, 149). `.env` is outside the import graph, so neither `--watch` nor the stamp sees changes to it. The regex requires `.js`, so `.mjs` files, JSON imports and files that `lib/` reads at startup are also invisible.
* **Rationale & Recommendation**: Either declare this an explicit non-goal, or add `.env` and other startup inputs to the watch (`--watch-path`) and to the stamp.

### Banner tells every user to "run npm run dev" - Severity: Major
* **Reviewer Lens:** `egm-style`, `egm-structural`, `egm-design`
* **Affected Scope:** `Lines 39, 61-63`
* **Discrepancy Description**: Under `npm run dev` the server restarts itself, so `codeStale` is rarely true there. The banner will appear mostly for `npm start` or `node server.js` users, and it tells them to change how they run the server. The doc never says which run modes can produce the banner, so Goal 2 ("explains how to fix it") is only partly met.
* **Rationale & Recommendation**: State which run modes the banner is for. Make the instruction neutral ("restart the server the way you started it") or specific to the start command used, or record it as an intended trade-off.

### The doc defines "browser files" inconsistently and understates what `server.js` imports - Severity: Major
* **Reviewer Lens:** `egm-style`, `egm-structural`, `egm-design`
* **Affected Scope:** `Lines 9-11, 31-32, 47-48, 73`
* **Discrepancy Description**:
  * Line 10 says the server loads "the `public/*.js` modules that `lib/` imports". `server.js` also imports `public/caption-accents.js`, `timing.js`, `languages.js` and `locales.js` directly (server.js:1, 8, 24, 25).
  * Goal 3 says changes to "browser files" never trigger the warning, but shared `public/` modules such as `public/silence.js` are browser files that do trigger it by design (lines 46-48).
* **Rationale & Recommendation**: Change line 10 to "modules that `server.js` or `lib/` import". Define "browser-only files" once as "files under `public/` outside the server's import graph", and use that term in Goal 3 and on lines 48 and 73.

### "Every JavaScript file it loaded" overclaims - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Line 56`
* **Discrepancy Description**: The scan lists the files that the regex reaches from `server.js` (server.js:39), not every file the process loaded. Lines 65-66 and 79-80 admit that some imports are missed.
* **Rationale & Recommendation**: Rewrite as "follows relative `.js` import paths from `server.js` and lists each file it reaches".

### Section names differ from the standard, and "open questions" has none - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** `Lines 5, 26, 34, 41, 77`
* **Discrepancy Description**: The doc uses Problem / Goals / Non-goals / Design / Risks and open questions. The standard uses Problem Statement / Goals & Non-Goals / Proposed Architecture / Risks & Mitigations. Every bullet under the "Risks and open questions" heading is a risk.
* **Rationale & Recommendation**: Align the headings with the standard. Either add the real open questions (the open-tab re-check, the banner advice for `npm start`) or drop "open questions" from the heading.

### Paragraph out of order in Stale-code detection - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** `Lines 65-66`
* **Discrepancy Description**: The note about the regex describes the startup scan (lines 56-58), but it appears after the request and banner flow.
* **Rationale & Recommendation**: Move it to directly after line 58.

### Regex match set described incompletely - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-style`, `egm-design`
* **Affected Scope:** `Lines 65-66, 79-80`
* **Discrepancy Description**: The regex at server.js:39 does more than the doc says:
  * It also matches bare side-effect imports (`import './x.js'`).
  * It has no word boundary, so text like `transform('./x.js')` matches.
  * It matches inside comments and strings.
  * It skips `.mjs` and extensionless paths.

  Over-inclusion is harmless. Only under-inclusion is a real gap.
* **Rationale & Recommendation**: List the exact match set. State that over-matching is harmless and that under-matching is the risk.

### Counts and "today" statements will drift and cannot be verified - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-style`, `egm-design`
* **Affected Scope:** `Lines 57, 80, 85`
* **Discrepancy Description**: "36 files today" appears twice. "Today the server has no such imports" is also time-relative. Neither can be checked without `lib/`.
* **Rationale & Recommendation**: State the count once, anchored to a commit or date, and say how it was obtained. Refer back to it from Risks.

### Stamp description is imprecise; mtime gives benign false positives - Severity: Nit
* **Reviewer Lens:** `egm-style`, `egm-design`
* **Affected Scope:** `Lines 57-58, 60`
* **Discrepancy Description**: The stamp is a single `|`-joined string of `path:mtimeMs` pairs. A file that cannot be stat'd contributes only its path (server.js:40). Comparing mtimes flags staleness after a checkout round-trip even when content is identical.
* **Rationale & Recommendation**: Describe the stamp precisely. Note the false-positive case in Risks or next to a content-hash alternative. Change "computes the same stamp again" to "recomputes the stamp".

### Line 85 has an ambiguous referent and no assessment - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Line 85`
* **Discrepancy Description**: "The app calls it" could refer to `statSync` or to `/api/status`. The line also never says whether the cost is acceptable.
* **Rationale & Recommendation**: Rewrite as "The app requests `/api/status` once per page load, so each load costs N `statSync` calls", then state that this is acceptable.

### Live-recording consequence stated twice - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Lines 50, 81-82`
* **Discrepancy Description**: Line 50 and lines 81-82 both say that a restart ends a live buffer recording.
* **Rationale & Recommendation**: State it once and cross-reference it.

### Problem section omits routes and is vague about the field loss - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Lines 7-8, 20-21`
* **Discrepancy Description**:
  * "Runs the API from `lib/`" leaves out the routes defined in `server.js`, such as `/api/status` and `/api/frame` (server.js:101, 103).
  * "List of clip fields removed ..." and "lost without any error" do not name the mechanism.
* **Rationale & Recommendation**: Change lines 7-8 to "from `server.js` and `lib/`". Rewrite lines 20-21 as "the old server's clip-field allowlist dropped ...; the save returned success, so the edits were silently discarded".

### Informal or filler wording - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Lines 1, 13, 23-24, 28, 30, 39, 72`
* **Discrepancy Description**:
  * Line 1, title: "in step with" is idiomatic.
  * Line 13: "new browser code talking to an old server" personifies the code.
  * Lines 23-24: the quote "refreshing breaks it" is unattributed.
  * Line 28: "During development" is not tied to a mechanism.
  * Line 30: "half-working" is informal and not measurable.
  * Line 39: "plain" is filler.
  * Line 72: "This was the first version." is informal.
* **Rationale & Recommendation**: Use precise wording:
  * Title: "Detecting and restarting a stale local server".
  * Line 13: "the browser loads new `public/` files while the server runs the code it loaded at startup".
  * Lines 23-24: attribute the quote or delete it.
  * Line 28: "When started with `npm run dev`".
  * Line 30: "instead of failing requests silently".
  * Line 39: drop "plain".
  * Line 72: rephrase as a description of the earlier implementation.
