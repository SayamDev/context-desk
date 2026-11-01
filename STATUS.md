# Context Desk status — 2026-11-01

This supersedes older capability snapshots. Historical test detail remains in QA.md and the build ledger. Implemented features and real-world quality are separate claims.

The screenshot-priority release fixes same-source player reloads, adds persistent volume/mute/speed, enforces project subtitle output with visible clip overrides, and adds social MP4 presets/download handoffs. A real Muse Spark translation and browser-generated 1080×1920 MP4 with English captions/audio were checked. Direct social OAuth publishing is not implemented. [Detailed diagnosis, verification and limits](docs/PLAYER-LANGUAGE-SOCIAL-RELEASE.md).

| Capability | Current evidence |
| --- | --- |
| Durable Library and editor | SQLite reopen tests; browser edits, captions, trim and immediate-refresh hook survived; same managed video replayed after process restart. Real title sorting tested both directions on three generated recordings. |
| Durable discovery | Backend FFmpeg picture sampling, speech/story/translation caches and incremental moments. A real Muse Voice + Spark pass completed after browser refresh. Test-pattern footage was correctly rejected; that is pipeline proof, not compelling-clip proof. |
| Queue and recovery | Three-job order/cancel/counter tests; SQLite recovery retains completed subtitles and ASR cache. Ambiguous provider calls require explicit retry. Browser Jobs shows actual progress and request counts. |
| Caption editing/translation | Real automatic French translation and original comparison tested; uncertainty flags blocked review confirmation. Official language-name filtering and optional code-switch hints tested. |
| Story Memory | Named memory created/saved in browser. Confirmed-only context and AI provenance tested; export and reversible Trash implemented. |
| Editor | Browser Undo/Redo tested. Source-preserving split tested. Trim, focus, loop/restart, story cuts and four aspect ratios implemented. Undo history resets on reload; edits persist. |
| FFmpeg export | Browser queued a four-second 720×900 MP4. Automated real render/probe verified duration, dimensions and audio. Separate Arabic glyph frame inspected from a 2.02-second 720×900 render. Finished files and SRT assets persist. |
| Full-recording subtitles | Durable 45-second sections, overlap, speech reuse and original/translated drafts. One real 8.16-second FLEURS Arabic test completed through the app. Full-track review/export control implemented; feature-length render not stress-tested. |
| Source recovery | A second Node process served identical source byte ranges. Relink test rejected different bytes while retaining edits, then restored matching bytes. Older subtitle checkpoint downloads migrate without guessed provider settings. |
| Live windows | Completed windows are staged before analysis; source switching waits for save and detached results target their original project. These changes do not establish sustained live-stream reliability. |

## Quality gates still open

- Multiple useful, context-preserving clips from a complete permissioned reality episode, judged by a human producer. No measured engagement uplift or guaranteed yield.
- Dialect-rich Arabic, overlap, code-switching, proper names and translation fidelity reviewed by qualified speakers. One clean FLEURS sample is insufficient: its strict WER was 33.3%, or 6.7% after the explicitly documented combining-mark normalization. The repeated opening word needs correction.
- Sustained real live stream with clean framing, audible saved/exported media, background-tab behavior and source-disconnection recovery. Prior live QA froze/recorded silence. No claim that browser capture or SAM tracking is implemented or production-proven.
- Complete six-hour/20 GB stress test, long full-subtitle run, disk exhaustion, multiple browsers/devices and large-library performance. Prior 2:05:55 / 3.44 GB import succeeded; that is not a six-hour test.
- Final accepted-participant Official Rules, submission form, eligibility, IP terms and deadline verification. The participant guide was provided on 1 November, but final rules/form links and IP terms are still unverified; public application/waiver pages alone do not settle them.

## Outside the implemented product

Multitrack audio mixing, multicamera sync, colour grading, advanced keyframes/transitions, dubbing, social publishing/scheduling/analytics, collaboration, hosted accounts/cloud storage and universal platform import are not implemented. Source-burned captions can only be covered, not reconstructed away. No automatic emotion diagnosis, verified person identity, universal dialect detection or virality prediction is claimed.
