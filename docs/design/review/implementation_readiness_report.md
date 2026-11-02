# Goldfish Review Report

**Target:** `/Users/chaimaenfif/code/context-desk/docs/design/server-code-sync.md` (`DetailedRange, lines 87-108, "Detailed Implementation Plan"`; lines 1-86 context only)

**Stage:** 9 — Implementation Readiness Test
**Standard:** `implementation-readiness-standard` (applied by `egm-implementation-readiness` and `egm-codebase-details`)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-implementation-readiness` | completed |
| `egm-codebase-details` | completed |
| `egm-style` | completed |

**Severity breakdown:** 0 Blocker, 8 Major, 12 Nit

**Overall verdict:** Not ready under the zero-decision rule. Every concrete reference in lines 87-108 matches the uncommitted code. The checked references are:

- `package.json:7` dev script
- `server.js:28` fs import, `:34` `port`, `:39-41` `serverFiles`/`codeStamp`/`startupStamp`, `:101` `codeStale`
- `public/app.js:212-213` `showServerStale` inside `status()`
- `public/ds.css:559` `.server-stale`
- `public/silence.js` reachable via `lib/exports.js:4`

The plan is accurate but reads as a summary of finished work. An engineer working only from this section would still have to decide the scan algorithm, the stamp format and failure handling, the banner DOM, the CSS values and the tests. One real defect was found: the banner fails contrast in the daylight theme.

Triage notes:
- `egm-style` said a deleted file makes `statSync` throw inside `/api/status`. That is wrong for the implemented code: `server.js:40` catches the error and returns the bare path, so the stamp changes and the server reports stale. The doc still does not state this behaviour, so the point is folded into Finding 2.
- I checked the daylight contrast figure independently: `#140904` on `#8a5800` is about 3.25:1.
- The test count on line 108 (237 total, 235 pass, 2 skipped) could not be checked, because reviewers are read-only.

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Import-scan algorithm is unspecified and contradicts Design - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** `Lines 92` (and context lines 56, 65-66)
* **Discrepancy Description**: The plan only says "follow relative `.js` imports from `server.js`". It does not say any of the following:
  - The walk is recursive, starts from and includes `path.join(root,'server.js')`, and runs synchronously at module load.
  - A `Set` removes duplicates and stops import cycles.
  - Each specifier is resolved with `path.resolve(path.dirname(file), spec)`.
  - Unreadable files are skipped silently (`try{...}catch{return}`).
  - The match uses the regex at `server.js:39`, `/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+\.js)['"]/g`.

  Because the `\(?` in that regex is optional, it also matches side-effect imports (`import './x.js'`). Design line 65 says only `from '...'` and `import('...')` are matched, so the doc and the code disagree. Two engineers following the doc would produce different file sets.
* **Rationale & Recommendation**: Write the algorithm into step 2: start file, recursion, visited `Set`, resolution rule, regex, and skip-on-read-failure. Update line 65 to include side-effect imports.

### 2. `codeStamp()` format, timing and failure modes not stated - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** `Line 93`
* **Discrepancy Description**: "Joins each file's path and `mtimeMs`" leaves out three things:
  - **Format.** Entries are `path:mtimeMs`, joined with `|`, in scan order.
  - **Missing files.** A failed `statSync` returns the bare path (`server.js:40`), so a deleted or renamed file changes the stamp and reports stale instead of throwing. If it threw, `/api/status` would fail and the UI would show "Server offline", so this is a real design decision.
  - **Timing.** `startupStamp` is taken at module load, and `serverFiles` is fixed at startup and not re-scanned. A newly added import is detected only because the importing file's mtime changes; the new file itself is not stamped until the next restart.
* **Rationale & Recommendation**: State the format, the rule that a failed stat must not throw and must change the stamp, and the fact that the file list is fixed at startup.

### 3. Banner behaviour in `public/app.js` is under-specified - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** `Lines 95-96`
* **Discrepancy Description**: The doc never introduces `status()`. It is the existing function in `public/app.js` that fetches `/api/status`, and it runs once per page load (`public/app.js:1351`). The plan also leaves out these details of the implemented code (`public/app.js:212`):
  - It uses the `$` helper (`app.js:33`).
  - It sets `id="serverStale"`, `class="server-stale"` and `role="alert"`. The class is what links step 3 to step 4.
  - The text is a `<strong>` "Context Desk was updated. " followed by a text node. The full text is only in Design lines 62-63.
  - The banner is inserted with `document.body.prepend`.
  - If a banner already exists, the function returns early. That is how only one banner is guaranteed.
  - When the fetch fails, the `catch` path leaves the banner alone.

  "Removes it when the server is up to date" introduces a new term; the doc's existing term is "`codeStale` false". It also implies `status()` can run again on the same page, which conflicts with "once per page load" (lines 83-85). "It" is ambiguous between `status()` and `showServerStale`.
* **Rationale & Recommendation**: Name `status()` and say when it runs. Specify the id, class, role, DOM structure, insertion point and early return. Point to the text at lines 62-63. State the failure-path behaviour. Either reconcile the removal path with the once-per-load check or explain when removal happens.

### 4. Missing `codeStale` field is silently treated as "not stale" - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (Major), `egm-implementation-readiness` (Nit)
* **Affected Scope:** `Line 95`
* **Discrepancy Description**: `showServerStale(Boolean(d.codeStale))` (`app.js:213`) turns `undefined` into `false`. A server started before this change sends no `codeStale` field, so it shows no banner. That includes the exact server from the 2 November incident (lines 13-24). The plan does not mention the coercion or this rollout gap.
* **Rationale & Recommendation**: State that a missing field means "not stale" on purpose, record it as an accepted limitation, and add a one-time manual restart to the rollout notes.

### 5. CSS step gives no values; implemented style fails contrast in the daylight theme - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** `Line 97`
* **Discrepancy Description**: "A sticky `.server-stale` banner style" leaves z-index, colours, spacing and type size to the implementer. The implementation (`public/ds.css:559`) is `position:sticky;top:0;z-index:100;padding:10px 16px;background:var(--warning);color:#140904;font-size:14px;line-height:1.4`. That colour pair fails contrast in one theme:
  - Default theme: `--warning` is `#ffb020` (`public/style.css:8`), which reads well.
  - Daylight theme: `--warning` is `#8a5800` (`public/ds.css:373`). `#140904` on that background is about 3.25:1, below the WCAG AA 4.5:1 minimum for 14px text.

  The plan also does not say how `z-index:100` fits with the app's other sticky or fixed layers. The item has no verb, unlike items 1-3.
* **Rationale & Recommendation**: Give the full rule in the plan, with a colour pair that works in both themes (for example a per-theme warning-ink variable, or a light background in daylight). Explain the z-index choice, and say where in `ds.css` the rule goes.

### 6. No automated test plan - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** `Lines 99-108`
* **Discrepancy Description**: The standard asks for named happy-path and edge-case tests. The section only records manual checks. Nothing in `tests/` mentions `codeStale`, `serverStale`, `showServerStale` or `api/status`. Line 108 gives a test count but does not say whether any of those tests cover this change. No test is specified for:
  - a nested import (server.js -> lib -> public) being scanned;
  - an import cycle ending;
  - `serverFiles` containing `public/silence.js` but not `public/app.js`;
  - an edited or deleted server file making the server stale;
  - a browser-only file not making it stale;
  - the banner being inserted once and removed when the field is false.
* **Rationale & Recommendation**: Add these as named test cases with expected results, for example a scan and stamp unit test on a temporary module tree, and an `/api/status` test before and after touching an imported file. Otherwise state explicitly that the change is manual-test only, and why.

### 7. Verification claims are vague and only partly tied to the Problem - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Lines 103-107`
* **Discrepancy Description**:
  - "Studio" is not defined anywhere in lines 1-86.
  - "A copy of the real project" does not say which project.
  - "Restored ... 'All changes saved'" pairs a verb with a UI status label; the label was shown, not restored.
  - "An edit made after a refresh was saved" does not say whether the fields lost in the incident were checked (`cuts`, `hookVariants`, `captionAccents`, `splitCam`; lines 20-21).
  - The banner check (line 105) does not say how staleness was produced, whether the full text was checked, or whether the banner went away after a restart.
  - Only the positive `--watch` case (`public/silence.js`) is verified. The negative case, that editing `public/app.js` under `--watch` causes no restart (Design lines 47-48), is not.
* **Rationale & Recommendation**: Define Studio, name the project or fixture, list the fields checked after the refresh, describe the banner appear/disappear sequence, and add the negative `--watch` case or say it was not checked.

### 8. Files not tagged Create/Modify/Delete; previous `dev` value not given - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** `Lines 89-97`
* **Discrepancy Description**: The standard's Target Scope rule asks for an explicit action per file. All four files are modifications, but none is tagged. Step 1 does not give the previous `dev` script value.
* **Rationale & Recommendation**: Tag each item "Modify" and quote the previous `dev` value.

### 9. Tense and title do not match the status - Severity: Nit
* **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
* **Affected Scope:** `Lines 87-97` (vs line 3, line 99)
* **Discrepancy Description**: Line 3 says the work is "implemented" and line 99 says "Verification done", but the section is titled "Plan" and uses instructions ("change", "add").
* **Rationale & Recommendation**: Either retitle the section "Implementation" and use past tense, or add a note that the plan is kept as written for review traceability.

### 10. Heading case inconsistent - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Line 87`
* **Discrepancy Description**: "Detailed Implementation Plan" is Title Case. Every other heading uses sentence case. "Detailed" adds nothing.
* **Rationale & Recommendation**: Use "Implementation plan".

### 11. "After `port`" is a code position, not the real dependency - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`
* **Affected Scope:** `Line 92`
* **Discrepancy Description**: The code depends on `root` (`server.js:32`), not on `port` (`server.js:34`). The wording breaks if lines are moved.
* **Rationale & Recommendation**: Say "after `root` is defined, at module load, before the server starts listening".

### 12. Import list omits the reused `path` module - Severity: Nit
* **Reviewer Lens:** `egm-style`, `egm-codebase-details`
* **Affected Scope:** `Line 91`
* **Discrepancy Description**: Resolving specifiers needs `path`. The code reuses the existing import at `server.js:29`, but the step only lists `statSync`.
* **Rationale & Recommendation**: Note that `path` and `root` are already available and are reused.

### 13. Inline expression hard to read - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Line 94`
* **Discrepancy Description**: `codeStamp()!==startupStamp` has no spacing in prose.
* **Rationale & Recommendation**: Write "set `codeStale` to `codeStamp() !== startupStamp`".

### 14. Two names for one element - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Lines 96-97`
* **Discrepancy Description**: `#serverStale` and `.server-stale` both appear, and the text never says they are the same element.
* **Rationale & Recommendation**: Write "the banner element has id `serverStale` and class `server-stale`".

### 15. Wording and formatting in the verification steps - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** `Lines 101-103`
* **Discrepancy Description**: "Touching" is shell jargon. Line 102 has a bare "`true`" where line 101 uses "`codeStale: false`".
* **Rationale & Recommendation**: Gloss "touch" on first use ("updated the modification time of"), and write "`codeStale: true`".

### 16. Existing static alert pattern not reused or discussed - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** `Lines 95-97`
* **Discrepancy Description**: `public/index.html:11` already has a static `role="alert" hidden` element that is shown and hidden by toggling `hidden`. The plan builds the banner in JavaScript instead and does not say why.
* **Rationale & Recommendation**: Give one line of justification, or switch to a static `#serverStale` element in `index.html` toggled with `hidden`.

### 17. README impact not addressed - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** `Line 89`
* **Discrepancy Description**: `README.md:23` already documents `npm run dev`. The plan does not say whether the README needs to mention the new watch behaviour, for example that a restart ends a live buffer recording.
* **Rationale & Recommendation**: Add "README.md: no change", or add a short note to the README.

### 18. No phasing or dependency note - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** `Lines 87-97`
* **Discrepancy Description**: The plan is one undivided step. That is acceptable at this size, but the ordering dependency is not stated.
* **Rationale & Recommendation**: Note that steps 1-2 can ship on their own and keep the build and tests green, and that steps 3-4 depend on the field added in step 2.

### 19. Root cause of the field loss remains (follow-up, outside range) - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Context (Problem, lines 20-21); suggested addition to follow-ups
* **Discrepancy Description**: `lib/projects.js:8` `momentKeys` and `public/projects.js:3` `savedMomentKeys` are two hand-maintained copies of the same list. Importing the public list from `lib/projects.js`, which already imports from `../public/` (`lib/projects.js:2`), would put it in the server import graph. Edits to the list would then trigger both `--watch` and `codeStale`.
* **Rationale & Recommendation**: Optionally record this as a follow-up. It is out of scope for this plan.

### 20. Test count on line 108 not independently verified - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** `Line 108`
* **Discrepancy Description**: Reviewers are read-only and could not run `npm test` to confirm 237 total, 235 pass, 2 skipped.
* **Rationale & Recommendation**: Bind the count to a commit or snapshot, or re-run it before committing.
