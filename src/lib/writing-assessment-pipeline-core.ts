import { AssessmentProviderError, generateAssessmentJSON } from '@/lib/assessment-llm';
import { TAXONOMY_BY_CODE } from '@/lib/assessment-error-taxonomy';
import type { EssayParagraphManifest } from '@/lib/writing-analysis-contract';
import type {
  ArgumentFlowChapter,
  ArgumentFlowOverview,
  BandScores,
  CoherenceFlow,
  EdgeReview,
  EssayHighlight,
  MacroAnswerNode,
  NodeReview,
  ParagraphMoveNode,
  RelevanceGateItem,
  SentenceAnnotation,
  SentenceRole,
  TaskCoverageItem,
  WritingAnalysis,
} from '@/types/writing';

export interface DecomposedChunk {
  nodeId: string;
  sourceSentenceIndex: number;
  sourceText: string;
  startChar?: number;
  endChar?: number;
  role: SentenceRole;
  simplifiedIdea: string;
  removedCohesiveDevices?: string[];
  mergedWithNodeId?: string;
}

export interface DecompositionPass {
  paragraphs: Array<{
    index: number;
    label: string;
    chunks: DecomposedChunk[];
    missingLinks?: Array<{ betweenNodeIds: string[]; impliedIdea: string }>;
  }>;
}

export interface TaskPass {
  taskAchievement: number;
  taskCoverage: TaskCoverageItem[];
  macroAnswer: Pick<MacroAnswerNode, 'text' | 'errors' | 'review'>;
  paragraphs: Array<{
    index: number;
    label: string;
    job: string;
    review: NodeReview;
    errors: ParagraphMoveNode['errors'];
    sentences: Array<Pick<SentenceAnnotation, 'nodeId' | 'review' | 'errors' | 'transitionToNext'>>;
    transitionToNext?: string;
  }>;
  edgeReviews: EdgeReview[];
}

export interface CoherencePass {
  coherenceCohesion: number;
  coherenceFlows: CoherenceFlow[];
  cohesionHighlights: EssayHighlight[];
}

export interface RelevanceGatePass {
  relevanceGate: RelevanceGateItem[];
}

export interface LanguagePass {
  lexicalResource: number;
  grammaticalRange: number;
  lexicalHighlights: EssayHighlight[];
  grammaticalHighlights: EssayHighlight[];
}

export interface ArgumentFlowPass {
  argumentFlowOverview: ArgumentFlowOverview;
  argumentFlowChapters: ArgumentFlowChapter[];
}

function roundBand(value: number) {
  return Math.round(value * 2) / 2;
}

function criterionBand(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 9) {
    throw new Error(`Criterion band must be a whole number from 0 to 9; received ${String(value)}.`);
  }
  return number;
}

export function ensureBandScores(scores: BandScores): BandScores {
  const taskAchievement = criterionBand(scores.taskAchievement);
  const coherenceCohesion = criterionBand(scores.coherenceCohesion);
  const lexicalResource = criterionBand(scores.lexicalResource);
  const grammaticalRange = criterionBand(scores.grammaticalRange);
  const overall = roundBand((taskAchievement + coherenceCohesion + lexicalResource + grammaticalRange) / 4);
  if (scores.overall !== overall) {
    throw new Error(`Overall band must equal ${overall}; received ${scores.overall}.`);
  }
  return { taskAchievement, coherenceCohesion, lexicalResource, grammaticalRange, overall };
}

export function normalizeDecomposition(result: DecompositionPass, manifest: EssayParagraphManifest[]): DecompositionPass {
  const idMap = new Map<string, string>();
  result.paragraphs.forEach(paragraph => {
    paragraph.chunks.forEach((chunk, index) => idMap.set(chunk.nodeId, `sentence-${paragraph.index}-${index + 1}`));
  });

  return {
    paragraphs: result.paragraphs.map(paragraph => {
      const sentenceCursors = new Map<number, number>();
      const expectedParagraph = manifest[paragraph.index];
      return {
        ...paragraph,
        chunks: paragraph.chunks.map((chunk, index) => {
          const sourceSentence = expectedParagraph?.sentences.find(sentence => sentence.index === chunk.sourceSentenceIndex);
          const searchStart = sentenceCursors.get(chunk.sourceSentenceIndex) ?? 0;
          const localStart = sourceSentence?.text.indexOf(chunk.sourceText, searchStart) ?? -1;
          if (sourceSentence && localStart >= 0) sentenceCursors.set(chunk.sourceSentenceIndex, localStart + chunk.sourceText.length);
          return {
            ...chunk,
            nodeId: `sentence-${paragraph.index}-${index + 1}`,
            startChar: sourceSentence && localStart >= 0 ? sourceSentence.startChar + localStart : chunk.startChar,
            endChar: sourceSentence && localStart >= 0 ? sourceSentence.startChar + localStart + chunk.sourceText.length : chunk.endChar,
            mergedWithNodeId: chunk.mergedWithNodeId ? idMap.get(chunk.mergedWithNodeId) || chunk.mergedWithNodeId : undefined,
          };
        }),
        missingLinks: paragraph.missingLinks?.map(link => ({
          ...link,
          betweenNodeIds: link.betweenNodeIds.map(nodeId => idMap.get(nodeId) || nodeId),
        })),
      };
    }),
  };
}

function canonicalizeTaxonomyFields(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(canonicalizeTaxonomyFields);
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.errorCode === 'string') {
    const entry = TAXONOMY_BY_CODE.get(record.errorCode);
    if (entry) {
      const criterion = entry.criterion === 'coherence' || entry.criterion === 'cohesion'
        ? 'coherence_cohesion'
        : entry.criterion;
      record.errorLabelVi = entry.labelVi;
      if ('label' in record) record.label = entry.labelVi;
      record.descriptorAnchor = {
        criterion,
        featureCode: entry.code,
        featureEn: entry.descriptorFeatureEn,
      };
    }
  }
  Object.values(record).forEach(canonicalizeTaxonomyFields);
}

function sanitizeVietnameseTextFields(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(sanitizeVietnameseTextFields);
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  Object.entries(record).forEach(([key, child]) => {
    if (typeof child === 'string' && key.endsWith('Vi')) {
      record[key] = child
        .replace(/\p{Script=Han}+/gu, '')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return;
    }
    sanitizeVietnameseTextFields(child);
  });
}

export async function runPass<T>(
  system: string,
  user: unknown,
  validate?: (value: T) => string[],
  label = 'unlabelled',
): Promise<T> {
  const prompt = JSON.stringify(user, null, 2);
  const generate = async (systemPrompt: string, userPrompt: string, requestLabel: string) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await generateAssessmentJSON<T>(
          attempt === 0
            ? systemPrompt
            : `${systemPrompt}\n\nFORMAT RETRY ${attempt}: Return exactly one complete JSON object with no Markdown or prose outside it.`,
          userPrompt,
          attempt === 0 ? requestLabel : `${requestLabel}:format-retry-${attempt}`,
        );
      } catch (error) {
        lastError = error;
        const retryableProviderFailure = error instanceof AssessmentProviderError
          && Boolean(error.status && [429, 500, 502, 503, 504].includes(error.status));
        if (retryableProviderFailure && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
          continue;
        }
        if (!(error instanceof Error) || !error.message.includes('valid JSON')) throw error;
      }
    }
    throw new Error(`Assessment pass ${requestLabel} returned malformed JSON: ${String(lastError)}`);
  };

  let output = await generate(system, prompt, label);
  canonicalizeTaxonomyFields(output);
  sanitizeVietnameseTextFields(output);
  let errors = validate?.(output) || [];
  for (let attempt = 1; errors.length && attempt <= 2; attempt += 1) {
    if (process.env.ASSESSMENT_BENCHMARK_MODE === 'true') {
      console.info('[assessment-contract-repair]', JSON.stringify({ label, attempt, errors }));
    }
    output = await generate(
      `${system}\n\nCONTRACT REPAIR ${attempt}: Return the complete object again and fix every listed problem.\n- ${errors.join('\n- ')}`,
      JSON.stringify({ input: user, previousResponse: output, validationErrors: errors }, null, 2),
      `${label}:repair-${attempt}`,
    );
    canonicalizeTaxonomyFields(output);
    sanitizeVietnameseTextFields(output);
    errors = validate?.(output) || [];
  }
  if (errors.length) throw new Error(`Assessment pass contract failed: ${errors.join(' ')}`);
  return output;
}

function emptyReview(nodeId: string, job = ''): NodeReview {
  return { nodeId, status: 'works', job, assessment: '', issues: [] };
}

export function mergeTaskAndStructure(
  decomposition: DecompositionPass,
  task: TaskPass,
  manifest: EssayParagraphManifest[],
): WritingAnalysis['pyramid'] {
  const paragraphs: ParagraphMoveNode[] = decomposition.paragraphs.map((structure, paragraphIndex) => {
    const taskParagraph = task.paragraphs.find(item => item.index === structure.index);
    const sentenceResults = new Map((taskParagraph?.sentences || []).map(sentence => [sentence.nodeId, sentence]));
    const expected = manifest[paragraphIndex];
    const sentences: SentenceAnnotation[] = structure.chunks.map((chunk, chunkIndex) => {
      const reviewResult = sentenceResults.get(chunk.nodeId);
      return {
        index: chunkIndex + 1,
        nodeId: `sentence-${paragraphIndex}-${chunkIndex + 1}`,
        sourceSentenceIndex: chunk.sourceSentenceIndex,
        chunkIndex: chunkIndex + 1,
        sourceText: chunk.sourceText,
        startChar: 0,
        endChar: 0,
        role: chunk.role,
        simplifiedIdea: chunk.simplifiedIdea,
        errors: reviewResult?.errors || [],
        review: reviewResult?.review || emptyReview(chunk.nodeId),
        transitionToNext: reviewResult?.transitionToNext,
      };
    });
    return {
      index: expected.index,
      label: taskParagraph?.label || structure.label || `Paragraph ${paragraphIndex + 1}`,
      job: taskParagraph?.job || '',
      paragraphStartChar: expected.startChar,
      paragraphEndChar: expected.endChar,
      errors: taskParagraph?.errors || [],
      review: taskParagraph?.review || emptyReview(`para-${paragraphIndex}`),
      sentences,
      transitionToNext: taskParagraph?.transitionToNext,
    };
  });
  return {
    macroAnswer: task.macroAnswer || { text: '', errors: [], review: emptyReview('macro') },
    paragraphs,
    edgeReviews: task.edgeReviews || [],
  };
}
