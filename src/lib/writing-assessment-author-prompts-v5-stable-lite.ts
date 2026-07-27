/**
 * Experimental prompt version: v5-stable-lite.
 *
 * Keeps v1 intact, keeps grammar exactly at v1, and tests stable-area guidance
 * only where v4 helped: coherence, cohesion, and lexical resource.
 */

import * as base from './writing-assessment-author-prompts-v1-cleaned';

const insertBeforeBand = (prompt: string, addition: string) => (
  prompt.replace('\n# Band\n', `\n${addition.trim()}\n\n# Band\n`)
);

const STABLE_SHARED = `
# Stable Area Selection

If auditUnits are supplied, use them privately as a fixed shortlist of where
problems can live. Do not return auditUnits, sentence IDs, paragraph IDs, or a
map. Return the same JSON schema as before.

Choose the problematic area before choosing the exact quote. If the same essay
is assessed again, the same problematic sentence, sentence pair, paragraph, or
paragraph transition should be selected even if the exact quote boundary shifts.

When several possible findings compete, prefer:
1. Higher reader impact.
2. A systematic or repeated pattern.
3. Earlier essay location.
4. The smallest independently fixable area.
`;

export const AUTHOR_TASK_RESPONSE_SYSTEM = base.AUTHOR_TASK_RESPONSE_SYSTEM;
export const AUTHOR_GRAMMAR_SYSTEM = base.AUTHOR_GRAMMAR_SYSTEM;

export const AUTHOR_COHESION_SYSTEM = insertBeforeBand(base.AUTHOR_COHESION_SYSTEM, `
${STABLE_SHARED}

# Cohesion Stable Unit Rule

Use only adjacent sentence pairs as the natural unit. First decide which pair
has a broken handoff, reference, theme, or connector. Then quote the smallest
span from that pair.

Prefer the later sentence when it contains the broken theme, reference, or
connector. Quote the connector/pronoun alone only when that word is the whole
problem.
`);

export const AUTHOR_COHERENCE_SYSTEM = insertBeforeBand(base.AUTHOR_COHERENCE_SYSTEM, `
${STABLE_SHARED}

# Coherence Stable Unit Rule

Use paragraphs and paragraph transitions as the natural units. First decide
which paragraph or transition is structurally hard to follow. Then quote the
topic sentence, transition sentence, or key drift sentence that identifies that
area.

Avoid quoting a whole paragraph when one or two sentences identify the same
coherence problem.
`);

export const AUTHOR_LEXICAL_SYSTEM = insertBeforeBand(base.AUTHOR_LEXICAL_SYSTEM, `
${STABLE_SHARED}

# Lexical Stable Unit Rule

Use each sentence as the natural unit, then highlight the faulty word,
collocation, or short phrase inside it.

For collocation, quote the complete collocation. For wrong-word and word-form
errors, quote the smallest phrase containing the wrong choice. If several
lexical problems occur in one sentence, prefer the one that most changes the
intended meaning.
`);
