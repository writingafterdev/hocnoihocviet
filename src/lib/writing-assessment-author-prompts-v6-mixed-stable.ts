/**
 * Experimental prompt version: v6-mixed-stable.
 *
 * Combines the best per-criterion results from v4 and v5:
 * - Task Response, Coherence, Lexical from v4.
 * - Cohesion, Grammar from v5.
 */

import * as v4 from './writing-assessment-author-prompts-v4-stable-areas';
import * as v5 from './writing-assessment-author-prompts-v5-stable-lite';

export const AUTHOR_TASK_RESPONSE_SYSTEM = v4.AUTHOR_TASK_RESPONSE_SYSTEM;
export const AUTHOR_COHERENCE_SYSTEM = v4.AUTHOR_COHERENCE_SYSTEM;
export const AUTHOR_LEXICAL_SYSTEM = v4.AUTHOR_LEXICAL_SYSTEM;
export const AUTHOR_COHESION_SYSTEM = v5.AUTHOR_COHESION_SYSTEM;
export const AUTHOR_GRAMMAR_SYSTEM = v5.AUTHOR_GRAMMAR_SYSTEM;
