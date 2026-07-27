# Assessment calibration

What the assessment prompts are measured against, what the numbers are today,
and how to move them. Every figure here came from data in this repo or in
Appwrite — none of it is an estimate.

## The loop

```bash
# 1. Build fixtures from the tutor-marked corpus (43 essays, 770 anchored comments)
python3 scripts/build-tutor-fixtures.py

# 2. Recall: does the pipeline flag what a real marker flagged?
npx tsx scripts/eval-assessment-recall.ts --runs 3 --out tmp/eval/v8.json
npx tsx scripts/eval-assessment-recall.ts --runs 3 --baseline tmp/eval/v8.json

# 3. Calibration: do the bands match human examiners, across the whole scale?
npx tsx scripts/analyze-benchmark-calibration.ts --out tmp/eval/calibration.json
npx tsx scripts/analyze-benchmark-calibration.ts --baseline tmp/eval/calibration.json
```

Run recall **at least 3 times per variant**. Finding counts moved 0–5 across
reruns of an unchanged pipeline, and the reference engine's own scores moved a
mean of 0.87 bands on identical input. A single run cannot tell a prompt
improvement from noise.

Requires provider keys (`GROK_API_KEY` / `DEEPSEEK_API_KEY` / `MIMO_API_KEY`)
and `APPWRITE_API_KEY` in `.env.local`. Behind an egress proxy, prefix with
`NODE_USE_ENV_PROXY=1` — Node's `fetch` ignores `HTTPS_PROXY` otherwise.

## Ground truth

| Source | Size | What it gives |
|---|---|---|
| `sample essay/Kho bài chấm T8 - *.csv` | 43 essays, 770 anchored comments, 8 markers | Recall targets: exact spans a human marker chose to flag |
| Appwrite `benchmark_reference_jobs` | 561 essays with human bands (4.0–8.5) | Calibration targets |
| Appwrite `benchmark_reference_results` | 519 generated assessments | Failure-mode analysis |
| `marked script/` | 128 examiner-marked PDFs | Band-justification language |

The tutor corpus is one team's house style — 818 of 966 comments come from a
single marker — so treat its **proportions** as strong evidence and its
**absolute density** as that team's teaching norm rather than an examiner
standard.

## Baseline, July 2026

### Criterion mix — the largest gap

| Criterion | Tutors | Generated assessments |
|---|---:|---:|
| Lexical Resource | **52.0%** | 13.5% |
| Task Response | 28.7% | **42.3%** |
| Grammar | 11.3% | 28.8% |
| Cohesion | 4.8% | 6.3% |
| Coherence | 0.6% | 6.5% |

Roughly inverted on the top two. Per-essay target implied by the tutor corpus:
~8 lexical, ~5 task response, ~2 grammar, ~1 cohesion, ~0 coherence.

Coherence carries the most elaborate machinery in the pipeline for a phenomenon
that appears in 5 of 770 human comments. Exactly one paragraph-reordering
comment exists in 43 essays.

### Density

Tutors leave a median of **18 comments per essay** (min 4, max 35) — about one
flagged span per 20 words. The reference engine averages 4.4 and never returns
zero; v8 returned zero findings in 3 of 14 committed reruns.

### Band calibration

Aggregate agreement is 86.4% within half a band, **but the reference prompt
hands the model the human scores** and tells it to re-check itself if it differs
by more than 0.5. That figure is an open-book result and is not evidence of
scoring skill. Use `blindScores` for any honest measurement.

Bias curve, from `analyze-benchmark-calibration.ts` (slope **−0.272 band/band**;
0 is calibrated):

```
human 4.0   n=23    +0.63        human 7.0   n=118   −0.39
human 5.5   n=82    −0.16        human 8.0   n=39    −0.73
human 6.0   n=158   −0.07        human 8.5   n=3     −0.67
```

Cause is measured, not guessed: regressing model score on human score plus the
major-finding count gives **−0.27 bands per major label** at fixed ability. At
human band 8, zero majors scored 7.94; two majors scored 5.50.

### Output hygiene

| Defect | Rate |
|---|---|
| Chinese characters in Vietnamese prose | 69.0% of assessments |
| English fused into Vietnamese phrases | 61.9% |
| Lexical evidence quotes absent from the essay | 12.4% |
| `Overall` violating its own stated arithmetic | 32.4%, always upward |
| Exactly 2 Do-Not-Penalize items regardless of band | 64.8% |
| Findings falling into 11 recurring templates | 80.2% |

### Density does not fall with band

From the 128 marked scripts, problem findings per script (excluding rubric rows
and praise):

| Band | scripts | median | mean |
|---|---:|---:|---:|
| 5.5 | 15 | 11 | 17.8 |
| 6.0 | 28 | **18** | 18.1 |
| 6.5 | 35 | 10 | 13.1 |
| 7.0 | 23 | 10 | 13.3 |
| 7.5 | 16 | 11 | 12.8 |

**No script in the corpus has zero annotations; the minimum observed is 2.**
Band 6 is the most annotated, and above it density plateaus at 10–13 rather than
collapsing. What changes with band is *tone*: praise rises monotonically
14.2% → 16.2% → 19.9% → 21.2% → 25.2%.

So "a short list is better than a long list" and "an empty findings list is
valid" are both calibrated below the ground truth at every band.

## Why cohesion and coherence cannot be measured

Both sit at 5-13 anchors, which is not enough to tell a prompt change from
noise. The limit is anchor recovery, and it is partly irreducible.

An anchor comes from the pale highlight rectangle Word draws over a comment's
range. 64% of real examiner comments carry one; 757 margin comments do not. On
inspection the missing ones are not a colour-detection failure -- the pale pink
fill (1.00, 0.83, 0.83) is found correctly and the pure red (1.00, 0.00, 0.00)
tracked-change marks are correctly rejected. There are simply fewer rectangles
than comments in the source:

    2band7essays.pdf     36 comments, 29 anchor rects
    5.5-walking-t2.pdf   19 comments, 11 anchor rects

Word omits the highlight when a comment anchors to a point rather than a range,
and adjacent rectangles merge. So a share of examiner comments has no recoverable
anchor at all, and no extractor change recovers it.

Routes that would work, in order of cost:

1. Read the `.docx` originals if they still exist. Comment ranges are explicit
   there, and none of this reconstruction would be needed.
2. Pair unanchored comments to essay text by vertical position alone, accepting
   a looser anchor and scoring with a sentence-level rather than span-level
   match.
3. Hand-anchor a few dozen cohesion and coherence comments. At 5-13 anchors
   today, even 40 would make the criteria measurable.

## Known gap: no strengths channel

Examiners spend 14–25% of their annotations on praise, and the share *rises*
with band — it is how a strong essay is shown what earned its score. The
pipeline cannot express this today, which is why a clean band-8 essay gets a
report that is empty rather than affirming.

The type layer was built for it and then closed off. `POSITIVE_LANGUAGE_CODES`
in `writing-assessment-findings.ts` already defines `strong_academic_phrase`,
`controlled_complex_structure`, and `worth_preserving`, and
`confirmedFindingCounts` deliberately excludes them. But every specialist prompt
says "do not praise", and `focusedFindingErrors` **requires** `repairVi` plus a
`replacementText` on every lexical and grammar finding — a strength has neither,
so a praise finding fails validation and takes the whole specialist pass down
with it.

Implementing it needs a separate optional array rather than a repurposed
finding:

1. Add `strengths?: Array<{ evidence: QuoteEvidenceInput[]; noteVi: string }>` to
   `V7CriterionPass`.
2. Validate it in `v7CriterionPassErrors` only when present — evidence must
   resolve against the essay, `noteVi` must be non-empty and free of Han
   characters. Never require a repair.
3. Map entries into `lexicalHighlights` / `grammaticalHighlights` with
   `errorCode: 'worth_preserving'` so the existing positive-highlight path
   picks them up.
4. Ask for them in the specialist prompts, scaled to band: roughly one at band 6,
   three or more at band 8.

Do this behind the harness, not blind — a malformed strength is the same failure
mode as the band-8 filter bug.

## Targets

| Metric | Now | Target |
|---|---|---|
| Bias slope (blind) | unmeasured | \|slope\| < 0.10 |
| Lexical share of findings | 13.5% | 35–50% |
| Task Response share | 42.3% | 25–35% |
| Findings per essay | 4.4 | 8–15 |
| Zero-finding runs | 3 of 14 (v8) | 0 |
| CJK contamination | 69.0% | 0% |
| Hallucinated evidence | 12.4% | < 1% |
| Same-essay score spread | 0.87 bands | < 0.5 |

## Changes already made against this baseline

- `filterLowSignalFindingsForHighBand` kept style preferences and dropped real
  wrong-meaning errors at band 8+ (`đúng nghĩa` matched inside `không đúng
  nghĩa`), then dropped every remaining minor finding. Hard errors now survive.
- `blindScores` withholds human bands from the reference prompt and from the
  post-generation filter.
- Reference prompt: score-before-hunt ordering, band-conditioned error budget,
  low-band anchors, absolute CJK rule, English allow-list, evidence-copying
  rules, explicit `Overall` arithmetic, no fixed section lengths.
- v8 specialists: band descriptors attached (they had none — `CRITERION_SCORE_SYSTEMS`
  was reachable only from v6), lexical upgrades legitimised as minor findings,
  sentence-splitting added as the leading grammar family, cohesion led by
  unresolvable reference and missing link.

### Verified

The band-8 filter is pure and needs no model call, so its change was replayed
over the 127 findings that actually occurred on the 41 band-8+ essays in the
corpus (`scripts/verify-high-band-filter.ts`):

| | kept | essays left with nothing |
|---|---:|---:|
| old filter | 91 of 127 (71.7%) | 1 (2.4%) |
| current filter | 116 of 127 (91.3%) | **0** |

32 findings recovered: 13 task response, 8 grammar, 6 lexical, 4 cohesion,
1 coherence. Spot-checking the minor-severity findings on those essays shows the
intended discrimination — `"dietary products" dùng sai` is kept, `Từ vựng không
tự nhiên / Collocation` is dropped.

### Prompt A/B results

Both variants driven through the same stand-in model, blind to the answer key,
scored against the tutor anchors on 3 essays (`scripts/score-prompt-ab.py`).

**Lexical Resource** — 48 human anchors:

| variant | findings/essay | recall | on human-marked text |
|---|---:|---:|---:|
| old | 12.3 | 43.8% | 81.1% |
| **current** | 21.3 | **56.2%** | 67.2% |
| bounded (reverted) | 13.3 | 43.8% | 80.0% |

Legitimising register and precision upgrades recovered 12.4 points of recall,
with 28 of the added findings landing on human-marked spans. A density bound
added afterwards gave the entire gain back — naming a target count gave the
model a number to optimise instead of a judgment — and was reverted.

**Grammar** — 15 human anchors:

| variant | findings | recall | full-sentence quotes |
|---|---:|---:|---:|
| old | 33 | 73.3% | 0 |
| **current** | 25 | **80.0%** | 6 |

Better on both axes. The full-sentence quotes are the sentence-splitting family
appearing, which is correct for that family: the split is the repair.

**Cohesion** — 7 human anchors, directional only:

| variant | findings | recall | quotes <= 3 words |
|---|---:|---:|---:|
| old | 12 | 28.6% | 0 of 23 |
| **current** | **6** | 28.6% | **5 of 12** |

Half the findings for the same recall, and the evidence granularity moved toward
what tutors actually mark: their cohesion anchors are a single word 70% of the
time, because the finding is the unresolvable pronoun itself. Recall of 28.6% is
poor in absolute terms, but 2 of 7 anchors is too small to read as a rate.

Every arm quoted the essay verbatim 100% of the time.

**Coherence still has no usable answer key**, from either corpus.
`scripts/build-coherence-fixtures.py` reduces the examiner corpus's 90 anchored
coherence comments to **7 anchors across 6 scripts**: 21 scripts are dropped
because the extracted body is a whole teaching packet rather than a 200-600 word
answer, and 41 anchors are dropped as fragments under four words or as text that
does not resolve against the cleaned body. The bottleneck is anchor-recovery
quality in the extractor, not the corpus size. Fix that before reading any
coherence result.

Original note on the tutor corpus, which is the other half of the problem:
**Coherence cannot be A/B'd against this corpus.** The three A/B essays carry
zero coherence anchors, and the whole 43-essay tutor corpus carries five, across
five essays. That is not a gap in the fixtures — it is the finding: the tutor
team almost never comments on coherence, which is why the criterion is 0.6% of
their output. Testing the coherence pass needs the examiner corpus instead
(`tmp/corpus/classified-comments.json`, 135 coherence comments, 5.8%), whose
anchors are recovered highlight spans rather than exact quotes and so need a
looser matcher than `score-prompt-ab.py` uses today.

Cohesion is testable but thin: 7 anchors across the three essays, 35 across the
corpus, and 22 of 43 essays have none at all. Treat any cohesion result as
directional.

### Model x prompt matrix, measured on the real provider

3 essays, 3 runs per cell, scored against the tutor lexical anchors. Recall is
averaged across runs; band spread is max minus min band on the *same* essay.

| model | prompt | recall | findings/essay | band spread |
|---|---|---:|---:|---:|
| mimo-v2.5 | old | 25.6% | 5.1 | 1.0 |
| mimo-v2.5 | new | 17.4% | 3.8 | 1.3 |
| mimo-v2.5-pro | old | 24.5% | 6.2 | 0.8 |
| mimo-v2.5-pro | new | 27.1% | 7.2 | 0.7 |
| stand-in model | old | 45.3% | 12.3 | **0.0** |
| stand-in model | new | **57.4%** | 21.3 | **0.0** |
| human marker | — | 100% | 16.0 | — |

**The model dominates the prompt.** Every MiMo cell sits at 17-27% recall
whichever prompt runs; the same two prompts reach 45-57% elsewhere. Upgrading
tier buys almost nothing: pro gains 1.5 points over v2.5 on the new prompt and
loses 1.1 on the old.

**The prompt change only helps a model strong enough to use it.** It gained 12.1
points on the stand-in model, lost 8.2 on mimo-v2.5, and gained 2.6 on pro. A
longer, denser prompt makes the weaker model more conservative, not more
thorough.

**MiMo cannot score an essay reproducibly.** Band spread on identical input runs
0.7-1.3 across every MiMo cell, against 0.0 for the stand-in model. mimo-v2.5
returned bands 7, 6 and 8 on one essay and 9, 6 and 8 on another. A student
resubmitting unchanged work can move a full band or more.

Both MiMo tiers also produced findings quoting text absent from the essay (2 per
arm). The stand-in model produced none in 18 calls.

### DeepSeek v4 Pro against MiMo, same prompts

Current prompts, same fixtures, praise-filtered, 2 runs each:

| criterion | model | recall | findings/essay | band spread |
|---|---|---:|---:|---:|
| grammar | mimo-v2.5 | 40.0% | 7.1 | 0.30 |
| grammar | **deepseek-v4-pro** | **42.5%** | 11.9 | **0.10** |
| lexical | mimo-v2.5 | 24.4% | 8.6 | 0.73 |
| lexical | **deepseek-v4-pro** | **30.0%** | 12.7 | **0.30** |

Recall gains are modest -- 2.5 points on grammar, 5.6 on lexical. The consistency
gain is not. Band spread on identical input falls from 0.30 to 0.10 on grammar
and from 0.73 to 0.30 on lexical, so DeepSeek scores the same essay the same way
two to three times more reliably. MiMo returned bands 7, 6 and 8 on one essay
earlier in this work; that behaviour is what the spread column measures, and it
is a product-credibility problem rather than an accuracy one.

DeepSeek also writes closer to examiner density, 12-13 findings per essay against
MiMo's 7-9, and drops fewer quotes as unverifiable (4 and 2, against 0 and 4).

### Cohesion: the rewrite is reverted

Examiner data alone gives 5 cohesion anchors, so this combines it with the tutor
corpus, which has more for this one criterion. 18 scripts, 23 real anchors after
praise filtering:

| arm | recall | findings/essay | precision |
|---|---:|---:|---:|
| original | **4.8%** | 1.6 | 3.8% |
| lead-in rewrite | 1.9% | 1.1 | 2.9% |

The lead-in told the pass to look for two problems first and that many essays
yield none. That is the same suppressive shape that cost Task Response two
thirds of its recall, and it did the same here. Reverted.

Read this cautiously: precision is 3-4% in both arms, meaning almost nothing
either prompt finds lands where a human marked. At 23 anchors the recall gap is
roughly one anchor. There is no evidence the rewrite helped and weak evidence it
hurt, so the original stands as the conservative default rather than because the
measurement is strong.

### Splitting Task Response beats rewriting it

Prompt wording cannot move Task Response, but decomposition can. Three narrow
sub-passes, each told to ignore what the others handle, run on the same 12
examiner scripts:

| combination | recall | precision | spans/essay |
|---|---:|---:|---:|
| current single pass | 14.4% | 35.0% | 3.6 |
| development only | 14.6% | 28.6% | 2.0 |
| coverage only | 7.1% | 31.2% | 2.0 |
| development + coverage | **19.6%** | 27.6% | **2.4** |
| all three, with specificity | **39.3%** | 18.6% | 13.9 |

Examiners mark 3.5 anchors per essay, which sets the sane volume.

Two usable options, and the choice is a product decision rather than a technical
one. **development + coverage** raises recall by a third at examiner-like volume
and a small precision cost. **All three** nearly triples recall, but the
specificity pass alone emits 11.5 spans per essay at 16.7% precision — it flags
every abstract noun phrase, so a student would face four times the comments an
examiner writes, most landing on text no marker touched.

Neither is wired in. The specificity pass needs a tighter trigger before it earns
a place; development + coverage is ready to try in production, as two entries in
the existing fan-out instead of one Task Response call.

### Task Response has a ceiling that prompts do not move

Four prompts, same 12 examiner scripts, praise-filtered anchors, MiMo:

| prompt | recall | findings/essay |
|---|---:|---:|
| original | **11.2%** | 1.7 |
| + band-conditioned guard | 3.6% | 1.1 |
| + softened guard | 10.3% | 1.1 |
| clean rewrite, restrictive | 4.2% | 0.9 |
| clean rewrite, elicitation | 11.2% | 1.4 |

The two rewrites share no wording with the original: one leads with the seven
problems examiners actually flag and adds five "do not report" rules, the other
walks the essay in three passes and pushes explicitly for coverage. Neither beats
the original, and the restrictive one is catastrophic.

The pattern across all four is that any added restriction costs both recall and
finding count, while added elicitation only restores parity. MiMo emits 1.7 Task
Response findings per essay and there is nothing to prune; the constraint is not
the instructions.

Stop tuning this prompt. The routes that remain are a different model for this
pass, or decomposing Task Response into narrower sub-passes (coverage, position
consistency, per-paragraph development) so each asks for less at once.

### Praise contaminates the anchor sets

Examiners write approval as well as criticism, and the classifier files it under
a criterion rather than as non-assessable. So a share of every anchor set is
something the system is right *not* to flag as a problem, and scoring against it
inflates recall:

    task_response  42% of anchors are praise
    coherence      31%
    grammar        30%
    lexical        14%

Scoring the same runs with praise anchors removed changes one conclusion
outright:

| criterion | old (all) | new (all) | old (real) | new (real) |
|---|---:|---:|---:|---:|
| grammar | 18.8% | 34.4% | **25.0%** | **40.0%** |
| lexical | 13.1% | 21.6% | **14.3%** | **24.4%** |
| task response | 10.6% | 10.3% | **9.7%** | **3.6%** |
| coherence | 8.3% | 4.2% | 12.5% | 6.2% |

Grammar and lexical gains are larger than first measured. Task Response was not
flat -- the guard made it materially worse, 9.7% down to 3.6%, and the praise
anchors hid that. It is reverted.

Any future fixture build should drop praise before scoring.

### Measured against clean examiner fixtures

The only numbers in this file scored against reconstructed examiner scripts --
the student's own text, examiner markup removed -- on MiMo, 12 scripts per
criterion, 2 runs each.

| criterion | arm | recall | findings/essay | dropped |
|---|---|---:|---:|---:|
| Task Response | old | 10.6% | 1.7 | 21 |
| Task Response | current | 10.3% | 1.1 | 15 |
| Lexical Resource | old | 13.1% | 7.9 | 4 |
| Lexical Resource | **current** | **21.6%** | 8.4 | 4 |
| Grammar | old | 18.8% | 7.1 | 6 |
| Grammar | **current** | **34.4%** | 7.0 | 0 |
| Coherence | old | 8.3% | 0.5 | 4 |
| Coherence | current | 4.2% | 0.5 | 4 |

**The lexical change is real.** +8.5 points against examiner marking, at almost
the same finding count, with only 4 quotes dropped either side. It survived the
switch from tutor to examiner ground truth, which the tutor-corpus figure
(+12.4) could not have predicted on its own.

**The grammar change is the largest verified gain.** +15.6 points at an
identical finding count, and unverifiable quotes fall from 6 to 0. Promoting
sentence-splitting to the leading family and attaching band descriptors did real
work against examiner marking.

**Coherence is not being reported at all.** Both arms emit 0.5 findings per
essay, so the recall difference (8.3% vs 4.2%) is one anchor either way on a
13-anchor set and means nothing. The signal that matters is the finding count:
the model almost never produces a coherence finding, whichever prompt runs. That
is consistent with coherence being 5.8% of examiner comments and 0.6% of tutor
comments -- it may be close to correct behaviour rather than a defect.

**Task Response is close to non-functional and no prompt change moves it.**
10.6% to 10.3% is noise. The criterion carrying the most weight in a band
catches about one examiner observation in ten and emits 1.1-1.7 findings per
essay. Every prompt lever tried on it has produced nothing or a regression --
the band-conditioned guard cost a third of recall before being softened, and
softening made it inert. This needs a different model or a different decomposition,
not more wording.

Task Response also still drops 15-21 findings as unverifiable against 4 for
lexical, so its true recall is somewhat higher than 10% -- but not near the
26.5% the tutor corpus suggested. The tutor numbers were systematically
optimistic.

### The harness was not sending what production sends

Found late, and it qualifies every old-vs-new number above.

Production sends each specialist `JSON.stringify({taskPrompt, essay,
promptProfile})` and always supplies a profile, falling back to a synthetic one
if the profile pass fails. The A/B harness sent plain text and no profile at
all. Every *current* prompt opens with "Use the supplied promptProfile if
present" plus instructions for reading `hardRequirements` and
`conditionalRequirements`; every *baseline* prompt predates that block. So the
new arms were scored while following instructions about data that was not
there, and the old arms were not.

Direction of the bias: it penalises the new arm. Grammar (+15.6) and lexical
(+8.5) won anyway, so those are understatements, not artefacts. Cohesion and
coherence lost, so for those the confound had to be ruled out before reading
anything into the prompts. `--profile` now opts into the production payload.

A second harness bug: `--model` was accepted and silently ignored, so a run
could land on the provider default while its log claimed otherwise. One cohesion
sub-pass result was produced on `deepseek-chat` while reporting
`deepseek-v4-pro`. Both are fixed.

### The cohesion metric fails its own null control

**Run this before believing any cohesion number, including the ones below.**

A composition ablation accidentally ran the same prompt twice. `abl-coh-A-lean`
and `prof-coh-old` are byte-identical files (verified with `diff`), run on the
same model, with the same production payload, at the same run count of 4.

| arm | prompt | recall |
|---|---|---:|
| A lean core only | `coh-old.txt` | **2.8%** |
| old baseline | `coh-old.txt` (identical) | **12.5%** |

Same prompt. Same everything. A 9.7-point gap from sampling alone.

That noise band swallows every difference ever measured on this fixture set.
The full ablation illustrates the same thing -- the ordering is not stable
enough to interpret:

| arm | recall | findings/essay |
|---|---:|---:|
| A lean core only | 2.8% | 1.3 |
| B core + descriptors | 15.6% | 1.4 |
| C profile + core | 26.5% | 1.6 |
| D core + "look for these first" | 0.0% | 0.9 |
| full shipped | 5.6% | 1.3 |
| old baseline (= A) | 12.5% | 1.6 |

**Retracted:** an earlier version of this file claimed the current cohesion
specialist measures worse than the lean one it replaced, on the strength of
three samples agreeing in direction. The null control shows three samples can
agree in direction by chance here. That claim is withdrawn; the shipped
cohesion prompt is neither confirmed better nor confirmed worse.

Also retracted earlier: that splitting cohesion into "unresolvable reference"
and "faulty connective" sub-passes doubled recall (30.0% vs 15.0%). It did not
survive raising the run count (25.0% vs 26.7%).

The general lesson is about method, not cohesion: **on a small fixture set, run
the same arm twice before comparing two different arms.** Direction agreeing
across samples is not evidence when the null gap is as large as the effect.

### Cohesion: procedures raise volume, not discrimination

Measured on the recovered 19-script / 21-anchor set, which passes its null
control (same prompt twice: 7.5% and 7.4%, a 0.1-point gap).

| arm | recall | coverage | lift | findings/essay |
|---|---:|---:|---:|---:|
| shipped cohesion | 7.5% | 8.8% | 0.85x | 1.0 |
| procedure: substitution chains | 38.7% | 40.1% | 0.96x | 9.6 |
| procedure: connective inventory | 32.4% | 41.3% | 0.78x | 8.6 |

Both procedures are step-by-step routines built from the examiner taxonomy --
the largest categories being missing substitution (43%) and connective
over-density (19%), neither of which the shipped prompt targets. They work as
designed: findings per essay rise from 1.0 to ~9.

They do not find what the examiner found. Recall tracks coverage almost
exactly, so the extra hits are what spraying 40% of an essay collects. On raw
recall these read as 5x and 4x improvements and would have shipped.

Nothing tested for cohesion -- shipped, lean, two sub-passes, two procedures --
exceeds chance. Cohesion is not a wording problem at this point, and more
prompt variants are not the next experiment.

Note on run hygiene: the first attempt at both procedures failed 75 of 76 runs
with empty content. These are reasoning-heavy prompts and MiMo spends the
budget on reasoning_content, returning content empty. Procedural prompts need
ASSESSMENT_LLM_MAX_TOKENS well above the 8000 default; 32000 dropped failures
to 3. An early score of "0.0% recall" for the connective arm was read off the
starved run and was wrong.

### Cohesion and coherence cannot be decided at this corpus size

Cohesion has **9 examiner anchors** in the entire corpus (7 after praise
filtering); coherence has 15. The same prompt, unchanged, scored 15.0% and then
26.7% purely from raising the run count. That swing is larger than every gap
between arms measured on this set.

An earlier reading that splitting cohesion into "unresolvable reference" and
"faulty connective" sub-passes doubled recall (30.0% vs 15.0%) did not survive
4 runs (25.0% vs 26.7%). It was noise and is not a result.

Nothing about these two criteria should be shipped on measurement until the
anchor count rises. This is a data problem, not a prompting problem.

### The production model has never been measured

Production defaults to Grok (`ASSESSMENT_LLM_PROVIDER || 'grok'`). No
`GROK_API_KEY` has been available in any session that produced these numbers.
Everything above was measured on MiMo v2.5 or DeepSeek v4 Pro. DeepSeek's
balance is now exhausted, leaving MiMo as the only working provider.

Model choice has already been shown to change conclusions, not just magnitudes:
the coherence rewrite measured flat on MiMo (6.2% both arms) and positive on
DeepSeek (13.3% to 18.8%). A prompt gain can be invisible on a model too weak to
act on it. **Re-run the loop on Grok before trusting any of these figures for
production.**

### Not verified

Everything else. No provider key was available in the session that made these
changes, so **zero essays were run through the pipeline**. Each prompt change is
an evidence-backed hypothesis about a model whose behaviour was measured only in
its previous configuration. **Run the loop before trusting any of them**, and
revert anything that does not move its number.
