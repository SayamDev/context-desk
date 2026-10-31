# Context Desk status — 2026-10-29

## What works now

| Capability | Current state |
| --- | --- |
| Local video files | Tested: a standard MP4 can play, scan into 12-second windows, and populate the moment queue. |
| Whole-file clip drop | Tested on a 28-second synthetic MP4: the app sampled two different source windows, sent both to Meta, and rejected both as unsupported story beats. A producer manually selected both QA windows, and the app rendered two separate MP4 draft clips. This proves the batch workflow, not moment quality on a real show. |
| Automatic shared-tab framing | Meta now detects the whole player boundary from one captured image. A synthetic page test located its video rectangle within approximately 12 pixels. Uncertain results require review or manual/full-frame selection. A real browser-share framing check is still required. |
| Source subtitle handling | Context Desk creates transcript drafts from captured audio and never imports platform caption tracks. Meta's picture assessment can flag visible source captions; the editor can cover the bottom quarter before drawing its own reviewed subtitles. The flag parsed in a synthetic Meta test, and the mask appeared in a playable exported MP4. Detection accuracy on actual source subtitles is untested. |
| Meta-assisted candidate selection | Real Meta requests ran on synthetic media and the supplied YouTube reaction video. Fifteen earlier windows were rejected as weak beats, mostly narration or ads. Five later windows came from a stalled, silent share and cannot establish clip quality. |
| VoiceStudio local speech | Optional, tested end to end on a generated speech video. The app used VoiceStudio word timestamps for editable captions while Meta assessed the visual moment. |
| Translation engine choice | Meta translation is verified on a short test line. VoiceStudio local NLLB is wired in; its repeated-phrase output was rejected, so its real-language quality needs review. |
| Edit a moment | Trim, preview, change aspect ratio and framing, edit opening text and caption lines. |
| Build a story cut | Add and reorder moments, preview and export a multi-window cut. Tested with two synthetic windows. |
| Export | An older 12.10-second MP4 remained playable with non-silent audio after the source was disconnected, but its browser export-and-download workflow took around 13 minutes and included player chrome. The delay needs isolation from the browser download wait. A new clean-crop source-quality path saved a 12.01-second MP4 immediately. That second source share was frozen and effectively silent, so its output is unusable. |
| Cost control | AI window limit is visible; automatic translation is optional. |
| Duplicate app tabs | Starting a scan in a second app tab pauses scanning in the first. The shared-tab monitor is muted. Tested with two app tabs. |
| Capture health | The app now measures audio and compares frame samples. It skips an unchanged silent window and pauses after two such windows to avoid repeated Meta calls. The new guard has passed syntax checks but awaits a fresh browser-share test. |

## Implemented but not yet proven end to end

| Capability | What needs proof |
| --- | --- |
| Shared YouTube browser video tab | The supplied YouTube page was shared with tab audio twice. One earlier captured window played after source disconnection and exported with sound. The later clean-crop run captured a frozen, silent feed even as the YouTube playhead advanced. The older share flow opened a tab. The current pasted-link flow also imports supported public recordings directly; see the automatic-import evidence below. Twitch and other platforms remain untested. |
| Multiple real-show clips | The full-file workflow and two separate draft exports work on synthetic media. No full reality-show VOD has yet yielded and validated several compelling clips; batch scanning is currently limited to local files. |
| Live scanning | A shared replay was scanned while playing, paused and resumed. A sustained truly live-stream test has not passed. If a shared source ends, scan stops; captured windows remain in that browser session. |
| Arabic and other-language subtitles | Meta speech turns or VoiceStudio local word timings, translation drafts, editable lines and a review gate exist. Accuracy on dialect-rich content and timing need bilingual validation. |
| Story arcs and engagement | The model can propose a supported setup, turn and payoff from adjacent windows. It cannot predict virality or prove increased viewership. |

## Not built

- Universal platform import or automatic screen capture without browser permission. Direct public recording import is now implemented on supported hosts, subject to access, codec, size and duration limits.
- Pixel-perfect removal of captions already embedded in source frames; the current bottom-strip cover can obscure picture content.
- Reliable, persistent projects or recovery after browser reload; hosted media storage. The local server does use a temporary source cache.
- A full nonlinear editor: multitrack timeline, multicamera sync, transitions, audio mixing, color grading, keyframes, motion graphics and collaboration.
- Automatic dialect identification across the world's dialects, guaranteed accurate translation, word-level subtitle alignment or automatic fact-checking.
- Platform publishing, scheduling, analytics and measured engagement optimization.
- Production proof across long streams, browsers, devices, rights-restricted players and real creator workflows.

## Completion gates

Three of six basic demo gates have evidence: **local ingest and scan**, **AI candidate decision**, and **edit plus playable export**. A two-file batch export on synthetic footage is also verified. The remaining gates are **a stable, clean shared-tab capture with sound and a fast export**, **bilingual review of real Arabic captions**, and **a permissioned demo plus hackathon submission materials**. The clean shared-tab gate is currently failing. This is a working local prototype, not a finished replacement for Premiere or DaVinci. See [QA.md](QA.md) for exact test evidence.


## Studio navigation revision

Source, clip generation and editing now use separate workspace views. File opening, generation, preview loading, framing and rendering display task-specific loading feedback. Browser QA verified correct switching between windows at source seconds 0 and 22, and a 3-second trim exported and reloaded as a playable 2.97-second 640 × 360 MP4. Already-framed captured windows no longer receive a second crop in the editor. The revised live path still needs a sustained actual-share test.

## Automatic source workflow — 2026-10-30

The pasted-link flow now imports supported public recordings through a local yt-dlp job, reports progress/cancellation and automatically starts Meta analysis. The supplied 16:17 YouTube recording was actually imported at 1920 × 1080 with audio. The browser sampled the recording and automatically analysed four windows before QA stopped it; two were proposed as clips and two declined. These are model suggestions, not independently verified clip quality. A six-second edited export decoded as a 5.98-second 1920 × 1080 H.264/AAC MP4 with non-silent stereo audio. No screen share or additional scan click was required.

The new live fallback combines source opening, one browser permission, auto framing and automatic scan start. Its combined live path has not been verified on a truly live source. Story lenses and setup/turn/payoff/edit notes are implemented; see EDITORIAL-FOUNDATIONS.md for source references and the uncompleted reality-show evaluation.


## Branded long-recording revision

The entry screen now uses original generated editorial artwork, a custom geometric mark, a lilac/violet/lime palette, and a responsive source-form/artwork split. The core three-stage workflow remains. The artwork is local and optimized to a 221 KB WebP.

Both link imports and local file staging accept up to **6 hours / 4 GB**. Imported media uses local byte-range playback rather than a whole-file browser Blob. Long local files are streamed to the local temporary cache. FFmpeg extracts at most 60 seconds of speech at a time for shortlisted sections. Optional discovery depth increases the visual pass from 80 to 240 or 900 sampled sections, while the existing AI-request budget still applies; this does not promise exhaustive full-episode transcription.

A 31:40 synthetic H.264/AAC recording was prepared through both the local upload API and browser workflow. A late audio section at 31:10 extracted with non-silent audio. A fresh real YouTube import loaded at 1920 × 1080 through the local media URL. Six-hour and multigigabyte boundaries pass unit tests, but an actual six-hour / 4 GB sustained run has not been performed. Current long-form semantic clip quality is not established by the synthetic fixture. Cached-source editing requires the server to stay running.


## Import recovery and replay / subtitle editing

The supplied episode `https://www.youtube.com/watch?v=cNcpgXHO7uw` (7555 seconds, 2:05:55) reproduced the old 4 GB error at 100% download. The previous guard summed separate streams and the merged file. The repaired importer completed the same episode at 1080p with a 3,444,927,211-byte final file. It now projects compact metadata, chooses a size-aware video/audio pair and can retry a lower resolution. Long-download logs use a bounded tail rather than growing with every progress line.

Local upload capacity is now 20 GB with an available-disk precheck; the six-hour duration ceiling remains. A full 20 GB upload and six-hour production have not been stress-tested.

The clip editor adds Restart, optional Loop clip, end-of-trim replay behavior, inline caption correction, tap-time playback, shared subtitle sync nudges, and applying a caption look across clips. Preview uses the presented video frame clock where supported. The live rail is explicitly a previous-window draft, not live synchronized captions. Meta's short-line timing remains estimated; the sync control is not forced word alignment or a dialect-accuracy guarantee.
