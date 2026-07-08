---
name: tienganhkhong-design
description: Use this skill to generate well-branded interfaces and assets for tienganhkhong, an IELTS writing feedback web app. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

**Brand in one sentence:** Calm, intelligent IELTS writing feedback — a quiet, focused workspace. No gamification. No noise.

**Colors:**
- Surface: `#FAF9F5` (cream), `#FFFFFF` (raised), `#F2F0E9` (sunken)
- Text: `#141413` (primary), `#5E5950` (secondary), `#857F70` (tertiary)
- Border: `#DEDAD0`
- Score high: `#3D7A5B` / Score mid: `#8B6325` / Score low: `#8B3A35`

**Fonts:**
- Display: Lora (serif) — Google Fonts
- Body/UI: DM Sans — Google Fonts
- Mono/scores: JetBrains Mono — Google Fonts

**Design rules:**
- Flat design — no gradients, no box shadows (border only)
- Generous whitespace — 4px base unit, prefer large spacing steps
- Sentence case everywhere; no emoji
- Honest, precise voice — never "Great job!" or motivational filler
- Two-color illustrations only (cream + ink); never modify
- Band scores always one decimal: `7.5`, never `7` or `7.50`
- Icons: Lucide CDN (`unpkg.com/lucide@latest`)

**IELTS criteria abbreviations:** TA (Task Achievement), CC (Coherence & Cohesion), LR (Lexical Resource), GRA (Grammatical Range & Accuracy)

**Core screens:** Dashboard (essay list) → Submit (paste essay) → Feedback (essay + scoring panel)
