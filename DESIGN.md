---
name: Reader & Writer
description: Curated premium articles and vocabulary-building tools for serious English learners.
colors:
  focus-blue: "#3b82f6"
  focus-blue-vivid: "#008dff"
  success-green: "#37c25c"
  caution-amber: "#e6961f"
  alert-coral: "#ec6a5b"
  canvas: "#f2f2f2"
  surface: "#ffffff"
  ink-primary: "#171717"
  ink-secondary: "#404040"
  ink-muted: "#737373"
  ink-faint: "#a3a3a3"
  ink-hairline: "#e5e7eb"
  tint-blue: "#e5f3fe"
  tint-green: "#e1fae8"
  tint-amber: "#fcf4db"
  tint-coral: "#fff4ee"
  tint-mid: "#f5f5f5"
typography:
  display:
    fontFamily: "'SF Pro Rounded', 'Nunito', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'SF Pro Rounded', 'Nunito', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'SF Pro Rounded', 'Nunito', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'SF Pro Rounded', 'Nunito', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'SF Pro Rounded', 'Nunito', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  card: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.focus-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "#2563eb"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  chip-status:
    backgroundColor: "{colors.tint-blue}"
    textColor: "{colors.focus-blue}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.xl}"
    padding: "12px 48px 12px 20px"
  card-default:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: Reader & Writer

## 1. Overview

**Creative North Star: "The Focused Desk"**

Reader & Writer is the design of a well-organized, quiet workspace — the kind that belongs to someone who reads with a pencil in hand. Everything on screen is there because it earns its presence. The canvas (`#f2f2f2`) is the desk surface: warm enough to feel physical, neutral enough to disappear behind the content. Cards are white sheets of paper stacked at rest. The accent is a single, clear blue — informational, never decorative — used precisely where the eye needs guidance.

This is explicitly not a gamified learning tool. There are no confetti explosions, no mascots, no loop-closure pressure mechanics. Progress stats live in the sidebar like a quietly updated scoreboard — available when you look, invisible when you don't. Encouragement is earned and understated: a streak number, a donut filling in, a badge that doesn't shout.

The motion energy is responsive: state changes and transitions only, no choreographed entrances. Springs handle active-pill nav transitions; crossfades handle card swaps. Every animation has a `prefers-reduced-motion` alternative. Nothing moves for its own sake.

**Key Characteristics:**
- Off-white canvas (`#f2f2f2`) with pure-white cards — depth through layering, not shadows
- Single accent color (Focus Blue `#3b82f6`); semantic secondaries (green/amber/coral) for data states only
- Rounded-but-not-bubbly: 16–24px on cards, 12–16px on controls, 999px on tags/pills only
- Tight, tracked display type; comfortable 13px body; 11px uppercase tracking for labels
- Ambient shadow vocabulary — diffuse, layered — never structural or directional
- Data richness tucked into the sidebar; reading surface kept free

---

## 2. Colors: The Desk Palette

One informational accent on a near-neutral canvas. Semantic secondaries carry only data-state meaning — they never appear as decorative splashes.

### Primary
- **Focus Blue** (`#3b82f6`): The single action color. Used on primary buttons, the active nav pill, active tab underlines, selected checkboxes, and in-progress data states. Its rarity is the point. Also available in **Vivid** (`#008dff`) for icon-on-tint contexts where the standard value reads too dark against the blue tint.

### Secondary (Semantic only — data states, badges, progress)
- **Success Green** (`#37c25c`): Mastered / complete / positive delta. Used on tinted icon chips and mastery rings. Never used decoratively on interactive controls.
- **Caution Amber** (`#e6961f`): Pending / in-review / medium-difficulty. Same tinted chip pattern.
- **Alert Coral** (`#ec6a5b`): Failed / error / lives-lost / hard difficulty. Also used for the heart/like action in its toggled state.

### Neutral
- **Canvas** (`#f2f2f2`): The page background — the desk. Never applied to cards or controls.
- **Surface** (`#ffffff`): All cards, inputs, dropdowns, the NavDock. White on gray creates depth without shadows as the primary mechanism.
- **Ink Primary** (`#171717` / Tailwind `neutral-900`): Headings, high-importance body copy, active labels.
- **Ink Secondary** (`#404040` / `neutral-700`): Secondary body copy, input text, nav labels.
- **Ink Muted** (`#737373` / `neutral-500`): Supporting metadata, subtitles, placeholder-adjacent content.
- **Ink Faint** (`#a3a3a3` / `neutral-400`): Timestamps, fine print, inactive icons.
- **Ink Hairline** (`#e5e7eb` / `neutral-200`): Dividers, row separators. Never borders on card edges.
- **Tint Blue / Green / Amber / Coral**: (`#e5f3fe` / `#e1fae8` / `#fcf4db` / `#fff4ee`): Icon chip backgrounds. Always paired with their parent semantic color as the icon foreground.
- **Mid Tint** (`#f5f5f5`): Unselected filter chip backgrounds, inactive difficulty selectors.

### Named Rules
**The Single Voice Rule.** Focus Blue appears on ≤10% of any screen surface. Its rarity communicates meaning. The semantic secondaries (green, amber, coral) appear only in data-state chips and progress indicators — never as button colors, never as section backgrounds.

---

## 3. Typography

**Body / Display Font:** SF Pro Rounded (system) with Nunito (Google Fonts) as the loaded web fallback, then `-apple-system`, `BlinkMacSystemFont`, `system-ui`, `sans-serif`.

**Character:** A single humanist rounded sans-serif family throughout. The rounding conveys approachability without softness; the system-font-first stack feels native on Apple devices, which describes the primary user context. One family, differentiated entirely through weight and size — no display/body split, no decorative typeface.

### Hierarchy
- **Display** (700, 28px, lh 1.0, ls –0.03em): Page titles only (`<h1>`). Feed header, Exercise, Library, Profile headings.
- **Headline** (700, 24px, lh 1.2, ls –0.02em): The "Ideas worth sharing" feed section header and article card titles at their largest size.
- **Title** (600, 20px, lh 1.3, ls –0.015em): Article card titles (`h3`), section subheadings within cards (`text-[18px]`).
- **Body** (400, 13px, lh 1.6): All supporting copy, activity items, card descriptions, tab content. Line length capped at 65ch on reading surfaces.
- **Label** (400, 11px, lh 1.4, ls 0.08em): Table column headers, timestamps, tag text, progress deltas. Used in uppercase only for column headers, lowercase elsewhere.

### Named Rules
**The One-Family Rule.** No second typeface is introduced for display, pullquotes, or decorative text. Weight and scale do the work. If a surface needs to feel more editorial, increase weight and decrease size — don't introduce a serif.

---

## 4. Elevation

This system uses ambient, diffuse shadow layering — not directional or structural shadows. Cards are white paper on a gray desk; the depth reads immediately without heavy drop shadows. Two shadow tokens carry the whole vocabulary.

### Shadow Vocabulary
- **Ambient Low** (`box-shadow: 0px 5.492px 5.492px 0px rgba(0,0,0,0.04), 0px 1.098px 3.295px 0px rgba(0,0,0,0.04)`): Default card rest state. All white cards at page level. Inputs, buttons, the NavDock container.
- **Ambient High** (`box-shadow: 0px 13.18px 7.688px 0px rgba(0,0,0,0.02), 0px 5.492px 5.492px 0px rgba(0,0,0,0.04), 0px 1.098px 3.295px 0px rgba(0,0,0,0.04)`): Elevated overlays: the NavDock pill, dropdowns, the QuoteStack front card. Adds a wider upper spread for the lifted effect.
- **Action Glow** (`box-shadow: 0px 13.674px 19.206px 0px rgba(59,130,246,0.28)`): Primary buttons only. A blue-tinted glow beneath the action affordance — the only colored shadow in the system.

### Named Rules
**The Flatness Rule.** Shadows are ambient, never directional. No `0 4px 6px rgba(0,0,0,0.1)` hard drop shadows. The two-layer ambient formula is the only permitted shadow structure. Cards do not acquire shadows on hover — hover transitions are reserved for article cards via a wider ambient spread.

---

## 5. Components

### Buttons
- **Shape:** Gently rounded (12–16px), not pill-shaped. `rounded-xl` (12px) for most controls; `rounded-2xl` (16px) on larger CTAs.
- **Primary:** Focus Blue background (`#3b82f6`), white text, 13px semibold, `px-5 py-2.5`. Blue action glow shadow. Example: "Read more →", "Start climbing", "Study".
- **Hover:** Background shifts to `#2563eb`. Transition: `transition-colors` (default speed).
- **Ghost (secondary):** White background, Ink Secondary text, Ambient Low shadow. Used for icon buttons (filter, bookmark, share, edit) and "Edit profile". No colored border.
- **Tint (tertiary):** Tint-blue background (`#e5f3fe`), Focus Blue text. No shadow. Used for soft in-card actions: "View all activity", "View detailed stats", "Apply filters".
- **Disabled:** Not yet defined in the system.

### Chips / Tags
- **Style:** Inline-flex, rounded pill (`rounded-full`) for interest tags, `rounded-xl` (12px) for status badges and tinted icon chips.
- **Tinted icon chip:** 36×36px, `rounded-xl`, semantic tint background, semantic color icon at 16×16px strokeWidth 2.2. Used throughout activity feeds, progress rows, exercise cards.
- **Status badge:** Tint background + semantic icon + label text, 12px. Variants: pending (coral tint), inProgress (blue tint), success (green tint), etc.
- **Interest/filter tag:** Rounded-full pill, tint background, semantic text color, 12px. Used on Profile to show user personality tags.

### Cards / Containers
- **Corner Style:** Generously rounded — `rounded-2xl` (16px) on most cards, `rounded-3xl` (24px) on article cards and the QuoteStack.
- **Background:** Always `#ffffff`.
- **Shadow Strategy:** Ambient Low at rest. Article cards transition to a slightly wider ambient on hover (opacity and spread change).
- **Border:** None on card edges. `border-b border-neutral-100` dividers between list rows only.
- **Internal Padding:** `p-5` (20px) on sidebar cards; `p-6` (24px) on main content cards.
- **Nested Cards:** Prohibited. Never place a shadowed card inside another card.

### Inputs / Fields
- **Style:** White background (`bg-white` or `bg-[#eaeaea]` for the feed's embedded search), no visible border, `rounded-2xl` (16px), Ambient Low shadow on the white variant.
- **Feed search:** Slightly gray (`#eaeaea`) background, embedded search icon button (white, Ambient Low, `rounded-xl`).
- **Sidebar search:** White card with inline search icon, no button. `px-4 py-2.5`.
- **Focus:** No explicit focus ring in the current system. This is a gap.
- **Placeholder:** Ink Faint (`neutral-400`) at 13px.

### Navigation (NavDock)
- **Style:** Fixed bottom center, white/90 + `backdrop-blur-md`, Ambient High shadow, `rounded-2xl`, `p-1.5` internal padding.
- **Items:** 4 items — Feed, Exercise, Library, Profile. Icon (16×16, strokeWidth 2.2) + label at 13px.
- **Active state:** Spring-animated pill (layoutId `dock-pill`) fills the button background with Focus Blue, white text/icon. Transition: `type: 'spring', stiffness: 400, damping: 32`.
- **Inactive state:** Ink Muted text/icon, no background.

### QuoteStack (Signature Component)
The centerpiece of the Feed's first viewport. A physical stack of white cards suggesting a deck of paper.
- **Back cards:** Two pseudo-cards at rest, rotated `–2deg` (translateY 8px, scale 0.97) and `+1.5deg` (translateY 4px, scale 0.985), Ambient Low shadow. Not interactive.
- **Front card:** Full-width `rounded-3xl` (24px), white, Ambient High shadow, `px-10 py-8`. Contains: tinted category badge (top-left), quote text (28px semibold, centered, `my-auto`), source attribution (11px, tracked uppercase, `mt-auto`).
- **Transition:** Crossfade with Y-shift on card change (`opacity + y: 10→0`, 250ms, `cubic-bezier(0.16,1,0.3,1)`).
- **Controls:** Three 44×44px ghost buttons (ArrowLeft, Heart, ArrowRight), `rounded-xl`, Ambient Low. Heart fills coral on toggle.

---

## 6. Do's and Don'ts

### Do:
- **Do** use white cards on the `#f2f2f2` canvas as the primary depth mechanism. Layering + ambient shadow is enough.
- **Do** use Focus Blue (`#3b82f6`) only on primary CTAs, the active nav state, active tab indicators, and selected states. One role, one color.
- **Do** pair tint backgrounds with their semantic foreground color — `#e5f3fe` background always with `#3b82f6` or `#008dff` icon/text. Never swap tints between semantic families.
- **Do** keep card corners at 16–24px. `rounded-2xl` is the default; `rounded-3xl` for the largest surface cards (article cards, QuoteStack).
- **Do** use the two-layer ambient shadow formula verbatim for all cards. Don't approximate it.
- **Do** include `prefers-reduced-motion` alternatives for every spring or crossfade animation — typically a simple opacity swap.
- **Do** keep body copy at 13px with a 1.6 line-height on a 65ch max-width on reading surfaces.

### Don't:
- **Don't** use `borderLeft` greater than 1px as a colored stripe on cards, list items, or callouts. This is the single most visible AI-UI tell. Rewrite with tint backgrounds or no border.
- **Don't** introduce a second typeface. No serifs, no display faces, no mono for decorative use. One family, varied by weight.
- **Don't** animate layout properties (width, height, top, left). Springs and crossfades on transform and opacity only.
- **Don't** use gradient backgrounds, gradient text (`background-clip: text`), or glassmorphism as decoration. The glass treatment on NavDock exists for functional legibility over scrolled content — not as a style choice.
- **Don't** build Duolingo-style reward mechanics: no confetti, no full-screen celebration modals, no mascot icons, no streak-shaming pressure copy. Progress is reported, not performed.
- **Don't** use heavy directional drop shadows (`0 4px 6px rgba(0,0,0,0.1)` or darker). The ambient two-layer formula is the ceiling.
- **Don't** use semantic colors (Success Green, Alert Coral, Caution Amber) on interactive controls. They are data-state colors only — badges, mastery rings, tinted icon chips.
- **Don't** use uppercase body copy. Uppercase is reserved for column headers (11px, tracked) and occasionally short status labels. Sentences are never uppercased.
- **Don't** nest cards inside cards. A shadowed white surface inside another shadowed white surface creates undefined depth.
- **Don't** use `rounded-[32px+]` on cards or sections. 24px (`rounded-3xl`) is the maximum. Pills (`rounded-full`) are for tags and interest chips only.
