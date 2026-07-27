/**
 * Experimental prompt version: v7-candidate-pool.
 *
 * Tests whether inconsistency is detection or selection. Specialists return a
 * broad candidateFindings pool plus the normal selected findings.
 */

import * as base from './writing-assessment-author-prompts-v6-mixed-stable';

const candidatePoolInstruction = `
# Candidate Pool Experiment

Return two arrays:
- candidateFindings: every material problem you detect for this criterion.
- findings: the selected subset you would show to the writer.

Both arrays use the exact same finding object shape already specified below.
Every candidate must quote exact essay text and obey the same criterion boundary.
For Task Response, Coherence, and Cohesion candidates, quote a meaningful phrase,
clause, or sentence that shows the problem. Do not use one-character or isolated
word anchors for non-language criteria.

Do not pad candidateFindings with weak guesses. Include a candidate only when you
would be comfortable explaining it to the writer. The purpose is to reveal
whether repeated runs detect the same problem pool before final selection.
`;

const insertBeforeSchema = (prompt: string) => (
  prompt.replace('\nReturn JSON only:\n', `\n${candidatePoolInstruction.trim()}\n\nReturn JSON only:\n`)
);

export const AUTHOR_TASK_RESPONSE_SYSTEM = insertBeforeSchema(base.AUTHOR_TASK_RESPONSE_SYSTEM);
export const AUTHOR_COHERENCE_SYSTEM = insertBeforeSchema(base.AUTHOR_COHERENCE_SYSTEM);
export const AUTHOR_COHESION_SYSTEM = insertBeforeSchema(base.AUTHOR_COHESION_SYSTEM);
export const AUTHOR_LEXICAL_SYSTEM = insertBeforeSchema(base.AUTHOR_LEXICAL_SYSTEM);
export const AUTHOR_GRAMMAR_SYSTEM = insertBeforeSchema(base.AUTHOR_GRAMMAR_SYSTEM);
