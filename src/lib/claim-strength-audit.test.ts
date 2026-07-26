import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTaskResponseFindings } from './claim-strength-audit';

test('extractTaskResponseFindings keeps only Task Response error blocks', () => {
  const markdown = `
## 5. Must-Catch Errors

### Error 1: Missing mechanism
Criterion: Task Response
Severity: major

Original evidence:
> "This causes problems."

### Error 2: Broken sentence
Criterion: Grammar
Severity: medium

Original evidence:
> "people is"

### Error 3: Weak evidence
Criterion: Task Response
Severity: medium

Original evidence:
> "For example..."

## 6. Optional / Style Suggestions

### Suggestion 1
Criterion: Style
`;

  const findings = extractTaskResponseFindings(markdown);

  assert.equal(findings.length, 2);
  assert.match(findings[0], /Missing mechanism/);
  assert.match(findings[1], /Weak evidence/);
  assert.doesNotMatch(findings.join('\n'), /Broken sentence/);
});

test('extractTaskResponseFindings returns an empty list without Must-Catch Errors', () => {
  assert.deepEqual(extractTaskResponseFindings('# Reference Assessment'), []);
});
