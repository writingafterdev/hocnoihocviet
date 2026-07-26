import type {
  AssessmentEvidenceSpan,
  EssayHighlight,
  PyramidError,
  PyramidIssue,
  WritingAnalysis,
} from '@/types/writing';
import { isTaxonomyCodeFor, TAXONOMY_BY_CODE, type AssessmentCriterion } from '@/lib/assessment-error-taxonomy';

export interface EssaySentenceManifest {
  index: number;
  startChar: number;
  endChar: number;
  text: string;
}

export interface EssayParagraphManifest {
  index: number;
  startChar: number;
  endChar: number;
  text: string;
  sentences: EssaySentenceManifest[];
}

function sentenceManifest(text: string, paragraphStart: number): EssaySentenceManifest[] {
  const sentences: EssaySentenceManifest[] = [];
  const matcher = /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text))) {
    const leading = match[0].length - match[0].trimStart().length;
    const value = match[0].trim();
    if (!value) continue;
    const startChar = paragraphStart + match.index + leading;
    sentences.push({
      index: sentences.length + 1,
      startChar,
      endChar: startChar + value.length,
      text: value,
    });
  }

  return sentences;
}

export function buildEssayManifest(essay: string): EssayParagraphManifest[] {
  const paragraphs: EssayParagraphManifest[] = [];
  const matcher = /\S(?:[\s\S]*?\S)?(?=\n\s*\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(essay))) {
    const text = match[0];
    const startChar = match.index;
    paragraphs.push({
      index: paragraphs.length,
      startChar,
      endChar: startChar + text.length,
      text,
      sentences: sentenceManifest(text, startChar),
    });
  }

  return paragraphs;
}

export function manifestForPrompt(manifest: EssayParagraphManifest[]) {
  return manifest.map(paragraph => ({
    index: paragraph.index,
    paragraphStartChar: paragraph.startChar,
    paragraphEndChar: paragraph.endChar,
    sentences: paragraph.sentences,
  }));
}

function errorFromIssue(issue: PyramidIssue): PyramidError {
  const action = issue.solutionActions?.[0];
  const proposedFix = action
    ? {
        type: action.type === 'rewrite_node'
          ? 'rewrite' as const
          : action.type === 'change_role'
            ? 'change_role' as const
            : action.type === 'change_relationship_tag'
              ? 'change_relationship' as const
              : 'add_node' as const,
        details: action.details,
        proposedText: action.proposedText,
        whyBetter: action.whyBetter,
      }
    : undefined;

  return {
    errorCode: issue.errorCode,
    errorLabelVi: issue.errorLabelVi,
    type: issue.type === 'internal' || issue.type === 'weak_support' || issue.type === 'unsupported_claim'
      ? 'internal'
      : 'relational',
    direction: issue.direction,
    message: issue.title,
    explanation: [issue.whyWrong, issue.impactOnPurpose, issue.impactOnReader].filter(Boolean).join(' '),
    suggestion: action?.details,
    affectedNodes: issue.affectedNodes,
    proposedFix,
    comment: issue.comment,
    descriptorAnchor: issue.descriptorAnchor,
  };
}

export function materializeReviewErrors(analysis: WritingAnalysis): WritingAnalysis {
  const paragraphs = analysis.pyramid.paragraphs.map(paragraph => ({
    ...paragraph,
    errors: paragraph.errors?.length
      ? paragraph.errors
      : paragraph.review?.issues?.map(errorFromIssue) || [],
    sentences: paragraph.sentences?.map(sentence => ({
      ...sentence,
      errors: sentence.errors?.length
        ? sentence.errors
        : sentence.review?.issues?.map(errorFromIssue) || [],
    })) || [],
  }));

  return { ...analysis, pyramid: { ...analysis.pyramid, paragraphs } };
}

export function validateWritingAnalysis(
  analysis: WritingAnalysis,
  manifest: EssayParagraphManifest[],
  essay?: string,
) {
  const errors: string[] = [];
  const paragraphs = analysis?.pyramid?.paragraphs;
  const sourceSentences = manifest.flatMap(paragraph => paragraph.sentences.map(sentence => sentence.text));

  const exactSourceText = (
    startChar: number,
    endChar: number,
    sourceText: string | undefined,
    context: string,
  ) => {
    if (
      !sourceText
      || !Number.isInteger(startChar)
      || !Number.isInteger(endChar)
      || startChar < 0
      || endChar < startChar
      || (essay !== undefined && endChar > essay.length)
    ) {
      errors.push(`${context} must use a valid exact source range.`);
      return;
    }

    const containingParagraph = manifest.find(
      paragraph => startChar >= paragraph.startChar && endChar <= paragraph.endChar,
    );
    const selectedText = essay !== undefined
      ? essay.slice(startChar, endChar)
      : containingParagraph?.text.slice(
          startChar - containingParagraph.startChar,
          endChar - containingParagraph.startChar,
        );

    if (selectedText !== sourceText) {
      errors.push(`${context} range must select its exact sourceText.`);
    }
  };

  const validateEvidenceSpans = (spans: AssessmentEvidenceSpan[] | undefined, context: string) => {
    spans?.forEach((span, index) => exactSourceText(
      span.startChar,
      span.endChar,
      span.sourceText,
      `${context} evidence ${index + 1}`,
    ));
  };

  const validateDescriptor = (
    errorCode: string | undefined,
    errorLabelVi: string | undefined,
    anchor: PyramidIssue['descriptorAnchor'],
    criteria: AssessmentCriterion[],
    context: string,
    allowUiLabel = false,
  ) => {
    if (!isTaxonomyCodeFor(errorCode, criteria)) {
      errors.push(`${context} uses an error code outside its criterion: ${errorCode || 'none'}.`);
      return;
    }
    const entry = TAXONOMY_BY_CODE.get(errorCode as string);
    if (!anchor || anchor.featureCode !== errorCode || anchor.featureEn !== entry?.descriptorFeatureEn) {
      errors.push(`${context} is not anchored to the supplied IELTS descriptor feature for ${errorCode}.`);
    }
    const allowedSpecificCohesionLabel = errorCode === 'faulty_sentence_link'
      && Boolean(errorLabelVi?.trim())
      && !/liên kết trong câu bị lỗi|faulty sentence link|điểm cần sửa/i.test(errorLabelVi || '');
    if (entry && errorLabelVi !== entry.labelVi && !allowedSpecificCohesionLabel && !allowUiLabel) {
      errors.push(`${context} does not use the fixed label for ${errorCode}.`);
    }
  };

  if (!Array.isArray(analysis.taskCoverage) || analysis.taskCoverage.some(item => !item.requirement)) {
    errors.push('Every taskCoverage item must use the exact field "requirement".');
  }

  if (!Array.isArray(paragraphs) || paragraphs.length !== manifest.length) {
    errors.push(`Expected ${manifest.length} paragraphs, received ${paragraphs?.length ?? 0}.`);
    return errors;
  }

  manifest.forEach((expected, paragraphIndex) => {
    const paragraph = paragraphs[paragraphIndex];
    if (paragraph.index !== expected.index) {
      errors.push(`Paragraph ${paragraphIndex} must use zero-based index ${expected.index}.`);
    }
    if (!Array.isArray(paragraph.sentences)) {
      errors.push(`Paragraph ${paragraphIndex} must contain the field "sentences".`);
      return;
    }
    if (paragraph.review?.status !== 'works' && !paragraph.errors?.length) {
      errors.push(`Paragraph ${paragraphIndex} is ${paragraph.review?.status} but has no renderable paragraph error.`);
    }
    paragraph.errors?.forEach((error, index) => validateDescriptor(
      error.errorCode,
      error.errorLabelVi,
      error.descriptorAnchor,
      ['task_response'],
      `Paragraph ${paragraphIndex} error ${index + 1}`,
    ));
    if (paragraph.sentences.length < expected.sentences.length) {
      errors.push(`Paragraph ${paragraphIndex} has ${expected.sentences.length} complete sentences but only ${paragraph.sentences.length} information chunks.`);
    }

    expected.sentences.forEach(sentence => {
      const chunks = paragraph.sentences.filter(chunk => chunk.sourceSentenceIndex === sentence.index);
      if (!chunks.length) {
        errors.push(`Paragraph ${paragraphIndex}, sentence ${sentence.index} has no information chunk.`);
      }
      chunks.forEach(chunk => {
        if (!chunk.sourceText || !sentence.text.includes(chunk.sourceText)) {
          errors.push(`Chunk ${chunk.nodeId || `${paragraphIndex}-${chunk.index}`} must provide sourceText copied from paragraph ${paragraphIndex}, sentence ${sentence.index}.`);
        }
        exactSourceText(
          chunk.startChar,
          chunk.endChar,
          chunk.sourceText,
          `Chunk ${chunk.nodeId || `${paragraphIndex}-${chunk.index}`}`,
        );
        if (chunk.startChar < sentence.startChar || chunk.endChar > sentence.endChar) {
          errors.push(`Chunk ${chunk.nodeId || `${paragraphIndex}-${chunk.index}`} range must stay inside its source sentence.`);
        }
        if (chunk.review?.status !== 'works' && !chunk.errors?.length) {
          errors.push(`Chunk ${chunk.nodeId || `${paragraphIndex}-${chunk.index}`} is ${chunk.review?.status} but has no renderable error.`);
        }
        chunk.errors?.forEach((error, index) => validateDescriptor(
          error.errorCode,
          error.errorLabelVi,
          error.descriptorAnchor,
          ['task_response'],
          `Chunk ${chunk.nodeId || `${paragraphIndex}-${chunk.index}`} error ${index + 1}`,
        ));
      });
    });
  });

  validateEvidenceSpans(analysis.pyramid.macroAnswer?.errors?.flatMap(error => error.evidenceSpans || []), 'Macro answer');
  validateEvidenceSpans(analysis.pyramid.macroAnswer?.review?.issues?.flatMap(issue => issue.evidenceSpans || []), 'Macro answer review');
  paragraphs.forEach((paragraph, paragraphIndex) => {
    validateEvidenceSpans(paragraph.errors?.flatMap(error => error.evidenceSpans || []), `Paragraph ${paragraphIndex}`);
    validateEvidenceSpans(paragraph.review?.issues?.flatMap(issue => issue.evidenceSpans || []), `Paragraph ${paragraphIndex} review`);
    paragraph.sentences?.forEach((sentence, sentenceIndex) => {
      validateEvidenceSpans(sentence.errors?.flatMap(error => error.evidenceSpans || []), `Chunk ${paragraphIndex}-${sentenceIndex + 1}`);
      validateEvidenceSpans(sentence.review?.issues?.flatMap(issue => issue.evidenceSpans || []), `Chunk ${paragraphIndex}-${sentenceIndex + 1} review`);
    });
  });
  analysis.pyramid.edgeReviews?.forEach((review, index) => {
    validateEvidenceSpans(review.issues?.flatMap(issue => issue.evidenceSpans || []), `Edge review ${index + 1}`);
  });
  analysis.pyramid.coherenceFlows?.forEach((flow, index) => {
    validateEvidenceSpans(flow.issue?.evidenceSpans, `Coherence flow ${index + 1}`);
  });

  if (analysis.relevanceGate) {
    const expectedChunkIds = paragraphs.flatMap(paragraph => paragraph.sentences.map(sentence => sentence.nodeId));
    const gateIds = analysis.relevanceGate.map(item => item.nodeId);
    const gateIdSet = new Set(gateIds);
    if (gateIds.length !== expectedChunkIds.length || gateIdSet.size !== gateIds.length) {
      errors.push('relevanceGate must contain exactly one item for every original information chunk.');
    }
    analysis.relevanceGate.forEach(item => {
      if (!expectedChunkIds.includes(item.nodeId)) {
        errors.push(`relevanceGate contains unknown chunk ${item.nodeId}.`);
      }
      if (!Number.isInteger(item.paragraphIndex) || item.paragraphIndex < 0 || item.paragraphIndex >= manifest.length) {
        errors.push(`relevanceGate item ${item.nodeId} has an invalid paragraphIndex.`);
      }
      if (item.status === 'eligible' && (!item.coherenceEligible || item.paragraphRoleFit !== 'fits')) {
        errors.push(`relevanceGate item ${item.nodeId} is eligible but not coherence-eligible.`);
      }
      if (item.status !== 'eligible' && item.coherenceEligible) {
        errors.push(`relevanceGate item ${item.nodeId} must be excluded from coherence.`);
      }
    });
  }

  (analysis.pyramid.coherenceFlows || []).forEach(flow => {
    if (flow.status === 'works') return;
    validateDescriptor(
      flow.issue?.errorCode,
      flow.issue?.errorLabelVi,
      flow.issue?.descriptorAnchor,
      ['coherence'],
      `Coherence flow ${flow.edgeId}`,
    );
  });

  const validateHighlights = (
    highlights: EssayHighlight[],
    criteria: AssessmentCriterion[],
    label: string,
    requireReplacement = false,
  ) => {
    highlights.forEach((highlight, index) => {
      validateDescriptor(
        highlight.errorCode,
        highlight.errorLabelVi,
        highlight.descriptorAnchor,
        criteria,
        `${label} highlight ${index + 1}`,
        highlight.highlightType === 'style_suggestion',
      );
      if (!highlight.sourceText || !sourceSentences.some(sentence => sentence.includes(highlight.sourceText as string))) {
        errors.push(`${label} highlight ${index + 1} must quote exact English source text.`);
      }
      exactSourceText(
        highlight.startChar,
        highlight.endChar,
        highlight.sourceText,
        `${label} highlight ${index + 1}`,
      );
      const sourceParagraph = Number.isInteger(highlight.paragraphIndex)
        ? manifest[highlight.paragraphIndex as number]
        : undefined;
      if (highlight.paragraphIndex !== undefined && !sourceParagraph) {
        errors.push(`${label} highlight ${index + 1} has an invalid paragraphIndex.`);
      }
      if (sourceParagraph && highlight.sourceText && !sourceParagraph.text.includes(highlight.sourceText)) {
        errors.push(`${label} highlight ${index + 1} quotes text outside paragraph ${highlight.paragraphIndex}.`);
      }
      if (
        sourceParagraph
        && (highlight.startChar < sourceParagraph.startChar || highlight.endChar > sourceParagraph.endChar)
      ) {
        errors.push(`${label} highlight ${index + 1} range falls outside paragraph ${highlight.paragraphIndex}.`);
      }
      if (requireReplacement && (!highlight.replacementText?.trim() || highlight.replacementText === highlight.sourceText)) {
        errors.push(`${label} highlight ${index + 1} must include a local English replacement.`);
      }
    });
  };
  validateHighlights(analysis.cohesionHighlights || [], ['cohesion'], 'Cohesion');
  validateHighlights(analysis.lexicalHighlights || [], ['lexical_resource'], 'Lexical', true);
  validateHighlights(analysis.grammaticalHighlights || [], ['grammatical_range_accuracy'], 'Grammar', true);

  const revisedWordCount = analysis.comparison?.revisedEssay?.trim().split(/\s+/).filter(Boolean).length || 0;
  if (!revisedWordCount) {
    errors.push('The comparison must include a revised essay.');
  }


  return errors;
}

function alignHighlight(
  essay: string,
  manifest: EssayParagraphManifest[],
  highlight: EssayHighlight,
) {
  if (!highlight.sourceText) return highlight;
  const preferredStart = Number.isFinite(highlight.startChar) ? highlight.startChar : 0;
  const paragraph = Number.isInteger(highlight.paragraphIndex)
    ? manifest[highlight.paragraphIndex as number]
    : undefined;
  const searchFrom = paragraph?.startChar ?? 0;
  const searchUntil = paragraph?.endChar ?? essay.length;
  const candidates: number[] = [];
  let cursor = essay.indexOf(highlight.sourceText, searchFrom);
  while (cursor >= 0 && cursor + highlight.sourceText.length <= searchUntil) {
    candidates.push(cursor);
    cursor = essay.indexOf(highlight.sourceText, cursor + 1);
  }
  if (!candidates.length) return highlight;
  const startChar = candidates.sort((left, right) => Math.abs(left - preferredStart) - Math.abs(right - preferredStart))[0];
  return { ...highlight, startChar, endChar: startChar + highlight.sourceText.length };
}

function alignEvidenceSpan(essay: string, span: AssessmentEvidenceSpan): AssessmentEvidenceSpan {
  if (!span.sourceText) return span;
  const preferredStart = Number.isFinite(span.startChar) ? span.startChar : 0;
  const candidates: number[] = [];
  let cursor = essay.indexOf(span.sourceText);
  while (cursor >= 0) {
    candidates.push(cursor);
    cursor = essay.indexOf(span.sourceText, cursor + 1);
  }
  if (!candidates.length) return span;
  const startChar = candidates.sort((left, right) => Math.abs(left - preferredStart) - Math.abs(right - preferredStart))[0];
  return { ...span, startChar, endChar: startChar + span.sourceText.length };
}

function alignEvidenceOwner<T extends { evidenceSpans?: AssessmentEvidenceSpan[] }>(essay: string, owner: T): T {
  if (!owner.evidenceSpans) return owner;
  return { ...owner, evidenceSpans: owner.evidenceSpans.map(span => alignEvidenceSpan(essay, span)) };
}

function alignReviewIssues<T extends { issues?: Array<{ evidenceSpans?: AssessmentEvidenceSpan[] }> }>(
  essay: string,
  review: T,
): T {
  return {
    ...review,
    issues: (review.issues || []).map(issue => alignEvidenceOwner(essay, issue)),
  } as T;
}

export function alignWritingAnalysis(
  analysis: WritingAnalysis,
  essay: string,
  manifest: EssayParagraphManifest[],
): WritingAnalysis {
  const paragraphs = analysis.pyramid.paragraphs.map((paragraph, paragraphIndex) => {
    const expectedParagraph = manifest[paragraphIndex];
    if (!expectedParagraph) return paragraph;
    const sentenceCursors = new Map<number, number>();
    const sentences = paragraph.sentences.map((chunk, chunkIndex) => {
      const sourceSentence = expectedParagraph.sentences.find(sentence => sentence.index === chunk.sourceSentenceIndex);
      if (!sourceSentence || !chunk.sourceText) return chunk;
      const searchStart = sentenceCursors.get(sourceSentence.index) ?? sourceSentence.startChar;
      let startChar = essay.indexOf(chunk.sourceText, searchStart);
      if (startChar < sourceSentence.startChar || startChar + chunk.sourceText.length > sourceSentence.endChar) {
        startChar = essay.indexOf(chunk.sourceText, sourceSentence.startChar);
      }
      if (startChar < sourceSentence.startChar || startChar + chunk.sourceText.length > sourceSentence.endChar) return chunk;
      sentenceCursors.set(sourceSentence.index, startChar + chunk.sourceText.length);
      return {
        ...chunk,
        index: chunkIndex + 1,
        chunkIndex: chunkIndex + 1,
        nodeId: `sentence-${paragraphIndex}-${chunkIndex + 1}`,
        startChar,
        endChar: startChar + chunk.sourceText.length,
      };
    });

    return {
      ...paragraph,
      index: expectedParagraph.index,
      paragraphStartChar: expectedParagraph.startChar,
      paragraphEndChar: expectedParagraph.endChar,
      errors: paragraph.errors?.map(error => alignEvidenceOwner(essay, error)) || [],
      review: paragraph.review
        ? alignReviewIssues(essay, paragraph.review)
        : paragraph.review,
      sentences,
    };
  });

  const alignedParagraphs = paragraphs.map(paragraph => ({
    ...paragraph,
    sentences: paragraph.sentences.map(sentence => ({
      ...sentence,
      errors: sentence.errors?.map(error => alignEvidenceOwner(essay, error)) || [],
      review: sentence.review
        ? alignReviewIssues(essay, sentence.review)
        : sentence.review,
    })),
  }));

  return {
    ...analysis,
    pyramid: {
      ...analysis.pyramid,
      macroAnswer: {
        ...analysis.pyramid.macroAnswer,
        errors: analysis.pyramid.macroAnswer.errors?.map(error => alignEvidenceOwner(essay, error)) || [],
        review: analysis.pyramid.macroAnswer.review
          ? alignReviewIssues(essay, analysis.pyramid.macroAnswer.review)
          : analysis.pyramid.macroAnswer.review,
      },
      paragraphs: alignedParagraphs,
      edgeReviews: analysis.pyramid.edgeReviews?.map(review => ({
        ...review,
        issues: (review.issues || []).map(issue => alignEvidenceOwner(essay, issue)),
      })),
      coherenceFlows: analysis.pyramid.coherenceFlows?.map(flow => ({
        ...flow,
        issue: alignEvidenceOwner(essay, flow.issue),
      })),
    },
    cohesionHighlights: analysis.cohesionHighlights.map(highlight => alignHighlight(essay, manifest, highlight)),
    lexicalHighlights: analysis.lexicalHighlights.map(highlight => alignHighlight(essay, manifest, highlight)),
    grammaticalHighlights: analysis.grammaticalHighlights.map(highlight => alignHighlight(essay, manifest, highlight)),
  };
}
