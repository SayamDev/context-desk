# Context Desk — project vision and handover

## What this project is

Context Desk is an open-source, local video production studio being developed for the Meta Global AI Developer Hackathon. It helps solo streamers and unscripted-show producers discover compelling moments, turn them into editable clips, and create multilingual subtitles. One simple default workflow should serve both audiences.

The creator wants a distinctive, useful, ambitious competition entry that meaningfully uses Meta products. Winning is an aspiration, not an outcome this project can guarantee. Current event requirements and eligibility must be checked against official rules before submission.

## Product ambition

Paste a recording or live-stream link, or load a file, and let the app do the preparation automatically. Discover genuine questions, reversals, reactions, tension, humour and consequences. Preserve context and chronology. Produce clips that encourage people to watch the show and discuss real events without fabricating dialogue or conflict. Reality and dating shows are an important initial use case, including Arabic shows with regional dialects.

The user wants this to become a primary editing and clipping tool: powerful underneath, quick and straightforward to operate. It should feel branded, beautiful, energetic and Gen Z while remaining accessible to older and professional users. Original artwork, clear navigation, visible loading/progress, and responsive controls matter as much as feature count.

## Requested experience and features

- Automatic preparation and scan after opening a supported video link; avoid a chain of connect/start confirmations.
- Recordings substantially longer than 30 minutes, plus live workflows across YouTube, Twitch and other streaming platforms where access permits.
- Multiple worthwhile clips per recording, with fast discovery, source timecodes, clear coverage and reusable exports. Clip count is a target; weak material should not be presented as a good moment.
- Reality-style story production: setup, turn, payoff, truthful hooks, alternate openings, suspense and immediate reactions, with editable decisions.
- Automatic player framing, clean exports without browser chrome, highest practical source quality, preserved audio, and usable captured clips after the original stream stops.
- Easy manual editing: trim, seek, restart, loop, aspect ratios, framing, hooks, captions and multi-clip story cuts.
- Fresh transcription from the audio instead of importing YouTube subtitles. Avoid double captions from source-player CC.
- Accurate, dialect-aware multilingual subtitles, proper-name hints, editable wording/timing, attractive animation and styles. Never advertise universal dialect accuracy without evaluation.
- Selecting a clip language should translate automatically, with loading feedback and reuse of existing translations.
- Whole-recording subtitle translation, original and translated subtitle downloads, progress, pause/retry and cost visibility.
- Optional VoiceStudio local speech/translation integration. Meta remains central for visual/story reasoning and contextual translation.
- Cost-effective use of the user's Meta credits; visible request budgets and no unnecessary repeated calls.
- Open-source building blocks and public product research may inform implementation. No copying private code or bypassing platform access restrictions.

## Current implementation

Dependency-free Node server with browser HTML/CSS/JavaScript. Meta API credentials stay server-side in `.env`. Muse Spark handles story/visual reasoning and translation; Muse Voice handles transcription. VoiceStudio is an optional loopback service. Local yt-dlp and FFmpeg prepare media and extract bounded audio sections.

Supported recording imports select quality up to 1080p within a 4 GB final working-file budget. Local uploads permit up to 20 GB; duration validation permits six hours. Byte-range playback avoids loading an entire imported recording into a browser Blob. These are implemented limits, not proof of a complete six-hour/20 GB stress test.

The app includes three workspaces, original brand artwork, sampled multi-clip discovery, evidence-backed suggestions, editable framing and subtitles, restart/loop controls, source-linked notes, and browser-rendered exports. Language selection now starts clip translation automatically. Whole-recording subtitle jobs process 45-second sections with overlap, checkpoint completed sections locally, reuse speech results, and offer draft SRT downloads and a native subtitle preview. Fade/highlight styles are added; karaoke is restricted to original tracks with supplied word timestamps.

## Evidence and important limits

The supplied two-hour episode was imported at 1080p into a 3.44 GB final file after repairing a guard that counted merge copies against the final-file limit. A 24-second excerpt from it was used for clip and translation QA. The single suggested clip shown in that test came from that excerpt, not a full-episode scan. Whole-recording translation was actually exercised on the 24-second file, not on all two hours.

Automated tests cover imports, metadata projection, size-aware format selection, media ranges, timing, translation caching, subtitle chunking, pause/resume and retry without repeated speech processing. Consult QA.md for exact evidence. Recognition and translations remain drafts: incorrect words and awkward translations have been observed. Human review remains necessary.

Discovery samples portions of recordings within an AI budget; it is not exhaustive semantic understanding of every sentence. Live draft captions have processing latency. Truly live capture has previously frozen or recorded silence and remains a significant unresolved reliability area. Universal platform support, robust speaker tracking, professional colour/audio tools, multicamera editing, persistent full projects, dubbing, social scheduling and guaranteed virality are not completed features.

Whole-video translation currently creates subtitle tracks and previews; it does not dub voices or automatically render a complete captioned feature-length MP4. Jobs can survive a page refresh while the local server runs. Server restart recovery and long idle cache expiry require further work. Checkpoint files are local; do not commit transcripts or cached footage.

## Inspiration and resources supplied by the user

- Meta hackathon: https://dev.meta.ai/events/global-hackathon
- Meta developer/API platform: https://dev.meta.ai/
- Storysonic: https://storysonic.com/ — automatic clipping, captions, contextual terminology and caption effects.
- OpusClip: https://www.opus.pro/ — clipping, editable/animated captions, reframing, branding and broader production workflows. User screenshots also reference AI Producer, ClipAnything, B-roll, XML export to Premiere/DaVinci, speech enhancement, dubbing, scheduling, team workspaces, API and MCP. These are reference ambitions, not a list of completed Context Desk capabilities.
- WayinVideo: https://wayin.ai/wayinvideo/
- vidIQ AI Clips: https://vidiq.com/features/ai-clips/
- Riverside Magic Clips: https://riverside.com/magic-clips
- Clipzula: https://www.clipzula.com/
- OpenShorts open-source reference: https://github.com/mutonby/openshorts
- Other names in the supplied screenshot: Whop, Reach.cat, Vyro, ClipAffiliates / Clipping.io, and native clipping programs. Their capabilities have not all been independently evaluated.
- Adobe Premiere Pro and DaVinci Resolve were requested as references for editing depth with simpler usability.
- VoiceStudio is installed locally and was offered by the user for speech and translation.

## Supplied test videos

- https://www.youtube.com/watch?v=6Zp1hm07dts
- https://www.youtube.com/watch?v=77oXbPcjMEc&t=3123s — Arabic reality-show example.
- https://www.youtube.com/watch?v=Hn1Tb4Hn6O8
- https://www.youtube.com/watch?v=cNcpgXHO7uw — episode used for import regression and an Arabic excerpt.

These links are test references, not redistribution licences. Use owned or appropriately permitted footage for a public demo.

## Priorities before competition submission

1. Evaluate full-length recordings for actual clip quality and yield; clearly distinguish sampled discovery from exhaustive processing.
2. Test Arabic dialects, code-switching, names, overlap and caption synchronization with native speakers and reference transcripts.
3. Harden live capture, sound, auto framing, background-tab behavior and exports across browsers.
4. Stress-test long files, full subtitle runs, cache management, recovery, costs and cancellation.
5. Finish mobile and accessibility QA, including new translation controls.
6. Prepare a concise demo using permitted footage, showing source evidence, useful Meta integration and editable results.
7. Verify official event rules, eligibility, deadline, submission requirements and third-party licences. Do not claim that feature breadth alone guarantees a win.

## Development references

README.md covers setup. STATUS.md records capability boundaries. QA.md records tests and limitations. RESEARCH.md and EDITORIAL-FOUNDATIONS.md retain research and editorial context. DESIGN.md describes the visual system. Original artwork provenance and prompt are in public/assets/ARTWORK.md.
