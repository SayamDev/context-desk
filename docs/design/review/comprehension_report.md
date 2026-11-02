# Comprehension Report

**Target:** `docs/design/server-code-sync.md` — FeatureRange lines 1-86, DetailedRange lines 87-108.
**Reviewer:** `egm-comprehension` (fresh context). Status: completed.

### What this proposes

The document makes two changes. First, `npm run dev` now starts the server in Node's watch mode, which restarts it whenever a file the server imports changes. Editing files the server only sends to the browser does not cause a restart. Second, at startup the server lists every JavaScript file it loaded by following relative imports from `server.js`, and saves those files' modification times as a "startup stamp". Each `GET /api/status` works the stamp out again and returns `codeStale: true` if it has changed. When the page loads, the app checks that flag and shows a banner telling the user to stop the server and run `npm run dev`. `npm start` stays a plain `node server.js`.

### How the existing system works, per this document

Context Desk is a single Node process (`server.js`). It serves the browser app from `public/` with `no-store` caching, so the browser gets fresh files on every refresh. It also runs an API from `lib/`, which imports some shared `public/*.js` modules. The server's own code is loaded once, at startup. So when files change on disk while the server keeps running, a refresh pairs new browser code with an old server. In the incident described, this caused 404s for frame and font routes, and project saves quietly dropped newer clip fields. Long-running export, subtitle and discovery jobs save checkpoints to SQLite and resume after a restart. A "live buffer" recording is kept in memory and ends on restart.

### Findings

1. **Major** — Stale-code detection (54-63) vs automatic restart (43-52): the document never says when the banner can appear. Under `npm run dev`, watch mode should keep `codeStale` false almost always. A reader has to infer that the banner covers `npm start`, servers started before this change, and the window before a restart finishes. The banner's "run npm run dev" also sits oddly next to the non-goal that `npm start` stays plain (39).
2. **Major** — Restart side effects (50-52, 81-82): it doesn't say what happens to an in-progress live buffer recording (kept, partly saved or lost), and "section" is undefined for export, subtitle and discovery jobs. That undercuts the banner's "Your work is saved".
3. **Major** — Import scan (65-66) vs risks (79-80): the regex also matches bare side-effect imports (`import './x.js'`). The document doesn't say that only `./` or `../` paths ending in `.js` count, so the risk on line 79 can't be judged.
4. **Nit** — Undefined project terms: live buffer, discovery jobs, Studio, timeline filmstrip, emoji accents, and the clip fields `cuts`, `hookVariants`, `captionAccents`, `splitCam`.
5. **Nit** — Plan step 2 (92) says "After `port`", a variable the document never introduces.
6. **Nit** — Plan step 3 (95) uses `status()` without saying it runs once per page load, which lines 83-85 depend on.
7. **Nit** — Verification (106-107): the four-refresh test has no stated link to a goal and ran on a fresh server, and the "2 skipped" tests have no reason given.
8. **Nit** — Lines 9-11 and 46 use different phrases for the same set of server-imported `public/` modules, which matters for Goal 3.

### Overall

The gaps are in explanation, not wording. No Blockers. The main gap is finding 1.
