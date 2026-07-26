import { generateAssessmentJSON } from '@/lib/assessment-llm';
import { extractMustCatchFindings } from '@/lib/examiner-finding-alignment';

export type MissCleanupVerdict =
  | 'confirmed_miss'
  | 'covered'
  | 'partially_covered'
  | 'duplicate'
  | 'positive_feedback'
  | 'optional_or_process_advice';

export interface MissCleanupDecision {
  priorityIndex: number;
  verdict: MissCleanupVerdict;
  duplicateOfPriorityIndex: number | null;
  errorFamily: string;
  rationale: string;
}

export interface ExaminerMissCleanupResult {
  decisions: MissCleanupDecision[];
  summary: string;
}

interface ExaminerMissCleanupInput {
  question: string;
  essay: string;
  examinerPriorities: string[];
  provisionalMissedIndexes: number[];
  assessmentMarkdown: string;
  requestLabel: string;
}

export const EXAMINER_MISS_CLEANUP_VERSION = 'examiner-miss-cleanup-v1';

const EXAMINER_MISS_CLEANUP_SYSTEM_PROMPT = `
You are cleaning a provisional missed-error ledger for an IELTS Task 2
assessment benchmark.

You are not reassessing the essay. Review only examiner-priority rows previously
labeled "missed", and assign exactly one final verdict:

1. confirmed_miss
The priority explicitly identifies a current assessable essay error affecting
Task Response, Coherence, Cohesion, Lexical Resource, or Grammar, and no AI
Must-Catch finding captures the same underlying problem.

2. covered
An AI Must-Catch finding already captures substantially the same problem.

3. partially_covered
The AI notices the same area but misses the examiner's precise scope, boundary,
severity, or criterion.

4. duplicate
Another provisional missed priority in the same case describes the same
underlying error. Point duplicateOfPriorityIndex to the first equivalent row.

5. positive_feedback
The priority praises a strength, confirms adequacy, describes band potential, or
states that a feature is good/effective/clear. Positive feedback is not an error
the Must-Catch list must reproduce.

6. optional_or_process_advice
The priority gives a preferred word count, study advice, drafting strategy,
optional style improvement, aspirational recommendation, or general teaching
advice without identifying a present criterion-level failure.

Rules:
- A sentence containing praise plus a concrete current error is not automatically
  positive_feedback. Classify the actual error.
- "Could be shorter", "could mention ideas in the introduction", preferred essay
  length, and general advice to discuss both sides are optional unless the
  examiner explicitly says the current choice causes a task failure.
- Do not infer a confirmed miss from vague improvement advice.
- Compare semantic problems rather than keywords.
- Use the complete AI Must-Catch findings when deciding covered or partial.
- Preserve the supplied priority indexes.
- Use short English rationales.
- Return valid JSON only.
`.trim();

function buildUserPrompt(input: Omit<ExaminerMissCleanupInput, 'requestLabel'>) {
  const provisionalRows = input.provisionalMissedIndexes
    .map((index) => `${index}. ${input.examinerPriorities[index - 1] || ''}`)
    .join('\n');
  const allPriorities = input.examinerPriorities
    .map((priority, index) => `${index + 1}. ${priority}`)
    .join('\n');
  const findings = extractMustCatchFindings(input.assessmentMarkdown);

  return `# Question

${input.question}

# Essay

${input.essay}

# All examiner priorities

${allPriorities}

# Provisional missed rows to clean

${provisionalRows}

# AI Must-Catch findings

${findings.length > 0 ? findings.join('\n\n') : 'No Must-Catch findings.'}

# Required JSON

{
  "decisions": [
    {
      "priorityIndex": 1,
      "verdict": "confirmed_miss|covered|partially_covered|duplicate|positive_feedback|optional_or_process_advice",
      "duplicateOfPriorityIndex": null,
      "errorFamily": "short stable family name, or none",
      "rationale": "short concrete reason"
    }
  ],
  "summary": "one concise cleanup summary"
}`;
}

export function provisionalMissedIndexes(
  priorities: Array<{ priorityIndex: number; verdict: string }>,
) {
  return priorities
    .filter((item) => item.verdict === 'missed')
    .map((item) => item.priorityIndex);
}

export async function cleanExaminerMisses(
  input: ExaminerMissCleanupInput,
) {
  if (input.provisionalMissedIndexes.length === 0) {
    return {
      decisions: [],
      summary: 'No provisional missed rows.',
    } satisfies ExaminerMissCleanupResult;
  }
  return generateAssessmentJSON<ExaminerMissCleanupResult>(
    EXAMINER_MISS_CLEANUP_SYSTEM_PROMPT,
    buildUserPrompt(input),
    input.requestLabel,
  );
}
