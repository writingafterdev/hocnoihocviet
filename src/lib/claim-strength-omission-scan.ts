import { generateAssessmentJSON } from '@/lib/assessment-llm';
import { extractTaskResponseFindings } from '@/lib/claim-strength-audit';

export interface ClaimStrengthOmissionCandidate {
  exactClaim: string;
  paragraphContext: string;
  argumentRole:
    | 'supporting_detail'
    | 'topic_sentence'
    | 'thesis_or_position'
    | 'conclusion';
  claimProblem: 'overclaimed' | 'unrealistic';
  severity: 'major' | 'medium' | 'minor';
  confidence: 'high' | 'medium' | 'low';
  rationaleVi: string;
  whyExplanationIsInsufficientVi: string;
  repairVi: string;
}

export interface ClaimStrengthOmissionScanResult {
  candidate: ClaimStrengthOmissionCandidate | null;
  summaryVi: string;
}

interface ClaimStrengthOmissionScanInput {
  question: string;
  essay: string;
  assessmentMarkdown: string;
  requestLabel: string;
}

export const CLAIM_STRENGTH_OMISSION_SCAN_VERSION =
  'claim-strength-omission-scan-v1.2';

const CLAIM_STRENGTH_OMISSION_SCAN_SYSTEM_PROMPT = `
You are a narrow omission scanner for IELTS Writing Task 2 Task Response.

The main assessment has already been completed. Your only job is to check whether
it omitted ONE important claim whose content is itself too strong or unrealistic.

Return at most one candidate. Return null when no high-value omission exists.

Qualifying candidate:
- overclaimed: the writer states a conclusion whose scope, certainty, comparison,
  or causal force is stronger than the paragraph can reasonably establish.
- unrealistic: the writer relies on an implausible factual assumption or proposed
  consequence that would remain doubtful even after ordinary explanation.
- The candidate must be a supporting proposition inside the argument: a reason,
  mechanism, factual generalization, causal link, consequence, or proposed effect.

The decisive test:
"If the writer added one or two sound explanatory sentences while preserving the
same claim, would the claim become defensible?"
- If yes, this is missing explanation or underdevelopment. Return null.
- If no, because the claim itself must be narrowed, qualified, or replaced, it may
  qualify for this scan.

Do not report:
- missing explanation, shallow development, or weak evidence by itself
- a weak or mismatched example when the underlying claim remains reasonable
- missing task coverage, irrelevance, position contradiction, or unsupported
  weighing
- coherence, cohesion, grammar, vocabulary, factual proofreading, or style
- a point already substantially covered by an existing Task Response finding
- a merely debatable opinion
- a cautious or qualified claim
- the thesis, central position, direct answer to the prompt, or a body topic
  sentence merely because its judgment is strong; those are evaluated through
  task coverage, position, development, and weighing

Read every supporting proposition, not only the paragraph conclusion. In
particular, inspect universal claims about groups of people and causal chains
that move from exposure or policy to behaviour, crime, health, or social effects.
Words such as "may" do not automatically make the whole proposition reasonable
when its underlying assumption still generalizes an entire group.

Contrast examples:
- "Social media may spread false information." followed by no consequence is
  underdeveloped, not an omission candidate. A plausible mechanism can repair it.
- "Only naturally energetic people can pass a medical fitness test" is an
  unrealistic supporting assumption. More explanation cannot make natural energy
  the relevant medical standard.
- "Teenagers are ignorant and therefore violent media makes them go astray, so
  censorship will reduce crime" contains an overclaimed supporting causal chain.
  The writer must qualify or replace its assumptions, not merely elaborate them.
- "Dress matters as much as work quality" used as a paragraph's controlling
  reason is a topic sentence. Do not return it here; evaluate the supporting
  propositions that attempt to prove it.

Evidence rules:
- exactClaim must be the smallest exact continuous English quote containing the
  excessive or unrealistic proposition.
- paragraphContext must also be an exact continuous quote from the essay.
- Never paraphrase either evidence field.
- Explain in Vietnamese why ordinary added detail would not be enough.
- Prefer null over a speculative candidate.
- Confidence must be high or medium for a candidate. Never emit a low-confidence
  candidate.
- Return valid JSON only.
`.trim();

function normalizeEvidence(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildClaimStrengthOmissionScanUserPrompt(
  input: Omit<ClaimStrengthOmissionScanInput, 'requestLabel'>,
) {
  const existingFindings = extractTaskResponseFindings(
    input.assessmentMarkdown,
  );

  return `# Exam question

${input.question}

# Essay

${input.essay}

# Existing Task Response findings

${existingFindings.length > 0
    ? existingFindings.join('\n\n')
    : 'No existing Task Response findings.'}

# Required JSON shape

{
  "candidate": null
}

OR

{
  "candidate": {
    "exactClaim": "smallest exact English quote",
    "paragraphContext": "short exact English context containing the claim",
    "argumentRole": "supporting_detail|topic_sentence|thesis_or_position|conclusion",
    "claimProblem": "overclaimed|unrealistic",
    "severity": "major|medium|minor",
    "confidence": "high|medium",
    "rationaleVi": "why the claim itself is not defensible at its present strength",
    "whyExplanationIsInsufficientVi": "why adding ordinary explanation would not solve it",
    "repairVi": "how the writer must narrow, qualify, or replace the claim"
  },
  "summaryVi": "one short scan summary"
}`;
}

export function validateOmissionCandidate(
  candidate: ClaimStrengthOmissionCandidate | null | undefined,
  essay: string,
  assessmentMarkdown: string,
) {
  if (!candidate) return null;
  if (candidate.confidence === 'low') return null;
  if (candidate.argumentRole !== 'supporting_detail') return null;

  const normalizedEssay = normalizeEvidence(essay);
  const normalizedClaim = normalizeEvidence(candidate.exactClaim || '');
  const normalizedContext = normalizeEvidence(candidate.paragraphContext || '');

  if (
    normalizedClaim.length < 8
    || !normalizedEssay.includes(normalizedClaim)
    || !normalizedEssay.includes(normalizedContext)
    || !normalizedContext.includes(normalizedClaim)
  ) {
    return null;
  }

  const existingTaskResponseFindings = normalizeEvidence(
    extractTaskResponseFindings(assessmentMarkdown).join('\n\n'),
  );
  if (existingTaskResponseFindings.includes(normalizedClaim)) {
    return null;
  }

  return {
    ...candidate,
    exactClaim: candidate.exactClaim.trim(),
    paragraphContext: candidate.paragraphContext.trim(),
  };
}

export async function scanClaimStrengthOmission(
  input: ClaimStrengthOmissionScanInput,
): Promise<ClaimStrengthOmissionScanResult> {
  const result = await generateAssessmentJSON<ClaimStrengthOmissionScanResult>(
    CLAIM_STRENGTH_OMISSION_SCAN_SYSTEM_PROMPT,
    buildClaimStrengthOmissionScanUserPrompt(input),
    input.requestLabel,
  );
  const candidate = validateOmissionCandidate(
    result.candidate,
    input.essay,
    input.assessmentMarkdown,
  );

  return {
    candidate,
    summaryVi: candidate
      ? String(result.summaryVi || '').trim()
      : 'Không tìm thấy claim quá mức hoặc thiếu thực tế đủ chắc chắn mà assessment chính đã bỏ sót.',
  };
}
