# Editorial foundations and product decisions

Research checked 30 October 2026. This is an independently implemented product workflow informed by public documentation, accessible research, publisher descriptions and an author excerpt. It is not a reproduction of competitors' private implementations, and the full books were not reviewed. Publisher/creator material provides craft guidance; scientific papers do not establish that this app increases engagement.

## Paid products: what users already expect

| Primary source | Publicly documented workflow | Context Desk decision and current boundary |
|---|---|---|
| [OpusClip pricing](https://www.opus.pro/pricing), [ClipAnything](https://www.opus.pro/clipanything) | Starter $15 monthly; Pro lists $29 monthly and a cheaper annual equivalent. Paid features include multimodal discovery, prompts, captions, templates, editing and editor handoff. Business pricing is custom. | Link import, automatic first scan, optional genre, editable captions, batch drafts and source notes. No claim that our multimodal selection outperforms theirs. No actual Premiere/Resolve project export yet. |
| [Eklipse](https://eklipse.gg/), [live-clipping help](https://eklipse.gg/help/what-is-live-clipping/) | Current homepage lists Premium from $24.99/month and Premium Pro $39.99/month. Its live-clipping help limits the documented beta to Call of Duty and Premium. Some older comparison pages conflict with this pricing. | Keep incoming capture and clip review independent so editing does not pause a shared live source. Automatically frame and start after the browser permission. Current implementation still requires an actual sustained-live validation. |
| [WayinVideo editor](https://help.wayin.ai/en/articles/16210969-video-editor-overview), [plans](https://help.wayin.ai/en/articles/15692322-how-wayinvideo-plans-work) | Broad editing suite, moment search, montage, subtitle styling, bulk operations and publishing; higher plans expand throughput. | Use a simple default and reveal advanced tools when needed. Link import and batch scan are implemented; full project autosave, publishing, B-roll and audio mixing remain absent. |
| [Riverside Magic Clips](https://riverside.com/magic-clips) | Automatic discovery with transcript editing, caption customization and layouts. | Every generated window remains editable; source wording and provider are visible. Caption accuracy has to be checked on the actual dialect and recording. |

Feature lists are providers' descriptions, not independently measured performance. Paying more does not itself prove better selection. Public workflow analysis can guide an independently written implementation; it cannot reveal proprietary algorithms.

## Craft and research translated into explicit rules

| Source actually consulted | What it supports | Implemented editorial rule |
|---|---|---|
| [Jeff Dawson, *Editing Reality TV*, publisher description](https://www.silmanjamespress.com/shop/filmmaking-directing/editing-reality-tv/) | Reality editors assemble coherent storylines from unscripted footage. The author edited *The Bachelor* among other programs. | Reality/dating lens looks for an explicit question or decision, response/reversal and immediate consequence. It must not invent a relationship, jealousy, betrayal or intent. |
| [Karen Pearlman, *Cutting Rhythms*, author excerpt](https://blog.routledge.com/humanities-and-media-arts/cutting-rhythms-creative-film-editing/), [publisher](https://www.routledge.com/Cutting-Rhythms-Creative-Film-Editing/Pearlman/p/book/9781041024088) | Rhythm involves timing, pacing and phrasing, including tension and release. It is a craft skill rather than a fixed cut frequency. | Ask for an edit note that identifies what to retain at the opening and ending. Preserve meaningful hesitation; avoid automatic arbitrary jump cuts. These are model recommendations requiring preview. |
| [Sheila Curran Bernard, *Documentary Storytelling*, publisher](https://www.routledge.com/Documentary-Storytelling-Creative-Nonfiction-on-Screen/Bernard/p/book/9781032267296) | Creative nonfiction can reach audiences while maintaining integrity and transparency. | Preserve original chronology in automatic selections, retain source evidence, and flag missing context rather than manufacturing a story. |
| [Walter Murch, *In the Blink of an Eye*, publisher](https://www.silmanjamespress.com/shop/filmmaking-directing/in-the-blink-of-an-eye2nd-edition/) | Creative and practical decisions about cutting, continuity and emotional cues. The accessible description does not establish a universal optimum cut length. | Let the editor compare source and cut. Do not turn a general craft principle into an unsupported numeric engagement score. |
| [Lehne & Koelsch (2015), psychological model of tension and suspense](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00079/full) | A theoretical account connecting significant uncertainty, anticipation and resolution; it is not a viral-video predictor. | Find the real question and supported resolution. A blank payoff field is preferable to an invented reveal. |
| [*Building blocks of suspense* (2022)](https://www.nature.com/articles/s41599-022-01461-5) | Studies narrative content and film music in a multidimensional account of suspense. | Separate story evidence from treatment. Music/effects are not evidence of conflict. No automatic fabricated audio or reaction is added. |
| [UMT, CVPR 2022](https://openaccess.thecvf.com/content/CVPR2022/html/Liu_UMT_Unified_Multi-Modal_Transformers_for_Joint_Video_Moment_Retrieval_and_Highlight_Detection_CVPR_2022_paper.html), [QVHighlights](https://arxiv.org/abs/2107.09609) | Moment retrieval and highlight saliency can be evaluated against human annotations; visual/audio context and a query matter. | Use visual change plus available audio energy for inexpensive candidate sampling, then Meta vision and a transcript for editorial review. This heuristic is not UMT or Moment-DETR and inherits none of their benchmark results. |

The analysis response now includes `setup`, `turn`, `payoff` and `editNote`, displayed under source evidence. Missing beats must be marked as not established. Genre selection changes the actual model instructions. This is a prompt-level implementation, not a model trained on these books or papers.

## Creator and platform evidence

- [YouTube guidance on content performance](https://support.google.com/youtube/answer/16559650?hl=en) advises a concise initial hook that delivers the packaging promise, thoughtful storytelling and measured audience response. The app asks for a specific truthful hook rather than generic exaggerated stakes.
- [YouTube audience-retention guidance](https://support.google.com/youtube/answer/9314415?hl=en) explains that spikes can reflect sharing/rewatching **or confusion**. A clip's performance cannot be diagnosed by one number. Context Desk does not claim that its editorial judgment predicts actual retention.
- [YouTube on MrBeast](https://blog.youtube/creator-and-artist-stories/mrbeast-500-million-youtube-subscribers/) documents creator events with explicit premises and stakes. [YouTube's IShowSpeed/FIFA event](https://blog.youtube/news-and-events/youtube-fifa-creator-cup-central-park/) documents a live competition with identifiable context. Our product inference is to retain the premise and immediate outcome so a new viewer understands the moment. These examples do not establish the cause of those creators' success or a formula to copy.
- [Twitch stream markers](https://dev.twitch.tv/docs/api/markers) provide a first-party way for an authorized broadcaster/editor to mark actual broadcast offsets. [Twitch Clips](https://dev.twitch.tv/docs/api/reference#create-clip) are asynchronous and require platform authorization. Context Desk currently records user-shared windows locally; it does not claim a connected Twitch account, chat integration, automatic platform publishing or a native Twitch marker integration.

## Live workflow and evaluation

Shared live input now proceeds from one permission to player detection and automatic scan start. Captured windows arrive while the selected clip can be edited. Windows are 24 seconds by default to allow more conversational context; this duration is a product choice to test, not a scientific optimum. It is still possible for a question/answer to cross a boundary; the adjacent-window story tool can review three contiguous windows. Editing a local file pauses its playback scan, while editing an already captured live window leaves shared-live scanning running.

Before claiming quality or engagement improvement, evaluate at least ten permissioned scenes including quiet disagreements, humour, no-event footage, incomplete questions, dialect-heavy speech and overlapping speakers. Have a bilingual editor label suitable start/end/context and verify every quotation. Report:

1. Useful clips kept versus all suggestions; missed editor-selected moments.
2. Incorrect claims about conflict, relationships or outcomes (each is a failure, not an acceptable average).
3. Subtitle correction burden, missing names/idioms and timing errors.
4. Time from source readiness to first reviewable clip and export.
5. Framing errors and actual picture/audio integrity after source disconnection.
6. Held-out audience retention and satisfaction only after consented real publishing; distinguish results from predictions.

No such full reality-show evaluation has passed yet. Current synthetic, import and sampled-video QA is documented separately in QA.md.


## Product workflow references: Storysonic and OpusClip

Reviewed their public pages on 30 October 2026. These are vendor descriptions, not independent performance benchmarks or access to their private implementations. No proprietary code was copied.

- [Storysonic](https://storysonic.com/) emphasizes import → clip → transcribe → export, caption effects and context-aware transcription. Context Desk already provides automatic import, sampled multi-clip discovery and three caption looks; this revision adds applying a caption look across all captured clips and removes timing syntax from the default correction workflow. We do not adopt its unverified performance or accuracy claims.
- [OpusClip](https://www.opus.pro/) emphasizes editable captions, reframing, and an editor in which the user retains control. Context Desk adds transcript-led caption correction: click a line time to listen, edit the wording inline, and replay or loop the trimmed clip. Its existing reframing and source-evidence workflow remain. Automated moving-subject tracking and Opus's private ranking models are not implemented by this revision.
- Caption sync uses the video frame clock in supported browsers and a shared time-offset transform for preview, edited exports and SRT. Estimated Meta turn-to-line timing is still labelled as estimated. A global offset corrects consistent lag but cannot repair varying word alignment, mistranscriptions or dialect ambiguity.
- [yt-dlp output templates](https://github.com/yt-dlp/yt-dlp#output-template) support projecting a small JSON object from metadata, including selected format fields. The importer now requests that projection rather than the complete extraction payload. A local fixture containing a nine-million-character media URL produced a 192-byte projected response.
