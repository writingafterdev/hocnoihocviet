import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type ClaimStrengthOmissionCandidate,
  validateOmissionCandidate,
} from './claim-strength-omission-scan';

const essay = `
Annual tests can identify unsafe drivers. Only naturally energetic drivers would
be able to pass these tests, so roads would become completely safe.
`.trim();

const candidate: ClaimStrengthOmissionCandidate = {
  exactClaim: 'Only naturally energetic drivers would be able to pass these tests',
  paragraphContext:
    'Only naturally energetic drivers would be able to pass these tests, so roads would become completely safe.',
  argumentRole: 'supporting_detail',
  claimProblem: 'unrealistic',
  severity: 'major',
  confidence: 'high',
  rationaleVi: 'Claim đồng nhất năng lượng tự nhiên với khả năng lái xe an toàn.',
  whyExplanationIsInsufficientVi:
    'Thêm giải thích không làm giả định này trở nên đáng tin.',
  repairVi: 'Thu hẹp claim về việc bài kiểm tra có thể sàng lọc một số rủi ro.',
};

test('validateOmissionCandidate accepts exact, previously omitted evidence', () => {
  assert.deepEqual(
    validateOmissionCandidate(candidate, essay, '# Assessment'),
    candidate,
  );
});

test('validateOmissionCandidate rejects paraphrased evidence', () => {
  assert.equal(
    validateOmissionCandidate(
      {
        ...candidate,
        exactClaim: 'Energetic people are always safe drivers',
      },
      essay,
      '# Assessment',
    ),
    null,
  );
});

test('validateOmissionCandidate rejects a claim already covered by Task Response', () => {
  const assessment = `
## 5. Must-Catch Errors

### Error 1: Unrealistic driver claim
Criterion: Task Response
Severity: major

Original evidence:
> "Only naturally energetic drivers would be able to pass these tests"

## 6. Optional / Style Suggestions
`;

  assert.equal(
    validateOmissionCandidate(candidate, essay, assessment),
    null,
  );
});

test('validateOmissionCandidate rejects low-confidence candidates', () => {
  assert.equal(
    validateOmissionCandidate(
      { ...candidate, confidence: 'low' },
      essay,
      '# Assessment',
    ),
    null,
  );
});

test('validateOmissionCandidate rejects thesis and topic-sentence candidates', () => {
  assert.equal(
    validateOmissionCandidate(
      { ...candidate, argumentRole: 'topic_sentence' },
      essay,
      '# Assessment',
    ),
    null,
  );
});
