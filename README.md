# Context Desk

Context Desk is a local producer desk for finding real story beats while a video plays. It records short windows, asks Meta's models for evidence-backed suggestions, and gives the editor control of captions, framing, cuts, and exports.

## Start

Requires Node.js 20+ and a current Chromium browser for live tab capture.

```sh
cp .env.example .env
# Add MODEL_API_KEY=... to .env
npm run dev
```

Open <http://localhost:3001>. `npm run check` checks JavaScript syntax. The key stays on the local Node server; a Muse Code terminal login does not configure the Model API for this app.

## Automatic video links

Paste a supported public HTTPS recording link and choose **Make clips**. The local importer prepares the source picture and audio without player chrome or platform caption tracks, then starts the first Meta clip scan automatically. The same automatic start applies to local file uploads; uncheck the visible automation option to review before scanning. Clips remain editable.

Run `npm run setup:imports` once to install the pinned yt-dlp package locally. Python 3.10+ and FFmpeg are required for full source merging; use `FFMPEG_PATH` for an existing FFmpeg executable or put it at `.runtime/bin/ffmpeg`. The installed yt-dlp/ejs components provide extraction; no browser cookies, saved logins or third-party plugins are loaded. Import support varies by platform and access conditions.

Local recordings can be up to **6 hours and 20 GB**, with one source preparation at a time and at most three locally cached sources. Imported recordings play through byte-range requests from the local Node server; the browser no longer loads the whole recording into a Blob. Local files longer than 30 minutes or larger than 300 MB are also staged in this local cache so FFmpeg can extract short speech sections without decoding hours of audio in browser memory. These local-file transfers stay on this computer. Link imports automatically choose a source format up to 1080p within a 4 GB final-file budget (including audio), and retry lower resolutions if the estimate is exceeded. Temporary audio/video/merged copies are measured separately from the final-file cap. Local uploads check free disk space before preparation. It does not upscale a smaller source.

Cached source files expire after roughly one hour without use and are unavailable after a server restart. Preview and edited exports from a cached source require the local server to remain running. Already downloaded clips are independent files. Save exports before stopping the server. The six-hour limit is implemented and boundary-tested. A real 2:05:55 episode was successfully imported at 1080p into a 3.44 GB final file. A complete six-hour / 20 GB run has not been performed.

Live sources and denied downloads offer **Connect tab & start scan**. The browser requires a user share selection; the app then frames and starts scanning automatically when framing succeeds. If framing is uncertain, one crop confirmation is still needed. This cannot capture a protected player or bypass access restrictions. Use footage you own or have permission to process, consistently with its platform terms.

## Fast workflow

Use the three workspace tabs: **Add video** for source setup, **Find clips** for generation and review, and **Edit & export** after selecting a completed window. A loading panel names active work and shows elapsed seconds. Source evidence, subtitles, and multi-clip story controls expand when needed.

1. Paste a public recording link and choose **Make clips**, or load a video file you have permission to edit. Import and the first scan start automatically when enabled. For a live stream or denied import, connect **one already playing video tab** with tab audio using the offered fallback. For a shared tab, the app attempts to frame the player automatically. If it misses, choose **Draw area**, drag around the picture, and choose **Use this area**. Pause scanning whenever the source player is paused; the share clock is not the video playhead.
2. Choose a speech language if known, add a dialect/region note and proper names, and choose a live caption draft language. Speech & subtitles lets you choose Meta Muse Voice or the installed VoiceStudio app for transcription, and Meta Muse Spark or VoiceStudio's local NLLB engine for translation. The default is Meta. VoiceStudio must be open for local requests. Choosing VoiceStudio never silently falls back to Meta for speech or translation.
3. For an uploaded recording, choose **Find clips across video** to sample the whole file, select windows using picture change and available audio energy, and ask Meta to assess a bounded shortlist. Choose 3, 5 or 8 target clips. The number is a target, not a promise: unsupported moments are rejected. Open any sampled window and choose **Add to clip drop** if your own review finds it worthwhile. Render the selected windows as separate clean draft files or download the source-linked clip plan. For a connected live tab, scanning starts after successful framing. Manual frame confirmation starts it when detection is uncertain. **Start scan** remains available to resume a paused scan. That records consecutive 24-second clean video windows. The AI window limit defaults to 25.
4. Open a moment as it arrives. Edit the truthful opening, trim IN/OUT, reframe for 16:9, 9:16 or 1:1, correct caption text and estimated timings, and confirm captions against the source audio. Recheck speech and story after changing language or names. A previous-window draft caption rail shows the most recently analysed window while the source continues; it is not a synchronized live subtitle overlay. In the editor, **Restart** (R) returns to the trim IN point and **Loop clip** repeats the trimmed range. Tap a caption time to listen from it, correct the words inline, and use Earlier/Later or a numeric offset to adjust consistent subtitle lag. The same offset applies to preview, edited video, SRT and exported notes. Advanced line timing remains available for individual corrections. **Use this caption look on all clips** shares appearance without marking any words as reviewed.
   Context Desk transcribes the captured audio itself; it does not read YouTube or Twitch caption tracks. If the source player already shows captions, switch them off before sharing. Meta's frame check can flag visible source captions, and the editor can cover the bottom quarter of the picture before adding its own reviewed subtitles. This cover is a visual mask and may obscure part of the video; inspect the preview and export.
5. Ask the Story Engine to assess three adjacent windows as a setup, turn and payoff. It proposes an arc only when the transcripts support one. Add the proposal to the cut, reorder windows by drag or buttons, preview the cut, then export.
6. Export at source quality immediately when no overlay, caption, trim or reframe is applied. Edited 720p and 1080p exports render in the browser and can be slow on some systems; 1080p does not recover detail from a lower-resolution capture. The last export has a visible download link. A reviewed SRT subtitle file and source notes in JSON are available under More exports. Nothing publishes automatically.

Keyboard shortcuts outside text fields: Space play/pause, R restart, I set IN, O set OUT, M mark a live moment, A add the selected moment to the cut.

## What the models do

[Muse Voice Transcribe](https://dev.meta.ai/docs/speech-to-text) provides speech turns, speaker labels and turn-level timecodes. Its language bias supports 25 languages and code-switching; name keywords can help with proper nouns. It does **not** provide word-level timing or confidence scores. Context Desk therefore labels split caption timing as an estimate and requires source-audio review before captioned video or SRT export. A dialect note guides translation and editorial reasoning; it is not an ASR dialect selector.

VoiceStudio 0.5.6 exposes a local OpenAI-compatible transcription endpoint and a local NLLB translation endpoint on `127.0.0.1:3900`. Context Desk sends audio or text only to that loopback service when selected. Its tested transcription response included word timestamps, which Context Desk uses to form tighter caption cues. The tested local engine did not label speakers, and one NLLB response repeated a phrase; Context Desk rejects that obvious repetition. This is an optional draft path, not a guarantee of dialect accuracy.

[Muse Spark 1.3](https://dev.meta.ai/docs/image-understanding) reads up to three sampled frames and the draft transcript for each analysed window **regardless of the speech engine**. It also handles story arcs and is the default contextual translator. A separate, text-only pass can assess a three-window arc. Prompts and UI require source evidence, chronological order, and explicit uncertainty. The model cannot establish consent, intent, relationships, or future virality. Its suggestions remain editable. The editor and exported source notes show which engine produced each draft.

## Limits and rights

- Browser-tab capture depends on the browser's share permission and whether tab audio is available. Automatic framing detects the moving region of two shared-tab frames; static, low-motion or changing page layouts can defeat it, so the manual crop remains available. Move or resize the source player after framing and you must reframe. The app records the framed canvas with the shared tab's audio track. Frame rendering can slow or freeze when a browser throttles a background tab. A connected audio track can still contain silence. The app measures window audio and stops scanning after two windows with an unchanged picture and silent audio; check the actual exported file before use. A real YouTube share froze and recorded silence in QA, so this capture path is not yet reliable. Raw captured windows remain in browser memory for the session; the quick export keeps the captured pixels and recorded audio without another encode.
- Batch scanning supports browser-playable local files and imported recordings. Quick, Detailed and Full visual passes sample up to 80, 240 and 900 sections across the recording. The app sends at most three times the requested clip count (and no more than 24 windows per pass) to Meta, subject to the visible AI limit. Previously analysed windows are excluded on later passes. Small local files use an audio-energy pre-scan when possible; cached sources extract only shortlisted sections with local FFmpeg for transcription. This is a sampled discovery pass, not a complete transcription of every sentence in a long episode. The separate draft export re-encodes each selected range in real time, so long clips take time and consume browser memory. Automatic draft files omit opening text and subtitles until an editor reviews them.
- Browser-share timecodes are elapsed since sharing began, not YouTube or Twitch playhead times. JSON notes include that time basis and the crop rectangle.
- Captured windows live in browser memory for the current session. Save video and notes before reloading. A stopped or disconnected source does not remove captured windows in that session. Multicamera sync, persistent projects, full audio mixing, color grading, and guaranteed MP4 encoding remain outside the current build.
- Use footage you own or are allowed to process, record, and export. Do not treat a stream link as a licence. The importer uses yt-dlp rather than the YouTube API. This does not grant permission to download or reuse a video. [YouTube's API policy](https://developers.google.com/youtube/terms/developer-policies-guide) restricts downloading or separating media through API services.
- Audio and sampled frames go to Meta only during AI analysis; automatic translation sends selected cue text. The server binds to `127.0.0.1`, uses a temporary local cache for imported recordings, and keeps `.env` out of Git. Check your Meta project data settings before using sensitive footage.

See [STATUS.md](STATUS.md) for the current capability list, [RESEARCH.md](RESEARCH.md) for the product and speech research, and [QA.md](QA.md) for the evidence actually checked.

MIT licensed; see [LICENSE](LICENSE).
