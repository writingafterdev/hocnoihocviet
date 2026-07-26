'use client';

import { BandScores, EssayHighlight, PyramidError, WritingAnalysis } from '@/types/writing';
import { confirmedFindingCounts } from '@/lib/writing-assessment-findings';

type ScoreKey = keyof Omit<BandScores, 'overall'>;

interface OverallAssessmentPanelProps {
  scores: BandScores;
  analysis: WritingAnalysis;
  essay: string;
}

interface RevisionAction {
  key: ScoreKey;
  label: string;
  band: number;
  title: string;
  detail: string;
  evidence: string;
}

const DIMENSIONS: Array<{
  key: ScoreKey;
  label: string;
  shortLabel: string;
}> = [
  { key: 'taskAchievement', label: 'Task achievement', shortLabel: 'TA' },
  { key: 'coherenceCohesion', label: 'Coherence & cohesion', shortLabel: 'CC' },
  { key: 'lexicalResource', label: 'Lexical resource', shortLabel: 'LR' },
  { key: 'grammaticalRange', label: 'Grammar range & accuracy', shortLabel: 'GRA' },
];

const DESCRIPTOR_EXCERPTS: Record<ScoreKey, Record<number, string>> = {
  taskAchievement: {
    9: 'The prompt is appropriately addressed and explored in depth. A clear and fully developed position is presented. Ideas are relevant, fully extended and well supported.',
    8: 'The prompt is appropriately and sufficiently addressed. A clear and well-developed position is presented. Ideas are relevant, well extended and supported.',
    7: 'The main parts of the prompt are appropriately addressed. A clear and developed position is presented. Main ideas are extended and supported, though focus or precision may lapse.',
    6: 'The main parts of the prompt are addressed, though some may be more fully covered than others. Some main ideas may be insufficiently developed or lack clarity.',
    5: 'The main parts of the prompt are incompletely addressed. Some main ideas are limited and not sufficiently developed, or there may be irrelevant detail.',
    4: 'The prompt is tackled in a minimal or tangential way. Main ideas may lack relevance, clarity or support.',
  },
  coherenceCohesion: {
    9: 'The message can be followed effortlessly. Cohesion rarely attracts attention, and paragraphing is skilfully managed.',
    8: 'The message can be followed with ease. Information and ideas are logically sequenced, and cohesion is well managed.',
    7: 'Information and ideas are logically organised and there is a clear progression throughout the response. Paragraphing generally supports overall coherence.',
    6: 'Information and ideas are generally arranged coherently and there is a clear overall progression. Cohesion within or between sentences may be faulty or mechanical.',
    5: 'Organisation is evident but is not wholly logical. The relationship of ideas can be followed, but the sentences are not fluently linked to each other.',
    4: 'Information and ideas are evident but not arranged coherently, and there is no clear progression within the response.',
  },
  lexicalResource: {
    9: 'A wide range of vocabulary is used accurately and appropriately with very natural and sophisticated control of lexical features.',
    8: 'A wide resource is fluently and flexibly used to convey precise meanings. There is skilful use of uncommon or idiomatic items when appropriate.',
    7: 'The resource is sufficient to allow some flexibility and precision. There is awareness of style and collocation, though inappropriacies occur.',
    6: 'The resource is generally adequate and appropriate for the task. Meaning is generally clear despite restricted range or a lack of precision in word choice.',
    5: 'The resource is limited but minimally adequate. Frequent simplifications or repetitions can show a lack of flexibility.',
    4: 'The resource is limited and inadequate or unrelated to the task. Vocabulary is basic and may be used repetitively.',
  },
  grammaticalRange: {
    9: 'A wide range of structures is used with full flexibility and control. Punctuation and grammar are used appropriately throughout.',
    8: 'A wide range of structures is flexibly and accurately used. The majority of sentences are error-free, and punctuation is well managed.',
    7: 'A variety of complex structures is used with some flexibility and accuracy. Grammar and punctuation are generally well controlled, and error-free sentences are frequent.',
    6: 'A mix of simple and complex sentence forms is used but flexibility is limited. Errors occur, but rarely impede communication.',
    5: 'The range of structures is limited and rather repetitive. Complex sentences tend to be faulty, and grammatical errors may cause difficulty for the reader.',
    4: 'A very limited range of structures is used. Grammatical errors are frequent and may impede meaning.',
  },
};

function isNegativeHighlight(highlight: EssayHighlight) {
  const marker = `${highlight.highlightType} ${highlight.label}`.toLowerCase();
  return /(weak|missing|repetition|error|incorrect|awkward|vague|limited)/.test(marker);
}

function collectNodeErrors(analysis: WritingAnalysis) {
  return analysis.pyramid.paragraphs.flatMap(paragraph => [
    ...paragraph.errors,
    ...paragraph.sentences.flatMap(sentence => sentence.errors),
  ]);
}

function firstEvidence(errors: PyramidError[], fallback: string) {
  return errors[0]?.message || fallback;
}

function buildRevisionActions(scores: BandScores, analysis: WritingAnalysis): RevisionAction[] {
  const nodeErrors = collectNodeErrors(analysis);
  const edgeIssues = (analysis.pyramid.edgeReviews || []).filter(review => review.status !== 'works');
  const flowIssues = (analysis.pyramid.coherenceFlows || []).filter(flow => flow.status !== 'works');
  const semanticMacroIssues = (analysis.argumentFlowChapters || []).filter(chapter => chapter.macroErrorType === 'semantic_alignment');
  const coherenceMacroIssues = (analysis.argumentFlowChapters || []).filter(chapter => chapter.macroErrorType === 'coherence_order' || chapter.hasMacroRearrangement);
  const lexicalIssues = analysis.lexicalHighlights.filter(isNegativeHighlight);
  const grammarIssues = analysis.grammaticalHighlights.filter(isNegativeHighlight);

  const actions: RevisionAction[] = [];

  if (nodeErrors.length || semanticMacroIssues.length || (analysis.taskCoverage || []).some(item => item.status !== 'fully_addressed')) {
    actions.push({
      key: 'taskAchievement',
      label: 'TA',
      band: scores.taskAchievement,
      title: 'Strengthen the job of each argument unit',
      detail: 'Give each claim, reason, and example a specific role in proving the paragraph point. Replace illustrative scenes with a mechanism, fact, or explanation that carries the argument forward.',
      evidence: firstEvidence(nodeErrors, semanticMacroIssues[0]?.taskAuditVi || analysis.taskCoverage?.find(item => item.status !== 'fully_addressed')?.assessmentVi || ''),
    });
  }

  if (flowIssues.length || edgeIssues.length || coherenceMacroIssues.length || analysis.cohesionHighlights.length) {
    actions.push({
      key: 'coherenceCohesion',
      label: 'CC',
      band: scores.coherenceCohesion,
      title: 'Make the progression visible to the reader',
      detail: flowIssues.length
        ? 'Reorder or bridge the ideas so the evidence, claim, and conclusion appear in the order the reader needs.'
        : 'Repair the marked relationship or cohesion choice so the next idea is easier to connect to the previous one.',
      evidence: flowIssues[0]?.issue.whyWrong || coherenceMacroIssues[0]?.diagnosisIntroVi || edgeIssues[0]?.issues[0]?.whyWrong || analysis.cohesionHighlights[0]?.feedback || '',
    });
  }

  if (lexicalIssues.length) {
    actions.push({
      key: 'lexicalResource',
      label: 'LR',
      band: scores.lexicalResource,
      title: 'Replace broad wording with exact academic choices',
      detail: 'Revise the marked phrases for precision and register. Keep strong collocations, but vary repeated key nouns where the meaning allows it.',
      evidence: lexicalIssues[0].feedback,
    });
  }

  if (grammarIssues.length) {
    actions.push({
      key: 'grammaticalRange',
      label: 'GRA',
      band: scores.grammaticalRange,
      title: 'Edit for controlled sentence range',
      detail: 'Repair the marked structures, then reread the whole sentence for agreement, clause boundaries, tense, and reference.',
      evidence: grammarIssues[0].feedback,
    });
  }

  return actions.sort((left, right) => left.band - right.band || DIMENSIONS.findIndex(d => d.key === left.key) - DIMENSIONS.findIndex(d => d.key === right.key));
}

function descriptorBand(score: number) {
  return Math.max(4, Math.min(9, Math.floor(score)));
}

export default function OverallAssessmentPanel({
  scores,
  analysis,
}: OverallAssessmentPanelProps) {
  const revisionActions = buildRevisionActions(scores, analysis);
  const findingCounts = confirmedFindingCounts(analysis);
  const hasFindings = Object.values(findingCounts).some(count => count > 0);

  return (
    <section className="h-full min-h-0 overflow-y-auto rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)] hide-scrollbar">
      <div className="w-full">
        <div className="mb-5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/40">Overall + to-do</p>
          <h2 className="mt-2 font-sans text-[18px] font-semibold tracking-[-0.01em] text-[#171717]">
            Descriptor excerpts aligned to revision actions
          </h2>
        </div>

        {!hasFindings && (
          <div className="mb-5 rounded-[14px] border border-[#3478F6]/15 bg-[#F5F9FF] px-5 py-4">
            <p className="font-sans text-[14px] font-semibold text-[#171717]">Chưa có to-do được xác nhận</p>
            <p className="mt-2 max-w-[78ch] font-sans text-[11px] leading-relaxed text-[#565B63]">
              Lần đánh giá này không tìm thấy lỗi đủ rõ để tạo to-do. Đây không phải lời khẳng định bài hoàn hảo; hệ thống chỉ đối chiếu mức thể hiện hiện tại với band descriptors thay vì thêm lời khuyên chung không gắn với bài viết.
            </p>
          </div>
        )}

        <div className="overflow-hidden border border-[#7e8c9a]/40 bg-[#F8FAFC]">
          <div className="grid grid-cols-[minmax(380px,1.25fr)_minmax(300px,0.95fr)] border-b border-[#7e8c9a]/25 bg-white/50">
            <p className="px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#56616B]">Revision to-do</p>
            <p className="border-l border-[#7e8c9a]/25 px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#56616B]">IELTS Writing Task 2 descriptor</p>
          </div>
          <ol className="divide-y divide-[#7e8c9a]/20">
            {(hasFindings ? revisionActions : DIMENSIONS.map(dimension => ({
              key: dimension.key,
              label: dimension.shortLabel,
              band: scores[dimension.key],
              title: 'Không có action được xác nhận',
              detail: 'Không tạo to-do khi không có finding tương ứng.',
              evidence: '',
            }))).map((action, index) => {
              const dimension = DIMENSIONS.find(item => item.key === action.key);
              const band = descriptorBand(scores[action.key]);

              return (
                <li key={action.key} className="grid grid-cols-[minmax(380px,1.25fr)_minmax(300px,0.95fr)]">
                  <div className="bg-white/70 p-4">
                    {hasFindings ? <div className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-[10px] font-semibold text-[#2563EB]">{String(index + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-sans text-[12px] font-semibold text-[#171717]">{action.title}</h3>
                          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] text-[#737373]">{action.label} {action.band}</span>
                        </div>
                        <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#55524E]">{action.detail}</p>
                        <p className="mt-2 font-sans text-[10px] leading-relaxed text-[#77736D]">
                          <span className="font-semibold text-[#2563EB]">Trace: </span>{action.evidence}
                        </p>
                      </div>
                    </div> : (
                      <div className="flex h-full items-center gap-3">
                        <span className="font-mono text-[10px] font-semibold text-[#2563EB]">{action.label}</span>
                        <p className="font-sans text-[11px] text-[#737373]">Chưa có vấn đề đủ rõ để chuyển thành to-do trong lượt review này.</p>
                      </div>
                    )}
                  </div>
                  <div className="border-l border-[#7e8c9a]/20 p-4">
                    <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-[#56616B]">
                      {dimension?.shortLabel || action.label} · Band {band}
                    </p>
                    <p className="mt-2 font-sans text-[11px] font-semibold italic leading-[1.65] text-[#2C3338] [text-wrap:pretty]">
                      {DESCRIPTOR_EXCERPTS[action.key][band]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
