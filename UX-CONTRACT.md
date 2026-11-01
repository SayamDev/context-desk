# Context Desk interaction contract

V2 product workspace; English interface with multilingual/RTL source text. Existing project/media/job APIs and recovery invariants take precedence over visual convenience.

## Canonical owners

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|
| Select/Listbox | Native HTML select; public/app.js handlers | UX-CONTRACT.md | OS/browser owns popup, typeahead and geometry; no authored popup promise | Browser keyboard/open-state checks |
| Form | Canonical controls in public/index.html, public/app.js | UX-CONTRACT.md | Explicit URL validation in the import handler (novalidate), with associated inline server errors. Retain input after failure; prevent duplicate active imports | Import/error checks |
| Scrollbar | public/style.css global semantic tokens | DESIGN.md | Visible standard and WebKit styles, forced-colours fallback | Computed-style and narrow viewport checks |
| Toast | Existing activityPanel, saveStatus, per-workflow status nodes | UX-CONTRACT.md | Persistent contextual live regions; no duplicated transient toast provider | Existing status/regression and browser checks |
| CRUD | public/projects.js + lib/projects.js + SQLite | UX-CONTRACT.md | Revision-checked saves, recoverable Trash, separate conflict recovery, explicit missing-media relink | Project/session recovery tests |
| Settings | Canonical speech/scan controls moved once into native dialog | One live copy, immediate edits, Escape/Close returns focus; saved via existing project settings | Dialog keyboard and reload checks |
| Timeline/editing | public/app.js + public/history.js | One local/source clock transform; numeric trim fields and pointer alternatives; button edits use performEdit | Timing/history/action/trim tests and real export |
| Search/filter | public/studio-ui.js and existing Library API | Retained source text only; selected clip unaffected; no hidden paid calls | Search/filter tests, stale-library guard |
| Navigation | Existing workspace enum + showWorkspace | Library / Discover / Studio / Jobs; source is Add video. Preserve legacy stored values | Refresh/session tests and UI navigation |

No table selection or date-entry capability is used. Dates are display-only. Local Library search/sort preferences live in SQLite rather than URL because the app is a private single-computer workspace. Grid/list is a presentation preference, never a new project state.

## Flow and state ledger

- Import: Add video → URL/file + language → named preparation state → Discover. Failed sources retain the URL with an inline next action; browser tab sharing requires user selection. No fabricated determinate progress/ETA.
- Open project: Library → loading feedback → Discover; failure keeps existing ownership and presents the error. Search/sort remain restorable; stale list responses cannot replace a newer query.
- Select moment: review source from Discover or open Studio. Source review never triggers analysis or claims live history is seekable. Clip selection drives all caption/framing/export fields.
- Edit: immediate preview + debounced save, acknowledged Saved only after the server. Undo/Redo are session-local; durable clip edits survive refresh. Background completion merges human changes and stays with its original project.
- Captions: changing language may initiate translation; cached translations are reused. Text/timing edits invalidate review. Export with captions stays blocked until review/uncertainty is resolved. Keep raw source transcript separate from translated edits.
- Export: stable queued/rendering/completed/error state in Jobs, actual saved download and finished preview. No publishing claim. Polling preserves mounted completed preview players.
- Trash/recovery: reversible Trash needs no extra modal; restore is a separate action. Conflict copies restore as separate projects. No permanent deletion added.
- Dialog: native showModal supplies modal focus containment/inert background and Escape; explicitly return focus to the opener. Long forms scroll inside a bounded dialog with reachable actions.

## Responsive and accessibility

Document owns vertical scroll; bounded results/cue panes may scroll on desktop, then grow naturally on mobile. Primary targets at least 40px, functional type at least 12px, labelled native controls, semantic buttons/links, strong visible focus and text status in addition to colour. Source order is video → map/transport → results on mobile. No destructive transition is hidden behind a card click. Reduced motion disables animation and smooth scrolling. Keep source wording dir=auto and caption text RTL-capable.

## Evidence and limitations

Baseline source and 55 tests: docs/V2-BASELINE-AUDIT.md. New acceptance evidence belongs in docs/V2-VERIFICATION.md. A static design audit is not a substitute for browser/media tests, native-language review or actual sustained live testing. No general WCAG certification is claimed.
