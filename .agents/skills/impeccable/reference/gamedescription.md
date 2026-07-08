**Complete Game Specifications**

English Learning App - All 26 Games

Version 1.0 · June 2026 · For Claude Code

# **Overview**

This document contains full game design specifications for all 26 games across three skill axes: Reading (6 games), Academic Writing (9 games), and Speaking (7 games). Each game entry includes concept, normal game flow, question/interaction types, scoring and penalties, feedback design, edge case handling, and science backing.

This document is intended as a build specification for Claude Code. All design decisions documented here have been resolved. Open questions within individual games are flagged explicitly.

## **Game registry**

Reading (passive comprehension): R1 Sentence Judge · R2 One Word · R3 Fault Finder · R4 Weight Reader · R5 The Cut · R6 Signal

Academic Writing (passive + active): W1 Collapse · W2 Objection · W3 Upgrade Chain · W4 Wrong Genre · W5 The Missing Link · W6 Shrink It · W7 Thread · W8 Drift Detector · W9 Spotlight

Speaking (active, voice-first): S1 Get It Out · S2 Tone Ball · S3 Conductor · S4 Chunk It · S5 Hot Seat · S6 Immediate · S7 Shadowing+

## **Shared systems across all games**

### **Dispute mechanism**

Every game includes a 'Dispute this' button on the post-answer or post-round explanation screen. Tapping flags the specific question or error explanation for content review without affecting the user's score. User sees confirmation: 'Thanks - we'll review this.' Disputes are logged with passage ID, question ID, user level, and user's answer.

### **Interrupted session handling**

- R1, W1-W9 (non-flash games): if mid-question, restore state and return to same question
- R2 One Word: if mid-flash, restart round from beginning - memory context cannot be resumed
- R3 Fault Finder: restore passage with all previously flagged phrases preserved
- S1-S7 (speaking games): if mid-recording, discard recording and return to prompt ready state

### **Content generation requirements**

- Passages tagged by register (conversational, academic, professional, narrative) and complexity level (A1-B2)
- No passage used in more than one game type
- R3 passages: minimum 2, maximum 5 planted errors per passage, validated before rotation
- W7/W8 passages: clear structural issues with unambiguous correct solutions only
- S5 situations: globally recognisable, no culturally specific content, reviewed for cultural sensitivity

### **Voice input stack**

- Speech-to-text: Whisper API or equivalent for transcription (S1, S5, S6, S7)
- Real-time audio signal: Web Audio API for amplitude/pitch capture (S2, S3, S4)
- LLM evaluation: Claude Sonnet for naturalness, register, and usage quality judgments (S1, S5, S6, W3, W4, W6, W9)
- Text fallback: available for S1 and S5 only - S2, S3, S4, S6 are voice-only by design

**R Reading**

6 games. All passive mode (comprehension-based). Skills covered: speed & attention, comprehension depth, text structure awareness, language sensitivity.

**R1 Sentence Judge** \[passive\] ✓ science-backed

**Skills trained:** Logical flow recognition, Key sentence identification, Register awareness, Cohesion & coherence

**Input method:** Tap / multiple choice

### **Concept**

A passage is displayed to the user. One sentence within the passage is highlighted. The game asks a question about that highlighted sentence. The question type is randomly selected each round from three types, with weighted randomness ensuring no single type appears more than twice consecutively.

Passage length and complexity adapt to the user's tested English level. Minimum level: B1 - below this threshold the passages are too simple for meaningful structural questions and the game is not shown.

### **Normal game flow**

- Passage displayed with one highlighted sentence
- Random question type selected (Type A, B, or C)
- User answers
- Explanation shown with corrected passage in context
- Next round begins with new passage or new highlighted sentence

### **Question / interaction types**

**Type A - Replace or Keep**

The user sees the highlighted sentence alongside one alternative version. They judge whether the alternative is better or worse than the original. Binary choice - two clearly labeled buttons, no drag interaction.

What makes versions different: clarity, concision, tone appropriateness, logical fit with surrounding sentences. Not grammar - both versions are always grammatically correct.

**Type B - Pick the Best Version**

The user sees 2 or 3 versions of the highlighted sentence and picks the strongest one. Differences between options are meaningful - register, word precision, logical connective choice, or structural fit with the passage argument.

**Type C - Where Does It Belong**

The highlighted sentence is shown removed from its current position. The user is given 2 or 3 placement options as simple labels: 'Before sentence 1', 'Between sentence 3 and 4', 'At the end'. They pick the location that makes the passage flow best.

Placement options are generated dynamically based on the sentence's current position. If the sentence is first, options only include middle and end. If last, options only include beginning and middle. The current position is never offered as an option.

### **Feedback and explanation**

After every answer - correct or incorrect - the user sees an explanation covering two things: the reasoning behind why the correct answer is correct (e.g. 'The word however signals contrast. This paragraph is making a contrasting point, so however fits better than additionally which signals continuation'), and the full passage shown again with the correct version of the sentence in place so the user sees it in actual context.

### **Edge cases**

**User takes too long**

No hard timer. After 60 seconds of no interaction, screen dims slightly with a soft prompt: 'Still reading? Take your time.' No penalty, no forced timeout.

**Same question type repeats**

Weighted randomness prevents the same type appearing more than twice in a row. All three types appear roughly equally across a full session.

**Highlighted sentence is first or last**

For Type C, placement options are generated dynamically so impossible placements are never shown. Current position is never an option.

**Two versions look nearly identical**

Explanation must always spell out the specific difference explicitly. Never 'this version is better' alone - always with precise reasoning.

**User disputes an answer**

A 'Dispute this' button appears on every explanation screen. Tapping flags the question for content review without affecting score. User sees: 'Thanks - we'll review this.'

_Science: Text manipulation and structural judgment tasks improve structural awareness and cohesive device use in L2 writers (Ferris & Hedgcock, 2005; Celce-Murcia & Larsen-Freeman, 1999)_

**R2 One Word** \[passive\] ✓ science-backed

**Skills trained:** Fast word recognition, Working memory span, Literal comprehension, Chunking phrases

**Input method:** Multiple choice (post-reading)

### **Concept**

Words from a passage flash one at a time in a fixed central position on screen (RSVP - Rapid Serial Visual Presentation format). The user sets their own WPM before each session. Once the passage begins, words flash at that speed with no pause and no going back. When the passage ends, it disappears completely. The user answers questions entirely from memory. After answering, the full passage reappears with key information highlighted.

The user cannot review the passage before answering. This is the core mechanic - retention under speed, not reading at leisure.

### **Normal game flow**

- User sets WPM from session start screen (default: last used value)
- Words flash one at a time in fixed center position at set WPM
- Passage ends and disappears completely
- Questions appear immediately - user answers from memory only
- Full passage reappears with correct answers highlighted in context
- If all wrong, 'Re-read' option offered at 80% WPM

### **Question / interaction types**

**Comprehension questions**

Questions are simple and direct - they test whether a specific piece of explicitly stated information was registered. Not inference, not interpretation. The cognitive challenge is retention, not reasoning.

Multiple choice format. Questions must be parseable in under 3 seconds so the question itself does not become an obstacle.

Number of questions varies by passage length and user level: 2-3 questions at lower levels, 4-5 at higher levels.

### **Scoring and penalties**

WPM setting persists between sessions as a personal default. The app tracks WPM history across sessions and surfaces a simple progress line so users can see themselves getting faster over time.

WPM caps per user level - Minimum: 80 WPM (below this the skill is not being trained). Maximum caps: A1-A2: 150 WPM, B1: 250 WPM, B2: 400 WPM. If user attempts to set above their level cap, a brief note explains why the cap exists.

Words above approximately 8 characters receive slightly extended display time regardless of WPM setting. This adjustment is invisible to the user.

If the user taps 'Re-read', it is not penalized in score but is tracked silently - the app uses this signal to be more conservative with WPM progression for that user.

### **Feedback and explanation**

After all questions, the full passage reappears. Every piece of information a question asked about is highlighted. If correct: confirms retention and reinforces the memory. If incorrect: shows exactly where in the passage the answer was so the user understands what they missed.

### **Edge cases**

**User exits mid-flash**

Session is interrupted. On return: 'Your session was interrupted. Restart this round?' Resuming mid-sequence is not supported - memory context is broken.

**Passage is high lexical density**

For passages flagged as high lexical density, the WPM cap for that specific passage is automatically reduced by up to 20%. User is not notified - it simply feels right rather than impossible.

**User disputes a question**

'Dispute this' button on post-answer reveal screen. Flags specific question for content review. No score impact.

_Science: RSVP reading is validated for speed training; comprehension is preserved up to approximately 350 WPM. Questions should test only literal retention, never inference, as RSVP eliminates parafoveal preview and regression (Rayner et al., 2016)_

**R3 Fault Finder** \[passive\] ✓ science-backed

**Skills trained:** Nuance & word choice precision, Register awareness, Tone detection, Connotation sensitivity

**Input method:** Tap to flag phrase, tap to select replacement

### **Concept**

A passage is shown - conversational, academic, professional, or any register. Somewhere within the passage, a number of phrases are subtly wrong. Not grammatically wrong. Wrong in feel: the tone does not match the context, a word carries the wrong connotation, the phrasing is technically correct but unnatural, the register is inconsistent with the surrounding text.

No phrases are pre-highlighted. The user reads the full passage and actively hunts for what feels off. When they find something suspicious they tap it. A list of 2-3 replacement options appears and the user picks the one that fits correctly.

Minimum passage length: conversational passages 80 words, academic passages 120 words.

### **Normal game flow**

- Full passage displayed - no visual cues marking wrong phrases
- User reads and taps suspicious phrases to flag them
- On tap, a replacement options panel appears - user selects correct replacement
- User taps elsewhere to dismiss panel without committing if they change mind
- When satisfied, user taps 'Done hunting' button
- Post-round reveal shows all errors including missed ones with explanations

### **Scoring and penalties**

Strike system for false positives - tapping a phrase that is not actually wrong. 3 false positive taps per round results in loss of score multiplier or a life (exact UI mechanic decided during UI design phase, but penalty must be immediate and visible).

Correct identifications contribute positively to score. Missed errors reduce score but do not trigger strikes - not finding something is different from guessing incorrectly.

A second tap on a flagged phrase unflags it. The user does not know the total number of wrong phrases before starting - this is intentional.

### **Feedback and explanation**

After 'Done hunting' or strike exhaustion, the passage is shown again in full. Every wrong phrase is revealed and corrected - including ones the user missed. For each error, tapping the highlighted phrase shows: why the original phrasing was wrong, and why the correct replacement fits better in this specific context.

Explanation tone should feel like a perceptive friend pointing something out, not a grammar textbook. The goal is to build instinct, not memorize rules.

### **Edge cases**

**False positive exhaustion**

Round ends immediately when 3 false positives hit. Post-round reveal proceeds normally showing all errors.

**User changes mind mid-replacement**

Tapping elsewhere dismisses the replacement panel and returns the phrase to flagged state without committing. User can unflag or revisit later.

**Passage has zero wrong phrases**

Must not occur by design. Content generation enforces minimum 2 errors per passage validated before entering rotation. Zero-error passages removed from rotation immediately.

**User disputes an error explanation**

'Dispute this' available per error in post-round reveal. Flags individual error explanation for content review. No score impact.

_Science: Error detection tasks build metalinguistic awareness critical for L2 writing and reading quality. Explicit focus on nuance and connotation accelerates language feel acquisition (Ellis, 2004; Nation, 2001)_

**R4 Weight Reader** \[passive\] ✓ science-backed

**Skills trained:** Skimming for gist, Scanning, Main idea identification, Detail vs main idea

**Input method:** Multiple choice (post-reading), fully self-paced reading phase

### **Concept**

A passage is shown where the app has pre-decided which information is structurally important - main ideas, key arguments, critical data points. That information is rendered in slightly heavier font weight than the surrounding text. Not highlighted. Not colored. Just subtly thicker letterforms.

The weight difference is noticeable but not obvious - the user must actually read to feel the hierarchy. The weighted text is the lesson: it teaches the user to feel how a skilled reader would prioritize this passage before processing every word.

Difficulty scaling: the contrast between heavier and lighter text reduces gradually as the user's level improves. Early levels have pronounced contrast. Advanced levels have barely-there contrast - almost imperceptible unless you are looking for it. This transition happens slowly and continuously, never in sudden jumps.

### **Normal game flow**

- Passage displayed with app-weighted font hierarchy - key information in heavier weight
- User reads fully self-paced, no timer
- User taps 'Done reading' when ready
- If done too fast, soft prompt: 'That was quick - sure you caught everything?' (not a block)
- Questions appear covering both main ideas (heavy text) and supporting details (light text)
- Feedback shown after all questions answered

### **Scoring and penalties**

Silent behavioral tracking without surfacing to user: if user consistently misses light-weight questions, next sessions increase proportion of detail-focused questions. If user consistently misses main-idea questions, contrast is increased slightly and main-idea questions increase.

Soft idle detection: if user taps 'Done reading' faster than 100 WPM equivalent for that passage length, a gentle prompt appears. Not a hard block - user can proceed immediately. Event tracked silently.

### **Feedback and explanation**

After all questions answered, the passage is shown again. Correct and incorrect answers are marked against the passage text. For missed main ideas, the heavy-weight text is highlighted more prominently in the feedback view to reinforce the visual signal.

### **Edge cases**

**First-time player misses weight difference**

On very first play only, a brief tutorial moment shows two sentences side by side: one regular weight, one heavier. Single label: 'Slightly thicker text marks the most important ideas.' That is the entire tutorial. No further explanation on subsequent plays.

**Weight contrast too subtle at advanced levels**

If behavioral tracking shows higher-than-expected failure rate after a contrast reduction step, that step is flagged for review and potentially slowed.

**Accessibility**

An accessibility setting replaces font weight with a subtle color tint - same game logic, different visual encoding. Available in accessibility preferences, does not affect scoring.

**User disputes a question**

'Dispute this' on post-answer feedback screen. No score impact.

_Science: Visual salience cueing improves reading comprehension and hierarchical information processing. Explicit training in main idea identification improves both reading comprehension and writing structure (Mayer, 2009; Brown & Day, 1983)_

**R5 The Cut** \[passive\] ✓ science-backed

**Skills trained:** Redundancy detection, Main idea identification, Concision (crossover to writing)

**Input method:** Tap words to eliminate

### **Concept**

A passage is shown with a word budget (e.g. 'Keep only 20 words'). The user taps words to eliminate them. After pressing 'Done cutting', post-round LLM feedback assesses meaning preservation and concision quality.

Design note: a live real-time meaning meter is technically unfeasible at acceptable quality and cost. Post-round LLM feedback replaces this - the user sees a summary evaluation after completion, not a live signal.

The game trains ruthless prioritization of essential information - a skill that directly transfers to both reading comprehension and academic writing concision.

### **Normal game flow**

- Passage displayed with word budget shown (e.g. 'Target: 20 words')
- User taps individual words to grey them out (eliminated)
- Tapping an eliminated word restores it
- Current word count shown in real time
- User taps 'Done cutting' when satisfied
- LLM evaluates the remaining text for meaning preservation
- Feedback shows what essential meaning was retained and what was lost

### **Scoring and penalties**

Score based on two factors: how close to the word budget the user got, and LLM assessment of how much core meaning was preserved. Eliminating too many words or losing key ideas both reduce score.

### **Feedback and explanation**

Post-round, the original passage is shown alongside the user's cut version. LLM feedback explains in plain language what the user successfully preserved and what essential meaning was accidentally removed.

### **Edge cases**

**User cuts below minimum meaning threshold**

If the remaining words are assessed by LLM as losing all meaningful content, a soft warning appears: 'You may have cut too much - key ideas seem missing.' Not a block.

**LLM evaluation is slow**

While LLM processes, show a simple 'Evaluating your cut...' indicator. Target under 3 seconds. If timeout occurs, fall back to a basic word count score only.

_Science: Summarisation and reduction tasks improve both reading comprehension and writing concision simultaneously - among the most validated dual-skill training techniques (Kintsch & van Dijk, 1978; Brown & Day, 1983)_

**R6 Signal** \[passive\]

**Skills trained:** Scanning, Fast word recognition, Vocabulary recognition speed

**Input method:** Tap targets on scrolling text

### **Concept**

A wall of text scrolls upward continuously like rolling credits. Target words or phrases from the user's chosen vocabulary set are hidden inside the passage. The user taps them as they pass. Miss one and lose a life. Speed increases as the round progresses.

Framing note: this game trains vocabulary recognition speed and visual scanning under pressure, not deep reading comprehension. It functions primarily as an engagement and vocabulary activation tool. It should not be framed as a reading skill trainer in the app's UI.

### **Normal game flow**

- Vocabulary set selected (user's active set)
- Text begins scrolling upward at baseline speed
- Target words from vocabulary set appear embedded in running text
- User taps target words before they scroll off screen
- Miss: lose a life (3 lives per round)
- Correct tap: score increases, scroll speed increases slightly
- Round ends when all lives lost or passage completes

### **Scoring and penalties**

3 lives per round. Missing a target word costs a life. Tapping a non-target word costs a life (false positive penalty). Score multiplier increases with consecutive correct taps.

### **Feedback and explanation**

After round ends, list of all target words shown with which ones were caught and which were missed. For missed words, definition and example sentence shown to reinforce vocabulary.

### **Edge cases**

**Scroll speed becomes unplayable**

Maximum scroll speed capped per user level to prevent the game becoming physically impossible. Speed curve is gradual.

**Target word is very long**

Long target words get slightly more screen time by appearing earlier in the line of text so the user has more horizontal time to tap them.

_Science: No direct research backing for this specific format as a reading skill trainer. Validated as a vocabulary recognition speed tool - serves engagement and activation rather than core skill development_

**W Academic Writing**

9 games. Mix of passive and active. Skills covered: information structure (Kaplan linear progression), thematic progression, rhetorical dependency & attention slots, fallacies & hidden assumptions, content & argument, organisation & structure, language & style.

**W1 Collapse** \[passive\] ✓ science-backed

**Skills trained:** Logical sequencing, Argument development, Cohesive devices, Paragraph structure

**Input method:** Drag and drop

### **Concept**

6-8 sentences from a well-structured argument are presented completely scrambled. The user drags them into the correct order. A live flow score updates in real time as each sentence is placed - the user can feel the logic building or collapsing as they construct the argument.

The live flow score is calculated based on logical connectives (however, therefore, furthermore, etc.), pronoun reference chains, and topic continuity across adjacent sentences. It does not require LLM evaluation - it uses a rules-based scoring model on connective and reference patterns.

### **Normal game flow**

- 8 scrambled sentence tiles displayed
- User drags sentences into an ordering zone
- Live flow score updates on each placement
- User can reorder freely until satisfied
- User taps 'Submit order'
- Correct order revealed with explanation of each logical connection

### **Scoring and penalties**

Score based on number of sentences in correct position relative to the original argument. Partial credit given for locally correct adjacencies (sentence A correctly before sentence B even if both are in the wrong section).

### **Feedback and explanation**

After submission, the correct order is shown with the user's order highlighted for comparison. Each sentence transition is annotated explaining the logical or cohesive reason it must follow the previous sentence (e.g. 'This sentence begins with However, which signals contrast - it must follow the claim it is contrasting with').

### **Edge cases**

**Multiple valid orderings exist**

Content must be curated to have one clear optimal order. Ambiguous passages should not enter rotation. If a user disputes the correct order, the 'Dispute this' mechanism flags it for content review.

**Drag interaction fails on small screen**

Tap-to-select then tap-to-place fallback available for accessibility and small screen sizes.

_Science: Sentence reordering tasks directly improve argumentative essay coherence and logical sequencing in EFL learners (Oshima & Hogue, 2006; Connor, 1996)_

**W2 Objection** \[passive\] ✓ science-backed

**Skills trained:** Fallacy detection, Hidden assumptions, Critical thinking, Evidence relevance, Reading between the lines

**Input method:** Tap to flag weak point, tap to label it

### **Concept**

A short persuasive paragraph appears. The user has 30 seconds to find the logical weak point and tap it, then choose a label for the type of flaw (strawman, false dichotomy, overgeneralisation, unstated assumption, correlation-causation confusion, circular reasoning, appeal to unexamined authority).

The hunt is the game - not multiple choice from the start. The user must first locate the weak point themselves, then classify it. This trains active critical reading rather than passive recognition.

### **Normal game flow**

- Persuasive paragraph displayed with 30-second countdown
- User reads and taps the sentence or phrase they identify as the logical weak point
- Label panel appears - user selects the type of flaw
- Correct answer revealed with detailed explanation
- If timer expires before tap, round counts as missed - correct answer revealed

### **Scoring and penalties**

Full score for correct location + correct label. Partial score for correct location + wrong label. Zero for wrong location regardless of label. Timer expiry counts as zero for the round.

### **Feedback and explanation**

After every round, the weak point is highlighted in the passage with a detailed explanation of: what the flaw is, why it weakens the argument, and what the argument would need to do instead to be logically sound.

### **Edge cases**

**Multiple weak points in one passage**

Passages must be curated to have one primary weak point. If multiple exist, only the most significant one is the target. Content note on each passage specifies which flaw is the target.

**User disputes the identified weak point**

'Dispute this' available on feedback screen. No score impact.

**Timer creates too much pressure for lower levels**

Timer duration scales with user level - lower levels get up to 60 seconds, higher levels 20 seconds.

_Science: Critical thinking training through argument analysis measurably improves academic writing quality and argument validity in EFL learners (Stapleton, 2001; Kuhn, 1991)_

**W3 Upgrade Chain** \[active\] ✓ science-backed

**Skills trained:** Word choice precision, Academic register, Concision, Nuance & connotation

**Input method:** Type word replacement or tap from suggestion list

### **Concept**

The user starts with a weak, vague, or informal sentence. Each round they have exactly one move: replace one word or phrase with a better one from their active vocabulary set or from a contextually appropriate suggestion list. The sentence transforms across 4-5 rounds. The game is optimisation - how good can you make it with the fewest moves?

LLM evaluates each replacement for appropriateness to context, register fit, and whether it represents a genuine improvement.

### **Normal game flow**

- Weak sentence displayed
- User taps the word/phrase they want to replace
- Replacement options appear (from active vocab set + suggestions)
- User selects or types replacement
- LLM evaluates - sentence updates with quality indicator
- Repeat for up to 4-5 rounds
- Final sentence scored overall for register, precision, and improvement delta

### **Scoring and penalties**

Score is cumulative improvement delta - how much better is the final sentence than the starting one, weighted by number of moves used. Fewer moves for same quality = higher score.

A replacement that makes the sentence worse (wrong register, imprecise word, unnatural collocation) is flagged immediately with a brief explanation. It still counts as a move.

### **Feedback and explanation**

After final round, the original sentence and final sentence shown side by side. Each replacement is annotated with why it was an improvement or why it was wrong. Example of optimal upgrade path shown for comparison.

### **Edge cases**

**LLM evaluation slow**

Brief evaluation indicator shown. Target under 2 seconds per evaluation. If timeout, fall back to rule-based collocation check.

**User's replacement is not in vocabulary set**

Free text input allowed. LLM evaluates anything typed. If it's a good replacement not in the vocab set, it can be added to the user's set as a discovered word.

_Science: Focused vocabulary revision and substitution tasks improve lexical sophistication and academic register in L2 writing (Laufer & Nation, 1995; Nation, 2001)_

**W4 Wrong Genre** \[active\] ✓ science-backed

**Skills trained:** Formality calibration, Academic register, Sentence variety, Register awareness

**Input method:** Type word-by-word replacements

### **Concept**

A sentence written in the wrong register is shown (e.g. a formal business email written like a text message, or an academic argument written in casual spoken language). A register meter is visible on screen. The user rewrites it word by word or phrase by phrase - each change shifts the register meter in real time. The goal is to tune the meter to the target register.

The register meter is LLM-driven with caching for common substitutions to reduce latency. It responds to register-significant words and structural choices, not to every word change.

### **Normal game flow**

- Wrong-register sentence displayed with target register shown (e.g. 'Make this academic')
- Register meter visible showing current vs target
- User taps words to replace with register-appropriate alternatives
- Meter updates on each significant change
- User taps 'Done' when satisfied
- Final sentence evaluated with meter score and annotated explanation

### **Scoring and penalties**

Score based on final register meter reading and semantic preservation - a sentence that hits perfect register but changes the meaning gets a deduction.

Overcorrection penalized - going from too casual to overly formal also reduces score. Target is appropriate register, not maximum formality.

### **Feedback and explanation**

After submission, the target register version is shown alongside user's version. Each substitution is annotated: register impact, semantic preservation, and naturalness.

### **Edge cases**

**Meter lags on rapid changes**

Meter updates are debounced - waits 500ms after last change before triggering evaluation. This prevents spam API calls and gives the user time to type before seeing feedback.

**User's version is technically correct but unusual**

If register is correct but phrasing is unnatural, the meter reflects register only. A separate naturalness indicator shows if the phrasing sounds unusual.

_Science: Genre-based instruction and explicit register training improve formality control and academic register in L2 academic writing (Hyland, 2004; Swales, 1990)_

**W5 The Missing Link** \[passive\] ✓ science-backed

**Skills trained:** Signposting & transitions, Cohesive devices, Argument development, Inference making

**Input method:** Multiple choice

### **Concept**

An argument is shown with one sentence removed. A gap marker shows where the missing sentence belonged. Three options are presented to fill the gap - all are grammatically correct and all are plausible on the surface. The only difference between them is logical: one advances the argument correctly, one introduces a logical non-sequitur, one uses a transition that signals the wrong relationship (e.g. contrast instead of continuation).

The user selects the option that makes the argument flow correctly. This trains sensitivity to logical connectives, argumentative sequencing, and the difference between a sentence that sounds right and one that is right.

### **Normal game flow**

- Argument displayed with visible gap where sentence was removed
- Three candidate sentences shown below
- User selects the one that correctly fills the gap
- Explanation shown covering why the correct choice works and why each wrong choice fails

### **Scoring and penalties**

Binary - correct or incorrect per round. No partial credit. Streak bonus for consecutive correct answers.

### **Feedback and explanation**

After every answer, explanation covers: why the correct sentence works (what logical relationship it creates, what connective it uses and why that connective fits here), why wrong option A fails (what relationship it incorrectly signals), why wrong option B fails.

### **Edge cases**

**All three options seem equally valid to user**

This signals a content quality issue - the three options were not differentiated enough. 'Dispute this' mechanism flags it. Content guidelines must require clearly distinct logical relationships between the three options.

_Science: Gap-fill tasks in discourse contexts improve cohesive device use and argumentative sequencing in L2 writing (Celce-Murcia & Larsen-Freeman, 1999; Halliday & Hasan, 1976)_

**W6 Shrink It** \[active\] ✓ science-backed

**Skills trained:** Summarising & paraphrasing, Concision, Main idea identification, Thesis formation

**Input method:** Free text - LLM evaluated

### **Concept**

A long paragraph is shown. The user must condense it to one sentence without losing the core meaning. LLM scores the submission on two dimensions: meaning preservation (did the essential argument survive?) and concision quality (is the sentence itself well-constructed?).

This is the only game that combines deep reading comprehension with active writing production in a single task. The user cannot write a good one-sentence summary without first understanding what the paragraph is actually arguing.

### **Normal game flow**

- Paragraph displayed (100-200 words depending on level)
- User reads and writes a one-sentence summary in the text input
- User submits
- LLM evaluates meaning preservation and concision
- Feedback shown alongside an example of a strong one-sentence summary

### **Scoring and penalties**

Score on two dimensions: meaning preservation (0-50 points) and concision quality (0-50 points). A summary that preserves meaning but is poorly structured scores differently from one that is elegant but loses key information.

### **Feedback and explanation**

After submission: user's sentence shown alongside an example strong summary. LLM annotation explains what the user got right, what essential meaning was lost or distorted, and what structural improvements would make their sentence more effective.

### **Edge cases**

**User submits multiple sentences**

Soft prompt: 'This looks like more than one sentence - try condensing to just one.' Not a hard block.

**LLM evaluation slow**

Target under 4 seconds. Show evaluation indicator. If timeout, provide basic sentence length and structure feedback only.

_Science: Summarisation tasks are among the most validated dual-skill training techniques - simultaneously improving reading comprehension and writing concision (Kintsch & van Dijk, 1978; Brown & Day, 1983)_

**W7 Thread** \[passive\] ✓ science-backed

**Skills trained:** Given → new ordering, End-focus, Topic continuity, Sentence chaining, Linear progression (Kaplan)

**Input method:** Tap to identify break point, drag to fix

### **Concept**

A paragraph is shown where the given-new structure is deliberately broken - new information appears at the beginning of sentences and given (already known) information appears at the end, reversed from English norms. This causes the text to feel jumpy even though every sentence is grammatically correct.

The user must identify exactly where the thread breaks and then drag-reorder the information within that sentence to restore proper English linear progression (given first, new last).

Pedagogical grounding: Kaplan's contrastive rhetoric shows that Korean, Japanese, and other East Asian rhetorical traditions approach information organisation differently from English linear progression. This game directly targets the source of the 'jumpy paragraph' problem in these writers.

### **Normal game flow**

- Paragraph displayed - thread-broken but grammatically correct
- User reads and taps the sentence where the thread first breaks
- Sentence expands into word-group tiles that can be reordered
- User drags tiles to restore given-new order
- Submit - LLM evaluates whether restored order is correct
- Explanation shows why given-new structure creates flow

### **Scoring and penalties**

Score for identifying the correct break-point sentence (partial credit) plus score for correctly restoring the given-new order within that sentence (full credit).

### **Feedback and explanation**

After submission, the original paragraph is shown with the thread-broken sentence highlighted, then the corrected version shown below. Explanation: 'In English, sentences typically move from what the reader already knows (given) to what is new. This creates a sense of forward momentum. When new information comes first, the reader has to stop and reorient.' The specific given and new elements in the example sentence are colour-coded.

### **Edge cases**

**Multiple thread breaks in one passage**

Each round targets one primary break. Passages must be curated to have a single clear break point. Complex passages with multiple issues do not enter rotation.

**User identifies wrong sentence**

Feedback explains why their chosen sentence is actually well-structured, and reveals the correct break point for learning.

_Science: Explicit instruction in given-new structure measurably improves paragraph coherence for Korean, Japanese, and Chinese L2 writers whose L1 rhetorical patterns conflict with English linear progression (Kaplan, 1966; Connor, 1996; Leki, 1991)_

**W8 Drift Detector** \[passive\] ✓ science-backed

**Skills trained:** Thematic coherence, Topic drift detection, Constant vs linear progression, Derived theme recognition

**Input method:** Tap sentence where drift begins, tap re-focus option

### **Concept**

A multi-paragraph passage is shown where the theme drifts - the essay starts on one clear topic but quietly slides to a different one. The user must identify exactly where the drift begins - the first sentence that breaks thematic coherence - then choose from three 're-focus' options to bring the essay back on track.

Unlike Sentence Judge (R1) which operates at sentence quality level, Drift Detector operates at discourse level - the user must hold the macro-theme in mind across multiple paragraphs and detect when the text stops developing that theme.

### **Normal game flow**

- Multi-paragraph passage displayed (3-4 paragraphs)
- User reads and identifies the first sentence where thematic coherence breaks
- User taps that sentence
- Three re-focus options appear - alternative sentences that restore thematic coherence
- User selects the best re-focus option
- Explanation reveals the drift pattern and why the chosen re-focus works

### **Scoring and penalties**

Two-part score: sentence identification (correct break point) and re-focus selection (best restoration). Full score requires both. Partial credit if correct paragraph but wrong sentence within it.

### **Feedback and explanation**

Explanation covers: what the original macro-theme was, where and how the drift occurred, which thematic progression pattern (constant, linear, or derived) was being used before the drift, and how the re-focus option restores it.

### **Edge cases**

**Drift is too subtle for lower levels**

Drift magnitude scales with user level - lower levels have obvious drifts (different topic entirely), higher levels have subtle drifts (closely related but distinct sub-theme that undermines coherence).

**User disputes the identified drift point**

'Dispute this' mechanism available. These are among the most judgment-dependent items in the app and will generate legitimate disputes - content review queue must handle these.

_Science: Explicit thematic progression instruction measurably improves coherence in EFL academic writing. East Asian EFL learners show particularly strong improvement with direct thematic analysis tasks (Cheng, 2008; Ho, 2009; Danes, 1974)_

**W9 Spotlight** \[active\] ✓ science-backed

**Skills trained:** Main vs subordinate clause weight, Relative clause backgrounding, Passive voice & agent demotion, Cleft sentences, Deliberate information packaging

**Input method:** Multiple choice (phase 1), free text with LLM evaluation (phase 2)

### **Concept**

Different grammatical structures assign different cognitive weight to information. Main clauses receive more reader attention than subordinate clauses. Relative clauses background information. Passive voice demotes the agent. Cleft sentences ('It was X who...') foreground emphasis. Skilled writers choose structures deliberately to control what the reader focuses on.

Phase 1: Two versions of the same sentence appear, one using a main clause for the important information and one burying it in a relative clause or passive. User identifies which version correctly spotlights the key information.

Phase 2: A plain sentence is shown with two information elements labelled as 'foreground' and 'background'. User rewrites the sentence using an appropriate grammatical structure to achieve that packaging. LLM evaluates whether the chosen structure actually foregrounds and backgrounds the correct elements.

Build note: this is the most sophisticated game in the app. Recommend building Phase 1 only for initial launch and adding Phase 2 when LLM evaluation pipeline is stable.

### **Normal game flow**

- Phase 1: Two sentence versions displayed - user selects which correctly spotlights the key information
- Explanation of which grammatical structure was used and why it works
- Phase 2: Plain sentence with foreground/background labels displayed
- User rewrites using a structure that achieves the packaging
- LLM evaluates correctness of information packaging
- Annotated feedback with example of optimal structure shown

### **Scoring and penalties**

Phase 1: binary correct/incorrect. Phase 2: scored on whether the structure correctly foregrounds the labelled element, whether meaning is preserved, and whether the resulting sentence is natural.

### **Feedback and explanation**

Phase 1 explanation names the grammatical structure used (relative clause, passive, cleft, nominalization) and explains its attentional effect in plain language. Phase 2 feedback annotates the user's sentence and shows 1-2 alternative structures that would also achieve the goal.

### **Edge cases**

**Multiple valid structures in Phase 2**

LLM must accept any structure that correctly achieves the foregrounding goal, not just the target structure. Multiple paths to correct packaging should all score full credit.

**User unfamiliar with cleft structures**

A structures reference card is available in-game: a one-screen cheat sheet showing the 5 key structures (main/subordinate, relative clause, passive, cleft, nominalization) with one example each. Accessible via an info button - not shown automatically.

_Science: Explicit instruction in information structure and grammatical weight distribution improves writing sophistication in advanced L2 learners (Biber et al., 1999; Halliday, 1994; Thompson, 2014)_

**S Speaking**

7 games. All active mode (production-based). Voice-first with text fallback on S1 and S5 only. Skills covered: fluency & automaticity, delivery & prosody, pronunciation, pragmatic competence, production under pressure.

**S1 Get It Out** \[active\] ✓ science-backed

**Skills trained:** Direct retrieval (no translating), Real-time sentence construction, Vocabulary retrieval under pressure, Formulaic expression use

**Input method:** Voice (text fallback)

### **Concept**

A scaffold appears on screen: 'I ... \[word\] ... \[word\]'. The user speaks a full sentence using the keyword anchors in their active vocabulary set. The scaffold lowers the production barrier - it gives the user a starting point so they do not freeze - without removing the challenge of constructing a grammatical, natural sentence.

LLM transcribes the spoken sentence and evaluates whether the target words were used correctly in context, whether the sentence is grammatically complete, and whether the usage is natural.

### **Normal game flow**

- Scaffold displayed: 'I ... \[word1\] ... \[word2\]' using words from active vocab set
- User speaks sentence (or types in fallback mode)
- Voice transcribed, LLM evaluates usage quality
- Feedback shows transcription + evaluation
- Next scaffold appears with new words

### **Scoring and penalties**

Score on correct usage of both target words (meaning in context, not just presence), grammatical completeness of sentence, and naturalness of phrasing. Partial credit if one word used correctly and one incorrectly.

### **Feedback and explanation**

Transcription shown. Each target word highlighted in the user's sentence. Evaluation explains whether each word was used correctly and naturally. If usage was off, example of correct usage shown.

### **Edge cases**

**User does not speak target words at all**

If transcription contains neither target word, a prompt appears: 'Try to use both highlighted words in your sentence.' Round does not count as completed until both words appear.

**User produces a sentence that is technically correct but avoids the spirit of the task**

e.g. 'I \[word1\] and \[word2\]' with no context. LLM evaluates naturalness - minimal effort sentences score low on naturalness dimension.

**Voice recognition fails**

If transcription is empty or clearly garbled, offer retry. After 2 failed attempts, prompt to use text fallback.

_Science: Task-based speaking without planning time forces automatisation of L2 knowledge, directly building fluency by bypassing the translation route (Skehan, 1998; Ellis, 2009)_

**S2 Tone Ball** \[active\] ✓ science-backed

**Skills trained:** Word & sentence stress, Pacing, Intonation patterns, Rhythm (stress-timed)

**Input method:** Voice only - real-time audio signal via Web Audio API

### **Concept**

A sentence is shown with stress markers indicating which words should be emphasised. The user reads the sentence aloud. Raising their voice at marked stress points causes a ball to fly upward through gaps in obstacles. Failing to stress a marked word causes the ball to drop. The user must get the ball through all obstacles to complete the round.

Technical implementation: Web Audio API captures microphone input in real time. Volume/amplitude is mapped to ball height. Stress markers correspond to specific word timestamps in the sentence. The game evaluates whether amplitude spikes occur at the right moments in the utterance.

No text fallback for this game - it is inherently voice-only.

### **Normal game flow**

- Sentence displayed with stress markers on specific words
- 3-second countdown before speaking begins
- User reads sentence aloud
- Real-time: ball height tracks voice amplitude, obstacles at non-stressed positions
- Sentence ends - score based on how many stress markers were hit
- Replay available showing amplitude waveform vs target waveform

### **Scoring and penalties**

Score based on percentage of stress markers hit. A stress marker is 'hit' if amplitude exceeds threshold during that word's timestamp window. Missing a marker drops the ball - if it drops past the floor, round ends early.

Over-stressing (high amplitude on unmarked words) does not end the round but reduces score - trains precision, not just volume.

### **Feedback and explanation**

After round, side-by-side display of: user's amplitude waveform, target stress pattern. Sentence shown below with each word colour-coded: green (stress correct), amber (missed stress), red (incorrectly stressed). Audio playback of a native speaker reading the sentence available.

### **Edge cases**

**Microphone permission denied**

Clear permission request UI before game starts. If denied, game cannot be played - show explanation of why microphone is needed and link to device settings.

**Background noise**

Audio signal normalized against ambient noise level captured in first 500ms before speech begins. This baseline subtraction reduces false positives from environmental noise.

**User speaks too fast or too slow**

Timestamp windows for each word are elastic - calibrated to the user's overall speaking pace detected in the first sentence. Speeds and stretches the window proportionally.

_Science: Prosody-focused training with real-time feedback improves intelligibility and naturalness of L2 speech. Visual pitch/amplitude feedback significantly outperforms audio-only training (Derwing & Munro, 2005; Hardison, 2004)_

**S3 Conductor** \[active\] ✓ science-backed

**Skills trained:** Intonation patterns, Rhythm, Word & sentence stress, Chunking & pausing

**Input method:** Voice only - real-time pitch analysis

### **Concept**

A native speaker audio recording of a sentence plays. Each word in the sentence appears as a vertical bar on screen - stressed words appear as taller bars, unstressed words shorter. This visualises the 'shape' of the sentence's stress and rhythm pattern.

The user then speaks the same sentence while their voice generates live bar heights overlaid on the original pattern. The goal is to match the shape - producing their own stress pattern that mirrors the native speaker's.

Unlike Tone Ball (S2) which trains hitting specific stress points, Conductor trains the overall prosodic shape of utterances.

### **Normal game flow**

- Native speaker audio plays with animated bar visualisation
- User studies the shape of the sentence
- User taps 'Speak' and produces the sentence
- Live bars generated from user's voice overlaid on native pattern
- After speaking, comparison view shows side-by-side waveform shapes
- Score based on shape similarity

### **Scoring and penalties**

Shape similarity score - calculated as correlation between user's amplitude envelope and native speaker's amplitude envelope across the sentence duration. Normalised for overall volume differences.

### **Feedback and explanation**

After round, the two waveform shapes shown overlaid with differences highlighted. Audio playback of both user's recording and native speaker available for comparison. Text annotation identifies the specific words where the user's stress pattern diverged most significantly.

### **Edge cases**

**User's overall volume is very different from native speaker**

Amplitude envelopes are normalised before comparison - comparison is of relative shape, not absolute volume.

**User speaks much faster or slower than native speaker**

Time-warping (Dynamic Time Warping algorithm) applied before shape comparison - this aligns the two waveforms temporally before scoring.

_Science: Visual pitch and amplitude feedback in real time significantly improves suprasegmental production in L2 learners compared to audio-only training. Shape-matching approach mirrors effective perceptual training methods (Hardison, 2004; Derwing et al., 1998)_

**S4 Chunk It** \[active\] ✓ science-backed

**Skills trained:** Chunking & pausing, Pacing, Rhythm, Connected speech

**Input method:** Voice + simultaneous tap

### **Concept**

A sentence appears with no punctuation and no visual cues indicating where pauses should fall. The user reads it aloud and taps the screen at every natural pause boundary - each tap generates a visible chunk divider under the word at that point. After the user finishes, the native speaker version plays and the native chunking pattern is revealed. The user's chunks and the native speaker's chunks are shown side by side.

This game makes invisible prosodic structure visible and comparable. Non-native speakers often either pause too frequently (word by word) or not at all, producing speech that sounds robotic or rushed.

### **Normal game flow**

- Sentence displayed - no punctuation, no pause markers
- User reads aloud and taps at each natural pause
- Chunk dividers appear in real time under the sentence
- After sentence complete, user's chunking shown
- Native speaker version plays with native chunk pattern revealed
- Side-by-side comparison shown with score

### **Scoring and penalties**

Score based on overlap between user's chunk boundaries and native speaker's chunk boundaries. Exact matches score full. Adjacent (one word off) score partial. Missing a boundary and adding a boundary where none exists both reduce score.

### **Feedback and explanation**

After comparison, each chunk boundary is annotated: correct matches shown in green, user boundaries that don't match shown in amber, native boundaries the user missed shown in red. Brief explanation of why each native boundary falls where it does (e.g. 'This boundary falls after the subject phrase - native speakers typically pause between subject and predicate in longer sentences').

### **Edge cases**

**User taps too fast (every word)**

If user produces more than N chunk boundaries where N > 2x the expected number, a soft note appears after the round: 'You may be pausing too often - natural speech usually groups more words together.'

**User does not tap at all**

If no taps detected before sentence ends, a prompt appears: 'Tap the screen wherever you naturally pause while speaking.'

_Science: Chunking and phrasal boundary awareness training improves spoken fluency and listener comprehension ratings. Prosodic phrase grouping is a key marker of L2 speaking proficiency (Pawley & Syder, 1983; Wennerstrom, 2001)_

**S5 Hot Seat** \[active\] ✓ science-backed

**Skills trained:** Spontaneous response speed, Direct retrieval (no translating), Speech acts, Politeness strategies, Register switching

**Input method:** Voice (text fallback)

### **Concept**

A real-life situation description flashes on screen (e.g. 'Your boss asks why you missed the deadline', 'A friend wants to borrow something you don't want to lend'). One or two target words from the user's active vocabulary set glow. A clock visibly shrinks. The user must speak a natural response to the situation using the target word(s) before the clock runs out.

This game trains the most critical and most difficult speaking skill: producing appropriate language in real time under conversational pressure, without time to plan or translate. The situation context trains pragmatic competence - not just using the word, but using it appropriately for the social situation.

### **Normal game flow**

- Situation description displayed with glowing target word(s)
- Clock begins shrinking immediately
- User speaks response using target word(s)
- Clock expires or user finishes speaking
- Transcription shown + LLM evaluation
- Example of a strong response shown for comparison

### **Scoring and penalties**

Score on: target word usage (correct in context), appropriateness to situation (right speech act, right register, right politeness level), response completeness, and speed (faster responses within reason score slightly higher than very slow ones).

Clock duration scales with user level: lower levels 12-15 seconds, higher levels 6-8 seconds.

### **Feedback and explanation**

Transcription shown with target words highlighted. LLM evaluation covers: did the response fit the situation appropriately, was the target word used correctly, was the register right for the social context. An example strong response is always shown - not as the only right answer but as a reference point.

### **Edge cases**

**User freezes and says nothing**

Clock expires, round counts as incomplete. Encouragement message shown (no negative framing), example response shown. The freeze itself is data - if user freezes consistently on certain situation types, the app silently adjusts to give more scaffolding for those situations.

**Response is appropriate but does not use target word**

Partial score - situation handling correct, word usage missed. Prompt to try again using the target word shown.

**Situation is culturally confusing**

'Dispute this situation' button available. Cultural sensitivity in situation design is critical - situations must be globally recognisable, not US-or-UK-specific.

_Science: Unprepared speaking tasks under time pressure directly build automaticity and reduce translation-mediated processing. Pragmatic competence is best trained in context-rich situational tasks (Ellis, 2009; Taguchi, 2011)_

**S6 Immediate** \[active\] ✓ science-backed

**Skills trained:** Direct retrieval (no translating), Lexical access speed, Hesitation management, Spontaneous response speed

**Input method:** Voice only

### **Concept**

An image or emoji sequence appears on screen. No words anywhere - no instructions, no labels, no text at all. The user has exactly 3 seconds to begin speaking in English about what they see. A countdown is visible. If they do not start speaking within 3 seconds, the round resets.

The core mechanic is the elimination of text. Because there is nothing to read, there is nothing to translate from. The user must retrieve English directly from the visual stimulus - the same way fluent speakers produce language. This trains the direct L1→English bypass that is the ultimate goal of the fluency axis.

No text fallback for this game - text input defeats the entire purpose.

### **Normal game flow**

- Image or emoji sequence appears - no text on screen at all
- 3-second countdown begins immediately
- User must start speaking before countdown ends
- If speaking detected within 3 seconds, full speaking time granted (up to 15 seconds)
- If no speech detected in 3 seconds, round resets with new image
- LLM transcribes and evaluates: relevance to image, sentence completeness, fluency

### **Scoring and penalties**

Score on: did user start within 3 seconds (binary gate - round resets if not), relevance of response to image content, sentence completeness, and fluency markers (absence of long hesitations, false starts, filler overuse in transcription).

Consecutive successful starts (within 3 seconds) build a streak multiplier.

### **Feedback and explanation**

After response, the image is shown with transcription below. LLM annotation highlights: what the user successfully described, what key elements of the image were missed, any unnatural phrasing. A brief ideal response example shown for comparison.

### **Edge cases**

**User speaks their L1 language instead of English**

LLM language detection flags non-English responses. Gentle prompt: 'Try in English!' Round resets. If this happens repeatedly, a note appears that this game is English-only.

**Image is culturally confusing or ambiguous**

Images curated for global recognisability. No culturally specific imagery (holidays, foods, gestures with culture-specific meanings). Fallback to emoji sequences which are more universally understood.

**User speaks too quietly to detect speech onset**

Speech onset detection threshold calibrated to ambient noise level. If detection consistently fails, prompt user to adjust microphone or speak louder.

_Science: Removing L1 text stimuli eliminates the translation route. Image-prompted L2 speech production is a validated technique for reducing L1 mediation and building direct L2 lexical access (Jourdenais et al., 1995; Tomlinson, 2001)_

**S7 Shadowing+** \[active\] ✓ science-backed

**Skills trained:** Phoneme accuracy, Connected speech, Weak forms & reduction, Vowel distinctions, Consonant clusters, Rhythm

**Input method:** Voice only

### **Concept**

The classic shadowing technique - repeat after native audio - gamified with multi-dimensional scoring on pronunciation accuracy, rhythm match, stress placement, and connected speech features. A comparison waveform is shown after each attempt.

Unlike basic shadowing, Shadowing+ explicitly scores and visualises the features that make the difference between intelligible and natural-sounding English: weak form reductions (gonna, wanna, d'you), connected speech phenomena (linking, assimilation, elision), and the overall rhythmic envelope.

Shadowing+ is the most research-backed game in the entire app - the methodology has the strongest evidence base across all skill axes.

### **Normal game flow**

- Sentence displayed - native speaker audio plays automatically
- User listens (and may read along)
- Recording begins - user repeats the sentence
- Waveform comparison displayed after recording
- Multi-dimensional score shown: pronunciation, rhythm, stress, connected speech
- Replay available for both native and user recordings
- Option to repeat same sentence for improvement

### **Scoring and penalties**

Four-dimension score: Pronunciation accuracy (phoneme-level, using speech recognition confidence scores), Rhythm match (amplitude envelope correlation, same as Conductor), Stress placement (amplitude peaks at correct positions), Connected speech (detection of expected linking and reduction phenomena in transcription).

Repeat attempts on the same sentence: score updates if improved, best score kept. Unlimited repeats encouraged - the learning is in the repetition.

### **Feedback and explanation**

After each attempt: waveform comparison shown (user vs native), sentence annotated with dimension-specific feedback (e.g. specific phonemes scored low highlighted in red, missing weak forms marked). Native audio always available for comparison playback.

After 3+ attempts on the same sentence, a summary shows improvement trajectory across attempts.

### **Edge cases**

**User's accent is very different from native speaker**

Scoring weighted toward intelligibility markers (correct stressed syllables, phonemic contrasts that cause misunderstanding) over accent-neutral features. The goal is natural and understandable, not accent elimination.

**Connected speech features absent in user's recording**

Weak forms and connected speech are flagged in feedback but do not dominate the score for lower levels. Higher levels are expected to produce more connected speech features.

**Sentence contains content words the user does not know**

Sentences are drawn from the user's active vocabulary set where possible, ensuring the user is not struggling with unfamiliar words on top of pronunciation.

_Science: Strongest evidence base in the app. Systematic review of 44 studies confirmed shadowing improves comprehensibility, intelligibility, fluency, and prosody across L2 learner populations. Brain imaging shows measurable changes in the phonological loop region (Hamada, 2019; Hamada & Suzuki, 2024)_

English Learning App · Complete Game Specifications · v1.0 · June 2026