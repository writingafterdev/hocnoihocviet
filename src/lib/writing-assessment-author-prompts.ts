import * as cleaned from './writing-assessment-author-prompts-v1-cleaned';
import * as sentenceAudit from './writing-assessment-author-prompts-v2-sentence-audit';
import * as mentorUnits from './writing-assessment-author-prompts-v3-mentor-units';
import * as stableAreas from './writing-assessment-author-prompts-v4-stable-areas';
import * as stableLite from './writing-assessment-author-prompts-v5-stable-lite';
import * as mixedStable from './writing-assessment-author-prompts-v6-mixed-stable';
import * as candidatePool from './writing-assessment-author-prompts-v7-candidate-pool';
import * as candidateOnly from './writing-assessment-author-prompts-v8-candidate-only';
import * as hybridCandidate from './writing-assessment-author-prompts-v9-hybrid-candidate';
import * as stableCandidate from './writing-assessment-author-prompts-v10-stable-candidate';
import * as coreWorth from './writing-assessment-author-prompts-v11-core-worth';
import * as freeStrength from './writing-assessment-author-prompts-v12-free-strength';

export const ASSESSMENT_PROMPT_VERSIONS = {
  'v1-cleaned': cleaned,
  'v2-sentence-audit': sentenceAudit,
  'v3-mentor-units': mentorUnits,
  'v4-stable-areas': stableAreas,
  'v5-stable-lite': stableLite,
  'v6-mixed-stable': mixedStable,
  'v7-candidate-pool': candidatePool,
  'v8-candidate-only': candidateOnly,
  'v9-hybrid-candidate': hybridCandidate,
  'v10-stable-candidate': stableCandidate,
  'v11-core-worth': coreWorth,
  'v12-free-strength': freeStrength,
} as const;

export type AssessmentPromptVersion = keyof typeof ASSESSMENT_PROMPT_VERSIONS;

export const DEFAULT_ASSESSMENT_PROMPT_VERSION: AssessmentPromptVersion = 'v12-free-strength';

const requestedVersion =
  process.env.ASSESSMENT_PROMPT_VERSION || DEFAULT_ASSESSMENT_PROMPT_VERSION;

if (!(requestedVersion in ASSESSMENT_PROMPT_VERSIONS)) {
  throw new Error(
    `Unknown ASSESSMENT_PROMPT_VERSION "${requestedVersion}". Expected one of: ${
      Object.keys(ASSESSMENT_PROMPT_VERSIONS).join(', ')
    }.`,
  );
}

export const ACTIVE_ASSESSMENT_PROMPT_VERSION =
  requestedVersion as AssessmentPromptVersion;

const activePrompts = ASSESSMENT_PROMPT_VERSIONS[ACTIVE_ASSESSMENT_PROMPT_VERSION];

export const AUTHOR_TASK_RESPONSE_SYSTEM = activePrompts.AUTHOR_TASK_RESPONSE_SYSTEM;
export const AUTHOR_COHESION_SYSTEM = activePrompts.AUTHOR_COHESION_SYSTEM;
export const AUTHOR_COHERENCE_SYSTEM = activePrompts.AUTHOR_COHERENCE_SYSTEM;
export const AUTHOR_GRAMMAR_SYSTEM = activePrompts.AUTHOR_GRAMMAR_SYSTEM;
export const AUTHOR_LEXICAL_SYSTEM = activePrompts.AUTHOR_LEXICAL_SYSTEM;
