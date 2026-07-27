/**
 * Experimental prompt version: v8-candidate-only.
 *
 * Diagnostic only. Tests whether detection becomes more stable when each
 * specialist returns only the detected problem pool, without also selecting a
 * final subset for the writer.
 */

import * as base from './writing-assessment-author-prompts-v6-mixed-stable';

const candidateOnlyInstruction = `
# Candidate-Only Detection Experiment

Return only the broad detected problem pool for this criterion. Do not choose a
smaller final subset for the writer in this pass.

Use this output shape:
{
  "band": 0,
  "rationaleVi": "one concise Vietnamese rationale for the whole criterion",
  "candidateFindings": [{
    "id": "stable id", "criterion": "the criterion assigned to this pass",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "requirementIds": [], "errorLabelVi": "short Vietnamese error name",
    "explanationVi": "plain Vietnamese explanation using bạn",
    "repairVi": "smallest useful Vietnamese repair",
    "replacementText": "smallest English correction only for a local language error"
  }]
}

Do not return a "findings" array. Do not create a selected subset. The
application is measuring whether repeated runs detect the same candidate
problem areas before any selection step.

Every candidate must quote exact essay text and obey the same criterion
boundary. For Task Response, Coherence, and Cohesion candidates, quote a
meaningful phrase, clause, or sentence that shows the problem. Do not use
one-character or isolated-word anchors for non-language criteria.

Do not pad candidateFindings with weak guesses. Include a candidate only when
you would be comfortable explaining it to the writer.
`;

const replaceSchema = (prompt: string) => (
  prompt.replace(/\nReturn JSON only:\n[\s\S]*$/u, `\n${candidateOnlyInstruction.trim()}\n`)
);

export const AUTHOR_TASK_RESPONSE_SYSTEM = replaceSchema(base.AUTHOR_TASK_RESPONSE_SYSTEM);
export const AUTHOR_COHERENCE_SYSTEM = replaceSchema(base.AUTHOR_COHERENCE_SYSTEM);
export const AUTHOR_COHESION_SYSTEM = replaceSchema(base.AUTHOR_COHESION_SYSTEM);
export const AUTHOR_LEXICAL_SYSTEM = replaceSchema(base.AUTHOR_LEXICAL_SYSTEM);
export const AUTHOR_GRAMMAR_SYSTEM = replaceSchema(base.AUTHOR_GRAMMAR_SYSTEM);
