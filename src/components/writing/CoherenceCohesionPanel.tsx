'use client';

import { useMemo, useState } from 'react';
import {
  CoherenceFlow,
  EssayHighlight,
  ParagraphMoveNode,
  PyramidSolutionAction,
  WritingAnalysis,
} from '@/types/writing';
import CoherenceFlowDiagram from './CoherenceFlowDiagram';
import { errorLabelVi, inferCoherenceErrorCode } from '@/lib/assessment-error-taxonomy';

function sentenceNodeId(paragraphIndex: number, sentenceIndex: number) {
  return `sentence-${paragraphIndex}-${sentenceIndex}`;
}

function isBodyParagraph(paragraph: ParagraphMoveNode) {
  const label = paragraph.label.toLowerCase();
  return !['introduction', 'conclusion', 'mở bài', 'kết bài'].includes(label);
}

function getSuggestedOrder(flow?: CoherenceFlow): PyramidSolutionAction | undefined {
  return flow?.issue.solutionActions?.find(action =>
    action.type === 'suggest_order' && Boolean(action.proposedOrder?.length)
  );
}

function statusCopy(status: CoherenceFlow['status']) {
  if (status === 'broken') return 'Broken';
  if (status === 'weak') return 'Weak';
  return 'Works';
}

export interface CoherenceFlowSelection {
  selectedFlowId: string | null;
  selectedFlow: CoherenceFlow | undefined;
  showSolution: boolean;
  selectFlow: (flowId: string) => void;
  toggleSolution: () => void;
}

export function useCoherenceFlowSelection(analysis: WritingAnalysis): CoherenceFlowSelection {
  const flows = useMemo(() => analysis.pyramid.coherenceFlows || [], [analysis.pyramid.coherenceFlows]);
  const issueFlows = useMemo(() => flows.filter(flow => flow.status !== 'works'), [flows]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(issueFlows[0]?.edgeId || null);
  const [showSolution, setShowSolution] = useState(false);

  const resolvedFlowId = issueFlows.some(flow => flow.edgeId === selectedFlowId)
    ? selectedFlowId
    : issueFlows[0]?.edgeId || null;
  const selectedFlow = issueFlows.find(flow => flow.edgeId === resolvedFlowId);

  return {
    selectedFlowId: selectedFlow?.edgeId || null,
    selectedFlow,
    showSolution: Boolean(showSolution && selectedFlow && selectedFlowId === resolvedFlowId),
    selectFlow: (flowId) => {
      setSelectedFlowId(flowId);
      setShowSolution(false);
    },
    toggleSolution: () => setShowSolution(current => !current),
  };
}

function FlowDiagram({ paragraph, flow, paragraphFlows, showSolution }: {
  paragraph: ParagraphMoveNode;
  flow: CoherenceFlow;
  paragraphFlows: CoherenceFlow[];
  showSolution: boolean;
}) {
  const action = getSuggestedOrder(flow);
  const writtenOrder = paragraph.sentences.map(sentence => sentenceNodeId(paragraph.index, sentence.index));
  const suggestedOrder = action?.proposedOrder?.length ? action.proposedOrder : flow.suggestedOrder;
  const displayedOrder = showSolution && suggestedOrder?.length ? suggestedOrder : writtenOrder;

  return (
    <section className="w-full rounded-[14px] border border-black/[0.06] bg-[#F7F8F9] p-4">
      <CoherenceFlowDiagram
        nodeIds={displayedOrder}
        flows={paragraphFlows}
        selectedFlowId={flow.edgeId}
        solution={showSolution}
      />
    </section>
  );
}

function FlowFeedback({ flow, showSolution, onToggleSolution }: {
  flow: CoherenceFlow;
  showSolution: boolean;
  onToggleSolution: () => void;
}) {
  const hasSolution = Boolean(getSuggestedOrder(flow) || flow.suggestedOrder?.length);
  const solution = getSuggestedOrder(flow);
  const solutionText = solution?.whyBetter || solution?.details || flow.issue.comment?.solutionBodyVi;
  const naturalFeedback = flow.issue.comment?.bodyVi?.trim();
  const actualDependency = flow.actualDependency?.trim();
  const readerBurden = flow.readerBurdenVi?.trim();
  const displayError = flow.issue.errorLabelVi || errorLabelVi(
    flow.issue.errorCode || inferCoherenceErrorCode(flow.issue.type, flow.issue.title, flow.diagnosticPattern),
    flow.issue.title,
  );
  const scaffoldCue = flow.flowType === 'joint'
    ? 'Nhìn các ý cùng dẫn vào một điểm trên sơ đồ: chúng đã được đặt theo thứ tự để người đọc thấy chúng cùng làm rõ một ý chưa?'
    : flow.flowType === 'backward' || flow.flowType === 'bridge'
      ? 'Hãy nhìn hướng của đường nối trên map: người đọc có nhận được phần giải thích trước khi gặp ý cần được giải thích không?'
      : 'Nhìn thứ tự các ý trên sơ đồ: người đọc cần hiểu bước nào trước để mạch ý tự nhiên?';
  return (
    <section className="rounded-[14px] bg-white px-3 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.025)] ring-1 ring-black/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[#2563EB]">
            {showSolution ? 'Why this flow works better' : 'Flow feedback'}
          </p>
          <h2 className="mt-1.5 font-sans text-[16px] font-semibold leading-snug text-[#171717] [text-wrap:balance]">
            {showSolution ? solution?.label || 'Suggested progression' : displayError}
          </h2>
          {!showSolution && (
            <p className="mt-1 font-sans text-[11px] font-semibold leading-snug text-[#2A2A2A]">{flow.issue.title}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-[6px] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${showSolution ? 'bg-[#E5F3FE] text-[#2563EB]' : 'bg-black/[0.04] text-black/50'}`}>
          {showSolution ? 'Fix' : statusCopy(flow.status)}
        </span>
      </div>
      {showSolution ? (
        <div className="mt-4 grid max-w-3xl gap-3 font-sans text-[12px] leading-relaxed text-[#505050] [text-wrap:pretty]">
          {solutionText ? <p><span className="font-semibold text-[#2563EB]">Tốt hơn vì: </span>{solutionText}</p> : null}
          {!solutionText && (solution?.dependencyClaim || actualDependency) && (
            <p><span className="font-semibold text-[#5C5C5C]">Mạch ý cần có: </span>{solution?.dependencyClaim || actualDependency}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid max-w-3xl gap-3 font-sans text-[12px] leading-relaxed text-[#505050] [text-wrap:pretty]">
          <p><span className="font-semibold text-[#2563EB]">Nhìn vào map: </span>{scaffoldCue}</p>
          {naturalFeedback ? (
            <p><span className="font-semibold text-[#2A2A2A]">Phân tích: </span>{naturalFeedback}</p>
          ) : (
            <>
              <p><span className="font-semibold text-[#A3473C]">Sai vì: </span>{flow.issue.whyWrong}</p>
              <p><span className="font-semibold text-[#2563EB]">Vì vậy: </span>{flow.issue.impactOnPurpose}</p>
            </>
          )}
          {!naturalFeedback && actualDependency ? (
            <p><span className="font-semibold text-[#2563EB]">Dependency thật: </span>{actualDependency}</p>
          ) : null}
          {!naturalFeedback && readerBurden ? (
            <p><span className="font-semibold text-[#5C5C5C]">Người đọc phải làm gì: </span>{readerBurden}</p>
          ) : null}
        </div>
      )}
      {hasSolution && (
        <button
          type="button"
          onClick={onToggleSolution}
          className={`mt-5 inline-flex min-h-9 items-center justify-center rounded-[8px] px-3.5 font-sans text-[11px] font-semibold transition-colors ${
            showSolution ? 'bg-[#EAF4FF] text-[#1E5BC8] hover:bg-[#DCEEFF]' : 'bg-[#141413] text-white hover:bg-black'
          }`}
        >
          {showSolution ? 'Xem written flow' : 'Xem cách sửa'}
        </button>
      )}
    </section>
  );
}

function CohesionNotes({ highlights }: { highlights: EssayHighlight[] }) {
  if (!highlights.length) return null;
  return (
    <section className="mt-6">
      <div className="px-1">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-black/40">Cohesion</p>
      </div>
      <div className="mt-4 grid gap-4">
        {highlights.map((highlight, index) => {
          const displayError = highlight.errorLabelVi || errorLabelVi(highlight.errorCode || highlight.highlightType, highlight.label);
          return (
            <article
              key={`${highlight.startChar}-${highlight.endChar}-${index}`}
              className="rounded-[14px] border border-transparent bg-white px-3 py-3 text-left shadow-[0_2px_10px_rgba(0,0,0,0.025)] ring-1 ring-black/[0.05]"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-sans text-[13px] font-semibold leading-snug text-[#171717]">{displayError}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-[5px] bg-[#E5F3FE] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-[#2563EB]">
                      CC
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/40">Cohesion</span>
                    <span className="font-mono text-[8px] text-[#A3A3A3]">#{index + 1}</span>
                  </div>
                  <p className="mt-1.5 font-sans text-[11px] font-semibold leading-snug text-[#2A2A2A]">{highlight.label}</p>
                  <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#525252]">
                    <span className="font-semibold text-[#2563EB]">Nhìn vào đoạn được đánh dấu: </span>
                    tín hiệu này đang nối rõ ý trước với ý sau, hay đang buộc người đọc tự đoán quan hệ?
                  </p>
                  <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#525252]">
                    <span className="font-semibold text-[#2A2A2A]">Giải thích: </span>{highlight.feedback}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function CoherenceCohesionPanel({
  analysis,
  selection,
}: {
  analysis: WritingAnalysis;
  selection: CoherenceFlowSelection;
}) {
  const paragraphs = useMemo(() => analysis.pyramid.paragraphs.filter(isBodyParagraph), [analysis.pyramid.paragraphs]);
  const issueFlows = useMemo(
    () => (analysis.pyramid.coherenceFlows || []).filter(flow => flow.status !== 'works'),
    [analysis.pyramid.coherenceFlows]
  );
  const selectedFlow = selection.selectedFlow;
  const selectedParagraph = selectedFlow
    ? paragraphs.find(paragraph => paragraph.index === selectedFlow.paragraphIndex)
    : undefined;
  const selectedParagraphFlows = selectedParagraph
    ? (analysis.pyramid.coherenceFlows || []).filter(flow => flow.paragraphIndex === selectedParagraph.index)
    : [];

  if (!issueFlows.length || !selectedFlow || !selectedParagraph) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center rounded-[20px] bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="max-w-sm">
          <p className="font-sans text-[15px] font-semibold text-[#242424]">Chưa xác nhận được lỗi mạch ý đáng kể</p>
          <p className="mt-2 font-sans text-[12px] leading-relaxed text-[#737373]">
            Lượt review này chưa tìm thấy quan hệ ý đủ rõ để tạo feedback ở cấp đoạn; điều đó không có nghĩa mọi cách sắp xếp đều là tối ưu.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full min-h-0 overflow-y-auto rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)] hide-scrollbar">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Coherence</p>
      <section className="mt-3 pb-4">
        <div className="sticky top-0 z-10 bg-white/95 pb-4 backdrop-blur">
          <FlowDiagram
            paragraph={selectedParagraph}
            flow={selectedFlow}
            paragraphFlows={selectedParagraphFlows}
            showSolution={selection.showSolution}
          />
        </div>
        <div className="pt-1">
          <FlowFeedback flow={selectedFlow} showSolution={selection.showSolution} onToggleSolution={selection.toggleSolution} />
        </div>
      </section>
      <CohesionNotes highlights={analysis.cohesionHighlights} />
    </section>
  );
}
