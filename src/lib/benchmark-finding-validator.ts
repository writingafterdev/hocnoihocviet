import { generateAssessmentJSON } from '@/lib/assessment-llm';
import { extractMustCatchFindings } from '@/lib/examiner-finding-alignment';

export const BENCHMARK_FINDING_VALIDATOR_VERSION = 'benchmark-finding-validator-v1';

export type FindingValidationVerdict = 'keep' | 'revise' | 'remove';

export interface FindingValidationDecision {
  findingIndex: number;
  title: string;
  verdict: FindingValidationVerdict;
  rationale: string;
  revisedCriterion: string;
  revisedSeverity: 'major' | 'medium' | 'minor' | '';
  revisedExplanation: string;
}

export interface ValidatedOmission {
  title: string;
  criterion: 'Task Response' | 'Coherence' | 'Cohesion' | 'Lexical Resource' | 'Grammar';
  severity: 'major' | 'medium' | 'minor';
  evidence: string;
  rationale: string;
}

export interface BenchmarkFindingValidationResult {
  decisions: FindingValidationDecision[];
  omissions: ValidatedOmission[];
  summary: string;
}

interface BenchmarkFindingValidatorInput {
  question: string;
  essay: string;
  assessmentMarkdown: string;
  requestLabel: string;
}

function buildValidatorPrompt(input: BenchmarkFindingValidatorInput) {
  const findings = extractMustCatchFindings(input.assessmentMarkdown);
  return `You are the second-pass finding validator for an IELTS Writing Task 2 assessment.

You are NOT writing a new assessment and NOT rescoring the essay.
Audit only whether the first assessor's proposed Must-Catch findings are definite, material, correctly classified, and supported by the complete essay.

# Primary objective

Precision comes first. Remove a finding when the essay already supplies the allegedly missing support, when the issue is merely optional, or when the diagnosis uses an examiner standard that IELTS Task 2 does not require.

Do not preserve a finding merely because the essay could be improved. Almost every sentence could be improved.

# Validation rules

For every proposed finding:

1. Read the complete relevant paragraph, not only the quoted sentence.
2. Reconstruct the writer's actual claim and all support already present.
3. Keep an underdevelopment finding only when a necessary inferential step is genuinely absent.
4. A concise claim → reason/result chain may be sufficient without statistics or a named example.
5. Do not demand research-level proof or elimination of confounding variables from an illustrative example.
6. If causal wording is too certain but the mechanism is present, revise the diagnosis to overclaiming; do not call it underdeveloped.
7. A concession, opposing-side paragraph, or limited exception is not position contradiction when the introduction and conclusion maintain the same directional judgment.
8. Keep position contradiction only when the essay contains two explicit, semantically incompatible final judgments.
9. Distinguish language damage from argument weakness. Awkward grammar does not erase reasoning the reader can still recover.
10. Keep grammar or lexical findings only when the quoted wording is genuinely wrong or materially awkward, not merely less elegant.

# Compact omission check

After validating existing findings, check only these high-value omissions:

- exact prompt actor/action/object/scope drift
- a required prompt part or comparative judgment genuinely missing
- a paragraph leaves its controlling idea and develops a different question
- an existing idea is placed so badly that the relationship becomes hard to follow
- unclear reference, given-new handoff, or materially mechanical linking
- a new main idea appears only in the conclusion
- a repeated grammar or lexical control pattern materially affects accuracy

Add at most three omissions.
Every omission must quote an exact span from the essay and identify a material reader/task consequence.
Do not add positive feedback, word-count preferences, generic advice, or optional style improvements.

# Output

Return JSON only:

{
  "decisions": [
    {
      "findingIndex": 1,
      "title": "original finding title",
      "verdict": "keep|revise|remove",
      "rationale": "concise Vietnamese explanation",
      "revisedCriterion": "criterion when verdict is revise, otherwise empty",
      "revisedSeverity": "major|medium|minor or empty",
      "revisedExplanation": "replacement Vietnamese diagnosis when revised, otherwise empty"
    }
  ],
  "omissions": [
    {
      "title": "short Vietnamese error name",
      "criterion": "Task Response|Coherence|Cohesion|Lexical Resource|Grammar",
      "severity": "major|medium|minor",
      "evidence": "exact English quote",
      "rationale": "concise Vietnamese explanation"
    }
  ],
  "summary": "short Vietnamese summary"
}

Return exactly one decision for every numbered finding below.
Do not invent finding indexes.

# Exam question

${input.question}

# Essay

${input.essay}

# Proposed Must-Catch findings

${findings.length
    ? findings.map((finding, index) => `## Finding ${index + 1}\n${finding}`).join('\n\n')
    : '[No proposed Must-Catch findings.]'}`;
}

export function normalizeFindingValidation(
  value: BenchmarkFindingValidationResult,
  findingCount: number,
  essay = '',
) {
  const byIndex = new Map<number, FindingValidationDecision>();
  for (const decision of Array.isArray(value.decisions) ? value.decisions : []) {
    const index = Number(decision.findingIndex);
    if (!Number.isInteger(index) || index < 1 || index > findingCount || byIndex.has(index)) continue;
    if (!['keep', 'revise', 'remove'].includes(decision.verdict)) continue;
    byIndex.set(index, {
      findingIndex: index,
      title: String(decision.title || '').trim(),
      verdict: decision.verdict,
      rationale: String(decision.rationale || '').trim(),
      revisedCriterion: String(decision.revisedCriterion || '').trim(),
      revisedSeverity: ['major', 'medium', 'minor'].includes(decision.revisedSeverity)
        ? decision.revisedSeverity
        : '',
      revisedExplanation: String(decision.revisedExplanation || '').trim(),
    });
  }

  const decisions = Array.from({ length: findingCount }, (_, index) => (
    byIndex.get(index + 1) || {
      findingIndex: index + 1,
      title: '',
      verdict: 'keep' as const,
      rationale: 'Validator did not return a usable decision; preserve the original finding for review.',
      revisedCriterion: '',
      revisedSeverity: '' as const,
      revisedExplanation: '',
    }
  ));
  const omissions = (Array.isArray(value.omissions) ? value.omissions : [])
    .filter((item) => item && item.evidence && item.rationale)
    .filter((item) => !essay || essay.includes(String(item.evidence).trim()))
    .slice(0, 3)
    .map((item) => ({
      title: String(item.title || '').trim(),
      criterion: (
        item.criterion === 'Coherence'
        && /\b(reference|refer|pronoun|đại từ|tham chiếu)\b/i.test(
          `${item.title} ${item.rationale}`,
        )
          ? 'Cohesion'
          : item.criterion
      ) as ValidatedOmission['criterion'],
      severity: item.severity,
      evidence: String(item.evidence || '').trim(),
      rationale: String(item.rationale || '').trim(),
    }));

  return {
    decisions,
    omissions,
    summary: String(value.summary || '').trim(),
  } satisfies BenchmarkFindingValidationResult;
}

export async function validateBenchmarkFindings(input: BenchmarkFindingValidatorInput) {
  const findingCount = extractMustCatchFindings(input.assessmentMarkdown).length;
  const result = await generateAssessmentJSON<BenchmarkFindingValidationResult>(
    'You validate proposed IELTS Task 2 findings. Return valid JSON only.',
    buildValidatorPrompt(input),
    input.requestLabel,
  );
  return normalizeFindingValidation(result, findingCount, input.essay);
}
