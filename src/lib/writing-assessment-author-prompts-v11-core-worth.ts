/**
 * Experimental prompt version: v11-core-worth.
 *
 * Candidate-only detection with an explicit production distinction:
 * - major/moderate = core problems
 * - minor = worth noting
 */

import * as base from './writing-assessment-author-prompts-v6-mixed-stable';

const candidateOnlyInstruction = `
# Candidate-Only Detection With Problem Strength

Return only the detected problem pool for this criterion. Do not choose a
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

Severity is the production distinction:
- "major": a clear core problem that can affect the band or seriously disrupt the reader.
- "moderate": a real core problem worth showing as a normal error.
- "minor": worth noting only — useful, local, borderline, or polish-level; not a core diagnostic failure.

Do not inflate borderline observations into moderate. If a finding is useful but
another fair examiner might skip it, mark it "minor". The production benchmark
expects major/moderate findings to be more stable than minor findings.

Do not return a "findings" array. Do not create a selected subset. The
application is measuring whether repeated runs detect the same candidate
problem areas before any selection step.

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
