import assert from 'node:assert/strict';
import test from 'node:test';

import { filterBenchmarkAssessmentMarkdown } from './benchmark-postgen-filter';

const essay = [
  'Social media helps people stay connected with relatives abroad.',
  'However, fake news can spread quickly and lead people to make false assumptions.',
  'Many users also share personal data online.',
].join('\n\n');

test('keeps Must-Catch findings with evidence that resolves to the essay', () => {
  const result = filterBenchmarkAssessmentMarkdown({
    essay,
    markdown: `# Reference Assessment

## 5. Must-Catch Errors

### Error 1: Fake news consequence is underdeveloped
Criterion: Task Response
Severity: major
Confidence: high

Original evidence:
> "fake news can spread quickly and lead people to make false assumptions"
Why this is a problem: The sentence stops before showing a concrete consequence.

## 6. Optional / Style Suggestions

None.`,
  });

  assert.match(result.markdown, /Fake news consequence is underdeveloped/);
  assert.equal(result.audit.keptCount, 1);
  assert.equal(result.audit.removedCount, 0);
});

test('removes Must-Catch findings without exact evidence in the essay', () => {
  const result = filterBenchmarkAssessmentMarkdown({
    essay,
    markdown: `# Reference Assessment

## 5. Must-Catch Errors

### Error 1: Hallucinated example problem
Criterion: Task Response
Severity: major
Confidence: high

Original evidence:
> "students refuse vaccination because of fake news"
Why this is a problem: This evidence is not in the essay.

## 6. Optional / Style Suggestions

None.`,
  });

  assert.doesNotMatch(result.markdown, /Hallucinated example problem/);
  assert.match(result.markdown, /No Must-Catch errors survived/);
  assert.equal(result.audit.removedCount, 1);
  assert.match(result.audit.removed[0].reason, /No exact original evidence/);
});

test('removes duplicated Must-Catch findings anchored to the same evidence', () => {
  const result = filterBenchmarkAssessmentMarkdown({
    essay,
    markdown: `# Reference Assessment

## 5. Must-Catch Errors

### Error 1: False assumptions stop too early
Criterion: Task Response
Severity: major
Confidence: high

Original evidence:
> "fake news can spread quickly and lead people to make false assumptions"
Why this is a problem: The consequence remains generic.

### Error 2: Fake news point is shallow
Criterion: Task Response
Severity: major
Confidence: high

Original evidence:
> "fake news can spread quickly and lead people to make false assumptions"
Why this is a problem: Same underlying point.

## 6. Optional / Style Suggestions

None.`,
  });

  assert.match(result.markdown, /### Error 1: False assumptions stop too early/);
  assert.doesNotMatch(result.markdown, /Fake news point is shallow/);
  assert.equal(result.audit.keptCount, 1);
  assert.equal(result.audit.removedCount, 1);
  assert.match(result.audit.removed[0].reason, /Duplicate/);
});

test('removes low-certainty language preferences from Must-Catch', () => {
  const result = filterBenchmarkAssessmentMarkdown({
    essay,
    scores: { lexicalResource: '8' },
    markdown: `# Reference Assessment

## 5. Must-Catch Errors

### Error 1: Word choice could be more natural
Criterion: Lexical Resource
Severity: minor
Confidence: medium

Original evidence:
> "stay connected with relatives abroad"
Why this is a problem: "keep in touch" may be a more natural choice.

## 6. Optional / Style Suggestions

None.`,
  });

  assert.doesNotMatch(result.markdown, /Word choice could be more natural/);
  assert.equal(result.audit.removedCount, 1);
  assert.match(result.audit.removed[0].reason, /style\/preference/);
});
