import { generateAssessmentJSON } from '@/lib/assessment-llm';

export type ClaimStrengthDiagnosis =
  | 'missing_explanation'
  | 'weak_evidence'
  | 'overclaimed'
  | 'other';

export interface ClaimStrengthAuditDecision {
  findingTitle: string;
  evidence: string;
  originalDiagnosis: string;
  positionConflict: boolean;
  conflictingEvidence: string[];
  finalDiagnosis: ClaimStrengthDiagnosis;
  action: 'keep' | 'relabel' | 'remove';
  severity: 'major' | 'medium' | 'minor';
  confidence: 'high' | 'medium' | 'low';
  rationaleVi: string;
  repairVi: string;
}

export interface ClaimStrengthAuditResult {
  decisions: ClaimStrengthAuditDecision[];
  summaryVi: string;
}

interface ClaimStrengthAuditInput {
  question: string;
  essay: string;
  assessmentMarkdown: string;
  requestLabel: string;
}

export const CLAIM_STRENGTH_AUDIT_VERSION = 'claim-strength-audit-v1';

const CLAIM_STRENGTH_AUDIT_SYSTEM_PROMPT = `
You are a narrow IELTS Task 2 claim-strength auditor.

You do not reassess the whole essay.
You do not assign scores.
You do not add new feedback categories.
You only review Task Response findings already present in the supplied assessment.
The supplied findings have already been filtered to Criterion: Task Response.

For each existing Task Response finding that concerns development, evidence, causality, consequence, or claim strength, choose the most precise diagnosis:

1. missing_explanation
The relationship is plausible, but the writer has skipped an intermediate WHY/HOW step.
Adding a clear mechanism could complete the point without changing the claim itself.

2. weak_evidence
The claim may be reasonable, but the example or evidence does not establish that claim.
The repair requires a better example, evidence, or an explanation of what the example proves.

3. overclaimed
The conclusion itself is too broad, absolute, causally strong, or unrealistic for what the paragraph can reasonably prove.
Ordinary extra explanation is not enough. The writer must narrow, qualify, or replace the claim.

4. other
The finding is genuinely about another Task Response issue, such as missing coverage, position contradiction, irrelevance, or unsupported comparison.

Critical discrimination test:
- Ask: "If the writer added one sound intermediate explanation, would the original conclusion become defensible?"
- If yes: missing_explanation.
- If the example is the problem: weak_evidence.
- If no, because the conclusion remains too broad or implausible: overclaimed.

Position-contradiction lock:
- First decide positionConflict independently from the finding title.
- positionConflict is true only if the evidence or essay contains two incompatible central judgments.
- When positionConflict is true, return both exact judgments in conflictingEvidence.
- positionConflict cannot be true with fewer than two exact, incompatible quotes.
- Partial agreement plus a stated exception is normally compatible and is not a position conflict.
- A concession plus a final judgment is normally compatible and is not a position conflict.
- Mark true only when both judgments answer the same decision in mutually exclusive ways, such as “equal in measure” versus “overall negative”.
- If positionConflict is true, the diagnosis is "other".
- Do not relabel a real position contradiction as overclaimed.
- Overclaimed applies to one claim whose scope or causal force is excessive, not to the conflict between two different positions.
- A finding title that says "position" is not enough. Inspect the evidence. If it contains only one broad claim, positionConflict is false and that claim can still be overclaimed.

Rules:
- Preserve exact English evidence from the essay.
- Do not invent a claim that is not in the essay.
- Do not turn awkward grammar into an argument failure.
- Do not relabel position contradiction, missing task coverage, or coherence as claim strength.
- If the original Task Response finding is unsupported or duplicates another Task Response finding, use action "remove".
- Use Vietnamese for rationaleVi and repairVi.
- Keep the response compact.
- Return valid JSON only.
`.trim();

function buildClaimStrengthAuditUserPrompt(input: Omit<ClaimStrengthAuditInput, 'requestLabel'>) {
  const taskResponseFindings = extractTaskResponseFindings(
    input.assessmentMarkdown,
  );
  return `# Exam question

${input.question}

# Essay

${input.essay}

# Existing Task Response findings

${taskResponseFindings.join('\n\n')}

# Required JSON shape

{
  "decisions": [
    {
      "findingTitle": "exact or clearly matched existing finding title",
      "evidence": "smallest exact English quote",
      "originalDiagnosis": "what the existing assessment called it",
      "positionConflict": false,
      "conflictingEvidence": [],
      "finalDiagnosis": "missing_explanation|weak_evidence|overclaimed|other",
      "action": "keep|relabel|remove",
      "severity": "major|medium|minor",
      "confidence": "high|medium|low",
      "rationaleVi": "why this diagnosis is the precise one",
      "repairVi": "what kind of repair is actually needed"
    }
  ],
  "summaryVi": "one short audit summary"
}`;
}

export function extractTaskResponseFindings(assessmentMarkdown: string) {
  const mustCatchStart = assessmentMarkdown.indexOf('## 5.');
  if (mustCatchStart < 0) return [];
  const optionalStart = assessmentMarkdown.indexOf('## 6.', mustCatchStart);
  const mustCatchSection = assessmentMarkdown.slice(
    mustCatchStart,
    optionalStart >= 0 ? optionalStart : undefined,
  );

  return mustCatchSection
    .split(/(?=^### Error\b)/gim)
    .map((block) => block.trim())
    .filter((block) => /^### Error\b/im.test(block))
    .filter((block) => /^Criterion:\s*Task Response\s*$/im.test(block));
}

export async function auditClaimStrength(
  input: ClaimStrengthAuditInput,
): Promise<ClaimStrengthAuditResult> {
  if (extractTaskResponseFindings(input.assessmentMarkdown).length === 0) {
    return {
      decisions: [],
      summaryVi: 'Không có Task Response finding về claim strength để audit.',
    };
  }

  const result = await generateAssessmentJSON<ClaimStrengthAuditResult>(
    CLAIM_STRENGTH_AUDIT_SYSTEM_PROMPT,
    buildClaimStrengthAuditUserPrompt(input),
    input.requestLabel,
  );

  const normalizedEssay = input.essay
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const decisions = Array.isArray(result.decisions)
    ? result.decisions.map((decision) => {
      const conflictingEvidence = Array.isArray(decision.conflictingEvidence)
        ? decision.conflictingEvidence
          .map((quote) => String(quote || '').trim())
          .filter(Boolean)
        : [];
      const validConflictQuotes = conflictingEvidence.filter((quote) => (
        normalizedEssay.includes(
          quote
            .toLowerCase()
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/\s+/g, ' ')
            .trim(),
        )
      ));
      const positionConflict = Boolean(
        decision.positionConflict && validConflictQuotes.length >= 2,
      );

      return positionConflict
        ? {
          ...decision,
          positionConflict,
          conflictingEvidence: validConflictQuotes,
          finalDiagnosis: 'other' as const,
          action: decision.action === 'remove' ? 'remove' as const : 'relabel' as const,
        }
        : {
          ...decision,
          positionConflict: false,
          conflictingEvidence: validConflictQuotes,
        };
    })
    : [];

  return {
    decisions,
    summaryVi: String(result.summaryVi || '').trim(),
  };
}
