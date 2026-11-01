---
name: Context Desk V2
description: A quiet production desk for source-linked video decisions.
colors:
  canvas: "#0c1015"
  surface: "#131a22"
  surface-raised: "#1b2530"
  line: "#303c49"
  text: "#f1f3f5"
  muted: "#adb8c5"
  accent: "#ffb283"
  accent-ink: "#21150e"
  success: "#77d8b7"
  danger: "#ff9b9b"
  focus: "#ffd2af"
  control-hover: "#273340"
  checked-window: "#536273"
  control-pressed: "#354252"
  media-black: "#000"
typography:
  brand:
    fontFamily: "Manrope, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.03em"
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  panel-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
  metadata:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  panel: "12px"
  control: "7px"
  map: "8px"
  thumbnail: "6px"
  interval: "4px"
spacing:
  tight: "4px"
  compact: "8px"
  control-gap: "12px"
  panel-inset: "16px"
  inspector-inset: "18px"
  workspace-gap: "20px"
  section: "24px"
  desktop-gutter: "28px"
  shell: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.accent-ink}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-secondary-active:
    backgroundColor: "{colors.control-pressed}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "12px"
  navigation-count:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.interval}"
    padding: "2px 6px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  map-window-suggested:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.interval}"
    height: "24px"
  caption-editor:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "9px"
---

# Design System: Context Desk V2

## Overview

**Creative North Star: "The Source-Linked Production Desk"**

Quiet charcoal chrome gives real video the brightest, largest working surface. Warm peach marks actions, source links and suggested intervals; editing controls remain compact and readable. Creative decisions stay tied to source time, inspectable evidence and honest gaps.

The operating sequence is source → discover → review → edit → export. One navigation and a project/save strip orient the working screens. Discover pairs the source monitor with a real time axis and coverage lanes; Studio pairs its viewer with trim work and caption correction. This is an operating application: existing media, edit and queue controllers retain ownership of their controls.

The user-authorized V2 replaces the former lilac/plum/lime identity. Its visual authority is the selected 12ui B concept and expanded screen family, adapted to the real app. No Impeccable concept seed or roll was run. The direction and comparison evidence are recorded in [V2 visual research](docs/V2-VISUAL-RESEARCH.md).

**Key Characteristics:**

- Video-led workspaces with restrained charcoal boundaries.
- Peach source/action signals and mint acknowledged completion.
- Readable functional sans with a locally hosted Manrope wordmark.
- Source-derived frames, actual time and visible coverage gaps.
- One compact navigation with contextual editing disclosures.

## Colors

The palette is a dark production environment with one warm action accent and separate semantic feedback colors. Frontmatter values mirror the source CSS; descriptive names below explain use rather than create another palette.

### Primary

- **Warm Peach** (`accent`): Add video, import, scan, playback and export actions; source links; suggested map intervals and the trim selection.
- **Peach Ink** (`accent-ink`): dark text against peach-filled controls and suggested intervals.
- **Light Peach** (`focus`): keyboard outlines, link hover and the import/Add video hover fill.

### Secondary

- **Acknowledged Mint** (`success`): acknowledged save, available API state and completed project state; no decorative telemetry.
- **Review Rose** (`danger`): save conflicts, flagged captions, source warnings and job errors.

### Neutral

- **Desk Charcoal** (`canvas`): document, map track and thumbnail fallback background.
- **Panel Charcoal** (`surface`): working panels, Library rows, Jobs and Settings.
- **Raised Charcoal** (`surface-raised`): fields, secondary buttons and selected/current rows.
- **Quiet Boundary** (`line`): single-pixel panel borders, dividers, progress tracks and resting scrollbar thumbs.
- **Working White** (`text`): primary interface text.
- **Timecode Grey** (`muted`): labels, descriptions, metadata and time axes.
- **Control Hover** (`control-hover`) and **Control Pressed** (`control-pressed`): neutral button state fills.
- **Checked Steel** (`checked-window`): checked map intervals and legend swatches; also the neutral hover border.
- **Media Black** (`media-black`): video/canvas letterboxing and export previews.

**The Source Signal Rule.** Peach connects an action or a source-linked selection to the current task; it is not a substitute for video or evidence.

**The Acknowledgement Rule.** Mint and rose report actual application state. Color is accompanied by status text, labels or the relevant control state.

## Typography

**Brand Font:** locally hosted Manrope, falling back to the functional sans stack. The variable font is served from `public/assets/fonts/Manrope.ttf` under the accompanying SIL Open Font License 1.1.

**Body and Heading Font:** system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif. Functional system sans is an explicit choice for this production application. There is no separate mono family; time axes, numeric fields and playback time use tabular numerals where implemented.

**Character:** compact, direct and task-focused. The brand has a distinct face; controls and source/caption text prioritize recognition and editing comfort.

### Hierarchy

- **Brand:** frontmatter `brand`; reduces to 18px at the compact shell breakpoint. Its 12px tagline uses the body stack and disappears when shell space tightens.
- **Display:** frontmatter `display`; confined to the Add video entry heading, reducing to 34px on mobile.
- **Headline / Title / Panel title:** frontmatter roles describe the base heading ramp. Discover and Studio remove their redundant visible page headings; working panel labels remain compact. Map, scan and job headings use local 17px variants.
- **Body:** frontmatter `body`; paragraphs are limited to 75ch unless a working surface explicitly needs full width.
- **Label / Metadata:** frontmatter roles; controls and metadata recur at 12–14px. Caption text areas use 14px/1.5 on desktop and 16px on mobile.
- **Project name:** editable 20px, weight 600, reducing to 16px on mobile; its transparent resting field belongs to the project strip.

**The Working Type Rule.** Reserve Manrope for the wordmark. Use the functional sans for headings, labels, evidence and editing; do not extend the brand into a decorative display treatment.

## Layout

The document owns vertical scrolling. The centered shell has a maximum width of 1660px and desktop horizontal gutters from `desktop-gutter`; the header is at least 78px tall. The main working grid uses a flexible video column and a 350px Discover rail or 330px Studio inspector, separated by `workspace-gap`. The project title and acknowledged save state sit directly above the active work.

Desktop Discover gives the source viewer a height of `min(45vh, 480px)` with a 220px minimum. Studio uses `min(42vh, 440px)` with the same minimum, keeping transport and trim work nearby. These measured viewer rules take precedence over the earlier unrestricted aspect-ratio defaults. Media is contained rather than stretched; sampled thumbnails may crop to fill their small frames.

The recurring spacing steps are in frontmatter. They coexist with observed compact control values such as 6px label gaps, 10px field padding and 14px toolbar spacing; the implementation is not a rigid single-step grid.

- **At 1100px and below:** the shell tightens, the tagline hides, Discover's rail becomes 310px and Studio's inspector becomes 300px. Job actions wrap beneath their content.
- **At 900px and below:** navigation wraps to its own header row, workspaces become one column, gutters become 20px, and the queue loses its desktop height bound. Discover moments and Library grid each use two columns.
- **At 600px and below:** gutters become `panel-inset`, navigation/control groups wrap, moments and Library grid become one column, import and export actions stack, and the Library toolbar uses two columns with full-width search. Caption text grows for editing comfort.
- **Above 900px:** the Discover rail and Studio inspector are sticky at 16px; queue/caption lists may scroll within bounds. The Studio inspector's caption list is capped at 280px. Other caption lists retain their 350px bound.

**The Single Desk Rule.** Keep one workspace navigation and one representation of each owned control. Move existing controls to their context rather than cloning them into a second rail or settings surface.

## Elevation & Depth

Depth comes from dark tonal layering, one-pixel boundaries and media black. Panels and cards carry no ambient elevation shadow. Native Settings uses a dark backdrop and a sticky panel heading; neither glass nor blur is part of the material system.

### Shadow Vocabulary

- **Media overlay legibility** (`text-shadow: 0 1px 4px #000`): protects source-overlay text against footage.
- **Crop surround** (`box-shadow: 0 0 0 999px #0005`): dims the area outside the selected source crop; this is a functional mask, not panel elevation.
- **Settings backdrop** (`background: #000a`): separates the native modal from the work underneath.

**The Flat Workspace Rule.** Use tonal surfaces and borders for grouping. Reserve shadow-like treatments for readable media overlays and crop masking.

## Shapes

Panels use `panel` corners, controls use `control`, and the coverage track uses `map`. Small source thumbnails use `thumbnail`; interval buttons and navigation-count badges use `interval`. The timeline filmstrip has a local 5px corner and its selection bar a 2px corner. These small differences follow the working object rather than making every surface a pill.

One-pixel quiet borders define fields, panels and rows. The source crop uses a two-pixel peach edge. The brand symbol is three rounded diagonal strokes authored as interface vector geometry; action icons are local inline SVG strokes, not text glyphs.

## Components

### Buttons

Compact, readable controls with a 40px base minimum height, weight 600 and `control` corners. Primary import uses the frontmatter peach variant; secondary uses raised charcoal, hover and pressed fills. Settings is a muted ghost control. Some dense moment actions use a 34px minimum, while workspace navigation uses 48px on desktop and 40px on mobile.

Keyboard focus is a two-pixel light-peach outline offset by four pixels. Base buttons transition background, color and border-color over 120ms; disabled buttons use 0.45 opacity and a not-allowed cursor. Variants preserve their selector-specific hover behavior: import and Add video lighten, while several primary editing actions retain their peach fill under the shared hover border.

### Cards / Containers

Working panels are flat `surface` containers with `panel` corners and a quiet border. Panel headings use 14px by 16px padding. Library rows use 16px padding and 18px internal gaps; their grid mode uses 12px padding. Job rows use 22px padding with 24px gaps, reducing to 16px on mobile. Selected moment rows and current captions use `surface-raised` instead of a lifted shadow.

### Inputs / Fields

Raised charcoal fields use the frontmatter input style, muted placeholders and a peach caret. Labels are visible; search has a programmatic label where visually hidden. Native select popups remain platform-owned. Numeric trim fields provide the alternative to range controls; the input style does not imply that pointer dragging is required.

### Navigation

One horizontal, wrapping navigation contains Library, Discover, Studio, Jobs and the separate Add video action. Ordinary items are muted and transparent; `aria-current` selects a panel-charcoal surface with peach text. Small count badges use raised charcoal and compact corners. Grid/List and inspector tabs expose selected state through `aria-pressed`; the former uses peach fill, the latter raised charcoal with peach text.

### Moment Map

A real time axis sits above source-window intervals. Suggested windows are peach; checked windows are steel; unchecked windows have dashed borders, and unreviewed source gaps stay visible. The track supports actual overlapping lanes, a 24px interval height and bounded scrolling up to 220px. The adjacent retained-moment list remains the touch/keyboard alternative and separates Watch source from Edit. Neither fictional waveforms nor engagement scores define this component.

### Studio Timeline and Captions

The timeline filmstrip uses actual sampled source frames or a frame-unavailable label. A peach selection bar and paired Start/End ranges accompany numeric In/Out inputs. Playback, trim and source-context review remain close to the viewer.

The inspector defaults to Captions, with Story & evidence as a peer tab. Timestamp buttons sit beside editable text; uncertainty flags use rose and source comparison remains available. Timing, dialect and advanced tools are disclosed below essential caption work. The base caption text area has 9px padding and a 76px minimum height.

### Settings, Progress and Motion

Native Settings is at most 740px wide and no wider than the viewport minus 32px, with a maximum height of the dynamic viewport minus 48px. It contains the single speech/scan controls; quick language controls are moved into it and returned when it closes. Native dialog behavior supplies focus containment and Escape dismissal.

Progress bars represent actual work. Only the real processing indicator rotates (one second, linear); no invented ETA or decorative scan telemetry is introduced. Reduced-motion disables animation, smooth scrolling and transitions. Scrollbars use the canvas/line/muted/text sequence with standard and WebKit styling; forced colors restores platform scrollbar colors and explicit map/control boundaries.

## Do's and Don'ts

### Do:

- **Do** keep source video, actual time and the current editorial task prominent.
- **Do** use peach for actions and source-linked selections, mint for acknowledged state, and rose for review or errors.
- **Do** keep labels, numeric trim alternatives, source context and uncertainty visible or directly reachable.
- **Do** use one navigation and retain canonical controls when adapting layouts.
- **Do** use source-derived media or an explicit unavailable/empty state.
- **Do** preserve native dialog/select behavior, keyboard focus and reduced-motion support.

### Don't:

- **Don't** restore the superseded plum/lilac/lime identity or add gradients, glow, glass, decorative pill eyebrows or oversized italic serif display type.
- **Don't** invent avatars, accounts, notifications, statistics, scan percentages, waveforms or fictional footage to fill the interface.
- **Don't** turn sampled coverage into a claim that unseen source has been reviewed.
- **Don't** use color alone for status or replace editable numeric controls with pointer-only handles.
- **Don't** add ambient card shadows or a redundant navigation rail.

## Runtime ownership and tokens

**Model B:** `public/style.css` is the canonical runtime token owner. Frontmatter mirrors its actual custom properties and reused declarations; this document does not generate CSS. Semantic frontmatter keys `canvas` through `focus`, `rounded.panel` and `rounded.control` mirror the corresponding root properties (`--radius` and `--control-radius` for the latter two). The additional neutral state colors, type roles and spacing/radius steps are extracted from reused declarations in that same file. `public/layout.js` supplies the working shell and component arrangement. There is no build-time theme generator or competing runtime token file.

`.impeccable/design.json` extends this record with source-grounded component previews, focus/motion/depth/breakpoint details and matching narrative. Its synthesized eight-step color ramps are panel visualization aids, not additional runtime palette tokens.

## Artwork and provenance

Original prior studio artwork remains documented in `public/assets/ARTWORK.md` but is not used over source footage. V2's small geometric brand/map illustration is authored as interface vector geometry. No competitor screenshots, their logos, generated fictional footage or the illustrative screenshot's television photo are served as app media. Private recordings, transcripts and local design outputs remain ignored. Screenshots show explicitly named QA data when no permissioned editorial source is available. Manrope's local font and license are in `public/assets/fonts`.

## Behaviour and verification

See `UX-CONTRACT.md` for canonical owners, state/feedback/navigation rules and architecture exceptions. Every visible action must work. Selection/edit/project state stays with existing controllers; these are not static prototype screens. Verification evidence and limits belong in `docs/V2-VERIFICATION.md`; documentation of source styles does not certify browser behavior, accessibility, dialect accuracy, live reliability or competition readiness. Suggested viewport checks remain 1440, 1280, 768 and 390px.

**Not canonized:** source-specific overrides and dense-control exceptions are described only where observed; no broader craft or behavior certification is inferred from this code-only documentation pass. The former wordmark description (system sans only) and “mobile panes use natural height” statement were stale: the built wordmark is Manrope and caption lists retain a height bound.
