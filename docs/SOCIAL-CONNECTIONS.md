# Social connections and publishing foundation

Verified against accessible official sources on 1 November 2026. This implementation has been tested with local fixtures and fake provider transports. No real authorization, account lookup, upload or post was performed.

## Supported boundaries

| Provider | Connection | Local video upload | Media import |
| --- | --- | --- | --- |
| YouTube | Authorization Code + PKCE; channel identity checked | Documented resumable upload initialization followed by a streamed PUT; explicit visibility and audience declarations | Not implemented. OAuth/account metadata does not provide a video-download entitlement or endpoint. |
| TikTok | Desktop Login Kit with its documented SHA256 **hex** PKCE challenge; optional Web Login Kit | Documented Direct Post `FILE_UPLOAD`, sequential chunks and status polling; creator information checked before draft and publish | Not implemented. |
| Instagram | Explicitly unsupported in this implementation | Explicitly unsupported. Meta's verified Reels example requires professional-account eligibility and publicly accessible `video_url`; no approved public-media hosting exists here. | Not implemented. |
| Facebook | Explicitly unsupported in this implementation | Current Page OAuth/upload/version/permission contracts could not be verified from accessible official documentation. No guessed endpoints are called. | Not implemented. |

Manual saved-video downloads and the existing platform handoff work independently of every connection. Connecting an account does not post anything.

The YouTube adapter starts a resumable session, but automatic network retry/resume is deliberately absent: an interrupted publish has an ambiguous remote outcome and requires a provider-account check. It must never be replayed by a background job. The YouTube response distinguishes requested visibility from the value actually returned. TikTok remains `processing` until its documented status endpoint reports completion; no synthetic TikTok post URL is produced.

## Configuration

Set credentials only in the server environment, never in project settings, browser storage, frontend bundles or source control.

```dotenv
YOUTUBE_CLIENT_ID=<Google OAuth web application client ID>
YOUTUBE_CLIENT_SECRET=<Google OAuth client secret>
YOUTUBE_REDIRECT_URI=http://127.0.0.1:3030/api/social/callback/youtube

TIKTOK_CLIENT_KEY=<TikTok developer application client key>
TIKTOK_CLIENT_SECRET=<TikTok developer application client secret>
TIKTOK_LOGIN_MODE=desktop
TIKTOK_REDIRECT_URI=http://127.0.0.1:3030/api/social/callback/tiktok

# Leave unset until the actual account workflow and review screen are ready.
CONTEXT_DESK_SOCIAL_PUBLISHING_ENABLED=1

# Set only after the app actually passes TikTok's Direct Post audit.
TIKTOK_APP_AUDITED=1
```

The port and URI must match the local server and exact registered provider callback. Use the same browser host (for example, consistently 127.0.0.1 rather than switching between it and localhost), so the private session cookie reaches the callback. Missing credentials/redirects disable connection. `configured` means the required values and callback syntax are present; it does not mean a provider has accepted the app or account.

YouTube requires an enabled YouTube Data API v3 project, OAuth consent configuration, eligible test users/access, and any applicable Google verification. Requested scopes are `youtube.upload` and `youtube.readonly`; the latter identifies the exact channel. Multiple returned channel identities are rejected instead of selecting one silently. Uploading requires explicit `private`, `unlisted` or `public`; neither the API default nor a UI default chooses this for the user.

TikTok requires approved Login Kit and Content Posting API / `video.publish` access. Desktop callbacks must use localhost or 127.0.0.1 with an explicit port. Web mode requires a registered static HTTPS callback and an explicitly arranged deployment/proxy; localhost HTTP is not silently upgraded or exposed. Desktop PKCE uses the **hexadecimal** SHA256 encoding specified by TikTok, while Google's challenge uses base64url. No credentials are obtained merely by installing this app.

Unaudited TikTok clients are restricted to eligible private creator accounts and `SELF_ONLY`. The adapter enforces these restrictions unless `TIKTOK_APP_AUDITED=1` is explicitly supplied. That environment flag records an operator assertion; it is not proof that TikTok granted approval. TikTok also states that Direct Post clients should serve a broad audience and must not be only an internal/team account-upload utility. Product eligibility and audit acceptance remain external prerequisites.

Reserved Meta environment names are reported as setup hints only: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`. Supplying them does not enable unsupported adapters. A future Meta integration needs a separately verified login path, account eligibility, least-privilege permissions, reviewed API version and approved media-transfer mechanism. This work does not publish localhost assets or provision public hosting.

## Integration API

```js
import {createSocialPublishingService} from './lib/social-publishing.js';
const social = createSocialPublishingService({store});
```

Available methods:

- `status()`, `accounts()`, `drafts(projectId?)`, `getDraft(id)` return safe public snapshots.
- `beginAuthorization(provider, {sessionId})` returns `{authorizationUrl, expiresAt}`; it does not contact the provider.
- `handleCallback(provider, {url, sessionId})` validates and consumes state, exchanges the code, verifies account identity and saves encrypted tokens. Pass the actual callback URL reconstructed from the **configured** callback origin and observed request path/query, never an arbitrary client-supplied callback URL.
- `getCapabilities(accountId)` refreshes authorization when needed and reads current provider capabilities. TikTok's upload page must display the returned creator name, visibility options, duration limit and interaction restrictions.
- `createDraft({projectId, exportId, accountId, metadata})` binds a completed, saved project export. Alternatively use `assetUrl`, which must already be a saved export of the selected project. Arbitrary URLs, source recordings and unrelated assets are rejected. The actual local media hash, bytes, decoded duration, account identity, connection version and exact metadata are bound to review.
- `issueConfirmation(draftId, {sessionId})` returns `{draft, confirmationToken, expiresAt}`. The token lasts 60 seconds and authorizes only that exact reviewed draft in that browser session.
- `publish({draftId, confirmationToken, sessionId, confirmed:true})` consumes confirmation before creating any upload session or sending media. Duplicate/concurrent calls cannot replay the same confirmation/draft. Provider/network failures become `needs-attention`; they do not automatically upload again.
- `poll(draftId)` reads a TikTok attempt's status; it does not re-upload.
- `disconnect(accountId)` removes this app's local authorization and invalidates draft confirmations. It returns `providerRevoked:false`: provider-side revocation is a separate user action. It cannot retract bytes already sent or an upload already completing remotely.

`sessionId` must be a server-generated high-entropy value (at least 24 characters), carried through a private HttpOnly SameSite cookie. Never accept it from a client request body. It binds OAuth callbacks and publishing confirmation to the same browser. Keep these routes on the authenticated local server, enforce exact same-origin checks for mutations, reject untrusted Host/Origin headers and set no-store on account/draft/confirmation responses. Do not expose this single-user service through an unauthenticated public tunnel.

The parent HTTP wrapper uses these envelopes:

```text
GET  /api/social/status                    -> {providers:social.status(), accounts:social.accounts()}
POST /api/social/authorize {provider}      -> beginAuthorization(...)
GET  /api/social/callback/:provider        -> handleCallback(...), then local redirect
POST /api/social/capabilities {accountId}  -> getCapabilities(...)
POST /api/social/drafts {projectId,exportId,accountId,metadata} -> createDraft(...)
POST /api/social/confirm {draftId}         -> issueConfirmation(...)
POST /api/social/publish {draftId,confirmationToken,confirmed:true} -> publish(...)
POST /api/social/disconnect {accountId}    -> disconnect(...)
```

The route wrapper supplies session IDs; the browser never sees access/refresh tokens, PKCE verifiers or encrypted upload-session URLs.

## Required metadata and final review

YouTube draft metadata:

```js
{title, description, visibility, madeForKids, containsSyntheticMedia,
 tags: [], notifySubscribers: false}
```

`madeForKids` and `containsSyntheticMedia` must be explicitly chosen booleans. `visibility` must be explicitly chosen. Notifications are off unless the user turns them on. Title, description and tags remain editable before draft creation; changing them requires a new exact draft/confirmation.

TikTok draft metadata:

```js
{title, visibility, allowComment:false, allowDuet:false, allowStitch:false,
 commercialDisclosure:false, brandOrganic:false, brandContent:false,
 musicUsageAccepted:false, brandedPolicyAccepted:false}
```

Privacy has no default and must be among the creator's latest options. Interaction switches start off and cannot override creator restrictions. Commercial disclosure requires the appropriate brand selection. Branded content cannot silently switch private visibility to public; the user must choose a permitted visibility. Final confirmation requires the applicable Music Usage and Branded Content acknowledgements. Show the actual saved-video preview, creator/channel name, caption, visibility, disclosure and audience declarations before requesting confirmation; sending video bytes is an explicit final user click only.

For TikTok, link the official [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en) and [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) in that consent surface. The disclosure wording and full UX must be checked against the current official guidelines during provider review. This implementation does not claim provider certification.

## Credential and transport protections

Access tokens, refresh tokens, OAuth PKCE verifiers and resumable upload URLs use AES-256-GCM records with record-ID associated data. The random 32-byte key is `.social-token-key` in the private data root, mode 600, created lazily. It never enters project JSON or SQLite. Keep that file and the database private and backed up together. This protects against accidental database-only disclosure; it is not an OS keychain and does not protect against malware with access to both the key and database. Missing/corrupt keys fail closed; they are not silently regenerated over encrypted records.

OAuth states and confirmation tokens are random, short-lived, hashed in public records, session-bound and single-use. Provider response bodies and transport exceptions are not echoed into browser errors. Tokens refresh only when needed; refresh operations are shared per account and cannot resurrect a disconnected/reconnected account.

Uploads read only verified, content-addressed, regular local export assets and stream media without buffering the full video. Provider-returned upload locations are HTTPS, exact-host/path allowlisted, and redirects are forbidden. Google upload locations are limited to the documented `www.googleapis.com` upload path. TikTok upload locations are limited to the documented `open-upload.tiktokapis.com` and `upload.us.tiktokapis.com` video/upload paths. Unknown regional hosts fail closed until explicitly verified. No arbitrary remote media URLs are accepted or fetched. A TikTok final chunk must return the documented 201 acknowledgement; earlier chunks require 206.

## Verification

Run `node scripts/test.js social-publishing`. Tests use temporary SQLite stores, generated synthetic token values, tiny saved local export fixtures, an injected media probe and fake transports. They cover encryption, state/session/PKCE/callback checks, ownership/hash binding, visibility, token refresh, exact-draft single-use confirmation, concurrent replay, unsafe upload URLs, TikTok FILE_UPLOAD/chunks/status and ambiguous restart handling. No test calls a real social service.

No live OAuth flow, real account identity, provider quota, app approval, public media host or real published post has been verified. YouTube/TikTok upload transports are implemented against documented contracts and exercised with fakes; native account testing remains an explicit later user action.

## Primary sources

- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google PKCE recommendation](https://developers.google.com/youtube/data/guides/auth/client-side-web-apps)
- [YouTube resumable upload protocol](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol)
- [YouTube videos.insert](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)
- [YouTube channels.list](https://developers.google.com/youtube/data/reference/rest/v3/channels/list)
- [TikTok Desktop Login Kit and hex PKCE](https://developers.tiktok.com/doc/login-kit-desktop)
- [TikTok Web Login Kit](https://developers.tiktok.com/doc/login-kit-web)
- [TikTok access and refresh tokens](https://developers.tiktok.com/doc/oauth-user-access-token-management)
- [TikTok Direct Post](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [TikTok creator information](https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info)
- [TikTok media transfer and chunk rules](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)
- [TikTok publishing status](https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status)
- [TikTok intended-use, privacy, consent and audit requirements](https://developers.tiktok.com/doc/content-sharing-guidelines)
- [Meta-owned Instagram Postman collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) confirms the professional account/Page/public-video requirements. Direct developers.facebook.com publishing pages returned HTTP 429 during this work; Facebook's full current contract remains unverified.
