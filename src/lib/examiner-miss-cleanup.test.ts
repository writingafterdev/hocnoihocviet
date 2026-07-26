import assert from 'node:assert/strict';
import test from 'node:test';

import { provisionalMissedIndexes } from './examiner-miss-cleanup';

test('provisionalMissedIndexes returns only missed priority indexes', () => {
  assert.deepEqual(
    provisionalMissedIndexes([
      { priorityIndex: 1, verdict: 'covered' },
      { priorityIndex: 2, verdict: 'missed' },
      { priorityIndex: 3, verdict: 'not_assessment_target' },
      { priorityIndex: 4, verdict: 'missed' },
    ]),
    [2, 4],
  );
});
