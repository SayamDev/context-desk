# Research: beginners, Arabic-to-English subtitles and posting (November 2026)

Sources were checked on 2 November 2026. **Confirmed** means a source below states it. **Proposal** means it is our recommendation.

## 1. What competitors offer

| Tool | Price (USD / month) | Usage limit | Relevant features | Source |
| --- | --- | --- | --- | --- |
| OpusClip | Free; Starter $15; Pro $29 ($14.50 billed yearly) | 1 credit = 1 minute of uploaded video. Free plan: 60 minutes, watermark, 3-day storage | AI clipping, virality score, animated captions, auto emoji and keyword highlights, reframe, scheduler (Pro). Speaker-based caption colours listed as "coming soon" (Business) | [opus.pro/pricing](https://www.opus.pro/pricing), [help.opus.pro plans](https://help.opus.pro/docs/article/plans-and-credits) |
| Submagic | Starter $19; Pro $39 per member; Business $69 | 15 / 40 / 100 videos; source length capped at 2 / 5 / 30 minutes | Captions in 123 languages, including Arabic | [Soku review, verified 2026-09-09](https://soku.ai/alternatives/submagic/review), [submagic.co/languages-supported](https://www.submagic.co/languages-supported) |
| Vizard | Free; Creator $14.50 yearly; Business $19.50 yearly | Free: 60 credits, 720p with watermark, 3-day storage | Long-video-to-Shorts clipper | [techpilot.ai (Oct 2026)](https://techpilot.ai/tools/vizard-ai/), [vizard.ai/pricing](https://vizard.ai/pricing) |
| Klap | Starter $14 yearly; Pro $39 | Pro: up to 3,600 upload minutes | Prompt-based re-clipping, free regeneration | [klap.app comparison](https://klap.app/alternatives/vizard-ai) (vendor page) |
| CapCut | Free tier | n/a | Auto captions and translated subtitles in many languages | [capcut.com translated subtitles](https://www.capcut.com/resource/translated-subtitles) |

**Confirmed patterns:** pricing is per minute of uploaded source video, free tiers add watermarks and delete files after a few days, and sources of 30 minutes or more fall outside cheaper tiers (Submagic Pro allows 5 minutes).

**Gaps (proposal):**
1. None of these tools markets dialect-aware Arabic-to-English translation that flags uncertain lines instead of guessing. They list "Arabic" as one language.
2. Speaker handling is shallow. OpusClip lists speaker-based caption colours as "coming soon"; we found no mention of overlapping-speech layout.
3. Long sources and the price per minute work against two-hour reality episodes. A local-first app with no credit metering stands out on cost.
4. Beginners still face timelines and settings pages. A step-by-step path with one clear next action is uncommon.

## 2. Direct posting: what each platform requires

| Platform | Is direct posting possible? | What it needs | Restriction until approved | Source |
| --- | --- | --- | --- | --- |
| TikTok | Yes (Content Posting API, Direct Post) | TikTok developer app, Login Kit, `video.publish` scope | **Unaudited apps post only `SELF_ONLY` (private), to private accounts, up to 5 users a day.** An audit is required for public posts. Apps must not add their own branding or watermark to shared content | [Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post), [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines) |
| YouTube (Shorts) | Yes (`videos.insert`). There is no separate Shorts endpoint: vertical or square videos up to 3 minutes count as Shorts | Google Cloud project, OAuth, `youtube.upload` scope | **Unverified projects created after 28 July 2020 can only upload private videos.** A compliance audit is needed for public uploads | [videos.insert](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert), [outstand.so quota summary](https://www.outstand.so/blog/youtube-api-pricing-quota) |
| Instagram Reels | Yes (Content Publishing API) | Instagram professional (Business or Creator) account, Meta app, `instagram_business_content_publish`; app review to post for accounts you don't own; media fetched from a public URL | 100 API posts per account per 24 hours | [Meta Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing) |
| Facebook Reels | Yes (Reels Publishing API) | A Facebook Page (not a personal profile) and `pages_manage_posts` | Reels must be 3 to 90 seconds | [Meta Reels Publishing API](https://developers.facebook.com/documentation/video-api/guides/reels-publishing) |

**Where Context Desk stands (checked in the code):** `lib/social-publishing.js` implements YouTube and TikTok OAuth and upload, but has never been run against real accounts (`docs/SOCIAL-CONNECTIONS.md`). Instagram and Facebook are deliberately unsupported. The always-available path is **download, then the platform's upload page opens**. The app must never call that a successful post.

**Proposal:** keep download-and-open as the default for beginners. Each direct connection needs your own developer app, credentials and the platform's review. Until then, posts land as private, which beginners would read as failure.

## 3. Platform branding rules

- **YouTube:** use only the official logos and icons, unmodified, on a solid background. The icon is allowed in a panel of social icons, but never as the most prominent element, and never implying endorsement. [YouTube API branding guidelines](https://developers.google.com/youtube/terms/branding-guidelines), [brand.youtube](https://brand.youtube/)
- **Instagram:** use only assets from Meta's Brand Resource Center. Downloading the logo pack requires accepting Meta's terms. Don't make Instagram the most prominent element, and **don't show other social networks in the same spot as Instagram or Facebook** except in a general "Follow us on…" call to action. [Meta Instagram brand guidelines](https://www.meta.com/brand/resources/instagram/instagram-brand/)
- **TikTok:** no app branding on content shared to TikTok. [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)

**Decision (proposal):** the export picker uses the platform **names** descriptively, plus our own neutral artwork (frame shape, safe area, length limit). It does not use platform logos side by side, because that conflicts with Meta's rule, and the logo packs need terms accepted by the account owner. If you accept the terms and download the official assets, each tile has a slot where they can go.

## 4. Safe areas (third-party measurements, not official)

On a 1080×1920 TikTok frame, keep text out of about the top 108 px, bottom 320 px, left 60 px and right 120 px. A common cross-platform rule is a centred box of about 900×1160 px, with the bottom roughly 480 px avoided. [reformat.video](https://reformat.video/tools/tiktok-safe-zone), [bytecap.io](https://www.bytecap.io/blog/short-form-video-safe-zones-ui-overlays). Context Desk already keeps bottom captions 22% above the bottom edge on vertical video (`public/brand-kit.js`).

## 5. Priorities

1. **Guided beginner path:** add video, pick a clip, check the English subtitles, prepare the post. One clear next action at each stage, with advanced controls folded away. (Built in this change.)
2. **Destination picker with honest posting status:** tiles show the frame, length limits and what "post" really means for each platform, plus a phone-frame post preview with the safe area. (Built in this change.)
3. **Arabic dialect accuracy, speakers and overlap:** already built and merged in PR #4 (dialect-faithful English, uncertain lines flagged, editable speaker tracks, two-speaker layout, clean and accessible exports).
4. **Real direct posting:** needs your developer apps, credentials and platform reviews. Not something to switch on for beginners yet.
