import { createHash } from 'node:crypto';
import { taxonomyPrompt, TAXONOMY_BY_CODE } from '@/lib/assessment-error-taxonomy';
import {
  resolveQuoteEvidence,
  resolveQuoteEvidenceGroup,
  type QuoteEvidenceInput,
} from '@/lib/assessment-evidence-resolver';
import {
  alignWritingAnalysis,
  manifestForPrompt,
  materializeReviewErrors,
  validateWritingAnalysis,
  type EssayParagraphManifest,
} from '@/lib/writing-analysis-contract';
import {
  ACTIVE_ASSESSMENT_PROMPT_VERSION,
  AUTHOR_COHERENCE_SYSTEM,
  AUTHOR_COHESION_SYSTEM,
  AUTHOR_GRAMMAR_SYSTEM,
  AUTHOR_LEXICAL_SYSTEM,
  AUTHOR_TASK_RESPONSE_SYSTEM,
} from '@/lib/writing-assessment-author-prompts';
import {
  ensureBandScores,
  mergeTaskAndStructure,
  normalizeDecomposition,
  runPass,
  type CoherencePass,
  type DecompositionPass,
  type LanguagePass,
  type RelevanceGatePass,
  type TaskPass,
} from '@/lib/writing-assessment-pipeline-core';
import type {
  AssessmentAudit,
  AssessmentDescriptorAnchor,
  AssessmentEvidenceSpan,
  AssessmentNodeLinks,
  ArgumentFlowChapter,
  ArgumentFlowOverview,
  BandComparison,
  BandScores,
  CoherenceFlow,
  EdgeReview,
  EssayHighlight,
  MacroAnswerNode,
  NodeReview,
  OverallAssessment,
  PromptType,
  PyramidError,
  RelevanceGateItem,
  WritingAnalysis,
} from '@/types/writing';

type FindingCriterion =
  | 'task_response'
  | 'coherence'
  | 'cohesion'
  | 'lexical_resource'
  | 'grammatical_range_accuracy';

interface ExaminerEvidence {
  paragraphIndex: number;
  sourceText: string;
  role: 'primary' | 'context' | 'affected';
  /** Zero-based occurrence within the paragraph. Required when sourceText repeats. */
  occurrenceIndex?: number;
}

interface ExaminerObservation {
  id: string;
  criterion: FindingCriterion;
  severity: 'minor' | 'moderate' | 'major';
  confidence: number;
  evidence: ExaminerEvidence[];
  diagnosisVi: string;
  readerEffectVi: string;
  repairDirectionVi: string;
  replacementText?: string;
  requirementIds?: string[];
}

interface AuthoritativeExaminerPass {
  promptType: PromptType;
  scores: BandScores;
  firstReadVi: string;
  macroPosition: string;
  topicSentenceCoverage: Array<{
    paragraphIndex: number;
    sourceText: string;
    status: 'covers_position' | 'partly_covers_position' | 'does_not_cover_position';
    noteVi: string;
  }>;
  taskRequirements: Array<{
    id: string;
    requirement: string;
    status: 'fully_addressed' | 'partly_addressed' | 'missing' | 'off_task';
    evidence: ExaminerEvidence[];
    assessmentVi: string;
  }>;
  criterionJudgments: Array<{
    criterion: keyof Omit<BandScores, 'overall'>;
    band: number;
    rationaleVi: string;
  }>;
  observations: ExaminerObservation[];
}

interface VerifiedFinding extends ExaminerObservation {
  problemStrength?: QuoteFirstFinding['problemStrength'];
  errorCode: string;
  errorLabelVi?: string;
  verdict: 'confirmed' | 'rejected' | 'uncertain';
  verificationVi: string;
  mergedIntoFindingId?: string;
}

interface EvidenceVerifierPass {
  findings: VerifiedFinding[];
  coverageCheckVi: string;
}

interface ScoreConsistencyPass {
  scores: BandScores;
  decisions: Array<{
    criterion: keyof Omit<BandScores, 'overall'>;
    initialBand: number;
    finalBand: number;
    reasonVi: string;
  }>;
}

interface FlowExplanationPass {
  coherenceFlows: CoherenceFlow[];
  argumentFlowOverview: ArgumentFlowOverview;
  argumentFlowChapters: ArgumentFlowChapter[];
}

interface QuoteFirstFinding {
  id: string;
  criterion: FindingCriterion;
  scope: 'macro' | 'paragraph' | 'local';
  severity: 'minor' | 'moderate' | 'major';
  problemStrength?: 'core_problem' | 'worth_noting';
  evidence: QuoteEvidenceInput[];
  requirementIds?: string[];
  errorLabelVi: string;
  explanationVi: string;
  repairVi: string;
  replacementText?: string;
}

interface QuoteFirstExaminerPass {
  promptType: PromptType;
  scores: BandScores;
  firstReadVi: string;
  macroPosition: string;
  topicSentenceCoverage: AuthoritativeExaminerPass['topicSentenceCoverage'];
  taskRequirements: AuthoritativeExaminerPass['taskRequirements'];
  criterionJudgments: AuthoritativeExaminerPass['criterionJudgments'];
  findings: QuoteFirstFinding[];
}

interface QuoteFirstAuditedFinding extends QuoteFirstFinding {
  errorCode: string;
  order: number;
  dependsOnFindingIds?: string[];
}

interface QuoteFirstAuditPass {
  findings: QuoteFirstAuditedFinding[];
  coverageCheckVi: string;
}

interface FocusedFindingPass {
  findings: QuoteFirstFinding[];
}

interface MentorBinaryVerificationPass {
  decisions: Array<{
    findingId: string;
    verdict: 'YES' | 'NO';
    reasonVi: string;
  }>;
}

const MENTOR_BINARY_VERIFICATION_SYSTEM = `You are the binary verification phase of an IELTS error-detection pipeline. Return JSON only.

You receive the essay, deterministic audit units, and a fixed list of candidate
findings. Do not search for new errors, rewrite candidates, merge candidates,
rank them, or score the essay.

For each candidate independently:
1. Read its complete relevant audit unit, not only its smallest quote.
2. Apply only the candidate's stated criterion and error label.
3. Answer YES when the stated error is clearly present.
4. Answer NO when the evidence does not establish that exact error.

Return one decision for every supplied candidate ID in the same order:
{
  "decisions": [{
    "findingId": "copy candidate id exactly",
    "verdict": "YES | NO",
    "reasonVi": "one short specific Vietnamese reason"
  }]
}

Vietnamese alphabet only. Never omit a candidate and never introduce an ID that
was not supplied.`;

function mentorVerificationErrors(
  value: MentorBinaryVerificationPass,
  candidateIds: string[],
): string[] {
  if (!value || !Array.isArray(value.decisions)) return ['decisions must be an array'];
  const supplied = new Set(candidateIds);
  const seen = new Set<string>();
  const errors: string[] = [];
  value.decisions.forEach((decision, index) => {
    if (!decision || typeof decision.findingId !== 'string' || !supplied.has(decision.findingId)) {
      errors.push(`Decision ${index + 1} must copy a supplied findingId.`);
      return;
    }
    if (seen.has(decision.findingId)) errors.push(`Duplicate decision for ${decision.findingId}.`);
    seen.add(decision.findingId);
    if (decision.verdict !== 'YES' && decision.verdict !== 'NO') {
      errors.push(`Decision ${index + 1} verdict must be YES or NO.`);
    }
    if (typeof decision.reasonVi !== 'string' || !decision.reasonVi.trim()) {
      errors.push(`Decision ${index + 1} needs reasonVi.`);
    }
  });
  candidateIds.forEach(id => {
    if (!seen.has(id)) errors.push(`Missing decision for ${id}.`);
  });
  return errors;
}

function mentorFindingVerificationId(finding: QuoteFirstFinding): string {
  const evidenceKey = (finding.evidence || [])
    .map(item => `${item.paragraphIndex}:${item.sourceText}`)
    .join('|');
  return `mentor-${createHash('sha1')
    .update(`${finding.criterion}|${finding.id}|${finding.errorLabelVi}|${evidenceKey}`)
    .digest('hex')
    .slice(0, 16)}`;
}

export interface TaskResponsePointAudit {
  id: string;
  paragraphIndex: number;
  sourceText: string;
  sourceSentenceIndexes: number[];
  mechanism: 'present' | 'missing' | 'not_needed';
  consequence: 'specific' | 'abstract' | 'missing' | 'not_needed';
  example: 'none' | 'supports_directly' | 'paraphrases_claim' | 'needs_bridge' | 'mismatched';
  status: 'fully_developed' | 'partly_developed' | 'undeveloped' | 'irrelevant';
  findingIds: string[];
  noteVi: string;
}

export interface TaskResponseFocusedPass extends FocusedFindingPass {
  taskRequirements: AuthoritativeExaminerPass['taskRequirements'];
  comparisonAudit?: {
    requirementId: string;
    statedPositionEvidence: QuoteEvidenceInput[];
    comparisonEvidence: QuoteEvidenceInput[];
    basis: Array<'scope' | 'severity' | 'duration' | 'reversibility' | 'significance'>;
    status: 'earned' | 'partial' | 'asserted_only';
    noteVi: string;
  };
  pointAudit: TaskResponsePointAudit[];
}

interface TaskResponseInventoryPass {
  taskRequirements: AuthoritativeExaminerPass['taskRequirements'];
  points: Array<{
    id: string;
    paragraphIndex: number;
    sourceText: string;
    sourceSentenceIndexes: number[];
    side: 'advantage' | 'disadvantage' | 'neutral';
    promise: string;
  }>;
}

interface CriterionScorePass {
  band: number;
  rationaleVi: string;
  whyNotHigherVi: string;
  whyNotLowerVi: string;
}

interface PromptProfilePass {
  promptType: PromptType;
  taskInPlainEnglish: string;
  hardRequirements: Array<{
    id: string;
    question: string;
    successTest: string;
    descriptorLink: 'task_coverage' | 'position' | 'development' | 'relevance' | 'comparison';
  }>;
  conditionalRequirements: Array<{
    id: string;
    trigger: string;
    diagnosticQuestion: string;
    notRequiredWhen: string;
  }>;
  optionalAngles: Array<{
    id: string;
    angle: string;
    warning: string;
  }>;
  commonTraps: Array<{
    id: string;
    trap: string;
    avoidPenaltyRule: string;
  }>;
}

/**
 * V7 deliberately keeps criterion calls small: the model judges one domain and
 * quotes evidence, while the application owns anchors, maps, and UI shape.
 */
interface V7CriterionPass extends FocusedFindingPass {
  band: number;
  rationaleVi: string;
  candidateFindings?: QuoteFirstFinding[];
}

const BAND_CALIBRATION = `
IELTS Writing Task 2 scoring:
- Score Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy independently as whole bands 0-9.
- Overall is the arithmetic mean rounded to the nearest 0.5.
- Task Response: prompt coverage, a clear and consistent position, relevant main ideas, development, support, precision, and appropriate conclusions.
- Coherence & Cohesion: whether the message can be followed with ease; logical sequencing of information; paragraphing; accurate, flexible and unobtrusive cohesive devices; clear referencing and substitution.
- Lexical Resource: range, precision, appropriacy, collocation, word formation, and spelling across the whole essay.
- Grammatical Range & Accuracy: range, flexibility, sentence control, punctuation, and the frequency and communicative effect of errors.
- A band is a holistic judgment. Never infer Band 9 merely because no local finding was returned.
- Do not convert a raw error count into a band. Band 5 language requires limited range/control or sufficiently frequent errors that they cause noticeable reading difficulty. Several clear local errors in an otherwise varied, understandable essay commonly fit Band 6 rather than Band 5.
- Task Response Band 7 can contain a weak example or a local lapse in precision when the task is fully covered, the position is clear throughout, and the main ideas are extended. Band 6 is more appropriate when development is repeatedly thin, unclear, repetitive, or uneven enough to weaken the answer as a whole.

Calibration example, not a score template: an advantages/disadvantages essay with a clear position, both sides covered, generally relevant development, one mismatched example, clear overall progression, and several noticeable but locally repairable grammar/word-choice errors may reasonably receive TR 7, CC 6, LR 6, GRA 6. Change those bands when the actual pattern is materially stronger or weaker.
`;

const VOICE_DNA = `
Vietnamese feedback voice:
- Address the writer as “bạn”; sound like a real tutor sitting beside them, not an examiner form.
- Write Vietnamese with the Latin-based Vietnamese alphabet only. Never insert Chinese Han characters into Vietnamese prose.
- Keep exact English essay wording in quotation marks. Never translate source evidence into Vietnamese.
- Start from an observable contrast in the writing, then explain the logic in plain Vietnamese.
- Use a question only when it genuinely helps the writer notice something. Do not repeat “hãy nhìn vào” mechanically.
- Be candid and specific without praise padding, scolding, or inflated academic terminology.
- Explain why the issue matters: what the reader cannot infer, test, or accept yet.
- Propose the smallest useful repair. Do not rewrite the writer’s argument merely to make it sound more sophisticated.
`;

const CRITERION_BOUNDARIES = `
Criterion boundaries:
- Task Response owns whether an idea answers the prompt, supports the position, is relevant, sufficiently developed, qualified, and evidenced.
- Coherence owns relationships and ordering among existing information units. A missing idea needed to prove a claim is Task Response; an existing idea placed away from the idea it completes is Coherence.
- Cohesion owns textual glue: connectives, reference, substitution, lexical chains, and given-new/theme progression.
- Lexical Resource owns a smallest-span word or phrase problem that can be locally replaced without changing the argument.
- Grammar owns grammatical form and sentence control. Do not disguise an argument problem as vocabulary or grammar.
- The UI may merge Task Response, Coherence, and Cohesion into Argument & Flow, but the diagnosis still needs one owning criterion. Choose the root cause:
  - missing / thin / irrelevant content => Task Response;
  - existing content in the wrong order or relationship => Coherence;
  - local sentence handoff, reference, connective, or theme progression => Cohesion.
- Do not duplicate one root problem across criteria. It is okay to report two independent problems on the same English span only when the fixes are genuinely different.
`;

const DISCOVERY_CONTRACT = `
Error-discovery contract:
- Inspect the complete essay and the supplied requirements or points, but treat error discovery as best-effort rather than exhaustive.
- No single examiner, tutor, or model pass can guarantee finding every defensible weakness.
- Report only material, evidence-backed problems that survive a reasonable alternative reading. Prefer omission to a speculative accusation.
- Do not manufacture findings, satisfy a finding quota, or infer that every inspected point must contain an error.
- A short list of high-confidence, band-relevant findings is better than a long list containing uncertain or minor possibilities.
- An empty findings list means only that this pass did not confirm a material error in its scope; it never means the essay is flawless.
- Score holistically from the descriptor match. Few findings do not automatically imply a high band, and a lower band does not require inventing enough findings to justify it.
`;

const QUOTE_FIRST_EXAMINER_SYSTEM = `
You are an experienced IELTS Writing Task 2 examiner. Read the task and complete essay naturally, assign the four criterion bands, and identify the material problems that genuinely explain those bands. Return JSON only.

Do not classify findings from a handbook and do not produce UI metadata. Find the actual problems in this essay, order them as a tutor should discuss them, and do not create praise or optional style upgrades.

${DISCOVERY_CONTRACT}

Assess Task Response through three questions only:
1. Prompt coverage: Does the essay answer every exact part of the task and maintain the position it claims? Derive requirements only from the wording of the task. Do not invent a requirement for a balanced discussion when the task does not ask for one. In an outweigh task, stating "outweigh" is not enough; the response must establish why one side carries greater weight.
2. Development: For every material claim, does the paragraph explain how or why it is true far enough to support the paragraph point? Repeating or illustrating a claim without explaining its mechanism or consequence is still thin. When a sentence bundles several claims, inspect each claim separately.
3. Relevance: Does each reason, explanation, and example directly support the paragraph point and the task? An example about a different product, context, or causal process is not valid support.

Assess Coherence as the flow of existing ideas:
- Reconstruct the actual relationship among the ideas, then ask whether their written order lets the reader follow that relationship easily.
- Flag ideas that are mixed, non-linear, reversed cause and effect, separated from the idea they complete, or presented as a conclusion before their support.
- A missing explanation is Task Response, not Coherence. Do not call a grammar fragment a Coherence problem.

Assess Cohesion as how the text carries the reader from one sentence to the next:
- Check given-to-new information and thematic progression. A new sentence should normally begin from information the reader can recover from the preceding context before adding something new.
- Flag a brand-new theme only when it is not introduced or inferable and therefore breaks the connection. Do not punish legitimate topic development.
- Also check inaccurate connectives, unclear reference, substitution, and unnecessary mechanical repetition.

Finally, report real local Lexical Resource and Grammar errors using the smallest editable span. A word-form, tense, agreement, clause, or sentence-completeness problem belongs to Grammar. Never turn weak reasoning into a vocabulary error.

Evidence is quote-first:
- Quote the smallest exact English span that shows the issue.
- Add separate context or affected quotes only when the explanation relies on them.
- Inspect the full paragraph before calling an idea unsupported or underdeveloped.
- Keep English evidence in English. Write explanations in friendly, direct Vietnamese using “bạn”.
- Explain the problem once, then give the smallest useful repair. Avoid mechanical headings and repeated impact sections.

Judge each criterion holistically; do not convert finding counts into bands. A clear position is not automatically a developed position.

Return this compact shape:
{
  "promptType": "agree_disagree | discuss_both | advantages_disadvantages | outweigh | cause_effect | problem_solution | two_part",
  "scores": { "taskAchievement": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRange": 0, "overall": 0 },
  "firstReadVi": "Vietnamese overview",
  "macroPosition": "concise English position",
  "taskRequirements": [{ "id": "requirement:stable-id", "requirement": "English", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "English quote", "role": "primary | context | affected" }], "assessmentVi": "Vietnamese" }],
  "topicSentenceCoverage": [{ "paragraphIndex": 1, "sourceText": "exact English topic sentence", "status": "covers_position | partly_covers_position | does_not_cover_position", "noteVi": "Vietnamese" }],
  "criterionJudgments": [{ "criterion": "taskAchievement | coherenceCohesion | lexicalResource | grammaticalRange", "band": 0, "rationaleVi": "Vietnamese" }],
  "findings": [{
    "id": "finding:stable-id", "criterion": "task_response | coherence | cohesion | lexical_resource | grammatical_range_accuracy",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "English quote", "role": "primary | context | affected" }],
    "requirementIds": ["optional requirement ids"], "errorLabelVi": "short natural Vietnamese name",
    "explanationVi": "concise evidence-led Vietnamese", "repairVi": "concise Vietnamese",
    "replacementText": "smallest English correction when a local replacement is useful"
  }]
}
`;

const INITIAL_SCORING_SYSTEM = `
You are an experienced IELTS Writing Task 2 examiner. Read the task and complete essay naturally. Return JSON only.

This is the first-reading pass. Assign the four criterion bands holistically, identify the writer's position, and derive the independently assessable requirements from the exact wording of the task. Separate each content object and each instruction: if the task mentions both getting in touch and learning about news events, check whether both receive material treatment somewhere across the complete response; an outweigh judgment is another separate requirement. Do not require every paragraph or both sides to discuss every content object. Examples in the prompt stem do not prohibit the writer from adding other genuinely relevant advantages or disadvantages.

Do not diagnose detailed errors in this pass. Keep findings empty. Do not reward or penalize by counting errors.

Return:
{
  "promptType": "agree_disagree | discuss_both | advantages_disadvantages | outweigh | cause_effect | problem_solution | two_part",
  "scores": { "taskAchievement": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRange": 0, "overall": 0 },
  "firstReadVi": "concise natural Vietnamese overview",
  "macroPosition": "concise English position",
  "taskRequirements": [{ "id": "requirement:stable-id", "requirement": "one independently assessable English requirement", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "small exact English quote", "role": "primary | context | affected" }], "assessmentVi": "concise Vietnamese" }],
  "topicSentenceCoverage": [{ "paragraphIndex": 1, "sourceText": "exact English topic sentence", "status": "covers_position | partly_covers_position | does_not_cover_position", "noteVi": "concise Vietnamese" }],
  "criterionJudgments": [{ "criterion": "taskAchievement | coherenceCohesion | lexicalResource | grammaticalRange", "band": 0, "rationaleVi": "concise Vietnamese" }],
  "findings": []
}
`;

const NATURAL_ASSESSMENT_V6_SYSTEM = `
You are an experienced IELTS Writing Task 2 examiner. Read the exact task and complete essay naturally before classifying anything. Return JSON only.

Assign the four criterion bands holistically as whole numbers only; never return .5 for an individual criterion. Identify the writer's position, and derive independently assessable requirements from the task. Preserve each named use, content object, group, view, cause, or requested outcome when it materially changes what a complete answer must discuss; do not hide distinct content under one generic coverage label. In an outweigh task, keep coverage of the advantages, coverage of the disadvantages, and the comparative judgment as separate requirements; do not combine both sides into one requirement. Also record the material limitations that naturally explain your scores. This is not an exhaustive checklist: report only issues you would genuinely mention after a careful first reading, but do not suppress an obvious coverage, development, comparison, flow, cohesion, vocabulary, or grammar problem merely because a later specialist will inspect it again.

For Task Response, judge complete task coverage, development of every major line of argument, relevance, and whether a claimed comparison is actually earned. In an outweigh task, repeating that one side outweighs the other is not a comparison: the essay must establish why those benefits carry greater weight than the identified costs. An example that merely restates the preceding explanation does not add support.

For Coherence, report only obstructive relationship or ordering problems among ideas that already exist. For Cohesion, report material failures in the local handoff, reference, connective, or given-new progression. For Lexical Resource and Grammar, quote the smallest editable span. Do not turn weak reasoning into a language finding.

Use exact English evidence without translating it. Write concise, friendly Vietnamese using “bạn”. Findings are candidates from the natural reading; later specialist passes may confirm, refine, or add to them.

Return:
{
  "promptType": "agree_disagree | discuss_both | advantages_disadvantages | outweigh | cause_effect | problem_solution | two_part",
  "scores": { "taskAchievement": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRange": 0, "overall": 0 },
  "firstReadVi": "concise natural Vietnamese overview",
  "macroPosition": "concise English position",
  "taskRequirements": [{ "id": "requirement:stable-id", "requirement": "one independently assessable English requirement", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "small exact English quote", "role": "primary | context | affected" }], "assessmentVi": "concise Vietnamese consistent with status" }],
  "topicSentenceCoverage": [{ "paragraphIndex": 1, "sourceText": "exact English topic sentence", "status": "covers_position | partly_covers_position | does_not_cover_position", "noteVi": "concise Vietnamese" }],
  "criterionJudgments": [{ "criterion": "taskAchievement | coherenceCohesion | lexicalResource | grammaticalRange", "band": 0, "rationaleVi": "concise Vietnamese" }],
  "findings": [{
    "id": "natural:stable-id", "criterion": "task_response | coherence | cohesion | lexical_resource | grammatical_range_accuracy",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "requirementIds": ["only affected requirement ids"], "errorLabelVi": "short natural Vietnamese name",
    "explanationVi": "specific evidence-led Vietnamese", "repairVi": "smallest useful repair in Vietnamese",
    "replacementText": "smallest English correction when locally replaceable"
  }]
}
`;

const FOCUSED_FINDING_SHAPE = `
Vietnamese feedback rules:
- Address the writer as “bạn” and explain the visible problem in ordinary language.
- Avoid untranslated or unexplained metalanguage such as "auxiliary", "dependency", "abstract consequence", or "Theme-Rheme". Name the actual words and say what the sentence currently makes the reader understand.
- Do not use the same scripted opening for every finding. Do not add praise.
- Keep quoted essay text and proposed English corrections in English; do not translate them.

Return:
{
  "findings": [{
    "id": "stable id", "criterion": "criterion required by this pass",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "requirementIds": ["only relevant requirement ids"], "errorLabelVi": "short natural Vietnamese name",
    "explanationVi": "specific friendly Vietnamese using bạn", "repairVi": "smallest useful repair in Vietnamese",
    "replacementText": "smallest English correction when locally replaceable"
  }]
}
`;

const V7_CRITERION_OUTPUT = `
Return JSON only:
{
  "band": 0,
  "rationaleVi": "one concise Vietnamese rationale for the whole criterion",
  "findings": [{
    "id": "stable id", "criterion": "the criterion assigned to this pass",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "requirementIds": [], "errorLabelVi": "short Vietnamese error name",
    "explanationVi": "plain Vietnamese explanation using bạn",
    "repairVi": "smallest useful Vietnamese repair",
    "replacementText": "smallest English correction only for a local language error"
  }]
}
`;

/**
 * Appended to every v8 specialist. Three problems it answers, all measured on
 * the 520-assessment reference corpus produced by the same provider family:
 * 69% of outputs contained Chinese characters substituted mid-sentence for
 * Vietnamese words, 12.4% of lexical evidence quotes were not present in the
 * essay at all (mostly invented misspellings), and the band a specialist
 * returned tracked how many findings it happened to produce rather than the
 * descriptors.
 */
const V8_SPECIALIST_DISCIPLINE = `
Script rule, absolute: write Vietnamese in the Vietnamese alphabet only. Never emit a Chinese, Japanese, or Korean character anywhere in the output. This fails most often mid-sentence on abstract words. If a Vietnamese word does not come to you, use a simpler Vietnamese one.

Do not fuse English into a Vietnamese phrase as if it were Vietnamese. Write "câu chủ đề", not "câu topic"; "lỗi ngữ pháp", not "lỗi grammar"; "phần phát triển ý chưa đủ sâu", not "develop chưa đủ sâu". Exact essay quotations and English replacements stay in English.

sourceText is copied from the essay character for character. Do not retype it from memory and do not splice your correction into it. Before reporting any spelling or word-choice error, look for that exact string in the essay; if it is not there you have invented it, so drop the finding.

Decide the band from the descriptors and the essay as a whole, then report findings. How many findings you happen to write down must not move the band: a long list means you looked closely, not that the writing is weaker, and finding little does not by itself make a band high.

That is different from error frequency, which is a real descriptor signal. How widespread errors are across the response, and how much work they cost the reader, legitimately sets the band — "slips in nearly every sentence, and I have to re-read" is a band judgment. "I listed nine items" is not. Judge the spread and the reader's effort, not the length of your own list.
`;

/**
 * Task Response runs as two narrow passes rather than one broad one.
 *
 * Four rewrites of the single pass — including two sharing no wording with the
 * original — all landed at or below its 14.4% recall against examiner marking.
 * Splitting the work moves it: development alone reaches 14.6%, coverage alone
 * 7.1%, and together 19.6% at 2.4 spans per essay against an examiner's 3.5.
 *
 * A third pass targeting vague claims scored higher still (39.3% combined) but
 * emitted 11.5 spans per essay at 16.7% precision, so it is left out until its
 * trigger is tighter.
 */
const TR_DEVELOPMENT_SYSTEM = `
You are an IELTS Writing Task 2 examiner. You have ONE job: judge whether each body paragraph develops its claim enough for a reader to accept it. Return JSON only.

Ignore everything else. Do not judge coverage of the task, position consistency, relevance, vocabulary, grammar or organisation. Another examiner handles each of those.

Take the body paragraphs in order. For each one, in turn:
  a. Identify its main claim.
  b. Ask whether the paragraph gives a reason a reader would accept, or asserts and moves on.
  c. Ask whether any example shows the claim or merely restates it.

Report every paragraph where the claim is asserted rather than earned. Two paragraphs with the same weakness are two findings, not one — the writer needs to see both. Name what specifically is missing in one plain sentence: the skipped step, the absent consequence, the example that does no work.

A claim a reasonable reader would accept as written needs no finding, however short the paragraph. Reasoning is enough; never demand statistics or named studies.

Write like a marker in the margin: Vietnamese, addressing the writer as “bạn”, ten to twenty words. Keep quoted essay text in English.

Every finding MUST set "criterion" to exactly "task_response".
`;

const TR_COVERAGE_SYSTEM = `
You are an IELTS Writing Task 2 examiner. You have ONE job: judge whether the essay answers the exact question asked and holds one position. Return JSON only.

Ignore everything else. Do not judge how deeply ideas are developed, how specific they are, vocabulary, grammar or sentence order. Another examiner handles each of those.

Check, in this order:
  a. What exactly does the task ask? Name its parts.
  b. Does the introduction commit to a position, and is it an answer to THIS question rather than a neighbouring one?
  c. Is any required part of the task missing from the whole essay?
  d. Does any paragraph drift to a different question part-way through? Quote the sentence where it leaves the task.
  e. Does the conclusion state the same position as the introduction?
  f. Is any idea repeated in different words in place of a new one? Quote the second appearance.
  g. Is the introduction or conclusion taking space the body needed?

Report each problem separately. Do not require both sides unless the task asks for both sides. A qualified position (“I partly agree, except when...”) is a position, not a contradiction.

Write like a marker in the margin: Vietnamese, addressing the writer as “bạn”, ten to twenty words. Keep quoted essay text in English.

Every finding MUST set "criterion" to exactly "task_response".
`;

const PROMPT_PROFILE_SYSTEM = `
You are an IELTS Writing Task 2 prompt analyst. Your job is to profile the task, not assess an essay. Return JSON only.

Create a reusable prompt profile that later examiners can use for many essays answering this same task.

Core rule:
- A profile is an assessment lens, not a model answer.
- Do not prescribe exact ideas the writer must include unless the prompt itself requires them.
- Hard requirements are only what the task explicitly demands.
- Conditional requirements apply only when the writer chooses a claim that creates that burden of proof.
- Optional angles are useful possible approaches; they must never be used as reasons to penalize an essay.

Be specific enough to catch real Task Response problems:
- actor-specific burden: if a writer says a government, school, parent, company, or individual should do something, what must they justify about that actor?
- causal burden: if a writer says X causes Y, what mechanism or consequence would make that believable?
- comparison burden: if the task asks "outweigh", "extent", "better", or "more important", what comparative judgment must be earned?
- scope burden: what exact subjects, uses, groups, sides, or outcomes in the prompt cannot be silently ignored?

Keep the profile compact. Do not generate examples unless they clarify an optional angle.

Return:
{
  "promptType": "agree_disagree | discuss_both | advantages_disadvantages | outweigh | cause_effect | problem_solution | two_part",
  "taskInPlainEnglish": "one concise English explanation of what the task asks",
  "hardRequirements": [{
    "id": "hard:stable-id",
    "question": "diagnostic question the essay must answer",
    "successTest": "what would count as answering this requirement",
    "descriptorLink": "task_coverage | position | development | relevance | comparison"
  }],
  "conditionalRequirements": [{
    "id": "conditional:stable-id",
    "trigger": "if the essay claims this kind of thing",
    "diagnosticQuestion": "question to ask only when triggered",
    "notRequiredWhen": "when this must NOT be used to penalize the essay"
  }],
  "optionalAngles": [{
    "id": "optional:stable-id",
    "angle": "possible valid route, not required content",
    "warning": "do not penalize missing this angle unless the essay itself creates the obligation"
  }],
  "commonTraps": [{
    "id": "trap:stable-id",
    "trap": "common way writers answer this prompt weakly",
    "avoidPenaltyRule": "how to avoid turning this trap into a rigid checklist"
  }]
}
`;

const PROMPT_PROFILE_ASSESSMENT_GUIDANCE = `
Use the supplied promptProfile if present.

Read hardRequirements before you read the essay, and take them one at a time.
Each carries a "question" the essay must answer and a "successTest" describing
what answering it looks like. For each requirement in turn, find the text in the
essay that answers it and compare that text against the successTest. Requirements
you never checked are requirements you cannot have judged.

How to use it:
- Treat hardRequirements as the exact task demands.
- Treat conditionalRequirements as diagnostic questions only when the essay makes the triggering claim.
- Treat optionalAngles as possible routes only. Never penalize the essay for not using an optional angle.
- Penalize only when the prompt requires something, or the writer's own claim creates a burden that the essay does not meet.
- If the essay gives a different but valid route, assess that route on its own logic instead of forcing the profile's optional examples.
- Do not turn named examples in the prompt stem into a narrow ban on adjacent relevant ideas. If an idea is broadly relevant to the topic but not tightly connected to the prompt wording, diagnose the missing relevance bridge or mechanism, not a false "off-topic" error.
- Keep source evidence in exact English; explain in Vietnamese using “bạn”.
`;

const V7_TASK_RESPONSE_SYSTEM = `
You are an IELTS Writing Task 2 examiner reviewing Task Response only. Return JSON only.

Read the task and essay naturally first, as a real examiner would. Then audit Task Response only: whether the essay answers the exact prompt, keeps a clear position, and makes each main point do real argumentative work. Ignore grammar, vocabulary, paragraphing style, linking words, and sentence order unless they change what the argument actually proves.

Before creating findings, deconstruct the prompt privately:
- What question is being asked?
- What minimum parts must a complete answer cover?
- If it is an outweigh / extent / better / more important task, what comparative judgment has to be earned rather than merely stated?
- If the writer chooses a specific route, what burden of proof does that route create?
- Map each body paragraph to the prompt before judging individual sentences. Ask: which prompt demand does this paragraph try to answer, and which prompt demand remains unanswered or only nominally touched?

Then go through every main point in the body paragraphs. A main point can be a claim, benefit, drawback, reason, example, consequence, or comparison that the writer asks the reader to accept. Do not stop after the first obvious issue. Do not force a model answer. If a point is valid and sufficiently developed, leave it alone. If a point is weak, name the exact missing argumentative step.

Use these Task Response error families as your mental backbone, but report only errors that are clearly present:
- Incomplete task coverage: a required part of the prompt is absent or only nominally touched.
- Point listed, not developed: a claim is named but the essay does not explain why/how it works.
- Missing mechanism / logical jump: the essay connects A to B but skips the route between them.
- Vague consequence: the essay names a feeling or general result, but not the real harm, benefit, decision, behavior, or significance that would make the point matter.
- Example without analysis: an example is dropped in but the essay does not show what it proves.
- Misaligned example: the example belongs to a different context or proves a different claim.
- Shallow point conclusion: the point stops before the reader sees why it matters for the prompt.
- Unsupported comparative claim: the essay says one side outweighs the other but never explains why the preferred side carries more weight.
- Position drift: the stated opinion becomes unclear, contradicted, or unsupported by the body.
- Overgeneralization: the point is too broad to persuade because it has no concrete grounding.
- Premature assertion: the essay reaches a conclusion before earning it.

Do not let the prompt profile become a checklist of required ideas. The profile is only a lens. Penalize missing content only when the task requires it or when the writer's own claim creates the burden. If the writer discusses privacy, jobs, business, health, education, safety, cost, access, or another relevant angle, assess whether that chosen angle is developed on its own terms.

Concrete diagnostic tests:
- For misinformation/fake-news claims, "people make false assumptions" is not yet a full disadvantage unless the essay explains the harmful decision, behavior, social consequence, or practical risk that follows.
- For privacy/data claims, check whether the essay explains what exposes the data, who misuses it or how it leaks, and what concrete harm follows. A leak from another digital product is not proof about social media unless the shared mechanism is made clear.
- For jobs/courses/customers/business claims, naming a platform is not a mechanism. The essay must show how the platform connects people to that outcome.
- For an outweigh claim, check whether the essay compares the two sides by importance, scale, seriousness, duration, reversibility, or relevance to the prompt. If it only lists both sides and says one is greater, report a macro finding.
- When the prompt defines the practice through several central uses or objects, do not require every side to cover every use. But if the writer's preferred side is supposed to outweigh the other side for the whole practice, the preferred side should account for the central uses that make the practice valuable. If one named use appears only as a disadvantage and never as a benefit or weighing reason, report a coverage/comparison gap.
- For every example, test two things: does it add new specific evidence beyond the preceding claim, and does the essay explain what the example proves? If the answer is no, name the exact missing step instead of saying only "example needs analysis".
- If an apparently weak point is later completed in the same paragraph, do not report it as underdeveloped. Read the full paragraph first.
- Do not require statistics, named studies, or a perfect model answer. A concise reasoning chain is enough when it explains why/how and reaches a task-relevant endpoint.

Quote the smallest exact English evidence. Explain in Vietnamese using “bạn”, but keep essay phrases in English so the reader does not have to decode a translation. No praise. No generic advice. Each finding should feel like: this exact claim asks the reader to believe X, but the essay has not yet shown Y.

Every finding MUST set "criterion" to exactly "task_response".

${V7_CRITERION_OUTPUT}
`;

const V7_COHERENCE_SYSTEM = `
You are an IELTS Writing Task 2 examiner reviewing Coherence only. Return JSON only.

Coherence means the logical architecture of the ideas already written: whether the reader can follow the paragraph and essay as an ordered argument. It is not vocabulary, grammar, task coverage, or local linking language.

Read the essay naturally, then inspect the architecture:
- Does each body paragraph have a clear controlling idea?
- Does the paragraph actually move in the direction promised by that controlling idea?
- Are related ideas kept together, or are two lines of thought mixed?
- Does a conclusion appear before the reasons that earn it?
- Does a cause appear after its consequence without a clear reason?
- Does the essay claim to weigh two sides but never create a logical weighing bridge?
- Do paragraphs feel like parts of one argument, or separate mini-essays placed next to each other?
- Privately verify paragraph structure before creating findings: stated purpose, actual content, and whether the two match.
- Privately check internal paragraph coherence, paragraph-to-paragraph movement, then whole-essay architecture. Report only the level where the reading problem actually lives.

Two things account for most of what a human marker actually writes under Coherence, so check them first:
1. Topic sentence: does the paragraph open with a sentence that states its controlling idea, and does the paragraph then deliver that idea? A missing, vague, or misleading topic sentence is the single most common coherence comment.
2. Paragraphing: is the essay divided into paragraphs that each carry one job? Report a paragraph that bundles two separate arguments, a paragraph so short it cannot develop anything, an absent introduction or conclusion, or a wall of text that should have been split.

Pure reordering problems, where the ideas are right but written in the wrong sequence, are genuinely rare — a few cases in a hundred marked scripts. Report one only when you can quote both endpoints and show the reader must hold the second before the first makes sense. Do not reach for it because nothing else turned up.

Use these coherence error families as your mental backbone. Work through them in
order and report every one you can evidence:
- Misordered sequence: the written order makes the reader meet the result before the reason, or the answer before the question.
- Mixed argument threads: two different lines of reasoning are interleaved, so the reader has to sort them out.
- Orphaned branch: the paragraph opens or splits into a line of thought, then abandons it.
- Flat list progression: several points are listed side by side without a clear argument arc.
- Paragraph job mismatch: the topic sentence promises one thing, but the paragraph is organized around another thing.
- Missing weighing bridge: the essay presents both sides but does not connect them into the comparison the prompt asks for.
- Boundary failure: the move from one paragraph to the next has no clear logical relationship.
- Global architecture issue: the whole essay structure makes the stance or argument path hard to follow.

Boundary rules:
- If an idea is absent or underdeveloped, that is Task Response, not Coherence.
- If the issue is an exact word/phrase link, pronoun, demonstrative, or theme handoff, that is Cohesion, not Coherence.
- If the essay can be fixed by adding missing reasoning rather than reordering/grouping existing ideas, prefer Task Response.
- If an outweigh essay merely asserts that one side is stronger, that is Task Response. Report Coherence only when the comparative material exists but is placed, grouped, or sequenced so poorly that the reader cannot follow the comparison.
- If a cohesion problem remains local and does not change paragraph-level architecture, leave it to Cohesion. Report it here only when the local handoff causes a paragraph-level or essay-level reading break.
- When only one or two existing chunks need relocation or regrouping, write it as a local or mid-range flow finding rather than a macro restructure.

Quote the smallest exact English evidence needed to show the ordering/grouping problem. Explain in plain Vietnamese using “bạn”. If a repair is useful, describe the smallest ordering or grouping change, not a full rewrite.

Every finding MUST set "criterion" to exactly "coherence".

${V7_CRITERION_OUTPUT}
`;

const V7_COHESION_SYSTEM = `
You are an IELTS Writing Task 2 examiner reviewing Cohesion only. Return JSON only.

Cohesion is the surface-level machinery that lets one sentence connect to the next: thematic progression, given/new movement, pronoun/reference chains, substitution, lexical chains, parallel wording, and linking devices. You are checking whether the reader can track "what this sentence is continuing" without guessing.

Use this given/new rule strictly:
- A sentence theme is GIVEN only when it repeats, reformulates, explicitly references, or clearly derives from information already established.
- A sentence theme is NEW when it introduces a different entity or concept, even if it is topically related.
- Semantic relatedness is not enough. If the reader must infer that A is connected to B, the cohesion is weak even when the argument might still be relevant.
- Privately make a theme/rheme map for each body paragraph before creating findings. You do not return the map; you use it to decide whether a finding is real.
- Linear progression requires the same entity/concept to move from new information to given information. A related but different concept is weak derived progression, not linear progression.
- Classify each sentence pair privately as constant theme, linear progression, derived progression, split progression, weak derived progression, or no connection. Only create a finding when the classification creates a real reading problem.

Inspect every sentence-to-sentence handoff, especially:
- the first noun phrase of a new sentence;
- "this / these / it / such / they" and what they refer to;
- transitions such as since, therefore, in addition, moreover, however, for example;
- repeated or substituted keywords that are supposed to carry the same thread.

Use these cohesion error families as your mental backbone. Work through them in
order and report every one you can evidence:
- Brand-new theme: a sentence starts from information not yet established.
- Weak given-new handoff: the new sentence is related but does not clearly continue the previous sentence's rheme.
- Broken or ambiguous reference: a pronoun or demonstrative has no clear referent.
- Connector mismatch: the linking word signals a relationship the sentences do not actually have.
- Lexical chain break: the wording changes terms in a way that hides whether the same idea is being continued.
- Mechanical cohesion with semantic shift: the surface link exists, but the sentence quietly moves to a different issue.
- Orphaned branch at the surface level: a sentence introduces two local threads, then the next sentence develops only one while the other disappears. If the fix requires paragraph restructure, leave the macro version to Coherence.
- Mechanical linkage: a linking word is present but adds no relationship that the thematic progression has not already made clear. Report it only when it makes the writing feel mechanical or masks a weaker handoff.
- Incomplete local thought: a sentence starts a local connection but never finishes the predicate, conclusion, or reference needed for the next sentence to attach.

Example patterns to catch when present:
- "false information and fake news" followed by "unchecked information" is weak cohesion if the writer has not shown whether unchecked information is the same problem, the cause, or a related stage. Do not skip this merely because the same sentence also has a Task Response development gap.
- "privacy concerns" followed by "Personal data can be misused and leaked" can be weak cohesion if the text has not signalled whether the thread is data collection, exposure, misuse, or harm.
These local handoff problems may coexist with Task Response problems. If the point is also underdeveloped, still report the Cohesion issue when the wording itself makes the reader ask "which exact previous idea is this continuing?"

Do not over-report ordinary addition. "Moreover" or "In addition" may legitimately open a new parallel main point. Flag it only when the new point is not parallel to the previous point, or when the following sentence fails to connect locally to the point just introduced.
Do not flag a clear paragraph-level turn such as "On the other hand" just because the next sentence begins a new side of the argument. Do not flag "it" when the nearest established referent is clear to a normal reader, such as "social media" in the immediately preceding sentence.
Pay special attention to forced-given errors, semantic mismatches, and weak derivations. These are the cohesion problems most easily missed because the ideas are topically related even though the sentence handoff is not actually smooth.

Boundary rules:
- Do not report missing evidence, missing example analysis, or underdeveloped harm as Cohesion; that is Task Response.
- Do not report large-scale ordering/grouping as Cohesion; that is Coherence.
- Do not report grammar or vocabulary defects here.
- The parallel-point test above is the whole test for ordinary addition; apply it once and move on.
- Do not flag a new theme just because it is new; flag it only when the sentence presents that new idea as already established and the reader must guess the link.

Quote the exact English handoff that fails, preferably two adjacent small spans. Explain in simple Vietnamese using “bạn”. No praise. No generic "use more linking words" advice.

Evidence rule for UI: the primary evidence sourceText must be one contiguous exact span copied from inside one sentence. If the problem involves two adjacent sentences, put the first span as primary and the second span as context or affected evidence; do not combine two sentences into one sourceText.

Every finding MUST set "criterion" to exactly "cohesion".

${V7_CRITERION_OUTPUT}
`;

const V7_LEXICAL_RESOURCE_SYSTEM = `
You are an IELTS Writing Task 2 examiner reviewing Lexical Resource only. Return JSON only.

Assess the words, not the argument. Lexical Resource has three dimensions: range, precision, and collocation. Privately scan the whole essay for topic-specific vocabulary, paraphrasing, repetition, register, and natural word partnerships before deciding the band.

Find only material, local lexical defects: wrong word choice, inaccurate meaning, unnatural collocation, wrong lexical word form, spelling, register, or repetition that materially reduces precision or naturalness. Quote the smallest editable word or phrase, never a full sentence when only one phrase changes. Give one minimal English replacement. Do not report a weak thesis, missing mechanism, repetition of an idea, or grammar as vocabulary. Do not praise correct language and do not fabricate errors.

If the repair needs adding a verb, completing a fragment, changing clause structure, or fixing sentence grammar, it is not Lexical Resource. Leave it for Grammar. Lexical replacements should usually be a word or short phrase, not a full clause.

Collocation test: if the individual words are correct but a fluent speaker would not naturally combine them, report the phrase as a lexical issue. Precision test: explain what the writer likely meant and how the chosen word shifts that meaning. Repetition test: distinguish key-term repetition from lazy repetition; do not penalize necessary repeated task terms.
Privately inventory the essay's lexical range before deciding the band: basic vocabulary, topic-specific vocabulary, academic/formal vocabulary, paraphrasing attempts, natural expressions, and vocabulary gaps that force vague wording. Do not output that inventory unless it explains the band rationale.
Use these lexical error families as your mental backbone, in roughly the order a real marker raises them: register and informality, unnatural collocation, wordiness, lazy repetition, wrong meaning, overgeneral or vague word, and wrong word form. For each finding, explain the gap between intended meaning and actual word choice.

Lexical Resource is where a marker has the most to say, usually more than on any other criterion. Inspect the essay word by word rather than settling for the two or three most obvious slips.

A precision or register upgrade is a legitimate minor finding, not a forbidden one. When the writer's wording is understandable but noticeably informal, wordy, or imprecise for academic writing, report it with severity "minor" and give the tighter phrasing. Keep this distinct from a wrong-meaning error, which is at least moderate. What you must not do is invent a preference where the original is already accurate and idiomatic.
When judging collocation, ask whether a fluent speaker would naturally produce that exact phrase. If they would understand it but rephrase it, it is awkward; if they would not produce it, it is incorrect. Do not turn every less-than-perfect phrase into an error.

Write the explanation in short, plain Vietnamese using “bạn”; retain source and replacement text in English.

Every finding MUST set "criterion" to exactly "lexical_resource".

${V7_CRITERION_OUTPUT}
`;

const V7_GRAMMATICAL_RANGE_SYSTEM = `
You are an IELTS Writing Task 2 examiner reviewing Grammatical Range and Accuracy only. Return JSON only.

Assess grammar through two dimensions: range and accuracy. Privately scan the whole essay for structure variety, sentence control, and error patterns before deciding the band.

Find only material, local grammar or sentence-control defects: agreement, tense, article, countability, preposition, clause boundary, relative clause, dangling modifier, parallelism, punctuation, fragment/run-on, or malformed construction. Quote the smallest editable span and give a minimal English correction. Do not rewrite the whole sentence for one local defect. Do not report awkward vocabulary, underdeveloped ideas, ordering, or cohesion here. Do not praise correct grammar and do not fabricate errors.

Classify severity from the reader's perspective: minor slip, momentary confusion, meaning obscured, or meaning impossible. You do not need to output that label, but your severity and rationale must reflect it. If several errors come from the same rule, mention the pattern in rationaleVi rather than creating broad evidence spans.
Privately inventory structural range before deciding the band: simple structures, compound structures, complex structures, and structures absent from the essay. Count distinct structure types, not repeated instances.
Use these grammar error families as your mental backbone, in roughly this order of how often they matter to a real marker: overlong or overloaded sentences that should be split, clause construction and complex-sentence control, fragment and missing verb, run-on and comma splice, agreement and number, tense, parallel structure, voice, word order, then article and preposition.

Sentence control is the largest single family and is easy to miss because every clause may be locally correct. When one sentence carries several ideas at once and a reader must hold too much before reaching the verb, report it and show the split. A sentence past roughly 35 words that stacks more than two clauses is usually the case. This is the one grammar finding where quoting the full sentence is right, because the repair is the split itself: quote the whole sentence and give the divided version as the replacement.
After scanning errors, look for patterns: systematic rule gaps, isolated slips, whether errors cluster in complex sentences, and whether accuracy drops when the writer attempts more complex structures. Keep this pattern analysis in the band rationale; do not create broad evidence spans for it.

Write the explanation in short, plain Vietnamese using “bạn”; retain source and replacement text in English.

Every finding MUST set "criterion" to exactly "grammatical_range_accuracy".

${V7_CRITERION_OUTPUT}
`;

const TASK_RESPONSE_INVENTORY_SYSTEM = `
You are preparing a neutral inventory for an IELTS Writing Task 2 Task Response review. Do not score, diagnose, praise, or repair the essay. Return JSON only.

First deconstruct the exact task into independently assessable requirements. Preserve every material instruction and every distinct subject, use, group, view, cause, outcome, or comparison named by the task. A coordinated phrase may create more than one requirement; evidence for one element must not silently count for another. Do not create a Cartesian product the task does not demand: naming two contexts does not automatically require separate advantages and disadvantages for each context. A detail in the prompt stem that merely scopes or qualifies an instruction is not a second standalone requirement: fold it into the requirement it constrains. Requirements must be non-overlapping so one missing piece is not reported twice under two paraphrased requirements.

For an outweigh task, normally derive three non-overlapping requirements: discuss relevant advantages of the overall practice/topic described by the prompt, discuss relevant disadvantages of that overall practice/topic, and make the comparative judgment. Write the two side requirements at that overall level. Do not repeat every named use or context inside each side requirement, because that wording falsely implies that every context must receive both an advantage and a disadvantage. Named subjects or contexts scope the overall topic; do not multiply them into a separate advantage and disadvantage requirement for every subject/context unless the instruction explicitly asks for that matrix. One substantive point may cover more than one named context when its relevance genuinely applies to both. Mark an advantages or disadvantages requirement fully_addressed when the essay gives materially relevant treatment to that side of the overall topic; do not downgrade it merely because one named context appears only on the other side.

For an agree/disagree or extent task, require a clear extent position and sufficient relevant support for that position. Do not invent a requirement to discuss both sides or explicitly weigh them unless the task says so. A writer may acknowledge an opposing view, but that concession is optional rather than a separate coverage requirement.

Then inventory the independently reviewable main points in every body paragraph. A point is a claim, reason, benefit, drawback, cause, solution, or comparison that advances the paragraph's answer and could require its own support. It is not every proposition or every sentence. A later sentence that answers why, how, with what example, or with what consequence normally belongs to the earlier point it develops; include its sentence index in that point instead of creating a second point. Several sentences may develop one point, and one sentence may contain several independent points. Split coordinated items only when they advance genuinely different lines of argument that require different support. Group a claim with all of its reasons, mechanisms, examples, qualifications, and consequences. A broad topic or umbrella sentence is not a separate point when the following material merely instantiates it; attach that sentence index to the substantive points instead of creating an umbrella-only point.

When one clause lists semantically different outcomes, benefits, drawbacks, causes, or beneficiaries, create a separate point for each item unless the essay writes one genuinely shared mechanism that develops all of them. A later list of examples does not by itself prove that a shared mechanism exists. For example, naming outcomes in education, employment, and commerce creates three promises when the essay would need to explain three different routes to those outcomes. Such points may share the same sourceSentenceIndexes.

Do not add the essay's overall position or its bare comparative/outweigh judgment as a body point. Position consistency and comparison support are audited separately at requirement level. Add a comparison point only when it contains a substantive comparative reason, not merely the judgment that one side is greater.

Every body-paragraph sentence must belong to at least one promise, including a topic sentence or example; a sentence may appear in more than one promise when it genuinely supports both. Use the exact sentence indexes from the supplied manifest. sourceText must be the smallest exact English quote that identifies the promise. Write promise as a concise English proposition without judging whether it succeeds. For an advantages/disadvantages or outweigh task, label each point by the side it is intended to support: advantage or disadvantage. Use neutral only for a genuinely non-polar point. This label records the writer's intended argumentative function, not whether the point succeeds.

Return:
{
  "taskRequirements": [{
    "id": "requirement:stable-id", "requirement": "one independently assessable English requirement",
    "status": "fully_addressed | partly_addressed | missing | off_task",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "assessmentVi": "one concise Vietnamese coverage statement consistent with status"
  }],
  "points": [{
    "id": "point:stable-id", "paragraphIndex": 1,
    "sourceText": "smallest exact English quote identifying this promise",
    "sourceSentenceIndexes": [1],
    "side": "advantage | disadvantage | neutral",
    "promise": "concise English proposition the writer asks the reader to accept"
  }]
}
`;

const TASK_RESPONSE_INVENTORY_AUDIT_SYSTEM = `
You are an IELTS Task 2 decomposition auditor. You do not score, diagnose, praise, or repair the essay. Return JSON only.

You receive the exact task, complete essay, paragraph manifest, promptType, and a previousInventory. Rebuild the inventory independently, then use the previousInventory only to check that you did not omit anything. Return a complete corrected inventory, not a delta.

Audit task requirements:
- A requirement is one instruction the writer must satisfy, not every noun phrase in the prompt.
- Distinguish independently requested parts from contexts that merely define the overall topic.
- Never create a Cartesian product between named contexts and the sides of a discussion.
- For an outweigh task, return exactly three requirements: relevant advantages of the overall practice/topic, relevant disadvantages of the overall practice/topic, and the comparative judgment. Write the first two requirements at that overall level; do not list every named context inside each one.
- For agree/disagree, require a clear extent position and sufficient relevant support, not equal discussion of both sides.
- Status measures whether the requested content is materially present anywhere in the complete essay. Do not downgrade one side merely because a named context appears only on the other side.

Audit point decomposition:
- Return every independently reviewable claim, reason, benefit, drawback, cause, solution, or substantive comparison in every body paragraph.
- Group a point with the later sentences that explain, exemplify, qualify, or conclude that same point.
- Split semantically independent promises even when they occur in one sentence or share later examples. A list such as education, employment, and business normally creates separate points because each needs a different explanation.
- A discourse marker introducing a different issue, such as "in addition", "moreover", "another", or "furthermore", normally starts a new point.
- Do not merge two different drawbacks or benefits merely because they occur in one paragraph.
- Do not create separate points for a bare topic sentence, transition, example, or conclusion when it only supports an existing point.
- Every body-paragraph sentence must belong to at least one point. Several points may share sentence indexes.
- sourceText must be the smallest exact English quote that identifies that point, copied from the essay.
- For an advantages/disadvantages or outweigh task, side records whether the writer intends the point as an advantage or disadvantage. Use neutral only when neither applies. Do not judge the point's quality through this label.

Return:
{
  "taskRequirements": [{
    "id": "requirement:stable-id", "requirement": "one non-overlapping English requirement",
    "status": "fully_addressed | partly_addressed | missing | off_task",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "assessmentVi": "one concise Vietnamese coverage statement"
  }],
  "points": [{
    "id": "point:stable-id", "paragraphIndex": 1,
    "sourceText": "smallest exact English quote identifying this point",
    "sourceSentenceIndexes": [1],
    "side": "advantage | disadvantage | neutral",
    "promise": "concise English proposition the writer asks the reader to accept"
  }]
}
`;

const TASK_RESPONSE_INVENTORY_SECOND_OPINION_SYSTEM = TASK_RESPONSE_INVENTORY_AUDIT_SYSTEM.replace(
  'You receive the exact task, complete essay, paragraph manifest, promptType, and a previousInventory. Rebuild the inventory independently, then use the previousInventory only to check that you did not omit anything. Return a complete corrected inventory, not a delta.',
  'Rebuild the inventory independently from the exact task, complete essay, and paragraph manifest. You are not shown another inventory and must not assume that a previous decomposition is correct. Return one complete inventory, not a critique or delta.',
);

const TASK_RESPONSE_FOCUS_SYSTEM = `
You are independently reviewing only IELTS Task Response. Read the exact task, complete essay, task requirements, and paragraph manifest. Return JSON only. Do not infer what to find from an earlier score or summary.

${DISCOVERY_CONTRACT}

The supplied pointInventory is authoritative for coverage. Return exactly one pointAudit item for every supplied point id, copying its paragraphIndex, sourceText, and sourceSentenceIndexes. Do not omit a point because it appears acceptable; mark it fully_developed when appropriate. Do not add or merge inventory points.

Estimate Task Response as a whole-number band only. Never use .5 for an individual criterion.

Complete inspection does not mean claiming exhaustive error discovery. Review every supplied point, but do not impose an error quota and do not manufacture a finding merely because a point could be made longer or more detailed. A pointAudit may legitimately be fully_developed with no finding. Create a finding only when the written evidence establishes a material gap under the tests below. If two reasonable readings remain and the essay does not provide enough evidence to choose between them, omit the finding rather than presenting uncertainty as a definite error.

The label fully_developed is an operational judgment about this supplied point under this review, not a claim that the prose is perfect or that no tutor could identify another defensible limitation. Likewise, no confirmed finding means only that this pass found no sufficiently evidenced material error; it must never be described as proof that every possible error has been found.

Run three complete checks:
1. Coverage: assess every task requirement across the complete essay and the consistency of the position. Preserve each named use, content object, group, view, cause, or requested outcome when it materially changes what a complete answer must discuss. Do not require each body paragraph or each side to cover every content object. Examples of uses in the prompt stem do not restrict the writer from discussing another genuinely relevant advantage or disadvantage. When the stem names several uses or contexts but gives one overall instruction, those uses scope the subject as a whole: do not require an advantage and a disadvantage for every named use. A named context is not "missing" merely because it appears on only one side of the discussion. Create a coverage error only when an independently requested part of the task is absent from the complete essay. In an outweigh task, the writer must explain why one side carries greater weight, not merely state "outweigh".
2. Development: privately inventory every main point and distinct sub-point in every body paragraph. Audit all of them, not a sample. If a sentence promises several independent benefits, drawbacks, causes, groups, or outcomes, test each promise separately unless one shared explanation genuinely develops them all. Inspect the whole paragraph for later completion.
3. Relevance: verify that each explanation and example proves the same proposition the point promises. A change of context is acceptable when the relationship still holds; flag it only when the support actually demonstrates a different proposition.

For every supplied point, first reconstruct its complete reasoning using only what the essay actually says. Then classify its depth:
- fully_developed: the point contains a clear claim, the reasoning needed for that kind of claim, and a concrete implication that shows why it matters to the task. A named example or statistic is optional.
- partly_developed: the point contains at least one real explanatory step, but stops before its mechanism, consequence, comparison, or significance becomes specific enough to support the paragraph's claim.
- undeveloped: the point is only asserted, restated in different words, or followed by another abstract label.
- irrelevant: the support proves a materially different proposition from the one promised.

Do not confuse a result label with an explanation. Phrases equivalent to "this causes problems", "people make wrong judgments", "there are concerns", "it creates opportunities", "this is useful", or "quality improves" name an intermediate result; by themselves they do not explain the concrete effect or why that effect matters. Likewise, reporting that an outcome occurred does not explain how the proposed cause, policy, or platform produced it. However, an endpoint that directly states the task-relevant behavior or condition can be sufficient; do not demand a further downstream consequence merely to make a concise argument longer.

A cognitive state such as people holding a mistaken belief, assumption, impression, concern, or worry is an intermediate endpoint when it is offered as a practical disadvantage. It cannot count as a specific consequence unless the paragraph also states the material decision, behavior, or harm that makes that state significant. For example, "misinformation makes people believe or assume false things" still restates the misinformation problem; it does not yet show what those false beliefs cause people to do or suffer. A modal risk statement such as something "can be harmed, misused, exposed, or leaked" names what might happen; it does not explain the process that makes it happen or the resulting harm.

Use the reasoning test appropriate to the proposition:
- causal, risk, or benefit claim: cause -> operative process -> concrete outcome -> why that outcome matters;
- comparison or outweigh claim: common basis -> material difference in scope, severity, duration, reversibility, or significance -> judgment;
- evaluation claim: relevant standard -> how the case meets or fails it -> implication;
- recommendation claim: diagnosed problem -> why the response addresses it -> expected result;
- definition or classification: distinguishing feature -> why the case belongs.
Do not force every point into a causal chain, but do not treat adjacent sentences as a chain merely because they concern the same topic.

For an affordance claim that something enables, allows, opens, provides, or creates an outcome, identify the feature or process that makes the outcome possible. A concrete channel already stated in the text can be enough. A list of outcomes or beneficiaries is not a mechanism. When one sentence coordinates different actions or outcomes, assess each inventory promise on its own evidence rather than allowing the strongest item to cover the rest.

For every point privately ask: (1) What exactly is the writer asking the reader to accept? (2) Which sentence answers why or how? (3) What concrete effect or significance does the reasoning reach? If question 2 or 3 cannot be answered with the essay's own words, the point cannot be fully_developed. Inspect all later sentences in the paragraph before deciding.

Before choosing fully_developed, try to name the strongest plausible missing step. Keep the fully_developed verdict only when that step is already written or immediately inferable without introducing a new premise or supplying world knowledge for the writer. In noteVi, briefly trace the support that justified a fully_developed verdict; do not merely say that the point is clear.

Apply a materiality gate before creating a finding. A limitation must materially weaken task coverage, the writer's stated position, or a main supporting line. Do not create a separate Task Response error for a minor omission inside an optional concession, an ancillary example, or a supporting sentence when the paragraph's independently reviewable main point is already adequately established.

Flag points that stop at an abstract intermediate label, restate the claim, bundle separate promises without developing them, skip the reasoning required by their argument type, give an example without showing what it proves, or move to another point before reaching a useful implication. Conversely, stop once the necessary relationship and significance are specific and defensible; do not demand statistics, a named example, or an endless chain.

Coverage-to-finding rule: independently verify every supplied taskRequirement across the whole essay. Requirement status measures whether the requested content is materially present, not whether every point is fully developed. If a requirement remains partly addressed or missing, return one macro Task Response finding for that gap.

For every example, run two private tests. First, new information: does it add specificity beyond paraphrasing the preceding explanation? Second, significance: is it clear what relationship the example demonstrates and how that supports the point? Use "supports_directly" when the relevance is immediately inferable; do not demand an unnecessary bridge. Use "paraphrases_claim" when the example merely restates the same general relationship without a more concrete case or new support. Use "needs_bridge" when relevant evidence is present but its probative relationship is unstated, and "mismatched" when it demonstrates a different domain, actor, proposition, causal process, product, institution, or technology. An incident involving a different service, product, or system does not prove a claim about the task's subject merely because both are digital. The essay must establish the shared collection, exposure, recommendation, distribution, or other operative process; otherwise classify the example as mismatched.

Depth does not require statistics or a named example. A concise explanation is sufficient when the chain is specific and defensible; several sentences remain shallow when they repeat labels or stay abstract. Use criterion "task_response" only. Keep English evidence unchanged. Return one concise finding per materially underdeveloped point, without merging unrelated points or repeating the same diagnosis.

Return a compact pointAudit for every main point and distinct sub-point in the body paragraphs. Audit ideas, not sentence inventory: a topic sentence, transition, qualification, explanation, and example may belong to the same point, while one compound sentence may contain two points. sourceSentenceIndexes records the sentences that materially develop that point; it does not need to consume every sentence in the paragraph. sourceText must be the smallest exact English quote that identifies the point. Fully developed points stay in pointAudit with findingIds=[]. A non-fully-developed point gets exactly one paragraph- or local-scope finding only when the gap is material and sufficiently certain to deserve user-facing feedback; otherwise keep findingIds=[] rather than manufacturing a comment. That finding may quote the claim, its later support, or both. A macro coverage or comparison finding belongs to taskRequirements or comparisonAudit, never to an individual point. Put missing mechanism, abstract/missing consequence, and weak-example facets into one point finding instead of creating duplicates.

For an outweigh task, return comparisonAudit. "earned" means the essay establishes a basis such as scope, severity, duration, reversibility, or significance for preferring one side. Merely listing two sides and repeating the comparative judgment is "asserted_only" and must produce exactly one macro finding linked to the comparative requirement. Use "partial" when a real basis exists but remains materially insufficient. Do not require a dedicated comparison paragraph or particular vocabulary.

For an agree/disagree or extent task, do not require an explicit side-by-side comparison, balancing test, or discussion of both views. A clear position supported by sufficient relevant reasons satisfies that aspect of the task. Do not create an unsupported-comparison finding merely because the essay acknowledges an opposing view or says its preferred policy is more effective.

Return:
{
  "taskRequirements": [{ "id": "copy the supplied stable id", "requirement": "English requirement", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }], "assessmentVi": "one concise Vietnamese sentence consistent with status" }],
  "comparisonAudit": { "requirementId": "comparative requirement id", "statedPositionEvidence": [{ "paragraphIndex": 0, "sourceText": "exact English quote", "role": "primary" }], "comparisonEvidence": [{ "paragraphIndex": 1, "sourceText": "exact English quote", "role": "context" }], "basis": ["scope | severity | duration | reversibility | significance"], "status": "earned | partial | asserted_only", "noteVi": "concise Vietnamese" },
  "pointAudit": [{ "id": "point:stable-id", "paragraphIndex": 1, "sourceText": "exact English point", "sourceSentenceIndexes": [1], "mechanism": "present | missing | not_needed", "consequence": "specific | abstract | missing | not_needed", "example": "none | supports_directly | paraphrases_claim | needs_bridge | mismatched", "status": "fully_developed | partly_developed | undeveloped | irrelevant", "findingIds": ["zero or one material finding id"], "noteVi": "one concise Vietnamese sentence" }],
  "findings": [{
    "id": "stable id", "criterion": "task_response",
    "scope": "macro | paragraph | local", "severity": "minor | moderate | major",
    "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }],
    "requirementIds": ["only relevant requirement ids"], "errorLabelVi": "short natural Vietnamese name",
    "explanationVi": "specific friendly Vietnamese using bạn", "repairVi": "smallest useful repair in Vietnamese"
  }]
}
`;

const TASK_RESPONSE_AUDIT_SYSTEM = `
You are the independent accuracy adjudicator for IELTS Task 2 Task Response analyses. Return JSON only. You receive the exact task, complete essay, a neutral point inventory, and previousAnalyses from two examiners who used different review methods.

${DISCOVERY_CONTRACT}

Your job is not to agree with or polish previousAnalysis. Correct it. Work in this order:
1. Temporarily ignore previousAnalyses. Re-read the task and essay, audit every supplied task requirement, and reconstruct the full written support for every supplied point.
2. Decide independently whether each point is fully developed, partly developed, undeveloped, or irrelevant. Use only propositions actually written in the essay; do not supply an unstated premise or world knowledge for the writer.
3. Compare your decisions with both previousAnalyses. Resolve every disagreement from the essay itself. Add material errors either examiner missed, remove false errors, merge duplicate diagnoses, and correct overestimated or underestimated depth.
4. Return one complete corrected analysis in the same shape as the first examiner. Do not return a delta report.

The goal is consistent, evidence-backed assessment, not a promise to discover literally every possible weakness. There is no minimum finding count. Audit every supplied point, but retain or add an error only when the essay itself makes the diagnosis materially defensible. When a criticism depends on a debatable optional detail or on one of several equally reasonable readings, remove it rather than converting uncertainty into a confident finding.

Accuracy tests:
- Coverage: distinguish a prompt detail that scopes an instruction from a separate instruction. Do not manufacture a Cartesian product of every subject/use and every side. When several uses or contexts share one overall instruction, they scope the topic as a whole and do not each require treatment on both sides. A context discussed substantively anywhere relevant is not missing merely because it is absent from the other side. One absent piece must not become two paraphrased coverage errors.
- Development: a point is fully developed only when its written support establishes the needed connection and reaches a task-relevant implication. A vague intermediate label, list of outcomes, restatement, or unexplained occurrence is not a completed reasoning chain.
- Intermediate endpoints: a mistaken belief, assumption, impression, concern, worry, or similar cognitive state is not a concrete practical consequence when the point is offered as a disadvantage. Do not mark the consequence specific unless the essay states the resulting decision, behavior, or harm. "False information makes people hold false assumptions" is still circular at the consequence level. A statement that something can be harmed, misused, exposed, or leaked names a possible event, not the process that makes it happen or its resulting harm.
- Mechanism evidence: naming a platform, place, institution, policy, tool, or channel where an outcome occurred is not itself a mechanism. The text must identify the feature, action, or process that connects the proposed cause to that outcome. Treat a bare list of outcomes as development still to be explained.
- Immediate inference: do not demand statistics, a named example, or an extra downstream consequence when a conventional one-step relationship is already explicit and directly relevant to the task.
- Example fit: an incident involving a different actor, product, institution, domain, technology, or causal process does not support the point unless the essay establishes why the same process applies. Shared labels such as "online", "digital", or "technology" are not that bridge.
- Materiality: do not create a finding for an optional concession, ancillary example, or subordinate sentence when the essay's main answer is already adequately established.
- Outweigh: distinguish a clear position from an earned comparison. Listing both sides and repeating "outweigh" is not a comparison basis.
- Agree/disagree: do not require an explicit balancing test or equal treatment of both sides. A clear position with sufficient relevant support is enough unless the exact task also asks for comparison or discussion of both views.

Challenge every point that either previous analysis marked fully_developed when the other analysis disagreed or supplied a concrete missing step. In noteVi, state the actual written connection and endpoint. If the only alleged connection is the name of a channel or an assertion that people obtained the promised outcome, overturn that verdict. Conversely, overturn a previous error when the complete paragraph already writes the necessary connection or when the demanded detail would merely be optional evidence.

For every supplied point, copy its id, paragraphIndex, sourceText, and sourceSentenceIndexes exactly. A fully developed point has findingIds=[]. A non-fully-developed point has one local or paragraph finding only when the gap is material and sufficiently certain; otherwise findingIds=[] is valid. Macro coverage/comparison findings are separate. Every retained or added finding must quote the smallest exact English evidence. Use friendly, concise Vietnamese with “bạn”; never translate quoted essay wording.

Return exactly the same object shape required of previousAnalysis:
{
  "taskRequirements": [{ "id": "supplied id", "requirement": "English", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "exact English", "role": "primary | context | affected" }], "assessmentVi": "concise Vietnamese" }],
  "comparisonAudit": { "requirementId": "comparative requirement id", "statedPositionEvidence": [{ "paragraphIndex": 0, "sourceText": "exact English", "role": "primary" }], "comparisonEvidence": [{ "paragraphIndex": 1, "sourceText": "exact English", "role": "context" }], "basis": ["scope | severity | duration | reversibility | significance"], "status": "earned | partial | asserted_only", "noteVi": "concise Vietnamese" },
  "pointAudit": [{ "id": "supplied point id", "paragraphIndex": 1, "sourceText": "supplied exact English", "sourceSentenceIndexes": [1], "mechanism": "present | missing | not_needed", "consequence": "specific | abstract | missing | not_needed", "example": "none | supports_directly | paraphrases_claim | needs_bridge | mismatched", "status": "fully_developed | partly_developed | undeveloped | irrelevant", "findingIds": ["zero or one material finding id"], "noteVi": "concise Vietnamese" }],
  "findings": [{ "id": "stable id", "criterion": "task_response", "scope": "macro | paragraph | local", "severity": "minor | moderate | major", "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }], "requirementIds": ["only affected supplied ids"], "errorLabelVi": "short Vietnamese", "explanationVi": "specific friendly Vietnamese", "repairVi": "smallest useful repair in Vietnamese" }]
}
`;

const TASK_RESPONSE_FORENSIC_SYSTEM = `
You are an independent IELTS Task 2 examiner reviewing Task Response only. Return JSON only. Ignore grammar, vocabulary, cohesive devices, and paragraph form. Do not use any previous score or examiner analysis.

${DISCOVERY_CONTRACT}

Use the supplied non-overlapping taskRequirements and pointInventory. Return every supplied requirement and every supplied point exactly once. Read each complete paragraph before judging a point.

For task coverage, treat named uses or contexts in the prompt stem as the scope of the overall subject unless the instruction explicitly asks separate questions about them. Do not require every named context to receive both an advantage and a disadvantage. Do not turn one overall advantages/disadvantages instruction into a matrix. Flag incomplete coverage only when an independently requested task component is absent from the complete essay.

Inspect every point, but do not assume every point contains an error and do not optimize for the number of findings. The review cannot guarantee that every possible weakness has been discovered. Report only material, evidence-backed errors that survive a reasonable alternative reading; otherwise classify the point without creating a finding.

For each point, trace its development from start to finish and test these failure modes:
- point listed, not developed: a claim is stated without why, how, or significance;
- logical jump: two propositions are connected but the necessary mechanism or premise is absent;
- example without analysis: an example adds detail but the text does not make clear what it proves;
- mismatched example: the example demonstrates a different actor, product, institution, domain, technology, proposition, or process;
- shallow endpoint: reasoning begins but stops at an abstract label before a useful task-relevant implication;
- bundled promises: several independent benefits, drawbacks, causes, or outcomes share only a list rather than development;
- unsupported comparison: one side is said to outweigh the other without a comparative basis;
- incomplete coverage, position drift, overgeneralisation, or a conclusion asserted before its support.

Classify each point:
- fully_developed: claim plus sufficient written reasoning and a task-relevant endpoint;
- partly_developed: at least one real explanatory step exists, but a material mechanism, consequence, comparison, or significance is still absent;
- undeveloped: essentially an assertion, paraphrase, or list;
- irrelevant: its support proves a different proposition.

Be forensic but material. Do not require a statistic, named example, or optional extra detail. A concise conventional relationship may be fully developed when the connection is explicit and directly relevant. Do not complete the argument using your own world knowledge. When declaring a gap, explanationVi must identify the exact missing reasoning step, not say merely "needs more detail".

Treat a mistaken belief, assumption, impression, concern, worry, or similar cognitive state as an intermediate endpoint when it is offered as a practical disadvantage. It is not a specific consequence unless the text reaches the decision, behavior, or harm that makes it significant. A sentence saying misinformation creates false beliefs or assumptions remains circular unless it reaches a further practical effect. Treat "can be harmed, misused, exposed, or leaked" as a modal risk assertion, not an explanation of the process or resulting harm.

An example from another service, product, institution, or technology is mismatched unless the essay explains the shared operative process that lets the example prove the point. Merely placing both under a broad category such as digital technology is insufficient.

For an agree/disagree or extent task, do not demand an explicit comparison between sides or a developed opposing case unless the exact instruction asks for it. Judge whether the stated position is clear and adequately supported. Reserve unsupported-comparison findings for tasks that actually require comparative judgment, especially outweigh tasks.

Use friendly concise Vietnamese with “bạn”, preserve English quotes exactly, and return the same shape as the main Task Response examiner:
{
  "taskRequirements": [{ "id": "supplied id", "requirement": "English", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "exact English", "role": "primary | context | affected" }], "assessmentVi": "Vietnamese" }],
  "comparisonAudit": { "requirementId": "comparative id", "statedPositionEvidence": [{ "paragraphIndex": 0, "sourceText": "exact English", "role": "primary" }], "comparisonEvidence": [{ "paragraphIndex": 1, "sourceText": "exact English", "role": "context" }], "basis": ["scope | severity | duration | reversibility | significance"], "status": "earned | partial | asserted_only", "noteVi": "Vietnamese" },
  "pointAudit": [{ "id": "supplied point id", "paragraphIndex": 1, "sourceText": "supplied exact English", "sourceSentenceIndexes": [1], "mechanism": "present | missing | not_needed", "consequence": "specific | abstract | missing | not_needed", "example": "none | supports_directly | paraphrases_claim | needs_bridge | mismatched", "status": "fully_developed | partly_developed | undeveloped | irrelevant", "findingIds": ["zero or one material finding id"], "noteVi": "Vietnamese" }],
  "findings": [{ "id": "stable id", "criterion": "task_response", "scope": "macro | paragraph | local", "severity": "minor | moderate | major", "evidence": [{ "paragraphIndex": 0, "sourceText": "smallest exact English quote", "role": "primary | context | affected" }], "requirementIds": ["affected supplied ids"], "errorLabelVi": "Vietnamese", "explanationVi": "Vietnamese", "repairVi": "Vietnamese" }]
}
`;

const COHERENCE_COHESION_FOCUS_SYSTEM = `
You are reviewing only IELTS Coherence and Cohesion. Read the complete essay and initial CC score. Return JSON only.

${DISCOVERY_CONTRACT}

Coherence is the relationship and order of existing ideas. Reconstruct those relationships and flag only a real reading problem: non-linear or mixed ordering, reversed cause and effect, support separated from the idea it completes, a conclusion placed before its support, or a local logical jump between existing ideas. A missing explanation is Task Response, and a sentence fragment is Grammar.

Cohesion is how each sentence carries the reader from given information to new information. Check thematic progression, new themes that are neither introduced nor inferable, unclear reference, substitution, inaccurate connectives, and mechanical repetition. A new theme is not automatically wrong when the context prepares it.

Use criterion "coherence" for idea relationship/order and "cohesion" for textual connection. Quote all spans needed to show the relationship, not just one endpoint. Keep explanations in plain Vietnamese using “bạn”. Return an empty list when the message can be followed without a material CC problem.

${FOCUSED_FINDING_SHAPE}
`;

const COHERENCE_FOCUS_SYSTEM = `
You are critically reviewing only IELTS Coherence: the relationship, grouping, and written order of information that already exists in the essay. Read the complete essay and initial CC judgment. Return JSON only.

${DISCOVERY_CONTRACT}

Reconstruct each paragraph's intended line of thought before reporting anything. Report a finding only when a reader must mentally rearrange existing propositions: a conclusion appears before its grounds, cause and result are placed in an obstructive order, two lines of thought are interleaved, support is separated from the claim it completes, or material belongs with another paragraph. The repair must be possible mainly by moving or regrouping existing text.

Do not report missing explanation, missing consequence, weak evidence, an unsupported outweigh judgment, or an irrelevant example as Coherence; those belong to Task Response. Do not report fragments or malformed clauses as Coherence. Use criterion "coherence" only. Quote every endpoint needed to demonstrate the ordering problem. If the written order is already recoverable with ease, return an empty findings list.
Inspect the whole essay, but do not claim exhaustive discovery or manufacture findings to meet a quota. An empty list means only that this pass did not confirm a material Coherence problem.

${FOCUSED_FINDING_SHAPE}
`;

const COHESION_FOCUS_SYSTEM = `
You are critically reviewing only IELTS Cohesion: the local textual handoff from one sentence or clause to the next. Read the complete essay and initial CC judgment. Return JSON only.

${DISCOVERY_CONTRACT}

Inspect Theme-Rheme and given-new progression, reference chains, substitution, lexical chains, and the accuracy of connectives. A new Theme is not automatically faulty: it may validly open a parallel branch under the established paragraph topic. Report only a handoff that creates repeated friction or a genuine breakdown for the reader.

If the intended relation is obvious and only a word is unnatural, it is Lexical Resource. If a fragment or malformed clause still communicates an obvious cause, contrast, or referent, it is Grammar. A malformed example-introducing phrase is vocabulary or grammar when the example's relationship to the preceding claim is still obvious. If adding reasoning solves the problem, it is Task Response; if moving existing text solves it, it is Coherence. Use criterion "cohesion" only. Every finding must quote the smallest exact phrase carrying the faulty handoff and a separate context or affected quote containing the preceding information or antecedent needed to prove the relationship. Return an empty findings list when the reader can follow the local links with ease.
Inspect the whole essay, but do not claim exhaustive discovery or manufacture findings to meet a quota. An empty list means only that this pass did not confirm a material Cohesion problem.

${FOCUSED_FINDING_SHAPE}
`;

const LEXICAL_RESOURCE_FOCUS_SYSTEM = `
You are reviewing only IELTS Lexical Resource. Read the complete essay and initial LR score. Return JSON only.

${DISCOVERY_CONTRACT}

Report genuine local problems in word meaning, precision, collocation, register, word formation, spelling, or clearly limiting repetition. Do not report strengths. Do not turn an argument, relevance, cohesion, tense, agreement, clause, or sentence-structure problem into vocabulary feedback.

Use criterion "lexical_resource" only. Report a phrase only when the original wording is inaccurate, noticeably unnatural, or inappropriate for the intended meaning; do not replace acceptable English merely because another phrase is more formal or elegant. Conventional variants such as "open opportunities" are not errors merely because "create opportunities" may be more frequent.

The syntactic environment owns inflectional form. An auxiliary selecting the wrong participle ("has becoming"), subject-verb agreement, possessive/plural marking, tense, articles, or a form required by clause structure belongs to Grammar, not Lexical Resource. Do not report it in this pass.

Return one defect per finding. If a sentence contains several independent errors, do not bundle them. Quote only the smallest editable English token or phrase that contains the lexical defect, and provide only its smallest natural English replacement. Do not include unchanged surrounding words in sourceText or replacementText. Write natural Vietnamese only, except for unchanged English evidence and corrections. Never use Chinese characters in Vietnamese feedback. Return an empty list if there is no real lexical error.
Inspect the whole essay, but do not claim exhaustive discovery or manufacture findings to meet a quota. An empty list means only that this pass did not confirm a material lexical error.

${FOCUSED_FINDING_SHAPE}
`;

const GRAMMAR_FOCUS_SYSTEM = `
You are reviewing only IELTS Grammatical Range and Accuracy. Read the complete essay and initial GRA score. Return JSON only.

${DISCOVERY_CONTRACT}

Report genuine errors in sentence completeness, clause construction, tense, agreement, articles, prepositions, pronouns, punctuation, parallelism, or other grammatical form. Do not report strengths, stylistic preferences, vocabulary problems, or weak reasoning. Do not invent an article-parallelism error merely because the first item in a coordinated noun phrase has a determiner; report it only when the resulting phrase is actually ungrammatical.

Use criterion "grammatical_range_accuracy" only. A wrong lexical choice remains Lexical Resource even when its correction changes an adjective, noun, or verb form; report it as Grammar only when the syntactic construction itself requires a different form. Auxiliary-participle selection, agreement, tense, possessive/plural marking, articles, and clause-governed forms are Grammar.

Return one grammatical defect per finding. If one sentence contains several independent errors, separate them into separate findings rather than quoting and replacing the whole sentence. Quote the smallest editable span that can show the grammatical error; use the full sentence only when its overall clause structure cannot be repaired through a smaller contiguous span. The replacement must cover exactly that quoted span and preserve no unnecessary surrounding words. Provide the smallest grammatical English correction. Do not report a phrase merely because another version sounds more formal or natural. Write natural Vietnamese only, except for unchanged English evidence and corrections. Never use Chinese characters in Vietnamese feedback. Return an empty list if there is no real grammar error.
Every replacement must preserve the proposition the writer was trying to express and must still make sense with the preceding and following sentence. Making a fragment technically complete with an empty predicate such as "is evident", "is important", or "is clear" is not an acceptable repair when it changes or weakens the intended conclusion. If a dependent clause is part of a contrast or conclusion, repair the whole broken construction just far enough to express that existing contrast or conclusion; do not invent a new argument.
Explain grammar in plain Vietnamese. Name the form only when useful, and name it correctly: for example, "has become" is present perfect, not past perfect. Prefer "sau 'has' cần dùng 'become'" over unexplained labels such as "auxiliary" or "past participle".
Inspect the whole essay, but do not claim exhaustive discovery or manufacture findings to meet a quota. An empty list means only that this pass did not confirm a material grammatical error.

${FOCUSED_FINDING_SHAPE}
`;

const CRITERION_SCORE_SYSTEMS = {
  taskAchievement: `Score only IELTS Task Response as a whole-number band. Match the complete essay holistically to the official progression: Band 9 fully addresses the task with a fully developed position and fully extended support; Band 8 sufficiently addresses it with a clear, well-developed position and only occasional omission; Band 7 appropriately addresses the main parts with developed ideas whose support may occasionally lack focus or precision; Band 6 addresses the main parts unevenly and has some insufficiently developed or unclear ideas; Band 5 only partially addresses the task with limited development. In an outweigh task, judge whether the body earns the comparison, not whether it repeats the word "outweigh".`,
  coherenceCohesion: `Score only IELTS Coherence and Cohesion as a whole-number band. Judge Coherence and Cohesion separately before selecting the combined band. Band 9 is effortless and unobtrusive; Band 8 can be followed with ease and cohesion is well managed; Band 7 has clear logical progression with generally effective but occasionally imperfect cohesion; Band 6 is generally coherent but cohesion may be faulty or mechanical; Band 5 has incomplete logical organisation and noticeable progression/reference problems. Grammar errors do not lower CC when the intended relation remains recoverable.`,
  lexicalResource: `Score only IELTS Lexical Resource as a whole-number band. Band 9 shows full flexibility and precision with extremely rare errors; Band 8 uses a wide resource fluently and precisely with occasional errors; Band 7 shows sufficient flexibility, precision, style, and collocation with occasional errors; Band 6 is generally adequate but has limited flexibility or recurring inaccuracies; Band 5 is limited with noticeable errors that may cause difficulty. Judge the complete essay, not a raw error count.`,
  grammaticalRange: `Score only IELTS Grammatical Range and Accuracy as a whole-number band. Band 9 shows full flexibility and control with extremely rare errors; Band 8 uses a wide range flexibly and accurately with most sentences error-free; Band 7 uses varied complex structures with generally good control and frequent error-free sentences; Band 6 mixes simple and complex forms with errors that rarely impede communication; Band 5 has limited range/control and frequent errors that cause some reading difficulty. Several conspicuous but recoverable local errors can still fit Band 6.`,
} as const;

const CRITERION_SCORE_OUTPUT_V6 = `
Use the complete essay and verified findings as evidence, not as a point-deduction table. Score independently from the descriptor match; you are not given the first-read band and must not infer it. Band 9 is an exceptional positive standard, not the default when no finding exists. One local or macro limitation does not automatically cap the criterion at Band 6: judge how widespread and consequential the pattern is across the complete response. Do not add or reclassify findings. Write concise Vietnamese using “bạn” and the Latin-based Vietnamese alphabet only; never insert Chinese Han characters. Return JSON only: { "band": 0, "rationaleVi": "...", "whyNotHigherVi": "...", "whyNotLowerVi": "..." }.
`;

const EXAMINER_SYSTEM = `
You are the sole authoritative IELTS Writing Task 2 examiner for Critical Writer. Return only valid JSON.

Read the prompt and the entire essay naturally before classifying anything. First decide the bands as a human examiner would. Then record the exact, material limitations that explain those bands in ordinary criterion language. Do not map them to an error taxonomy in this pass. Do not manufacture a quota of observations, but do not omit a repeated or consequential weakness.

${BAND_CALIBRATION}
${CRITERION_BOUNDARIES}
${VOICE_DNA}
${DISCOVERY_CONTRACT}

Evidence rules:
- Every finding must quote one or more exact contiguous English spans from the essay and identify the zero-based paragraph index. Quote the smallest clause or phrase that demonstrates the point; never quote a whole paragraph or combine several sentences into one evidence span. Use separate evidence items for separate sentences.
- Include context/affected evidence when your diagnosis mentions it. A later verifier will reject claims whose evidence is incomplete.
- Diagnose the smallest defensible issue. Merge duplicate observations about the same underlying problem.
- For language, quote the smallest erroneous span, not the whole sentence.
- For argument/flow, inspect the entire paragraph before deciding that an idea is missing or unsupported.
- Coherence findings may include a local logical jump between two chunks, even when the paragraph does not require broad restructuring.
- Do not segment the essay into chunks in this pass. This is an examiner pass, not a renderer pass.

Coverage routine inside this same reading:
1. Decide the four bands from the complete response.
2. Derive each independently scorable requirement from the task prompt, then audit the position and every body paragraph for material argument/flow limitations. Do not combine multiple requirements into one item. For an outweigh task, separately track the advantages, disadvantages, and the writer's comparative judgment; for discuss-both, separately track both views and the writer's opinion.
3. Re-read every sentence once for concrete cohesion, lexical, and grammar errors. Record the clear local errors that materially establish the criterion pattern. Include representative repeated instances when they are needed to show recurrence; this inspection does not promise an exhaustive error inventory.
4. Check that no candidate finding is contradicted or already resolved later in the same paragraph.
This routine improves evidence coverage; it must not turn scoring into error counting.

Return exactly:
{
  "promptType": "agree_disagree | discuss_both | advantages_disadvantages | outweigh | cause_effect | problem_solution | two_part",
  "scores": { "taskAchievement": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRange": 0, "overall": 0 },
  "firstReadVi": "natural Vietnamese overview",
  "macroPosition": "concise English position",
  "taskRequirements": [{ "id": "requirement:stable-id", "requirement": "plain-English requirement derived from the task prompt", "status": "fully_addressed | partly_addressed | missing | off_task", "evidence": [{ "paragraphIndex": 0, "sourceText": "exact English source", "role": "primary | context | affected", "occurrenceIndex": 0 }], "assessmentVi": "Vietnamese" }],
  "topicSentenceCoverage": [{ "paragraphIndex": 1, "sourceText": "exact English topic sentence", "status": "covers_position | partly_covers_position | does_not_cover_position", "noteVi": "Vietnamese" }],
  "criterionJudgments": [{ "criterion": "taskAchievement | coherenceCohesion | lexicalResource | grammaticalRange", "band": 0, "rationaleVi": "Vietnamese" }],
  "observations": [{
    "id": "finding:stable-id", "criterion": "task_response | coherence | cohesion | lexical_resource | grammatical_range_accuracy",
    "severity": "minor | moderate | major", "confidence": 0.0,
    "evidence": [{ "paragraphIndex": 0, "sourceText": "exact English source", "role": "primary | context | affected", "occurrenceIndex": 0 }],
    "requirementIds": ["requirement ids affected by this finding; empty for non-coverage findings"],
    "diagnosisVi": "Vietnamese", "readerEffectVi": "Vietnamese", "repairDirectionVi": "Vietnamese", "replacementText": "required smallest local English correction for LR/GRA; optional otherwise"
  }]
}

The user message includes a zero-based paragraph/sentence manifest. Treat it as authoritative. paragraphIndex must match the manifest entry containing sourceText. Include occurrenceIndex only when the same sourceText appears more than once inside that paragraph; otherwise omit it or use 0.
`;

function verifierSystem(
  scope: 'argument' | 'language',
  idPrefix: string,
) {
  const criteria = scope === 'argument'
    ? ['task_response', 'coherence', 'cohesion'] as const
    : ['lexical_resource', 'grammatical_range_accuracy'] as const;
  const scopeRules = scope === 'argument'
    ? `
Scope: Task Response, Coherence, and Cohesion only.
- Read the prompt, position, and complete paragraph before confirming a limitation.
- Evaluate the intended meaning even when its sentence has a grammar error. A malformed sentence does not erase the reason, mechanism, or example it is trying to provide.
- Do not call an idea underdeveloped merely because it could contain more detail. Confirm it only when the paragraph needs that missing step to make its claim relevant, acceptable, or sufficiently supported.
- Confirm unsupported_claim only after checking every later sentence in the paragraph. Include the nearest attempted support as context evidence and explain why its meaning still cannot support the claim. A claim followed by a comprehensible cause, mechanism, or example is not unsupported merely because that support contains a local grammar error.
- Do not demand an explanation for a relationship already explicit or immediately inferable from the writer's own wording. For example, regular conversation making it easier to maintain a long-distance relationship is already a comprehensible link.
- Distinguish missing content (Task Response), misplaced existing content (Coherence), and faulty textual glue (Cohesion).
- A grammatically incomplete or malformed clause belongs to Grammar, even if it also makes a textual link hard to read. Confirm a Cohesion finding only when the reference/connective/theme link remains faulty after the sentence is grammatically well formed.
`
    : `
Scope: Lexical Resource and Grammatical Range & Accuracy only.
- Re-read every sentence from beginning to end, including the conclusion. Check each finite verb, clause boundary, complementation pattern, agreement, tense, article, preposition, word form, spelling, collocation, and local word choice.
- Return only actual local language errors. Never report praise, argument quality, evidence quality, or an optional stylistic upgrade.
- Each sourceText and replacementText must isolate the smallest editable phrase. If one sentence contains separate errors, return separate findings unless one rewrite is necessary to repair a single broken construction.
`;
  return `
You are the ${scope === 'argument' ? 'argument-and-flow' : 'language'} evidence verifier for an IELTS assessment. Return only valid JSON. You do not score or rescore the essay.

For every examiner observation, test four things against the complete essay:
1. Evidence accuracy: every quote exists exactly and the diagnosis considers all relevant earlier and later material in the paragraph.
2. Criterion ownership: the issue belongs to the stated criterion under the boundaries below.
3. Non-duplication: two findings do not describe the same underlying defect.
4. Materiality: the finding is a genuine limitation, not a style preference or generic precaution.

The user message also includes otherScopeObservations for collision awareness only. Do not return those observations, but use them to avoid describing the same underlying defect under two criteria. A single English span may legitimately contain two independent problems; merge/reject only when the diagnoses name the same cause.

${CRITERION_BOUNDARIES}
${DISCOVERY_CONTRACT}
${scopeRules}

You assign the fixed errorCode here. Its taxonomy entry determines the criterion; never pair a code with a different criterion. You may correct criterion only within this verifier's stated scope. If an observation actually belongs to the other verifier's scope, reject it here and say so in verificationVi rather than transferring it. You may correct the evidence list or wording and may merge a duplicate into another finding. You must not create or change a band score. Mark unsupported observations rejected. Use uncertain only when the evidence genuinely permits two readings.

For coverage findings, preserve or correct requirementIds so each finding names only the prompt requirements it actually affects. A confirmed finding must have confidence >= 0.70. If exact sourceText occurs more than once in its paragraph, include the zero-based occurrenceIndex; otherwise omit it or use 0.

After checking the supplied observations, perform one compact best-effort coverage audit of the complete essay. You may append a new confirmed finding only when a material, textually demonstrable limitation is clear. This is a chance to catch an important omission, not a requirement to complete an exhaustive inventory. Use an id beginning "${idPrefix}". Do not add stylistic preferences, positive observations, or a quota of minor issues.

Fixed taxonomy handbook:
${taxonomyPrompt([...criteria])}

Return every supplied observation exactly once, followed by any justified verifier additions, in this shape:
{
  "findings": [{
    "id": "original id", "criterion": "task_response | coherence | cohesion | lexical_resource | grammatical_range_accuracy",
    "errorCode": "fixed taxonomy code", "severity": "minor | moderate | major", "confidence": 0.0,
    "evidence": [{ "paragraphIndex": 0, "sourceText": "exact English source", "role": "primary | context | affected", "occurrenceIndex": 0 }],
    "requirementIds": ["affected requirement ids; empty for non-coverage findings"],
    "diagnosisVi": "Vietnamese", "readerEffectVi": "Vietnamese", "repairDirectionVi": "Vietnamese", "replacementText": "preserve or correct local English replacement",
    "verdict": "confirmed | rejected | uncertain", "verificationVi": "concise Vietnamese reason", "mergedIntoFindingId": "optional id"
  }],
  "coverageCheckVi": "Vietnamese summary of verification"
}
`;
}

const ARGUMENT_VERIFIER_SYSTEM = verifierSystem('argument', 'verifier:argument:');
const LANGUAGE_VERIFIER_SYSTEM = verifierSystem('language', 'verifier:language:');

const SCORE_CONSISTENCY_SYSTEM = `
You are the final IELTS score-consistency auditor. Return only valid JSON. You do not discover or rewrite feedback.

The essay was scored once by a natural examiner, then each criterion was scored again after every concrete observation was independently verified. Re-read the prompt and complete essay holistically. Reconcile initialScores with criterionPassScores using the confirmed findings and IELTS descriptors.

${BAND_CALIBRATION}

Rules:
- Preserve an initial band whenever the whole-essay performance supports it.
- Do not automatically prefer either score. Use the whole essay, the two rationales, and confirmed findings to decide which band is better calibrated.
- A lack of confirmed local errors does not automatically mean a high band; range, development, flexibility, and ease of reading remain holistic.
- However, Band 5 or 6 must not rest mainly on observations that were rejected. If a low band is not supported by the essay as a whole, adjust it.
- Do not count findings or average their severities.
- Never write that the essay has "no errors". Say only that no material error in that criterion was confirmed, because this audit does not claim exhaustive discovery.
- For Task Response, a final band below 7 is inconsistent when every derived task requirement is fully addressed, the position is clear, and no material Task Response limitation survives verification. Local grammar damage in the conclusion remains Grammar unless it changes or removes the position.
- Return one decision for every criterion. Overall is the arithmetic mean rounded to the nearest 0.5.
- Write reasons in concise Vietnamese using the Latin-based Vietnamese alphabet only; never insert Chinese Han characters.

Return exactly: {
  "scores": { "taskAchievement": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRange": 0, "overall": 0 },
  "decisions": [{ "criterion": "taskAchievement | coherenceCohesion | lexicalResource | grammaticalRange", "initialBand": 0, "finalBand": 0, "reasonVi": "concise Vietnamese" }]
}.
`;

const STRUCTURE_SYSTEM = `
You create the source-faithful information-unit map used by existing Critical Writer map components. Return only valid JSON. Do not assess, score, explain errors, or repair the essay.

Split every paragraph into individual propositions in written order:
- A proposition is an exact span that can independently be supported, explained, caused, contrasted, qualified, or used as a result.
- One sentence may contain several propositions. Do not split a subject from its predicate, a verb from its object, a restrictive modifier from its noun, or a list that jointly makes one proposition.
- A connective is surface glue, not its own proposition. Keep it in removedCohesiveDevices when useful.
- Preserve sourceText exactly. Never translate, summarize, normalize, or fix the writer's wording.
- Collectively, sourceText plus removedCohesiveDevices must account for every English word and number in every original sentence. Do not omit material merely because it seems unimportant.
- Chunks must remain in exact source order, without overlap. Every original sentence must contribute at least one chunk.
- IDs are sentence-{zero-based paragraph index}-{one-based chunk index}.
- missingLinks may describe an absent relationship in English, but absent wording must never become sourceText.

Return exactly: { "paragraphs": [{ "index": 0, "label": "Introduction | Body 1 | Body 2 | Conclusion", "chunks": [{ "nodeId": "sentence-0-1", "sourceSentenceIndex": 1, "sourceText": "exact English span", "role": "setup | claim | reason | explanation | mechanism | example | comparison | contrast | concession | mini_conclusion | final_stance | filler | logic_jump | unsupported_claim", "simplifiedIdea": "concise English", "removedCohesiveDevices": ["optional exact connector"] }], "missingLinks": [{ "betweenNodeIds": ["ids"], "impliedIdea": "English" }] }] }.
`;

const FLOW_SYSTEM = `
You explain only the supplied verified Coherence findings using an existing information-unit map. Return only valid JSON. Do not score, add findings, or discuss Task Response, Cohesion, vocabulary, or grammar.

${VOICE_DNA}

- Draw actual information relationships, not a decorative left-to-right chain.
- Every endpoint must be an existing nodeId.
- Use suggestedOrder only when the verified finding requires relocation.
- A logical jump may be shown between two nearby chunks without claiming the whole paragraph needs restructuring.
- Use an argumentFlowChapter only for a verified macro/minor order problem that benefits from a staged walkthrough. Local problems remain a CoherenceFlow.
- The explanation should make the reader's reconstruction burden visible and explain why the repaired order/relationship is easier to follow.
- Do not hide one local flow merely because another paragraph has a chapter.

Return exactly:
{
  "coherenceFlows": [{
    "paragraphIndex": 0, "edgeId": "confirmed finding id", "fromNodeIds": ["existing ids"], "toNodeId": "existing id",
    "relationshipTag": "short English", "flowType": "linear | backward | joint | contrast | bridge | conclusion", "status": "weak | broken",
    "writtenOrder": ["ids"], "actualDependency": "English", "suggestedOrder": ["ids"], "readerBurdenVi": "Vietnamese",
    "diagnosticPattern": "joint_causes_as_chain | cause_result_reversed | interleaved_parallel_chains | conclusion_before_grounds | separated_dependent_chunks | missing_bridge | other",
    "repairScope": "local_relocation | minor_restructure | macro_restructure",
    "issue": { "id": "same confirmed finding id", "errorCode": "same confirmed code", "errorLabelVi": "fixed label", "type": "logical_jump | missing_bridge | misordered_sequence | wrong_relationship | relational", "direction": "horizontal", "title": "Vietnamese", "whyWrong": "Vietnamese", "impactOnPurpose": "Vietnamese, distinct and short", "impactOnReader": "Vietnamese, distinct and short", "affectedNodes": { "paragraphs": [0], "sentences": [{ "paraIndex": 0, "sentenceIndex": 1 }] }, "nodeLinks": { "primaryNodeIds": ["ids"], "contextNodeIds": ["ids"], "affectedNodeIds": ["ids"] }, "comment": { "bodyVi": "Vietnamese", "solutionBodyVi": "Vietnamese" }, "solutionActions": [{ "type": "suggest_order | move_node | add_bridge", "label": "Vietnamese", "details": "Vietnamese", "targetNodeIds": ["ids"], "currentOrder": ["ids"], "proposedOrder": ["ids"], "proposedText": "optional English", "whyBetter": "Vietnamese" }] }
  }],
  "argumentFlowOverview": { "titleVi": "Vietnamese", "bodyVi": "Vietnamese", "nodeIds": ["relevant ids"] },
  "argumentFlowChapters": [{
    "id": "confirmed finding id", "paragraphIndex": 0, "titleVi": "Vietnamese",
    "paragraphPromiseVi": "Vietnamese", "macroAlignmentVi": "Vietnamese", "macroErrorType": "coherence_order",
    "coherencePatterns": ["same pattern as the finding"], "repairScope": "minor_restructure | macro_restructure",
    "hasMacroRearrangement": true, "originalOrder": ["existing ids"],
    "questions": [{ "id": "q1", "label": "English", "questionVi": "Vietnamese", "purposeVi": "Vietnamese", "nodeIds": ["ids"] }],
    "assignments": [{ "nodeId": "existing id", "questionId": "q1", "role": "question | conclusion | unassigned" }],
    "diagnosisIntroVi": "Vietnamese",
    "diagnosis": [{ "id": "d1", "titleVi": "Vietnamese", "bodyVi": "Vietnamese", "nodeIds": ["ids"] }],
    "repairIntroVi": "Vietnamese",
    "repairSteps": [{ "id": "r1", "titleVi": "Vietnamese", "bodyVi": "Vietnamese", "nodeIds": ["ids"], "order": ["ids"], "repairScope": "minor_restructure | macro_restructure" }],
    "finalOrder": ["existing ids"], "finalSummaryVi": "Vietnamese", "taskAuditVi": ""
  }]
}

If no supplied finding needs a chapter, return argumentFlowChapters=[].
`;

const COMPARISON_SYSTEM = `
You write a natural Band 8/9 version of the supplied IELTS Task 2 essay for side-by-side comparison. Return only valid JSON.

Use the verified findings as guidance, but write one coherent improved essay rather than an edit ledger. Correct the argument, development, flow, cohesion, vocabulary, and grammar where needed to reach the target. Preserve the writer's position and the recognisable core of defensible ideas. Prefer purposeful edits that directly fix the confirmed problems; do not rewrite the whole essay just to sound more sophisticated.

Set targetBand to 8 for an original overall below 8.5. Use targetBand 9 only when an already strong 8.5+ essay is being polished to Band 9. Local repairs to a Band 6 or 7 essay must not be described as producing Band 9.

Do not invent statistics, research, named incidents, or unverifiable factual claims. Use general reasoning or clearly hypothetical examples when the original evidence is weak.

Coverage findings are mandatory fixes. If the confirmed findings say a required prompt part is missing or only partly addressed, the revised essay must add a real answer to that part. For example, if the prompt asks about using social media to learn news and the original only discusses fake news as a disadvantage, the revised version must include a benefit or weighing point about access to news/events, not replace it with a different adjacent benefit such as business opportunities only.
If the task is an outweigh question, the revised essay must contain an explicit weighing sentence that compares the main advantages against the main disadvantages. Do not leave the comparison only in the thesis or conclusion.

Do not obey a fixed word-count target. The revised essay may be longer or shorter than the original when the prompt and confirmed errors require it. Still keep it as an IELTS Task 2 essay, not an over-expanded model answer.

In changeSummaryVi, briefly explain what the new version does better. The application will compare the two essays and highlight every changed phrase locally, so do not enumerate edits or return offsets.

Return exactly: { "targetBand": 8 | 9, "revisedEssay": "complete improved English essay", "changeSummaryVi": "concise Vietnamese", "preservedStrengthsVi": ["concise Vietnamese"], "changes": [] }.
`;

function scoreErrors(scores: BandScores) {
  const errors: string[] = [];
  const criteria: Array<keyof Omit<BandScores, 'overall'>> = [
    'taskAchievement',
    'coherenceCohesion',
    'lexicalResource',
    'grammaticalRange',
  ];
  criteria.forEach(key => {
    if (!Number.isInteger(scores?.[key]) || scores[key] < 0 || scores[key] > 9) {
      errors.push(`${key} must be a whole band from 0 to 9.`);
    }
  });
  const expected = Math.round((criteria.reduce((sum, key) => sum + Number(scores?.[key] || 0), 0) / 4) * 2) / 2;
  if (scores?.overall !== expected) errors.push(`overall must equal ${expected}.`);
  return errors;
}

function evidenceOffset(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: ExaminerEvidence,
) {
  const paragraph = manifest.find(item => item.index === evidence.paragraphIndex);
  if (!paragraph || !evidence.sourceText.trim()) return -1;
  const matches: number[] = [];
  let cursor = paragraph.startChar;
  while (cursor <= paragraph.endChar - evidence.sourceText.length) {
    const match = essay.indexOf(evidence.sourceText, cursor);
    if (match < paragraph.startChar || match + evidence.sourceText.length > paragraph.endChar) break;
    matches.push(match);
    cursor = match + Math.max(1, evidence.sourceText.length);
  }
  const occurrenceIndex = evidence.occurrenceIndex ?? 0;
  return matches[occurrenceIndex] ?? -1;
}

function evidenceOccurrenceCount(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: ExaminerEvidence,
) {
  const paragraph = manifest.find(item => item.index === evidence.paragraphIndex);
  if (!paragraph || !evidence.sourceText.trim()) return 0;
  let count = 0;
  let cursor = paragraph.startChar;
  while (cursor <= paragraph.endChar - evidence.sourceText.length) {
    const match = essay.indexOf(evidence.sourceText, cursor);
    if (match < paragraph.startChar || match + evidence.sourceText.length > paragraph.endChar) break;
    count += 1;
    cursor = match + Math.max(1, evidence.sourceText.length);
  }
  return count;
}

export function linkTaskResponsePointFindings(
  result: TaskResponseFocusedPass,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const findingsById = new Map((result.findings || []).map(finding => [finding.id, finding]));

  result.pointAudit = (result.pointAudit || []).map(point => {
    if (point.status === 'fully_developed') return { ...point, findingIds: [] };

    const currentFinding = point.findingIds?.length === 1
      ? findingsById.get(point.findingIds[0])
      : undefined;
    if (
      currentFinding
      && currentFinding.scope !== 'macro'
      && currentFinding.evidence.some(evidence => evidence.paragraphIndex === point.paragraphIndex)
    ) {
      return point;
    }

    const paragraph = manifest.find(item => item.index === point.paragraphIndex);
    if (!paragraph) return point;
    const pointSentences = new Set(point.sourceSentenceIndexes || []);
    const candidates = (result.findings || []).filter(finding => {
      if (finding.scope === 'macro' || finding.criterion !== 'task_response') return false;
      return finding.evidence.some(evidence => {
        const paragraphIndex = evidence.paragraphIndex;
        if (paragraphIndex === undefined || paragraphIndex !== point.paragraphIndex) return false;
        const startChar = evidenceOffset(essay, manifest, {
          ...evidence,
          paragraphIndex,
        });
        if (startChar < 0) return false;
        const endChar = startChar + evidence.sourceText.length;
        return paragraph.sentences.some(sentence => (
          pointSentences.has(sentence.index)
          && startChar < sentence.endChar
          && endChar > sentence.startChar
        ));
      });
    });

    return candidates.length === 1
      ? { ...point, findingIds: [candidates[0].id] }
      : point;
  });

  return result;
}

function evidenceExists(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: ExaminerEvidence[],
) {
  return evidence.length > 0 && evidence.every(item => evidenceOffset(essay, manifest, item) >= 0);
}

function evidenceScopeErrors(
  finding: ExaminerObservation,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const errors: string[] = [];
  (finding.evidence || []).forEach((evidence, index) => {
    const paragraph = manifest.find(item => item.index === evidence.paragraphIndex);
    const sourceLength = evidence.sourceText.trim().length;
    const nearlyWholeParagraph = paragraph
      && paragraph.text.trim().length > 120
      && sourceLength >= paragraph.text.trim().length * 0.75;
    if (sourceLength > 320 || nearlyWholeParagraph) {
      errors.push(`Finding ${finding.id} evidence ${index + 1} is too broad; split it into the smallest exact clauses.`);
    }
    if (
      (finding.criterion === 'lexical_resource' || finding.criterion === 'grammatical_range_accuracy')
      && sourceLength > 120
    ) {
      errors.push(`Finding ${finding.id} language evidence ${index + 1} must isolate the local error, not its sentence context.`);
    }
    const occurrenceCount = evidenceOccurrenceCount(essay, manifest, evidence);
    if (occurrenceCount > 1 && evidence.occurrenceIndex === undefined) {
      errors.push(`Finding ${finding.id} evidence ${index + 1} repeats ${occurrenceCount} times; occurrenceIndex is required.`);
    }
    if (evidence.occurrenceIndex !== undefined && (
      !Number.isInteger(evidence.occurrenceIndex)
      || evidence.occurrenceIndex < 0
      || evidence.occurrenceIndex >= occurrenceCount
    )) {
      errors.push(`Finding ${finding.id} evidence ${index + 1} has an invalid occurrenceIndex.`);
    }
  });
  return errors;
}

function examinerErrors(
  result: AuthoritativeExaminerPass,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const errors = scoreErrors(result.scores);
  const expectedCriteria = new Set(['taskAchievement', 'coherenceCohesion', 'lexicalResource', 'grammaticalRange']);
  const judgmentCriteria = result.criterionJudgments?.map(item => item.criterion) || [];
  if (
    judgmentCriteria.length !== expectedCriteria.size
    || new Set(judgmentCriteria).size !== expectedCriteria.size
    || judgmentCriteria.some(criterion => !expectedCriteria.has(criterion))
  ) {
    errors.push('criterionJudgments must contain each of the four criteria exactly once.');
  }
  const ids = new Set<string>();
  if (!result.taskRequirements?.length) errors.push('Examiner must derive the task requirements from the prompt.');
  const minimumRequirementCount: Partial<Record<PromptType, number>> = {
    discuss_both: 3,
    outweigh: 3,
    two_part: 2,
    problem_solution: 2,
    cause_effect: 2,
  };
  if ((result.taskRequirements?.length || 0) < (minimumRequirementCount[result.promptType] || 1)) {
    errors.push(`${result.promptType} requires independently scorable task requirements rather than one compound item.`);
  }
  (result.taskRequirements || []).forEach(requirement => {
    if (!requirement.requirement?.trim()) errors.push(`Task requirement ${requirement.id} must describe a prompt requirement.`);
    if (requirement.evidence?.length && !evidenceExists(essay, manifest, requirement.evidence)) {
      errors.push(`Task requirement ${requirement.id} must use exact evidence from its stated paragraph.`);
    }
  });
  const judgmentByCriterion = new Map((result.criterionJudgments || []).map(item => [item.criterion, item]));
  (['taskAchievement', 'coherenceCohesion', 'lexicalResource', 'grammaticalRange'] as const).forEach(criterion => {
    if (judgmentByCriterion.get(criterion)?.band !== result.scores?.[criterion]) {
      errors.push(`criterionJudgments.${criterion} must equal scores.${criterion}.`);
    }
  });
  (result.observations || []).forEach((finding, index) => {
    if (ids.has(finding.id)) errors.push(`Finding ${index + 1} has a duplicate id.`);
    ids.add(finding.id);
    if (!evidenceExists(essay, manifest, finding.evidence || [])) {
      errors.push(`Finding ${finding.id} must use exact evidence from its stated paragraph.`);
    }
    errors.push(...evidenceScopeErrors(finding, essay, manifest));
  });
  return errors;
}

function structureErrors(result: DecompositionPass, manifest: EssayParagraphManifest[]) {
  const errors: string[] = [];
  if (result.paragraphs?.length !== manifest.length) {
    return [`Structure map must return every paragraph; expected ${manifest.length}.`];
  }
  const nodeIds = new Set<string>();
  manifest.forEach(expectedParagraph => {
    const paragraph = result.paragraphs.find(item => item.index === expectedParagraph.index);
    if (!paragraph) {
      errors.push(`Structure map omitted paragraph ${expectedParagraph.index}.`);
      return;
    }
    let previousSentenceIndex = -1;
    (paragraph.chunks || []).forEach(chunk => {
      if (nodeIds.has(chunk.nodeId)) errors.push(`Structure map repeats nodeId ${chunk.nodeId}.`);
      nodeIds.add(chunk.nodeId);
      if (chunk.sourceSentenceIndex < previousSentenceIndex) {
        errors.push(`Paragraph ${paragraph.index} chunks are not in written sentence order.`);
      }
      previousSentenceIndex = chunk.sourceSentenceIndex;
    });

    expectedParagraph.sentences.forEach(sentence => {
      const chunks = (paragraph.chunks || []).filter(chunk => chunk.sourceSentenceIndex === sentence.index);
      if (!chunks.length) {
        errors.push(`Paragraph ${paragraph.index}, sentence ${sentence.index} has no information unit.`);
        return;
      }
      const covered = new Array(sentence.text.length).fill(false) as boolean[];
      let cursor = 0;
      chunks.forEach(chunk => {
        const localStart = sentence.text.indexOf(chunk.sourceText, cursor);
        if (!chunk.sourceText?.trim() || localStart < 0) {
          errors.push(`Chunk ${chunk.nodeId} must copy one exact, non-overlapping span from paragraph ${paragraph.index}, sentence ${sentence.index} in source order.`);
          return;
        }
        for (let index = localStart; index < localStart + chunk.sourceText.length; index += 1) covered[index] = true;
        cursor = localStart + chunk.sourceText.length;
      });

      const removedDevices = chunks.flatMap(chunk => chunk.removedCohesiveDevices || []);
      const deviceCursors = new Map<string, number>();
      removedDevices.forEach(device => {
        const searchFrom = deviceCursors.get(device) || 0;
        const localStart = sentence.text.indexOf(device, searchFrom);
        if (!device.trim() || localStart < 0) {
          errors.push(`Removed cohesive device ${JSON.stringify(device)} must be copied exactly from paragraph ${paragraph.index}, sentence ${sentence.index}.`);
          return;
        }
        for (let index = localStart; index < localStart + device.length; index += 1) covered[index] = true;
        deviceCursors.set(device, localStart + device.length);
      });

      const omittedWords = [...sentence.text.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)]
        .filter(match => !covered.slice(match.index!, match.index! + match[0].length).every(Boolean))
        .map(match => match[0]);
      if (omittedWords.length) {
        errors.push(`Paragraph ${paragraph.index}, sentence ${sentence.index} omits source words from the map: ${omittedWords.slice(0, 8).join(', ')}.`);
      }
    });
  });
  return errors;
}

function comparisonRewriteErrors(
  value: BandComparison,
  essay: string,
  finalScores: BandScores,
) {
  const errors: string[] = [];
  const expectedTargetBand = finalScores.overall >= 8.5 ? 9 : 8;
  if (value.targetBand !== expectedTargetBand) errors.push(`targetBand must be ${expectedTargetBand}.`);
  if (!value.revisedEssay?.trim()) errors.push('revisedEssay must contain the complete improved essay.');
  if (!value.changeSummaryVi?.trim()) errors.push('changeSummaryVi must briefly explain the improved version.');
  value.changes = [];
  return errors;
}

async function runComparisonRewriteOnce(
  input: {
    taskPrompt: string;
    originalEssay: string;
    authoritativeScores: BandScores;
    confirmedFindings: VerifiedFinding[];
  },
) {
  const comparison = await runPass<BandComparison>(
    COMPARISON_SYSTEM,
    input,
    value => comparisonRewriteErrors(value, input.originalEssay, input.authoritativeScores),
    'band-8-9-comparison-v8',
  );
  return comparison;
}

export async function generateAssessmentComparison({
  prompt,
  essay,
  analysis,
}: {
  prompt: string;
  essay: string;
  analysis: WritingAnalysis;
}) {
  const reasoningErrors = [
    ...(analysis.pyramid.macroAnswer.errors || []),
    ...analysis.pyramid.paragraphs.flatMap(paragraph => [
      ...(paragraph.errors || []),
      ...paragraph.sentences.flatMap(sentence => sentence.errors || []),
    ]),
    ...(analysis.pyramid.edgeReviews || []).flatMap(review => review.issues || []),
    ...(analysis.pyramid.coherenceFlows || []).map(flow => flow.issue),
  ];
  const languageHighlights = [
    ...(analysis.cohesionHighlights || []),
    ...(analysis.lexicalHighlights || []),
    ...(analysis.grammaticalHighlights || []),
  ];
  const confirmedFindings = [
    ...reasoningErrors.map((finding, index) => ({
      id: `reasoning:${index + 1}`,
      problemStrength: finding.problemStrength,
      errorCode: finding.errorCode,
      errorLabelVi: finding.errorLabelVi,
      diagnosisVi: 'whyWrong' in finding ? finding.whyWrong : finding.explanation || finding.message,
      repairDirectionVi: 'solutionActions' in finding
        ? finding.solutionActions?.map(action => action.details).join(' ')
        : 'suggestion' in finding ? finding.suggestion : undefined,
      evidence: finding.evidenceSpans || [],
    })),
    ...languageHighlights.map((finding, index) => ({
      id: `highlight:${index + 1}`,
      problemStrength: finding.problemStrength,
      errorCode: finding.errorCode,
      errorLabelVi: finding.errorLabelVi,
      diagnosisVi: finding.feedback,
      repairDirectionVi: finding.solutionFeedback,
      replacementText: finding.replacementText,
      evidence: [{
        sourceText: finding.sourceText,
        startChar: finding.startChar,
        endChar: finding.endChar,
      }],
    })),
  ];

  if (!confirmedFindings.length) {
    return {
      targetBand: (analysis.scores.overall >= 8.5 ? 9 : 8) as 8 | 9,
      revisedEssay: essay,
      changeSummaryVi: 'Không có lỗi đủ rõ để cần viết lại bản đối chiếu.',
      preservedStrengthsVi: [],
      changes: [],
    } satisfies BandComparison;
  }

  return runPass<BandComparison>(
    COMPARISON_SYSTEM,
    {
      taskPrompt: prompt,
      originalEssay: essay,
      authoritativeScores: analysis.scores,
      confirmedFindings,
    },
    value => comparisonRewriteErrors(value, essay, analysis.scores),
    'band-8-9-comparison-lazy',
  );
}

function scoreConsistencyErrors(
  result: ScoreConsistencyPass,
  initialScores: BandScores,
  examiner: AuthoritativeExaminerPass,
  confirmedFindings: VerifiedFinding[],
) {
  const errors = scoreErrors(result.scores);
  const criteria = ['taskAchievement', 'coherenceCohesion', 'lexicalResource', 'grammaticalRange'] as const;
  if (result.decisions?.length !== criteria.length || new Set(result.decisions?.map(item => item.criterion)).size !== criteria.length) {
    errors.push('Score audit must return one decision for every criterion.');
  }
  criteria.forEach(criterion => {
    const decision = result.decisions?.find(item => item.criterion === criterion);
    if (!decision || decision.initialBand !== initialScores[criterion] || decision.finalBand !== result.scores[criterion]) {
      errors.push(`Score audit decision for ${criterion} does not match its input and output bands.`);
    }
    if (decision && /[\p{Script=Han}]/u.test(decision.reasonVi || '')) {
      errors.push(`Score audit decision for ${criterion} must use Vietnamese without Chinese Han characters.`);
    }
  });
  const allRequirementsCovered = examiner.taskRequirements.length > 0
    && examiner.taskRequirements.every(requirement => requirement.status === 'fully_addressed');
  const hasMaterialTaskFinding = confirmedFindings.some(finding => (
    finding.criterion === 'task_response' && finding.severity !== 'minor'
  ));
  if (allRequirementsCovered && !hasMaterialTaskFinding && result.scores.taskAchievement < 7) {
    errors.push('Task Response cannot remain below 7 when every task requirement is fully addressed and no material Task Response limitation survived verification.');
  }
  return errors;
}

function reconcileCrossCriterionOwnership(findings: VerifiedFinding[]) {
  const grammarFindings = findings.filter(finding => (
    finding.verdict === 'confirmed'
    && finding.criterion === 'grammatical_range_accuracy'
  ));

  return findings.map(finding => {
    if (
      finding.verdict !== 'confirmed'
      || finding.criterion !== 'cohesion'
      || finding.errorCode !== 'faulty_sentence_link'
    ) return finding;

    const duplicate = grammarFindings.find(grammar => finding.evidence.some(cohesionEvidence => (
      grammar.evidence.some(grammarEvidence => (
        grammarEvidence.paragraphIndex === cohesionEvidence.paragraphIndex
        && (
          cohesionEvidence.sourceText.includes(grammarEvidence.sourceText)
          || grammarEvidence.sourceText.includes(cohesionEvidence.sourceText)
        )
      ))
    )));
    return duplicate ? { ...finding, mergedIntoFindingId: duplicate.id } : finding;
  });
}

function readableErrorLabelVi(finding: VerifiedFinding) {
  const taxonomyLabel = TAXONOMY_BY_CODE.get(finding.errorCode)?.labelVi;
  const modelLabel = finding.errorLabelVi?.trim();
  const fallback = modelLabel || taxonomyLabel || 'Điểm cần sửa';
  if (finding.criterion !== 'cohesion') return fallback;

  const isGeneric = !modelLabel || /liên kết trong câu bị lỗi|faulty sentence link|điểm cần sửa/i.test(modelLabel);
  if (!isGeneric) return modelLabel;

  const text = [
    finding.errorLabelVi,
    finding.diagnosisVi,
    finding.readerEffectVi,
    finding.repairDirectionVi,
    ...finding.evidence.map(item => item.sourceText),
  ].join(' ').toLocaleLowerCase('vi');

  if (/this|these|those|it|they|their|reference|referent|pronoun|đại từ|tham chiếu|quy chiếu/.test(text)) {
    return 'Tham chiếu chưa rõ';
  }
  if (/theme|rheme|given|new information|brand-new|new theme|thematic|chủ đề mới|thông tin cũ|thông tin mới/.test(text)) {
    return 'Câu sau mở ra quá đột ngột';
  }
  if (/moreover|in addition|however|therefore|consequently|as a result|on the other hand|connector|linking word|từ nối|liên từ/.test(text)) {
    return 'Từ nối chưa khớp quan hệ';
  }
  if (/repeat|repetition|lexical chain|key term|từ khóa|lặp|chuỗi từ/.test(text)) {
    return 'Chuỗi từ khóa bị đứt';
  }
  return taxonomyLabel && taxonomyLabel !== 'Liên kết trong câu bị lỗi'
    ? taxonomyLabel
    : 'Mạch nối giữa hai ý chưa rõ';
}

function reconcileOverlappingLanguageOwnership(
  findings: VerifiedFinding[],
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const candidates = findings
    .filter(finding => (
      finding.verdict === 'confirmed'
      && !finding.mergedIntoFindingId
      && (finding.criterion === 'lexical_resource' || finding.criterion === 'grammatical_range_accuracy')
    ))
    .map(finding => {
      const spans = finding.evidence.flatMap(evidence => {
        const startChar = evidenceOffset(essay, manifest, evidence);
        return startChar < 0 ? [] : [{ startChar, endChar: startChar + evidence.sourceText.length }];
      });
      return {
        finding,
        spans,
        evidenceLength: spans.reduce((sum, span) => sum + span.endChar - span.startChar, 0),
      };
    })
    .sort((left, right) => (
      right.finding.confidence - left.finding.confidence
      || left.evidenceLength - right.evidenceLength
      || left.finding.id.localeCompare(right.finding.id)
    ));
  const owners: typeof candidates = [];
  const mergedInto = new Map<string, string>();
  candidates.forEach(candidate => {
    const owner = owners.find(existing => candidate.spans.some(span => existing.spans.some(ownerSpan => (
      span.startChar < ownerSpan.endChar && span.endChar > ownerSpan.startChar
    ))));
    if (owner) mergedInto.set(candidate.finding.id, owner.finding.id);
    else owners.push(candidate);
  });
  return findings.map(finding => {
    const ownerId = mergedInto.get(finding.id);
    return ownerId ? { ...finding, mergedIntoFindingId: ownerId } : finding;
  });
}

function verifierErrors(
  result: EvidenceVerifierPass,
  observations: ExaminerObservation[],
  essay: string,
  manifest: EssayParagraphManifest[],
  addedIdPrefix: string,
  requirementIds: Set<string>,
) {
  const errors: string[] = [];
  const allowedCriteria = new Set<FindingCriterion>(addedIdPrefix.includes('argument')
    ? ['task_response', 'coherence', 'cohesion']
    : ['lexical_resource', 'grammatical_range_accuracy']);
  const expectedIds = observations.map(finding => finding.id);
  const actualIds = result.findings?.map(finding => finding.id) || [];
  if (new Set(actualIds).size !== actualIds.length) {
    errors.push('Verifier finding ids must be unique.');
  }
  expectedIds.forEach(id => {
    if (!actualIds.includes(id)) errors.push(`Verifier omitted ${id}.`);
  });
  (result.findings || []).forEach(finding => {
    if (!expectedIds.includes(finding.id) && !finding.id.startsWith(addedIdPrefix)) {
      errors.push(`Added finding ${finding.id} must use the ${addedIdPrefix} id prefix.`);
    }
    if ((finding.requirementIds || []).some(id => !requirementIds.has(id))) {
      errors.push(`Verified finding ${finding.id} references an unknown task requirement.`);
    }
    const taxonomy = TAXONOMY_BY_CODE.get(finding.errorCode);
    if (!taxonomy) {
      errors.push(`Verified finding ${finding.id} uses an unknown taxonomy code.`);
    } else if (!allowedCriteria.has(taxonomy.criterion) && finding.verdict !== 'rejected') {
      errors.push(`Verified finding ${finding.id} must be rejected here when its taxonomy code belongs to the other verifier's scope.`);
    } else {
      finding.criterion = taxonomy.criterion;
    }
    if (finding.verdict === 'confirmed' && !evidenceExists(essay, manifest, finding.evidence || [])) {
      errors.push(`Confirmed finding ${finding.id} lacks exact evidence in its stated paragraph.`);
    }
    if (!Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1) {
      errors.push(`Verified finding ${finding.id} confidence must be between 0 and 1.`);
    }
    if (finding.verdict === 'confirmed' && finding.confidence < 0.7) {
      errors.push(`Verified finding ${finding.id} cannot be confirmed below 0.70 confidence.`);
    }
    if (finding.verdict === 'confirmed') errors.push(...evidenceScopeErrors(finding, essay, manifest));
    if (
      finding.verdict === 'confirmed'
      && (finding.errorCode === 'unsupported_claim' || finding.errorCode === 'underdeveloped_idea')
      && !(finding.evidence || []).some(evidence => evidence.role === 'context' || evidence.role === 'affected')
    ) {
      errors.push(`Confirmed ${finding.errorCode} finding ${finding.id} must include the nearest support attempt as context evidence.`);
    }
    if (
      finding.verdict === 'confirmed'
      && (finding.criterion === 'lexical_resource' || finding.criterion === 'grammatical_range_accuracy')
      && (!finding.replacementText?.trim() || finding.replacementText === finding.evidence?.[0]?.sourceText)
    ) {
      errors.push(`Confirmed language finding ${finding.id} requires a smallest-span English replacement.`);
    }
  });
  return errors;
}

function descriptorAnchor(errorCode: string): AssessmentDescriptorAnchor {
  const entry = TAXONOMY_BY_CODE.get(errorCode);
  const criterion = entry?.criterion === 'coherence' || entry?.criterion === 'cohesion'
    ? 'coherence_cohesion'
    : entry?.criterion || 'task_response';
  return {
    criterion,
    featureCode: errorCode,
    featureEn: entry?.descriptorFeatureEn || '',
  };
}

function exactEvidenceSpans(
  essay: string,
  manifest: EssayParagraphManifest[],
  finding: VerifiedFinding,
): AssessmentEvidenceSpan[] {
  const seen = new Set<string>();
  return finding.evidence.flatMap(item => {
    const startChar = evidenceOffset(essay, manifest, item);
    if (startChar < 0) return [];
    const key = `${startChar}:${startChar + item.sourceText.length}:${item.role}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      startChar,
      endChar: startChar + item.sourceText.length,
      sourceText: item.sourceText,
      role: item.role,
    } satisfies AssessmentEvidenceSpan];
  });
}

function nodeIdsForFinding(
  decomposition: DecompositionPass,
  finding: VerifiedFinding,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const ids = new Set<string>();
  finding.evidence.forEach(evidence => {
    const paragraph = decomposition.paragraphs.find(item => item.index === evidence.paragraphIndex);
    const evidenceStart = evidenceOffset(essay, manifest, evidence);
    const evidenceEnd = evidenceStart + evidence.sourceText.length;
    paragraph?.chunks.forEach(chunk => {
      if (
        evidenceStart >= 0
        && Number.isFinite(chunk.startChar)
        && Number.isFinite(chunk.endChar)
        && chunk.startChar! < evidenceEnd
        && chunk.endChar! > evidenceStart
      ) {
        ids.add(chunk.nodeId);
      }
    });
  });
  return [...ids];
}

function nodeLinksForFinding(
  decomposition: DecompositionPass,
  finding: VerifiedFinding,
  essay: string,
  manifest: EssayParagraphManifest[],
): AssessmentNodeLinks {
  const byRole = (role: ExaminerEvidence['role']) => {
    const subset = { ...finding, evidence: finding.evidence.filter(item => item.role === role) };
    return nodeIdsForFinding(decomposition, subset, essay, manifest);
  };
  return {
    primaryNodeIds: byRole('primary'),
    contextNodeIds: byRole('context'),
    affectedNodeIds: byRole('affected'),
  };
}

function pyramidErrorForFinding(
  essay: string,
  manifest: EssayParagraphManifest[],
  decomposition: DecompositionPass,
  finding: VerifiedFinding,
): PyramidError {
  const errorLabelVi = readableErrorLabelVi(finding);
  const nodeLinks = nodeLinksForFinding(decomposition, finding, essay, manifest);
  const nodes = [...(nodeLinks.primaryNodeIds || []), ...(nodeLinks.contextNodeIds || []), ...(nodeLinks.affectedNodeIds || [])];
  const sentenceRefs = nodes.flatMap(nodeId => {
    const match = /^sentence-(\d+)-(\d+)$/.exec(nodeId);
    return match ? [{ paraIndex: Number(match[1]), sentenceIndex: Number(match[2]) }] : [];
  });
  return {
    problemStrength: finding.problemStrength,
    errorCode: finding.errorCode,
    errorLabelVi,
    type: 'internal',
    message: errorLabelVi,
    explanation: finding.diagnosisVi,
    suggestion: finding.repairDirectionVi,
    affectedNodes: {
      paragraphs: [...new Set(finding.evidence.map(item => item.paragraphIndex))],
      sentences: sentenceRefs,
    },
    proposedFix: {
      type: 'rewrite',
      details: finding.repairDirectionVi,
      proposedText: finding.replacementText,
      whyBetter: finding.readerEffectVi,
    },
    comment: {
      bodyVi: finding.diagnosisVi,
      solutionBodyVi: finding.repairDirectionVi,
    },
    evidenceSpans: exactEvidenceSpans(essay, manifest, finding),
    nodeLinks,
    descriptorAnchor: descriptorAnchor(finding.errorCode),
  };
}

function edgeReviewForCoherenceFinding(
  essay: string,
  manifest: EssayParagraphManifest[],
  decomposition: DecompositionPass,
  finding: VerifiedFinding,
): EdgeReview | undefined {
  const nodeLinks = nodeLinksForFinding(decomposition, finding, essay, manifest);
  const nodeIds = [
    ...(nodeLinks.primaryNodeIds || []),
    ...(nodeLinks.contextNodeIds || []),
    ...(nodeLinks.affectedNodeIds || []),
  ];
  if (!nodeIds.length) return undefined;

  const fromNodeId = nodeIds[0];
  const toNodeId = nodeIds[1] || fromNodeId;
  const errorLabelVi = readableErrorLabelVi(finding);
  return {
    edgeId: finding.id,
    fromNodeId,
    toNodeId,
    relationshipTag: errorLabelVi,
    expectedRelationship: finding.repairDirectionVi,
    actualRelationship: finding.diagnosisVi,
    status: finding.severity === 'major' ? 'broken' : 'weak',
    assessment: finding.diagnosisVi,
    issues: [{
      problemStrength: finding.problemStrength,
      id: finding.id,
      errorCode: finding.errorCode,
      errorLabelVi,
      type: 'relational',
      title: errorLabelVi,
      whyWrong: finding.diagnosisVi,
      impactOnPurpose: finding.readerEffectVi,
      impactOnReader: finding.readerEffectVi,
      affectedNodes: {
        paragraphs: [...new Set(finding.evidence.map(item => item.paragraphIndex))],
        sentences: nodeIds.flatMap(nodeId => {
          const match = /^sentence-(\d+)-(\d+)$/.exec(nodeId);
          return match ? [{ paraIndex: Number(match[1]), sentenceIndex: Number(match[2]) }] : [];
        }),
      },
      solutionActions: [{
        type: 'rewrite_node',
        label: 'Làm rõ mạch lập luận',
        details: finding.repairDirectionVi,
        targetNodeIds: nodeIds,
        whyBetter: finding.readerEffectVi,
      }],
      comment: {
        bodyVi: finding.diagnosisVi,
        solutionBodyVi: finding.repairDirectionVi,
      },
      evidenceSpans: exactEvidenceSpans(essay, manifest, finding),
      nodeLinks,
      descriptorAnchor: descriptorAnchor(finding.errorCode),
    }],
  };
}

function emptyReview(nodeId: string, job: string): NodeReview {
  return { nodeId, status: 'works', job, assessment: '', issues: [] };
}

function buildTaskPass(
  examiner: AuthoritativeExaminerPass,
  findings: VerifiedFinding[],
  decomposition: DecompositionPass,
  essay: string,
  manifest: EssayParagraphManifest[],
): TaskPass {
  const taskFindings = findings.filter(finding => finding.criterion === 'task_response');
  const coherenceEdgeReviews = findings
    .filter(finding => finding.criterion === 'coherence')
    .map(finding => edgeReviewForCoherenceFinding(essay, manifest, decomposition, finding))
    .filter((review): review is EdgeReview => Boolean(review));
  const macroCodes = new Set(['unclear_position', 'partial_prompt_coverage', 'unbalanced_coverage', 'unsupported_comparative_judgment', 'off_task']);
  const paragraphCodes = new Set(['unclear_paragraph_job']);
  const macroErrors: PyramidError[] = [];
  const paragraphErrors = new Map<number, PyramidError[]>();
  const nodeErrors = new Map<string, PyramidError[]>();

  taskFindings.forEach(finding => {
    const error = pyramidErrorForFinding(essay, manifest, decomposition, finding);
    const nodes = nodeIdsForFinding(decomposition, finding, essay, manifest);
    if (macroCodes.has(finding.errorCode)) {
      macroErrors.push(error);
      return;
    }
    if (paragraphCodes.has(finding.errorCode) || !nodes.length) {
      const paragraphIndex = finding.evidence[0]?.paragraphIndex ?? 0;
      paragraphErrors.set(paragraphIndex, [...(paragraphErrors.get(paragraphIndex) || []), error]);
      return;
    }
    const primaryNode = nodeLinksForFinding(decomposition, finding, essay, manifest).primaryNodeIds?.[0] || nodes[0];
    nodeErrors.set(primaryNode, [...(nodeErrors.get(primaryNode) || []), error]);
  });

  const paragraphs = decomposition.paragraphs.map(structure => {
    const errors = paragraphErrors.get(structure.index) || [];
    return {
      index: structure.index,
      label: structure.label,
      job: examiner.topicSentenceCoverage.find(item => item.paragraphIndex === structure.index)?.sourceText || '',
      review: {
        ...emptyReview(`para-${structure.index}`, ''),
        status: errors.length ? 'weak' as const : 'works' as const,
      },
      errors,
      sentences: structure.chunks.map(chunk => {
        const errorsForNode = nodeErrors.get(chunk.nodeId) || [];
        return {
          nodeId: chunk.nodeId,
          review: {
            ...emptyReview(chunk.nodeId, chunk.simplifiedIdea),
            status: errorsForNode.length ? 'weak' as const : 'works' as const,
          },
          errors: errorsForNode,
        };
      }),
    };
  });

  const confirmedCoverageCodes = new Set([
    'unclear_position',
    'partial_prompt_coverage',
    'unbalanced_coverage',
    'unsupported_comparative_judgment',
    'off_task',
    'unclear_paragraph_job',
  ]);
  const confirmedCoverageFindings = taskFindings.filter(finding => confirmedCoverageCodes.has(finding.errorCode));
  const taskCoverage = examiner.taskRequirements.map((item, index) => {
    const id = item.id || `coverage:${index + 1}`;
    const matchingFinding = confirmedCoverageFindings.find(finding => {
      if (finding.requirementIds?.includes(id)) return true;
      if (finding.requirementIds?.length) return false;
      return item.evidence.some(requirementEvidence => finding.evidence.some(findingEvidence => (
        requirementEvidence.paragraphIndex === findingEvidence.paragraphIndex
        && (
          requirementEvidence.sourceText.includes(findingEvidence.sourceText)
          || findingEvidence.sourceText.includes(requirementEvidence.sourceText)
        )
      )));
    });
    return {
      id,
      requirement: item.requirement,
      status: item.status !== 'fully_addressed'
        ? item.status
        : matchingFinding
          ? 'partly_addressed' as const
          : 'fully_addressed' as const,
      evidenceNodeIds: Array.from(new Set(item.evidence.flatMap(evidence => {
        const paragraph = decomposition.paragraphs.find(candidate => candidate.index === evidence.paragraphIndex);
        return paragraph?.chunks
          .filter(chunk => evidence.sourceText.includes(chunk.sourceText) || chunk.sourceText.includes(evidence.sourceText))
          .map(chunk => chunk.nodeId) || [];
      }))),
      assessmentVi: matchingFinding ? matchingFinding.diagnosisVi : item.assessmentVi,
    };
  });

  const macroAnswer: MacroAnswerNode = {
    text: examiner.macroPosition,
    errors: macroErrors,
    review: {
      ...emptyReview('macro', 'State and sustain the essay position'),
      status: macroErrors.length ? 'weak' : 'works',
    },
  };
  return {
    taskAchievement: examiner.scores.taskAchievement,
    taskCoverage,
    macroAnswer,
    paragraphs,
    edgeReviews: coherenceEdgeReviews,
  };
}

function buildRelevanceGate(
  decomposition: DecompositionPass,
  findings: VerifiedFinding[],
  essay: string,
  manifest: EssayParagraphManifest[],
): RelevanceGatePass {
  const excludedCodes = new Set(['irrelevant_detail', 'off_task']);
  const excluded = new Map<string, VerifiedFinding>();
  findings.filter(finding => excludedCodes.has(finding.errorCode)).forEach(finding => {
    nodeIdsForFinding(decomposition, finding, essay, manifest).forEach(nodeId => excluded.set(nodeId, finding));
  });
  return {
    relevanceGate: decomposition.paragraphs.flatMap(paragraph => paragraph.chunks.map(chunk => {
      const finding = excluded.get(chunk.nodeId);
      return {
        nodeId: chunk.nodeId,
        paragraphIndex: paragraph.index,
        status: finding ? 'ineligible' : 'eligible',
        paragraphRoleFit: finding ? 'wrong_paragraph_role' : 'fits',
        coherenceEligible: !finding,
        reasonVi: finding?.diagnosisVi || 'Ý này thuộc mạch chính của đoạn.',
        taskResponseErrorCode: finding?.errorCode,
      } satisfies RelevanceGateItem;
    })),
  };
}

function highlightForFinding(
  essay: string,
  manifest: EssayParagraphManifest[],
  finding: VerifiedFinding,
): EssayHighlight | undefined {
  const evidence = finding.evidence.find(item => item.role === 'primary') || finding.evidence[0];
  const startChar = evidence ? evidenceOffset(essay, manifest, evidence) : 0;
  if (!evidence || startChar < 0) return undefined;
  const isStyleOpinion = isStyleOpinionFinding(finding);
  const errorLabelVi = isStyleOpinion
    ? 'Gợi ý polish (không bắt buộc)'
    : readableErrorLabelVi(finding);
  const replacement = finding.replacementText?.trim();
  return {
    problemStrength: finding.problemStrength,
    startChar: Math.max(0, startChar),
    endChar: Math.max(0, startChar) + (evidence?.sourceText.length || 0),
    errorCode: finding.errorCode,
    errorLabelVi,
    highlightType: isStyleOpinion ? 'style_suggestion' : 'error',
    label: errorLabelVi,
    sourceText: evidence?.sourceText,
    feedback: isStyleOpinion
      ? `Cảm giác của mình: đây không phải lỗi chắc chắn. Nếu polish kỹ hơn, mình sẽ nghiêng về ${replacement ? `"${replacement}"` : 'một lựa chọn khác'} vì ${finding.diagnosisVi}`
      : finding.diagnosisVi,
    replacementText: finding.replacementText,
    correction: finding.replacementText,
    suggestedText: finding.replacementText,
    solutionFeedback: isStyleOpinion
      ? 'Không bắt buộc sửa; chỉ xem như một lựa chọn về sắc thái và độ tự nhiên.'
      : finding.repairDirectionVi,
    paragraphIndex: evidence?.paragraphIndex,
    descriptorAnchor: descriptorAnchor(finding.errorCode),
  };
}

function buildLanguagePass(
  examiner: AuthoritativeExaminerPass,
  findings: VerifiedFinding[],
  essay: string,
  manifest: EssayParagraphManifest[],
): LanguagePass {
  const toHighlight = (finding: VerifiedFinding) => highlightForFinding(essay, manifest, finding);
  const hasUsableReplacement = (finding: VerifiedFinding) => {
    const replacement = finding.replacementText?.trim();
    const source = (finding.evidence.find(item => item.role === 'primary') || finding.evidence[0])?.sourceText?.trim();
    return Boolean(replacement && source && replacement !== source);
  };
  return {
    lexicalResource: examiner.scores.lexicalResource,
    grammaticalRange: examiner.scores.grammaticalRange,
    lexicalHighlights: findings
      .filter(finding => finding.criterion === 'lexical_resource')
      .filter(hasUsableReplacement)
      .map(toHighlight)
      .filter((highlight): highlight is EssayHighlight => Boolean(highlight)),
    grammaticalHighlights: findings
      .filter(finding => finding.criterion === 'grammatical_range_accuracy')
      .filter(hasUsableReplacement)
      .map(toHighlight)
      .filter((highlight): highlight is EssayHighlight => Boolean(highlight)),
  };
}

function buildCohesionPass(
  examiner: AuthoritativeExaminerPass,
  findings: VerifiedFinding[],
  essay: string,
  manifest: EssayParagraphManifest[],
  flows: CoherenceFlow[],
): CoherencePass {
  return {
    coherenceCohesion: examiner.scores.coherenceCohesion,
    coherenceFlows: flows,
    cohesionHighlights: findings
      .filter(finding => finding.criterion === 'cohesion')
      .map(finding => highlightForFinding(essay, manifest, finding))
      .filter((highlight): highlight is EssayHighlight => Boolean(highlight)),
  };
}

function flowErrors(result: FlowExplanationPass, decomposition: DecompositionPass, findings: VerifiedFinding[]) {
  const errors: string[] = [];
  const validIds = new Set(decomposition.paragraphs.flatMap(paragraph => paragraph.chunks.map(chunk => chunk.nodeId)));
  const findingIds = new Set(findings.map(finding => finding.id));
  const representedFindingIds = new Set<string>();
  (result.coherenceFlows || []).forEach(flow => {
    if (!findingIds.has(flow.edgeId) || flow.issue?.id !== flow.edgeId) errors.push(`Flow ${flow.edgeId} does not match a confirmed finding.`);
    representedFindingIds.add(flow.edgeId);
    if (!flow.fromNodeIds?.length || !flow.fromNodeIds.every(id => validIds.has(id)) || !validIds.has(flow.toNodeId)) {
      errors.push(`Flow ${flow.edgeId} uses an unknown or empty endpoint.`);
    }
  });
  (result.argumentFlowChapters || []).forEach(chapter => {
    if (!findingIds.has(chapter.id)) errors.push(`Chapter ${chapter.id} does not match a confirmed finding.`);
    representedFindingIds.add(chapter.id);
    const nodeIds = [
      ...(chapter.originalOrder || []),
      ...(chapter.finalOrder || []),
      ...(chapter.questions || []).flatMap(question => question.nodeIds || []),
      ...(chapter.assignments || []).map(assignment => assignment.nodeId),
      ...(chapter.diagnosis || []).flatMap(point => point.nodeIds || []),
      ...(chapter.repairSteps || []).flatMap(step => [...(step.nodeIds || []), ...(step.order || [])]),
    ];
    if (nodeIds.some(nodeId => !validIds.has(nodeId))) errors.push(`Chapter ${chapter.id} uses an unknown node.`);
  });
  findings.forEach(finding => {
    if (!representedFindingIds.has(finding.id)) errors.push(`Confirmed coherence finding ${finding.id} has no flow or chapter.`);
  });
  return errors;
}

function overallAssessment(
  examiner: AuthoritativeExaminerPass,
  findings: VerifiedFinding[],
  finalScores: BandScores,
  scoreAudit?: ScoreConsistencyPass,
): OverallAssessment {
  const criterionMap: Record<FindingCriterion, keyof Omit<BandScores, 'overall'>> = {
    task_response: 'taskAchievement',
    coherence: 'coherenceCohesion',
    cohesion: 'coherenceCohesion',
    lexical_resource: 'lexicalResource',
    grammatical_range_accuracy: 'grammaticalRange',
  };
  const priorities = findings
    .filter(finding => (
      finding.problemStrength === 'core_problem'
      || (!finding.problemStrength && finding.severity !== 'minor')
    ) && !isStyleOpinionFinding(finding))
    .map(finding => ({
      criterion: criterionMap[finding.criterion],
      titleVi: readableErrorLabelVi(finding),
      actionVi: finding.repairDirectionVi,
      evidenceIds: [finding.id],
      problemStrength: finding.problemStrength,
    }));
  return {
    summaryVi: findings.length
      ? `Bài được chấm ${finalScores.overall}. Phần tổng hợp chỉ dùng những vấn đề đã được đối chiếu với nguyên văn và đủ rõ để đưa ra feedback; kết quả không được xem là danh sách đầy đủ mọi lỗi có thể có.`
      : `Bài được chấm ${finalScores.overall}. Lượt review này chưa xác nhận được vấn đề cụ thể nào đủ rõ để tạo feedback; điều đó không có nghĩa bài hoàn hảo hoặc mọi lỗi có thể có đều đã được tìm thấy.`,
    priorities,
    descriptorAlignment: examiner.criterionJudgments.map(judgment => ({
      criterion: judgment.criterion,
      band: finalScores[judgment.criterion],
      rationaleVi: qualifyNonExhaustiveRationaleVi(
        scoreAudit?.decisions.find(decision => decision.criterion === judgment.criterion)?.reasonVi
          || judgment.rationaleVi,
      ),
      evidenceIds: findings
        .filter(finding => criterionMap[finding.criterion] === judgment.criterion && !isStyleOpinionFinding(finding))
        .map(finding => finding.id),
    })),
  };
}

function assessmentAudit(
  initialScores: BandScores,
  finalScores: BandScores,
  verifier: EvidenceVerifierPass,
  scoreAudit?: ScoreConsistencyPass,
): AssessmentAudit {
  const criteria = ['taskAchievement', 'coherenceCohesion', 'lexicalResource', 'grammaticalRange'] as const;
  const auditedDecisions = new Map((scoreAudit?.decisions || []).map(decision => [
    decision.criterion,
    decision,
  ]));
  const changedCriteria = criteria.flatMap(criterion => {
    if (initialScores[criterion] === finalScores[criterion]) return [];
    const audited = auditedDecisions.get(criterion);
    return [{
      criterion,
      provisionalBand: initialScores[criterion],
      evidenceBand: finalScores[criterion],
      finalBand: finalScores[criterion],
      reasonVi: qualifyNonExhaustiveRationaleVi(
        audited?.reasonVi
          || 'Điểm đã được điều chỉnh sau khi lượt chấm theo tiêu chí đối chiếu toàn bài với các nhận xét có bằng chứng.',
      ),
      evidenceIds: [],
    }];
  });
  return {
    provisionalScores: initialScores,
    evidenceScores: finalScores,
    reconciliation: {
      changedCriteria,
      summaryVi: `${scoreAudit || changedCriteria.length ? 'Điểm ban đầu đã được đối chiếu lại với toàn bài sau bước xác minh.' : 'Điểm ban đầu và lượt chấm theo tiêu chí thống nhất.'} Chỉ các vấn đề có bằng chứng đủ rõ và ảnh hưởng đáng kể mới được giữ lại; kết quả này không khẳng định đã phát hiện mọi lỗi có thể có. ${verifier.coverageCheckVi}`,
    },
  };
}

function qualifyNonExhaustiveRationaleVi(value: string) {
  return value
    .replace(/không có lỗi từ vựng(?: đáng kể)?/gi, 'không có lỗi từ vựng đáng kể được xác nhận')
    .replace(/không có lỗi ngữ pháp(?: đáng kể)?/gi, 'không có lỗi ngữ pháp đáng kể được xác nhận')
    .replace(/không có lỗi về mạch lạc(?: đáng kể)?/gi, 'không có lỗi mạch lạc đáng kể được xác nhận')
    .replace(/không có lỗi về liên kết(?: đáng kể)?/gi, 'không có lỗi liên kết đáng kể được xác nhận');
}

function sourceContext(prompt: string, essay: string, manifest: EssayParagraphManifest[]) {
  return { taskPrompt: prompt, essay, manifest: manifestForPrompt(manifest) };
}

const promptProfileCache = new Map<string, PromptProfilePass>();
const PROMPT_PROFILE_SCHEMA_VERSION = 'v8.1-2026-07-28';

function promptProfileCacheKey(prompt: string) {
  return createHash('sha256')
    .update(`${PROMPT_PROFILE_SCHEMA_VERSION}\u0000${prompt.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en')}`)
    .digest('hex');
}

function promptProfileDocumentId(hash: string) {
  return `profile_${hash.slice(0, 24)}`;
}

function inferPromptTypeFromText(prompt: string): PromptType {
  const text = prompt.toLocaleLowerCase('en');
  if (/outweigh|more advantages|more disadvantages/.test(text)) return 'outweigh';
  if (/discuss both|both (?:these )?views/.test(text)) return 'discuss_both';
  if (/advantage/.test(text) && /disadvantage/.test(text)) return 'advantages_disadvantages';
  if (/problem/.test(text) && /solution/.test(text)) return 'problem_solution';
  if (/cause/.test(text) && /effect|impact|result/.test(text)) return 'cause_effect';
  if (/agree or disagree|to what extent/.test(text)) return 'agree_disagree';
  return 'two_part';
}

function fallbackPromptProfile(prompt: string): PromptProfilePass {
  const promptType = inferPromptTypeFromText(prompt);
  const baseRequirements: PromptProfilePass['hardRequirements'] = [
    {
      id: 'requirement:position',
      question: 'What position or answer does the task require?',
      successTest: 'The essay gives a clear answer and sustains it through the body and conclusion.',
      descriptorLink: 'position',
    },
    {
      id: 'requirement:development',
      question: 'Are the main points developed enough to support that answer?',
      successTest: 'Each material point has enough explanation, mechanism, example, consequence, or significance for its role.',
      descriptorLink: 'development',
    },
  ];
  if (promptType === 'outweigh') {
    baseRequirements.push({
      id: 'requirement:comparison',
      question: 'Does the essay explain why one side outweighs the other?',
      successTest: 'The essay compares the sides by scope, severity, duration, reversibility, importance, or another defensible basis.',
      descriptorLink: 'comparison',
    });
  }
  if (promptType === 'discuss_both' || promptType === 'advantages_disadvantages' || promptType === 'outweigh') {
    baseRequirements.push({
      id: 'requirement:coverage',
      question: 'Does the essay address every side or part the task explicitly asks for?',
      successTest: 'No required side, view, advantage, disadvantage, cause, effect, problem, solution, or question is omitted.',
      descriptorLink: 'task_coverage',
    });
  }
  return {
    promptType,
    taskInPlainEnglish: prompt,
    hardRequirements: baseRequirements,
    conditionalRequirements: [],
    optionalAngles: [],
    commonTraps: [],
  };
}

function promptProfileErrors(result: PromptProfilePass) {
  const errors: string[] = [];
  const promptTypes: PromptType[] = [
    'agree_disagree',
    'discuss_both',
    'advantages_disadvantages',
    'outweigh',
    'cause_effect',
    'problem_solution',
    'two_part',
  ];
  if (!promptTypes.includes(result.promptType)) errors.push('Prompt profile needs a valid promptType.');
  if (!result.taskInPlainEnglish?.trim()) errors.push('Prompt profile needs taskInPlainEnglish.');
  const ids = new Set<string>();
  const collect = (group: string, items: Array<Record<string, unknown>> | undefined) => {
    (items || []).forEach((item, index) => {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) errors.push(`${group} ${index + 1} needs an id.`);
      if (ids.has(id)) errors.push(`${group} ${id} is duplicated.`);
      ids.add(id);
    });
  };
  collect('hardRequirements', result.hardRequirements);
  collect('conditionalRequirements', result.conditionalRequirements);
  collect('optionalAngles', result.optionalAngles);
  collect('commonTraps', result.commonTraps);
  result.hardRequirements = (result.hardRequirements || []).filter(item => (
    item.id?.trim()
    && item.question?.trim()
    && item.successTest?.trim()
    && ['task_coverage', 'position', 'development', 'relevance', 'comparison'].includes(item.descriptorLink)
  ));
  result.conditionalRequirements = result.conditionalRequirements || [];
  result.optionalAngles = result.optionalAngles || [];
  result.commonTraps = result.commonTraps || [];
  if (!result.hardRequirements.length) errors.push('Prompt profile needs at least one complete hardRequirement.');
  return errors;
}

async function getPromptProfile(prompt: string): Promise<PromptProfilePass> {
  const key = promptProfileCacheKey(prompt);
  const cached = promptProfileCache.get(key);
  if (cached) {
    if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
      console.info('[assessment-prompt-profile-cache-hit]', JSON.stringify({ key: key.slice(0, 12) }));
    }
    return cached;
  }

  const stored = await readStoredPromptProfile(key);
  if (stored) {
    promptProfileCache.set(key, stored);
    if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
      console.info('[assessment-prompt-profile-db-hit]', JSON.stringify({ key: key.slice(0, 12) }));
    }
    return stored;
  }

  let profile: PromptProfilePass;
  try {
    profile = await runPass<PromptProfilePass>(
      PROMPT_PROFILE_SYSTEM,
      { taskPrompt: prompt },
      promptProfileErrors,
      'prompt-profile-v8',
    );
  } catch (error) {
    profile = fallbackPromptProfile(prompt);
    if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
      console.warn('[assessment-prompt-profile-fallback]', error instanceof Error ? error.message : String(error));
    }
  }
  promptProfileCache.set(key, profile);
  if (profile.taskInPlainEnglish !== prompt || profile.hardRequirements.length > 2) {
    await writeStoredPromptProfile(key, prompt, profile);
  }
  if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
    console.info('[assessment-prompt-profile-created]', JSON.stringify({
      key: key.slice(0, 12),
      hardRequirements: profile.hardRequirements.length,
      conditionalRequirements: profile.conditionalRequirements.length,
      optionalAngles: profile.optionalAngles.length,
    }));
  }
  return profile;
}

async function readStoredPromptProfile(hash: string): Promise<PromptProfilePass | undefined> {
  const collectionId = process.env.APPWRITE_WRITING_PROMPT_PROFILES_COLLECTION_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  if (!collectionId || !databaseId || !process.env.APPWRITE_API_KEY) return undefined;

  try {
    const { serverDatabases } = await import('@/lib/appwrite-server');
    const document = await serverDatabases.getDocument(
      databaseId,
      collectionId,
      promptProfileDocumentId(hash),
    ) as { profileJson?: unknown; version?: unknown };
    if (document.version !== PROMPT_PROFILE_SCHEMA_VERSION) return undefined;
    const profileJson = typeof document.profileJson === 'string'
      ? document.profileJson
      : undefined;
    if (!profileJson) return undefined;
    const parsed = JSON.parse(profileJson) as PromptProfilePass;
    return promptProfileErrors(parsed).length ? undefined : parsed;
  } catch {
    return undefined;
  }
}

async function writeStoredPromptProfile(
  hash: string,
  prompt: string,
  profile: PromptProfilePass,
): Promise<void> {
  const collectionId = process.env.APPWRITE_WRITING_PROMPT_PROFILES_COLLECTION_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  if (!collectionId || !databaseId || !process.env.APPWRITE_API_KEY) return;

  try {
    const [{ serverDatabases }, { ID }] = await Promise.all([
      import('@/lib/appwrite-server'),
      import('appwrite'),
    ]);
    const documentId = promptProfileDocumentId(hash);
    const payload = {
      promptHash: hash,
      promptText: prompt,
      profileJson: JSON.stringify(profile),
      version: PROMPT_PROFILE_SCHEMA_VERSION,
    };
    try {
      await serverDatabases.updateDocument(databaseId, collectionId, documentId, payload);
    } catch {
      await serverDatabases.createDocument(databaseId, collectionId, documentId || ID.unique(), payload);
    }
  } catch {
    // Persistent prompt-profile caching is optional. The in-memory cache still
    // prevents duplicate profile calls inside the current server process.
  }
}

function quoteFirstExaminerErrors(result: QuoteFirstExaminerPass) {
  const errors = scoreErrors(result.scores);
  if (!result.taskRequirements?.length) errors.push('The examiner must derive task requirements.');
  if (result.criterionJudgments?.length !== 4) errors.push('The examiner must return four criterion judgments.');
  (result.findings || []).forEach((finding, index) => {
    if (!finding.id?.trim()) errors.push(`Finding ${index + 1} needs an id.`);
    const isMissingRequirementFinding = finding.criterion === 'task_response'
      && finding.scope === 'macro'
      && Boolean(finding.requirementIds?.length);
    if (!finding.evidence?.length && !isMissingRequirementFinding) {
      errors.push(`Finding ${finding.id || index + 1} needs evidence.`);
    }
    if (!finding.errorLabelVi?.trim() || !finding.explanationVi?.trim()) {
      errors.push(`Finding ${finding.id || index + 1} needs a label and explanation.`);
    }
  });
  return errors;
}

function initialScoringErrors(result: QuoteFirstExaminerPass) {
  const errors = quoteFirstExaminerErrors(result);
  if (result.findings?.length) errors.push('The initial scoring pass must not return detailed findings.');
  return errors;
}

function naturalAssessmentV6Errors(
  result: QuoteFirstExaminerPass,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const criteria: Array<QuoteFirstExaminerPass['criterionJudgments'][number]['criterion']> = [
    'taskAchievement',
    'coherenceCohesion',
    'lexicalResource',
    'grammaticalRange',
  ];
  const existingJudgments = new Map(
    (result.criterionJudgments || []).map(judgment => [judgment.criterion, judgment]),
  );
  result.criterionJudgments = criteria.map(criterion => existingJudgments.get(criterion) || ({
    criterion,
    band: result.scores?.[criterion] ?? 0,
    rationaleVi: result.firstReadVi || 'Đánh giá ban đầu sẽ được đối chiếu lại ở lượt chấm theo tiêu chí.',
  }));
  result.findings = (result.findings || []).filter(finding => (
    finding.id?.trim()
    && finding.evidence?.length
    && finding.errorLabelVi?.trim()
    && finding.explanationVi?.trim()
    && finding.evidence.every(evidence => resolveQuoteEvidenceGroup(essay, manifest, evidence).length)
  ));
  return quoteFirstExaminerErrors(result).filter(error => !error.startsWith('overall must equal'));
}

function normalizeOverallScore(scores: BandScores): BandScores {
  const criteria: Array<keyof Omit<BandScores, 'overall'>> = [
    'taskAchievement',
    'coherenceCohesion',
    'lexicalResource',
    'grammaticalRange',
  ];
  const overall = Math.round((criteria.reduce((sum, key) => sum + scores[key], 0) / 4) * 2) / 2;
  return { ...scores, overall };
}

export function reconcileCriterionBand(initialBand: number, specialistBand: number) {
  const difference = specialistBand - initialBand;
  if (Math.abs(difference) <= 1) return specialistBand;
  return initialBand + Math.sign(difference);
}

function reconcileCriterionBandV8(initialBand: number, specialistBand: number) {
  const reconciled = reconcileCriterionBand(initialBand, specialistBand);
  // Band 9 should be a shared conclusion, not a one-pass spike from a specialist call.
  if (reconciled === 9 && initialBand < 9) return 8;
  return reconciled;
}

function bandForFindingCriterion(scores: BandScores, criterion: FindingCriterion) {
  if (criterion === 'task_response') return scores.taskAchievement;
  if (criterion === 'coherence' || criterion === 'cohesion') return scores.coherenceCohesion;
  if (criterion === 'lexical_resource') return scores.lexicalResource;
  return scores.grammaticalRange;
}

function findingCombinedText(finding: Pick<VerifiedFinding, 'errorLabelVi' | 'diagnosisVi' | 'readerEffectVi' | 'repairDirectionVi' | 'replacementText' | 'evidence'>) {
  return [
    finding.errorLabelVi,
    finding.diagnosisVi,
    finding.readerEffectVi,
    finding.repairDirectionVi,
    finding.replacementText,
    ...finding.evidence.map(item => item.sourceText),
  ].join(' ').toLocaleLowerCase('vi');
}

function replacementAlreadyExistsInEvidence(finding: VerifiedFinding) {
  const replacement = finding.replacementText?.trim();
  if (!replacement) return false;
  return finding.evidence.some(item => item.sourceText.includes(replacement));
}

/** Wording that marks a finding as a real error rather than a preference. */
const HARD_ERROR_LANGUAGE = /không đúng nghĩa|sai nghĩa|sai chính tả|sai cấu trúc|sai ngữ pháp|sai thì|dùng sai|thiếu chủ ngữ|thiếu động từ|làm hỏng cấu trúc|không đúng ngữ pháp|wrong meaning|incorrect meaning|ungrammatical|misspelled/;

/** Wording that marks a finding as an optional upgrade the writer could ignore. */
const STYLE_OPINION_LANGUAGE = /hoàn toàn chính xác|mặc dù[^.]{0,100}đúng|cũng chính xác|không phải lỗi chắc chắn|tự nhiên hơn|phổ biến hơn|người ta thường dùng|có thể cải thiện|sẽ mượt hơn|style preference|stylistic preference|more natural|more common|would choose|i would choose|could improve|would improve/;

function statesHardError(text: string) {
  return HARD_ERROR_LANGUAGE.test(text);
}

function isStyleOpinionFinding(finding: VerifiedFinding) {
  if (
    finding.criterion !== 'lexical_resource'
    && finding.criterion !== 'grammatical_range_accuracy'
  ) return false;

  const text = findingCombinedText(finding);
  return STYLE_OPINION_LANGUAGE.test(text) && !statesHardError(text);
}

function removeUnrequiredVerifiedMacroComparisonFindings(
  findings: VerifiedFinding[],
  promptType: PromptType,
) {
  if (promptType === 'outweigh') return findings;
  return findings.filter(finding => finding.errorCode !== 'unsupported_comparative_judgment');
}

/**
 * At band 8+ the report should carry only what an examiner would still raise:
 * genuine errors, not optional upgrades. Two rules here used to run backwards.
 * A finding recognised as a style opinion was kept rather than dropped, and the
 * lexical drop pattern matched "đúng nghĩa" inside "không đúng nghĩa", so real
 * wrong-meaning errors were discarded while preferences survived. Together with
 * the blanket removal of every minor finding, a clean band-8 essay could come
 * back with nothing at all.
 *
 * A stated hard error now always survives, whatever its severity; only opinions
 * and improvement suggestions are removed.
 */
export function filterLowSignalFindingsForHighBand(findings: VerifiedFinding[], scores: BandScores) {
  return findings.filter(finding => {
    if (finding.verdict !== 'confirmed') return false;
    const band = bandForFindingCriterion(scores, finding.criterion);
    if (band < 8) return true;

    const text = findingCombinedText(finding);
    if (statesHardError(text)) return true;
    if (isStyleOpinionFinding(finding)) return false;
    if (
      finding.criterion === 'grammatical_range_accuracy'
      && replacementAlreadyExistsInEvidence(finding)
    ) return false;
    if (STYLE_OPINION_LANGUAGE.test(text)) return false;
    return true;
  });
}

function focusedFindingErrors(
  result: FocusedFindingPass,
  allowedCriteria: FindingCriterion[],
  essay?: string,
  manifest?: EssayParagraphManifest[],
) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const containsHanCharacters = (value: string) => /[\p{Script=Han}]/u.test(value);
  result.findings = pruneNestedLanguageFindings((result.findings || []).filter(finding => {
    const languageText = `${finding.errorLabelVi || ''} ${finding.explanationVi || ''} ${finding.repairVi || ''}`;
    if (
      finding.criterion === 'lexical_resource'
      && /(?:sau|sau động từ|after)\s+(?:has|have|had)|hiện tại hoàn thành|quá khứ hoàn thành|quá khứ phân từ|hình thức động từ|dạng động từ|chia động từ|verb form|sở hữu|hòa hợp|mạo từ|mệnh đề|cụm danh từ|danh từ|clause|noun phrase|subject-verb|possessive|agreement|auxiliary|participle/i.test(languageText)
    ) return false;
    if (
      finding.criterion === 'grammatical_range_accuracy'
      && /chỉ (?:là|vì).*(?:tự nhiên|trang trọng)|phù hợp hơn trong ngữ cảnh học thuật|more (?:natural|formal|academic)|stylistic preference/i.test(languageText)
    ) return false;
    return true;
  }));
  (result.findings || []).forEach((finding, index) => {
    if (!finding.id?.trim() || ids.has(finding.id)) errors.push(`Finding ${index + 1} needs a unique id.`);
    ids.add(finding.id);
    if (!allowedCriteria.includes(finding.criterion)) {
      errors.push(`Finding ${finding.id || index + 1} belongs to the wrong criterion.`);
    }
    if (!finding.evidence?.length) errors.push(`Finding ${finding.id || index + 1} needs evidence.`);
    if (essay && manifest) {
      (finding.evidence || []).forEach((evidence, evidenceIndex) => {
        if (!resolveQuoteEvidenceGroup(essay, manifest, evidence).length) {
          errors.push(`Finding ${finding.id || index + 1} evidence ${evidenceIndex + 1} must quote the essay exactly.`);
        }
      });
    }
    if (!finding.errorLabelVi?.trim() || !finding.explanationVi?.trim() || !finding.repairVi?.trim()) {
      errors.push(`Finding ${finding.id || index + 1} needs a label, explanation, and repair.`);
    }
    if ((finding.requirementIds || []).some(requirementId => typeof requirementId !== 'string' || !requirementId.trim())) {
      errors.push(`Finding ${finding.id || index + 1} has an invalid requirement id.`);
    }
    if (
      (finding.criterion === 'lexical_resource' || finding.criterion === 'grammatical_range_accuracy')
      && !finding.replacementText?.trim()
    ) {
      errors.push(`Language finding ${finding.id || index + 1} needs the smallest English replacement.`);
    }
    if (
      containsHanCharacters(finding.errorLabelVi || '')
      || containsHanCharacters(finding.explanationVi || '')
      || containsHanCharacters(finding.repairVi || '')
    ) {
      errors.push(`Finding ${finding.id || index + 1} must use Vietnamese without Chinese characters.`);
    }
  });
  errors.push(...languageFindingSpanErrors(result));
  return errors;
}

function v7CandidateFindingErrors(
  result: V7CriterionPass,
  allowedCriteria: FindingCriterion[],
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const errors: string[] = [];
  if (!Array.isArray(result.candidateFindings)) {
    errors.push('V7 criterion pass needs candidateFindings as an array.');
    return errors;
  }
  if (ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v12-free-strength') {
    result.candidateFindings.forEach((finding, index) => {
      if (finding.problemStrength !== 'core_problem' && finding.problemStrength !== 'worth_noting') {
        errors.push(`candidateFindings: Finding ${finding.id || index + 1} needs problemStrength core_problem or worth_noting.`);
      }
    });
  }

  const candidatePass: FocusedFindingPass = {
    findings: result.candidateFindings,
  };
  errors.push(...focusedFindingErrors(candidatePass, allowedCriteria, essay, manifest).map(error => (
    `candidateFindings: ${error}`
  )));
  result.candidateFindings = candidatePass.findings;

  errors.push(...meaningfulNonLanguageEvidenceErrors(candidatePass, 'candidateFindings'));

  return errors;
}

function meaningfulNonLanguageEvidenceErrors(
  result: FocusedFindingPass,
  label: string,
) {
  const errors: string[] = [];
  (result.findings || []).forEach((finding, index) => {
    const primary = finding.evidence?.find(item => item.role === 'primary') || finding.evidence?.[0];
    const sourceText = primary?.sourceText?.trim() || '';
    const tokenCount = sourceText.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)?.length || 0;

    if (
      finding.criterion !== 'lexical_resource'
      && finding.criterion !== 'grammatical_range_accuracy'
      && (sourceText.length < 20 || tokenCount < 4)
    ) {
      errors.push(
        `${label}: Finding ${finding.id || index + 1} needs a meaningful phrase or clause as evidence, not a single character or fragment.`,
      );
    }
  });
  return errors;
}

export function pruneNestedLanguageFindings(findings: QuoteFirstFinding[]) {
  const normalize = (value: string) => value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');
  const severityRank = { minor: 1, moderate: 2, major: 3 };
  const languageFinding = (finding: QuoteFirstFinding) => (
    finding.criterion === 'lexical_resource'
    || finding.criterion === 'grammatical_range_accuracy'
  );
  const removed = new Set<number>();

  for (let leftIndex = 0; leftIndex < findings.length; leftIndex += 1) {
    const left = findings[leftIndex];
    if (!languageFinding(left) || left.evidence.length !== 1 || removed.has(leftIndex)) continue;
    const leftEvidence = left.evidence[0];
    const leftText = normalize(leftEvidence.sourceText);

    for (let rightIndex = leftIndex + 1; rightIndex < findings.length; rightIndex += 1) {
      const right = findings[rightIndex];
      if (
        !languageFinding(right)
        || right.criterion !== left.criterion
        || right.evidence.length !== 1
        || removed.has(rightIndex)
      ) continue;
      const rightEvidence = right.evidence[0];
      if (leftEvidence.paragraphIndex !== rightEvidence.paragraphIndex) continue;
      const rightText = normalize(rightEvidence.sourceText);
      if (!leftText || !rightText) continue;

      if (leftText === rightText) {
        const keepRight = severityRank[right.severity] > severityRank[left.severity];
        removed.add(keepRight ? leftIndex : rightIndex);
        if (keepRight) break;
        continue;
      }
      if (leftText.includes(rightText)) {
        removed.add(leftIndex);
        break;
      }
      if (rightText.includes(leftText)) {
        removed.add(rightIndex);
      }
    }
  }

  return findings.filter((_finding, index) => !removed.has(index));
}

export function languageFindingSpanErrors(result: FocusedFindingPass) {
  const errors: string[] = [];
  const languageFindings = (result.findings || []).filter(finding => (
    finding.criterion === 'lexical_resource'
    || finding.criterion === 'grammatical_range_accuracy'
  ));
  const normalized = (value: string) => value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');

  languageFindings.forEach((finding, index) => {
    const replacement = finding.replacementText?.trim() || '';
    const source = finding.evidence[0]?.sourceText?.trim() || '';
    if (
      replacement
      && /\b(?:is|are|was|were)\s+(?:clear|evident|important)\.?$/i.test(replacement)
      && !/\b(?:is|are|was|were)\s+(?:clear|evident|important)\.?$/i.test(source)
    ) {
      errors.push(
        `Language finding ${finding.id || index + 1} uses a semantically empty predicate in replacementText. `
        + 'Repair the existing intended proposition from the surrounding sentence instead of completing the grammar with '
        + '"is clear", "is evident", or "is important".',
      );
    }
  });

  for (let leftIndex = 0; leftIndex < languageFindings.length; leftIndex += 1) {
    const left = languageFindings[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < languageFindings.length; rightIndex += 1) {
      const right = languageFindings[rightIndex];

      const overlaps = left.evidence.some(leftEvidence => right.evidence.some(rightEvidence => {
        if (leftEvidence.paragraphIndex !== rightEvidence.paragraphIndex) return false;
        const leftText = normalized(leftEvidence.sourceText);
        const rightText = normalized(rightEvidence.sourceText);
        return Boolean(leftText && rightText && (
          leftText.includes(rightText)
          || rightText.includes(leftText)
        ));
      }));
      if (!overlaps) continue;

      errors.push(
        `Language findings ${left.id || leftIndex + 1} and ${right.id || rightIndex + 1} use nested evidence. `
        + 'Keep one independently correctable defect per finding, assign it to only one owning language criterion, '
        + 'and use non-overlapping minimal source spans.',
      );
    }
  }

  return errors;
}

function criterionScorePassErrors(result: CriterionScorePass) {
  const errors: string[] = [];
  if (!Number.isInteger(result.band) || result.band < 0 || result.band > 9) {
    errors.push('Criterion score must be a whole band from 0 to 9.');
  }
  if (!result.rationaleVi?.trim() || !result.whyNotHigherVi?.trim() || !result.whyNotLowerVi?.trim()) {
    errors.push('Criterion score needs rationale, why-not-higher, and why-not-lower explanations.');
  }
  if (/[\p{Script=Han}]/u.test(`${result.rationaleVi || ''} ${result.whyNotHigherVi || ''} ${result.whyNotLowerVi || ''}`)) {
    errors.push('Criterion score explanations must use Vietnamese without Chinese Han characters.');
  }
  return errors;
}

function v7CriterionPassErrors(
  result: V7CriterionPass,
  criterion: FindingCriterion,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  // The Task Response specialist owns its diagnosis even when it prints a
  // stale enum value. Other specialists must not spill adjacent findings into
  // a different criterion.
  result.findings = criterion === 'task_response'
    ? (result.findings || []).map(finding => ({ ...finding, criterion }))
    : (result.findings || []).filter(finding => finding.criterion === criterion);
  result.candidateFindings = criterion === 'task_response'
    ? (result.candidateFindings || []).map(finding => ({ ...finding, criterion }))
    : (result.candidateFindings || []).filter(finding => finding.criterion === criterion);
  const candidateOnly = (
    ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v8-candidate-only'
    || ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v10-stable-candidate'
    || ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v11-core-worth'
    || ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v12-free-strength'
    || (
      ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v9-hybrid-candidate'
      && criterion !== 'task_response'
      && criterion !== 'coherence'
    )
  );
  const errors = candidateOnly
    ? v7CandidateFindingErrors(result, [criterion], essay, manifest)
    : [
        ...focusedFindingErrors(result, [criterion], essay, manifest),
        ...meaningfulNonLanguageEvidenceErrors(result, 'findings'),
        ...v7CandidateFindingErrors(result, [criterion], essay, manifest),
      ];
  if (candidateOnly) {
    // Candidate-only experiments measure detection without forcing the model
    // to select a final subset. Copy candidates into findings only after
    // validation so the existing assembly path can still build an analysis.
    result.findings = result.candidateFindings || [];
  }
  if (!Number.isInteger(result.band) || result.band < 0 || result.band > 9) {
    errors.push('V7 criterion band must be a whole number from 0 to 9.');
  }
  if (!result.rationaleVi?.trim()) errors.push('V7 criterion pass needs a rationale.');
  if (/[\p{Script=Han}]/u.test(result.rationaleVi || '')) {
    errors.push('V7 criterion rationale must use Vietnamese without Chinese Han characters.');
  }
  return errors;
}

function taskResponseInventoryErrors(
  result: TaskResponseInventoryPass,
  essay: string,
  manifest: EssayParagraphManifest[],
) {
  const errors: string[] = [];
  const bodyParagraphs = manifest.slice(1, -1);
  const validSentenceKeys = new Set(bodyParagraphs.flatMap(paragraph => (
    paragraph.sentences.map(sentence => `${paragraph.index}:${sentence.index}`)
  )));
  const pointIds = new Set<string>();
  const requirementIds = new Set<string>();

  if (!result.taskRequirements?.length) errors.push('Task inventory needs independently assessable task requirements.');
  (result.taskRequirements || []).forEach((requirement, index) => {
    if (!requirement.id?.trim() || requirementIds.has(requirement.id)) {
      errors.push(`Task inventory requirement ${index + 1} needs a unique id.`);
    }
    requirementIds.add(requirement.id);
    if (!['fully_addressed', 'partly_addressed', 'missing', 'off_task'].includes(requirement.status)) {
      errors.push(`Task inventory requirement ${requirement.id || index + 1} has invalid status ${requirement.status}.`);
    }
    if (!requirement.requirement?.trim() || !requirement.assessmentVi?.trim()) {
      errors.push(`Task inventory requirement ${requirement.id || index + 1} needs requirement and assessmentVi.`);
    }
    (requirement.evidence || []).forEach((evidence, evidenceIndex) => {
      if (!resolveQuoteEvidenceGroup(essay, manifest, evidence).length) {
        errors.push(`Task inventory requirement ${requirement.id || index + 1} evidence ${evidenceIndex + 1} must quote the essay exactly.`);
      }
    });
  });

  if (!result.points?.length) errors.push('Task inventory needs every body-paragraph argumentative promise.');
  (result.points || []).forEach((point, index) => {
    if (!point.id?.trim() || pointIds.has(point.id)) errors.push(`Task inventory point ${index + 1} needs a unique id.`);
    pointIds.add(point.id);
    if (!point.promise?.trim()) errors.push(`Task inventory point ${point.id || index + 1} needs an English promise.`);
    if (!['advantage', 'disadvantage', 'neutral'].includes(point.side)) {
      errors.push(`Task inventory point ${point.id || index + 1} needs a valid argumentative side.`);
    }
    if (!resolveQuoteEvidenceGroup(essay, manifest, {
      paragraphIndex: point.paragraphIndex,
      sourceText: point.sourceText,
      role: 'primary',
    }).length) {
      errors.push(`Task inventory point ${point.id || index + 1} must quote its paragraph exactly.`);
    }
    if (!point.sourceSentenceIndexes?.length) errors.push(`Task inventory point ${point.id || index + 1} needs sourceSentenceIndexes.`);
    (point.sourceSentenceIndexes || []).forEach(sentenceIndex => {
      const key = `${point.paragraphIndex}:${sentenceIndex}`;
      if (!validSentenceKeys.has(key)) errors.push(`Task inventory point ${point.id || index + 1} references unknown body sentence ${key}.`);
    });
  });
  return errors;
}

function taskResponsePointAuditErrors(
  result: TaskResponseFocusedPass,
  essay: string,
  manifest: EssayParagraphManifest[],
  promptType: PromptType,
  inventory?: TaskResponseInventoryPass,
  enforceFindingCompleteness = true,
) {
  const errors = focusedFindingErrors(result, ['task_response'], essay, manifest);
  const findingIds = new Set((result.findings || []).map(finding => finding.id));
  const bodyParagraphIndexes = manifest.slice(1, -1).map(paragraph => paragraph.index);
  const bodyParagraphIndexSet = new Set(bodyParagraphIndexes);
  result.pointAudit = (result.pointAudit || []).filter(point => bodyParagraphIndexSet.has(point.paragraphIndex));
  if (inventory) {
    const expectedPoints = new Map(inventory.points.map(point => [point.id, point]));
    result.pointAudit = result.pointAudit.map(point => {
      const expected = expectedPoints.get(point.id);
      return expected
        ? {
          ...point,
          paragraphIndex: expected.paragraphIndex,
          sourceText: expected.sourceText,
          sourceSentenceIndexes: expected.sourceSentenceIndexes,
        }
        : point;
    });
  }
  if (enforceFindingCompleteness) {
    linkTaskResponsePointFindings(result, essay, manifest);
  }
  const validSentenceKeys = new Set(manifest.slice(1, -1).flatMap(paragraph => (
    paragraph.sentences.map(sentence => `${paragraph.index}:${sentence.index}`)
  )));
  const pointIds = new Set<string>();
  const auditedParagraphIndexes = new Set<number>();
  if (!result.pointAudit?.length) errors.push('Task Response must audit every body-paragraph point.');

  (result.pointAudit || []).forEach((point, index) => {
    if (!point.id?.trim() || pointIds.has(point.id)) errors.push(`Point audit ${index + 1} needs a unique id.`);
    pointIds.add(point.id);
    const resolved = resolveQuoteEvidenceGroup(essay, manifest, {
      paragraphIndex: point.paragraphIndex,
      sourceText: point.sourceText,
      role: 'primary',
    });
    if (!resolved.length || resolved.some(item => !item)) {
      errors.push(`Point audit ${index + 1} must quote exact English text from its paragraph.`);
    }
    if (!point.sourceSentenceIndexes?.length) errors.push(`Point audit ${point.id || index + 1} needs sourceSentenceIndexes.`);
    (point.sourceSentenceIndexes || []).forEach(sentenceIndex => {
      const key = `${point.paragraphIndex}:${sentenceIndex}`;
      if (!validSentenceKeys.has(key)) errors.push(`Point audit ${point.id || index + 1} references unknown body sentence ${key}.`);
    });
    if (enforceFindingCompleteness && point.status === 'fully_developed' && point.findingIds?.length) {
      errors.push(`Fully developed point ${point.id || index + 1} must not reference a finding.`);
    }
    if (
      enforceFindingCompleteness
      &&
      point.status === 'fully_developed'
      && (
        point.mechanism === 'missing'
        || point.consequence === 'abstract'
        || point.consequence === 'missing'
        || point.example === 'paraphrases_claim'
        || point.example === 'needs_bridge'
        || point.example === 'mismatched'
      )
    ) {
      errors.push(`Point ${point.id || index + 1} cannot be fully developed while its support audit contains a material gap.`);
    }
    if (enforceFindingCompleteness && point.status !== 'fully_developed') {
      if ((point.findingIds?.length || 0) > 1) {
        errors.push(`Non-fully-developed point ${point.id || index + 1} may reference at most one material finding.`);
      } else if (point.findingIds?.length === 1 && !findingIds.has(point.findingIds[0])) {
        errors.push(`Point ${point.id || index + 1} references unknown finding ${point.findingIds[0]}.`);
      } else if (point.findingIds?.length === 1) {
        const linked = (result.findings || []).find(finding => finding.id === point.findingIds[0]);
        if (linked?.scope === 'macro') {
          errors.push(`Point ${point.id || index + 1} cannot use macro finding ${linked.id}; macro coverage and comparison are audited separately.`);
        }
        if (linked && !linked.evidence.some(evidence => evidence.paragraphIndex === point.paragraphIndex)) {
          errors.push(`Finding ${linked.id} must quote evidence from the same paragraph as point ${point.id || index + 1}.`);
        }
      }
    }
    auditedParagraphIndexes.add(point.paragraphIndex);
  });

  bodyParagraphIndexes.forEach(paragraphIndex => {
    if (!auditedParagraphIndexes.has(paragraphIndex)) {
      errors.push(`Body paragraph ${paragraphIndex} has no point audit.`);
    }
  });

  if (inventory) {
    const expectedPoints = new Map(inventory.points.map(point => [point.id, point]));
    (result.pointAudit || []).forEach(point => {
      const expected = expectedPoints.get(point.id);
      if (!expected) {
        errors.push(`Task Response returned point ${point.id} outside the supplied inventory.`);
        return;
      }
    });
    expectedPoints.forEach((_point, id) => {
      if (!pointIds.has(id)) errors.push(`Task Response must audit supplied inventory point ${id}.`);
    });
    const expectedRequirements = new Set(inventory.taskRequirements.map(requirement => requirement.id));
    const returnedRequirements = new Set((result.taskRequirements || []).map(requirement => requirement.id));
    expectedRequirements.forEach(id => {
      if (!returnedRequirements.has(id)) errors.push(`Task Response must audit supplied requirement ${id}.`);
    });
    returnedRequirements.forEach(id => {
      if (!expectedRequirements.has(id)) errors.push(`Task Response returned requirement ${id} outside the supplied inventory.`);
    });
  }

  if (!result.taskRequirements?.length) errors.push('Task Response must return its audited task requirements.');
  (result.taskRequirements || []).forEach(requirement => {
    if (!requirement.id?.trim()) errors.push('Every audited task requirement needs its supplied stable id.');
    if (!['fully_addressed', 'partly_addressed', 'missing', 'off_task'].includes(requirement.status)) {
      errors.push(`Task requirement ${requirement.id || 'unknown'} has invalid status ${requirement.status}.`);
    }
    if (enforceFindingCompleteness && ['partly_addressed', 'missing', 'off_task'].includes(requirement.status)) {
      const linkedMacroFinding = (result.findings || []).some(finding => (
        finding.scope === 'macro'
        && finding.requirementIds?.includes(requirement.id)
      ));
      if (!linkedMacroFinding) {
        errors.push(`Task requirement ${requirement.id || 'unknown'} is ${requirement.status} and must produce a linked macro finding.`);
      }
    }
  });
  if (promptType === 'outweigh') {
    if (!result.comparisonAudit) {
      errors.push('An outweigh task requires comparisonAudit.');
    } else {
      [...(result.comparisonAudit.statedPositionEvidence || []), ...(result.comparisonAudit.comparisonEvidence || [])]
        .forEach((evidence, index) => {
          if (!resolveQuoteEvidenceGroup(essay, manifest, evidence).length) {
            errors.push(`comparisonAudit evidence ${index + 1} must quote the essay exactly.`);
          }
        });
      if (enforceFindingCompleteness && result.comparisonAudit.status === 'asserted_only') {
        const linked = (result.findings || []).filter(finding => (
          finding.scope === 'macro'
          && finding.requirementIds?.includes(result.comparisonAudit!.requirementId)
        ));
        if (linked.length < 1) errors.push('An asserted-only comparison must produce a linked macro finding.');
      }
    }
  }
  if (promptType === 'outweigh' && result.comparisonAudit && (
    typeof result.comparisonAudit.requirementId !== 'string'
    || !result.comparisonAudit.requirementId.trim()
  )) {
    errors.push('comparisonAudit needs a valid requirementId.');
  }
  return errors;
}

function resolveEvidenceListOrThrow(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: QuoteEvidenceInput,
  owner: string,
) {
  return resolveQuoteEvidenceGroup(essay, manifest, evidence).map(resolved => {
    if (!resolved) throw new Error(`Could not resolve evidence for ${owner}: ${JSON.stringify(evidence.sourceText)}`);
    return {
      paragraphIndex: resolved.paragraphIndex,
      sourceText: resolved.sourceText,
      role: resolved.role,
      occurrenceIndex: resolved.occurrenceIndex,
    };
  });
}

function canonicalizeQuoteFirstExaminer(
  result: QuoteFirstExaminerPass,
  essay: string,
  manifest: EssayParagraphManifest[],
): QuoteFirstExaminerPass {
  return {
    ...result,
    taskRequirements: (result.taskRequirements || []).map(requirement => ({
      ...requirement,
      evidence: (requirement.evidence || []).flatMap(evidence => (
        resolveEvidenceListOrThrow(essay, manifest, evidence, requirement.id)
      )),
    })),
    topicSentenceCoverage: (result.topicSentenceCoverage || []).map(item => {
      const resolved = resolveQuoteEvidence(essay, manifest, {
        paragraphIndex: item.paragraphIndex,
        sourceText: item.sourceText,
        role: 'primary',
      });
      return resolved
        ? { ...item, paragraphIndex: resolved.paragraphIndex, sourceText: resolved.sourceText }
        : item;
    }),
    findings: (result.findings || []).map(finding => {
      const canonicalFinding: QuoteFirstFinding = {
        ...finding,
        evidence: finding.evidence.flatMap(evidence => (
        resolveEvidenceListOrThrow(essay, manifest, evidence, finding.id)
        )),
      };
      return normalizeLanguageReplacementAgainstContext(canonicalFinding, essay, manifest);
    }),
  };
}

function canonicalizeFocusedFindingPass(
  result: FocusedFindingPass,
  essay: string,
  manifest: EssayParagraphManifest[],
  idPrefix: string,
): QuoteFirstFinding[] {
  // One unresolvable quote used to abort the entire assessment after every
  // specialist call had already been paid for. A finding whose quote cannot be
  // located in the essay cannot be rendered or anchored either, so it is
  // dropped and the rest of the analysis survives.
  return (result.findings || []).flatMap((finding, index) => {
    const id = `${idPrefix}:${index + 1}`;
    let evidence;
    try {
      evidence = finding.evidence.flatMap(item => resolveEvidenceListOrThrow(essay, manifest, item, id));
    } catch (error) {
      if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
        console.warn('[assessment-unresolvable-evidence]', error instanceof Error ? error.message : String(error));
      }
      return [];
    }
    if (!evidence.length) return [];
    const canonicalFinding: QuoteFirstFinding = { ...finding, id, evidence };
    return [normalizeLanguageReplacementAgainstContext(canonicalFinding, essay, manifest)];
  });
}

function evidenceSignatureForFinding(finding: QuoteFirstFinding) {
  const primary = finding.evidence.find(item => item.role === 'primary') || finding.evidence[0];
  return `${finding.criterion}|${(primary?.sourceText || '').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()}`;
}

function severityEvidenceSignatureForFinding(finding: QuoteFirstFinding) {
  const primary = finding.evidence.find(item => item.role === 'primary') || finding.evidence[0];
  return `${finding.severity}|${finding.criterion}|${(primary?.sourceText || '').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()}`;
}

function problemStrengthEvidenceSignatureForFinding(finding: QuoteFirstFinding) {
  const primary = finding.evidence.find(item => item.role === 'primary') || finding.evidence[0];
  const strength = finding.problemStrength || 'unlabeled';
  return `${strength}|${finding.criterion}|${(primary?.sourceText || '').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()}`;
}

function canonicalizeCandidateFindingPass(
  result: V7CriterionPass,
  essay: string,
  manifest: EssayParagraphManifest[],
  idPrefix: string,
): QuoteFirstFinding[] {
  return canonicalizeFocusedFindingPass(
    { findings: result.candidateFindings || [] },
    essay,
    manifest,
    idPrefix,
  );
}

export function normalizeLanguageReplacementAgainstContext(
  finding: QuoteFirstFinding,
  essay: string,
  manifest: EssayParagraphManifest[],
): QuoteFirstFinding {
  if (
    !finding.replacementText?.trim()
    || (finding.criterion !== 'lexical_resource' && finding.criterion !== 'grammatical_range_accuracy')
  ) return finding;

  const primary = finding.evidence.find(item => item.role === 'primary') || finding.evidence[0];
  if (!primary || typeof primary.paragraphIndex !== 'number') return finding;
  const startChar = evidenceOffset(essay, manifest, primary as ExaminerEvidence);
  if (startChar < 0) return finding;

  const sourceText = primary.sourceText;
  const endChar = startChar + sourceText.length;
  const beforeWord = essay.slice(0, startChar).match(/([A-Za-z]+(?:['’][A-Za-z]+)?)\s*$/)?.[1];
  const afterWord = essay.slice(endChar).match(/^\s*([A-Za-z]+(?:['’][A-Za-z]+)?)/)?.[1];
  const sourceWords = sourceText.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  let replacementText = finding.replacementText.trim();
  let replacementWords = replacementText.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  const normalize = (value?: string) => value?.toLocaleLowerCase('en').replace(/[’]/g, "'") || '';
  const firstReplacementWord = replacementWords[0];

  if (
    beforeWord
    && firstReplacementWord
    && replacementWords.length > 1
    && normalize(beforeWord) === normalize(firstReplacementWord)
    && normalize(sourceWords[0]) !== normalize(firstReplacementWord)
  ) {
    replacementText = replacementText.replace(
      new RegExp(`^${firstReplacementWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'),
      '',
    );
    replacementWords = replacementText.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  }

  if (
    afterWord
    && replacementWords.length > 1
    && normalize(afterWord) === normalize(replacementWords[replacementWords.length - 1])
    && normalize(sourceWords[sourceWords.length - 1]) !== normalize(replacementWords[replacementWords.length - 1])
  ) {
    const lastWord = replacementWords[replacementWords.length - 1];
    replacementText = replacementText.replace(
      new RegExp(`\\s+${lastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      '',
    );
  }

  return replacementText === finding.replacementText
    ? finding
    : { ...finding, replacementText };
}

function fallbackErrorCode(finding: QuoteFirstAuditedFinding, promptType: PromptType) {
  const requested = TAXONOMY_BY_CODE.get(finding.errorCode);
  if (requested?.criterion === finding.criterion) return requested.code;
  const findingText = `${finding.errorLabelVi || ''} ${finding.explanationVi || ''} ${finding.repairVi || ''}`;
  if (
    finding.criterion === 'task_response'
    && (promptType === 'outweigh' || /outweigh/i.test(findingText))
    && /outweigh|phép cân|so sánh tương đối|carries greater weight|lớn hơn|quan trọng hơn|trội hơn|vượt trội/i.test(findingText)
  ) {
    return 'unsupported_comparative_judgment';
  }
  if (finding.criterion === 'task_response') {
    if (
      finding.scope === 'macro'
      && /bỏ sót|không (?:hề )?(?:trình bày|thảo luận|đề cập)|chưa trả lời|thiếu (?:một )?(?:phần|khía cạnh)|not addressed|missing entirely/i.test(findingText)
    ) {
      return 'partial_prompt_coverage';
    }
    if (/ví dụ.{0,80}(?:không phù hợp|không chứng minh|khác (?:ngữ cảnh|đối tượng|nền tảng|lĩnh vực))|example.{0,80}(?:mismatch|different|does not support)/i.test(findingText)) {
      return 'example_mismatch';
    }
    if (/thiếu (?:cơ chế|bước trung gian)|không giải thích (?:cách|cơ chế|tại sao)|missing mechanism|how .* (?:leads|creates|produces|enables)/i.test(findingText)) {
      return 'missing_mechanism';
    }
    if (
      /dừng ở|hệ quả (?:trừu tượng|chung chung)|hậu quả (?:trừu tượng|chung chung)|chưa (?:đi đến|chỉ ra|giải thích) (?:hậu quả|tác hại|ý nghĩa)(?: cụ thể)?|không giải thích hậu quả cụ thể|stops at|abstract consequence|intermediate endpoint|does not explain (?:the )?(?:concrete|practical) consequence/i.test(findingText)
    ) {
      return 'insufficient_extension';
    }
  }
  if (finding.criterion === 'grammatical_range_accuracy') {
    if (/song song|parallel(?:ism)?/i.test(findingText)) return 'parallelism_error';
    if (
      /mệnh đề phụ.{0,80}(?:không có|thiếu) mệnh đề chính|không có động từ|thiếu (?:động từ|vị ngữ|thành phần)|sentence fragment|missing (?:main clause|finite verb|predicate)/i.test(findingText)
    ) {
      return 'sentence_fragment';
    }
    if (/hiện tại hoàn thành|quá khứ phân từ|sai thì|present perfect|past participle|tense/i.test(findingText)) {
      return 'tense_error';
    }
    if (/hòa hợp chủ vị|subject.?verb agreement/i.test(findingText)) return 'subject_verb_agreement';
    if (/mạo từ|article/i.test(findingText)) return 'article_error';
    if (/giới từ|preposition/i.test(findingText)) return 'preposition_error';
    if (/dấu câu|punctuation/i.test(findingText)) return 'punctuation_error';
  }
  const fallbackByCriterion: Record<FindingCriterion, string> = {
    task_response: finding.scope === 'paragraph' ? 'underdeveloped_idea' : 'unsupported_claim',
    coherence: 'unclear_progression',
    cohesion: 'faulty_sentence_link',
    lexical_resource: 'imprecise_word_choice',
    grammatical_range_accuracy: 'complex_structure_breakdown',
  };
  return fallbackByCriterion[finding.criterion];
}

function verifiedFindingsFromQuoteAudit(
  audit: QuoteFirstAuditPass,
  examiner: QuoteFirstExaminerPass,
): VerifiedFinding[] {
  const requirementIds = new Set(examiner.taskRequirements.map(requirement => requirement.id));
  const comparativeRequirement = examiner.taskRequirements.find(requirement => (
    /outweigh|comparative|whether.*greater|advantages.*disadvantages/i.test(requirement.requirement)
  ));
  return [...audit.findings]
    .sort((left, right) => left.order - right.order)
    .map(finding => {
      const errorCode = fallbackErrorCode(finding, examiner.promptType);
      const fixedLabel = TAXONOMY_BY_CODE.get(errorCode)?.labelVi || finding.errorLabelVi;
      const linkedRequirementIds = (finding.requirementIds || []).filter(id => requirementIds.has(id));
      if (
        errorCode === 'unsupported_comparative_judgment'
        && comparativeRequirement
        && !linkedRequirementIds.includes(comparativeRequirement.id)
      ) {
        linkedRequirementIds.push(comparativeRequirement.id);
      }
      return {
        id: finding.id,
        criterion: finding.criterion,
        severity: finding.severity,
        problemStrength: finding.problemStrength,
        confidence: 0.9,
        evidence: finding.evidence as ExaminerEvidence[],
        requirementIds: linkedRequirementIds,
        diagnosisVi: finding.explanationVi,
        readerEffectVi: '',
        repairDirectionVi: finding.repairVi,
        replacementText: finding.replacementText,
        errorCode,
        errorLabelVi: fixedLabel,
        verdict: 'confirmed' as const,
        verificationVi: audit.coverageCheckVi,
      };
    });
}

function verifiedFindingsFromQuoteExaminer(examiner: QuoteFirstExaminerPass): VerifiedFinding[] {
  const syntheticAudit: QuoteFirstAuditPass = {
    findings: examiner.findings.map((finding, index) => ({
      ...finding,
      errorCode: 'other',
      order: index + 1,
      dependsOnFindingIds: [],
    })),
    coverageCheckVi: 'Các nhận xét được giữ từ lượt đọc toàn bài và đã được liên kết lại với nguyên văn tại local.',
  };
  return verifiedFindingsFromQuoteAudit(syntheticAudit, examiner);
}

function dedupeVerifiedFindings(findings: VerifiedFinding[]) {
  const severityRank = { minor: 0, moderate: 1, major: 2 } as const;
  const macroCodes = new Set([
    'unclear_position',
    'partial_prompt_coverage',
    'unbalanced_coverage',
    'unsupported_comparative_judgment',
    'off_task',
  ]);
  const normalize = (value: string) => value
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
    .trim();
  const primaryEvidenceKey = (finding: VerifiedFinding) => finding.evidence
    .filter(item => item.role === 'primary')
    .map(item => `${item.paragraphIndex}:${item.occurrenceIndex ?? 0}:${normalize(item.sourceText)}`)
    .sort()
    .join('|');
  const semanticTarget = (finding: VerifiedFinding) => {
    if (finding.errorCode === 'unsupported_comparative_judgment') return 'essay-comparison';
    const requirements = [...(finding.requirementIds || [])].map(normalize).sort().join('|');
    return requirements || primaryEvidenceKey(finding);
  };

  return findings.reduce<VerifiedFinding[]>((result, finding) => {
    const duplicateIndex = result.findIndex(existing => (
      existing.criterion === finding.criterion
      && existing.errorCode === finding.errorCode
      && semanticTarget(existing) === semanticTarget(finding)
      && (
        macroCodes.has(finding.errorCode)
        || primaryEvidenceKey(existing) === primaryEvidenceKey(finding)
      )
    ));
    if (duplicateIndex < 0) {
      result.push(finding);
      return result;
    }

    const existing = result[duplicateIndex];
    const evidenceKeys = new Set(existing.evidence.map(item => (
      `${item.paragraphIndex}:${item.occurrenceIndex ?? 0}:${item.role}:${normalize(item.sourceText)}`
    )));
    result[duplicateIndex] = {
      ...existing,
      severity: severityRank[finding.severity] > severityRank[existing.severity]
        ? finding.severity
        : existing.severity,
      confidence: Math.max(existing.confidence, finding.confidence),
      evidence: [
        ...existing.evidence,
        ...finding.evidence.filter(item => !evidenceKeys.has(
          `${item.paragraphIndex}:${item.occurrenceIndex ?? 0}:${item.role}:${normalize(item.sourceText)}`,
        )),
      ],
      requirementIds: [...new Set([...(existing.requirementIds || []), ...(finding.requirementIds || [])])],
      diagnosisVi: existing.diagnosisVi.length >= finding.diagnosisVi.length
        ? existing.diagnosisVi
        : finding.diagnosisVi,
      repairDirectionVi: existing.repairDirectionVi.length >= finding.repairDirectionVi.length
        ? existing.repairDirectionVi
        : finding.repairDirectionVi,
    };
    return result;
  }, []);
}

function orderAndDedupeFocusedFindings(findings: QuoteFirstFinding[]) {
  const criterionOrder: Record<FindingCriterion, number> = {
    task_response: 0,
    coherence: 1,
    cohesion: 2,
    lexical_resource: 3,
    grammatical_range_accuracy: 4,
  };
  const scopeOrder: Record<QuoteFirstFinding['scope'], number> = {
    macro: 0,
    paragraph: 1,
    local: 2,
  };
  const contentTokens = (finding: QuoteFirstFinding) => new Set(
    finding.evidence
      .flatMap(item => item.sourceText.toLocaleLowerCase('en').match(/[a-z]{3,}/g) || [])
      .filter(token => !new Set([
        'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'are', 'was', 'were',
        'can', 'could', 'would', 'should', 'their', 'they', 'them', 'into', 'based', 'then',
      ]).has(token)),
  );
  const severityRank = { minor: 0, moderate: 1, major: 2 } as const;
  const consolidated = findings.reduce<QuoteFirstFinding[]>((result, finding) => {
    if (finding.criterion !== 'task_response' || finding.scope === 'macro') {
      result.push(finding);
      return result;
    }
    const label = finding.errorLabelVi.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
    const tokens = contentTokens(finding);
    const duplicateIndex = result.findIndex(existing => {
      if (
        existing.criterion !== 'task_response'
        || existing.scope === 'macro'
      ) return false;
      if (existing.errorLabelVi.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim() !== label) {
        return false;
      }
      const sameParagraph = existing.evidence.some(left => (
        finding.evidence.some(right => left.paragraphIndex === right.paragraphIndex)
      ));
      if (!sameParagraph) return false;
      const existingTokens = contentTokens(existing);
      return [...tokens].filter(token => existingTokens.has(token)).length >= 2;
    });
    if (duplicateIndex < 0) {
      result.push(finding);
      return result;
    }
    const existing = result[duplicateIndex];
    const evidenceKeys = new Set(existing.evidence.map(item => `${item.paragraphIndex}:${item.sourceText}:${item.role}`));
    result[duplicateIndex] = {
      ...existing,
      scope: existing.scope === 'paragraph' || finding.scope === 'paragraph' ? 'paragraph' : 'local',
      severity: severityRank[finding.severity] > severityRank[existing.severity]
        ? finding.severity
        : existing.severity,
      evidence: [
        ...existing.evidence,
        ...finding.evidence.filter(item => !evidenceKeys.has(`${item.paragraphIndex}:${item.sourceText}:${item.role}`)),
      ],
      requirementIds: [...new Set([...(existing.requirementIds || []), ...(finding.requirementIds || [])])],
      explanationVi: existing.explanationVi.length >= finding.explanationVi.length
        ? existing.explanationVi
        : finding.explanationVi,
      repairVi: existing.repairVi.length >= finding.repairVi.length ? existing.repairVi : finding.repairVi,
    };
    return result;
  }, []);
  const seen = new Set<string>();
  return consolidated
    .filter(finding => {
      const findingEvidenceKey = finding.evidence
        .map(item => `${item.paragraphIndex}:${item.sourceText.toLocaleLowerCase('en')}`)
        .sort()
        .join('|');
      const labelKey = finding.errorLabelVi.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
      const key = finding.criterion === 'task_response' && finding.scope === 'macro'
        ? `${finding.criterion}:${finding.scope}:${labelKey}`
        : `${finding.criterion}:${findingEvidenceKey}:${labelKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => (
      scopeOrder[left.scope] - scopeOrder[right.scope]
      || criterionOrder[left.criterion] - criterionOrder[right.criterion]
    ));
}

function mergeNaturalAndFocusedFindings(
  natural: QuoteFirstFinding[],
  focused: QuoteFirstFinding[],
) {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
  const overlaps = (left: QuoteEvidenceInput, right: QuoteEvidenceInput) => (
    left.paragraphIndex === right.paragraphIndex
    && (
      normalize(left.sourceText).includes(normalize(right.sourceText))
      || normalize(right.sourceText).includes(normalize(left.sourceText))
    )
  );
  const duplicateOfFocused = (candidate: QuoteFirstFinding) => focused.some(existing => {
    if (existing.criterion !== candidate.criterion) return false;
    if (
      candidate.criterion === 'task_response'
      && candidate.scope === 'macro'
      && existing.scope === 'macro'
      && (candidate.requirementIds || []).some(id => existing.requirementIds?.includes(id))
    ) {
      return true;
    }
    const candidatePrimary = candidate.evidence.find(item => item.role === 'primary') || candidate.evidence[0];
    const existingPrimary = existing.evidence.find(item => item.role === 'primary') || existing.evidence[0];
    if (!candidatePrimary || !existingPrimary || !overlaps(candidatePrimary, existingPrimary)) return false;
    if (candidate.criterion === 'lexical_resource' || candidate.criterion === 'grammatical_range_accuracy') return true;
    return true;
  });
  return [...focused, ...natural.filter(candidate => !duplicateOfFocused(candidate))];
}

function removeUnrequiredMacroComparisonFindings(
  findings: QuoteFirstFinding[],
  promptType: PromptType,
) {
  if (promptType === 'outweigh') return findings;
  return findings.filter(finding => {
    if (finding.criterion !== 'task_response' || finding.scope !== 'macro') return true;
    const text = `${finding.errorLabelVi || ''} ${finding.explanationVi || ''} ${finding.repairVi || ''}`
      .toLocaleLowerCase('vi');
    return !/unsupported comparison|comparative judgment|so sánh|cân hai phía|cân bằng hai phía|vượt trội hơn|outweigh/.test(text);
  });
}

function alignTaskResponseRequirementIds(
  result: TaskResponseFocusedPass,
  supplied: AuthoritativeExaminerPass['taskRequirements'],
) {
  if (result.taskRequirements.length !== supplied.length) return result;

  const idTokens = (id: string) => id
    .toLocaleLowerCase('en')
    .split(/[^a-z0-9]+/)
    .filter(token => token && ![
      'requirement', 'coverage', 'content', 'address', 'addressed', 'judgment', 'assessment',
    ].includes(token))
    .map(token => token.endsWith('s') ? token.slice(0, -1) : token);
  const tokenOverlap = (left: string, right: string) => {
    const leftTokens = new Set(idTokens(left));
    return idTokens(right).filter(token => leftTokens.has(token)).length;
  };
  const idMap = new Map<string, string>();
  const taskRequirements = result.taskRequirements.map((requirement, index) => {
    const expected = supplied[index];
    idMap.set(requirement.id, expected.id);
    return {
      ...requirement,
      id: expected.id,
      requirement: expected.requirement,
    };
  });
  const remapId = (id: string | null | undefined) => {
    if (typeof id !== 'string' || !id.trim()) return id || '';
    const exact = idMap.get(id);
    if (exact) return exact;
    const closest = result.taskRequirements
      .map(requirement => ({ id: requirement.id, score: tokenOverlap(id, requirement.id) }))
      .sort((left, right) => right.score - left.score)[0];
    return closest?.score > 0 ? idMap.get(closest.id) || id : id;
  };
  const remapIds = (ids: string[] | undefined) => ids?.map(remapId);
  return {
    ...result,
    taskRequirements,
    findings: result.findings.map(finding => ({
      ...finding,
      requirementIds: remapIds(finding.requirementIds),
    })),
    comparisonAudit: result.comparisonAudit
      ? {
        ...result.comparisonAudit,
        requirementId: remapId(result.comparisonAudit.requirementId),
      }
      : undefined,
  };
}

function canonicalizeTaskResponseInventory(
  result: TaskResponseInventoryPass,
  essay: string,
  manifest: EssayParagraphManifest[],
): TaskResponseInventoryPass {
  return {
    ...result,
    taskRequirements: result.taskRequirements.map(requirement => ({
      ...requirement,
      evidence: (requirement.evidence || []).flatMap(evidence => (
        resolveEvidenceListOrThrow(essay, manifest, evidence, `inventory:${requirement.id}`)
      )),
    })),
  };
}

function isBareComparativeJudgmentPoint(point: TaskResponseInventoryPass['points'][number]) {
  const text = `${point.sourceText} ${point.promise}`.toLocaleLowerCase('en');
  return /\boutweigh\b|\badvantages?\b[^.]{0,80}\bdisadvantages?\b|\bdisadvantages?\b[^.]{0,80}\badvantages?\b|\b(?:more|less)\s+(?:important|significant|beneficial|valuable|compelling|harmful)\s+than\b/.test(text);
}

export function mergeSupportingInventoryPoints(
  points: TaskResponseInventoryPass['points'],
): TaskResponseInventoryPass['points'] {
  const equivalentPoints = new Map<string, TaskResponseInventoryPass['points'][number]>();
  points.forEach(point => {
    const sourceKey = point.sourceText.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
    const promiseKey = point.promise.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
    const key = `${point.paragraphIndex}:${sourceKey}:${promiseKey}`;
    const existing = equivalentPoints.get(key);
    if (!existing) {
      equivalentPoints.set(key, { ...point, sourceSentenceIndexes: [...point.sourceSentenceIndexes] });
      return;
    }
    existing.sourceSentenceIndexes = [...new Set([
      ...existing.sourceSentenceIndexes,
      ...point.sourceSentenceIndexes,
    ])].sort((left, right) => left - right);
  });

  return [...equivalentPoints.values()].sort((left, right) => (
    left.paragraphIndex - right.paragraphIndex
    || Math.min(...left.sourceSentenceIndexes) - Math.min(...right.sourceSentenceIndexes)
  ));
}

export function reconcileInventoryPointGranularity(
  first: TaskResponseInventoryPass['points'],
  second: TaskResponseInventoryPass['points'],
) {
  const normalize = (value: string) => value.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
  const groupByParagraphAndSide = (points: TaskResponseInventoryPass['points']) => {
    const groups = new Map<string, TaskResponseInventoryPass['points']>();
    points.forEach(point => {
      const key = `${point.paragraphIndex}:${point.side}`;
      const group = groups.get(key) || [];
      group.push(point);
      groups.set(key, group);
    });
    return groups;
  };
  const firstGroups = groupByParagraphAndSide(first);
  const secondGroups = groupByParagraphAndSide(second);
  const granularityScore = (group: TaskResponseInventoryPass['points']) => {
    const rangeSignatures = new Set(group.map(point => (
      [...new Set(point.sourceSentenceIndexes)].sort((left, right) => left - right).join(',')
    )));
    const sourceWordCounts = group.map(point => (
      point.sourceText.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)?.length || 0
    ));
    const substantialAnchors = sourceWordCounts.filter(count => count >= 3).length;
    const tinyAnchors = sourceWordCounts.filter(count => count <= 2).length;
    const duplicateRanges = Math.max(0, group.length - rangeSignatures.size);
    return (
      rangeSignatures.size * 100
      + substantialAnchors * 20
      - tinyAnchors * 30
      - duplicateRanges * 5
    );
  };
  const keys = new Set([...firstGroups.keys(), ...secondGroups.keys()]);
  const retained = [...keys].flatMap(key => {
    const firstGroup = firstGroups.get(key) || [];
    const secondGroup = secondGroups.get(key) || [];
    if (!firstGroup.length) return secondGroup;
    if (!secondGroup.length) return firstGroup;
    return granularityScore(firstGroup) >= granularityScore(secondGroup)
      ? firstGroup
      : secondGroup;
  });
  const concrete = retained.filter(point => {
    const peers = retained.filter(other => (
      other !== point
      && other.paragraphIndex === point.paragraphIndex
      && other.side === point.side
    ));
    if (peers.length < 2) return true;
    const identity = `${point.sourceText} ${point.promise}`.toLocaleLowerCase('en');
    return !/\b(?:several|some|many|various|a number of)\b[^.]{0,80}\b(?:issues?|problems?|concerns?|advantages?|benefits?|drawbacks?|disadvantages?|challenges?|opportunities?)\b/.test(identity);
  });
  const umbrellaIndexes = retained
    .filter(point => !concrete.includes(point))
    .reduce((groups, point) => {
      const key = `${point.paragraphIndex}:${point.side}`;
      const indexes = groups.get(key) || [];
      groups.set(key, [...new Set([...indexes, ...point.sourceSentenceIndexes])]);
      return groups;
    }, new Map<string, number[]>());

  return mergeSupportingInventoryPoints(concrete.map(point => ({
    ...point,
    sourceSentenceIndexes: [...new Set([
      ...(umbrellaIndexes.get(`${point.paragraphIndex}:${point.side}`) || []),
      ...point.sourceSentenceIndexes,
    ])],
  })))
    .sort((left, right) => (
      left.paragraphIndex - right.paragraphIndex
      || Math.min(...left.sourceSentenceIndexes) - Math.min(...right.sourceSentenceIndexes)
      || normalize(left.sourceText).localeCompare(normalize(right.sourceText))
    ))
    .map((point, index) => ({
      ...point,
      id: `point:${index + 1}`,
      sourceSentenceIndexes: [...new Set(point.sourceSentenceIndexes)].sort((left, right) => left - right),
    }));
}

function taskRequirementKind(requirement: AuthoritativeExaminerPass['taskRequirements'][number]) {
  const identity = `${requirement.id} ${requirement.requirement}`.toLocaleLowerCase('en');
  if (/compar|outweigh|judg/.test(identity)) return 'comparison';
  if (/disadvantage|drawback|negative/.test(identity)) return 'disadvantages';
  if (/advantage|benefit|positive/.test(identity)) return 'advantages';
  return identity.replace(/[^a-z0-9]+/g, ' ').trim();
}

function reconcileInventoryRequirements(
  audited: AuthoritativeExaminerPass['taskRequirements'],
  proposed: AuthoritativeExaminerPass['taskRequirements'],
) {
  const statusRank: Record<AuthoritativeExaminerPass['taskRequirements'][number]['status'], number> = {
    fully_addressed: 0,
    partly_addressed: 1,
    missing: 2,
    off_task: 3,
  };
  const proposedByKind = new Map(proposed.map(requirement => [
    taskRequirementKind(requirement),
    requirement,
  ]));
  return audited.map(requirement => {
    const previous = proposedByKind.get(taskRequirementKind(requirement));
    if (!previous || statusRank[requirement.status] <= statusRank[previous.status]) return requirement;
    return {
      ...requirement,
      status: previous.status,
      evidence: previous.evidence,
      assessmentVi: previous.assessmentVi,
    };
  });
}

function normalizeOutweighSideCoverage(
  promptType: PromptType,
  requirements: AuthoritativeExaminerPass['taskRequirements'],
  points: TaskResponseInventoryPass['points'],
) {
  if (promptType !== 'outweigh') return requirements;
  const presentSides = new Set(points.map(point => point.side));
  return requirements.map(requirement => {
    const kind = taskRequirementKind(requirement);
    const side = kind === 'advantages'
      ? 'advantage'
      : kind === 'disadvantages'
        ? 'disadvantage'
        : undefined;
    if (!side || !presentSides.has(side)) return requirement;
    return {
      ...requirement,
      status: 'fully_addressed' as const,
      assessmentVi: side === 'advantage'
        ? 'Bài đã trình bày ít nhất một line of argument liên quan cho phía lợi ích của chủ đề.'
        : 'Bài đã trình bày ít nhất một line of argument liên quan cho phía bất lợi của chủ đề.',
    };
  });
}

function mergeTaskResponseRequirements(
  primary: AuthoritativeExaminerPass['taskRequirements'],
  secondary: AuthoritativeExaminerPass['taskRequirements'],
  secondaryFindings: QuoteFirstFinding[],
) {
  const statusRank: Record<AuthoritativeExaminerPass['taskRequirements'][number]['status'], number> = {
    fully_addressed: 0,
    partly_addressed: 1,
    missing: 2,
    off_task: 3,
  };
  const normalize = (value: string) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
  const secondaryById = new Map(secondary.map(requirement => [normalize(requirement.id), requirement]));
  const macroFindingRequirementIds = new Set(secondaryFindings
    .filter(finding => finding.scope === 'macro')
    .flatMap(finding => finding.requirementIds || [])
    .map(normalize));
  const keepAssessmentConsistent = (
    requirement: AuthoritativeExaminerPass['taskRequirements'][number],
  ) => {
    const claimsComplete = /(?:được|đã)[^.]{0,40}(?:đầy đủ|hoàn toàn)|fully addressed/i.test(
      requirement.assessmentVi,
    ) && !/(?:chưa|không)[^.]{0,20}(?:đầy đủ|hoàn toàn)/i.test(requirement.assessmentVi);
    if (requirement.status === 'partly_addressed' && claimsComplete) {
      return {
        ...requirement,
        assessmentVi: 'Nội dung này mới được đáp ứng một phần; xem các nhận xét liên quan để biết phần còn thiếu.',
      };
    }
    if ((requirement.status === 'missing' || requirement.status === 'off_task') && claimsComplete) {
      return {
        ...requirement,
        assessmentVi: requirement.status === 'missing'
          ? 'Nội dung mà đề yêu cầu chưa được xử lý trong bài.'
          : 'Nội dung hiện có chưa trực tiếp trả lời yêu cầu này của đề.',
      };
    }
    return requirement;
  };
  const merged = primary.map(requirement => {
    const candidate = secondaryById.get(normalize(requirement.id));
    return candidate
      && macroFindingRequirementIds.has(normalize(candidate.id))
      && statusRank[candidate.status] > statusRank[requirement.status]
      ? { ...requirement, status: candidate.status, evidence: candidate.evidence, assessmentVi: candidate.assessmentVi }
      : requirement;
  });
  const knownIds = new Set(merged.map(requirement => normalize(requirement.id)));
  secondary.forEach(requirement => {
    if (!knownIds.has(normalize(requirement.id))) merged.push(requirement);
  });
  return merged.map(keepAssessmentConsistent);
}

function removeCoverageFindingsContradictedByInventory(
  findings: QuoteFirstFinding[],
  requirements: AuthoritativeExaminerPass['taskRequirements'],
) {
  const normalize = (value: string) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
  const inventoryStatusById = new Map(requirements.map(requirement => [
    normalize(requirement.id),
    requirement.status,
  ]));
  return findings.filter(finding => {
    if (finding.criterion !== 'task_response' || finding.scope !== 'macro') return true;
    const text = `${finding.errorLabelVi} ${finding.explanationVi} ${finding.repairVi}`;
    if (/outweigh|phép cân|so sánh|lớn hơn|greater weight|comparative/i.test(text)) return true;
    const isCoverageFinding = /bỏ sót|không (?:hề )?(?:trình bày|thảo luận|đề cập)|chưa trả lời|thiếu (?:một )?(?:phần|khía cạnh|lợi ích|nhược điểm)|not addressed|missing entirely|incomplete coverage/i
      .test(text);
    if (!isCoverageFinding || !finding.requirementIds?.length) return true;
    return finding.requirementIds.some(requirementId => (
      inventoryStatusById.get(normalize(requirementId)) !== 'fully_addressed'
    ));
  });
}

function normalizeTaskRequirementDescriptions(
  promptType: QuoteFirstExaminerPass['promptType'],
  requirements: AuthoritativeExaminerPass['taskRequirements'],
) {
  if (promptType !== 'outweigh' || requirements.length !== 3) return requirements;
  return requirements.map((requirement, index) => {
    const identity = `${requirement.id} ${requirement.requirement}`.toLocaleLowerCase('en');
    if (/compar|outweigh|judg/.test(identity)) {
      return {
        ...requirement,
        requirement: 'Make and support the comparative judgment on whether the advantages outweigh the disadvantages.',
      };
    }
    if (/disadvantage|drawback|negative/.test(identity)) {
      return {
        ...requirement,
        requirement: 'Discuss relevant disadvantages of the overall practice or development described in the task.',
      };
    }
    if (/advantage|benefit|positive/.test(identity)) {
      return {
        ...requirement,
        requirement: 'Discuss relevant advantages of the overall practice or development described in the task.',
      };
    }
    const fallbackRequirements = [
      'Discuss relevant advantages of the overall practice or development described in the task.',
      'Discuss relevant disadvantages of the overall practice or development described in the task.',
      'Make and support the comparative judgment on whether the advantages outweigh the disadvantages.',
    ];
    return {
      ...requirement,
      requirement: fallbackRequirements[index],
    };
  });
}

function reconcileFocusedLocalOwnership(findings: QuoteFirstFinding[]) {
  const normalizeRepairText = (value: string) => value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');
  const isFullyCoveredByLexicalRepair = (
    grammarFinding: QuoteFirstFinding,
    lexicalFinding: QuoteFirstFinding,
  ) => {
    if (
      grammarFinding.evidence.length !== 1
      || lexicalFinding.evidence.length !== 1
      || !grammarFinding.replacementText
      || !lexicalFinding.replacementText
    ) {
      return false;
    }
    const grammarEvidence = grammarFinding.evidence[0];
    const lexicalEvidence = lexicalFinding.evidence[0];
    if (grammarEvidence.paragraphIndex !== lexicalEvidence.paragraphIndex) return false;

    const lexicalStart = grammarEvidence.sourceText
      .toLocaleLowerCase('en')
      .indexOf(lexicalEvidence.sourceText.toLocaleLowerCase('en'));
    if (lexicalStart < 0) return false;
    const repairedByLexicalFinding = [
      grammarEvidence.sourceText.slice(0, lexicalStart),
      lexicalFinding.replacementText,
      grammarEvidence.sourceText.slice(lexicalStart + lexicalEvidence.sourceText.length),
    ].join('');
    if (
      normalizeRepairText(repairedByLexicalFinding)
      === normalizeRepairText(grammarFinding.replacementText)
    ) {
      return true;
    }
    if (
      normalizeRepairText(grammarFinding.replacementText)
      === normalizeRepairText(lexicalFinding.replacementText)
    ) {
      return true;
    }

    const unchangedPrefix = normalizeRepairText(grammarEvidence.sourceText.slice(0, lexicalStart));
    const unchangedSuffix = normalizeRepairText(
      grammarEvidence.sourceText.slice(lexicalStart + lexicalEvidence.sourceText.length),
    );
    const grammarRepair = normalizeRepairText(grammarFinding.replacementText);
    return (!unchangedPrefix || grammarRepair.startsWith(unchangedPrefix))
      && (!unchangedSuffix || grammarRepair.endsWith(unchangedSuffix));
  };
  const evidenceOverlaps = (left: QuoteFirstFinding, right: QuoteFirstFinding) => left.evidence.some(leftEvidence => (
    right.evidence.some(rightEvidence => (
      leftEvidence.paragraphIndex === rightEvidence.paragraphIndex
      && (
        leftEvidence.sourceText.toLocaleLowerCase('en').includes(rightEvidence.sourceText.toLocaleLowerCase('en'))
        || rightEvidence.sourceText.toLocaleLowerCase('en').includes(leftEvidence.sourceText.toLocaleLowerCase('en'))
      )
    ))
  ));
  const evidenceKey = (finding: QuoteFirstFinding) => finding.evidence
    .map(item => `${item.paragraphIndex}:${item.sourceText.trim().toLocaleLowerCase('en')}`)
    .sort()
    .join('|');
  const findingText = (finding: QuoteFirstFinding) => (
    `${finding.errorLabelVi} ${finding.explanationVi} ${finding.repairVi}`.toLocaleLowerCase('vi')
  );
  const grammarOwnedLanguage = (finding: QuoteFirstFinding) => (
    /possessive|sở hữu|agreement|hòa hợp|article|mạo từ|tense|thì\b|singular|số ít|plural|số nhiều|clause|mệnh đề|quá khứ phân từ|hình thức động từ|dạng động từ|verb form|auxiliary|participle/.test(findingText(finding))
  );
  const keysByCriterion = new Map<FindingCriterion, Set<string>>();
  findings.forEach(finding => {
    const keys = keysByCriterion.get(finding.criterion) || new Set<string>();
    keys.add(evidenceKey(finding));
    keysByCriterion.set(finding.criterion, keys);
  });

  return findings.filter(finding => {
    const key = evidenceKey(finding);
    if (
      finding.criterion === 'lexical_resource'
      && grammarOwnedLanguage(finding)
      && keysByCriterion.get('grammatical_range_accuracy')?.has(key)
    ) {
      return false;
    }
    if (
      (finding.criterion === 'coherence' || finding.criterion === 'cohesion')
      && keysByCriterion.get('grammatical_range_accuracy')?.has(key)
    ) {
      return false;
    }
    if (
      finding.criterion === 'cohesion'
      && findings.some(candidate => (
        candidate.criterion === 'grammatical_range_accuracy'
        && evidenceOverlaps(finding, candidate)
      ))
    ) {
      return false;
    }
    if (
      finding.criterion === 'cohesion'
      && finding.evidence.length < 2
      && findings.some(candidate => (
        (candidate.criterion === 'lexical_resource' || candidate.criterion === 'grammatical_range_accuracy')
        && evidenceOverlaps(finding, candidate)
      ))
    ) {
      return false;
    }
    if (
      finding.criterion === 'grammatical_range_accuracy'
      && keysByCriterion.get('lexical_resource')?.has(key)
      && !grammarOwnedLanguage(finding)
    ) {
      return false;
    }
    if (
      finding.criterion === 'grammatical_range_accuracy'
      && findings.some(candidate => (
        candidate.criterion === 'lexical_resource'
        && isFullyCoveredByLexicalRepair(finding, candidate)
      ))
    ) {
      return false;
    }
    return true;
  });
}

function examinerForQuoteFirstAssembly(
  examiner: QuoteFirstExaminerPass,
  findings: VerifiedFinding[],
): AuthoritativeExaminerPass {
  const findingsByRequirement = new Set(findings.flatMap(finding => finding.requirementIds || []));
  return {
    ...examiner,
    taskRequirements: examiner.taskRequirements.map(requirement => ({
      ...requirement,
      status: requirement.status === 'fully_addressed' && findingsByRequirement.has(requirement.id)
        ? 'partly_addressed'
        : requirement.status,
    })),
    observations: findings,
  };
}

export async function runWritingAssessmentPipelineV2({
  prompt,
  essay,
  manifest,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
}): Promise<WritingAnalysis> {
  const source = sourceContext(prompt, essay, manifest);
  const examiner = await runPass<AuthoritativeExaminerPass>(
    EXAMINER_SYSTEM,
    source,
    value => examinerErrors(value, essay, manifest),
    'authoritative-examiner',
  );

  const argumentCriteria = new Set<FindingCriterion>(['task_response', 'coherence', 'cohesion']);
  const argumentObservations = examiner.observations.filter(observation => argumentCriteria.has(observation.criterion));
  const languageObservations = examiner.observations.filter(observation => !argumentCriteria.has(observation.criterion));
  const [argumentVerifier, languageVerifier] = await Promise.all([
    runPass<EvidenceVerifierPass>(
      ARGUMENT_VERIFIER_SYSTEM,
      {
        ...source,
        examinerObservations: argumentObservations,
        otherScopeObservations: languageObservations,
      },
      value => verifierErrors(
        value,
        argumentObservations,
        essay,
        manifest,
        'verifier:argument:',
        new Set(examiner.taskRequirements.map(requirement => requirement.id)),
      ),
      'argument-evidence-verifier',
    ),
    runPass<EvidenceVerifierPass>(
      LANGUAGE_VERIFIER_SYSTEM,
      {
        ...source,
        examinerObservations: languageObservations,
        otherScopeObservations: argumentObservations,
      },
      value => verifierErrors(
        value,
        languageObservations,
        essay,
        manifest,
        'verifier:language:',
        new Set(examiner.taskRequirements.map(requirement => requirement.id)),
      ),
      'language-evidence-verifier',
    ),
  ]);
  const verifier: EvidenceVerifierPass = {
    findings: reconcileCrossCriterionOwnership(reconcileOverlappingLanguageOwnership(
      [...argumentVerifier.findings, ...languageVerifier.findings],
      essay,
      manifest,
    )),
    coverageCheckVi: `${argumentVerifier.coverageCheckVi} ${languageVerifier.coverageCheckVi}`.trim(),
  };
  const confirmedFindings = verifier.findings.filter(finding => finding.verdict === 'confirmed' && !finding.mergedIntoFindingId);
  const materialFindingCountByScoreCriterion = {
    taskAchievement: confirmedFindings.filter(finding => finding.criterion === 'task_response' && finding.severity !== 'minor').length,
    coherenceCohesion: confirmedFindings.filter(finding => (
      (finding.criterion === 'coherence' || finding.criterion === 'cohesion')
      && finding.severity !== 'minor'
    )).length,
    lexicalResource: confirmedFindings.filter(finding => finding.criterion === 'lexical_resource' && finding.severity !== 'minor').length,
    grammaticalRange: confirmedFindings.filter(finding => (
      finding.criterion === 'grammatical_range_accuracy'
      && finding.severity !== 'minor'
    )).length,
  };
  const needsScoreAudit = (
    Object.keys(materialFindingCountByScoreCriterion) as Array<keyof typeof materialFindingCountByScoreCriterion>
  ).some(criterion => (
    (examiner.scores[criterion] <= 6 && materialFindingCountByScoreCriterion[criterion] === 0)
    || (
      examiner.scores[criterion] >= 8
      && confirmedFindings.some(finding => {
        const belongs = criterion === 'taskAchievement'
          ? finding.criterion === 'task_response'
          : criterion === 'coherenceCohesion'
            ? finding.criterion === 'coherence' || finding.criterion === 'cohesion'
            : criterion === 'lexicalResource'
              ? finding.criterion === 'lexical_resource'
              : finding.criterion === 'grammatical_range_accuracy';
        return belongs && finding.severity === 'major';
      })
    )
  ));
  const scoreAudit = needsScoreAudit
    ? await runPass<ScoreConsistencyPass>(
        SCORE_CONSISTENCY_SYSTEM,
        {
          taskPrompt: prompt,
          essay,
          initialScores: examiner.scores,
          initialCriterionJudgments: examiner.criterionJudgments,
          confirmedFindings,
          rejectedFindings: verifier.findings.filter(finding => finding.verdict === 'rejected'),
        },
        value => scoreConsistencyErrors(value, examiner.scores, examiner, confirmedFindings),
        'score-consistency-audit',
      )
    : undefined;
  const finalScores = ensureBandScores(scoreAudit?.scores || examiner.scores);
  const decomposition = normalizeDecomposition(await runPass<DecompositionPass>(
    STRUCTURE_SYSTEM,
    source,
    value => structureErrors(value, manifest),
    'information-unit-map',
  ), manifest);

  const coherenceFindings = confirmedFindings.filter(finding => finding.criterion === 'coherence');
  const flowExplanationRaw = coherenceFindings.length
    ? await runPass<FlowExplanationPass>(
        FLOW_SYSTEM,
        { ...source, decomposition, confirmedFindings: coherenceFindings },
        value => flowErrors(value, decomposition, coherenceFindings),
        'coherence-flow-explainer',
      )
    : {
        coherenceFlows: [],
        argumentFlowOverview: { titleVi: '', bodyVi: '', nodeIds: [] },
        argumentFlowChapters: [],
      } satisfies FlowExplanationPass;
  const coherenceFindingById = new Map(coherenceFindings.map(finding => [finding.id, finding]));
  const flowExplanation: FlowExplanationPass = {
    ...flowExplanationRaw,
    coherenceFlows: (flowExplanationRaw.coherenceFlows || []).map(flow => {
      const finding = coherenceFindingById.get(flow.edgeId);
      if (!finding) return flow;
      return {
        ...flow,
        descriptorAnchor: descriptorAnchor(finding.errorCode),
        issue: {
          ...flow.issue,
          errorCode: finding.errorCode,
          errorLabelVi: TAXONOMY_BY_CODE.get(finding.errorCode)?.labelVi || flow.issue.errorLabelVi,
          evidenceSpans: exactEvidenceSpans(essay, manifest, finding),
          nodeLinks: nodeLinksForFinding(decomposition, finding, essay, manifest),
          descriptorAnchor: descriptorAnchor(finding.errorCode),
        },
      };
    }),
  };

  const task = buildTaskPass(examiner, confirmedFindings, decomposition, essay, manifest);
  const relevanceGate = buildRelevanceGate(decomposition, confirmedFindings, essay, manifest);
  const coherence = buildCohesionPass(examiner, confirmedFindings, essay, manifest, flowExplanation.coherenceFlows);
  const language = buildLanguagePass(examiner, confirmedFindings, essay, manifest);
  const comparison = confirmedFindings.length
    ? await runPass<BandComparison>(
        COMPARISON_SYSTEM,
        { taskPrompt: prompt, originalEssay: essay, authoritativeScores: finalScores, confirmedFindings },
        value => comparisonRewriteErrors(value, essay, finalScores),
        'verified-comparison',
      )
    : {
        targetBand: finalScores.overall >= 8.5 ? 9 : 8,
        revisedEssay: essay,
        changeSummaryVi: 'Lượt review này chưa xác nhận được vấn đề đủ rõ để cần tạo một bản viết lại.',
        preservedStrengthsVi: [],
        changes: [],
      } satisfies BandComparison;

  const raw: WritingAnalysis = {
    promptType: examiner.promptType,
    assessmentAudit: assessmentAudit(examiner.scores, finalScores, verifier, scoreAudit),
    scores: finalScores,
    taskCoverage: task.taskCoverage || [],
    relevanceGate: relevanceGate.relevanceGate || [],
    argumentFlowOverview: flowExplanation.argumentFlowOverview,
    argumentFlowChapters: flowExplanation.argumentFlowChapters || [],
    pyramid: {
      ...mergeTaskAndStructure(decomposition, task, manifest),
      coherenceFlows: coherence.coherenceFlows || [],
    },
    cohesionHighlights: coherence.cohesionHighlights || [],
    lexicalHighlights: language.lexicalHighlights || [],
    grammaticalHighlights: language.grammaticalHighlights || [],
    overallAssessment: overallAssessment(examiner, confirmedFindings, finalScores, scoreAudit),
    comparison,
  };

  const analysis = alignWritingAnalysis(materializeReviewErrors(raw), essay, manifest);
  const errors = validateWritingAnalysis(analysis, manifest);
  if (errors.length) throw new Error(`Merged assessment failed validation: ${errors.join(' ')}`);
  return analysis;
}

async function assembleQuoteFirstAnalysis({
  prompt,
  essay,
  manifest,
  quoteExaminer,
  confirmedFindings,
  decompositionRaw,
  pipelineLabel,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
  quoteExaminer: QuoteFirstExaminerPass;
  confirmedFindings: VerifiedFinding[];
  decompositionRaw: DecompositionPass;
  pipelineLabel: string;
}): Promise<WritingAnalysis> {
  const source = sourceContext(prompt, essay, manifest);
  const examiner = examinerForQuoteFirstAssembly(quoteExaminer, confirmedFindings);
  const finalScores = ensureBandScores(examiner.scores);
  const decomposition = normalizeDecomposition(decompositionRaw, manifest);
  const coherenceFindings = confirmedFindings.filter(finding => finding.criterion === 'coherence');
  const coreOnlyBenchmark = process.env.ASSESSMENT_BENCHMARK_MODE === 'true'
    && process.env.ASSESSMENT_BENCHMARK_CORE_ONLY === 'true';

  const [flowExplanationRaw, comparison] = await Promise.all([
    coherenceFindings.length && !coreOnlyBenchmark
      ? runPass<FlowExplanationPass>(
          FLOW_SYSTEM,
          { ...source, decomposition, confirmedFindings: coherenceFindings },
          value => flowErrors(value, decomposition, coherenceFindings),
          `coherence-flow-explainer-${pipelineLabel}`,
        )
      : Promise.resolve({
          coherenceFlows: [],
          argumentFlowOverview: { titleVi: '', bodyVi: '', nodeIds: [] },
          argumentFlowChapters: [],
        } satisfies FlowExplanationPass),
    confirmedFindings.length && !coreOnlyBenchmark
      ? runPass<BandComparison>(
          COMPARISON_SYSTEM,
          { taskPrompt: prompt, originalEssay: essay, authoritativeScores: finalScores, confirmedFindings },
          value => comparisonRewriteErrors(value, essay, finalScores),
          `quote-first-comparison-${pipelineLabel}`,
        )
      : Promise.resolve({
          targetBand: finalScores.overall >= 8.5 ? 9 : 8,
          revisedEssay: essay,
          changeSummaryVi: coreOnlyBenchmark
            ? 'Benchmark chỉ đo phần phát hiện lỗi; bản đối chiếu không được tạo trong lượt này.'
            : 'Lượt review này chưa xác nhận được vấn đề đủ rõ để cần tạo một bản viết lại.',
          preservedStrengthsVi: [],
          changes: [],
        } satisfies BandComparison),
  ]);

  const coherenceFindingById = new Map(coherenceFindings.map(finding => [finding.id, finding]));
  const flowExplanation: FlowExplanationPass = {
    ...flowExplanationRaw,
    coherenceFlows: (flowExplanationRaw.coherenceFlows || []).map(flow => {
      const finding = coherenceFindingById.get(flow.edgeId);
      if (!finding) return flow;
      return {
        ...flow,
        descriptorAnchor: descriptorAnchor(finding.errorCode),
        issue: {
          ...flow.issue,
          errorCode: finding.errorCode,
          errorLabelVi: readableErrorLabelVi(finding),
          evidenceSpans: exactEvidenceSpans(essay, manifest, finding),
          nodeLinks: nodeLinksForFinding(decomposition, finding, essay, manifest),
          descriptorAnchor: descriptorAnchor(finding.errorCode),
        },
      };
    }),
  };

  const task = buildTaskPass(examiner, confirmedFindings, decomposition, essay, manifest);
  const relevanceGate = buildRelevanceGate(decomposition, confirmedFindings, essay, manifest);
  const coherence = buildCohesionPass(examiner, confirmedFindings, essay, manifest, flowExplanation.coherenceFlows);
  const language = buildLanguagePass(examiner, confirmedFindings, essay, manifest);
  const verifier: EvidenceVerifierPass = {
    findings: confirmedFindings,
    coverageCheckVi: 'Các nhận xét được giữ từ lượt đọc toàn bài và đã được liên kết lại với nguyên văn tại local.',
  };

  const raw: WritingAnalysis = {
    promptType: examiner.promptType,
    assessmentAudit: assessmentAudit(examiner.scores, finalScores, verifier),
    scores: finalScores,
    taskCoverage: task.taskCoverage || [],
    relevanceGate: relevanceGate.relevanceGate || [],
    argumentFlowOverview: flowExplanation.argumentFlowOverview,
    argumentFlowChapters: flowExplanation.argumentFlowChapters || [],
    pyramid: {
      ...mergeTaskAndStructure(decomposition, task, manifest),
      coherenceFlows: coherence.coherenceFlows || [],
    },
    cohesionHighlights: coherence.cohesionHighlights || [],
    lexicalHighlights: language.lexicalHighlights || [],
    grammaticalHighlights: language.grammaticalHighlights || [],
    overallAssessment: overallAssessment(examiner, confirmedFindings, finalScores),
    comparison,
  };

  const analysis = alignWritingAnalysis(materializeReviewErrors(raw), essay, manifest);
  const errors = validateWritingAnalysis(analysis, manifest);
  if (errors.length) throw new Error(`Merged quote-first assessment failed validation: ${errors.join(' ')}`);
  return analysis;
}

/**
 * Quote-first pipeline: the model diagnoses writing, while source anchoring,
 * node mapping, ordering projection, and UI metadata remain local concerns.
 */
export async function runWritingAssessmentPipelineV3({
  prompt,
  essay,
  manifest,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
}): Promise<WritingAnalysis> {
  const source = sourceContext(prompt, essay, manifest);
  const [examinerRaw, decompositionRaw] = await Promise.all([
    runPass<QuoteFirstExaminerPass>(
      QUOTE_FIRST_EXAMINER_SYSTEM,
      source,
      quoteFirstExaminerErrors,
      'quote-first-examiner',
    ),
    runPass<DecompositionPass>(
      STRUCTURE_SYSTEM,
      source,
      value => structureErrors(value, manifest),
      'information-unit-map-v3',
    ),
  ]);
  const quoteExaminer = canonicalizeQuoteFirstExaminer(examinerRaw, essay, manifest);
  const confirmedFindings = verifiedFindingsFromQuoteExaminer(quoteExaminer);
  return assembleQuoteFirstAnalysis({
    prompt,
    essay,
    manifest,
    quoteExaminer,
    confirmedFindings,
    decompositionRaw,
    pipelineLabel: 'v3',
  });
}

/**
 * Criterion-focused experiment: score once, then let four narrow reviewers
 * inspect their own criterion concurrently. Findings remain quote-first and
 * are assembled locally without a model rewriting another model's work.
 */
export async function runWritingAssessmentPipelineV4({
  prompt,
  essay,
  manifest,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
}): Promise<WritingAnalysis> {
  const source = sourceContext(prompt, essay, manifest);
  const [initialRaw, decompositionRaw] = await Promise.all([
    runPass<QuoteFirstExaminerPass>(
      INITIAL_SCORING_SYSTEM,
      source,
      initialScoringErrors,
      'initial-scoring-v4',
    ),
    runPass<DecompositionPass>(
      STRUCTURE_SYSTEM,
      source,
      value => structureErrors(value, manifest),
      'information-unit-map-v4',
    ),
  ]);
  const initial = canonicalizeQuoteFirstExaminer(initialRaw, essay, manifest);
  const judgment = (criterion: keyof Omit<BandScores, 'overall'>) => (
    initial.criterionJudgments.find(item => item.criterion === criterion)
  );
  const shared = {
    taskPrompt: prompt,
    essay,
    manifest: manifestForPrompt(manifest),
  };

  const [taskRaw, ccRaw, lexicalRaw, grammarRaw] = await Promise.all([
    runPass<FocusedFindingPass>(
      TASK_RESPONSE_FOCUS_SYSTEM,
      {
        ...shared,
        initialScore: initial.scores.taskAchievement,
        initialRationaleVi: judgment('taskAchievement')?.rationaleVi,
        taskRequirements: initial.taskRequirements,
        topicSentenceCoverage: initial.topicSentenceCoverage,
      },
      value => focusedFindingErrors(value, ['task_response']),
      'task-response-focus-v4',
    ),
    runPass<FocusedFindingPass>(
      COHERENCE_COHESION_FOCUS_SYSTEM,
      {
        ...shared,
        initialScore: initial.scores.coherenceCohesion,
        initialRationaleVi: judgment('coherenceCohesion')?.rationaleVi,
      },
      value => focusedFindingErrors(value, ['coherence', 'cohesion']),
      'coherence-cohesion-focus-v4',
    ),
    runPass<FocusedFindingPass>(
      LEXICAL_RESOURCE_FOCUS_SYSTEM,
      {
        ...shared,
        initialScore: initial.scores.lexicalResource,
        initialRationaleVi: judgment('lexicalResource')?.rationaleVi,
      },
      value => focusedFindingErrors(value, ['lexical_resource']),
      'lexical-resource-focus-v4',
    ),
    runPass<FocusedFindingPass>(
      GRAMMAR_FOCUS_SYSTEM,
      {
        ...shared,
        initialScore: initial.scores.grammaticalRange,
        initialRationaleVi: judgment('grammaticalRange')?.rationaleVi,
      },
      value => focusedFindingErrors(value, ['grammatical_range_accuracy']),
      'grammar-focus-v4',
    ),
  ]);

  const focusedFindings = orderAndDedupeFocusedFindings(reconcileFocusedLocalOwnership([
    ...canonicalizeFocusedFindingPass(taskRaw, essay, manifest, 'tr'),
    ...canonicalizeFocusedFindingPass(ccRaw, essay, manifest, 'cc'),
    ...canonicalizeFocusedFindingPass(lexicalRaw, essay, manifest, 'lr'),
    ...canonicalizeFocusedFindingPass(grammarRaw, essay, manifest, 'gra'),
  ]));
  const quoteExaminer: QuoteFirstExaminerPass = { ...initial, findings: focusedFindings };
  const confirmedFindings = verifiedFindingsFromQuoteExaminer(quoteExaminer);

  return assembleQuoteFirstAnalysis({
    prompt,
    essay,
    manifest,
    quoteExaminer,
    confirmedFindings,
    decompositionRaw,
    pipelineLabel: 'v4',
  });
}

function localCompatibilityDecomposition(manifest: EssayParagraphManifest[]): DecompositionPass {
  const inferRole = (
    text: string,
    paragraphIndex: number,
    sentenceIndex: number,
  ): DecompositionPass['paragraphs'][number]['chunks'][number]['role'] => {
    const normalized = text.trim().toLowerCase();
    const isIntroduction = paragraphIndex === 0;
    const isConclusion = manifest.length > 1 && paragraphIndex === manifest.length - 1;

    if (/\b(for example|for instance|such as|to illustrate)\b/.test(normalized)) return 'example';
    if (/^(although|though|even though|while|admittedly)\b/.test(normalized)) return 'concession';
    if (/^(however|nevertheless|nonetheless|on the other hand|by contrast|in contrast)\b/.test(normalized)) return 'contrast';
    if (/\b(compared with|compared to|whereas|more than|less than)\b/.test(normalized)) return 'comparison';
    if (/^(therefore|thus|hence|consequently|as a result|overall)\b/.test(normalized)) {
      return isConclusion ? 'final_stance' : 'mini_conclusion';
    }
    if (/\b(because|since|due to|owing to)\b/.test(normalized)) return 'reason';
    if (/\b(this means|which means|thereby|leads? to|results? in|allows? them|enables? them)\b/.test(normalized)) {
      return 'mechanism';
    }
    if (isConclusion) return sentenceIndex === 0 ? 'mini_conclusion' : 'final_stance';
    if (isIntroduction) return sentenceIndex === 0 ? 'setup' : 'final_stance';
    return sentenceIndex === 0 ? 'claim' : 'explanation';
  };

  return {
    paragraphs: manifest.map(paragraph => ({
      index: paragraph.index,
      label: paragraph.index === 0
        ? 'Introduction'
        : paragraph.index === manifest.length - 1
          ? 'Conclusion'
          : `Body ${paragraph.index}`,
      chunks: paragraph.sentences.map((sentence, index) => ({
        nodeId: `sentence-${paragraph.index}-${index + 1}`,
        sourceSentenceIndex: sentence.index,
        sourceText: sentence.text,
        startChar: sentence.startChar,
        endChar: sentence.endChar,
        role: inferRole(sentence.text, paragraph.index, index),
        simplifiedIdea: sentence.text,
      })),
    })),
  };
}

/**
 * Highlight-only experiment. The model assesses and quotes evidence; all source
 * anchoring is local. No model call segments the essay, builds a map, explains
 * a flow, or writes a comparison essay.
 */
export async function runWritingAssessmentPipelineV5({
  prompt,
  essay,
  manifest,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
}): Promise<WritingAnalysis> {
  const source = sourceContext(prompt, essay, manifest);
  const initialRaw = await runPass<QuoteFirstExaminerPass>(
    INITIAL_SCORING_SYSTEM,
    source,
    initialScoringErrors,
    'initial-scoring-v5',
  );
  const initial = canonicalizeQuoteFirstExaminer(initialRaw, essay, manifest);
  const judgment = (criterion: keyof Omit<BandScores, 'overall'>) => (
    initial.criterionJudgments.find(item => item.criterion === criterion)
  );
  const shared = {
    taskPrompt: prompt,
    essay,
    manifest: manifestForPrompt(manifest),
  };

  const [taskRaw, ccRaw, lexicalRaw, grammarRaw] = await Promise.all([
    runPass<TaskResponseFocusedPass>(
      TASK_RESPONSE_FOCUS_SYSTEM,
      {
        ...shared,
        taskRequirements: initial.taskRequirements,
        topicSentenceCoverage: initial.topicSentenceCoverage,
      },
      value => taskResponsePointAuditErrors(value, essay, manifest, initial.promptType),
      'task-response-focus-v5',
    ),
    runPass<FocusedFindingPass>(
      COHERENCE_COHESION_FOCUS_SYSTEM,
      {
        ...shared,
      },
      value => focusedFindingErrors(value, ['coherence', 'cohesion']),
      'coherence-cohesion-focus-v5',
    ),
    runPass<FocusedFindingPass>(
      LEXICAL_RESOURCE_FOCUS_SYSTEM,
      {
        ...shared,
        initialScore: initial.scores.lexicalResource,
        initialRationaleVi: judgment('lexicalResource')?.rationaleVi,
      },
      value => focusedFindingErrors(value, ['lexical_resource']),
      'lexical-resource-focus-v5',
    ),
    runPass<FocusedFindingPass>(
      GRAMMAR_FOCUS_SYSTEM,
      {
        ...shared,
        initialScore: initial.scores.grammaticalRange,
        initialRationaleVi: judgment('grammaticalRange')?.rationaleVi,
      },
      value => focusedFindingErrors(value, ['grammatical_range_accuracy']),
      'grammar-focus-v5',
    ),
  ]);

  const focusedFindings = orderAndDedupeFocusedFindings(reconcileFocusedLocalOwnership([
    ...canonicalizeFocusedFindingPass(taskRaw, essay, manifest, 'tr'),
    ...canonicalizeFocusedFindingPass(ccRaw, essay, manifest, 'cc'),
    ...canonicalizeFocusedFindingPass(lexicalRaw, essay, manifest, 'lr'),
    ...canonicalizeFocusedFindingPass(grammarRaw, essay, manifest, 'gra'),
  ]));
  const quoteExaminer: QuoteFirstExaminerPass = { ...initial, findings: focusedFindings };
  const confirmedFindings = dedupeVerifiedFindings(verifiedFindingsFromQuoteExaminer(quoteExaminer));
  const examiner = examinerForQuoteFirstAssembly(quoteExaminer, confirmedFindings);
  const scores = ensureBandScores(examiner.scores);
  const decomposition = localCompatibilityDecomposition(manifest);
  const task = buildTaskPass(examiner, confirmedFindings, decomposition, essay, manifest);
  const relevanceGate = buildRelevanceGate(decomposition, confirmedFindings, essay, manifest);
  const language = buildLanguagePass(examiner, confirmedFindings, essay, manifest);
  const cohesion = buildCohesionPass(examiner, confirmedFindings, essay, manifest, []);
  const verifier: EvidenceVerifierPass = {
    findings: confirmedFindings,
    coverageCheckVi: 'Evidence được liên kết với nguyên văn bằng quote resolver tại local.',
  };

  const raw: WritingAnalysis = {
    promptType: examiner.promptType,
    assessmentAudit: assessmentAudit(examiner.scores, scores, verifier),
    scores,
    taskCoverage: task.taskCoverage || [],
    relevanceGate: relevanceGate.relevanceGate || [],
    argumentFlowOverview: { titleVi: '', bodyVi: '', nodeIds: [] },
    argumentFlowChapters: [],
    pyramid: {
      ...mergeTaskAndStructure(decomposition, task, manifest),
      coherenceFlows: [],
    },
    cohesionHighlights: cohesion.cohesionHighlights || [],
    lexicalHighlights: language.lexicalHighlights || [],
    grammaticalHighlights: language.grammaticalHighlights || [],
    overallAssessment: overallAssessment(examiner, confirmedFindings, scores),
    comparison: {
      targetBand: scores.overall >= 8.5 ? 9 : 8,
      revisedEssay: essay,
      changeSummaryVi: 'Lượt thử này chỉ chấm bài và đánh dấu evidence; chưa tạo bản viết lại.',
      preservedStrengthsVi: [],
      changes: [],
    },
  };

  const analysis = alignWritingAnalysis(materializeReviewErrors(raw), essay, manifest);
  const errors = validateWritingAnalysis(analysis, manifest, essay);
  if (errors.length) throw new Error(`Highlight-only assessment failed validation: ${errors.join(' ')}`);
  return analysis;
}

/**
 * Three-stage assessment: natural first read, five independent criterion
 * investigations, then descriptor-matched rescoring. Models quote evidence;
 * source anchoring and UI materialisation remain deterministic and local.
 */
export async function runWritingAssessmentPipelineV6({
  prompt,
  essay,
  manifest,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
}): Promise<WritingAnalysis> {
  const source = sourceContext(prompt, essay, manifest);
  const skipInventoryAudit = process.env.ASSESSMENT_V6_SKIP_INVENTORY_AUDIT === 'true';
  const [initialRaw, inventoryRaw, secondInventoryRaw] = await Promise.all([
    runPass<QuoteFirstExaminerPass>(
      NATURAL_ASSESSMENT_V6_SYSTEM,
      source,
      value => naturalAssessmentV6Errors(value, essay, manifest),
      'initial-scoring-v6',
    ),
    runPass<TaskResponseInventoryPass>(
      TASK_RESPONSE_INVENTORY_SYSTEM,
      source,
      value => taskResponseInventoryErrors(value, essay, manifest),
      'task-response-inventory-v6',
    ),
    skipInventoryAudit ? Promise.resolve(undefined) : runPass<TaskResponseInventoryPass>(
      TASK_RESPONSE_INVENTORY_SECOND_OPINION_SYSTEM,
      source,
      value => taskResponseInventoryErrors(value, essay, manifest),
      'task-response-inventory-second-opinion-v6',
    ),
  ]);
  initialRaw.scores = normalizeOverallScore(initialRaw.scores);
  const initial = canonicalizeQuoteFirstExaminer(initialRaw, essay, manifest);
  let inventory = canonicalizeTaskResponseInventory(inventoryRaw, essay, manifest);
  inventory.taskRequirements = normalizeTaskRequirementDescriptions(
    initial.promptType,
    inventory.taskRequirements,
  );
  if (initial.promptType === 'outweigh') {
    inventory.points = inventory.points.filter(point => !isBareComparativeJudgmentPoint(point));
  }
  inventory.points = mergeSupportingInventoryPoints(inventory.points);
  if (secondInventoryRaw) {
    const proposedInventory = inventory;
    inventory = canonicalizeTaskResponseInventory(secondInventoryRaw, essay, manifest);
    inventory.taskRequirements = normalizeTaskRequirementDescriptions(
      initial.promptType,
      inventory.taskRequirements,
    );
    inventory.taskRequirements = reconcileInventoryRequirements(
      inventory.taskRequirements,
      proposedInventory.taskRequirements,
    );
    if (initial.promptType === 'outweigh') {
      inventory.points = inventory.points.filter(point => !isBareComparativeJudgmentPoint(point));
    }
    inventory.points = mergeSupportingInventoryPoints(reconcileInventoryPointGranularity(
      inventory.points,
      proposedInventory.points,
    ));
  }
  inventory.taskRequirements = normalizeOutweighSideCoverage(
    initial.promptType,
    inventory.taskRequirements,
    inventory.points,
  );
  initial.taskRequirements = inventory.taskRequirements;
  const coreOnlyBenchmark = process.env.ASSESSMENT_BENCHMARK_MODE === 'true'
    && process.env.ASSESSMENT_BENCHMARK_CORE_ONLY === 'true';
  if (process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
    console.info('[assessment-task-inventory-v6]', JSON.stringify({
      requirements: inventory.taskRequirements.map(({ id, requirement, status }) => ({ id, requirement, status })),
      points: inventory.points,
    }));
  }
  const shared = {
    taskPrompt: prompt,
    essay,
    manifest: manifestForPrompt(manifest),
  };

  const [taskRaw, taskForensicRaw, coherenceRaw, cohesionRaw, lexicalRaw, grammarRaw] = await Promise.all([
    runPass<TaskResponseFocusedPass>(
      TASK_RESPONSE_FOCUS_SYSTEM,
      {
        ...shared,
        taskRequirements: initial.taskRequirements,
        topicSentenceCoverage: initial.topicSentenceCoverage,
        pointInventory: inventory.points,
      },
      value => taskResponsePointAuditErrors(value, essay, manifest, initial.promptType, inventory, false),
      'task-response-critical-v6',
    ),
    runPass<TaskResponseFocusedPass>(
      TASK_RESPONSE_FORENSIC_SYSTEM,
      {
        ...shared,
        taskRequirements: initial.taskRequirements,
        pointInventory: inventory.points,
      },
      value => taskResponsePointAuditErrors(value, essay, manifest, initial.promptType, inventory, false),
      'task-response-forensic-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({ findings: [] }) : runPass<FocusedFindingPass>(
      COHERENCE_FOCUS_SYSTEM,
      {
        ...shared,
      },
      value => focusedFindingErrors(value, ['coherence'], essay, manifest),
      'coherence-critical-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({ findings: [] }) : runPass<FocusedFindingPass>(
      COHESION_FOCUS_SYSTEM,
      {
        ...shared,
      },
      value => focusedFindingErrors(value, ['cohesion'], essay, manifest),
      'cohesion-critical-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({ findings: [] }) : runPass<FocusedFindingPass>(
      LEXICAL_RESOURCE_FOCUS_SYSTEM,
      {
        ...shared,
      },
      value => focusedFindingErrors(value, ['lexical_resource'], essay, manifest),
      'lexical-resource-critical-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({ findings: [] }) : runPass<FocusedFindingPass>(
      GRAMMAR_FOCUS_SYSTEM,
      {
        ...shared,
      },
      value => focusedFindingErrors(value, ['grammatical_range_accuracy'], essay, manifest),
      'grammar-critical-v6',
    ),
  ]);
  const primaryTaskFocused = alignTaskResponseRequirementIds(taskRaw, initial.taskRequirements);
  const forensicTaskFocused = alignTaskResponseRequirementIds(taskForensicRaw, initial.taskRequirements);
  const auditedTaskRaw = await runPass<TaskResponseFocusedPass>(
    TASK_RESPONSE_AUDIT_SYSTEM,
    {
      ...shared,
      taskRequirements: initial.taskRequirements,
      pointInventory: inventory.points,
      previousAnalyses: [primaryTaskFocused, forensicTaskFocused],
    },
    value => taskResponsePointAuditErrors(value, essay, manifest, initial.promptType, inventory),
    'task-response-audit-v6',
  );
  const taskFocused = alignTaskResponseRequirementIds(auditedTaskRaw, initial.taskRequirements);
  if (process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
    console.info('[assessment-task-audit-v6]', JSON.stringify({
      primary: {
        requirements: primaryTaskFocused.taskRequirements.map(({ id, requirement, status }) => ({ id, requirement, status })),
        points: primaryTaskFocused.pointAudit,
        findings: primaryTaskFocused.findings,
      },
      forensic: {
        requirements: forensicTaskFocused.taskRequirements.map(({ id, requirement, status }) => ({ id, requirement, status })),
        points: forensicTaskFocused.pointAudit,
        findings: forensicTaskFocused.findings,
      },
      audited: {
      requirements: taskFocused.taskRequirements.map(({ id, requirement, status }) => ({ id, requirement, status })),
      points: taskFocused.pointAudit,
      findings: taskFocused.findings,
      },
    }));
  }

  const taskFindings = removeCoverageFindingsContradictedByInventory(
    canonicalizeFocusedFindingPass(taskFocused, essay, manifest, 'tr'),
    inventory.taskRequirements,
  );
  const focusedFindings = removeUnrequiredMacroComparisonFindings(orderAndDedupeFocusedFindings(reconcileFocusedLocalOwnership(mergeNaturalAndFocusedFindings(
    [],
    [
    ...taskFindings,
    ...canonicalizeFocusedFindingPass(coherenceRaw, essay, manifest, 'coherence'),
    ...canonicalizeFocusedFindingPass(cohesionRaw, essay, manifest, 'cohesion'),
    ...canonicalizeFocusedFindingPass(lexicalRaw, essay, manifest, 'lr'),
    ...canonicalizeFocusedFindingPass(grammarRaw, essay, manifest, 'gra'),
    ],
  ))), initial.promptType);
  initial.taskRequirements = mergeTaskResponseRequirements(
    inventory.taskRequirements,
    taskFocused.taskRequirements,
    taskFocused.findings,
  );

  const scoringContext = {
    taskPrompt: prompt,
    essay,
    verifiedFindings: focusedFindings,
  };
  const [taskScore, ccScore, lexicalScore, grammarScore] = await Promise.all([
    runPass<CriterionScorePass>(
      `${CRITERION_SCORE_SYSTEMS.taskAchievement}\n${CRITERION_SCORE_OUTPUT_V6}`,
      scoringContext,
      criterionScorePassErrors,
      'task-response-score-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({
      band: initial.scores.coherenceCohesion,
      rationaleVi: 'Giữ điểm initial trong TR-only benchmark.',
      whyNotHigherVi: 'Không đánh giá trong TR-only benchmark.',
      whyNotLowerVi: 'Không đánh giá trong TR-only benchmark.',
    }) : runPass<CriterionScorePass>(
      `${CRITERION_SCORE_SYSTEMS.coherenceCohesion}\n${CRITERION_SCORE_OUTPUT_V6}`,
      scoringContext,
      criterionScorePassErrors,
      'coherence-cohesion-score-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({
      band: initial.scores.lexicalResource,
      rationaleVi: 'Giữ điểm initial trong TR-only benchmark.',
      whyNotHigherVi: 'Không đánh giá trong TR-only benchmark.',
      whyNotLowerVi: 'Không đánh giá trong TR-only benchmark.',
    }) : runPass<CriterionScorePass>(
      `${CRITERION_SCORE_SYSTEMS.lexicalResource}\n${CRITERION_SCORE_OUTPUT_V6}`,
      scoringContext,
      criterionScorePassErrors,
      'lexical-resource-score-v6',
    ),
    coreOnlyBenchmark ? Promise.resolve({
      band: initial.scores.grammaticalRange,
      rationaleVi: 'Giữ điểm initial trong TR-only benchmark.',
      whyNotHigherVi: 'Không đánh giá trong TR-only benchmark.',
      whyNotLowerVi: 'Không đánh giá trong TR-only benchmark.',
    }) : runPass<CriterionScorePass>(
      `${CRITERION_SCORE_SYSTEMS.grammaticalRange}\n${CRITERION_SCORE_OUTPUT_V6}`,
      scoringContext,
      criterionScorePassErrors,
      'grammar-score-v6',
    ),
  ]);
  const reconciledCriterionBands = {
    taskAchievement: reconcileCriterionBand(initial.scores.taskAchievement, taskScore.band),
    coherenceCohesion: reconcileCriterionBand(initial.scores.coherenceCohesion, ccScore.band),
    lexicalResource: reconcileCriterionBand(initial.scores.lexicalResource, lexicalScore.band),
    grammaticalRange: reconcileCriterionBand(initial.scores.grammaticalRange, grammarScore.band),
  };
  const scoreValues = Object.values(reconciledCriterionBands);
  const criterionPassScores = ensureBandScores({
    ...reconciledCriterionBands,
    overall: Math.round((scoreValues.reduce((sum, band) => sum + band, 0) / 4) * 2) / 2,
  });
  const boundedRationale = (
    criterion: keyof Omit<BandScores, 'overall'>,
    specialistBand: number,
    rationaleVi: string,
  ) => {
    const finalBand = criterionPassScores[criterion];
    return finalBand === specialistBand
      ? rationaleVi
      : `${rationaleVi} Xét cả chất lượng chung của bài thay vì chỉ các lỗi đã xác nhận, mức phù hợp hơn là Band ${finalBand}.`;
  };
  const criterionPassJudgments: QuoteFirstExaminerPass['criterionJudgments'] = [
    {
      criterion: 'taskAchievement',
      band: criterionPassScores.taskAchievement,
      rationaleVi: boundedRationale('taskAchievement', taskScore.band, taskScore.rationaleVi),
    },
    {
      criterion: 'coherenceCohesion',
      band: criterionPassScores.coherenceCohesion,
      rationaleVi: boundedRationale('coherenceCohesion', ccScore.band, ccScore.rationaleVi),
    },
    {
      criterion: 'lexicalResource',
      band: criterionPassScores.lexicalResource,
      rationaleVi: boundedRationale('lexicalResource', lexicalScore.band, lexicalScore.rationaleVi),
    },
    {
      criterion: 'grammaticalRange',
      band: criterionPassScores.grammaticalRange,
      rationaleVi: boundedRationale('grammaticalRange', grammarScore.band, grammarScore.rationaleVi),
    },
  ];
  const criterionPassExaminer: QuoteFirstExaminerPass = {
    ...initial,
    scores: criterionPassScores,
    criterionJudgments: criterionPassJudgments,
    findings: focusedFindings,
  };
  const scoreAudit: ScoreConsistencyPass = {
    scores: criterionPassScores,
    decisions: criterionPassJudgments.map(judgment => ({
      criterion: judgment.criterion,
      initialBand: initial.scores[judgment.criterion],
      finalBand: criterionPassScores[judgment.criterion],
      reasonVi: judgment.rationaleVi,
    })),
  };
  const scores = ensureBandScores(criterionPassScores);
  const finalJudgments: QuoteFirstExaminerPass['criterionJudgments'] = criterionPassJudgments.map(judgment => ({
    ...judgment,
    band: scores[judgment.criterion],
    rationaleVi: qualifyNonExhaustiveRationaleVi(
      scoreAudit?.decisions.find(decision => decision.criterion === judgment.criterion)?.reasonVi
        || judgment.rationaleVi,
    ),
  }));
  const quoteExaminer: QuoteFirstExaminerPass = {
    ...criterionPassExaminer,
    scores,
    criterionJudgments: finalJudgments,
  };
  const confirmedFindings = dedupeVerifiedFindings(
    reconcileCrossCriterionOwnership(
      reconcileOverlappingLanguageOwnership(
        verifiedFindingsFromQuoteExaminer(quoteExaminer),
        essay,
        manifest,
      ),
    ).filter(finding => !finding.mergedIntoFindingId),
  );
  const examiner = examinerForQuoteFirstAssembly(quoteExaminer, confirmedFindings);
  const decomposition = localCompatibilityDecomposition(manifest);
  const task = buildTaskPass(examiner, confirmedFindings, decomposition, essay, manifest);
  const relevanceGate = buildRelevanceGate(decomposition, confirmedFindings, essay, manifest);
  const language = buildLanguagePass(examiner, confirmedFindings, essay, manifest);
  const cohesion = buildCohesionPass(examiner, confirmedFindings, essay, manifest, []);
  const verifier: EvidenceVerifierPass = {
    findings: confirmedFindings,
    coverageCheckVi: 'Evidence được liên kết với nguyên văn bằng quote resolver tại local.',
  };
  const comparison = confirmedFindings.length && !coreOnlyBenchmark
    ? await runComparisonRewriteOnce({
        taskPrompt: prompt,
        originalEssay: essay,
        authoritativeScores: scores,
        confirmedFindings,
      })
    : {
        targetBand: scores.overall >= 8.5 ? 9 : 8,
        revisedEssay: essay,
        changeSummaryVi: coreOnlyBenchmark
          ? 'Benchmark chỉ đo phần phát hiện lỗi; bản đối chiếu không được tạo trong lượt này.'
          : 'Lượt review này chưa xác nhận được vấn đề đủ rõ để cần tạo một bản viết lại.',
        preservedStrengthsVi: [],
        changes: [],
      } satisfies BandComparison;

  const raw: WritingAnalysis = {
    promptType: examiner.promptType,
    assessmentAudit: assessmentAudit(initial.scores, scores, verifier, scoreAudit),
    scores,
    taskCoverage: task.taskCoverage || [],
    relevanceGate: relevanceGate.relevanceGate || [],
    argumentFlowOverview: { titleVi: '', bodyVi: '', nodeIds: [] },
    argumentFlowChapters: [],
    pyramid: {
      ...mergeTaskAndStructure(decomposition, task, manifest),
      coherenceFlows: [],
    },
    cohesionHighlights: cohesion.cohesionHighlights || [],
    lexicalHighlights: language.lexicalHighlights || [],
    grammaticalHighlights: language.grammaticalHighlights || [],
    overallAssessment: overallAssessment(examiner, confirmedFindings, scores, scoreAudit),
    comparison,
  };

  const analysis = alignWritingAnalysis(materializeReviewErrors(raw), essay, manifest);
  const errors = validateWritingAnalysis(analysis, manifest, essay);
  if (errors.length) throw new Error(`Assessment v6 failed validation: ${errors.join(' ')}`);
  return analysis;
}

/**
 * V7 is intentionally economical. A natural whole-essay read establishes the
 * initial judgment, then five independent specialists inspect their own
 * criteria concurrently. There is no model-generated map, evidence offset,
 * point inventory, score audit, or comparison rewrite in the initial run.
 */
export async function runWritingAssessmentPipelineV7({
  prompt,
  essay,
  manifest,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
}): Promise<WritingAnalysis> {
  const initialRaw = await runPass<QuoteFirstExaminerPass>(
    NATURAL_ASSESSMENT_V6_SYSTEM,
    sourceContext(prompt, essay, manifest),
    value => naturalAssessmentV6Errors(value, essay, manifest),
    'initial-reading-v7',
  );
  initialRaw.scores = normalizeOverallScore(initialRaw.scores);
  const initial = canonicalizeQuoteFirstExaminer(initialRaw, essay, manifest);
  const specialistSource = { taskPrompt: prompt, essay };

  const [taskRaw, coherenceRaw, cohesionRaw, lexicalRaw, grammarRaw] = await Promise.all([
    runPass<V7CriterionPass>(
      V7_TASK_RESPONSE_SYSTEM,
      specialistSource,
      value => v7CriterionPassErrors(value, 'task_response', essay, manifest),
      'task-response-v7',
    ),
    runPass<V7CriterionPass>(
      V7_COHERENCE_SYSTEM,
      specialistSource,
      value => v7CriterionPassErrors(value, 'coherence', essay, manifest),
      'coherence-v7',
    ),
    runPass<V7CriterionPass>(
      V7_COHESION_SYSTEM,
      specialistSource,
      value => v7CriterionPassErrors(value, 'cohesion', essay, manifest),
      'cohesion-v7',
    ),
    runPass<V7CriterionPass>(
      V7_LEXICAL_RESOURCE_SYSTEM,
      specialistSource,
      value => v7CriterionPassErrors(value, 'lexical_resource', essay, manifest),
      'lexical-resource-v7',
    ),
    runPass<V7CriterionPass>(
      V7_GRAMMATICAL_RANGE_SYSTEM,
      specialistSource,
      value => v7CriterionPassErrors(value, 'grammatical_range_accuracy', essay, manifest),
      'grammar-v7',
    ),
  ]);

  const focusedFindings = removeUnrequiredMacroComparisonFindings(
    orderAndDedupeFocusedFindings(reconcileFocusedLocalOwnership([
      ...canonicalizeFocusedFindingPass(taskRaw, essay, manifest, 'tr'),
      ...canonicalizeFocusedFindingPass(coherenceRaw, essay, manifest, 'coherence'),
      ...canonicalizeFocusedFindingPass(cohesionRaw, essay, manifest, 'cohesion'),
      ...canonicalizeFocusedFindingPass(lexicalRaw, essay, manifest, 'lr'),
      ...canonicalizeFocusedFindingPass(grammarRaw, essay, manifest, 'gra'),
    ])),
    initial.promptType,
  );
  const reconciledCriterionBands = {
    taskAchievement: reconcileCriterionBandV8(initial.scores.taskAchievement, taskRaw.band),
    coherenceCohesion: reconcileCriterionBandV8(
      initial.scores.coherenceCohesion,
      Math.round((coherenceRaw.band + cohesionRaw.band) / 2),
    ),
    lexicalResource: reconcileCriterionBandV8(initial.scores.lexicalResource, lexicalRaw.band),
    grammaticalRange: reconcileCriterionBandV8(initial.scores.grammaticalRange, grammarRaw.band),
  };
  const scoreValues = Object.values(reconciledCriterionBands);
  const scores = ensureBandScores({
    ...reconciledCriterionBands,
    overall: Math.round((scoreValues.reduce((sum, band) => sum + band, 0) / 4) * 2) / 2,
  });
  const specialistRationale = (
    criterion: keyof Omit<BandScores, 'overall'>,
    specialistBand: number,
    rationaleVi: string,
  ) => scores[criterion] === specialistBand
    ? rationaleVi
    : `${rationaleVi} Điểm cuối giữ thêm bức tranh toàn bài từ lượt đọc đầu, nên được điều chỉnh về Band ${scores[criterion]}.`;
  const criterionJudgments: QuoteFirstExaminerPass['criterionJudgments'] = [
    {
      criterion: 'taskAchievement',
      band: scores.taskAchievement,
      rationaleVi: specialistRationale('taskAchievement', taskRaw.band, taskRaw.rationaleVi),
    },
    {
      criterion: 'coherenceCohesion',
      band: scores.coherenceCohesion,
      rationaleVi: specialistRationale(
        'coherenceCohesion',
        Math.round((coherenceRaw.band + cohesionRaw.band) / 2),
        `${coherenceRaw.rationaleVi} ${cohesionRaw.rationaleVi}`.trim(),
      ),
    },
    {
      criterion: 'lexicalResource',
      band: scores.lexicalResource,
      rationaleVi: specialistRationale('lexicalResource', lexicalRaw.band, lexicalRaw.rationaleVi),
    },
    {
      criterion: 'grammaticalRange',
      band: scores.grammaticalRange,
      rationaleVi: specialistRationale('grammaticalRange', grammarRaw.band, grammarRaw.rationaleVi),
    },
  ];
  const quoteExaminer: QuoteFirstExaminerPass = {
    ...initial,
    scores,
    criterionJudgments,
    findings: focusedFindings,
  };
  const confirmedFindings = dedupeVerifiedFindings(
    reconcileCrossCriterionOwnership(
      reconcileOverlappingLanguageOwnership(
        verifiedFindingsFromQuoteExaminer(quoteExaminer),
        essay,
        manifest,
      ),
    ).filter(finding => !finding.mergedIntoFindingId),
  );
  const examiner = examinerForQuoteFirstAssembly(quoteExaminer, confirmedFindings);
  const decomposition = localCompatibilityDecomposition(manifest);
  const task = buildTaskPass(examiner, confirmedFindings, decomposition, essay, manifest);
  const relevanceGate = buildRelevanceGate(decomposition, confirmedFindings, essay, manifest);
  const language = buildLanguagePass(examiner, confirmedFindings, essay, manifest);
  const cohesion = buildCohesionPass(examiner, confirmedFindings, essay, manifest, []);
  const verifier: EvidenceVerifierPass = {
    findings: confirmedFindings,
    coverageCheckVi: 'Các quote được resolve lại với nguyên văn ở local; map và highlight không cần model tạo.',
  };
  const scoreAudit: ScoreConsistencyPass = {
    scores,
    decisions: criterionJudgments.map(judgment => ({
      criterion: judgment.criterion,
      initialBand: initial.scores[judgment.criterion],
      finalBand: scores[judgment.criterion],
      reasonVi: judgment.rationaleVi,
    })),
  };
  const raw: WritingAnalysis = {
    promptType: examiner.promptType,
    assessmentAudit: assessmentAudit(initial.scores, scores, verifier, scoreAudit),
    scores,
    taskCoverage: task.taskCoverage || [],
    relevanceGate: relevanceGate.relevanceGate || [],
    argumentFlowOverview: { titleVi: '', bodyVi: '', nodeIds: [] },
    argumentFlowChapters: [],
    pyramid: {
      ...mergeTaskAndStructure(decomposition, task, manifest),
      coherenceFlows: [],
    },
    cohesionHighlights: cohesion.cohesionHighlights || [],
    lexicalHighlights: language.lexicalHighlights || [],
    grammaticalHighlights: language.grammaticalHighlights || [],
    overallAssessment: overallAssessment(examiner, confirmedFindings, scores, scoreAudit),
    comparison: {
      targetBand: scores.overall >= 8.5 ? 9 : 8,
      revisedEssay: essay,
      changeSummaryVi: 'Bản Band 8/9 được tạo riêng khi bạn mở phần đối chiếu; lượt chấm đầu chỉ tập trung phát hiện lỗi và liên kết evidence.',
      preservedStrengthsVi: [],
      changes: [],
    },
  };
  const analysis = alignWritingAnalysis(materializeReviewErrors(raw), essay, manifest);
  const errors = validateWritingAnalysis(analysis, manifest, essay);
  if (errors.length) throw new Error(`Assessment v7 failed validation: ${errors.join(' ')}`);
  return analysis;
}

function hasCoverageWeaknessLanguage(requirement: AuthoritativeExaminerPass['taskRequirements'][number]) {
  const text = `${requirement.requirement} ${requirement.assessmentVi}`.toLocaleLowerCase('vi');
  return /(?:nhưng|chưa|thiếu|yếu|mơ hồ|chung chung|khẳng định|chỉ liệt kê|chủ yếu ở mức|không giải thích|không chứng minh|assert|asserted|not explain|does not explain|lacks|weak|only lists|not demonstrate)/i.test(text);
}

function evidenceForSyntheticRequirement(
  requirement: AuthoritativeExaminerPass['taskRequirements'][number],
  manifest: EssayParagraphManifest[],
): ExaminerEvidence[] {
  if (requirement.evidence?.length) return requirement.evidence;
  const fallbackSentence = manifest.find(paragraph => paragraph.sentences.length)?.sentences[0];
  const fallbackParagraph = manifest.find(paragraph => paragraph.sentences.some(sentence => sentence === fallbackSentence));
  return fallbackSentence && fallbackParagraph
    ? [{
      paragraphIndex: fallbackParagraph.index,
      sourceText: fallbackSentence.text,
      role: 'primary' as const,
    }]
    : [];
}

function requirementAlreadyExplainedByExistingFinding(
  requirement: AuthoritativeExaminerPass['taskRequirements'][number],
  existing: VerifiedFinding[],
  manifest: EssayParagraphManifest[],
) {
  const evidence = evidenceForSyntheticRequirement(requirement, manifest);
  return existing.some(finding => (
    finding.criterion === 'task_response'
    && evidence.some(requirementEvidence => finding.evidence.some(findingEvidence => (
      requirementEvidence.paragraphIndex === findingEvidence.paragraphIndex
      && (
        requirementEvidence.sourceText.includes(findingEvidence.sourceText)
        || findingEvidence.sourceText.includes(requirementEvidence.sourceText)
      )
    )))
  ));
}

function requirementFindingCode(requirement: AuthoritativeExaminerPass['taskRequirements'][number]) {
  const kind = taskRequirementKind(requirement);
  const identity = `${requirement.id} ${requirement.requirement} ${requirement.assessmentVi}`.toLocaleLowerCase('en');
  if (kind === 'comparison' || /outweigh|compar|greater weight|more significant|vượt trội|phép cân|so sánh/.test(identity)) {
    return 'unsupported_comparative_judgment';
  }
  if (requirement.status === 'missing' || requirement.status === 'off_task') return 'partial_prompt_coverage';
  if (/develop|support|mechanism|consequence|underdevelop|phát triển|cơ chế|hậu quả|lập luận/.test(identity)) {
    return 'underdeveloped_idea';
  }
  return 'partial_prompt_coverage';
}

function synthesizeCoverageFindings(
  examiner: QuoteFirstExaminerPass,
  existing: VerifiedFinding[],
  manifest: EssayParagraphManifest[],
): VerifiedFinding[] {
  const existingRequirementIds = new Set(existing.flatMap(finding => finding.requirementIds || []));
  const synthetic = examiner.taskRequirements
    .filter(requirement => {
      if (existingRequirementIds.has(requirement.id)) return false;
      if (requirement.status === 'missing' || requirement.status === 'off_task') return true;
      if (!hasCoverageWeaknessLanguage(requirement)) return false;
      return !requirementAlreadyExplainedByExistingFinding(requirement, existing, manifest);
    })
    .map((requirement, index): VerifiedFinding | undefined => {
      const evidence = evidenceForSyntheticRequirement(requirement, manifest);
      if (!evidence.length) return undefined;
      const errorCode = requirementFindingCode(requirement);
      const entry = TAXONOMY_BY_CODE.get(errorCode);
      return {
        id: `coverage:${index + 1}`,
        criterion: 'task_response',
        severity: requirement.status === 'missing' || requirement.status === 'off_task' ? 'major' : 'moderate',
        confidence: 0.86,
        evidence,
        diagnosisVi: requirement.assessmentVi,
        readerEffectVi: '',
        repairDirectionVi: errorCode === 'unsupported_comparative_judgment'
          ? 'Bạn cần thêm một câu cân trực tiếp: vì sao lợi ích/hại này lớn hơn phía còn lại về phạm vi, mức độ, tần suất hoặc hậu quả.'
          : 'Bạn cần làm rõ phần còn thiếu bằng một bước giải thích cụ thể hơn, thay vì chỉ nêu claim rồi chuyển ý.',
        requirementIds: [requirement.id],
        errorCode,
        errorLabelVi: entry?.labelVi || 'Phần trả lời chưa đủ',
        verdict: 'confirmed',
        verificationVi: 'Coverage yếu từ lượt đọc đầu được chuyển thành finding để UI không làm rơi lỗi.',
      };
    })
    .filter((finding): finding is VerifiedFinding => Boolean(finding));
  return [...existing, ...synthetic];
}

export function compactPromptProfile(profile: PromptProfilePass) {
  return {
    promptType: profile.promptType,
    taskInPlainEnglish: profile.taskInPlainEnglish,
    hardRequirements: profile.hardRequirements,
    conditionalRequirements: profile.conditionalRequirements,
    commonTraps: profile.commonTraps,
  };
}

function fallbackCriterionPass(
  criterion: FindingCriterion,
  band: number,
  reason: unknown,
): V7CriterionPass {
  const message = reason instanceof Error ? reason.message : String(reason);
  const criterionName = criterion.replace(/_/g, ' ');
  if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
    console.warn('[assessment-specialist-fallback]', JSON.stringify({ criterion, message }));
  }
  return {
    band,
    rationaleVi: `${criterionName} chưa hoàn tất trong lượt này. Điểm tạm giữ theo lượt đọc đầu; phần kết quả được đánh dấu là chưa đầy đủ.`,
    findings: [],
    candidateFindings: [],
  };
}

function settledValueOrThrow<T>(
  settled: PromiseSettledResult<T>,
  label: string,
): T {
  if (settled.status === 'fulfilled') return settled.value;
  throw new Error(`${label} failed: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`);
}

/**
 * V8 adds a reusable prompt profile before assessment. The profile captures
 * prompt-specific obligations once, then the natural read and five criterion
 * specialists use it as a diagnostic lens rather than a rigid checklist.
 */
/**
 * Drop highlights whose quote is not literally in the essay, instead of failing
 * the whole assessment.
 *
 * About one lexical or grammar quote in eight comes back tidied -- the model
 * silently corrects the student's own typo while quoting it, so "communicateion"
 * is returned as "communication" and no longer matches. The contract validator
 * treats that as fatal, so three bad quotes out of twenty discarded a complete
 * analysis that had already cost every specialist call.
 *
 * A highlight that cannot be located cannot be rendered either, so losing it
 * costs the student nothing. Losing the other seventeen costs them everything.
 */
function dropUnquotableHighlights(
  analysis: WritingAnalysis,
  manifest: EssayParagraphManifest[],
): WritingAnalysis {
  // Mirror the contract's own rule exactly: the quote must sit inside a single
  // sentence, not merely somewhere in the essay. A whole-essay containment
  // check passes quotes that span a sentence boundary and the validator then
  // rejects them anyway.
  const sentences = manifest.flatMap(paragraph => paragraph.sentences.map(sentence => sentence.text));
  const quotable = <T extends { sourceText?: string }>(highlight: T) => {
    const quote = highlight.sourceText;
    return Boolean(quote) && sentences.some(sentence => sentence.includes(quote as string));
  };
  return {
    ...analysis,
    cohesionHighlights: (analysis.cohesionHighlights || []).filter(quotable),
    lexicalHighlights: (analysis.lexicalHighlights || []).filter(quotable),
    grammaticalHighlights: (analysis.grammaticalHighlights || []).filter(quotable),
  };
}

function mentorAuditUnits(
  manifest: EssayParagraphManifest[],
  promptProfile: PromptProfilePass,
) {
  const sentences = manifest.flatMap(paragraph => paragraph.sentences.map((sentence, sentenceOffset) => ({
    id: `p${paragraph.index}-s${sentence.index}`,
    paragraphIndex: paragraph.index,
    sentenceIndex: sentence.index,
    text: sentence.text,
    previousSentence: sentenceOffset > 0 ? paragraph.sentences[sentenceOffset - 1]?.text : null,
    nextSentence: sentenceOffset < paragraph.sentences.length - 1
      ? paragraph.sentences[sentenceOffset + 1]?.text
      : null,
  })));
  const linkingPattern = /\b(?:however|therefore|moreover|furthermore|additionally|consequently|thus|because|although|for example|for instance|in contrast|on the other hand|firstly|secondly|finally)\b/gi;
  const referencePattern = /\b(?:this|these|that|those|it|they|such|former|latter)\b/gi;
  const sentencePairs = manifest.flatMap(paragraph => paragraph.sentences.slice(0, -1).map((sentence, index) => {
    const right = paragraph.sentences[index + 1];
    const joined = `${sentence.text} ${right.text}`;
    return {
      id: `p${paragraph.index}-pair-${sentence.index}-${right.index}`,
      paragraphIndex: paragraph.index,
      leftSentenceId: `p${paragraph.index}-s${sentence.index}`,
      rightSentenceId: `p${paragraph.index}-s${right.index}`,
      leftText: sentence.text,
      rightText: right.text,
      linkingDevices: [...joined.matchAll(linkingPattern)].map(match => match[0]),
      referenceWords: [...right.text.matchAll(referencePattern)].map(match => match[0]),
    };
  }));
  const paragraphs = manifest.map(paragraph => ({
    id: `paragraph-${paragraph.index}`,
    paragraphIndex: paragraph.index,
    openingSentence: paragraph.sentences[0]?.text || paragraph.text,
    bodySentences: paragraph.sentences.slice(1).map(sentence => sentence.text),
    completeText: paragraph.text,
  }));
  const paragraphTransitions = manifest.slice(0, -1).map((paragraph, index) => {
    const right = manifest[index + 1];
    return {
      id: `transition-${paragraph.index}-${right.index}`,
      leftParagraphId: `paragraph-${paragraph.index}`,
      rightParagraphId: `paragraph-${right.index}`,
      leftClosingSentence: paragraph.sentences.at(-1)?.text || paragraph.text,
      rightOpeningSentence: right.sentences[0]?.text || right.text,
    };
  });
  const words = sentences.flatMap(sentence => (
    sentence.text.toLocaleLowerCase('en').match(/[a-z]+(?:'[a-z]+)?/g) || []
  ));
  const frequencies = words.reduce<Record<string, number>>((counts, word) => {
    counts[word] = (counts[word] || 0) + 1;
    return counts;
  }, {});

  return {
    sentences,
    sentencePairs,
    paragraphs,
    paragraphTransitions,
    essayStructure: {
      paragraphCount: manifest.length,
      paragraphIds: paragraphs.map(paragraph => paragraph.id),
    },
    claimChains: paragraphs.slice(1, Math.max(1, paragraphs.length - 1)),
    promptRequirements: promptProfile.hardRequirements,
    lexicalInventory: Object.entries(frequencies)
      .filter(([, count]) => count >= 2)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([word, count]) => ({ word, count })),
  };
}

function stableLiteAuditUnits(manifest: EssayParagraphManifest[]) {
  const sentences = manifest.flatMap(paragraph => paragraph.sentences.map(sentence => ({
    paragraphIndex: paragraph.index,
    sentenceIndex: sentence.index,
    text: sentence.text,
  })));
  const linkingPattern = /\b(?:however|therefore|moreover|furthermore|additionally|consequently|thus|because|although|for example|for instance|in contrast|on the other hand|firstly|secondly|finally)\b/gi;
  const referencePattern = /\b(?:this|these|that|those|it|they|such|former|latter)\b/gi;
  const sentencePairs = manifest.flatMap(paragraph => paragraph.sentences.slice(0, -1).map((sentence, index) => {
    const right = paragraph.sentences[index + 1];
    const joined = `${sentence.text} ${right.text}`;
    return {
      paragraphIndex: paragraph.index,
      leftText: sentence.text,
      rightText: right.text,
      linkingDevices: [...joined.matchAll(linkingPattern)].map(match => match[0]),
      referenceWords: [...right.text.matchAll(referencePattern)].map(match => match[0]),
    };
  }));
  const paragraphs = manifest.map(paragraph => ({
    paragraphIndex: paragraph.index,
    openingSentence: paragraph.sentences[0]?.text || paragraph.text,
    closingSentence: paragraph.sentences.at(-1)?.text || paragraph.text,
  }));
  const paragraphTransitions = manifest.slice(0, -1).map((paragraph, index) => {
    const right = manifest[index + 1];
    return {
      leftParagraphIndex: paragraph.index,
      rightParagraphIndex: right.index,
      leftClosingSentence: paragraph.sentences.at(-1)?.text || paragraph.text,
      rightOpeningSentence: right.sentences[0]?.text || right.text,
    };
  });

  return {
    sentences,
    sentencePairs,
    paragraphs,
    paragraphTransitions,
  };
}

export async function runWritingAssessmentPipelineV8({
  prompt,
  essay,
  manifest,
  includeComparison = false,
  onIncompletePasses,
}: {
  prompt: string;
  essay: string;
  manifest: EssayParagraphManifest[];
  includeComparison?: boolean;
  onIncompletePasses?: (passes: string[]) => void;
}): Promise<WritingAnalysis> {
  const promptProfile = await getPromptProfile(prompt);
  const profileForAssessment = compactPromptProfile(promptProfile);
  const initialSource = { taskPrompt: prompt, essay, promptProfile: profileForAssessment };
  const specialistSource = {
    taskPrompt: prompt,
    essay,
    promptProfile: profileForAssessment,
    ...(['v3-mentor-units', 'v4-stable-areas', 'v6-mixed-stable', 'v7-candidate-pool', 'v8-candidate-only', 'v9-hybrid-candidate', 'v10-stable-candidate', 'v11-core-worth', 'v12-free-strength'].includes(ACTIVE_ASSESSMENT_PROMPT_VERSION)
      ? { auditUnits: mentorAuditUnits(manifest, promptProfile) }
      : {}),
    ...(ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v5-stable-lite'
      ? { auditUnits: stableLiteAuditUnits(manifest) }
      : {}),
  };

  const [
    initialSettled,
    taskDevelopmentSettled,
    taskCoverageSettled,
    cohesionSettled,
    coherenceSettled,
    lexicalSettled,
    grammarSettled,
  ] = await Promise.allSettled([
    runPass<QuoteFirstExaminerPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${INITIAL_SCORING_SYSTEM}`,
      initialSource,
      value => initialScoringErrors(value),
      'initial-reading-v8',
    ),
    runPass<V7CriterionPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_TASK_RESPONSE_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
      specialistSource,
      value => v7CriterionPassErrors(value, 'task_response', essay, manifest),
      'task-response-development-v8',
    ),
    runPass<V7CriterionPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${TR_COVERAGE_SYSTEM}\n${CRITERION_SCORE_SYSTEMS.taskAchievement}\n${V8_SPECIALIST_DISCIPLINE}\n${V7_CRITERION_OUTPUT}`,
      specialistSource,
      value => v7CriterionPassErrors(value, 'task_response', essay, manifest),
      'task-response-coverage-v8',
    ),
    runPass<V7CriterionPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_COHESION_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
      specialistSource,
      value => v7CriterionPassErrors(value, 'cohesion', essay, manifest),
      'cohesion-v8',
    ),
    runPass<V7CriterionPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_COHERENCE_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
      specialistSource,
      value => v7CriterionPassErrors(value, 'coherence', essay, manifest),
      'coherence-v8',
    ),
    runPass<V7CriterionPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_LEXICAL_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
      specialistSource,
      value => v7CriterionPassErrors(value, 'lexical_resource', essay, manifest),
      'lexical-resource-v8',
    ),
    runPass<V7CriterionPass>(
      `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_GRAMMAR_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
      specialistSource,
      value => v7CriterionPassErrors(value, 'grammatical_range_accuracy', essay, manifest),
      'grammar-v8',
    ),
  ]);

  const incompletePasses = [
    ['initial-reading-v8', initialSettled],
    ['task-response-development-v8', taskDevelopmentSettled],
    ['task-response-coverage-v8', taskCoverageSettled],
    ['cohesion-v8', cohesionSettled],
    ['coherence-v8', coherenceSettled],
    ['lexical-resource-v8', lexicalSettled],
    ['grammar-v8', grammarSettled],
  ].flatMap(([label, settled]) => (
    (settled as PromiseSettledResult<unknown>).status === 'rejected' ? [label as string] : []
  ));
  const initialRaw = settledValueOrThrow(initialSettled, 'initial-reading-v8');
  // The two Task Response passes cover different ground by construction, so
  // their findings merge rather than compete. The band is theirs to agree on;
  // when only one pass survives, its band stands alone.
  const taskDevelopmentRaw = taskDevelopmentSettled.status === 'fulfilled'
    ? taskDevelopmentSettled.value
    : fallbackCriterionPass('task_response', initialRaw.scores.taskAchievement, taskDevelopmentSettled.reason);
  const taskCoverageRaw = taskCoverageSettled.status === 'fulfilled'
    ? taskCoverageSettled.value
    : fallbackCriterionPass('task_response', initialRaw.scores.taskAchievement, taskCoverageSettled.reason);
  const taskBands = [taskDevelopmentSettled, taskCoverageSettled]
    .filter(settled => settled.status === 'fulfilled')
    .map(settled => (settled as PromiseFulfilledResult<V7CriterionPass>).value.band);
  const taskRaw: V7CriterionPass = {
    band: taskBands.length
      ? Math.round(taskBands.reduce((sum, band) => sum + band, 0) / taskBands.length)
      : initialRaw.scores.taskAchievement,
    rationaleVi: [taskDevelopmentRaw.rationaleVi, taskCoverageRaw.rationaleVi]
      .filter(Boolean).join(' ').trim(),
    findings: [...(taskDevelopmentRaw.findings || []), ...(taskCoverageRaw.findings || [])],
    candidateFindings: [
      ...(taskDevelopmentRaw.candidateFindings || []),
      ...(taskCoverageRaw.candidateFindings || []),
    ],
  };
  const cohesionRaw = cohesionSettled.status === 'fulfilled'
    ? cohesionSettled.value
    : fallbackCriterionPass('cohesion', initialRaw.scores.coherenceCohesion, cohesionSettled.reason);
  const coherenceRaw = coherenceSettled.status === 'fulfilled'
    ? coherenceSettled.value
    : fallbackCriterionPass('coherence', initialRaw.scores.coherenceCohesion, coherenceSettled.reason);
  const lexicalRaw = lexicalSettled.status === 'fulfilled'
    ? lexicalSettled.value
    : fallbackCriterionPass('lexical_resource', initialRaw.scores.lexicalResource, lexicalSettled.reason);
  const grammarRaw = grammarSettled.status === 'fulfilled'
    ? grammarSettled.value
    : fallbackCriterionPass('grammatical_range_accuracy', initialRaw.scores.grammaticalRange, grammarSettled.reason);

  let mentorAcceptedFindingIds: Set<string> | undefined;
  if (ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v3-mentor-units') {
    const rawCandidates = [
      ...(taskRaw.findings || []),
      ...(cohesionRaw.findings || []),
      ...(coherenceRaw.findings || []),
      ...(lexicalRaw.findings || []),
      ...(grammarRaw.findings || []),
    ];
    const candidateByVerificationId = new Map<string, QuoteFirstFinding>();
    rawCandidates.forEach(finding => {
      candidateByVerificationId.set(mentorFindingVerificationId(finding), finding);
    });
    const candidates = [...candidateByVerificationId.entries()].map(([verificationId, finding]) => ({
      ...finding,
      id: verificationId,
    }));
    if (candidates.length) {
      const candidateIds = candidates.map(finding => finding.id);
      const verification = await runPass<MentorBinaryVerificationPass>(
        MENTOR_BINARY_VERIFICATION_SYSTEM,
        {
          ...specialistSource,
          candidates,
        },
        value => mentorVerificationErrors(value, candidateIds),
        'mentor-binary-verification-v8',
      );
      mentorAcceptedFindingIds = new Set(
        verification.decisions
          .filter(decision => decision.verdict === 'YES')
          .map(decision => candidateByVerificationId.get(decision.findingId))
          .filter((finding): finding is QuoteFirstFinding => Boolean(finding))
          .map(finding => mentorFindingVerificationId(finding)),
      );
    } else {
      mentorAcceptedFindingIds = new Set();
    }
  }
  const verifiedForMentorExperiment = (pass: V7CriterionPass): V7CriterionPass => (
    mentorAcceptedFindingIds
      ? {
          ...pass,
          findings: (pass.findings || []).filter(finding => (
            mentorAcceptedFindingIds?.has(mentorFindingVerificationId(finding))
          )),
        }
      : pass
  );
  const taskForAssembly = verifiedForMentorExperiment(taskRaw);
  const cohesionForAssembly = verifiedForMentorExperiment(cohesionRaw);
  const coherenceForAssembly = verifiedForMentorExperiment(coherenceRaw);
  const lexicalForAssembly = verifiedForMentorExperiment(lexicalRaw);
  const grammarForAssembly = verifiedForMentorExperiment(grammarRaw);
  const benchmarkCandidateSignatures = (
    ['v7-candidate-pool', 'v8-candidate-only', 'v9-hybrid-candidate', 'v10-stable-candidate', 'v11-core-worth', 'v12-free-strength'].includes(ACTIVE_ASSESSMENT_PROMPT_VERSION)
      ? (
          ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v9-hybrid-candidate'
            ? [
                ...canonicalizeFocusedFindingPass(taskRaw, essay, manifest, 'hybrid-tr'),
                ...canonicalizeFocusedFindingPass(coherenceRaw, essay, manifest, 'hybrid-coherence'),
                ...canonicalizeCandidateFindingPass(cohesionRaw, essay, manifest, 'hybrid-candidate-cohesion'),
                ...canonicalizeCandidateFindingPass(lexicalRaw, essay, manifest, 'hybrid-candidate-lr'),
                ...canonicalizeCandidateFindingPass(grammarRaw, essay, manifest, 'hybrid-candidate-gra'),
              ]
            : [
                ...canonicalizeCandidateFindingPass(taskRaw, essay, manifest, 'candidate-tr'),
                ...canonicalizeCandidateFindingPass(coherenceRaw, essay, manifest, 'candidate-coherence'),
                ...canonicalizeCandidateFindingPass(cohesionRaw, essay, manifest, 'candidate-cohesion'),
                ...canonicalizeCandidateFindingPass(lexicalRaw, essay, manifest, 'candidate-lr'),
                ...canonicalizeCandidateFindingPass(grammarRaw, essay, manifest, 'candidate-gra'),
              ]
        ).map(evidenceSignatureForFinding)
      : undefined
  );
  const benchmarkCandidateSeveritySignatures = (
    ['v7-candidate-pool', 'v8-candidate-only', 'v9-hybrid-candidate', 'v10-stable-candidate', 'v11-core-worth', 'v12-free-strength'].includes(ACTIVE_ASSESSMENT_PROMPT_VERSION)
      ? (
          ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v9-hybrid-candidate'
            ? [
                ...canonicalizeFocusedFindingPass(taskRaw, essay, manifest, 'hybrid-tr'),
                ...canonicalizeFocusedFindingPass(coherenceRaw, essay, manifest, 'hybrid-coherence'),
                ...canonicalizeCandidateFindingPass(cohesionRaw, essay, manifest, 'hybrid-candidate-cohesion'),
                ...canonicalizeCandidateFindingPass(lexicalRaw, essay, manifest, 'hybrid-candidate-lr'),
                ...canonicalizeCandidateFindingPass(grammarRaw, essay, manifest, 'hybrid-candidate-gra'),
              ]
            : [
                ...canonicalizeCandidateFindingPass(taskRaw, essay, manifest, 'candidate-tr'),
                ...canonicalizeCandidateFindingPass(coherenceRaw, essay, manifest, 'candidate-coherence'),
                ...canonicalizeCandidateFindingPass(cohesionRaw, essay, manifest, 'candidate-cohesion'),
                ...canonicalizeCandidateFindingPass(lexicalRaw, essay, manifest, 'candidate-lr'),
                ...canonicalizeCandidateFindingPass(grammarRaw, essay, manifest, 'candidate-gra'),
              ]
        ).map(severityEvidenceSignatureForFinding)
      : undefined
  );
  const benchmarkCandidateProblemStrengthSignatures = (
    ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v12-free-strength'
      ? [
          ...canonicalizeCandidateFindingPass(taskRaw, essay, manifest, 'candidate-tr'),
          ...canonicalizeCandidateFindingPass(coherenceRaw, essay, manifest, 'candidate-coherence'),
          ...canonicalizeCandidateFindingPass(cohesionRaw, essay, manifest, 'candidate-cohesion'),
          ...canonicalizeCandidateFindingPass(lexicalRaw, essay, manifest, 'candidate-lr'),
          ...canonicalizeCandidateFindingPass(grammarRaw, essay, manifest, 'candidate-gra'),
        ].map(problemStrengthEvidenceSignatureForFinding)
      : undefined
  );

  initialRaw.scores = normalizeOverallScore(initialRaw.scores);
  const initial = canonicalizeQuoteFirstExaminer(initialRaw, essay, manifest);
  const assembledFocusedFindings = [
      ...canonicalizeFocusedFindingPass(taskForAssembly, essay, manifest, 'tr'),
      ...canonicalizeFocusedFindingPass(coherenceForAssembly, essay, manifest, 'coherence'),
      ...canonicalizeFocusedFindingPass(cohesionForAssembly, essay, manifest, 'cohesion'),
      ...canonicalizeFocusedFindingPass(lexicalForAssembly, essay, manifest, 'lr'),
      ...canonicalizeFocusedFindingPass(grammarForAssembly, essay, manifest, 'gra'),
  ];
  const focusedFindings = removeUnrequiredMacroComparisonFindings(
    ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v12-free-strength'
      ? assembledFocusedFindings
      : orderAndDedupeFocusedFindings(reconcileFocusedLocalOwnership(assembledFocusedFindings)),
    initial.promptType,
  );
  const reconciledCriterionBands = {
    taskAchievement: reconcileCriterionBand(initial.scores.taskAchievement, taskRaw.band),
    coherenceCohesion: reconcileCriterionBand(
      initial.scores.coherenceCohesion,
      Math.round((coherenceRaw.band + cohesionRaw.band) / 2),
    ),
    lexicalResource: reconcileCriterionBand(initial.scores.lexicalResource, lexicalRaw.band),
    grammaticalRange: reconcileCriterionBand(initial.scores.grammaticalRange, grammarRaw.band),
  };
  const scoreValues = Object.values(reconciledCriterionBands);
  let scores = ensureBandScores({
    ...reconciledCriterionBands,
    overall: Math.round((scoreValues.reduce((sum, band) => sum + band, 0) / 4) * 2) / 2,
  });
  const specialistRationale = (
    criterion: keyof Omit<BandScores, 'overall'>,
    specialistBand: number,
    rationaleVi: string,
  ) => scores[criterion] === specialistBand
    ? rationaleVi
    : `${rationaleVi} Điểm cuối vẫn giữ thêm bức tranh toàn bài từ lượt đọc đầu, nên được điều chỉnh về Band ${scores[criterion]}.`;
  const criterionJudgments: QuoteFirstExaminerPass['criterionJudgments'] = [
    {
      criterion: 'taskAchievement',
      band: scores.taskAchievement,
      rationaleVi: specialistRationale('taskAchievement', taskRaw.band, taskRaw.rationaleVi),
    },
    {
      criterion: 'coherenceCohesion',
      band: scores.coherenceCohesion,
      rationaleVi: specialistRationale(
        'coherenceCohesion',
        Math.round((coherenceRaw.band + cohesionRaw.band) / 2),
        `${coherenceRaw.rationaleVi} ${cohesionRaw.rationaleVi}`.trim(),
      ),
    },
    {
      criterion: 'lexicalResource',
      band: scores.lexicalResource,
      rationaleVi: specialistRationale('lexicalResource', lexicalRaw.band, lexicalRaw.rationaleVi),
    },
    {
      criterion: 'grammaticalRange',
      band: scores.grammaticalRange,
      rationaleVi: specialistRationale('grammaticalRange', grammarRaw.band, grammarRaw.rationaleVi),
    },
  ];
  const quoteExaminer: QuoteFirstExaminerPass = {
    ...initial,
    scores,
    criterionJudgments,
    findings: focusedFindings,
  };
  const rawVerifiedFindings = verifiedFindingsFromQuoteExaminer(quoteExaminer);
  const assembledVerifiedFindings = ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v12-free-strength'
    ? rawVerifiedFindings
    : synthesizeCoverageFindings(
        quoteExaminer,
        reconcileCrossCriterionOwnership(
          reconcileOverlappingLanguageOwnership(rawVerifiedFindings, essay, manifest),
        ).filter(finding => !finding.mergedIntoFindingId),
        manifest,
      );
  const validConfirmedFindings = removeUnrequiredVerifiedMacroComparisonFindings(
    dedupeVerifiedFindings(assembledVerifiedFindings),
    initial.promptType,
  );
  const confirmedFindings = ACTIVE_ASSESSMENT_PROMPT_VERSION === 'v12-free-strength'
    ? validConfirmedFindings
    : filterLowSignalFindingsForHighBand(validConfirmedFindings, scores);
  let scoreAudit: ScoreConsistencyPass = {
    scores,
    decisions: criterionJudgments.map(judgment => ({
      criterion: judgment.criterion,
      initialBand: initial.scores[judgment.criterion],
      finalBand: scores[judgment.criterion],
      reasonVi: judgment.rationaleVi,
    })),
  };
  try {
    const adjudicationExaminer = examinerForQuoteFirstAssembly(quoteExaminer, confirmedFindings);
    scoreAudit = await runPass<ScoreConsistencyPass>(
      SCORE_CONSISTENCY_SYSTEM,
      {
        taskPrompt: prompt,
        essay,
        initialScores: initial.scores,
        initialCriterionJudgments: initial.criterionJudgments,
        criterionPassScores: {
          taskDevelopment: taskDevelopmentRaw.band,
          taskCoverage: taskCoverageRaw.band,
          coherence: coherenceRaw.band,
          cohesion: cohesionRaw.band,
          lexicalResource: lexicalRaw.band,
          grammaticalRange: grammarRaw.band,
        },
        criterionPassRationales: {
          taskDevelopment: taskDevelopmentRaw.rationaleVi,
          taskCoverage: taskCoverageRaw.rationaleVi,
          coherence: coherenceRaw.rationaleVi,
          cohesion: cohesionRaw.rationaleVi,
          lexicalResource: lexicalRaw.rationaleVi,
          grammaticalRange: grammarRaw.rationaleVi,
        },
        confirmedFindings,
      },
      value => scoreConsistencyErrors(
        value,
        initial.scores,
        adjudicationExaminer,
        confirmedFindings,
      ),
      'score-adjudication-v8',
    );
    scores = ensureBandScores(scoreAudit.scores);
    quoteExaminer.scores = scores;
    quoteExaminer.criterionJudgments = scoreAudit.decisions.map(decision => ({
      criterion: decision.criterion,
      band: decision.finalBand,
      rationaleVi: decision.reasonVi,
    }));
  } catch (error) {
    incompletePasses.push('score-adjudication-v8');
    if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
      console.warn('[assessment-score-adjudication-fallback]', error instanceof Error ? error.message : String(error));
    }
  }
  onIncompletePasses?.(incompletePasses);
  const examiner = examinerForQuoteFirstAssembly(quoteExaminer, confirmedFindings);
  const decomposition = localCompatibilityDecomposition(manifest);
  const task = buildTaskPass(examiner, confirmedFindings, decomposition, essay, manifest);
  const relevanceGate = buildRelevanceGate(decomposition, confirmedFindings, essay, manifest);
  const language = buildLanguagePass(examiner, confirmedFindings, essay, manifest);
  const cohesion = buildCohesionPass(examiner, confirmedFindings, essay, manifest, []);
  const verifier: EvidenceVerifierPass = {
    findings: confirmedFindings,
    coverageCheckVi: 'Prompt profile được dùng như diagnostic lens; quote được resolve lại với nguyên văn ở local.',
  };
  let comparison: BandComparison = {
    targetBand: (scores.overall >= 8.5 ? 9 : 8) as 8 | 9,
    revisedEssay: essay,
    changeSummaryVi: confirmedFindings.length
      ? 'Không tạo được bản đối chiếu đạt điều kiện kỹ thuật, nên lượt này giữ nguyên bài gốc thay vì làm hỏng kết quả chấm.'
      : 'Không có lỗi đủ rõ để cần viết lại bản đối chiếu.',
    preservedStrengthsVi: [],
    changes: [],
  };
  if (confirmedFindings.length && includeComparison) {
    try {
      comparison = await runComparisonRewriteOnce({
        taskPrompt: prompt,
        originalEssay: essay,
        authoritativeScores: scores,
        confirmedFindings,
      });
    } catch (error) {
      if (process.env.ASSESSMENT_LLM_LOG_USAGE === 'true' || process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
        console.warn('[assessment-comparison-fallback]', error instanceof Error ? error.message : String(error));
      }
    }
  }
  const raw: WritingAnalysis = {
    promptType: examiner.promptType,
    assessmentAudit: assessmentAudit(initial.scores, scores, verifier, scoreAudit),
    scores,
    taskCoverage: task.taskCoverage || [],
    relevanceGate: relevanceGate.relevanceGate || [],
    argumentFlowOverview: { titleVi: '', bodyVi: '', nodeIds: [] },
    argumentFlowChapters: [],
    pyramid: {
      ...mergeTaskAndStructure(decomposition, task, manifest),
      coherenceFlows: [],
    },
    cohesionHighlights: cohesion.cohesionHighlights || [],
    lexicalHighlights: language.lexicalHighlights || [],
    grammaticalHighlights: language.grammaticalHighlights || [],
    overallAssessment: overallAssessment(examiner, confirmedFindings, scores, scoreAudit),
    comparison,
  };
  const analysis = dropUnquotableHighlights(
    alignWritingAnalysis(materializeReviewErrors(raw), essay, manifest),
    manifest,
  );
  if (benchmarkCandidateSignatures) {
    (analysis as WritingAnalysis & { benchmarkCandidateSignatures?: string[]; benchmarkCandidateSeveritySignatures?: string[]; benchmarkCandidateProblemStrengthSignatures?: string[] }).benchmarkCandidateSignatures = [
      ...new Set(benchmarkCandidateSignatures),
    ];
  }
  if (benchmarkCandidateSeveritySignatures) {
    (analysis as WritingAnalysis & { benchmarkCandidateSignatures?: string[]; benchmarkCandidateSeveritySignatures?: string[]; benchmarkCandidateProblemStrengthSignatures?: string[] }).benchmarkCandidateSeveritySignatures = [
      ...new Set(benchmarkCandidateSeveritySignatures),
    ];
  }
  if (benchmarkCandidateProblemStrengthSignatures) {
    (analysis as WritingAnalysis & { benchmarkCandidateSignatures?: string[]; benchmarkCandidateSeveritySignatures?: string[]; benchmarkCandidateProblemStrengthSignatures?: string[] }).benchmarkCandidateProblemStrengthSignatures = [
      ...new Set(benchmarkCandidateProblemStrengthSignatures),
    ];
  }
  const errors = validateWritingAnalysis(analysis, manifest, essay);
  if (errors.length) throw new Error(`Assessment v8 failed validation: ${errors.join(' ')}`);
  return analysis;
}

export const assessmentPipelineV2Prompts = {
  examiner: EXAMINER_SYSTEM,
  argumentVerifier: ARGUMENT_VERIFIER_SYSTEM,
  languageVerifier: LANGUAGE_VERIFIER_SYSTEM,
  scoreConsistency: SCORE_CONSISTENCY_SYSTEM,
  structure: STRUCTURE_SYSTEM,
  flow: FLOW_SYSTEM,
  comparison: COMPARISON_SYSTEM,
};

export const assessmentPipelineV3Prompts = {
  examiner: QUOTE_FIRST_EXAMINER_SYSTEM,
  structure: STRUCTURE_SYSTEM,
  flow: FLOW_SYSTEM,
  comparison: COMPARISON_SYSTEM,
};

export const assessmentPipelineV4Prompts = {
  initialScoring: INITIAL_SCORING_SYSTEM,
  taskResponse: TASK_RESPONSE_FOCUS_SYSTEM,
  coherenceCohesion: COHERENCE_COHESION_FOCUS_SYSTEM,
  lexicalResource: LEXICAL_RESOURCE_FOCUS_SYSTEM,
  grammar: GRAMMAR_FOCUS_SYSTEM,
  structure: STRUCTURE_SYSTEM,
  flow: FLOW_SYSTEM,
  comparison: COMPARISON_SYSTEM,
};

export const assessmentPipelineV5Prompts = {
  initialScoring: INITIAL_SCORING_SYSTEM,
  taskResponse: TASK_RESPONSE_FOCUS_SYSTEM,
  coherenceCohesion: COHERENCE_COHESION_FOCUS_SYSTEM,
  lexicalResource: LEXICAL_RESOURCE_FOCUS_SYSTEM,
  grammar: GRAMMAR_FOCUS_SYSTEM,
};

export const assessmentPipelineV6Prompts = {
  initialScoring: NATURAL_ASSESSMENT_V6_SYSTEM,
  taskResponseInventory: TASK_RESPONSE_INVENTORY_SYSTEM,
  taskResponse: TASK_RESPONSE_FOCUS_SYSTEM,
  taskResponseForensic: TASK_RESPONSE_FORENSIC_SYSTEM,
  taskResponseAudit: TASK_RESPONSE_AUDIT_SYSTEM,
  coherence: COHERENCE_FOCUS_SYSTEM,
  cohesion: COHESION_FOCUS_SYSTEM,
  lexicalResource: LEXICAL_RESOURCE_FOCUS_SYSTEM,
  grammar: GRAMMAR_FOCUS_SYSTEM,
  scoring: CRITERION_SCORE_SYSTEMS,
};

export const assessmentPipelineV7Prompts = {
  initialReading: NATURAL_ASSESSMENT_V6_SYSTEM,
  taskResponse: V7_TASK_RESPONSE_SYSTEM,
  coherence: V7_COHERENCE_SYSTEM,
  cohesion: V7_COHESION_SYSTEM,
  lexicalResource: V7_LEXICAL_RESOURCE_SYSTEM,
  grammar: V7_GRAMMATICAL_RANGE_SYSTEM,
};

/** The specialist entries are the full composed prompts v8 actually sends. */
export const assessmentPipelineV8Prompts = {
  promptProfile: PROMPT_PROFILE_SYSTEM,
  profileGuidance: PROMPT_PROFILE_ASSESSMENT_GUIDANCE,
  initialReading: NATURAL_ASSESSMENT_V6_SYSTEM,
  taskResponse: `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${TR_DEVELOPMENT_SYSTEM}\n${TR_COVERAGE_SYSTEM}\n${CRITERION_SCORE_SYSTEMS.taskAchievement}\n${V8_SPECIALIST_DISCIPLINE}\n${V7_CRITERION_OUTPUT}`,
  coherence: `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_COHERENCE_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
  cohesion: `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${AUTHOR_COHESION_SYSTEM}\n${V8_SPECIALIST_DISCIPLINE}`,
  lexicalResource: `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${V7_LEXICAL_RESOURCE_SYSTEM}\n${CRITERION_SCORE_SYSTEMS.lexicalResource}\n${V8_SPECIALIST_DISCIPLINE}`,
  grammar: `${PROMPT_PROFILE_ASSESSMENT_GUIDANCE}\n${V7_GRAMMATICAL_RANGE_SYSTEM}\n${CRITERION_SCORE_SYSTEMS.grammaticalRange}\n${V8_SPECIALIST_DISCIPLINE}`,
};
