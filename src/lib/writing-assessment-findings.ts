import type { BandScores, EssayHighlight, WritingAnalysis } from '@/types/writing';

export type AssessmentCriterionKey = keyof Omit<BandScores, 'overall'>;

const POSITIVE_LANGUAGE_CODES = new Set([
  'strong_academic_phrase',
  'controlled_complex_structure',
  'worth_preserving',
]);

function isPositiveLanguageHighlight(highlight: EssayHighlight) {
  if (highlight.errorCode && POSITIVE_LANGUAGE_CODES.has(highlight.errorCode)) return true;
  const marker = `${highlight.highlightType || ''} ${highlight.label || ''} ${highlight.errorLabelVi || ''} ${highlight.feedback || ''}`.toLowerCase();
  return /\b(strength|positive|worth_preserving|keep|preserve)\b/.test(marker)
    || /đáng giữ|kiểm soát tốt|dùng tự nhiên|giữ lại|cụm tốt/.test(marker);
}

export function confirmedFindingCounts(analysis: WritingAnalysis): Record<AssessmentCriterionKey, number> {
  const nodeErrors = [
    ...(analysis.pyramid.macroAnswer.errors || []),
    ...analysis.pyramid.paragraphs.flatMap(paragraph => [
      ...(paragraph.errors || []),
      ...paragraph.sentences.flatMap(sentence => sentence.errors || []),
    ]),
  ].length;
  const coverageGaps = (analysis.taskCoverage || []).filter(item => item.status !== 'fully_addressed').length;
  const semanticMacroIssues = (analysis.argumentFlowChapters || [])
    .filter(chapter => chapter.macroErrorType === 'semantic_alignment').length;
  const coherenceMacroIssues = (analysis.argumentFlowChapters || [])
    .filter(chapter => chapter.macroErrorType === 'coherence_order' || chapter.hasMacroRearrangement).length;

  return {
    taskAchievement:
      nodeErrors
      + coverageGaps
      + (analysis.pyramid.edgeReviews || []).filter(edge => edge.status !== 'works').length
      + semanticMacroIssues,
    coherenceCohesion:
      (analysis.pyramid.coherenceFlows || []).filter(flow => flow.status !== 'works').length
      + (analysis.cohesionHighlights || []).length
      + coherenceMacroIssues,
    lexicalResource: (analysis.lexicalHighlights || []).filter(highlight => !isPositiveLanguageHighlight(highlight)).length,
    grammaticalRange: (analysis.grammaticalHighlights || []).filter(highlight => !isPositiveLanguageHighlight(highlight)).length,
  };
}

export function assessmentHasConfirmedFindings(analysis: WritingAnalysis) {
  return Object.values(confirmedFindingCounts(analysis)).some(count => count > 0);
}

export function hasVerifiedComparisonChanges(analysis: WritingAnalysis, originalEssay: string) {
  const revisedEssay = analysis.comparison?.revisedEssay?.trim();
  return Boolean(revisedEssay && revisedEssay !== originalEssay.trim());
}
