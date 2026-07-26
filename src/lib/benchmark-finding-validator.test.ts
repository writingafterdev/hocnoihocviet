import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeFindingValidation } from './benchmark-finding-validator';

test('normalizeFindingValidation returns one decision per original finding', () => {
  const result = normalizeFindingValidation({
    decisions: [{
      findingIndex: 2,
      title: 'Second',
      verdict: 'remove',
      rationale: 'Support appears later.',
      revisedCriterion: '',
      revisedSeverity: '',
      revisedExplanation: '',
    }],
    omissions: [],
    summary: '',
  }, 2);

  assert.equal(result.decisions.length, 2);
  assert.equal(result.decisions[0].verdict, 'keep');
  assert.equal(result.decisions[1].verdict, 'remove');
});

test('normalizeFindingValidation rejects invalid indexes and limits omissions', () => {
  const result = normalizeFindingValidation({
    decisions: [{
      findingIndex: 9,
      title: 'Invalid',
      verdict: 'remove',
      rationale: '',
      revisedCriterion: '',
      revisedSeverity: '',
      revisedExplanation: '',
    }],
    omissions: Array.from({ length: 5 }, (_, index) => ({
      title: `Missing ${index}`,
      criterion: 'Task Response' as const,
      severity: 'medium' as const,
      evidence: `Evidence ${index}`,
      rationale: `Reason ${index}`,
    })),
    summary: '',
  }, 1);

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].verdict, 'keep');
  assert.equal(result.omissions.length, 3);
});

test('normalizeFindingValidation rejects omission evidence not present in the essay', () => {
  const result = normalizeFindingValidation({
    decisions: [],
    omissions: [{
      title: 'Missing comparison',
      criterion: 'Task Response',
      severity: 'major',
      evidence: 'Vietnamese paraphrase that is not in the essay',
      rationale: 'Not exact evidence.',
    }, {
      title: 'Unclear reference',
      criterion: 'Coherence',
      severity: 'minor',
      evidence: 'this project',
      rationale: 'Đại từ này có tham chiếu không rõ.',
    }],
    summary: '',
  }, 0, 'The writer says this project would be expensive.');

  assert.equal(result.omissions.length, 1);
  assert.equal(result.omissions[0].criterion, 'Cohesion');
});
