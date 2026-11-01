# V2 implementation evidence — 1 November 2026

## Scope and outcome

This pass applies the supplied V2 briefs to the working app: compact branded shell, video-first Discover, timestamped Moment Map with independent overlap lanes, retained-evidence search/status filtering, source playback, Studio viewer/trim/caption hierarchy, Settings, Library grid/list and responsive Jobs. Existing SQLite, caches, managed media, export engine and canonical controls are preserved. This is a local build and draft-PR update; no main-branch merge, hosted deployment or competition submission.

The baseline source audit is docs/V2-BASELINE-AUDIT.md. The consolidated requirements and honest P0/P1/P2 boundaries are docs/CONTEXT-DESK-V2-BRIEF.md. Competitor references and access boundaries are in COMPETITIVE-INTELLIGENCE.md; real screenshot observations and the design-tool/review record are docs/V2-VISUAL-RESEARCH.md.

## Automated verification

- `npm run check`: 26 JavaScript files syntax-checked.
- `npm test`: 64 passed, zero failed/skipped. Includes real FFmpeg audio/Arabic rendering and persisted assets; process restart, CAS/conflict recovery, job interruption, translation caches, history/split independence and caption clocks. New coverage includes retained-evidence search, union coverage, imported versus live source clocks, valid trim bounds, independent overlapping map lanes, Library view persistence/count semantics, caption-flag history/autosave and Studio rehydration.
- Regression tests were observed failing before the fixes for saved view preferences, honest clip counts, caption uncertainty autosave and Studio navigation. Other new helper checks are unit coverage, not a claim of an all-TDD implementation.
- `git diff --check`: clean at the recorded verification point.

## Real browser verification

Isolated QA store `/private/tmp/context-desk-production-qa`, app on port 3010. The synthetic 14-second speech/test-pattern fixture and small Library samples are explicitly QA data. These screens do not establish reality-show editorial quality. No new Meta/VoiceStudio requests were made in this pass; existing saved results/translations were reused. The visible API state says configured rather than asserting a successful new request.

Exercised: open saved project; navigate Discover→Studio and back; watch original context with file audio unmuted while editor video stays paused; playback, restart and loop; keyboard trim slider→canonical numeric boundary; format change; undo/redo; original caption selection; multiline caption correction and undo; caption review blocks unreviewed export; real export queued/running/completed; finished preview/download; Settings language controls, Escape and focus return; native language popup open; malformed URL inline recovery; Library grid/list, sort/order and no-result search; retained-moment search; refresh and QA server restart with saved 1.1s In point and assets retained.

Checked real DOM viewport widths 1440,1280,768,390; document scrollWidth matched each width for Discover, Studio, Library and Jobs in those checks. Mobile Settings fits within 390px with internal scrolling. The final independent review corrected mobile sort/order truncation, summary spacing and overlap-map ambiguity. This is a sampled accessibility/responsive check, not WCAG certification or assistive-technology/device coverage. Reduced-motion and forced-colour CSS exist; their OS preference states were not newly exercised in this pass. Existing RTL/libass automation remains covered; no new native-language judgement is claimed.

Actual captures: `/private/tmp/context-desk-v2-{discover,studio,library,jobs}-{desktop,mobile}.jpg`, `/private/tmp/context-desk-v2-settings-mobile.jpg`. Before captures and the public comparison board live in ignored `.runtime/design/v2/`. A default-size 1280 capture was initially labelled desktop before the1440 override took effect; final desktop captures were replaced after verifying innerWidth 1440. No fictional competitor/generated sample footage is served by the app.

The main app on port 3001 was restarted only after confirming zero active jobs. A new browser tab reopened the existing long Arabic recording (about 116 minutes), its selected source window, original/translated caption drafts and review flags, with acknowledged saving. This is real restoration evidence, not a new editorial/accuracy benchmark. Its footage and captions remain outside Git and were not uploaded to design services.

## Media evidence

Browser export downloaded as `/Users/chaimaenfif/Downloads/84493b5ff33852165c1d94d641428150646d41da518faa47878ad85597708c68.mp4`. FFmpeg fully decoded 94 frames with exit 0: duration 3.94s, H.264 1280×720 at 24fps, AAC stereo 48kHz. Requested trim 1.1–5.0s (3.9s); container/frame rounding accounts for the difference. It intentionally omits subtitles after the review gate was tested. The automated export test separately rendered 4:5 video with real audio and Arabic/libass assets. Neither is a full-episode engagement or translation-accuracy benchmark.

## Static review and design tools

12ui generated four candidates and a four-screen reference family. Its separate prototype failed its duplicate-ID gate; the actual app retained unique canonical controls. External screenshot alignment was blocked by automatic approval review and was not bypassed. An independent local Impeccable reviewer scored its eight material fixes resolved, with no material regressions observed in that batch; its ship verdict is scoped to those fixes.

The frontend premium static auditor was run in strict mode with public/ as the source scope and explicit native-select/canonical ownership in premium-ui.json. It reports external `.onclick`/delegated handlers as actionless because it only recognizes inline handlers, and global textarea `resize:none` as absent because it only inspects attributes. Those are checker limitations corroborated by source and real browser actions; do not add fake inline handlers/styles to make it green. The raw audit remains in ignored `.runtime/design/v2/premium-audit.json`; a strict-audit pass is not claimed. Import validation is explicitly JS-owned (novalidate) with associated inline errors. No existing Impeccable ignores were added or used.

## Performance and remaining gates

The cumulative 72,119-byte stylesheet was replaced by a single V2 token/layout system (39,173 bytes after the review fixes). Removed the eager 221KB old entry artwork request and external Google Fonts stylesheet; the wordmark font is locally hosted 161KB with an OFL notice. This is an asset/request comparison, not a measured speed or cost benchmark. Local 64-test run completed in under one second in the recorded environment; that does not measure provider or long-video latency.

Remaining: producer-reviewed full-episode yield, dialect-heavy and overlapping speech evaluation with native reviewers, translation correctness, sustained live/background capture and automatic framing, maximum six-hour/20GB stress, SAM tracking and other explicitly deferred advanced features, accepted-participant final rules/form. The public Meta page was rechecked on 1 November; the user deferred providing the final rules and a reminder already exists. These gates are not resolved by this UI work.
