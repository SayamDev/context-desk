# Context Desk: production feature expansion

2026-11-01. This expands the product scope; it does not claim every competitor capability or production readiness. The full feature vision remains in [the parity matrix](FEATURE-PARITY-MATRIX.md), with sources and explicit implementation gaps.

## What changed

- **Home and navigation:** branded source entry, real saved-project imagery, recent projects and recoverable Trash visibility. Hash URLs, browser navigation, loading state and startup navigation arbitration. Home is the default; the current Studio destination preserves playback.
- **Focused Studio:** clip switcher, central footage/trim timeline and Captions/Style/Story/Export inspector. Compact narrow controls, consistent small-screen project rows and mobile navigation. Source-context review lives with Story.
- **Deep discovery:** explicit opt-in contiguous source-audio transcription, source-cited global story ranking, variable context-bearing candidates and visual verification. Existing sampled discovery remains the cheaper default. A no-provider-call request preview exposes bounded operations. Whole-source transcript coverage is distinct from visual story-check coverage.
- **Search by meaning:** explicit Meta search over retained transcripts and evidence, exact cited wording, original-source links, durable cache and explicit failed-request retry. This does not inspect previously unseen footage.
- **Transcript video edits:** keep/remove selected speech creates independent ordered source trims in the Story cut, with context handles, original tracks, provenance and Undo. Editing subtitle text alone still does not alter spoken audio.
- **Caption brand styles:** visual caption presets, saved font/colour/size/placement kits, four font choices and consistent preview/render settings. Karaoke remains restricted to original speech with available word timing.
- **Framing:** native Apple Vision samples saved clip frames, produces local-time geometric face tracks and smooth crop positions. Wide groups/uncertain tracks retain Fit; an explicit face-position choice can guide tracking. Preview and FFmpeg use the same bounded interpolation and scene-cut holds. This does not identify people or determine who speaks. SAM is not integrated.
- **Sound and covers:** optional FFmpeg denoising/loudness balancing on export; composed cover-frame download; explicit Meta Muse Image cover/illustration jobs with provenance, labelled output, durable recovery and owned-frame reference validation. Generated images are not automatically inserted as factual source footage.
- **Deliverables:** real FCP 7 XML source-edit timeline, separate SRT and JSON notes; completed-video ZIP selection with available subtitle assets and provenance manifest. Project ownership and unchanged local files are checked.
- **Live encoder capture:** separate local OBS/RTMP projects, rolling finalized 24-second video/audio assets, explicit 1/3/6-hour limits and bounded optional Meta processing. Stops retain completed windows and final short windows; restart requires reconnect/resume. Capture is localhost-only and its routing key is not strong authentication. Browser-tab capture remains a separate source path.
- **Social foundation:** server-side encrypted credentials, YouTube/TikTok OAuth/upload adapters, explicit metadata/account/export review and short-lived single-use confirmation. Configured OAuth clients and provider approval remain prerequisites. No account is connected in QA; Instagram/Facebook automated publishing is unsupported. All four platforms retain manual saved-file handoff.

## Actual checks in this expansion

- Default suite: **193 tests, 191 passed, zero failed, two opt-in live tests skipped**. Syntax: **53 JavaScript files**. Later final review changes, if any, must rerun this gate.
- Separate actual localhost tests: 27-second FFmpeg video/audio receiver plus parent-liveness supervisor cleanup passed. The integrated browser additionally started a separate receiver and sent a real 14-second synthetic speech recording into it. Its recorded window remained editable/playable after the encoder stopped; real Muse Voice/Spark results reopened from saved state. It was correctly rejected as test-pattern footage rather than presented as a useful story.
- Real deep discovery: a 14-second synthetic speech/test-pattern recording completed **one speech request and one story-ranking request**, 14 seconds transcribed, zero supported candidates. This validates the provider path and truthful empty result, not compelling episode discovery.
- A real Meta semantic query was submitted against retained live speech; its result must be checked separately from transport success.
- Real Muse Image: one synthetic original cover brief produced a saved PNG. It was visually inspected. No episode frames were sent for that image request.
- Real native reframing: a six-second local-only episode excerpt detected faces and safely refused an over-wide group crop. An explicit opening-face position produced **14 saved crop positions**. A real two-second synthetic moving-crop render and a real six-second tracked-footage export completed.
- Browser transcript selection created a 6.12-second trim from a six-second synthetic caption plus context; Undo restored the original two-clip collection. A synchronous selection-change bug was fixed and covered by a regression test.
- Browser brand-kit save persisted Manrope/top placement. The resulting enhanced-audio MP4 was **1080×1920, 8.02 seconds, 24fps, with audio**; its decoded frame showed the requested top subtitle. Measured input integrated loudness from the finished export was approximately **−16.47 LUFS**. Synthetic captions establish state/render behavior, not transcription accuracy.
- Browser XML creation exposed actual XML, SRT and sidecar downloads. XML structural/timing tests pass, including real source probes; Premiere Pro and Resolve themselves have not been used to import it.
- Browser downloaded a genuine ZIP containing the MP4, SRT and manifest; Python ZIP integrity check passed. ZIP64 availability is checked, but a greater-than-4GB output archive has not been tested.
- No horizontal page overflow was measured at actual CSS widths **390, 484, 768 and 1440**. Captures are local review evidence, not public repository assets. A late startup-restore navigation race was corrected and tested.
- Social transport/state tests use fake providers. The Connections interface showed genuine missing-configuration states. No real OAuth, upload, publishing or scheduling was performed.

## Reliability fixes found during integration

Worker live results now have durable completion records. Saved project snapshots cannot hide completed analysis, human trims/styles/caption corrections survive reconciliation, later reviews are not reset repeatedly, and newer manual reanalysis takes precedence. Regression tests reopen SQLite to verify this. Crop tracks reject malformed points and normalize tiny duplicate times before building expressions. Face-choice overlays use the actual sampled frame corresponding to detected face coordinates.

The user's existing projects were found in recoverable Trash; their media and edits were retained. They were not automatically restored or reset for these tests.

## Reference and asset provenance

Public Klap, quso.ai and Restream entry screens were inspected using the requested **Reverse Engineer Anything** tool, with temporary browser profiles. Existing captures and research cover the other supplied sources, including OpusClip, Riverside, Storysonic and WayinVideo. Public UI observation is not authenticated paid-editor operation or access to private source code. The feature matrix lists the source URLs and marketplace/editor distinction.

`public/assets/story-paper.webp` is original artwork generated through **Meta Muse Image 1.0** on 2026-11-01, then resized/compressed with FFmpeg. Exact generation brief: “Synthetic QA cover artwork. An original minimal editorial poster showing a peach paper film strip on a charcoal surface. No text, no people, no brands.” It appears in the empty Home state; real project imagery takes precedence. The generation was not based on third-party reference footage. The existing Manrope font retains its existing OFL attribution.

## Remaining product work

Human-reviewed whole-episode clip yield and dialect accuracy; sustained long capture and large-library stress; multi-track/track-level editing, multicamera sync, colour tools, dubbing, automatic B-roll insertion, scheduling/analytics, multiuser cloud workspaces, approved connected social deployments and target-NLE import acceptance remain open. Provider approval, credentials or hosting cannot be replaced by a UI button. No guaranteed engagement, competition result or universal platform/dialect support is claimed.
