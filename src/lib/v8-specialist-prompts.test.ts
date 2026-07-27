import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSESSMENT_PROMPT_VERSIONS,
  DEFAULT_ASSESSMENT_PROMPT_VERSION,
} from '@/lib/writing-assessment-author-prompts';
import { assessmentPipelineV8Prompts } from '@/lib/writing-assessment-pipeline-v2';

const SPECIALISTS = ['taskResponse', 'coherence', 'cohesion', 'lexicalResource', 'grammar'] as const;

test('prompt experiments preserve frozen versions and select v12 free-strength by default', () => {
  assert.equal(DEFAULT_ASSESSMENT_PROMPT_VERSION, 'v12-free-strength');
  assert.doesNotMatch(
    ASSESSMENT_PROMPT_VERSIONS['v1-cleaned'].AUTHOR_GRAMMAR_SYSTEM,
    /REQUIRED EXHAUSTIVE AUDIT/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v2-sentence-audit'].AUTHOR_GRAMMAR_SYSTEM,
    /Every essay sentence appears exactly once in sentenceAudit/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v3-mentor-units'].AUTHOR_COHESION_SYSTEM,
    /Natural unit for this criterion: each supplied adjacent sentence pair/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v3-mentor-units'].AUTHOR_TASK_RESPONSE_SYSTEM,
    /each supplied claim chain and each supplied prompt requirement/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v4-stable-areas'].AUTHOR_GRAMMAR_SYSTEM,
    /Grammar Stable Unit Rule/,
  );
  assert.equal(
    ASSESSMENT_PROMPT_VERSIONS['v4-stable-areas'].AUTHOR_TASK_RESPONSE_SYSTEM,
    ASSESSMENT_PROMPT_VERSIONS['v1-cleaned'].AUTHOR_TASK_RESPONSE_SYSTEM,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v5-stable-lite'].AUTHOR_COHESION_SYSTEM,
    /Cohesion Stable Unit Rule/,
  );
  assert.equal(
    ASSESSMENT_PROMPT_VERSIONS['v5-stable-lite'].AUTHOR_GRAMMAR_SYSTEM,
    ASSESSMENT_PROMPT_VERSIONS['v1-cleaned'].AUTHOR_GRAMMAR_SYSTEM,
  );
  assert.equal(
    ASSESSMENT_PROMPT_VERSIONS['v6-mixed-stable'].AUTHOR_COHERENCE_SYSTEM,
    ASSESSMENT_PROMPT_VERSIONS['v4-stable-areas'].AUTHOR_COHERENCE_SYSTEM,
  );
  assert.equal(
    ASSESSMENT_PROMPT_VERSIONS['v6-mixed-stable'].AUTHOR_COHESION_SYSTEM,
    ASSESSMENT_PROMPT_VERSIONS['v5-stable-lite'].AUTHOR_COHESION_SYSTEM,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v7-candidate-pool'].AUTHOR_LEXICAL_SYSTEM,
    /candidateFindings: every material problem/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v8-candidate-only'].AUTHOR_LEXICAL_SYSTEM,
    /Do not return a "findings" array/,
  );
  assert.doesNotMatch(
    ASSESSMENT_PROMPT_VERSIONS['v8-candidate-only'].AUTHOR_LEXICAL_SYSTEM,
    /"findings": \[\{/,
  );
  assert.equal(
    ASSESSMENT_PROMPT_VERSIONS['v9-hybrid-candidate'].AUTHOR_COHERENCE_SYSTEM,
    ASSESSMENT_PROMPT_VERSIONS['v6-mixed-stable'].AUTHOR_COHERENCE_SYSTEM,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v9-hybrid-candidate'].AUTHOR_GRAMMAR_SYSTEM,
    /Do not return a "findings" array/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v10-stable-candidate'].AUTHOR_TASK_RESPONSE_SYSTEM,
    /Stable Candidate Inventory — Task Response/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v10-stable-candidate'].AUTHOR_COHERENCE_SYSTEM,
    /Stable Candidate Inventory — Coherence/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v10-stable-candidate'].AUTHOR_LEXICAL_SYSTEM,
    /Stable Candidate Inventory — Lexical Resource/,
  );
  assert.doesNotMatch(
    ASSESSMENT_PROMPT_VERSIONS['v10-stable-candidate'].AUTHOR_TASK_RESPONSE_SYSTEM,
    /"findings": \[\{/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v11-core-worth'].AUTHOR_COHERENCE_SYSTEM,
    /clear core problem/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v11-core-worth'].AUTHOR_COHESION_SYSTEM,
    /minor.*worth noting/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v11-core-worth'].AUTHOR_TASK_RESPONSE_SYSTEM,
    /Evidence must\s+come from the essay only/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v12-free-strength'].AUTHOR_TASK_RESPONSE_SYSTEM,
    /"problemStrength": "core_problem \| worth_noting"/,
  );
  assert.match(
    ASSESSMENT_PROMPT_VERSIONS['v12-free-strength'].AUTHOR_COHERENCE_SYSTEM,
    /problemStrength is your judgment as the examiner/,
  );
  assert.doesNotMatch(
    ASSESSMENT_PROMPT_VERSIONS['v12-free-strength'].AUTHOR_COHESION_SYSTEM,
    /benchmark expects|production benchmark|consistency target/i,
  );
});

test('every specialist carries its band descriptors', () => {
  // v8 previously asked each specialist for a band with no descriptor at all;
  // CRITERION_SCORE_SYSTEMS was reachable only from v6.
  const anchors: Record<(typeof SPECIALISTS)[number], RegExp> = {
    taskResponse: /Score only IELTS Task Response/,
    coherence: /Score Coherence and Cohesion as a whole-number band from the coherence evidence/,
    cohesion: /Score Coherence and Cohesion as a whole-number band from the cohesion evidence alone/,
    lexicalResource: /Score only IELTS Lexical Resource/,
    grammar: /Score only IELTS Grammatical Range and Accuracy/,
  };
  for (const specialist of SPECIALISTS) {
    assert.match(assessmentPipelineV8Prompts[specialist], anchors[specialist], specialist);
  }
});

test('every specialist carries the shared output discipline', () => {
  for (const specialist of SPECIALISTS) {
    const prompt = assessmentPipelineV8Prompts[specialist];
    assert.match(prompt, /Vietnamese alphabet only/, `${specialist}: script rule`);
    assert.match(prompt, /character for character/, `${specialist}: evidence rule`);
    assert.match(prompt, /must not move the band/, `${specialist}: scoring rule`);
  }
});

test('lexical resource treats a register or precision upgrade as reportable', () => {
  const prompt = assessmentPipelineV8Prompts.lexicalResource;
  assert.match(prompt, /legitimate minor finding/);
  assert.match(prompt, /must not do is invent a preference/);
});

test('grammar ranks sentence control first and allows the full-sentence quote', () => {
  const prompt = assessmentPipelineV8Prompts.grammar;
  assert.match(prompt, /Sentence control is the largest single family/);
  assert.match(prompt, /quote the whole sentence/);
});

test('cohesion keeps its original analysis, not a suppressive lead-in', () => {
  // A "look for these two first, many essays yield none" preamble cut recall
  // from 4.8% to 1.9% against combined examiner and tutor anchors.
  const prompt = assessmentPipelineV8Prompts.cohesion;
  assert.doesNotMatch(prompt, /many yield none/);
  assert.match(prompt, /A theme is GIVEN only if/);
  assert.match(prompt, /Do not return this private working map/);
  assert.doesNotMatch(prompt, /"thematicMap"/);
});

test('coherence returns evidence for the existing reasoning map, not another map', () => {
  const prompt = assessmentPipelineV8Prompts.coherence;
  assert.match(prompt, /product already has a reasoning map/);
  assert.match(prompt, /quote every existing sentence or clause needed/);
  assert.match(prompt, /Do not invent node IDs/);
  assert.match(prompt, /actual blank-line paragraph boundaries/);
  assert.match(prompt, /A two-part prompt that\s+asks about two effects does not require/);
  assert.match(prompt, /That belongs to Task Response/);
  assert.doesNotMatch(prompt, /priorAnalysis|thematicMap/);
});

test('specialists separate finding count from error frequency', () => {
  for (const specialist of SPECIALISTS) {
    const prompt = assessmentPipelineV8Prompts[specialist];
    assert.match(prompt, /How many findings you happen to write down must not move the band/);
    assert.match(prompt, /error frequency, which is a real descriptor signal/);
  }
});

test('no specialist prompt leaks an unsubstituted template placeholder', () => {
  for (const prompt of Object.values(assessmentPipelineV8Prompts)) {
    assert.doesNotMatch(prompt, /\{\{[A-Z_]+\}\}/);
  }
});

test('task response ships as two narrow passes, not one broad one', () => {
  // Four rewrites of the single pass all landed at or below 14.4% recall
  // against examiner marking; development + coverage reaches 19.6%.
  const prompt = assessmentPipelineV8Prompts.taskResponse;
  assert.match(prompt, /develops its claim enough/, 'development pass present');
  assert.match(prompt, /answers the exact question asked/, 'coverage pass present');
  // Each pass must disclaim the other's ground, or they collapse back into one.
  assert.match(prompt, /Do not judge coverage of the task/);
  assert.match(prompt, /Do not judge how deeply ideas are developed/);
});

test('profile guidance tells the specialist to walk the requirements, not only what to spare', () => {
  // The profile pass computes hardRequirements with a question and a
  // successTest each, then the guidance spent five of its eight bullets on
  // what not to penalize and never asked the model to check the essay against
  // them. A checklist nobody walks is a checklist that does nothing.
  const guidance = assessmentPipelineV8Prompts.profileGuidance;
  assert.match(guidance, /take them one at a time/);
  assert.match(guidance, /compare that text against the successTest/);
  // The walk must come before the caveats, or it reads as another exception.
  assert.ok(
    guidance.indexOf('one at a time') < guidance.indexOf('Never penalize'),
    'the walk precedes the prohibitions',
  );
});

test('the profile walk adds no gate that suppresses reporting', () => {
  // A checklist variant that gated findings behind ANSWERED/PARTIAL/ABSENT
  // verdicts cut findings per essay from 0.9 to 0.5. Specificity about what to
  // check helps; a pass/fail gate in front of reporting does not.
  const guidance = assessmentPipelineV8Prompts.profileGuidance;
  assert.doesNotMatch(guidance, /only report|report only|ABSENT/);
});

test('coherence and cohesion require every evidenced problem to be reported', () => {
  for (const specialist of ['coherence', 'cohesion'] as const) {
    const prompt = assessmentPipelineV8Prompts[specialist];
    assert.match(prompt, /Report every problem you find/, `${specialist}: complete reporting`);
    assert.match(prompt, /Every finding must quote the essay directly/, `${specialist}: evidence guard`);
  }
});

test('the anti-fabrication guards survive the volume changes', () => {
  const coherence = assessmentPipelineV8Prompts.coherence;
  assert.match(coherence, /If a quote is not literally in the essay, drop that finding/);
  assert.match(coherence, /Do not invent node IDs/);
  const cohesion = assessmentPipelineV8Prompts.cohesion;
  assert.match(cohesion, /If a quote is not literally in the essay, drop that finding/);
  assert.match(cohesion, /semantic relatedness is NOT thematic progression/);
});
