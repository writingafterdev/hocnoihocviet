/**
 * Experimental prompt version: v12-free-strength.
 *
 * Candidate-only detection where the model freely finds all errors and labels
 * each candidate as either a core problem or worth noting.
 */

import * as base from './writing-assessment-author-prompts-v6-mixed-stable';

const candidateOnlyInstruction = `
# Candidate-Only Detection With Problem Strength

Return the detected problem pool for this criterion. Do not choose a smaller
final subset for the writer in this pass.

Use this output shape:
{
  "band": 0,
  "rationaleVi": "one concise Vietnamese rationale for the whole criterion",
  "candidateFindings": [{
    "id": "stable id", "criterion": "the criterion assigned to this pass",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "problemStrength": "core_problem | worth_noting",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "requirementIds": [], "errorLabelVi": "short Vietnamese error name",
    "explanationVi": "plain Vietnamese explanation using bạn",
    "repairVi": "smallest useful Vietnamese repair",
    "replacementText": "smallest English correction only for a local language error"
  }]
}

problemStrength is your judgment as the examiner:
- "core_problem": a main diagnostic problem the writer should treat as important; it affects the argument, flow, meaning, accuracy, or score-relevant reader experience.
- "worth_noting": useful feedback, but not one of the main reasons for the score; a local, borderline, optional, or polish-level issue.

Severity and problemStrength are related but not identical. A minor issue is
usually worth_noting. A major issue is usually core_problem. For moderate issues,
decide whether it is truly part of the writer's main diagnostic pattern or just a
useful local note.

Do not return a "findings" array. Do not create a selected subset.

Every candidate must quote exact essay text, not task-prompt text. Evidence must
come from the essay only. For Task Response, Coherence, and Cohesion candidates,
quote a meaningful phrase, clause, or sentence that shows the problem. Do not
use one-character or isolated-word anchors for non-language criteria.

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
