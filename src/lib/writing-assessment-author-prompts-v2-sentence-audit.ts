import {
  AUTHOR_COHERENCE_SYSTEM as V1_COHERENCE_SYSTEM,
  AUTHOR_COHESION_SYSTEM as V1_COHESION_SYSTEM,
  AUTHOR_GRAMMAR_SYSTEM as V1_GRAMMAR_SYSTEM,
  AUTHOR_LEXICAL_SYSTEM as V1_LEXICAL_SYSTEM,
  AUTHOR_TASK_RESPONSE_SYSTEM as V1_TASK_RESPONSE_SYSTEM,
} from './writing-assessment-author-prompts-v1-cleaned';

/**
 * Experimental prompt version: v2-sentence-audit.
 *
 * This version changes recall procedure, not the error taxonomy. It forces
 * each specialist to make an explicit decision on every sentence before
 * producing findings, so repeated runs cannot silently inspect different
 * subsets of the essay.
 */
const EXHAUSTIVE_SENTENCE_AUDIT = `

# REQUIRED EXHAUSTIVE AUDIT — VERSION v2-sentence-audit

Before selecting findings, enumerate every essay sentence in original order.
Treat the sentence list as a fixed checklist: you are not allowed to skip a
sentence because another problem seems more important.

For EACH sentence, make one explicit criterion-specific decision:
- PASS: this sentence supplies no evidence of an error in your taxonomy.
- ERROR: name every applicable error type from your taxonomy and copy the
  smallest exact source span that proves each error.

Also make one GLOBAL decision for criterion-level problems that cannot be
located in a single sentence, such as missing task coverage, missing paragraph
boundaries, or an absent structural relationship.

Return this work in a top-level "sentenceAudit" array before "findings":
[
  {
    "sentenceIndex": 0,
    "sourceText": "the complete sentence copied character for character",
    "verdict": "PASS | ERROR",
    "errorTypes": ["only error types from your taxonomy"],
    "evidenceSpans": ["smallest exact quotes from this sentence"]
  }
]

Return the global decision in:
{
  "globalAudit": {
    "verdict": "PASS | ERROR",
    "errorTypes": ["only error types from your taxonomy"],
    "evidenceSpans": ["exact existing quotes when the problem has evidence"]
  }
}

Completeness rules:
1. Every essay sentence appears exactly once in sentenceAudit.
2. Preserve sentence order and copy complete sourceText character for character.
3. Every ERROR decision produces the corresponding finding or findings.
4. Every reported local finding must be backed by an ERROR decision.
5. Do not cap, prioritize, sample, merge, or suppress errors.
6. Do not change the criterion boundary or invent an error merely to avoid PASS.
7. Perform the same checklist even when the essay is long or repetitive.

The audit ledger is required evidence of exhaustive inspection. It must not
change the band mechanically; score using the criterion descriptors.
`;

export const AUTHOR_TASK_RESPONSE_SYSTEM =
  `${V1_TASK_RESPONSE_SYSTEM}${EXHAUSTIVE_SENTENCE_AUDIT}`;
export const AUTHOR_COHESION_SYSTEM =
  `${V1_COHESION_SYSTEM}${EXHAUSTIVE_SENTENCE_AUDIT}`;
export const AUTHOR_COHERENCE_SYSTEM =
  `${V1_COHERENCE_SYSTEM}${EXHAUSTIVE_SENTENCE_AUDIT}`;
export const AUTHOR_GRAMMAR_SYSTEM =
  `${V1_GRAMMAR_SYSTEM}${EXHAUSTIVE_SENTENCE_AUDIT}`;
export const AUTHOR_LEXICAL_SYSTEM =
  `${V1_LEXICAL_SYSTEM}${EXHAUSTIVE_SENTENCE_AUDIT}`;
