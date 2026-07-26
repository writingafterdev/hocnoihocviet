import { generateAssessmentJSON } from '@/lib/assessment-llm';

export type AiFindingVerdict =
  | 'corroborated'
  | 'partially_corroborated'
  | 'contradicted_by_examiner'
  | 'not_verifiable_from_reference';

export type ExaminerPriorityVerdict =
  | 'covered'
  | 'partially_covered'
  | 'missed'
  | 'not_assessment_target';

export interface AiFindingAlignment {
  findingTitle: string;
  criterion: string;
  verdict: AiFindingVerdict;
  examinerPriorityIndexes: number[];
  rationale: string;
}

export interface ExaminerPriorityAlignment {
  priorityIndex: number;
  verdict: ExaminerPriorityVerdict;
  aiFindingTitles: string[];
  rationale: string;
}

export interface ExaminerFindingAlignmentResult {
  aiFindings: AiFindingAlignment[];
  examinerPriorities: ExaminerPriorityAlignment[];
  summary: string;
}

interface ExaminerFindingAlignmentInput {
  question: string;
  essay: string;
  examinerPriorities: string[];
  assessmentMarkdown: string;
  requestLabel: string;
}

export const EXAMINER_FINDING_ALIGNMENT_VERSION =
  'examiner-finding-alignment-v1.1';

const EXAMINER_FINDING_ALIGNMENT_SYSTEM_PROMPT = `
You are evaluating an IELTS Task 2 assessment against examiner-derived reference
priorities for the same essay.

This is an alignment task, not a new essay assessment.

Evaluate in both directions:

1. Every AI Must-Catch finding
- corroborated: the examiner priorities identify substantially the same underlying
  essay problem, even if wording or taxonomy differs.
- partially_corroborated: the examiner supports part of the finding, but the AI
  changes its scope, severity, criterion, or causal explanation.
- contradicted_by_examiner: the examiner explicitly treats the same feature as
  acceptable, strong, correctly developed, or belonging to a materially different
  criterion. Examiner silence is not contradiction.
- not_verifiable_from_reference: the summarized examiner priorities neither
  support nor contradict the AI finding. Never call this a false positive.

2. Every examiner priority
- covered: at least one AI Must-Catch finding captures the same underlying error.
- partially_covered: the AI notices the area but misses the examiner's precise
  problem, boundary, severity, or criterion.
- missed: an explicit assessable essay error affecting judgment is absent from
  the AI Must-Catch findings.
- not_assessment_target: praise, a model strength, process advice, word-count
  preference, study advice, optional style preference, aspirational improvement,
  or metadata rather than an explicit essay error the assessment should report.

Rules:
- Compare semantic problems, not keyword overlap.
- Do not infer examiner agreement merely because both mention the same sentence.
- Criterion leakage counts as partially_confirmed, not confirmed.
- A more severe AI judgment than the examiner supports is partially_confirmed or
- A more severe AI judgment than the examiner supports is
  partially_corroborated, or contradicted_by_examiner only when the examiner
  explicitly rejects that severity.
- Examiner silence is never enough to mark an AI finding as contradicted.
- Positive examiner comments are not errors the AI Must-Catch list must reproduce.
- A recommendation such as "make the conclusion shorter", "mention ideas in the
  introduction", "use 275-300 words", or "discuss both sides" is
  not_assessment_target unless the priority explicitly says the current essay
  violates a task requirement or causes a criterion-level failure.
- Do not use the AI rewrite, optional suggestions, or scores as proof that a
  Must-Catch error was covered.
- Use only the supplied examiner priorities as the reference. Do not invent an
  examiner judgment.
- Keep rationales concise and concrete.
- Return valid JSON only.
`.trim();

export function extractMustCatchFindings(assessmentMarkdown: string) {
  const start = assessmentMarkdown.indexOf('## 5.');
  if (start < 0) return [];
  const end = assessmentMarkdown.indexOf('## 6.', start);
  const section = assessmentMarkdown.slice(start, end >= 0 ? end : undefined);
  return section
    .split(/(?=^### Error\b)/gim)
    .map((block) => block.trim())
    .filter((block) => /^### Error\b/im.test(block));
}

function buildUserPrompt(input: Omit<ExaminerFindingAlignmentInput, 'requestLabel'>) {
  const findings = extractMustCatchFindings(input.assessmentMarkdown);
  const priorities = input.examinerPriorities
    .map((priority, index) => `${index + 1}. ${priority}`)
    .join('\n');

  return `# Question

${input.question}

# Essay

${input.essay}

# Examiner-derived priorities

${priorities}

# AI Must-Catch findings

${findings.length > 0 ? findings.join('\n\n') : 'No Must-Catch findings.'}

# Required JSON

{
  "aiFindings": [
    {
      "findingTitle": "exact AI finding title",
      "criterion": "criterion stated by the AI",
      "verdict": "corroborated|partially_corroborated|contradicted_by_examiner|not_verifiable_from_reference",
      "examinerPriorityIndexes": [1],
      "rationale": "short concrete comparison"
    }
  ],
  "examinerPriorities": [
    {
      "priorityIndex": 1,
      "verdict": "covered|partially_covered|missed|not_assessment_target",
      "aiFindingTitles": ["matching AI finding title"],
      "rationale": "short concrete comparison"
    }
  ],
  "summary": "one concise case-level alignment summary"
}`;
}

export async function alignAssessmentWithExaminer(
  input: ExaminerFindingAlignmentInput,
) {
  return generateAssessmentJSON<ExaminerFindingAlignmentResult>(
    EXAMINER_FINDING_ALIGNMENT_SYSTEM_PROMPT,
    buildUserPrompt(input),
    input.requestLabel,
  );
}
