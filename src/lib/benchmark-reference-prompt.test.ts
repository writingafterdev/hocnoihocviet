import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBenchmarkReferencePrompt,
  buildBenchmarkSystemPrompt,
  buildBenchmarkUserPrompt,
} from '@/lib/benchmark-reference-prompt';

const INPUT = {
  question: 'Some people think X. To what extent do you agree?',
  essay: 'Nowadays many people believe that X is true. '.repeat(20),
  scores: { overall: '7.5', taskResponse: '7', coherenceCohesion: '8', lexicalResource: '7', gra: '8' },
  sourceUrl: 'https://example.test/result',
};

test('the default prompt shows the external bands and the anchoring rule', () => {
  const prompt = buildBenchmarkReferencePrompt(INPUT);
  assert.match(prompt, /Reference Scores From External Assessor/);
  assert.match(prompt, /Overall: 7\.5/);
  assert.match(prompt, /calibration anchors/);
});

test('blind mode withholds every external band from the model', () => {
  const prompt = buildBenchmarkReferencePrompt({ ...INPUT, blindScores: true });
  // Leaking any of these turns a calibration run into an open-book exam.
  assert.doesNotMatch(prompt, /Reference Scores From External Assessor/);
  assert.doesNotMatch(prompt, /7\.5/);
  assert.doesNotMatch(prompt, /calibration anchors/);
  assert.doesNotMatch(prompt, /differs from the external overall score/);
  assert.match(prompt, /No external bands are supplied/);
});

test('blind mode still carries the question and the essay', () => {
  const prompt = buildBenchmarkUserPrompt({ ...INPUT, blindScores: true });
  assert.match(prompt, /To what extent do you agree\?/);
  assert.match(prompt, /Nowadays many people believe/);
  assert.match(prompt, /Essay word count/);
});

test('the anchoring placeholder is always substituted', () => {
  for (const blindScores of [true, false]) {
    assert.doesNotMatch(buildBenchmarkSystemPrompt({ blindScores }), /\{\{EXTERNAL_SCORE_ANCHORING\}\}/);
  }
});

test('blind mode pushes against defaulting to a middle band', () => {
  const prompt = buildBenchmarkSystemPrompt({ blindScores: true });
  assert.match(prompt, /Most essays are not band 6/);
});
