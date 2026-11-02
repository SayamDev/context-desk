# Context Desk

An open-source, local production studio for finding **real story moments**, reviewing multilingual subtitles and making editable clips. Meta Muse Spark assesses sampled pictures and transcripts; Muse Voice transcribes the audio. The editor keeps source evidence, uncertainty and human decisions visible.

[V2 build brief](docs/CONTEXT-DESK-V2-BRIEF.md) · [Competitive intelligence](COMPETITIVE-INTELLIGENCE.md) · [Project vision and inspiration](PROJECT-BRIEF.md) · [Current evidence and limits](STATUS.md) · [Build ledger](docs/BUILD-LEDGER.md) · [Speech evaluation](docs/EVALUATION.md)

## Production workspace

A video-first Discover view keeps the original recording beside searchable source windows and a timestamped Moment Map. Overlapping windows have separate lanes. Studio pairs the real preview/trim timeline with editable captions and source evidence; Library supports saved grid/list views and Jobs keeps completed exports available. The charcoal/peach visual system, self-hosted wordmark, interaction contract and actual QA evidence are recorded in [DESIGN.md](DESIGN.md), [UX-CONTRACT.md](UX-CONTRACT.md) and [V2 verification](docs/V2-VERIFICATION.md).

Studio now has independent volume/mute/speed controls and stable media identity across inspector updates. A project subtitle language governs all clips unless an explicit clip override is enabled; missing translations queue with caching and review gates. Export presets prepare MP4s for TikTok, Instagram, Facebook and YouTube, with saved-file/download handoffs rather than a claim of connected publishing. See the [player, language and social release evidence](docs/PLAYER-LANGUAGE-SOCIAL-RELEASE.md).

The next expansion adds Home, a clip-switching Studio inspector, opt-in full-transcript discovery, source-supported semantic search, transcript video cuts, saved caption brand kits, native local face tracks, speech enhancement, Meta artwork, XML handoff, ZIP downloads and local encoder reception. YouTube/TikTok connection adapters require your approved app configuration; Instagram/Facebook remain manual upload. See [the expansion evidence and boundaries](docs/FEATURE-EXPANSION-RELEASE.md) and [the complete feature matrix](docs/FEATURE-PARITY-MATRIX.md).

## Run locally

Requires **Node 22.13+**, Python 3.10+ and FFmpeg with libass for subtitle rendering. A current Chromium browser is needed for shared-tab capture.

```sh
cp .env.example .env
# Set MODEL_API_KEY in .env; keep it private.
npm run setup:imports
npm run dev
```

Open http://localhost:3001. `FFMPEG_PATH` can point to an existing FFmpeg executable. `npm run check` checks every JavaScript source; `npm test` uses isolated temporary data and includes a real FFmpeg render when FFmpeg is installed. Muse Code login does not configure this application's Model API key.

## Workflow

1. Choose the spoken language and output subtitle language, then paste a permitted public link or select one or several video files. Automatic discovery is on by default. Optional controls include a second code-switching language, dialect hint, names, translation glossary, story lens and request budget.
2. **Jobs** shows queued, running, paused, failed and completed work, with actual section and provider-request counts. Processing runs on the local server after you close the browser. Keep the server running for continued processing; restart recovery requires an explicit resume for interrupted jobs.
3. **Find clips** presents source-linked candidates, supported setup/turn/payoff notes and a Moment Map. Clip count is a target: weak material is rejected. Choose another discovery depth to examine a different spread. This is sampled story discovery, not exhaustive comprehension of every sentence.
4. **Edit & export** offers trim, restart/loop, source-time seeking, undo/redo, split, fit/fill/focus, opening text, 16:9, 9:16, 1:1 and 4:5. Correct subtitle wording and timing; a language change starts translation automatically. Translations can be faithful, natural or concise without adding meaning. Compare originals beside translated lines. Resolve flagged lines and confirm review before captioned export.
5. Queue an **MP4 or WebM export**. FFmpeg renders on this computer; Jobs retains the finished video and subtitle sidecar. Preview the finished file before sharing. Assemble multiple moments into a saved story cut or queue separate draft clips without unreviewed caption/title overlays.
6. **Library** reopens recordings, edits and exports across refresh and server restart. Search and sort by title, dates, duration, size and clip count in either direction. Trash is reversible. Missing source files can be relinked; saved hashes verify original local-upload bytes. Older unhashed sources require editor confirmation and a fresh caption review.

Whole-recording subtitles use bounded 45-second sections with overlap, reusable speech results and original/translated draft SRT downloads. Preview the track on the source, apply it to clips, or open the whole recording as an editable captioned-video export. Large recordings need correspondingly large review and rendering time; a full six-hour captioned export has not been stress-tested.

Optional **Story Memory** shares editor-confirmed facts and cited notes between episodes. AI proposals remain unconfirmed until reviewed. Notes can be edited, exported and moved to reversible Trash. Session-scoped speaker labels are never treated as verified identities across recordings.

## Persistence and limits

SQLite is authoritative. Project revisions, jobs, tracks, managed frames, captured windows and exports live under ignored `.context-desk/`; override with `CONTEXT_DESK_DATA_DIR`. Sources do **not** expire automatically. Back up the entire data directory with the server stopped, including its media and SQLite companion files. There is no hosted storage, encryption service or automatic cloud sync.

- Recording duration: up to **6 hours**; local upload: **20 GB**.
- Direct link working file: **4 GB**, selecting compatible quality up to **1080p** including audio. Supported public sources depend on platform access and yt-dlp support.
- Discovery: up to 80/240/900 distributed picture sections and at most three times the clip target, capped at 100 story checks per pass and the visible budget. Queue counts show actual calls, including failed requests.
- Source-size exports cap the source height at 2160p. Edited presets can upscale smaller sources; this does not recover detail. MP4 uses H.264/AAC. Final subtitles use Arial/libass complex shaping; inspect the finished preview for wrapping and rendering differences.
- One discovery, one whole-subtitle and one export job may run concurrently, each with one worker. Pause finishes the current section; export cancellation stops its active encoder. Completed sections remain saved.
- An interrupted paid request may have completed remotely. Recovery never silently repeats it. Explicit retry may incur a second charge. Actual billing remains in the Meta dashboard; request counts are not dollar estimates.
- Undo/redo history is session-local. Confirmed edits and split clips persist. Conflicting tabs preserve a recovery copy in Library; restoring it creates a separate project without replacing the winning revision.

## Models, speech and live capture

[Muse Voice](https://dev.meta.ai/docs/speech-to-text) supports 25 named language hints and code-switching, vocabulary bias, speech turns and session-scoped speaker labels. It does **not** return word timestamps, confidence scores, emotion labels or a dialect classification. Short subtitle lines derived from turns therefore have estimated timing. Dialect notes guide reasoning/translation; they are not an ASR dialect selector. All recognition and translation remain drafts. [The evaluation report](docs/EVALUATION.md) records a real Arabic error rather than claiming universal accuracy.

Meta Muse Spark reads up to three sampled frames and an automated transcript, proposes evidence-backed story beats and translates subtitle text. Weak or ambiguous evidence should produce no selection. It does not hear the audio directly or predict virality. Optional VoiceStudio speech/translation uses localhost:3900 with no silent Meta fallback; local NLLB does not implement Meta's translation style/glossary controls.

Live capture needs an explicit browser share permission and tab audio. The app attempts player framing and offers manual framing. The monitor stays muted; supported browsers are asked to suppress source-tab speaker playback. Completed windows are saved before analysis and remain exportable after disconnection. Browser-owned live analysis interrupted by refresh reopens as an explicit retry; its paid request may have completed remotely. Completed responses are stored with request identities so later editor snapshots cannot erase them. The current unfinalized recording cannot be recovered after a browser crash, and future footage cannot be recorded once a source ends. Sustained live capture, background-tab freezes and automatic framing still need real-stream validation. SAM tracking is not implemented.

## Open source and data

MIT code: [LICENSE](LICENSE). No private competitor code was copied. Inspiration and supplied video links are recorded in [PROJECT-BRIEF.md](PROJECT-BRIEF.md). They do not grant redistribution rights. Process owned or permitted footage consistently with platform terms.

Keys stay server-side and out of Git. Meta receives audio for selected speech work, sampled images/transcripts for story work and subtitle text for translation. VoiceStudio receives loopback requests when selected. SQLite, footage, transcripts and rendered media stay out of the public repository. The local server binds only to 127.0.0.1; it is not a secured hosted multi-user deployment.

The competition build is a working local studio, with [explicit remaining validation gates](STATUS.md). It is not a complete replacement for Premiere/DaVinci, and winning is not guaranteed. [Submission notes](docs/SUBMISSION.md) separate verified event facts from outstanding official-rule checks.
