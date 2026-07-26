import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMustCatchFindings } from './examiner-finding-alignment';

test('extractMustCatchFindings extracts all criteria and excludes optional suggestions', () => {
  const markdown = `
## 5. Must-Catch Errors

### Error 1: Missing task coverage
Criterion: Task Response

### Error 2: Broken reference
Criterion: Cohesion

## 6. Optional / Style Suggestions

### Suggestion 1: Shorten this sentence
`;

  const findings = extractMustCatchFindings(markdown);
  assert.equal(findings.length, 2);
  assert.match(findings[0], /Missing task coverage/);
  assert.match(findings[1], /Broken reference/);
  assert.doesNotMatch(findings.join('\n'), /Shorten this sentence/);
});
