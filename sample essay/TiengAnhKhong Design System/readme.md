# TiengAnhKhong Design System

> tienganhkhong (tiếng Anh không — "English sky") is a minimal, typography-forward web app that gives IELTS learners structured feedback on their writing. Calm, intelligent, no gamification.

---

## Sources

The following materials were used to build this design system:

- **Brand illustrations**: 16 hand-drawn SVG assets provided directly (1000×1000px, two-color: cream + ink)
- **Sample IELTS submission**: `DonaldTrump_SarcasticTribute_CreativeWriting_2026-06-20.docx` — a satirical creative writing piece used as a representative IELTS Task 2 submission for UI demonstrations
- **Product brief**: Company description provided in prompt (minimal, Anthropic-inspired, IELTS writing feedback, calm workspace)
- No Figma link or codebase was provided. All design decisions are derived from the brief and illustration assets.

---

## Product overview

**tienganhkhong** is a single-product web application. Learners paste an IELTS Task 1 or Task 2 essay, receive structured feedback across four IELTS marking criteria, and track their band score history over time.

### Core screens
| Screen | Purpose |
|--------|---------|
| **Dashboard** | Essay history with per-criterion scores at a glance |
| **Submit** | Paste/type essay, select task type, submit for analysis |
| **Feedback** | Side-by-side essay + annotated scoring panel |

---

## CONTENT FUNDAMENTALS

### Voice
The product voice is **honest and precise**. It speaks like a knowledgeable examiner — never a cheerleader.

### Casing
- **Sentence case** everywhere: headings, buttons, labels, toasts
- **ALL CAPS** only for very short metadata labels (task type, criterion abbreviations like TA, CC, LR, GRA) — never full words
- No title case in UI copy

### Pronoun stance
- **"Your essay…"** — addresses the learner directly in second person
- Never "I" from the system's perspective
- Avoid "we" — the feedback comes from the system, not a team

### Tone rules
| ✓ Do | ✗ Don't |
|------|---------|
| Precise and specific ("Paragraph 3 lacks a cohesive device") | Vague praise ("Great job!") |
| Acknowledge effort without rewarding mediocrity | Emoji, exclamation marks, "amazing" |
| Give actionable suggestions | Motivational filler ("Keep going!") |
| Use plain English | Jargon ("synergistic learning pathway") |

### Copy examples
- ✓ "Your topic sentences are clear, but paragraphs 2–3 lack cohesive devices."
- ✓ "287 words. Aim for 250+ to meet the minimum requirement."
- ✓ "Your position is maintained throughout, though examples are generic."
- ✗ "You're almost there — keep going! 🌟"
- ✗ "Amazing effort today!"

### Emoji policy
**Never used** in UI copy or feedback. The two-color brand illustrations serve all visual personality needs.

### Number formatting
- Band scores always show one decimal: `7.0`, `6.5` — never `7` or `7.00`
- Word counts as plain integers: `287 words`
- Dates as day + abbreviated month + year: `14 Jun 2026`

---

## VISUAL FOUNDATIONS

### Color
**Two-color brand palette** extended into a warm gray scale.

| Role | Value | Token |
|------|-------|-------|
| Primary surface | `#FAF9F5` | `--surface-base` |
| Raised surface (cards) | `#FFFFFF` | `--surface-raised` |
| Secondary surface | `#F2F0E9` | `--surface-sunken` |
| Border | `#DEDAD0` | `--surface-border` |
| Primary text | `#141413` | `--text-primary` |
| Secondary text | `#5E5950` | `--text-secondary` |
| Tertiary text | `#857F70` | `--text-tertiary` |

**Score semantic colors** are muted and warm, never saturated:
- High (band 7–9): `#3D7A5B` on `#EEF4F0`
- Mid (band 5–6): `#8B6325` on `#F7F1E6`
- Low (band 1–4): `#8B3A35` on `#F5EDED`

### Typography
**Two-font system:**
- **Lora** (serif): display headings, product name, editorial pull quotes. Conveys intelligence and editorial weight.
- **DM Sans** (sans): all UI text, body copy, labels, form elements. Clean and neutral.
- **JetBrains Mono**: band scores, word counts, tabular data.

> ⚠️ **Font substitution notice**: Lora is the nearest Google Fonts match for a Tiempos-style editorial serif. If the brand uses a proprietary serif (e.g. Tiempos Text by Klim), provide the font files and update `tokens/typography.css`.

Type scale follows a Major Third (1.25×) progression from 12px to 60px.

### Layout
- **Left sidebar** (220px fixed) on the web app: navigation, account
- **Main content** area scrolls independently
- **Feedback view** splits into two columns: essay (52%) + scoring panel (48%)
- **Max content width**: 860px for text-heavy views
- Generous whitespace: `48px` vertical padding on main content areas

### Spacing
4px base unit. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128px. Generous whitespace is a core brand value — compress only under explicit mobile constraints.

### Backgrounds
- **No images** as backgrounds; no textures, no patterns
- **No gradients** anywhere in the product
- Primary surface: warm cream `#FAF9F5`
- Secondary surfaces (sidebar, insets): `#F2F0E9`
- Cards always white `#FFFFFF` on the cream background

### Illustrations
All 16 illustrations are two-color flat drawings: cream `#FAF9F5` fill, ink `#141413` stroke. Used in:
- Empty states (no essays yet)
- Onboarding screens
- Feature callouts
- Marketing (landing page)

Never apply filters, tints, or background colors to illustrations — they are designed to sit on the cream surface.

### Animation
**Minimal and functional only:**
- **Duration**: 80ms (fast), 150ms (default), 250ms (slow)
- **Easing**: `cubic-bezier(0.2, 0, 0, 1)` — snappy, no bounce
- **What animates**: border color, background color, opacity, score ring stroke-dasharray
- **What never animates**: layout shifts, font size, decorative loops

### Hover/Active states
- **Interactive elements**: border color shifts to `--surface-strong` (`#C8C4B5`) or `--gray-700` on hover
- **Cards**: border darkens; background shifts to `--surface-overlay` (`#EAE8DF`)
- **Buttons**: background shifts to `--gray-700` (primary) or `--surface-overlay` (secondary/ghost)
- **No opacity tricks** for hover — always change color
- **Active/press**: no scale transform — just darken further

### Borders
- Default: `1px solid #DEDAD0` (`--surface-border`)
- Strong: `1px solid #C8C4B5` (`--surface-strong`)
- Interactive focus: `2px solid #141413` outline, 2px offset
- **No outer shadows** — borders convey containment entirely

### Cards
- White `#FFFFFF` background
- `1px solid #DEDAD0` border
- `8px` to `12px` border radius
- No box-shadow (flat design)
- Clickable cards get hover border-color change

### Corner radius
- UI elements: `4–8px` (inputs, buttons, badges)
- Cards, panels: `8–12px`
- Pills (full-radius): `9999px` for tags and selectors

### Transparency / blur
**Neither used** in this product. All surfaces are opaque. No frosted glass, no backdrop-filter.

### Iconography
See ICONOGRAPHY section below.

### Imagery
No photography used in the product UI. The brand illustration set replaces photography entirely.

---

## ICONOGRAPHY

The brand has no proprietary icon font or SVG sprite sheet. The 16 provided brand illustrations serve as the primary visual personality layer (see `assets/illustrations/`). For functional UI icons (chevrons, checkmarks, close buttons), use **Lucide Icons** from CDN:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

```js
lucide.createIcons(); // renders all data-lucide attributes
```

```html
<i data-lucide="chevron-down"></i>
<i data-lucide="check"></i>
<i data-lucide="x"></i>
```

Lucide characteristics:
- 24px default, 1.5px stroke, rounded caps
- Monochrome — inherits `currentColor`
- Never use emoji as icons

### Illustration usage guide
| Filename | Depicts | Use case |
|----------|---------|----------|
| `il-review.svg` | Magnifying glass over document | Review / analysis empty state |
| `il-writing.svg` | Code brackets + speech bubble | Writing / composition context |
| `il-annotation.svg` | Hand pointing at paper | Feedback / annotation context |
| `il-thinking.svg` | Head with constellation | AI analysis / thinking |
| `il-editing.svg` | Hand moving document stacks | Editing / revision |
| `il-announce.svg` | Megaphone | Announcements, onboarding tips |
| `il-brainstorm.svg` | Tangled circles | Complexity, brainstorming |
| `il-structure.svg` | Geometric diamond shapes | Essay structure, organisation |
| `il-study.svg` | Desk lamp over paper | Study mode, writing context |
| `il-conversation.svg` | Head with speech bubble | Feedback, dialogue |
| `il-achievement.svg` | Mountain with flag | Goal reached, high score |
| `il-time.svg` | Hourglass | Deadline, waiting for results |
| `il-grammar.svg` | Abstract form (largest) | Grammar, complexity |
| `il-submit.svg` | Hand pointing at document | Submission action |
| `il-progress.svg` | Line chart | Score history, progress |
| `il-knowledge.svg` | Scroll with tree | Learning, knowledge base |

---

## DESIGN TOKENS

All tokens live in `tokens/`. Key files:
- `tokens/colors.css` — raw gray scale + semantic surfaces/text + score colors
- `tokens/typography.css` — font families, size scale, line-heights, weights + Google Fonts import
- `tokens/spacing.css` — spacing scale, border radius, motion, z-index
- `tokens/base.css` — CSS reset + global element styles

---

## COMPONENTS

Located in `components/core/`. All are React function components with named PascalCase exports.

| Component | File | Description |
|-----------|------|-------------|
| `Button` | `Button.jsx` | Primary/secondary/ghost/destructive; sm/md/lg |
| `Badge` | `Badge.jsx` | Inline score and status labels |
| `Card` | `Card.jsx` | Surface container; default/flat/outline |
| `Input` | `Input.jsx` | Text input with label, error, hint |
| `Textarea` | `Input.jsx` | Essay textarea with word count |
| `Tag` | `Tag.jsx` | IELTS criterion labels (TA/CC/LR/GRA) |
| `ScoreRing` | `ScoreRing.jsx` | Circular band score gauge (0–9) |

---

## UI KITS

### Web App (`ui_kits/webapp/`)
Interactive prototype of the core IELTS feedback web app. Three screens: Dashboard, Submit, Feedback.

- `index.html` — main entry (load this)
- `shared.jsx` — sample data, ScoreBadge, MiniRing, Tag sub-components
- `views.jsx` — Sidebar, DashboardView, SubmitView, FeedbackView

---

## FILE INDEX

```
styles.css              ← global entry point (import this)
tokens/
  colors.css            ← color tokens
  typography.css        ← type tokens + Google Fonts import
  spacing.css           ← spacing, radius, motion, z-index
  base.css              ← CSS reset + element defaults
components/
  core/
    Button.jsx/.d.ts/.prompt.md
    Badge.jsx/.d.ts/.prompt.md
    Card.jsx/.d.ts/.prompt.md
    Input.jsx/.d.ts/.prompt.md    (also exports Textarea)
    Tag.jsx/.d.ts/.prompt.md
    ScoreRing.jsx/.d.ts/.prompt.md
    components.card.html          ← Design System tab card
guidelines/
  colors-brand.card.html
  colors-scale.card.html
  colors-score.card.html
  type-display.card.html
  type-body.card.html
  type-scale.card.html
  spacing-scale.card.html
  spacing-radius.card.html
  illustrations-a.card.html
  illustrations-b.card.html
  brand-voice.card.html
assets/
  illustrations/
    il-editing.svg … il-knowledge.svg   (16 brand illustrations)
ui_kits/
  webapp/
    index.html          ← interactive prototype
    shared.jsx
    views.jsx
readme.md               ← this file
SKILL.md                ← skill definition for Claude Code
```
