'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BandScores,
  AssessmentEvidenceSpan,
  ArgumentFlowChapter,
  CoherenceFlow,
  EdgeReview,
  EssayHighlight,
  ParagraphMoveNode,
  PyramidError,
  PyramidIssue,
  SentenceAnnotation,
  WritingAnalysis,
} from '@/types/writing';
import SimpleArgumentGraph from './SimpleArgumentGraph';
import ComparisonReviewPanel from './ComparisonReviewPanel';
import CoherenceFlowDiagram from './CoherenceFlowDiagram';
import LanguageFeedbackPanel from './LanguageFeedbackPanel';
import OverallAssessmentPanel from './OverallAssessmentPanel';
import EssayPromptBlock from './EssayPromptBlock';
import {
  errorLabelVi,
  inferCoherenceErrorCode,
  inferTaskErrorCode,
} from '@/lib/assessment-error-taxonomy';
import {
  assessmentHasConfirmedFindings,
  hasVerifiedComparisonChanges,
} from '@/lib/writing-assessment-findings';

type ReviewMode = 'argument' | 'language' | 'overall' | 'comparison';
type ColumnKey = 'essay' | 'evidence' | 'comments';

interface WorkbenchProps {
  prompt: string;
  essay: string;
  analysis: WritingAnalysis;
  onStartNew: () => void;
}

interface TextHighlight {
  commandId: string;
  startChar: number;
  endChar: number;
  tone: 'reasoning' | 'language' | 'solution';
  label: string;
  feedback: string;
  nodeLabel?: string;
}

interface ReviewCommand {
  id: string;
  type: 'ta' | 'cc' | 'lr' | 'gra';
  errorCode?: string;
  errorLabelVi?: string;
  title: string;
  label: string;
  whyWrong: string;
  impact: string;
  readerImpact?: string;
  fix?: string;
  snapshot: 'nodes' | 'flow' | 'snippet';
  paragraph?: ParagraphMoveNode;
  sentences?: SentenceAnnotation[];
  flow?: CoherenceFlow;
  edgeReview?: EdgeReview;
  highlight?: EssayHighlight;
  focusNodeIds?: string[];
  primaryNodeIds?: string[];
  evidenceSpans?: AssessmentEvidenceSpan[];
}

interface ColumnWidths {
  essay: number;
  evidence: number;
  comments: number;
}

const SCORE_LABELS: Record<keyof Omit<BandScores, 'overall'>, string> = {
  taskAchievement: 'TA',
  coherenceCohesion: 'CC',
  lexicalResource: 'LR',
  grammaticalRange: 'GRA',
};

const MIN_COLUMN_WIDTHS: ColumnWidths = {
  essay: 260,
  evidence: 360,
  comments: 240,
};

const WORKBENCH_COLUMN_PRESETS: Record<ReviewMode, ColumnWidths> = {
  argument: {
    essay: 62,
    evidence: 12,
    comments: 26,
  },
  language: {
    essay: 48,
    evidence: 37,
    comments: 15,
  },
  comparison: {
    essay: 48,
    evidence: 37,
    comments: 15,
  },
  overall: {
    essay: 48,
    evidence: 37,
    comments: 15,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sentenceNodeId(paraIndex: number, sentenceIndex: number) {
  return `sentence-${paraIndex}-${sentenceIndex}`;
}

function paraNodeId(index: number) {
  return `para-${index}`;
}

function parseSentenceNodeId(nodeId: string) {
  const match = nodeId.match(/^sentence-(\d+)-(\d+)$/);
  if (!match) return null;
  return { paraIndex: Number(match[1]), sentenceIndex: Number(match[2]) };
}

function getSentenceById(paragraphs: ParagraphMoveNode[], nodeId: string) {
  const parsed = parseSentenceNodeId(nodeId);
  if (!parsed) return undefined;
  const paragraph = paragraphs.find(p => p.index === parsed.paraIndex);
  const sentence = paragraph?.sentences.find(s => s.index === parsed.sentenceIndex);
  return paragraph && sentence ? { paragraph, sentence } : undefined;
}

function getFixText(error: PyramidError) {
  if (error.proposedFix?.proposedText) return error.proposedFix.proposedText;
  if (error.proposedFix?.details) return error.proposedFix.details;
  return error.suggestion;
}

function issueImpact(issue: PyramidIssue) {
  return issue.impactOnPurpose || issue.impactOnReader || issue.whyWrong;
}

function commandTextFromComment(fallback: string, comment?: PyramidError['comment'] | PyramidIssue['comment']) {
  return comment?.bodyVi?.trim() || fallback;
}

function commandScaffoldCue(errorLabel: string, index: number) {
  const prompts = [
    `Khoanh vùng bằng các phần highlight: lỗi “${errorLabel}” đang nằm ở đâu?`,
    `Đối chiếu các phần được highlight: chỗ nào đang thể hiện lỗi “${errorLabel}”?`,
    `Dừng ở các phần được đánh dấu và tự xác định vị trí của lỗi “${errorLabel}”.`,
    `Nhìn lại sơ đồ: phần nào hoặc đường nối nào làm lộ lỗi “${errorLabel}”?`,
  ];
  return prompts[index % prompts.length];
}

function issueDisplayLabel(issue?: {
  errorCode?: string;
  errorLabelVi?: string;
  type?: string;
  title?: string;
  diagnosticPattern?: string;
}, fallback = 'Điểm cần sửa') {
  if (!issue) return fallback;
  const inferred = inferCoherenceErrorCode(issue.type, issue.title, issue.diagnosticPattern);
  return issue.errorLabelVi || errorLabelVi(issue.errorCode || inferred, fallback);
}

function errorDisplayLabel(error: PyramidError, fallback = 'Điểm cần sửa') {
  const inferred = inferTaskErrorCode(error.type, error.message, error.explanation);
  return error.errorLabelVi || errorLabelVi(error.errorCode || inferred, fallback);
}

function nodeIdsFromAffectedNodes(affectedNodes?: PyramidError['affectedNodes'] | PyramidIssue['affectedNodes']) {
  const ids = new Set<string>();
  affectedNodes?.paragraphs?.forEach(index => ids.add(paraNodeId(index)));
  affectedNodes?.sentences?.forEach(({ paraIndex, sentenceIndex }) => {
    ids.add(paraNodeId(paraIndex));
    ids.add(sentenceNodeId(paraIndex, sentenceIndex));
  });
  return Array.from(ids);
}

function nodeIdsFromLinks(nodeLinks?: PyramidError['nodeLinks'] | PyramidIssue['nodeLinks']) {
  return Array.from(new Set([
    ...(nodeLinks?.primaryNodeIds || []),
    ...(nodeLinks?.contextNodeIds || []),
    ...(nodeLinks?.affectedNodeIds || []),
  ]));
}

function primaryNodeIdsFromLinks(nodeLinks?: PyramidError['nodeLinks'] | PyramidIssue['nodeLinks']) {
  return nodeLinks?.primaryNodeIds || [];
}

function reasoningErrorSignature(error: PyramidError) {
  const evidenceKey = (error.evidenceSpans || [])
    .map(span => `${span.startChar}:${span.endChar}:${span.sourceText}`)
    .join('|');
  const nodeKey = [
    ...(error.nodeLinks?.primaryNodeIds || []),
    ...(error.nodeLinks?.contextNodeIds || []),
    ...(error.nodeLinks?.affectedNodeIds || []),
  ].join('|');
  const affectedKey = [
    ...(error.affectedNodes?.paragraphs || []).map(index => `p${index}`),
    ...(error.affectedNodes?.sentences || []).map(({ paraIndex, sentenceIndex }) => `s${paraIndex}-${sentenceIndex}`),
  ].join('|');

  return [
    error.type,
    error.direction || '',
    error.message,
    error.comment?.bodyVi || '',
    evidenceKey,
    nodeKey,
    affectedKey,
  ].join('::');
}

function buildReasoningCommands(analysis: WritingAnalysis): ReviewCommand[] {
  const commands: ReviewCommand[] = [];
  const emittedIssueSignatures = new Set<string>();
  const paragraphs = analysis.pyramid.paragraphs;

  for (const error of analysis.pyramid.macroAnswer.errors || []) {
    commands.push({
      id: `macro-${commands.length}`,
      type: 'ta',
      errorCode: error.errorCode || inferTaskErrorCode(error.type, error.message, error.explanation),
      errorLabelVi: errorDisplayLabel(error),
      title: 'Vị trí chung của bài cần kiểm tra lại',
      label: 'Macro position',
      whyWrong: commandTextFromComment(error.message, error.comment),
      impact: error.explanation || 'Vị trí chung chưa tạo được tiêu điểm rõ cho các đoạn thân bài.',
      fix: getFixText(error),
      snapshot: 'nodes',
      focusNodeIds: ['macro', ...nodeIdsFromAffectedNodes(error.affectedNodes), ...nodeIdsFromLinks(error.nodeLinks)],
      evidenceSpans: error.evidenceSpans,
      primaryNodeIds: primaryNodeIdsFromLinks(error.nodeLinks),
    });
  }

  for (const paragraph of paragraphs) {
    const sentenceIssueSignatures = new Set(
      paragraph.sentences.flatMap(sentence => sentence.errors.map(reasoningErrorSignature)),
    );

    for (const error of paragraph.errors) {
      const signature = reasoningErrorSignature(error);
      if (sentenceIssueSignatures.has(signature) || emittedIssueSignatures.has(signature)) continue;
      emittedIssueSignatures.add(signature);

      commands.push({
        id: `para-${paragraph.index}-${commands.length}`,
        type: 'ta',
        errorCode: error.errorCode || inferTaskErrorCode(error.type, error.message, error.explanation),
        errorLabelVi: errorDisplayLabel(error),
        title: `${paragraph.label}: ý chính của đoạn chưa được làm rõ`,
        label: 'Task response',
        whyWrong: commandTextFromComment(error.message, error.comment),
        impact: error.explanation || 'This weakens the paragraph purpose because the paragraph does not clearly perform the job it promises.',
        fix: getFixText(error),
        snapshot: 'nodes',
        paragraph,
        sentences: paragraph.sentences,
        focusNodeIds: [
          paraNodeId(paragraph.index),
          ...(error.affectedNodes
            ? nodeIdsFromAffectedNodes(error.affectedNodes)
            : paragraph.sentences.map(sentence => sentenceNodeId(paragraph.index, sentence.index))),
          ...nodeIdsFromLinks(error.nodeLinks),
        ],
        evidenceSpans: error.evidenceSpans,
        primaryNodeIds: primaryNodeIdsFromLinks(error.nodeLinks),
      });
    }

    for (const sentence of paragraph.sentences) {
      for (const error of sentence.errors) {
        const signature = reasoningErrorSignature(error);
        if (emittedIssueSignatures.has(signature)) continue;
        emittedIssueSignatures.add(signature);

        commands.push({
          id: `sentence-${paragraph.index}-${sentence.index}-${commands.length}`,
          type: 'ta',
          errorCode: error.errorCode || inferTaskErrorCode(error.type, error.message, error.explanation),
          errorLabelVi: errorDisplayLabel(error),
          title: `S${sentence.index}: ${sentence.role.replaceAll('_', ' ')}`,
          label: error.type === 'internal' ? 'Ý trong lập luận' : 'Nhảy logic',
          whyWrong: commandTextFromComment(error.message, error.comment),
          impact: error.explanation || 'The reader cannot accept this part as sufficient support for the paragraph claim.',
          fix: getFixText(error),
          snapshot: 'nodes',
          paragraph,
          sentences: [sentence],
          focusNodeIds: [
            paraNodeId(paragraph.index),
            sentenceNodeId(paragraph.index, sentence.index),
            ...nodeIdsFromAffectedNodes(error.affectedNodes),
            ...nodeIdsFromLinks(error.nodeLinks),
          ],
          evidenceSpans: error.evidenceSpans,
          primaryNodeIds: primaryNodeIdsFromLinks(error.nodeLinks),
        });
      }
    }
  }

  for (const review of analysis.pyramid.edgeReviews || []) {
    if (review.status === 'works') continue;
    const issue = review.issues[0];
    const nodeRefs = [review.fromNodeId, review.toNodeId]
      .map(nodeId => getSentenceById(paragraphs, nodeId))
      .filter((item): item is { paragraph: ParagraphMoveNode; sentence: SentenceAnnotation } => !!item);
    const paragraph = nodeRefs[0]?.paragraph;
    commands.push({
      id: review.edgeId,
      type: 'cc',
      errorCode: issue?.errorCode || inferCoherenceErrorCode(issue?.type, issue?.title || review.assessment),
      errorLabelVi: issueDisplayLabel(issue, 'Quan hệ ý bị lệch'),
      title: issue?.title || 'Relationship does not match the ideas',
      label: review.relationshipTag,
      whyWrong: commandTextFromComment(issue?.whyWrong || review.assessment, issue?.comment),
      impact: issue ? issueImpact(issue) : review.assessment,
      readerImpact: issue?.impactOnReader,
      fix: issue?.solutionActions?.map(action => action.details).join(' '),
      snapshot: 'nodes',
      paragraph,
      sentences: nodeRefs.map(item => item.sentence),
      edgeReview: review,
      focusNodeIds: [
        review.fromNodeId,
        review.toNodeId,
        ...nodeIdsFromAffectedNodes(issue?.affectedNodes),
        ...nodeIdsFromLinks(issue?.nodeLinks),
      ],
      evidenceSpans: issue?.evidenceSpans,
      primaryNodeIds: primaryNodeIdsFromLinks(issue?.nodeLinks),
    });
  }

  for (const flow of analysis.pyramid.coherenceFlows || []) {
    if (flow.status === 'works') continue;
    const paragraph = paragraphs.find(p => p.index === flow.paragraphIndex);
    commands.push({
      id: flow.edgeId,
      type: 'cc',
      errorCode: flow.issue.errorCode || inferCoherenceErrorCode(flow.issue.type, flow.issue.title, flow.diagnosticPattern),
      errorLabelVi: issueDisplayLabel({ ...flow.issue, diagnosticPattern: flow.diagnosticPattern }, 'Mạch ý chưa rõ'),
      title: flow.issue.title,
      label: flow.relationshipTag,
      whyWrong: commandTextFromComment(flow.issue.whyWrong, flow.issue.comment),
      impact: flow.issue.impactOnPurpose,
      readerImpact: flow.issue.impactOnReader,
      fix: flow.issue.solutionActions?.map(action => action.details).join(' '),
      snapshot: 'flow',
      paragraph,
      sentences: paragraph?.sentences,
      flow,
      focusNodeIds: [
        ...flow.fromNodeIds,
        flow.toNodeId,
        ...nodeIdsFromAffectedNodes(flow.issue.affectedNodes),
        ...nodeIdsFromLinks(flow.issue.nodeLinks),
      ],
      evidenceSpans: flow.issue.evidenceSpans,
      primaryNodeIds: primaryNodeIdsFromLinks(flow.issue.nodeLinks),
    });
  }

  return commands.filter((command, index) => {
    const focusKey = commandFocusNodeIds(command).sort().join('|');
    const key = `${command.type}|${command.title}|${focusKey}|${command.whyWrong}`;
    return commands.findIndex(candidate => {
      const candidateFocusKey = commandFocusNodeIds(candidate).sort().join('|');
      return `${candidate.type}|${candidate.title}|${candidateFocusKey}|${candidate.whyWrong}` === key;
    }) === index;
  });
}

function buildArgumentFlowCommands(analysis: WritingAnalysis) {
  const commands = buildReasoningCommands(analysis);
  for (const [index, highlight] of analysis.cohesionHighlights.entries()) {
    const paragraph = analysis.pyramid.paragraphs.find(item =>
      highlight.startChar >= item.paragraphStartChar && highlight.startChar < item.paragraphEndChar,
    );
    const sentence = paragraph?.sentences.find(item =>
      highlight.startChar >= item.startChar && highlight.startChar < item.endChar,
    );
    commands.push({
      id: `cohesion-${highlight.startChar}-${highlight.endChar}-${index}`,
      type: 'cc',
      errorCode: highlight.errorCode || highlight.highlightType,
      errorLabelVi: highlight.errorLabelVi || errorLabelVi(highlight.errorCode || highlight.highlightType, highlight.label),
      title: highlight.label,
      label: 'Cohesion',
      whyWrong: highlight.feedback,
      impact: highlight.solutionFeedback || 'Tín hiệu liên kết này đang làm quan hệ giữa hai ý kém rõ hơn.',
      snapshot: 'snippet',
      paragraph,
      sentences: sentence ? [sentence] : undefined,
      highlight,
      focusNodeIds: sentence?.nodeId ? [sentence.nodeId] : undefined,
      evidenceSpans: [{
        startChar: highlight.startChar,
        endChar: highlight.endChar,
        sourceText: highlight.sourceText || '',
        nodeId: sentence?.nodeId,
      }],
    });
  }
  return [...commands].sort((left, right) => {
    const leftParagraph = left.paragraph?.index ?? -1;
    const rightParagraph = right.paragraph?.index ?? -1;
    if (leftParagraph !== rightParagraph) return leftParagraph - rightParagraph;

    // Once the macro checkpoint is clear, show the actual information path before
    // judging whether the same material develops the paragraph strongly enough.
    const rank = (command: ReviewCommand) => command.type === 'cc' ? 0 : 1;
    return rank(left) - rank(right);
  });
}

function buildReasoningHighlights(commands: ReviewCommand[]): TextHighlight[] {
  const highlights: TextHighlight[] = [];
  for (const command of commands) {
    if (command.evidenceSpans?.length) {
      command.evidenceSpans.forEach(span => highlights.push({
        startChar: span.startChar,
        endChar: span.endChar,
        commandId: command.id,
        tone: 'reasoning',
        label: command.label,
        feedback: command.whyWrong,
      }));
      continue;
    }
    for (const sentence of command.sentences || []) {
      highlights.push({
        startChar: sentence.startChar,
        endChar: sentence.endChar,
        commandId: command.id,
        tone: 'reasoning',
        label: command.label,
        feedback: command.whyWrong,
      });
    }
  }
  return highlights;
}

function splitEssayIntoSpans(essay: string, highlights: TextHighlight[]) {
  if (!highlights.length) return [{ text: essay, highlight: undefined as TextHighlight | undefined }];
  const points = new Set<number>([0, essay.length]);
  for (const highlight of highlights) {
    points.add(Math.max(0, highlight.startChar));
    points.add(Math.min(essay.length, highlight.endChar));
  }
  const sorted = Array.from(points).sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    return {
      text: essay.slice(start, end),
      highlight: highlights.find(h => h.startChar <= start && h.endChar >= end),
    };
  });
}

function ScoreDisplay({ scores }: { scores: BandScores }) {
  const dimensions = Object.keys(SCORE_LABELS) as Array<keyof Omit<BandScores, 'overall'>>;
  return (
    <div className="flex w-full items-stretch gap-3">
      <div className="flex min-w-[94px] shrink-0 flex-col justify-between py-2">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-black/40">Overall</span>
        <span className="font-sans text-[38px] font-semibold leading-none tracking-tight text-[#141413]">{scores.overall.toFixed(1)}</span>
      </div>
      <div className="my-2 w-px bg-black/5" />
      <div className="grid flex-1 grid-cols-4 gap-2">
        {dimensions.map(key => (
          <div key={key} className="flex flex-col justify-between rounded-[12px] bg-black/[0.025] px-3 py-2 ring-1 ring-black/[0.04]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-black/40">{SCORE_LABELS[key]}</p>
            <p className="font-sans text-[24px] font-semibold leading-none text-[#141413]/80">{scores[key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: ReviewMode; onChange: (mode: ReviewMode) => void }) {
  const modes: Array<{ id: ReviewMode; label: string; detail: string }> = [
    { id: 'argument', label: 'Argument & flow', detail: 'TA + CC' },
    { id: 'language', label: 'Language', detail: 'LR + GRA' },
    { id: 'comparison', label: 'Band 8/9 compare', detail: 'Original / rewrite' },
    { id: 'overall', label: 'Overall + To-do', detail: 'Band & actions' },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto rounded-[14px] bg-black/[0.03] p-1 hide-scrollbar">
      {modes.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`min-w-[132px] flex-1 rounded-[10px] px-3 py-2 text-left transition-all ${
            mode === item.id ? 'bg-white shadow-sm ring-1 ring-black/[0.06]' : 'hover:bg-white/60'
          }`}
        >
          <p className="font-sans text-[12px] font-semibold text-[#171717]">{item.label}</p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#737373]">{item.detail}</p>
        </button>
      ))}
    </div>
  );
}

function EssayColumn({
  prompt,
  essay,
  highlights,
  selectedCommandId,
  shouldScrollToSelection,
  selectionRevision = 0,
  onSelectHighlight,
  showSentenceMarkers = false,
  showHeading = true,
}: {
  prompt: string;
  essay: string;
  highlights: TextHighlight[];
  selectedCommandId: string | null;
  shouldScrollToSelection: boolean;
  selectionRevision?: number;
  onSelectHighlight?: (commandId: string) => void;
  showSentenceMarkers?: boolean;
  showHeading?: boolean;
}) {
  const spans = splitEssayIntoSpans(essay, highlights);
  const activeSpanRef = useRef<HTMLSpanElement | null>(null);
  const essayScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const activeSpan = activeSpanRef.current;
    const scrollBox = essayScrollRef.current;
    if (!shouldScrollToSelection || !activeSpan || !scrollBox) return;

    const spanRect = activeSpan.getBoundingClientRect();
    const boxRect = scrollBox.getBoundingClientRect();
    const nextTop = scrollBox.scrollTop + spanRect.top - boxRect.top - boxRect.height * 0.42;
    scrollBox.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [selectedCommandId, shouldScrollToSelection, selectionRevision]);

  return (
    <section ref={essayScrollRef} className="h-full min-h-0 overflow-y-auto rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)] hide-scrollbar">
      <div className={showHeading ? 'mb-4' : ''}>
        {showHeading && <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Student essay</p>}
        <EssayPromptBlock prompt={prompt} className={`${showHeading ? 'mt-3' : ''} mb-5`} />
      </div>
      <div className="pr-2">
        <div className="whitespace-pre-wrap font-sans text-[14px] leading-[1.85] text-[#141413] [text-wrap:pretty]">
          {spans.map((span, index) => {
            const isActive = !!selectedCommandId && span.highlight?.commandId === selectedCommandId;
            const style = span.highlight?.tone === 'language'
              ? isActive
                ? 'bg-emerald-300/90 ring-1 ring-emerald-500/30 box-decoration-clone rounded-[4px] px-1'
                : 'bg-emerald-200/60 box-decoration-clone rounded-[4px] px-1'
              : span.highlight?.tone === 'solution'
              ? isActive
                ? 'bg-[#DCEBFF] ring-1 ring-[#3478F6]/35 box-decoration-clone rounded-[4px] px-1'
                : 'bg-[#EAF3FF] box-decoration-clone rounded-[4px] px-1'
              : span.highlight
              ? isActive
                ? 'bg-amber-300/90 ring-1 ring-amber-500/30 box-decoration-clone rounded-[4px] px-1'
                : 'bg-amber-200/60 box-decoration-clone rounded-[4px] px-1'
              : '';
            const marker = showSentenceMarkers && span.highlight?.nodeLabel ? (
              <span className="mr-1.5 inline-flex translate-y-[-1px] items-center rounded-[6px] bg-[#E5F3FE] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[#2563EB] ring-1 ring-[#3B82F6]/15">
                {span.highlight.nodeLabel}
              </span>
            ) : null;
            if (!span.highlight || !onSelectHighlight) {
              return (
                <span key={index} ref={isActive ? activeSpanRef : undefined} className={style}>
                  {marker}
                  {span.text}
                </span>
              );
            }

            return (
              <span
                key={index}
                ref={isActive ? activeSpanRef : undefined}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                aria-label={`Inspect feedback: ${span.highlight.label}`}
                onClick={() => onSelectHighlight(span.highlight!.commandId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectHighlight(span.highlight!.commandId);
                  }
                }}
                className={`${style} cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50`}
              >
                {marker}
                {span.text}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function commandFocusNodeIds(command: ReviewCommand) {
  const nodeIds = new Set<string>();

  command.focusNodeIds?.forEach(nodeId => nodeIds.add(nodeId));

  if (!command.focusNodeIds?.length && command.paragraph) nodeIds.add(paraNodeId(command.paragraph.index));
  if (command.edgeReview) {
    nodeIds.add(command.edgeReview.fromNodeId);
    nodeIds.add(command.edgeReview.toNodeId);
  }
  if (command.flow) {
    command.flow.fromNodeIds.forEach(nodeId => nodeIds.add(nodeId));
    nodeIds.add(command.flow.toNodeId);
    command.flow.issue.solutionActions?.forEach(action => {
      action.currentOrder?.forEach(nodeId => nodeIds.add(nodeId));
      action.proposedOrder?.forEach(nodeId => nodeIds.add(nodeId));
    });
  }
  command.sentences?.forEach(sentence => {
    if (!command.focusNodeIds?.length && command.paragraph) nodeIds.add(sentenceNodeId(command.paragraph.index, sentence.index));
  });

  Array.from(nodeIds).forEach(nodeId => {
    const parsed = parseSentenceNodeId(nodeId);
    if (parsed) nodeIds.add(paraNodeId(parsed.paraIndex));
  });

  return Array.from(nodeIds);
}

function NodeSnapshot({
  command,
  analysis,
  isActive,
  onRequestFullscreen,
  frame = true,
  solutionNodeIds = [],
}: {
  command: ReviewCommand;
  analysis: WritingAnalysis;
  isActive: boolean;
  onRequestFullscreen?: () => void;
  frame?: boolean;
  solutionNodeIds?: string[];
}) {
  const focusNodeIds = commandFocusNodeIds(command);
  const [diagramActiveParagraphIndex, setDiagramActiveParagraphIndex] = useState<number | null>(command.paragraph?.index ?? null);
  const graph = (
    <SimpleArgumentGraph
      activeParagraphIndex={diagramActiveParagraphIndex}
      onParagraphClick={setDiagramActiveParagraphIndex}
      macroAnswer={analysis.pyramid.macroAnswer}
      paragraphs={analysis.pyramid.paragraphs}
      focusNodeIds={focusNodeIds}
      solutionNodeIds={solutionNodeIds}
    />
  );

  if (!frame) {
    return <div className="h-full min-h-0">{graph}</div>;
  }

  return (
    <div className={`relative h-full min-h-[480px] overflow-hidden rounded-[16px] border bg-[#F7F8F8] transition-all ${
      isActive ? 'border-[#3478F6]/35 ring-2 ring-[#3478F6]/10' : 'border-black/[0.06]'
    }`}>
      {onRequestFullscreen && (
        <button
          type="button"
          onClick={onRequestFullscreen}
          className="absolute right-3 top-3 z-10 rounded-[7px] border border-black/[0.06] bg-white/85 px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-black/45 shadow-sm backdrop-blur transition-colors hover:text-[#171717]"
        >
          Full
        </button>
      )}
      {graph}
    </div>
  );
}

function FullMapSnapshot({ analysis }: { analysis: WritingAnalysis }) {
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-[14px] bg-[#F7F8F8]">
      <SimpleArgumentGraph
        macroAnswer={analysis.pyramid.macroAnswer}
        paragraphs={analysis.pyramid.paragraphs}
        activeParagraphIndex={activeParagraphIndex}
        onParagraphClick={setActiveParagraphIndex}
      />
    </div>
  );
}

function compactNodeText(sentence: SentenceAnnotation) {
  const text = sentence.sourceText || sentence.simplifiedIdea || '';
  return text.length > 88 ? `${text.slice(0, 85).trimEnd()}...` : text;
}

function PathLensNode({
  sentence,
  primary,
}: {
  sentence: SentenceAnnotation;
  primary: boolean;
}) {
  return (
    <article className={`min-w-0 rounded-[10px] border px-2.5 py-2.5 ${
      primary ? 'border-[#3478F6]/40 bg-[#EAF4FF]' : 'border-black/[0.08] bg-white'
    }`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex min-w-6 items-center justify-center rounded-[5px] px-1 py-0.5 font-mono text-[9px] font-semibold ${
          primary ? 'bg-[#3478F6] text-white' : 'bg-black/[0.05] text-black/55'
        }`}>S{sentence.index}</span>
        <span className="truncate font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-black/40">
          {sentence.role.replaceAll('_', ' ')}
        </span>
      </div>
      <p className="mt-1.5 font-sans text-[11px] leading-[1.45] text-[#303030]">{compactNodeText(sentence)}</p>
    </article>
  );
}

function CollapsedBridge({ count, startIndex, endIndex }: { count: number; startIndex: number; endIndex: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-1.5 text-center">
      <span className="h-3 w-px bg-[#9AA3AE]" aria-hidden="true" />
      <span className="rounded-[5px] bg-black/[0.035] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-black/45">
        S{startIndex}-S{endIndex} · {count} chunks
      </span>
      <span className="h-3 w-px bg-[#9AA3AE]" aria-hidden="true" />
    </div>
  );
}

function EvidencePathLens({ command, analysis }: { command: ReviewCommand; analysis: WritingAnalysis }) {
  const focusedIds = commandFocusNodeIds(command);
  const primaryIds = new Set(command.primaryNodeIds?.length ? command.primaryNodeIds : focusedIds);
  const sentenceRefs = focusedIds
    .map(nodeId => getSentenceById(analysis.pyramid.paragraphs, nodeId))
    .filter((item): item is { paragraph: ParagraphMoveNode; sentence: SentenceAnnotation } => !!item);
  const visibleRefs = sentenceRefs.length
    ? sentenceRefs
    : (command.sentences || []).map(sentence => ({ paragraph: command.paragraph!, sentence }));
  const groups = Array.from(new Map<number, { paragraph: ParagraphMoveNode; sentences: SentenceAnnotation[] }>(
    visibleRefs.reduce((entries, item) => {
      const current = entries.get(item.paragraph.index) || { paragraph: item.paragraph, sentences: [] };
      if (!current.sentences.some(sentence => sentence.index === item.sentence.index)) current.sentences.push(item.sentence);
      entries.set(item.paragraph.index, current);
      return entries;
    }, new Map<number, { paragraph: ParagraphMoveNode; sentences: SentenceAnnotation[] }>())
  ).values()).map(group => ({ ...group, sentences: group.sentences.sort((left, right) => left.index - right.index) }));

  const flowSources = command.flow?.fromNodeIds
    .map(nodeId => getSentenceById(analysis.pyramid.paragraphs, nodeId))
    .filter((item): item is { paragraph: ParagraphMoveNode; sentence: SentenceAnnotation } => !!item) || [];
  const flowTarget = command.flow ? getSentenceById(analysis.pyramid.paragraphs, command.flow.toNodeId) : undefined;

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-[16px] border border-black/[0.06] bg-[#F7F8F9] p-3 hide-scrollbar">
      {command.flow && flowTarget ? (
        <section className="rounded-[12px] border border-[#3478F6]/15 bg-white p-3">
          <p className="mb-2 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-black/40">
            {command.flow.relationshipTag}
          </p>
          <div className="grid gap-2">
            <div className={`grid gap-2 ${flowSources.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {flowSources.map(({ sentence }) => (
                <PathLensNode key={sentence.nodeId} sentence={sentence} primary={primaryIds.has(sentence.nodeId || '')} />
              ))}
            </div>
            <div className="flex flex-col items-center py-1">
              <span className="h-4 w-px bg-[#3478F6]" aria-hidden="true" />
              <span className="font-mono text-[9px] font-semibold text-[#2563EB]">↓</span>
            </div>
            <PathLensNode sentence={flowTarget.sentence} primary={primaryIds.has(flowTarget.sentence.nodeId || '')} />
          </div>
        </section>
      ) : (
        <div className="grid gap-2">
          {groups.map(group => (
            <section key={group.paragraph.index} className="rounded-[12px] border border-black/[0.06] bg-white p-3">
              <p className="mb-2 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-black/40">{group.paragraph.label}</p>
              {group.sentences.map((sentence, index) => {
                const previous = group.sentences[index - 1];
                const gap = previous ? sentence.index - previous.index - 1 : 0;
                return (
                  <div key={sentence.nodeId || `${group.paragraph.index}-${sentence.index}`}>
                    {previous && <CollapsedBridge count={gap} startIndex={previous.index + 1} endIndex={sentence.index - 1} />}
                    {previous && gap === 0 && <div className="flex justify-center py-1 font-mono text-[10px] text-[#3478F6]">↓</div>}
                    <PathLensNode sentence={sentence} primary={primaryIds.has(sentence.nodeId || '')} />
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SnippetSnapshot({ command, essay }: { command: ReviewCommand; essay: string }) {
  const highlight = command.highlight;
  const snippet = highlight
    ? essay.slice(Math.max(0, highlight.startChar - 40), Math.min(essay.length, highlight.endChar + 40))
    : command.title;
  return (
    <div className="rounded-[16px] border border-black/[0.06] bg-[#F8F9FA] p-4">
      <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{command.label}</p>
      <p className="font-sans text-[14px] leading-relaxed text-[#141413]">
        {snippet}
      </p>
    </div>
  );
}

function CommandCard({
  command,
  index,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  activeRef,
}: {
  command: ReviewCommand;
  index: number;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  activeRef?: React.Ref<HTMLButtonElement>;
}) {
  const displayError = command.errorLabelVi || errorLabelVi(command.errorCode, command.title);
  const isGuidedReasoningComment = command.type === 'ta' || command.type === 'cc';
  const scaffoldCue = isGuidedReasoningComment ? commandScaffoldCue(displayError, index) : null;
  return (
    <article
      className={`w-full rounded-[14px] border px-3 py-3 text-left shadow-[0_2px_10px_rgba(0,0,0,0.025)] outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/50 ${
        isActive
          ? 'border-[#3478F6]/35 bg-[#F7FBFF]'
          : 'border-transparent bg-white hover:border-black/[0.08] hover:bg-black/[0.012]'
      }`}
    >
      <button
        ref={activeRef}
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
      >
        <div className="flex items-start gap-2.5">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            command.type === 'cc' ? 'bg-[#2563EB]' :
            command.type === 'ta' ? 'bg-[#2563EB]' :
            command.type === 'lr' ? 'bg-emerald-600' :
            'bg-[#EC6A5B]'
          }`} aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="font-sans text-[13px] font-semibold leading-snug text-[#171717]">{displayError}</h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] ${
                command.type === 'cc' ? 'bg-[#E5F3FE] text-[#2563EB]' :
                command.type === 'ta' ? 'bg-[#E5F3FE] text-[#2563EB]' :
                command.type === 'lr' ? 'bg-emerald-100 text-emerald-700' :
                'bg-[#FFF0EC] text-[#B84B3E]'
              }`}>
                {command.type.toUpperCase()}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/40">{command.label}</span>
              <span className="font-mono text-[8px] text-[#A3A3A3]">#{index + 1}</span>
            </div>
            <p className="mt-1.5 font-sans text-[11px] font-semibold leading-snug text-[#2A2A2A]">{command.title}</p>
            {scaffoldCue ? (
              <p className="mt-2 font-sans text-[11px] leading-relaxed text-[#525252]">
                <span className="font-semibold text-[#2563EB]">Tự tìm lỗi: </span>{scaffoldCue}
              </p>
            ) : null}
          </div>
        </div>
      </button>
      {(!isGuidedReasoningComment || isActive) && (
        <div className={scaffoldCue ? 'mt-2 border-t border-black/[0.06] pt-2' : 'mt-2'}>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            className="flex w-full items-center justify-between rounded-[7px] px-1 py-1 font-sans text-[10px] font-semibold text-[#2563EB] outline-none transition-colors hover:bg-[#EAF4FF] focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50"
          >
            <span>{isExpanded ? 'Ẩn phân tích' : 'Xem phân tích'}</span>
            <span aria-hidden="true" className="text-[13px] leading-none">{isExpanded ? '−' : '+'}</span>
          </button>
          {isExpanded && (
            <div className="mt-1.5">
              <p className="font-sans text-[11px] leading-relaxed text-[#525252]">
                {scaffoldCue ? <span className="font-semibold text-[#2A2A2A]">Phân tích: </span> : null}
                {command.whyWrong}
              </p>
              {command.fix && (
                <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#2563EB]"><span className="font-semibold">Bản sửa: </span>{command.fix}</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function FullscreenCommentRail({
  commands,
  selectedCommandId,
  onSelectCommand,
}: {
  commands: ReviewCommand[];
  selectedCommandId: string | null;
  onSelectCommand: (commandId: string) => void;
}) {
  const activeCommandRef = useRef<HTMLButtonElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [expandedCommandId, setExpandedCommandId] = useState<string | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    const activeCommand = activeCommandRef.current;
    if (!rail || !activeCommand) return;

    const railRect = rail.getBoundingClientRect();
    const activeRect = activeCommand.getBoundingClientRect();
    const nextTop = rail.scrollTop + activeRect.top - railRect.top - 8;
    rail.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [selectedCommandId]);

  return (
    <aside className="flex h-full min-h-0 w-[340px] shrink-0 flex-col border-l border-black/[0.06] bg-white/72 p-4 backdrop-blur-sm">
      <div className="mb-3 flex shrink-0 items-center justify-between px-1">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Editorial comments</p>
        <span className="rounded-[6px] bg-black/[0.04] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-black/45">
          {commands.length}
        </span>
      </div>
      <div ref={railRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 hide-scrollbar">
        {commands.map((command, index) => {
          const isActive = selectedCommandId === command.id;
          return (
            <CommandCard
              key={command.id}
              command={command}
              index={index}
              isActive={isActive}
              isExpanded={expandedCommandId === command.id}
              activeRef={isActive ? activeCommandRef : undefined}
              onSelect={() => onSelectCommand(command.id)}
              onToggleExpand={() => setExpandedCommandId(current => current === command.id ? null : command.id)}
            />
          );
        })}
      </div>
    </aside>
  );
}

// Retained while the older assessment layout remains available in local drafts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EvidenceColumn({ commands, essay, analysis, selectedCommandId, onSelectCommand }: {
  commands: ReviewCommand[];
  essay: string;
  analysis: WritingAnalysis;
  selectedCommandId: string | null;
  onSelectCommand: (commandId: string) => void;
}) {
  const selectedCommand = commands.find(command => command.id === selectedCommandId) || commands[0];
  const [view, setView] = useState<'lens' | 'map'>('lens');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const portalRoot = typeof document === 'undefined' ? null : document.body;

  useEffect(() => {
    if (!isMapFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMapFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMapFullscreen]);

  const fullscreenMap = (
    <AnimatePresence>
      {isMapFullscreen && selectedCommand && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000]"
          role="dialog"
          aria-modal="true"
          aria-label="Full evidence map"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-[#F8FAFC]/80 backdrop-blur-sm"
          />
          <div className="absolute inset-6 md:inset-12 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="w-full h-full max-w-[1400px] bg-[#F2F2F2] rounded-[24px] shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden border border-black/[0.06] relative"
              style={{ fontFamily: 'inherit' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white/80 backdrop-blur-sm shrink-0 relative z-10">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">Sơ đồ lập luận</span>
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen(false)}
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-black/40 hover:text-black/80 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v4H3M21 8h-4V3M16 21v-4h4M3 16h4v4" /></svg>
                  Esc
                </button>
              </div>
              <div className="relative flex min-h-0 flex-1 overflow-hidden hide-scrollbar">
                <div className="min-h-0 min-w-0 flex-1">
                  <NodeSnapshot
                    command={selectedCommand}
                    analysis={analysis}
                    isActive
                    frame={false}
                  />
                </div>
                <div className="hidden min-h-0 lg:block">
                  <FullscreenCommentRail
                    commands={commands}
                    selectedCommandId={selectedCommand.id}
                    onSelectCommand={onSelectCommand}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
    <section className="flex h-full min-h-0 flex-col rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Sơ đồ lập luận</p>
        {selectedCommand && (
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-[7px] bg-black/[0.035] p-0.5">
              <button
                type="button"
                onClick={() => setView('lens')}
                className={`rounded-[5px] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  view === 'lens' ? 'bg-white text-[#171717] shadow-sm ring-1 ring-black/[0.06]' : 'text-black/45 hover:text-black/70'
                }`}
              >Các ý</button>
              <button
                type="button"
                onClick={() => setView('map')}
                className={`rounded-[5px] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  view === 'map' ? 'bg-white text-[#171717] shadow-sm ring-1 ring-black/[0.06]' : 'text-black/45 hover:text-black/70'
                }`}
              >Toàn sơ đồ</button>
            </div>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {selectedCommand ? (
          selectedCommand.snapshot === 'snippet' ? (
            <SnippetSnapshot command={selectedCommand} essay={essay} />
          ) : view === 'lens' ? (
            <EvidencePathLens command={selectedCommand} analysis={analysis} />
          ) : (
            <NodeSnapshot
              key={selectedCommand.id}
              command={selectedCommand}
              analysis={analysis}
              isActive
              onRequestFullscreen={() => {
                setView('map');
                setIsMapFullscreen(true);
              }}
            />
          )
        ) : (
          <div className="rounded-[16px] border border-dashed border-black/[0.08] bg-black/[0.02] p-6 text-center">
            <p className="font-sans text-[13px] text-[#737373]">No issues returned for this view.</p>
          </div>
        )}
      </div>
    </section>
    {portalRoot && fullscreenMap ? createPortal(fullscreenMap, portalRoot) : null}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CommandRail({
  commands,
  selectedCommandId,
  shouldScrollToSelection,
  selectionRevision = 0,
  onSelectCommand,
}: {
  commands: ReviewCommand[];
  selectedCommandId: string | null;
  shouldScrollToSelection: boolean;
  selectionRevision?: number;
  onSelectCommand: (commandId: string) => void;
}) {
  const commentScrollRef = useRef<HTMLDivElement | null>(null);
  const activeCommentRef = useRef<HTMLButtonElement | null>(null);
  const [expandedCommandId, setExpandedCommandId] = useState<string | null>(null);

  useEffect(() => {
    const scrollBox = commentScrollRef.current;
    const activeComment = activeCommentRef.current;
    if (!shouldScrollToSelection || !scrollBox || !activeComment) return;

    const commentRect = activeComment.getBoundingClientRect();
    const boxRect = scrollBox.getBoundingClientRect();
    const nextTop = scrollBox.scrollTop + commentRect.top - boxRect.top + 14;
    scrollBox.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [selectedCommandId, shouldScrollToSelection, selectionRevision]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">
        Editorial comments
      </p>
      <div ref={commentScrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-4 hide-scrollbar">
        {commands.map((command, index) => {
          const isActive = selectedCommandId === command.id;
          return (
            <CommandCard
              key={command.id}
              command={command}
              index={index}
              isActive={isActive}
              isExpanded={expandedCommandId === command.id}
              activeRef={isActive ? activeCommentRef : undefined}
              onSelect={() => onSelectCommand(command.id)}
              onToggleExpand={() => setExpandedCommandId(current => current === command.id ? null : command.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

type FlowWalkthroughStage = 'original' | 'problem' | 'repair';

function suggestedOrderForFlow(flow: CoherenceFlow) {
  const action = flow.issue.solutionActions?.find(item => item.type === 'suggest_order' && item.proposedOrder?.length);
  return action?.proposedOrder?.length ? action.proposedOrder : flow.suggestedOrder;
}

function FlowWalkthrough({
  flow,
  paragraph,
  stage,
  onStageChange,
}: {
  flow: CoherenceFlow;
  paragraph: ParagraphMoveNode;
  stage: FlowWalkthroughStage;
  onStageChange: (stage: FlowWalkthroughStage) => void;
}) {
  const writtenOrder = paragraph.sentences.map(sentence => sentence.nodeId || sentenceNodeId(paragraph.index, sentence.index));
  const suggestedOrder = suggestedOrderForFlow(flow);
  const hasRepair = Boolean(suggestedOrder?.length || flow.issue.solutionActions?.length);
  const nodeIds = stage === 'repair' && suggestedOrder?.length ? suggestedOrder : writtenOrder;
  const frames: Array<{ id: FlowWalkthroughStage; label: string; copy: string }> = [
    {
      id: 'original',
      label: '1. Bản gốc',
      copy: 'Đây là thứ tự các ý đang xuất hiện trong đoạn của bạn.',
    },
    {
      id: 'problem',
      label: '2. Vướng ở đâu',
      copy: flow.issue.whyWrong,
    },
    {
      id: 'repair',
      label: '3. Sắp lại',
      copy: flow.issue.solutionActions?.find(action => action.whyBetter)?.whyBetter || flow.issue.comment?.solutionBodyVi || flow.issue.impactOnPurpose,
    },
  ];

  return (
    <section className="mb-4 rounded-[14px] border border-[#3478F6]/15 bg-[#F8FBFF] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-[#2563EB]">Mạch ý · Body {paragraph.index}</p>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/40">{stage === 'repair' ? 'Proposal' : 'Original'}</span>
      </div>
      <div className="mt-3 rounded-[10px] border border-black/[0.05] bg-white px-2 py-2">
        <CoherenceFlowDiagram
          nodeIds={nodeIds}
          flows={[flow]}
          selectedFlowId={flow.edgeId}
          solution={stage === 'repair'}
          compact
        />
      </div>
      <div className="mt-3 grid gap-1">
        {frames.map(frame => {
          const disabled = frame.id === 'repair' && !hasRepair;
          const active = stage === frame.id;
          return (
            <button
              key={frame.id}
              type="button"
              disabled={disabled}
              onClick={() => onStageChange(frame.id)}
              className={`rounded-[7px] px-2 py-1.5 text-left font-sans text-[10px] transition-colors ${
                active ? 'bg-[#E5F3FE] font-semibold text-[#1E5BC8]' : 'text-[#575757] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              <span>{frame.label}</span>
              {active && <span className="ml-1.5 font-normal text-[#5B6B80]">{frame.copy}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ArgumentFlowRail({
  commands,
  selectedCommandId,
  shouldScrollToSelection,
  selectionRevision,
  onSelectCommand,
  flowStages,
  onFlowStageChange,
}: {
  commands: ReviewCommand[];
  selectedCommandId: string | null;
  shouldScrollToSelection: boolean;
  selectionRevision: number;
  onSelectCommand: (commandId: string) => void;
  flowStages: Record<string, FlowWalkthroughStage>;
  onFlowStageChange: (flowId: string, stage: FlowWalkthroughStage) => void;
}) {
  const commentScrollRef = useRef<HTMLDivElement | null>(null);
  const activeCommentRef = useRef<HTMLButtonElement | null>(null);
  const [expandedCommandId, setExpandedCommandId] = useState<string | null>(null);
  const selectedCommand = commands.find(command => command.id === selectedCommandId) || commands[0];

  useEffect(() => {
    const scrollBox = commentScrollRef.current;
    const activeComment = activeCommentRef.current;
    if (!shouldScrollToSelection || !scrollBox || !activeComment) return;
    const commentRect = activeComment.getBoundingClientRect();
    const boxRect = scrollBox.getBoundingClientRect();
    scrollBox.scrollTo({ top: Math.max(0, scrollBox.scrollTop + commentRect.top - boxRect.top - 10), behavior: 'smooth' });
  }, [selectedCommandId, shouldScrollToSelection, selectionRevision]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <p className="mb-3 shrink-0 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Editorial path</p>
      <div ref={commentScrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 hide-scrollbar">
        {selectedCommand?.flow && selectedCommand.paragraph && (
          <div className="sticky top-0 z-10 bg-[#F8F9FA]/95 pt-1 backdrop-blur">
            <FlowWalkthrough
              flow={selectedCommand.flow}
              paragraph={selectedCommand.paragraph}
              stage={flowStages[selectedCommand.flow.edgeId] || 'original'}
              onStageChange={(stage) => onFlowStageChange(selectedCommand.flow!.edgeId, stage)}
            />
          </div>
        )}
        {commands.length === 0 && (
          <div className="rounded-[14px] border border-[#3478F6]/15 bg-[#F5F9FF] px-4 py-4">
            <p className="font-sans text-[13px] font-semibold text-[#171717]">Chưa xác nhận được lỗi lập luận hoặc mạch ý đáng kể</p>
            <p className="mt-2 font-sans text-[11px] leading-relaxed text-[#565B63]">
              Lần đánh giá này không tìm thấy vấn đề đủ rõ và đủ chắc chắn để tạo nhận xét sửa bài. Điều này không có nghĩa mọi ý đều hoàn hảo hoặc không thể được đọc theo cách khác.
            </p>
            <p className="mt-2 font-sans text-[10px] leading-relaxed text-[#6F7680]">
              Bạn vẫn có thể mở <span className="font-semibold text-[#2563EB]">Toàn sơ đồ</span> để xem cấu trúc của bài.
            </p>
          </div>
        )}
        <div className="space-y-5">
          {commands.map((command, index) => {
            const isActive = selectedCommandId === command.id;
            return (
              <CommandCard
                key={command.id}
                command={command}
                index={index}
                isActive={isActive}
                isExpanded={expandedCommandId === command.id}
                activeRef={isActive ? activeCommentRef : undefined}
                onSelect={() => onSelectCommand(command.id)}
                onToggleExpand={() => setExpandedCommandId(current => current === command.id ? null : command.id)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ArgumentFlowSurface({
  view,
  onViewChange,
  selectedCommand,
  prompt,
  essay,
  highlights,
  selectedCommandId,
  shouldScrollToSelection,
  selectionRevision,
  onSelectCommand,
  analysis,
  solutionNodeIds = [],
  essayLabel = 'Student essay',
}: {
  view: 'essay' | 'map';
  onViewChange: (view: 'essay' | 'map') => void;
  selectedCommand: ReviewCommand | undefined;
  prompt: string;
  essay: string;
  highlights: TextHighlight[];
  selectedCommandId: string | null;
  shouldScrollToSelection: boolean;
  selectionRevision: number;
  onSelectCommand: (commandId: string) => void;
  analysis: WritingAnalysis;
  solutionNodeIds?: string[];
  essayLabel?: string;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">{view === 'essay' ? essayLabel : 'Full argument map'}</p>
        <div className="inline-flex rounded-[7px] bg-black/[0.035] p-0.5">
          <button type="button" onClick={() => onViewChange('essay')} className={`rounded-[5px] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] ${view === 'essay' ? 'bg-white text-[#171717] shadow-sm ring-1 ring-black/[0.06]' : 'text-black/45'}`}>Bài viết</button>
          <button type="button" onClick={() => onViewChange('map')} className={`rounded-[5px] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] ${view === 'map' ? 'bg-white text-[#171717] shadow-sm ring-1 ring-black/[0.06]' : 'text-black/45'}`}>Toàn sơ đồ</button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {view === 'essay' ? (
          <EssayColumn
            prompt={prompt}
            essay={essay}
            highlights={highlights}
            selectedCommandId={selectedCommandId}
            shouldScrollToSelection={shouldScrollToSelection}
            selectionRevision={selectionRevision}
            onSelectHighlight={onSelectCommand}
            showSentenceMarkers
            showHeading={false}
          />
        ) : selectedCommand ? (
          <NodeSnapshot command={selectedCommand} analysis={analysis} isActive frame={false} solutionNodeIds={solutionNodeIds} />
        ) : (
          <FullMapSnapshot analysis={analysis} />
        )}
      </div>
    </section>
  );
}

const QUESTION_TONES = [
  'border-[#3478F6]/30 bg-[#EAF3FF] text-[#1759C7]',
  'border-[#5B8DEF]/25 bg-[#F1F6FF] text-[#315FAD]',
  'border-[#6F7F96]/20 bg-[#F5F7FA] text-[#566274]',
];

function chunkLabel(nodeId: string) {
  const match = nodeId.match(/sentence-\d+-(\d+)/);
  if (match) return `C${match[1]}`;
  return nodeId.startsWith('added-') ? 'MỚI' : nodeId.replace(/^.*-/, '').toUpperCase();
}

function chapterMacroErrorType(chapter: ArgumentFlowChapter) {
  return chapter.macroErrorType || (chapter.hasMacroRearrangement ? 'coherence_order' : 'none');
}

function ChapterFlowFigure({
  chapter,
  order,
  focusNodeIds = [],
  showQuestions = false,
}: {
  chapter: ArgumentFlowChapter;
  order: string[];
  focusNodeIds?: string[];
  showQuestions?: boolean;
}) {
  const assignmentByNode = new Map(chapter.assignments.map(item => [item.nodeId, item]));
  const questionIndex = new Map(chapter.questions.map((item, index) => [item.id, index]));

  return (
    <figure className="my-4 overflow-hidden rounded-[10px] border border-black/[0.07] bg-[#F8F9FA] px-3 py-3">
      {showQuestions && (
        <div className="mb-3 grid gap-1.5">
          {chapter.questions.map((question, index) => (
            <div key={question.id} className="grid grid-cols-[32px_1fr] items-start gap-2 text-[10px] leading-[1.45] text-[#50545B]">
              <span className={`rounded-[5px] border px-1 py-0.5 text-center font-mono text-[8px] font-semibold ${QUESTION_TONES[index % QUESTION_TONES.length]}`}>{question.label}</span>
              <span>{question.questionVi}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex min-w-max items-center gap-1.5">
        {order.map((nodeId, index) => {
          const assignment = assignmentByNode.get(nodeId);
          const toneIndex = assignment?.questionId ? questionIndex.get(assignment.questionId) ?? 0 : -1;
          const focused = focusNodeIds.includes(nodeId);
          const isAdded = nodeId.startsWith('added-');
          const tone = isAdded
            ? 'border-[#37A77A]/35 bg-[#E8F8F1] text-[#247657]'
            : assignment?.role === 'conclusion'
              ? 'border-black/15 bg-white text-[#252525]'
              : toneIndex >= 0
                ? QUESTION_TONES[toneIndex % QUESTION_TONES.length]
                : 'border-black/10 bg-white text-black/45';
          return (
            <div key={`${nodeId}-${index}`} className="flex items-center gap-1.5">
              <span className={`inline-flex h-8 min-w-9 items-center justify-center rounded-[6px] border px-2 font-mono text-[9px] font-semibold transition-opacity ${tone} ${focusNodeIds.length && !focused ? 'opacity-25' : ''}`}>
                {chunkLabel(nodeId)}
              </span>
              {index < order.length - 1 && <span className="font-mono text-[11px] text-black/25">→</span>}
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function ChapterChunkBreakdown({
  analysis,
  chapter,
  onFocus,
}: {
  analysis: WritingAnalysis;
  chapter: ArgumentFlowChapter;
  onFocus: (nodeIds: string[]) => void;
}) {
  const sentenceById = new Map(
    analysis.pyramid.paragraphs
      .flatMap(paragraph => paragraph.sentences)
      .filter(sentence => sentence.nodeId)
      .map(sentence => [sentence.nodeId!, sentence]),
  );
  const assignedIds = new Set(chapter.questions.flatMap(question => question.nodeIds));
  const remainingIds = chapter.originalOrder.filter(nodeId => !assignedIds.has(nodeId));

  return (
    <div className="mt-4 space-y-3">
      {chapter.questions.map((question, index) => (
        <button
          key={question.id}
          type="button"
          onClick={() => onFocus(question.nodeIds)}
          className="block w-full rounded-[9px] border border-black/[0.07] bg-[#FAFAFA] p-3 text-left"
        >
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 rounded-[5px] border px-1.5 py-0.5 font-mono text-[8px] font-semibold ${QUESTION_TONES[index % QUESTION_TONES.length]}`}>{question.label}</span>
            <p className="text-[11px] font-semibold leading-[1.5] text-[#202020]">{question.questionVi}</p>
          </div>
          <div className="mt-2.5 space-y-1.5 pl-8">
            {question.nodeIds.map(nodeId => {
              const sentence = sentenceById.get(nodeId);
              if (!sentence) return null;
              return (
                <div key={nodeId} className="grid grid-cols-[28px_1fr] gap-2 text-[10px] leading-[1.5] text-[#50545B]">
                  <span className="font-mono text-[8px] font-semibold text-black/35">{chunkLabel(nodeId)}</span>
                  <span>{sentence.sourceText}</span>
                </div>
              );
            })}
          </div>
        </button>
      ))}
      {remainingIds.length > 0 && (
        <button
          type="button"
          onClick={() => onFocus(remainingIds)}
          className="block w-full rounded-[9px] border border-black/[0.07] bg-white p-3 text-left"
        >
          <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-black/35">Các kết luận đang nằm ngoài ba nhóm</p>
          <div className="mt-2 space-y-1.5">
            {remainingIds.map(nodeId => {
              const sentence = sentenceById.get(nodeId);
              if (!sentence) return null;
              return (
                <div key={nodeId} className="grid grid-cols-[28px_1fr] gap-2 text-[10px] leading-[1.5] text-[#50545B]">
                  <span className="font-mono text-[8px] font-semibold text-black/35">{chunkLabel(nodeId)}</span>
                  <span>{sentence.sourceText}</span>
                </div>
              );
            })}
          </div>
        </button>
      )}
    </div>
  );
}

function ArgumentEditorialChapters({
  analysis,
  chapters,
  commands,
  activeChapterId,
  selectedCommandId,
  activeSection,
  onFocus,
  onSelectCommand,
  flowPreviewMode,
  onFlowPreviewModeChange,
  selectionRevision,
  flowStages,
  onFlowStageChange,
}: {
  analysis: WritingAnalysis;
  chapters: ArgumentFlowChapter[];
  commands: ReviewCommand[];
  activeChapterId: string | null;
  selectedCommandId: string | null;
  activeSection: 'macro' | 'issues';
  onFocus: (chapter: ArgumentFlowChapter, nodeIds: string[]) => void;
  onSelectCommand: (commandId: string) => void;
  flowPreviewMode: 'original' | 'fixed';
  onFlowPreviewModeChange: (mode: 'original' | 'fixed') => void;
  selectionRevision: number;
  flowStages: Record<string, FlowWalkthroughStage>;
  onFlowStageChange: (flowId: string, stage: FlowWalkthroughStage) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chapterRefs = useRef<Record<string, HTMLElement | null>>({});
  const activeCommandRef = useRef<HTMLButtonElement | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [expandedCommandId, setExpandedCommandId] = useState<string | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    const target = activeSection === 'macro' && activeChapterId
      ? chapterRefs.current[activeChapterId]
      : activeCommandRef.current;
    if (!container || !target) return;
    const box = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    container.scrollTo({ top: Math.max(0, container.scrollTop + targetRect.top - box.top - 8), behavior: 'smooth' });
  }, [activeChapterId, activeSection, selectedCommandId, selectionRevision]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-black/[0.06] px-5 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Editorial path</p>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 hide-scrollbar">
        <div className="space-y-5">
          {chapters.map((chapter, chapterIndex) => {
            const active = activeSection === 'macro' && activeChapterId === chapter.id;
            const expanded = expandedChapterId === chapter.id;
            const activeFocus = active ? chapter.originalOrder : [];
            const macroErrorType = chapterMacroErrorType(chapter);
            const canPreviewRepair = supportsFixedFlowPreview(analysis, chapter);
            return (
              <section
                key={chapter.id}
                ref={(node) => { chapterRefs.current[chapter.id] = node; }}
                className={`overflow-hidden rounded-[12px] border bg-white transition-colors ${active ? 'border-[#3478F6]/45' : 'border-black/[0.08]'}`}
              >
                <div className={`flex items-stretch ${active ? 'bg-[#F6FAFF]' : ''}`}>
                  <button type="button" onClick={() => onFocus(chapter, chapter.originalOrder)} className="min-w-0 flex-1 px-4 py-3.5 text-left">
                    <span className="block font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                      {String(chapterIndex + 1).padStart(2, '0')} · Mạch lớn · Body {chapter.paragraphIndex}
                    </span>
                    <strong className="mt-1.5 block font-sans text-[13px] leading-[1.35] text-[#171717]">{chapter.titleVi}</strong>
                    <span className="mt-1 block line-clamp-2 font-sans text-[9.5px] leading-[1.5] text-black/48">{chapter.diagnosisIntroVi}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={expanded ? 'Thu gọn nhận xét mạch lớn' : 'Mở nhận xét mạch lớn'}
                    aria-expanded={expanded}
                    onClick={() => {
                      onFocus(chapter, chapter.originalOrder);
                      setExpandedChapterId(current => current === chapter.id ? null : chapter.id);
                    }}
                    className="w-11 shrink-0 border-l border-black/[0.06] font-mono text-[16px] text-black/40 transition-colors hover:bg-black/[0.025] hover:text-black/70"
                  >
                    {expanded ? '−' : '+'}
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-black/[0.06] px-4 py-4 font-sans text-[10.5px] leading-[1.65] text-[#4A4D52]">
                    <div>
                      <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#B5473A]">Đoạn đang vướng ở đâu?</p>
                      <p className="mt-2">{chapter.diagnosisIntroVi}</p>
                      <div className="mt-3 divide-y divide-black/[0.06] border-y border-black/[0.06]">
                        {chapter.diagnosis.map((point, index) => (
                          <button key={point.id} type="button" onClick={() => onFocus(chapter, point.nodeIds)} className="grid w-full grid-cols-[22px_1fr] gap-2.5 py-3 text-left">
                            <span className="font-mono text-[8px] font-semibold text-[#B5473A]">{String(index + 1).padStart(2, '0')}</span>
                            <span><strong className="block font-semibold text-[#202020]">{point.titleVi}</strong><span className="mt-0.5 block">{point.bodyVi}</span></span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {macroErrorType === 'semantic_alignment' && (
                      <section className="mt-5 border-t border-[#3478F6]/15 pt-4">
                        <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Cách sửa ở cấp độ đoạn</p>
                        <p className="mt-2">{chapter.feedbackOnlySolutionVi}</p>
                        {chapter.taskAuditVi && <p className="mt-3 text-[9.5px] text-black/45">{chapter.taskAuditVi}</p>}
                      </section>
                    )}

                    {macroErrorType === 'coherence_order' && (
                      <>
                        <section className="mt-5 border-t border-black/[0.07] pt-4">
                          <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Đoạn này cần trả lời những câu hỏi nào?</p>
                          <p className="mt-2"><strong className="font-semibold text-[#202020]">Mục tiêu của đoạn:</strong> {chapter.paragraphPromiseVi}</p>
                          <div className="mt-3 space-y-2.5 border-l-2 border-[#3478F6]/20 pl-3">
                            {chapter.questions.map((question, index) => (
                              <button key={question.id} type="button" onClick={() => onFocus(chapter, question.nodeIds)} className="grid w-full grid-cols-[20px_1fr] gap-2 text-left">
                                <span className="font-mono text-[8px] font-semibold text-[#2563EB]">{index + 1}</span>
                                <span><strong className="font-semibold text-[#202020]">{question.questionVi}</strong><br /><span className="text-[9.5px] text-black/45">{question.purposeVi}</span></span>
                              </button>
                            ))}
                          </div>
                        </section>

                        <section className="mt-5 border-t border-black/[0.07] pt-4">
                          <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-black/35">Tách đoạn ra để nhìn rõ</p>
                          <p className="mt-2">Ta tạm chia đoạn thành những mẩu thông tin nhỏ, mỗi mẩu chỉ giữ một điều mà đoạn đang nói. Khi đặt các mẩu trả lời cùng một câu hỏi cạnh nhau, phần bị trộn và phần còn thiếu sẽ hiện ra rõ hơn.</p>
                          <ChapterChunkBreakdown analysis={analysis} chapter={chapter} onFocus={(nodeIds) => onFocus(chapter, nodeIds)} />
                          <button type="button" onClick={() => onFocus(chapter, chapter.originalOrder)} className="mt-4 block w-full text-left">
                            <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-black/35">Thứ tự đang được viết</p>
                            <ChapterFlowFigure chapter={chapter} order={chapter.originalOrder} focusNodeIds={activeFocus} />
                          </button>
                        </section>

                        <section className="mt-5 border-t border-[#3478F6]/15 pt-4">
                          <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Sắp lại flow</p>
                          <p className="mt-2">{chapter.repairIntroVi}</p>
                          <div className="mt-4 space-y-5">
                            {chapter.repairSteps.map((step, index) => (
                              <section key={step.id}>
                                <button type="button" onClick={() => onFocus(chapter, step.nodeIds)} className="w-full text-left">
                                  <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.13em] text-[#2563EB]">Bước {index + 1}</p>
                                  <h4 className="mt-1 text-[12px] font-semibold text-[#171717]">{step.titleVi}</h4>
                                  <p className="mt-1.5">{step.bodyVi}</p>
                                </button>
                                {step.order?.length ? <ChapterFlowFigure chapter={chapter} order={step.order} focusNodeIds={step.nodeIds} /> : null}
                              </section>
                            ))}
                          </div>
                          <div className="mt-5 border-t border-black/[0.07] pt-4">
                            <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#247657]">Flow sau khi sắp lại</p>
                            <ChapterFlowFigure chapter={chapter} order={chapter.finalOrder} />
                            <p>{chapter.finalSummaryVi}</p>
                          </div>
                          {canPreviewRepair ? (
                            <button
                              type="button"
                              onClick={() => onFlowPreviewModeChange(flowPreviewMode === 'original' ? 'fixed' : 'original')}
                              className="mt-4 rounded-[7px] bg-[#141413] px-3 py-2 text-[10px] font-semibold text-white"
                            >
                              {flowPreviewMode === 'original' ? 'Xem bản sắp lại các ý hiện có' : 'Quay lại bài gốc'}
                            </button>
                          ) : (
                            <div className="mt-4 rounded-[8px] border border-black/[0.08] bg-black/[0.025] px-3 py-2.5">
                              <p className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.12em] text-black/40">Không có bản xem trước toàn bài</p>
                              <p className="mt-1 text-[9.5px] leading-relaxed text-black/55">
                                Đề xuất này không thể được dựng lại chính xác chỉ bằng cách sắp lại hoặc viết lại các ý hiện có. Sơ đồ giữ nguyên đề xuất để bạn kiểm tra, nhưng bài viết không áp dụng các thao tác chưa được hỗ trợ đầy đủ.
                              </p>
                            </div>
                          )}
                        </section>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {chapters.length > 0 && commands.length > 0 && (
            <div className="flex items-center gap-3 px-1 pt-1">
              <span className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-black/30">Tiếp theo trong bài</span>
              <span className="h-px flex-1 bg-black/[0.07]" />
            </div>
          )}

          {commands.map((command, index) => {
            const active = activeSection === 'issues' && selectedCommandId === command.id;
            return (
              <div key={command.id}>
                {command.flow && command.paragraph && (
                  <FlowWalkthrough
                    flow={command.flow}
                    paragraph={command.paragraph}
                    stage={flowStages[command.flow.edgeId] || 'original'}
                    onStageChange={(stage) => onFlowStageChange(command.flow!.edgeId, stage)}
                  />
                )}
                <CommandCard
                  command={command}
                  index={chapters.length + index}
                  isActive={active}
                  isExpanded={expandedCommandId === command.id}
                  activeRef={active ? activeCommandRef : undefined}
                  onSelect={() => onSelectCommand(command.id)}
                  onToggleExpand={() => setExpandedCommandId(current => current === command.id ? null : command.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ColumnResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="group flex w-4 shrink-0 cursor-col-resize items-stretch justify-center"
    >
      <div className="my-2 w-px rounded-full bg-black/[0.06] transition-colors group-hover:bg-[#3478F6]/40" />
    </div>
  );
}

function buildChapterHighlights(analysis: WritingAnalysis, chapters: ArgumentFlowChapter[]): TextHighlight[] {
  return chapters.flatMap(chapter => chapter.assignments.flatMap(assignment => {
    const sentence = analysis.pyramid.paragraphs
      .flatMap(paragraph => paragraph.sentences)
      .find(item => item.nodeId === assignment.nodeId);
    if (!sentence || sentence.startChar == null || sentence.endChar == null) return [];
    const question = chapter.questions.find(item => item.id === assignment.questionId);
    return [{
      commandId: chapter.id,
      startChar: sentence.startChar,
      endChar: sentence.endChar,
      tone: 'reasoning' as const,
      label: question?.label || (assignment.role === 'conclusion' ? 'Kết luận' : 'Chưa xếp'),
      feedback: question?.questionVi || chapter.paragraphPromiseVi,
      nodeLabel: chunkLabel(assignment.nodeId),
    }];
  }));
}

function chapterAsCommand(analysis: WritingAnalysis, chapter: ArgumentFlowChapter, focusNodeIds: string[]): ReviewCommand {
  const paragraph = analysis.pyramid.paragraphs.find(item => item.index === chapter.paragraphIndex);
  const sentences = paragraph?.sentences.filter(sentence => sentence.nodeId && focusNodeIds.includes(sentence.nodeId)) || [];
  return {
    id: chapter.id,
    type: 'cc',
    errorCode: 'paragraph_reconstruction',
    errorLabelVi: 'Tái cấu trúc mạch lập luận',
    title: chapter.titleVi,
    label: `Body ${chapter.paragraphIndex}`,
    whyWrong: chapter.diagnosisIntroVi,
    impact: chapter.finalSummaryVi,
    snapshot: 'nodes',
    paragraph,
    sentences,
    focusNodeIds,
    primaryNodeIds: focusNodeIds,
  };
}

interface FixedFlowReplacement {
  commandId: string;
  startChar: number;
  endChar: number;
  sourceText: string;
  highlights: Array<{ startChar: number; endChar: number; nodeId: string }>;
}

interface FixedFlowPreview {
  essay: string;
  highlights: TextHighlight[];
  solutionNodeIds: string[];
}

function supportsFixedFlowPreview(analysis: WritingAnalysis, chapter: ArgumentFlowChapter) {
  const paragraph = analysis.pyramid.paragraphs.find(item => item.index === chapter.paragraphIndex);
  if (!paragraph || chapterMacroErrorType(chapter) !== 'coherence_order') return false;

  const sourceNodeIds = new Set(
    paragraph.sentences.flatMap(sentence => sentence.nodeId ? [sentence.nodeId] : []),
  );
  const finalNodeIds = new Set(chapter.finalOrder);
  const originalNodeIds = new Set(chapter.originalOrder);
  const hasUnsupportedRepair = chapter.repairSteps.some(step =>
    Boolean(step.addedNodes?.length || step.removedNodeIds?.length || step.mergedNodeIds?.length),
  );
  const isExactSourceOrder = (order: string[], nodeIds: Set<string>) =>
    order.length === sourceNodeIds.size
    && nodeIds.size === sourceNodeIds.size
    && order.every(nodeId => sourceNodeIds.has(nodeId));

  return !hasUnsupportedRepair
    && isExactSourceOrder(chapter.originalOrder, originalNodeIds)
    && isExactSourceOrder(chapter.finalOrder, finalNodeIds)
    && (chapter.revisedChunks || []).every(revision => sourceNodeIds.has(revision.nodeId));
}

function buildFixedFlowPreview(analysis: WritingAnalysis, essay: string, chapters: ArgumentFlowChapter[]): FixedFlowPreview {
  const replacements: FixedFlowReplacement[] = chapters.flatMap(chapter => {
    const paragraph = analysis.pyramid.paragraphs.find(item => item.index === chapter.paragraphIndex);
    if (!paragraph || !supportsFixedFlowPreview(analysis, chapter)) return [];
    const sentenceById = new Map(
      paragraph.sentences
        .filter(sentence => sentence.nodeId)
        .map(sentence => [sentence.nodeId!, sentence]),
    );
    const orderedOriginalIds = chapter.finalOrder.filter(nodeId => sentenceById.has(nodeId));
    const missingOriginalIds = chapter.originalOrder.filter(nodeId => !orderedOriginalIds.includes(nodeId));
    const revisedTextById = new Map((chapter.revisedChunks || []).map(revision => [revision.nodeId, revision.revisedText]));
    const originalIndexById = new Map(chapter.originalOrder.map((nodeId, index) => [nodeId, index]));
    const fixedIds = [...orderedOriginalIds, ...missingOriginalIds];
    const highlights: FixedFlowReplacement['highlights'] = [];
    let localOffset = 0;
    const parts: string[] = [];

    fixedIds.forEach((nodeId, index) => {
      const sentence = sentenceById.get(nodeId);
      if (!sentence) return;
      const originalText = sentence.sourceText?.trim() || sentence.simplifiedIdea?.trim() || '';
      const revisedText = revisedTextById.get(nodeId)?.trim();
      const text = revisedText || originalText;
      if (!text) return;

      if (parts.length > 0) {
        parts.push(' ');
        localOffset += 1;
      }
      const startChar = localOffset;
      parts.push(text);
      localOffset += text.length;

      const moved = originalIndexById.get(nodeId) !== index;
      const rewritten = Boolean(revisedText && revisedText !== originalText);
      if (moved || rewritten) highlights.push({ startChar, endChar: localOffset, nodeId });
    });

    const sourceText = parts.join('');
    if (!sourceText) return [];
    return [{
      commandId: chapter.id,
      startChar: paragraph.paragraphStartChar,
      endChar: paragraph.paragraphEndChar,
      sourceText,
      highlights,
    }];
  }).sort((left, right) => right.startChar - left.startChar);

  const ascendingReplacements = [...replacements].sort((left, right) => left.startChar - right.startChar);
  let cursor = 0;
  let fixedEssay = '';
  const highlights: TextHighlight[] = [];
  const solutionNodeIds = new Set<string>();

  ascendingReplacements.forEach(replacement => {
    fixedEssay += essay.slice(cursor, replacement.startChar);
    const replacementStart = fixedEssay.length;
    fixedEssay += replacement.sourceText;
    replacement.highlights.forEach(highlight => {
      highlights.push({
        commandId: replacement.commandId,
        startChar: replacementStart + highlight.startChar,
        endChar: replacementStart + highlight.endChar,
        tone: 'solution',
        label: 'Mạch ý đã được sắp lại',
        feedback: 'Phần này được đánh dấu vì đã được chuyển vị trí hoặc viết lại trong bản xem trước.',
      });
      solutionNodeIds.add(highlight.nodeId);
    });
    cursor = replacement.endChar;
  });

  fixedEssay += essay.slice(cursor);
  return { essay: fixedEssay, highlights, solutionNodeIds: Array.from(solutionNodeIds) };
}

function buildFixedFlowAnalysis(analysis: WritingAnalysis, chapters: ArgumentFlowChapter[]): WritingAnalysis {
  const chapterByParagraph = new Map(
    chapters
      .filter(chapter => supportsFixedFlowPreview(analysis, chapter))
      .map(chapter => [chapter.paragraphIndex, chapter]),
  );

  return {
    ...analysis,
    pyramid: {
      ...analysis.pyramid,
      paragraphs: analysis.pyramid.paragraphs.map(paragraph => {
        const chapter = chapterByParagraph.get(paragraph.index);
        if (!chapter) return paragraph;
        const sentenceById = new Map(
          paragraph.sentences
            .filter(sentence => sentence.nodeId)
            .map(sentence => [sentence.nodeId!, sentence]),
        );
        const revisionById = new Map((chapter.revisedChunks || []).map(revision => [revision.nodeId, revision.revisedText]));
        const orderedIds = chapter.finalOrder.filter(nodeId => sentenceById.has(nodeId));
        const remainingIds = chapter.originalOrder.filter(nodeId => !orderedIds.includes(nodeId) && sentenceById.has(nodeId));
        const sentences = [...orderedIds, ...remainingIds].map(nodeId => {
          const sentence = sentenceById.get(nodeId)!;
          const revisedText = revisionById.get(nodeId);
          return revisedText
            ? { ...sentence, sourceText: revisedText, simplifiedIdea: revisedText }
            : sentence;
        });
        return { ...paragraph, sentences };
      }),
    },
  };
}

function MissingComparisonData({ prompt, essay }: { prompt: string; essay: string }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)] gap-4">
      <EssayColumn
        prompt={prompt}
        essay={essay}
        highlights={[]}
        selectedCommandId={null}
        shouldScrollToSelection={false}
      />
      <aside className="rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/40">Comparison unavailable</p>
        <h2 className="mt-3 font-sans text-[16px] font-semibold text-[#171717]">Không có bản sửa đã xác minh</h2>
        <p className="mt-3 font-sans text-[11px] leading-relaxed text-[#565B63]">
          Phân tích có nhận xét cần sửa, nhưng không trả về bài viết đối chiếu. Bài gốc được giữ nguyên; hệ thống không tự dựng hoặc gắn nhãn Band 8/9 cho một bản thay thế thiếu dữ liệu.
        </p>
      </aside>
    </div>
  );
}

export default function WritingReviewWorkbench({ prompt, essay, analysis, onStartNew }: WorkbenchProps) {
  const hasConfirmedFindings = useMemo(() => assessmentHasConfirmedFindings(analysis), [analysis]);
  const argumentChapters = useMemo(() => analysis.argumentFlowChapters || [], [analysis.argumentFlowChapters]);
  const macroArgumentChapters = useMemo(
    () => argumentChapters.filter(chapter => chapterMacroErrorType(chapter) !== 'none'),
    [argumentChapters],
  );
  const [mode, setMode] = useState<ReviewMode>('argument');
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
  const [taskSelectionRevision, setTaskSelectionRevision] = useState(0);
  const [argumentView, setArgumentView] = useState<'essay' | 'map'>(hasConfirmedFindings ? 'essay' : 'map');
  const [argumentFeedbackTab, setArgumentFeedbackTab] = useState<'macro' | 'issues'>(macroArgumentChapters.length ? 'macro' : 'issues');
  const [flowPreviewMode, setFlowPreviewMode] = useState<'original' | 'fixed'>('original');
  const [activeArgumentChapterId, setActiveArgumentChapterId] = useState<string | null>(macroArgumentChapters[0]?.id || null);
  const [chapterFocusNodeIds, setChapterFocusNodeIds] = useState<string[]>(macroArgumentChapters[0]?.originalOrder || []);
  const [flowStages, setFlowStages] = useState<Record<string, FlowWalkthroughStage>>({});
  const [columnWidthsByMode, setColumnWidthsByMode] = useState<Record<ReviewMode, ColumnWidths>>(WORKBENCH_COLUMN_PRESETS);
  const columnWidths = columnWidthsByMode[mode];
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const argumentCommands = useMemo(() => buildArgumentFlowCommands(analysis), [analysis]);
  const nextArgumentCommands = argumentCommands;
  const activeArgumentChapter = macroArgumentChapters.find(chapter => chapter.id === activeArgumentChapterId) || macroArgumentChapters[0];
  const effectiveSelectedCommandId = nextArgumentCommands.some(command => command.id === selectedCommandId)
      ? selectedCommandId
      : nextArgumentCommands[0]?.id || null;
  const selectedArgumentCommand = nextArgumentCommands.find(command => command.id === effectiveSelectedCommandId);
  const selectArgumentCommand = (commandId: string) => {
    setArgumentFeedbackTab('issues');
    setFlowPreviewMode('original');
    setSelectedCommandId(commandId);
    setTaskSelectionRevision(current => current + 1);
  };
  const argumentHighlights = buildReasoningHighlights(nextArgumentCommands);
  const chapterHighlights = useMemo(() => buildChapterHighlights(analysis, macroArgumentChapters), [analysis, macroArgumentChapters]);
  const selectedChapterCommand = activeArgumentChapter
    ? chapterAsCommand(analysis, activeArgumentChapter, chapterFocusNodeIds.length ? chapterFocusNodeIds : activeArgumentChapter.originalOrder)
    : undefined;
  const comparisonHasVerifiedChanges = hasVerifiedComparisonChanges(analysis, essay);
  const verifiedComparisonEssay = comparisonHasVerifiedChanges && analysis.comparison?.revisedEssay?.trim()
    ? analysis.comparison.revisedEssay
    : null;
  const fixedFlowPreview = useMemo(
    () => buildFixedFlowPreview(analysis, essay, macroArgumentChapters),
    [analysis, essay, macroArgumentChapters],
  );
  const fixedFlowEssay = fixedFlowPreview.essay;
  const fixedFlowAnalysis = useMemo(
    () => buildFixedFlowAnalysis(analysis, macroArgumentChapters),
    [analysis, macroArgumentChapters],
  );
  const workspaceGridTemplate = `minmax(${MIN_COLUMN_WIDTHS.essay}px, ${columnWidths.essay}fr) 16px minmax(${MIN_COLUMN_WIDTHS.evidence}px, ${columnWidths.evidence}fr) 16px minmax(${MIN_COLUMN_WIDTHS.comments}px, ${columnWidths.comments}fr)`;
  const argumentWorkspaceGridTemplate = `minmax(560px, 7fr) 16px minmax(330px, 3fr)`;

  const selectArgumentChapter = (chapter: ArgumentFlowChapter, nodeIds: string[]) => {
    setArgumentFeedbackTab('macro');
    if (!supportsFixedFlowPreview(analysis, chapter)) setFlowPreviewMode('original');
    setActiveArgumentChapterId(chapter.id);
    setChapterFocusNodeIds(nodeIds);
    setTaskSelectionRevision(current => current + 1);
  };

  const startColumnResize = (
    leftKey: ColumnKey,
    rightKey: ColumnKey,
    event: ReactMouseEvent<HTMLDivElement>,
    order: ColumnKey[] = ['essay', 'evidence', 'comments'],
  ) => {
    event.preventDefault();
    const container = columnsRef.current;
    if (!container) return;

    const columnElements = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.getAttribute('role') !== 'separator'
    );
    const actualWidths = order.reduce<ColumnWidths>((widths, key, index) => {
      widths[key] = columnElements[index]?.getBoundingClientRect().width || MIN_COLUMN_WIDTHS[key];
      return widths;
    }, { ...MIN_COLUMN_WIDTHS });
    const totalWidth = actualWidths.essay + actualWidths.evidence + actualWidths.comments;
    const leftStart = actualWidths[leftKey];
    const rightStart = actualWidths[rightKey];
    const pairTotal = leftStart + rightStart;
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextLeft = clamp(
        leftStart + delta,
        MIN_COLUMN_WIDTHS[leftKey],
        pairTotal - MIN_COLUMN_WIDTHS[rightKey]
      );
      const nextRight = pairTotal - nextLeft;

      const nextWidths = {
        ...actualWidths,
        [leftKey]: nextLeft,
        [rightKey]: nextRight,
      };

      setColumnWidthsByMode(current => ({
        ...current,
        [mode]: {
          essay: (nextWidths.essay / totalWidth) * 100,
          evidence: (nextWidths.evidence / totalWidth) * 100,
          comments: (nextWidths.comments / totalWidth) * 100,
        },
      }));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <header className="grid shrink-0 items-stretch" style={{ gridTemplateColumns: workspaceGridTemplate }}>
        <section
          className="flex min-w-0 items-center rounded-[20px] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]"
          style={{
            gridColumn: 1,
            minWidth: MIN_COLUMN_WIDTHS.essay,
          }}
        >
          <ScoreDisplay scores={analysis.scores} />
        </section>

        <section
          className="min-w-0 rounded-[20px] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]"
          style={{
            gridColumn: '3 / 6',
            minWidth: MIN_COLUMN_WIDTHS.evidence + MIN_COLUMN_WIDTHS.comments + 16,
          }}
        >
          <div className="mb-2 flex h-5 items-start justify-end">
            <button
              type="button"
              onClick={onStartNew}
              className="shrink-0 rounded-[7px] px-2 py-1 font-sans text-[10px] font-medium leading-none text-[#857F70] transition-colors hover:text-[#141413]"
            >
              <span>←</span> Bài mới
            </button>
          </div>
          <ModeTabs
            mode={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              setSelectedCommandId(null);
              if (nextMode === 'argument') setArgumentView(hasConfirmedFindings ? 'essay' : 'map');
            }}
          />
        </section>
      </header>

      <div
        ref={columnsRef}
        className="grid min-h-0 flex-1 items-stretch"
        style={{ gridTemplateColumns: mode === 'argument' ? argumentWorkspaceGridTemplate : workspaceGridTemplate }}
      >
        {mode === 'argument' && (
          <>
            <div className="min-h-0 min-w-0">
              <ArgumentFlowSurface
                view={argumentView}
                onViewChange={setArgumentView}
                selectedCommand={macroArgumentChapters.length && argumentFeedbackTab === 'macro' ? selectedChapterCommand : selectedArgumentCommand}
                prompt={prompt}
                essay={argumentFeedbackTab === 'macro' && flowPreviewMode === 'fixed' ? fixedFlowEssay : essay}
                highlights={macroArgumentChapters.length && argumentFeedbackTab === 'macro'
                  ? flowPreviewMode === 'fixed' ? fixedFlowPreview.highlights : chapterHighlights
                  : argumentHighlights}
                selectedCommandId={macroArgumentChapters.length && argumentFeedbackTab === 'macro' ? activeArgumentChapter?.id || null : effectiveSelectedCommandId}
                shouldScrollToSelection={macroArgumentChapters.length && argumentFeedbackTab === 'macro' ? activeArgumentChapterId !== null : selectedCommandId !== null}
                selectionRevision={taskSelectionRevision}
                onSelectCommand={macroArgumentChapters.length && argumentFeedbackTab === 'macro' ? (chapterId) => {
                  const chapter = macroArgumentChapters.find(item => item.id === chapterId);
                  if (!chapter) return;
                  selectArgumentChapter(chapter, chapter.originalOrder);
                } : selectArgumentCommand}
                analysis={argumentFeedbackTab === 'macro' && flowPreviewMode === 'fixed' ? fixedFlowAnalysis : analysis}
                solutionNodeIds={argumentFeedbackTab === 'macro' && flowPreviewMode === 'fixed' ? fixedFlowPreview.solutionNodeIds : []}
                essayLabel={argumentFeedbackTab === 'macro' && flowPreviewMode === 'fixed' ? 'Bản xem trước · chỉ sắp lại và viết lại' : 'Student essay'}
              />
            </div>
            <ColumnResizeHandle onMouseDown={(event) => startColumnResize('essay', 'comments', event, ['essay', 'comments', 'evidence'])} />
            <div className="min-h-0 min-w-0">
              {macroArgumentChapters.length ? (
                <section className="flex h-full min-h-0 flex-col rounded-[20px] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]">
                  <ArgumentEditorialChapters
                    analysis={analysis}
                    chapters={macroArgumentChapters}
                    commands={nextArgumentCommands}
                    activeChapterId={activeArgumentChapter?.id || null}
                    selectedCommandId={effectiveSelectedCommandId}
                    activeSection={argumentFeedbackTab}
                    onFocus={selectArgumentChapter}
                    onSelectCommand={selectArgumentCommand}
                    flowPreviewMode={flowPreviewMode}
                    onFlowPreviewModeChange={(nextMode) => {
                      setFlowPreviewMode(nextMode);
                      setTaskSelectionRevision(current => current + 1);
                    }}
                    selectionRevision={taskSelectionRevision}
                    flowStages={flowStages}
                    onFlowStageChange={(flowId, stage) => setFlowStages(current => ({ ...current, [flowId]: stage }))}
                  />
                </section>
              ) : (
                <ArgumentFlowRail
                  commands={argumentCommands}
                  selectedCommandId={effectiveSelectedCommandId}
                  shouldScrollToSelection={selectedCommandId !== null}
                  selectionRevision={taskSelectionRevision}
                  onSelectCommand={selectArgumentCommand}
                  flowStages={flowStages}
                  onFlowStageChange={(flowId, stage) => setFlowStages(current => ({ ...current, [flowId]: stage }))}
                />
              )}
            </div>
          </>
        )}

        {mode === 'language' && (
          <div className="col-span-5 min-h-0 min-w-0">
            <LanguageFeedbackPanel
              prompt={prompt}
              essay={essay}
              lexicalHighlights={analysis.lexicalHighlights}
              grammaticalHighlights={analysis.grammaticalHighlights}
            />
          </div>
        )}

        {mode === 'overall' && (
          <div className="col-span-5 min-h-0 min-w-0">
            <OverallAssessmentPanel scores={analysis.scores} analysis={analysis} essay={essay} />
          </div>
        )}

        {mode === 'comparison' && (
          <div className="col-span-5 min-h-0 min-w-0">
            {verifiedComparisonEssay ? (
              <ComparisonReviewPanel
                prompt={prompt}
                originalEssay={essay}
                improvedEssay={verifiedComparisonEssay}
                changes={analysis.comparison?.changes}
              />
            ) : hasConfirmedFindings ? (
              <MissingComparisonData prompt={prompt} essay={essay} />
            ) : (
              <ComparisonReviewPanel
                prompt={prompt}
                originalEssay={essay}
                improvedEssay={essay}
                alreadyAtTarget
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
