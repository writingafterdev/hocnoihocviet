/**
 * Experimental prompt version: v10-stable-candidate.
 *
 * Builds on v8 candidate-only. Keeps all criteria in candidate-only mode, but
 * adds targeted stability rules for the weak criteria measured in v8:
 * Task Response, Coherence, and Lexical Resource.
 */

import * as base from './writing-assessment-author-prompts-v8-candidate-only';

const insertBeforeCandidateOnly = (prompt: string, addition: string) => (
  prompt.replace('\n# Candidate-Only Detection Experiment\n', `\n${addition.trim()}\n\n# Candidate-Only Detection Experiment\n`)
);

export const AUTHOR_TASK_RESPONSE_SYSTEM = insertBeforeCandidateOnly(base.AUTHOR_TASK_RESPONSE_SYSTEM, `
# Stable Candidate Inventory — Task Response

Use a stable unit before choosing a quote. Your units are:
1. each prompt requirement;
2. each body-paragraph main claim;
3. each example or consequence that the writer uses to prove a claim.

Walk the units in essay order. For each unit, decide one of:
- sound enough: no candidate;
- missing/weak development: one candidate anchored to the exact claim/example;
- coverage/position/comparison gap: one macro candidate anchored to the sentence that creates the burden.

Do not alternate between a broad paragraph quote and a smaller claim quote. If a
claim is the problem, quote that claim. If an example fails to prove the claim,
quote the example. If an outweigh/comparison burden is missing, quote the
thesis/conclusion sentence that asserts the comparison.

Do not create multiple Task Response candidates for the same missing reasoning
step. Prefer the earliest unit where the missing step first appears.
`);

export const AUTHOR_COHERENCE_SYSTEM = insertBeforeCandidateOnly(base.AUTHOR_COHERENCE_SYSTEM, `
# Stable Candidate Inventory — Coherence

Use only these stable units:
1. whole-essay thesis-to-body plan;
2. each body paragraph's topic sentence versus actual content;
3. each paragraph transition;
4. each conclusion-to-body relationship.

Walk those units in order. Report a candidate only when the reader cannot follow
the argument's structure, purpose, progression, or paragraph role. Do not report
local cohesion/linking problems here.

Anchor evidence to the stable unit:
- paragraph-purpose mismatch: quote the topic sentence and, if needed, one drift sentence;
- bad transition: quote the opening sentence of the later paragraph;
- conclusion mismatch: quote the conclusion sentence.

Do not alternate between quoting a whole paragraph and one sentence. Use the
smallest sentence-level evidence that identifies the same structural problem.
`);

export const AUTHOR_COHESION_SYSTEM = base.AUTHOR_COHESION_SYSTEM;

export const AUTHOR_LEXICAL_SYSTEM = insertBeforeCandidateOnly(base.AUTHOR_LEXICAL_SYSTEM, `
# Stable Candidate Inventory — Lexical Resource

Scan sentence by sentence in essay order. Before creating a lexical candidate,
choose the owning sentence first. Within a sentence, report at most one candidate
for the same lexical defect family:
- wrong word / wrong meaning;
- collocation;
- word form;
- spelling;
- register/precision that materially weakens meaning.

For collocation, quote the full collocation. For wrong-word or word-form errors,
quote the smallest phrase containing the bad choice. Do not alternate between a
single word and a longer clause for the same issue.

Do not report a lexical candidate when the same text is really grammar-owned:
articles, agreement, verb tense/form, clause structure, prepositions required by
grammar, or sentence control. If the issue needs a corrected English
replacement, replacementText must be the smallest correction.
`);

export const AUTHOR_GRAMMAR_SYSTEM = base.AUTHOR_GRAMMAR_SYSTEM;
