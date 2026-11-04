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
    fontFamily: "Manrope, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "58px"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  display-mobile:
    fontFamily: "Manrope, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  home-section:
    fontFamily: "Manrope, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
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
  disclosure:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  metadata:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5

rounded:
  entry: "16px"
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
  entry: "48px"
components:
  activity-detail:
    typography: "{typography.disclosure}"
    rounded: "{rounded.control}"
    padding: "10px 0"
  home-start:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.entry}"
    padding: "48px"
  button-home:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "52px"
  inspector-tab-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 7px"
  caption-template:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px"
  caption-template-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
  studio-clip-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px"
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

Quiet charcoal chrome gives real video the largest working surface. Warm peach introduces the source on Home, then marks actions, source links and suggested intervals inside the working screens. Editing controls remain compact and readable; creative decisions stay tied to source time, inspectable evidence and honest gaps.

The operating sequence is source → discover → review → edit → export. Home presents a link field and Find clips action before preferences; one navigation and a project/save strip orient the working screens. Discover pairs the source monitor with a real time axis and coverage lanes. Studio places clip switching, footage and timeline, and one selected inspector task in three columns. Existing media, edit and queue controllers retain ownership of their controls.

The user-authorized V2 replaces the former lilac/plum/lime identity. Its visual authority is the selected 12ui B concept and expanded screen family, adapted to the real app. No Impeccable concept seed or roll was run. The direction and comparison evidence are recorded in [V2 visual research](docs/V2-VISUAL-RESEARCH.md). The feature expansion retains this world; its Home display and Studio topology are code-led extensions described in [the surface contract](docs/FEATURE-EXPANSION-SURFACE-CONTRACT.md), not a newly approved visual composition.

**Key Characteristics:**

- Video-led workspaces with restrained charcoal boundaries.
- Peach source/action signals and mint acknowledged completion.
- Locally hosted Manrope for the wordmark and Home hierarchy; functional sans for editing.
- Source-derived frames, actual time and visible coverage gaps.
- One compact navigation with contextual editing disclosures.

## Colors

The palette is a dark production environment with one warm action accent and separate semantic feedback colors. Frontmatter values mirror the source CSS; descriptive names below explain use rather than create another palette.

### Primary

- **Warm Peach** (`accent`): the Home source-launch surface; import, scan, playback and export actions inside the charcoal workspace; source links, suggested map intervals and the trim selection.
- **Peach Ink** (`accent-ink`): dark text against peach-filled controls and suggested intervals.
- **Light Peach** (`focus`): keyboard outlines, link hover and the import/Add video hover fill.

### Secondary

- **Acknowledged Mint** (`success`): acknowledged save, available API state and completed project state; no decorative telemetry.
- **Review Rose** (`danger`): save conflicts, flagged captions, source warnings and job errors.

### Neutral

- **Desk Charcoal** (`canvas`): document, map track and thumbnail fallback background.
- **Panel Charcoal** (`surface`): working panels, Library rows, Activity and Settings.
- **Raised Charcoal** (`surface-raised`): fields, secondary buttons and selected/current rows.
- **Quiet Boundary** (`line`): single-pixel panel borders, dividers, progress tracks and resting scrollbar thumbs.
- **Working White** (`text`): primary interface text.
- **Timecode Grey** (`muted`): labels, descriptions, metadata and time axes.
- **Control Hover** (`control-hover`) and **Control Pressed** (`control-pressed`): neutral button state fills.
- **Checked Steel** (`checked-window`): checked map intervals and legend swatches; also the neutral hover border.
- **Media Black** (`media-black`): video/canvas letterboxing and export previews.

**The Source Signal Rule.** Peach groups the source-entry task on Home and connects actions or source-linked selections to the current task inside the workspace. Actual footage and evidence remain source-derived.

**The Acknowledgement Rule.** Mint and rose report actual application state. Color is accompanied by status text, labels or the relevant control state.

## Typography

**Brand Font:** locally hosted Manrope, falling back to the functional sans stack. The variable font is served from `public/assets/fonts/Manrope.ttf` under the accompanying SIL Open Font License 1.1.

**Home Display Font:** locally hosted Manrope for the entry heading and Home section headings.

**Body and Working Heading Font:** system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif. Functional system sans is an explicit choice for this production application. There is no separate mono family; time axes, numeric fields and playback time use tabular numerals where implemented.

**Character:** direct and task-focused. Manrope establishes the brand and a clear entry hierarchy; functional controls, evidence and source/caption text prioritize recognition and editing comfort.

### Hierarchy

- **Brand:** frontmatter `brand`; reduces to 18px at the compact shell breakpoint. Its 12px tagline uses the body stack and disappears when shell space tightens.
- **Display:** frontmatter `display`; Home entry heading, with a two-line desktop composition and a 12ch maximum width. It reduces to 48px at 1100px and to `display-mobile` at 600px; line-height and tracking remain stable.
- **Home section:** frontmatter `home-section`; recent-project and empty-session headings, with the recent-project heading reducing to 22px on mobile.
- **Headline / Title / Panel title:** frontmatter roles describe the base heading ramp. Discover and Studio remove their redundant visible page headings; working panel labels remain compact. Map, scan and job headings use local 17px variants.
- **Body:** frontmatter `body`; paragraphs are limited to 75ch unless a working surface explicitly needs full width.
- **Disclosure:** frontmatter `disclosure`; Processing details and platform-upload summaries in Activity. Group headings reuse the existing 22px title step; the completed-history summary uses 16px and Queue overview uses 14px.
- **Label / Metadata:** frontmatter roles; controls and metadata recur at 12–14px. Caption text areas use 14px/1.5 on desktop and 16px on mobile.
- **Project name:** editable 20px, weight 600, reducing to 16px on mobile; its transparent resting field belongs to the project strip.

**The Working Type Rule.** Use Manrope for the wordmark and Home hierarchy. Keep the functional sans for working headings, labels, evidence and editing; caption-brand choices affect the media treatment rather than application chrome.

## Layout

The document owns vertical scrolling. The centered shell has a maximum width of 1660px and desktop horizontal gutters from `desktop-gutter`; the header is at least 78px tall. One navigation contains Home, Projects, Discover, Studio, Activity and New video. The project title and acknowledged save state orient active work rather than adding a second navigation.

Home's peach source-launch panel uses two columns (`1.16fr` and `.84fr`), a 48px gap and `entry` padding. The left column owns one link field and Find clips action, followed by secondary upload/live actions and a language/preferences disclosure. The right contains the actual current project, or clearly empty brand artwork. Recent projects form four source-image columns; they reduce to three at 1100px and two at 900px. At 900px the launch panel becomes one column and the right-hand session panel hides. At 600px, its padding becomes 24px by 20px, its corners become `panel`, and recent projects become horizontal image-and-copy rows.

Discover uses a flexible video column and a 350px rail separated by `workspace-gap`. Desktop Studio uses a 168px clip rail, flexible viewer/timeline and 340px inspector separated by 18px. Its inspector contains one selected task: Captions, Style, Story or Export. The clip rail and inspector are sticky at 18px, with viewport-bounded vertical scrolling. Above 900px the more specific Studio caption-list rule retains a 280px inner bound; the outer task inspector also scrolls within its viewport limit. At narrower sizes caption rows flow without that inner bound.

Desktop Discover gives the source viewer a height of `min(45vh, 480px)` with a 220px minimum. Studio uses `min(42vh, 440px)` with the same minimum, keeping transport and trim work nearby. Media is contained rather than stretched; sampled thumbnails crop only in their small frames.

The recurring spacing steps are in frontmatter. They coexist with observed compact values such as 6px label gaps, 10px field padding and 14px toolbar spacing; this is not a rigid single-step grid.

- **At 1200px and below:** Studio's columns become 132px / flexible / 310px with 14px gaps.
- **At 1100px and below:** the shell tightens, the tagline hides and Discover's rail becomes 310px. Activity uses two columns with actions beneath the title/progress content.
- **At 1000px and below:** Studio's clip rail becomes a horizontal strip above its two remaining columns. Clip buttons combine a 42px source image with title and timing.
- **At 900px and below:** navigation wraps to its own header row, Discover becomes one column, gutters become 20px, and its queue loses the desktop height bound. Studio retains a flexible viewer and 310px inspector until its own 760px breakpoint.
- **At 760px and below:** Studio becomes one column; the inspector follows the viewer and loses sticky positioning and its height bound. Volume and playback settings default to a closed disclosure, while essential transport remains visible.
- **At 600px and below:** gutters become `panel-inset`; five navigation destinations fit one row and New video hides, with import still directly accessible on Home. Discover moments, Projects grid and Activity become one column. Inspector tabs use 14px text and 44px targets, caption text becomes 16px, and export controls stack. The timeline, source-time ruler and trim inputs remain in the editor flow.

**The Single Desk Rule.** Keep one workspace navigation and one representation of each owned control. Move existing controls to their context rather than cloning them into a second rail or settings surface.

## Elevation & Depth

Depth comes from dark tonal layering, one-pixel boundaries and media black. Panels and cards carry no ambient elevation shadow. Native Settings uses a dark backdrop and a sticky panel heading; neither glass nor blur is part of the material system.

### Shadow Vocabulary

- **Media overlay legibility** (`text-shadow: 0 1px 4px #000`): protects source-overlay text against footage.
- **Timeline playhead** (`box-shadow: 1px 0 3px #0009`): separates the moving white source-position marker from sampled frames.
- **Crop surround** (`box-shadow: 0 0 0 999px #0005`): dims the area outside the selected source crop; this is a functional mask, not panel elevation.
- **Settings backdrop** (`background: #000a`): separates the native modal from the work underneath.

**The Flat Workspace Rule.** Use tonal surfaces and borders for grouping. Reserve shadow-like treatments for readable media overlays, the timeline playhead and crop masking.

## Shapes

The desktop Home source-entry surface uses `entry` corners; panels use `panel`, controls use `control`, and the coverage track uses `map`. Small source thumbnails use `thumbnail`; interval buttons and navigation-count badges use `interval`. The timeline filmstrip has a local 5px corner and its selection bar a 2px corner. These small differences follow the working object rather than making every surface a pill.

One-pixel quiet borders define fields, panels and rows. The source crop uses a two-pixel peach edge. The brand symbol is three rounded diagonal strokes authored as interface vector geometry; action icons are local inline SVG strokes, not text glyphs.

## Components

### Buttons

Compact, readable controls with a 40px base minimum height, weight 600 and `control` corners. Primary import uses the frontmatter peach variant; secondary uses raised charcoal, hover and pressed fills. Settings is a muted ghost control. Some dense moment actions use a 34px minimum, while workspace navigation uses 48px on desktop and 40px on mobile.

Keyboard focus is a two-pixel light-peach outline offset by four pixels. Base buttons transition background, color and border-color over 120ms; disabled buttons use 0.45 opacity and a not-allowed cursor. Variants preserve their selector-specific hover behavior: import and Add video lighten, while several primary editing actions retain their peach fill under the shared hover border.

### Cards / Containers

Working panels are flat `surface` containers with `panel` corners and a quiet border. Panel headings use 14px by 16px padding. Library rows use 16px padding and 18px internal gaps; their grid mode uses 12px padding. Job rows use 22px padding with 24px gaps, reducing to 16px on mobile. Their desktop grid bounds title, progress and actions with flexible minimum-width columns; every cell can shrink and long output labels wrap. Render/artwork previews use disclosures rather than widening the row. Selected moment rows and current captions use `surface-raised` instead of a lifted shadow.

### Inputs / Fields

Raised charcoal fields use the frontmatter input style, muted placeholders and a peach caret. Labels are visible; search has a programmatic label where visually hidden. Native select popups remain platform-owned. Numeric trim fields provide the alternative to range controls; the input style does not imply that pointer dragging is required.

### Navigation

One horizontal, wrapping navigation contains Home, Projects, Discover, Studio, Activity and New video, with stable hash destinations and browser history. The wordmark also returns Home. At 600px New video hides; Home retains the import field and upload/live actions. Ordinary items are muted and transparent; `aria-current` selects a panel-charcoal surface with peach text. Small count badges use raised charcoal and compact corners. Grid/List and the four inspector tabs expose selected state through `aria-pressed`; the former uses peach fill, the latter raised charcoal with peach text. Clip-switch buttons use a peach outline and a panel-charcoal current state.

### Activity & downloads

Activity is the visible destination label and Activity & downloads is the page heading; its existing `#/jobs` address and internal owner remain stable. The page presents Processing & attention and Ready to download as open groups with 22px headings and short 14px descriptions. Completed scans & other activity is a closed disclosure, keeping finished scans and cancelled work available without competing with current tasks or downloads.

Queue overview is collapsed by default. Each row keeps progress or its ready message prominent; Processing details and platform-upload instructions use 13px disclosure summaries. Watch video and Review generated image remain separate review disclosures. The existing bounded row grid, quiet borders and charcoal/peach palette carry this hierarchy without a new material treatment. Select videos reveals bulk ZIP selection; individual downloads remain directly available.

### Moment Map

A real time axis sits above source-window intervals. Suggested windows are peach; checked windows are steel; unchecked windows have dashed borders, and unreviewed source gaps stay visible. The track supports actual overlapping lanes, a 24px interval height and bounded scrolling up to 220px. The adjacent retained-moment list remains the touch/keyboard alternative and separates Watch source from Edit. Neither fictional waveforms nor engagement scores define this component.

### Studio Timeline and Captions

The timeline filmstrip uses actual sampled source frames or a frame-unavailable label. A moving white playhead overlays the frames; the five-label ruler uses source time and tabular numerals. A peach selection bar and paired Start/End ranges accompany numeric In/Out inputs. Essential transport stays directly below the viewer; mute, volume, speed, fullscreen and shortcut help sit in Volume & playback settings, open by default above 760px and closed on narrower screens. This secondary row uses 44px buttons/selects and a labelled native volume slider; inspector updates preserve the media element.

The inspector defaults to Captions, with Style, Story and Export as peer tabs. The caption panel begins with project output scope and an explicit clip-language override. Empty caption work offers Recheck speech and Add timed captions directly, opening the relevant advanced control rather than hiding recovery behind a closed disclosure. Timestamp buttons sit beside editable text; uncertainty flags use rose and source comparison remains available. Timing, dialect and advanced tools are disclosed below essential caption work. The base caption text area has 9px padding and a 76px minimum height.

Style presents six named caption treatments in a two-column grid. Each sample pairs a short text treatment with its label; the current style has a peach border and raised-charcoal fill. Framing, audio enhancement and saved brand styles stay in this task. Brand controls use labelled native fields for font, placement, text/highlight/background colors and size; the two-column field arrangement retains the charcoal app chrome. Media-specific caption colors are user content, not new application palette tokens. Export uses destination and output controls in its own inspector task, reached directly from the Studio Export button. Its delivery heading follows the 22px title step and queue/preparation/error text reports actual work.

### Settings, Progress and Motion

Native Settings is at most 740px wide and no wider than the viewport minus 32px, with a maximum height of the dynamic viewport minus 48px. It contains the single speech/scan controls; quick language controls are moved into it and returned when it closes. Native dialog behavior supplies focus containment and Escape dismissal.

Progress bars represent actual work. The real processing indicator rotates (one second, linear); the current-project image has a small hover scale (1.025 over 220ms). Neither adds invented ETA or scan telemetry. Reduced-motion disables animation, smooth scrolling and transitions. Scrollbars use the canvas/line/muted/text sequence with standard and WebKit styling; forced colors restores platform scrollbar colors and explicit map/control boundaries.

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

Original prior studio artwork remains documented in `public/assets/ARTWORK.md` but is not used over source footage. Home alone uses the original Meta-generated paper-film artwork (`public/assets/story-paper.webp`) when there is no current recording; actual project imagery replaces it when available. V2's small geometric brand/map illustration is authored as interface vector geometry. No competitor screenshots, their logos, generated fictional footage or the illustrative screenshot's television photo are served as app media. Private recordings, transcripts and local design outputs remain ignored. Screenshots show explicitly named QA data when no permissioned editorial source is available. Manrope's local font and license are in `public/assets/fonts`.

## Behaviour and verification

See `UX-CONTRACT.md` for canonical owners, state/feedback/navigation rules and architecture exceptions. Every visible action must work. Selection/edit/project state stays with existing controllers; these are not static prototype screens. Verification evidence and limits belong in `docs/V2-VERIFICATION.md`; documentation of source styles does not certify browser behavior, accessibility, dialect accuracy, live reliability or competition readiness. Suggested viewport checks remain 1440, 1280, 768 and 390px.

**Not canonized:** the inherited New video entry uses a system-font display treatment and several legacy dense controls remain below 44px; those exceptions are not guidance for new display surfaces or primary actions. This pass records source topology and tokens only, without certifying behavior or repairing those runtime exceptions.

### Workspace wayfinding

Home opens with one source form and the Setup, Turn, Payoff contact sheet. The shared link field is only shown away from Home. The global rail lists Home, Projects, Exports, Activity and Brand Kit. Global Exports opens the files from all projects; the Exports tab inside a project opens that project’s files. Activity shows queue progress and recovery actions. The two surfaces reuse the same underlying records.

Guide opens inline, describes the current screen, and keeps the four-step recording-to-export workflow visible while open. The project progress strip stays on working screens. The bell shows unread job completions and failures noticed by the running app. Its recent history and read state are stored in that browser.
