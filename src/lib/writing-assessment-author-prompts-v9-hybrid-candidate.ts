/**
 * Experimental prompt version: v9-hybrid-candidate.
 *
 * Hybrid diagnostic:
 * - Task Response and Coherence use v6 selected-style prompts, because those
 *   were more stable for those criteria.
 * - Cohesion, Lexical Resource, and Grammar use v8 candidate-only prompts,
 *   because candidate-only improved those criteria.
 */

import * as selectedStable from './writing-assessment-author-prompts-v6-mixed-stable';
import * as candidateOnly from './writing-assessment-author-prompts-v8-candidate-only';

export const AUTHOR_TASK_RESPONSE_SYSTEM = selectedStable.AUTHOR_TASK_RESPONSE_SYSTEM;
export const AUTHOR_COHERENCE_SYSTEM = selectedStable.AUTHOR_COHERENCE_SYSTEM;
export const AUTHOR_COHESION_SYSTEM = candidateOnly.AUTHOR_COHESION_SYSTEM;
export const AUTHOR_LEXICAL_SYSTEM = candidateOnly.AUTHOR_LEXICAL_SYSTEM;
export const AUTHOR_GRAMMAR_SYSTEM = candidateOnly.AUTHOR_GRAMMAR_SYSTEM;
