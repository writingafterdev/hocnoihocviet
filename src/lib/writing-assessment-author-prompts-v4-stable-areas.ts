/**
 * Experimental prompt version: v4-stable-areas.
 *
 * Keep v1-cleaned intact. This version tests whether stable local audit units
 * improve repeated-run consistency without the heavy v3 verifier.
 */

import * as base from './writing-assessment-author-prompts-v1-cleaned';

const insertBeforeBand = (prompt: string, addition: string) => (
  prompt.replace('\n# Band\n', `\n${addition.trim()}\n\n# Band\n`)
);

const STABLE_SHARED = `
# Stable Area Selection

If auditUnits are supplied, use them privately as the fixed checklist of where
problems can live. Do not return auditUnits, sentence IDs, paragraph IDs, or a
map. Return the same JSON schema as before.

Your consistency target is area stability: if the same essay is assessed again,
the same problematic sentence, sentence pair, paragraph transition, or reasoning
area should be selected before you decide the exact quote boundary.

When several possible findings compete, use this deterministic priority:
1. Higher reader impact before lower impact.
2. Systematic/repeated pattern before isolated slip.
3. Earlier essay location before later essay location.
4. Smaller independently fixable area before a broad area.

Do not create extra duplicates only to satisfy this checklist. If two findings
would teach the same fix in the same sentence or sentence pair, keep the one
with higher reader impact.
`;

export const AUTHOR_TASK_RESPONSE_SYSTEM = base.AUTHOR_TASK_RESPONSE_SYSTEM;

export const AUTHOR_COHESION_SYSTEM = insertBeforeBand(base.AUTHOR_COHESION_SYSTEM, `
${STABLE_SHARED}

# Cohesion Stable Unit Rule

Natural unit: each supplied adjacent sentence pair. First decide which pair has
the broken link, then choose evidence from that pair.

Prefer quoting the later sentence when it contains the broken theme, reference,
or connector. Quote only the connector/pronoun when that single word is the
whole problem. Do not alternate between quoting a connector in one run and a
whole paragraph in another.
`);

export const AUTHOR_COHERENCE_SYSTEM = insertBeforeBand(base.AUTHOR_COHERENCE_SYSTEM, `
${STABLE_SHARED}

# Coherence Stable Unit Rule

Natural units: supplied paragraphs, paragraph transitions, and existing reasoning
areas. First decide which paragraph or paragraph transition is structurally
problematic, then quote the topic sentence, transition sentence, or smallest set
of sentences that identifies that area.

Do not alternate between a whole paragraph and one sentence when the one sentence
is enough to identify the same coherence problem. If a paragraph-level problem
needs a broad repair, use the topic sentence plus the key drift sentence as
evidence rather than the entire paragraph.
`);

export const AUTHOR_GRAMMAR_SYSTEM = insertBeforeBand(base.AUTHOR_GRAMMAR_SYSTEM, `
${STABLE_SHARED}

# Grammar Stable Unit Rule

Natural unit: each supplied sentence. First decide whether the sentence contains
a grammar problem that a normal reader would notice. Then choose the evidence
inside that sentence.

For sentence-control problems such as fragments, run-ons, comma splices, broken
relative clauses, and unclear clause attachment, quote the whole sentence. For
one-word or short-phrase problems such as articles, prepositions, agreement, or
word order, quote the smallest phrase that still lets the writer see the rule.

If a sentence contains several minor grammar slips, prefer the one with highest
reader impact. Do not vary between nearby tiny slips unless both are clearly
material.
`);

export const AUTHOR_LEXICAL_SYSTEM = insertBeforeBand(base.AUTHOR_LEXICAL_SYSTEM, `
${STABLE_SHARED}

# Lexical Stable Unit Rule

Natural unit: each supplied sentence, with the faulty word or collocation inside
it as the highlight. First decide which sentence contains a noticeable lexical
problem. Then choose the bad word, word form, or full collocation.

For collocation, quote the complete collocation rather than only one word. For
wrong-word and word-form errors, quote the smallest phrase that contains the
wrong choice. When several lexical problems occur in the same sentence, prefer
the one that most changes the intended meaning.
`);
