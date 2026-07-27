import {
  AUTHOR_COHERENCE_SYSTEM as V1_COHERENCE_SYSTEM,
  AUTHOR_COHESION_SYSTEM as V1_COHESION_SYSTEM,
  AUTHOR_GRAMMAR_SYSTEM as V1_GRAMMAR_SYSTEM,
  AUTHOR_LEXICAL_SYSTEM as V1_LEXICAL_SYSTEM,
  AUTHOR_TASK_RESPONSE_SYSTEM as V1_TASK_RESPONSE_SYSTEM,
} from './writing-assessment-author-prompts-v1-cleaned';

/**
 * Experimental prompt version: v3-mentor-units.
 *
 * Adapts the mentor architecture to the structures the product already owns:
 * deterministic sentence/paragraph manifests, adjacent sentence pairs,
 * paragraph transitions, prompt requirements, claim-chain paragraphs, and a
 * lexical inventory. Candidates are generated against fixed criterion units.
 */
const fixedAudit = (unitName: string, procedure: string) => `

# FIXED-UNIT CANDIDATE AUDIT — VERSION v3-mentor-units

The user message contains an "auditUnits" fact sheet created deterministically
from the essay. Treat its IDs, boundaries, order, and source text as
authoritative. Do not segment the essay again.

Natural unit for this criterion: ${unitName}.

${procedure}

For every supplied applicable unit, make an explicit PASS or ERROR decision
against every relevant error type in your existing closed taxonomy. Inspect
units in supplied order. Do not sample, prioritize, cap, or skip units.

Return a top-level "unitAudit" array:
[
  {
    "unitId": "copy supplied stable unit ID exactly",
    "verdict": "PASS | ERROR",
    "errorTypes": ["zero or more exact English taxonomy labels"],
    "evidenceSpans": ["smallest exact essay quotes"]
  }
]

Completeness requirements:
- Every supplied applicable unit appears exactly once.
- Every ERROR decision produces a corresponding item in findings.
- Every local finding is backed by an ERROR unit decision.
- PASS is correct when no taxonomy error exists; never invent an error.
- Keep the existing findings schema, criterion boundary, band descriptors,
  Vietnamese explanation requirements, and exact-quote rules unchanged.
`;

export const AUTHOR_GRAMMAR_SYSTEM = `${V1_GRAMMAR_SYSTEM}${fixedAudit(
  'each supplied sentence',
  `Use auditUnits.sentences. Inspect each sentence independently for its
grammar taxonomy. You may read previousSentence and nextSentence only to judge
tense, reference, or a structure whose correctness genuinely needs context.`,
)}`;

export const AUTHOR_LEXICAL_SYSTEM = `${V1_LEXICAL_SYSTEM}${fixedAudit(
  'each supplied sentence plus the supplied lexical inventory',
  `Use auditUnits.sentences for contextual word choice and collocation. Use
auditUnits.lexicalInventory for repetition and word-family patterns. A phrase
or collocation remains attached to the sentence containing it.`,
)}`;

export const AUTHOR_COHESION_SYSTEM = `${V1_COHESION_SYSTEM}${fixedAudit(
  'each supplied adjacent sentence pair',
  `Use auditUnits.sentencePairs. For every pair, test the relationship from
leftText to rightText for each applicable cohesion error type. Also inspect the
supplied linkingDevices and referenceWords attached to that pair.`,
)}`;

export const AUTHOR_COHERENCE_SYSTEM = `${V1_COHERENCE_SYSTEM}${fixedAudit(
  'each supplied paragraph and each supplied paragraph transition',
  `Use auditUnits.paragraphs to compare each paragraph opening with its complete
body. Use auditUnits.paragraphTransitions to inspect how one real paragraph
leads to the next. Use auditUnits.essayStructure once for essay-level errors.
Never replace the product reasoning map or invent paragraph boundaries.`,
)}`;

export const AUTHOR_TASK_RESPONSE_SYSTEM = `${V1_TASK_RESPONSE_SYSTEM}${fixedAudit(
  'each supplied claim chain and each supplied prompt requirement',
  `Use auditUnits.claimChains as the complete claim/reason/evidence context for
each body paragraph. Use auditUnits.promptRequirements to audit task coverage.
Judge a claim chain as a unit; do not reduce development to isolated sentences.`,
)}`;
