'use client';

import { useRef, useLayoutEffect, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CoherenceFlow,
  EdgeReview,
  MacroAnswerNode as MacroAnswerNodeType,
  ParagraphMoveNode,
  PyramidError,
} from '@/types/writing';

interface SimplePyramidProps {
  macroAnswer: MacroAnswerNodeType;
  paragraphs: ParagraphMoveNode[];
  edgeReviews?: EdgeReview[];
  coherenceFlows?: CoherenceFlow[];
  activeParagraphIndex: number | null;
  onParagraphClick: (index: number | null) => void;
  isFullscreen?: boolean;
  onRequestFullscreen?: () => void;
  onExitFullscreen?: () => void;
  snapshotMode?: boolean;
  snapshotFocusNodeIds?: string[];
  snapshotSolutionNodeIds?: string[];
  snapshotScale?: number;
  panThroughNodes?: boolean;
  wheelPanEnabled?: boolean;
  showInCanvasFeedback?: boolean;
  evidenceFocusMode?: boolean;
  /** Lets an assessment walkthrough control the existing solution preview. */
  requestedFlowPreviewId?: string | null;
}

interface LineData {
  id: string;
  type: 'vertical_bus' | 'vertical_drop' | 'horizontal_sibling' | 'coherence_flow';
  edgeKind?: 'macro_to_para' | 'para_to_para' | 'para_to_sentence' | 'sentence_to_sentence' | 'bus';
  edgeId?: string;
  x1: number; y1: number;
  x2: number; y2: number;
  routeY?: number;
  sourceXs?: number[];
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  flowType?: CoherenceFlow['flowType'];
  error?: boolean;
  label?: string;
  relatedNodes?: string[];
  focusOnly?: boolean;
  paraIndex?: number;
  sentenceIndex?: number;
  fromParaIndex?: number;
  toParaIndex?: number;
  fromSentenceIndex?: number;
  toSentenceIndex?: number;
  nodeBottomY?: number;
}

interface SvgBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const AMBIENT_LOW = 'shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]';
const NODE_BASE = `border border-black/[0.06] bg-white ${AMBIENT_LOW}`;
const NODE_ACTIVE = 'border-[#3B82F6]/35 bg-[#E5F3FE] shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]';
const NODE_ERROR = 'border-[#EC6A5B]/45 bg-[#FFF4EE]';
const NODE_RELATION = 'ring-2 ring-[#E6961F]/25';
const NODE_EVIDENCE_FOCUS = 'ring-2 ring-[#3B82F6]/25';
const EMPTY_EDGE_REVIEWS: EdgeReview[] = [];
const EMPTY_COHERENCE_FLOWS: CoherenceFlow[] = [];

function sameSvgBounds(a: SvgBounds, b: SvgBounds) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function sameLineData(a: LineData, b: LineData) {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.edgeKind === b.edgeKind &&
    a.edgeId === b.edgeId &&
    a.x1 === b.x1 &&
    a.y1 === b.y1 &&
    a.x2 === b.x2 &&
    a.y2 === b.y2 &&
    a.routeY === b.routeY &&
    (a.sourceXs || []).join('|') === (b.sourceXs || []).join('|') &&
    a.sourceY === b.sourceY &&
    a.targetX === b.targetX &&
    a.targetY === b.targetY &&
    a.flowType === b.flowType &&
    a.error === b.error &&
    a.label === b.label &&
    a.focusOnly === b.focusOnly &&
    a.paraIndex === b.paraIndex &&
    a.sentenceIndex === b.sentenceIndex &&
    a.fromParaIndex === b.fromParaIndex &&
    a.toParaIndex === b.toParaIndex &&
    a.fromSentenceIndex === b.fromSentenceIndex &&
    a.toSentenceIndex === b.toSentenceIndex &&
    a.nodeBottomY === b.nodeBottomY &&
    (a.relatedNodes || []).join('|') === (b.relatedNodes || []).join('|')
  );
}

function sameLines(a: LineData[], b: LineData[]) {
  return a.length === b.length && a.every((line, index) => sameLineData(line, b[index]));
}

function paraNodeId(index: number) {
  return `para-${index}`;
}

function sentenceNodeId(paraIndex: number, sentenceIndex: number) {
  return `sentence-${paraIndex}-${sentenceIndex}`;
}

function macroParaEdgeId(paraIndex: number) {
  return `edge:macro->para:${paraIndex}`;
}

function paraParaEdgeId(fromIndex: number, toIndex: number) {
  return `edge:para:${fromIndex}->para:${toIndex}`;
}

function paraSentenceEdgeId(paraIndex: number, sentenceIndex: number) {
  return `edge:para:${paraIndex}->sentence:${sentenceIndex}`;
}

function sentenceSentenceEdgeId(paraIndex: number, fromSentenceIndex: number, toSentenceIndex: number) {
  return `edge:sentence:${paraIndex}:${fromSentenceIndex}->${toSentenceIndex}`;
}

function shortNodeLabel(nodeId: string) {
  const match = nodeId.match(/^sentence-\d+-(\d+)$/);
  return match ? `S${match[1]}` : nodeId;
}

function parseSentenceNodeId(nodeId: string) {
  const match = nodeId.match(/^sentence-(\d+)-(\d+)$/);
  if (!match) return null;
  return { paraIndex: Number(match[1]), sentenceIndex: Number(match[2]) };
}

function internalErrors(errors: PyramidError[]) {
  return errors.filter(e => e.type === 'internal');
}
function verticalRelError(errors: PyramidError[]) {
  return errors.find(e => e.type === 'relational' && e.direction === 'vertical');
}
function horizontalRelError(errors: PyramidError[]) {
  return errors.find(e => e.type === 'relational' && e.direction === 'horizontal');
}

function getConnectorBounds(lines: LineData[], baseW: number, baseH: number): SvgBounds {
  let minX = 0;
  let minY = 0;
  let maxX = baseW;
  let maxY = baseH;

  for (const line of lines) {
    minX = Math.min(minX, line.x1, line.x2);
    minY = Math.min(minY, line.y1, line.y2, line.routeY ?? line.y1);
    maxX = Math.max(maxX, line.x1, line.x2);
    maxY = Math.max(maxY, line.y1, line.y2, line.routeY ?? line.y2);

    if (line.type === 'horizontal_sibling' && line.label) {
      const midX = (line.x1 + line.x2) / 2;
      minX = Math.min(minX, midX - 60);
      maxX = Math.max(maxX, midX + 60);
      minY = Math.min(minY, (line.routeY ?? line.y1) - 16);
      maxY = Math.max(maxY, (line.routeY ?? line.y1) + 900);
    }

    if (line.edgeId) {
      const tagX = (line.x1 + line.x2) / 2;
      const tagY = line.routeY ?? (line.y1 + line.y2) / 2;
      minX = Math.min(minX, tagX - 170);
      maxX = Math.max(maxX, tagX + 170);
      maxY = Math.max(maxY, tagY + 900);
    }
  }

  const pad = 32;
  const x = Math.floor(minX - pad);
  const y = Math.floor(minY - pad);
  return {
    x,
    y,
    w: Math.ceil(maxX - x + pad),
    h: Math.ceil(maxY - y + pad),
  };
}

interface CoherenceFlowLayerProps {
  paragraph: ParagraphMoveNode;
  flows: CoherenceFlow[];
  selectedFlowId: string | null;
  previewFlowSolutionId: string | null;
  openProposedNodeDetailId: string | null;
  renderMap?: boolean;
  onSelectFlow: (flowId: string) => void;
  onTogglePreview: (flowId: string) => void;
  onToggleProposedNode: (nodeId: string) => void;
}

function CoherenceFlowLayer({
  paragraph,
  flows,
  selectedFlowId,
  previewFlowSolutionId,
  openProposedNodeDetailId,
  renderMap = true,
  onSelectFlow,
  onTogglePreview,
  onToggleProposedNode,
}: CoherenceFlowLayerProps) {
  const visibleFlows = flows.filter(flow => flow.status !== 'works');
  if (visibleFlows.length === 0) return null;

  const cardWidth = 200;
  const gap = 112;
  const padX = 12;
  const topY = 12;
  const laneY = 66;
  const svgHeight = 118;
  const mapWidth = paragraph.sentences.length * cardWidth + Math.max(0, paragraph.sentences.length - 1) * gap + padX * 2;
  const layerWidth = renderMap ? mapWidth : 380;
  const nodeX = (nodeId: string) => {
    const parsed = parseSentenceNodeId(nodeId);
    if (!parsed || parsed.paraIndex !== paragraph.index) return null;
    const displayIndex = paragraph.sentences.findIndex(sentence => sentence.index === parsed.sentenceIndex);
    if (displayIndex < 0) return null;
    return padX + displayIndex * (cardWidth + gap) + cardWidth / 2;
  };
  const selectedFlow = visibleFlows.find(flow => flow.edgeId === selectedFlowId) || null;
  const previewFlow = visibleFlows.find(flow => flow.edgeId === previewFlowSolutionId) || null;
  const activeFlow = previewFlow || selectedFlow;
  const isPreviewing = !!activeFlow && previewFlowSolutionId === activeFlow.edgeId;
  const activeActions = activeFlow?.issue.solutionActions || [];
  const proposedNodeAction = activeActions.find(action =>
    (action.type === 'add_node' || action.type === 'add_bridge') &&
    action.proposedText
  );
  const proposedNodeId = proposedNodeAction?.proposedNodeId || proposedNodeAction?.targetNodeId || `flow-proposed-${activeFlow?.edgeId}`;
  const proposedNodeOpen = openProposedNodeDetailId === proposedNodeId;
  const proposedNodeWhyBetter = proposedNodeAction?.whyBetter || proposedNodeAction?.details;

  return (
    <div className="mt-5 w-full">
      {renderMap && (
        <div className="mb-2 flex items-center justify-center">
          <div className="rounded-[8px] border border-black/[0.06] bg-white px-3 py-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[#737373] shadow-[0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]">
            Coherence flow
          </div>
        </div>
      )}

      <div className="relative mx-auto" style={{ width: layerWidth }}>
        {renderMap && (
        <svg width={mapWidth} height={svgHeight} viewBox={`0 0 ${mapWidth} ${svgHeight}`} className="overflow-visible">
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#E6961F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="flow-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="rgba(23,23,23,0.12)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>

          {visibleFlows.map((flow, index) => {
            const sourceXs = flow.fromNodeIds.map(nodeX).filter((x): x is number => x !== null);
            const targetX = nodeX(flow.toNodeId);
            if (!sourceXs.length || targetX === null) return null;

            const flowSelected = flow.edgeId === selectedFlowId || flow.edgeId === previewFlowSolutionId;
            const stroke = flowSelected ? '#E6961F' : 'rgba(23,23,23,0.14)';
            const marker = flowSelected ? 'url(#flow-arrow)' : 'url(#flow-arrow-muted)';
            const labelX = (Math.min(...sourceXs, targetX) + Math.max(...sourceXs, targetX)) / 2;
            const labelY = laneY - 14 + index * 7;

            return (
              <g key={flow.edgeId}>
                {flow.flowType === 'joint' && sourceXs.length > 1 ? (
                  <>
                    {sourceXs.map((sourceX, sourceIndex) => (
                      <path
                        key={`${flow.edgeId}-source-${sourceIndex}`}
                        d={`M${sourceX},${topY} L${sourceX},${laneY}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={flowSelected ? 1.8 : 1.2}
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                      />
                    ))}
                    <path
                      d={`M${Math.min(...sourceXs, targetX)},${laneY} L${Math.max(...sourceXs, targetX)},${laneY}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={flowSelected ? 1.8 : 1.2}
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                    />
                    <path
                      d={`M${targetX},${laneY} L${targetX},${topY}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={flowSelected ? 1.8 : 1.2}
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                      markerEnd={marker}
                    />
                  </>
                ) : (
                  <path
                    d={`M${sourceXs[0]},${topY} L${sourceXs[0]},${laneY} L${targetX},${laneY} L${targetX},${topY}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={flowSelected ? 1.8 : 1.2}
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    markerEnd={marker}
                  />
                )}

                <foreignObject x={labelX - 64} y={labelY} width="128" height="28" style={{ pointerEvents: 'auto' }}>
                  <div className="flex h-full items-center justify-center">
                    <button
                      type="button"
                      data-no-pan="true"
                      onClick={event => {
                        event.stopPropagation();
                        onSelectFlow(flow.edgeId);
                      }}
                      onMouseDown={event => event.stopPropagation()}
                      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-[3px] font-sans text-[8.5px] font-semibold uppercase tracking-widest shadow-[0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)] transition-all ${
                        flowSelected
                          ? 'border-[#E6961F]/50 bg-white text-[#8A5B0A]'
                          : 'border-[#E6961F]/25 bg-white/90 text-[#9F3D31]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-[3px] bg-[#EC6A5B]" />
                      {flow.relationshipTag}
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
        )}

        <AnimatePresence initial={false}>
          {activeFlow && (
            <motion.div
              key={`flow-card-${activeFlow.edgeId}`}
              data-no-pan="true"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
              className="mx-auto mt-1 w-[360px] rounded-[12px] border border-[#E6961F]/25 bg-white p-4 shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]"
              onMouseDown={event => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#E6961F]">
                  Flow lỗi
                </p>
                <span className="rounded-[5px] bg-[#FFF4EE] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#9F3D31]">
                  {activeFlow.status}
                </span>
              </div>
              <h4 className="mb-2 font-sans text-[13px] font-semibold leading-snug text-[#171717]">{activeFlow.issue.title}</h4>
              <div className="space-y-2 font-sans text-[11px] leading-relaxed text-[#525252]">
                <p><span className="font-semibold text-[#9F3D31]">Sai vì: </span>{activeFlow.issue.whyWrong}</p>
                <p><span className="font-semibold text-[#8A5B0A]">Ảnh hưởng mục đích: </span>{activeFlow.issue.impactOnPurpose}</p>
                <p><span className="font-semibold text-[#737373]">Ảnh hưởng người đọc: </span>{activeFlow.issue.impactOnReader}</p>
              </div>

              <button
                type="button"
                className="mt-3 w-full rounded-[8px] bg-[#141413] py-2 font-sans text-[12px] font-medium text-white transition-colors hover:bg-black"
                onClick={event => {
                  event.stopPropagation();
                  onTogglePreview(activeFlow.edgeId);
                }}
              >
                {isPreviewing ? 'Ẩn cách sửa' : 'Xem cách sửa'}
              </button>

              <AnimatePresence initial={false}>
                {isPreviewing && proposedNodeAction && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
                    className="overflow-hidden"
                  >
                      <div className="mt-3 rounded-[10px] border border-[#3B82F6]/25 bg-[#E5F3FE] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-[5px] bg-white px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-widest text-[#2563EB]">
                            {proposedNodeAction.proposedLabel || (proposedNodeAction.type === 'add_bridge' ? 'BRIDGE' : 'NEW')}
                          </span>
                          <span className="rounded-[5px] bg-[#3B82F6] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-widest text-white">
                            thêm
                          </span>
                        </div>
                        <p className="font-sans text-[11px] leading-relaxed text-[#1E3A8A]">{proposedNodeAction.proposedText}</p>
                        {proposedNodeWhyBetter && (
                          <button
                            type="button"
                            className="mt-2 flex w-full items-center justify-between rounded-[7px] border border-[#3B82F6]/15 bg-white/60 px-2 py-1.5 font-sans text-[9px] font-semibold text-[#2563EB]"
                            onClick={event => {
                              event.stopPropagation();
                              onToggleProposedNode(proposedNodeId);
                            }}
                          >
                            <span>Tại sao tốt hơn</span>
                            <span className={`transition-transform duration-200 ${proposedNodeOpen ? 'rotate-180' : ''}`}>⌄</span>
                          </button>
                        )}
                        <AnimatePresence initial={false}>
                          {proposedNodeWhyBetter && proposedNodeOpen && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: 'spring', bounce: 0, duration: 0.24 }}
                              className="mt-2 overflow-hidden border-t border-[#3B82F6]/15 pt-2 font-sans text-[9.5px] leading-relaxed text-[#2563EB]/75"
                            >
                              {proposedNodeWhyBetter}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SimplePyramid({
  macroAnswer,
  paragraphs: rawParagraphs,
  edgeReviews = EMPTY_EDGE_REVIEWS,
  coherenceFlows = EMPTY_COHERENCE_FLOWS,
  activeParagraphIndex,
  onParagraphClick,
  isFullscreen = false,
  onRequestFullscreen,
  snapshotMode = false,
  snapshotFocusNodeIds = [],
  snapshotSolutionNodeIds = [],
  snapshotScale = 0.74,
  panThroughNodes = false,
  wheelPanEnabled = true,
  showInCanvasFeedback = true,
  evidenceFocusMode = false,
  requestedFlowPreviewId,
}: SimplePyramidProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedError, setSelectedError] = useState<{ nodeId: string; error: PyramidError } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [visibleCoherenceMapParaIndex, setVisibleCoherenceMapParaIndex] = useState<number | null>(null);
  const [previewEdgeSolutionId, setPreviewEdgeSolutionId] = useState<string | null>(null);
  const [previewFlowSolutionId, setPreviewFlowSolutionId] = useState<string | null>(null);
  const [openProposedNodeDetailId, setOpenProposedNodeDetailId] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const macroRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentenceRefs = useRef<{ [paraIndex: number]: (HTMLDivElement | null)[] }>({});

  const [lines, setLines] = useState<LineData[]>([]);
  const [svgBounds, setSvgBounds] = useState<SvgBounds>({ x: 0, y: 0, w: 2000, h: 1200 });
  const [scale, setScale] = useState(snapshotMode ? snapshotScale : 1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const offsetRef = useRef({ x: 40, y: 40 });
  const activeParagraphIndexRef = useRef(activeParagraphIndex);
  const visibleCoherenceMapParaIndexRef = useRef(visibleCoherenceMapParaIndex);
  const lastFocusedPreviewEdgeRef = useRef<string | null>(null);
  const lastFocusedInternalPreviewRef = useRef<string | null>(null);

  const paragraphs = useMemo(() => 
    rawParagraphs.filter(p => {
      if (evidenceFocusMode) return true;
      const lower = p.label.toLowerCase();
      return !['introduction', 'conclusion', 'mở bài', 'kết bài'].includes(lower);
    }),
  [evidenceFocusMode, rawParagraphs]);

  const relationshipReviews = edgeReviews;
  const snapshotFocusKey = snapshotFocusNodeIds.join('|');
  const snapshotFocusSet = useMemo(() => {
    return new Set(snapshotFocusKey ? snapshotFocusKey.split('|') : []);
  }, [snapshotFocusKey]);
  const snapshotSolutionKey = snapshotSolutionNodeIds.join('|');
  const snapshotSolutionSet = useMemo(() => {
    return new Set(snapshotSolutionKey ? snapshotSolutionKey.split('|') : []);
  }, [snapshotSolutionKey]);
  const hasEvidenceFocus = evidenceFocusMode && snapshotFocusSet.size > 0;

  const edgeReviewMap = useMemo(() => {
    return new Map(relationshipReviews.map(review => [review.edgeId, review]));
  }, [relationshipReviews]);

  const coherenceFlowMap = useMemo(() => {
    return new Map(coherenceFlows.map(flow => [flow.edgeId, flow]));
  }, [coherenceFlows]);

  const resolvedPreviewFlowSolutionId = requestedFlowPreviewId === undefined
    ? previewFlowSolutionId
    : requestedFlowPreviewId;

  const previewActions = useMemo(() => {
    if (resolvedPreviewFlowSolutionId) {
      return coherenceFlowMap.get(resolvedPreviewFlowSolutionId)?.issue.solutionActions || [];
    }
    if (!previewEdgeSolutionId) return [];
    const review = edgeReviewMap.get(previewEdgeSolutionId);
    return review?.issues.flatMap(issue => issue.solutionActions || []) || [];
  }, [coherenceFlowMap, edgeReviewMap, previewEdgeSolutionId, resolvedPreviewFlowSolutionId]);

  const previewAddedNodeActions = useMemo(() => {
    return previewActions.filter(action =>
      (action.type === 'add_node' || action.type === 'add_bridge') &&
      action.proposedText
    );
  }, [previewActions]);

  const previewSuppressedRewriteNodeIds = useMemo(() => {
    return new Set([
      ...previewAddedNodeActions.map(action => action.insertBeforeNodeId).filter(Boolean),
      ...previewAddedNodeActions.map(action => action.insertAfterNodeId).filter(Boolean),
    ] as string[]);
  }, [previewAddedNodeActions]);

  const previewTargetNodeIds = useMemo(() => {
    return new Set(
      [
        ...previewActions
        .map(action => action.targetNodeId)
          .filter((nodeId): nodeId is string => !!nodeId && !previewSuppressedRewriteNodeIds.has(nodeId)),
      ]
    );
  }, [previewActions, previewSuppressedRewriteNodeIds]);

  const getPreviewNodeText = useCallback((nodeId: string, fallback: string) => {
    if (
      showSolution &&
      selectedError?.nodeId === nodeId &&
      selectedError.error.proposedFix?.proposedText
    ) {
      return selectedError.error.proposedFix.proposedText;
    }

    if (previewSuppressedRewriteNodeIds.has(nodeId)) return fallback;

    const rewriteAction = previewActions.find(action =>
      action.type === 'rewrite_node' &&
      action.targetNodeId === nodeId &&
      action.proposedText
    );
    return rewriteAction?.proposedText || fallback;
  }, [previewActions, previewSuppressedRewriteNodeIds, selectedError, showSolution]);

  const getPreviewNodeWhyBetter = useCallback((nodeId: string) => {
    if (
      showSolution &&
      selectedError?.nodeId === nodeId &&
      selectedError.error.proposedFix?.proposedText
    ) {
      return selectedError.error.proposedFix.whyBetter || selectedError.error.proposedFix.details;
    }

    if (previewSuppressedRewriteNodeIds.has(nodeId)) return undefined;

    const rewriteAction = previewActions.find(action =>
      action.type === 'rewrite_node' &&
      action.targetNodeId === nodeId &&
      action.proposedText
    );
    return rewriteAction?.whyBetter || rewriteAction?.details;
  }, [previewActions, previewSuppressedRewriteNodeIds, selectedError, showSolution]);

  const getPreviewRelationshipTag = useCallback((edgeId: string | undefined, fallback: string) => {
    if (!edgeId || previewEdgeSolutionId !== edgeId) return fallback;
    const tagAction = previewActions.find(action =>
      action.type === 'change_relationship_tag' &&
      action.targetEdgeId === edgeId &&
      action.proposedRelationshipTag
    );
    return tagAction?.proposedRelationshipTag || fallback;
  }, [previewActions, previewEdgeSolutionId]);

  // Keep offsetRef in sync
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useLayoutEffect(() => {
    activeParagraphIndexRef.current = activeParagraphIndex;
  }, [activeParagraphIndex]);

  useLayoutEffect(() => {
    visibleCoherenceMapParaIndexRef.current = visibleCoherenceMapParaIndex;
  }, [visibleCoherenceMapParaIndex]);

  const measure = useCallback(() => {
    if (!contentRef.current || !macroRef.current) return;
    const container = contentRef.current;

    // Calculate total effective scale to cancel out ancestor scales (e.g. from modal) + local scale
    const cRect = container.getBoundingClientRect();
    const totalScaleX = cRect.width / (container.offsetWidth || 1);
    const totalScaleY = cRect.height / (container.offsetHeight || 1);

    const getLocalPos = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return {
        x: (rect.left - cRect.left) / totalScaleX,
        y: (rect.top - cRect.top) / totalScaleY,
        w: rect.width / totalScaleX,
        h: rect.height / totalScaleY,
      };
    };

    const newLines: LineData[] = [];

    const macro = getLocalPos(macroRef.current);
    const macroX = macro.x + macro.w / 2;
    const macroY = macro.y + macro.h;

    const paraPositions = paraRefs.current
      .slice(0, paragraphs.length)
      .map(r => r ? getLocalPos(r) : null)
      .filter(Boolean) as { x: number; y: number; w: number; h: number }[];

    if (paraPositions.length > 0) {
      const paraTopY = paraPositions[0].y;
      const midY = macroY + (paraTopY - macroY) / 2;

      // Stem from macro down to bus
      newLines.push({
        id: 'macro-drop',
        type: 'vertical_drop',
        edgeKind: 'macro_to_para',
        x1: macroX,
        y1: macroY,
        x2: macroX,
        y2: midY,
        relatedNodes: ['macro'],
      });

      // Horizontal bus
      const paraXs = paraPositions.map(p => p.x + p.w / 2);
      if (paraXs.length > 1) {
        newLines.push({
          id: 'horizontal-bus',
          type: 'vertical_bus',
          edgeKind: 'bus',
          x1: paraXs[0],
          y1: midY,
          x2: paraXs[paraXs.length - 1],
          y2: midY,
          relatedNodes: ['macro', ...paragraphs.map(p => paraNodeId(p.index))],
        });
      }

      // Drops to paragraphs
      paraPositions.forEach((p, i) => {
        const pX = p.x + p.w / 2;
        const vertErr = verticalRelError(paragraphs[i].errors);
        newLines.push({
          id: `para-drop-${i}`,
          type: 'vertical_drop',
          edgeKind: 'macro_to_para',
          edgeId: macroParaEdgeId(paragraphs[i].index),
          x1: pX,
          y1: midY,
          x2: pX,
          y2: paraTopY,
          error: !!vertErr,
          relatedNodes: ['macro', paraNodeId(paragraphs[i].index)],
          paraIndex: paragraphs[i].index,
        });
      });

      // Horizontal sibling arrows
      for (let i = 0; i < paraPositions.length - 1; i++) {
        const cur = paraPositions[i];
        const nxt = paraPositions[i + 1];
        const horizErr = horizontalRelError(paragraphs[i].errors);
        newLines.push({ 
          id: `para-sib-${i}`, 
          type: 'horizontal_sibling', 
          edgeKind: 'para_to_para',
          edgeId: paraParaEdgeId(paragraphs[i].index, paragraphs[i + 1].index),
          x1: cur.x + cur.w, y1: cur.y + 40, 
          x2: nxt.x - 2, y2: nxt.y + 40, 
          error: !!horizErr,
          label: paragraphs[i].transitionToNext || "BỔ SUNG",
          relatedNodes: [paraNodeId(paragraphs[i].index), paraNodeId(paragraphs[i + 1].index)],
          fromParaIndex: paragraphs[i].index,
          toParaIndex: paragraphs[i + 1].index,
        });
      }

      // Sentence level
      const currentActiveParagraphIndex = activeParagraphIndexRef.current;
      if (currentActiveParagraphIndex !== null) {
        const activeIdx = paragraphs.findIndex(p => p.index === currentActiveParagraphIndex);
        const activeP = paraPositions[activeIdx];
        const activeSentences = activeIdx >= 0 ? paragraphs[activeIdx].sentences : [];
        const sPos = (sentenceRefs.current[currentActiveParagraphIndex] || [])
          .map(r => r ? getLocalPos(r) : null)
          .filter(Boolean) as { x: number; y: number; w: number; h: number }[];

        if (activeP && sPos.length > 0) {
          const paraX = activeP.x + activeP.w / 2;
          const paraBottomY = activeP.y + activeP.h;
          const sentenceTopY = sPos[0].y;
          const midY2 = paraBottomY + (sentenceTopY - paraBottomY) / 2;
          const showCoherenceMap = visibleCoherenceMapParaIndexRef.current === currentActiveParagraphIndex;

          if (!showCoherenceMap) {
            newLines.push({
              id: 'para-to-s-bus',
              type: 'vertical_drop',
              edgeKind: 'para_to_sentence',
              x1: paraX,
              y1: paraBottomY,
              x2: paraX,
              y2: midY2,
              relatedNodes: [paraNodeId(currentActiveParagraphIndex)],
              paraIndex: currentActiveParagraphIndex,
            });

            const sXs = sPos.map(s => s.x + s.w / 2);
            const minX = Math.min(...sXs, paraX);
            const maxX = Math.max(...sXs, paraX);
            if (minX !== maxX) {
              newLines.push({
                id: 'horizontal-s-bus',
                type: 'vertical_bus',
                edgeKind: 'bus',
                x1: minX,
                y1: midY2,
                x2: maxX,
                y2: midY2,
                relatedNodes: [
                  paraNodeId(currentActiveParagraphIndex),
                  ...activeSentences.map(sentence => sentenceNodeId(currentActiveParagraphIndex, sentence.index)),
                ],
              });
            }

            sPos.forEach((s, i) => {
              const sX = s.x + s.w / 2;
              newLines.push({
                id: `s-route-${i}`,
                type: 'vertical_bus',
                edgeKind: 'para_to_sentence',
                edgeId: paraSentenceEdgeId(currentActiveParagraphIndex, activeSentences[i].index),
                x1: paraX,
                y1: midY2,
                x2: sX,
                y2: midY2,
                relatedNodes: [
                  paraNodeId(currentActiveParagraphIndex),
                  sentenceNodeId(currentActiveParagraphIndex, activeSentences[i].index),
                ],
                focusOnly: true,
                paraIndex: currentActiveParagraphIndex,
                sentenceIndex: activeSentences[i].index,
              });
              newLines.push({
                id: `s-drop-${i}`,
                type: 'vertical_drop',
                edgeKind: 'para_to_sentence',
                edgeId: paraSentenceEdgeId(currentActiveParagraphIndex, activeSentences[i].index),
                x1: sX,
                y1: midY2,
                x2: sX,
                y2: sentenceTopY,
                relatedNodes: [
                  paraNodeId(currentActiveParagraphIndex),
                  sentenceNodeId(currentActiveParagraphIndex, activeSentences[i].index),
                ],
                paraIndex: currentActiveParagraphIndex,
                sentenceIndex: activeSentences[i].index,
              });
            });

            for (let i = 0; i < sPos.length - 1; i++) {
              const a = sPos[i];
              const b = sPos[i + 1];
              const horizErr = horizontalRelError(activeSentences[i]?.errors || []);
              const attachY = Math.min(a.y + 40, b.y + 40);
              newLines.push({
                id: `s-sibling-${i}`,
                type: 'horizontal_sibling',
                edgeKind: 'sentence_to_sentence',
                edgeId: sentenceSentenceEdgeId(
                  currentActiveParagraphIndex,
                  activeSentences[i].index,
                  activeSentences[i + 1].index
                ),
                x1: a.x + a.w,
                y1: attachY,
                x2: b.x - 2,
                y2: attachY,
                error: !!horizErr,
                label: activeSentences[i].transitionToNext || "",
                nodeBottomY: Math.max(a.y + a.h, b.y + b.h),
                relatedNodes: [
                  sentenceNodeId(currentActiveParagraphIndex, activeSentences[i].index),
                  sentenceNodeId(currentActiveParagraphIndex, activeSentences[i + 1].index),
                ],
                paraIndex: currentActiveParagraphIndex,
                fromSentenceIndex: activeSentences[i].index,
                toSentenceIndex: activeSentences[i + 1].index,
              });
            }
          } else {
            const sentencePositionById = new Map(
              activeSentences.map((sentence, index) => [
                sentenceNodeId(currentActiveParagraphIndex, sentence.index),
                sPos[index],
              ])
            );
            const activeFlows = coherenceFlows.filter(flow =>
              flow.paragraphIndex === currentActiveParagraphIndex
            );
            activeFlows.forEach((flow, flowIndex) => {
              const sourcePositions = flow.fromNodeIds
                .map(nodeId => sentencePositionById.get(nodeId))
                .filter((position): position is { x: number; y: number; w: number; h: number } => !!position);
              const targetPosition = sentencePositionById.get(flow.toNodeId);
              if (!sourcePositions.length || !targetPosition) return;

              const sourceXs = sourcePositions.map(position => position.x + position.w / 2);
              const targetX = targetPosition.x + targetPosition.w / 2;
              const sourceY = Math.min(...sourcePositions.map(position => position.y)) - 2;
              const targetY = targetPosition.y - 2;
              const previousIssueLanes = activeFlows
                .slice(0, flowIndex)
                .filter(previousFlow => previousFlow.status !== 'works').length;
              const previousContextLanes = activeFlows
                .slice(0, flowIndex)
                .filter(previousFlow => previousFlow.status === 'works').length;
              const routeY = flow.status === 'works'
                ? Math.min(sourceY, targetY) - 14 - previousContextLanes * 20
                : Math.min(sourceY, targetY) - 34 - previousIssueLanes * 24;
              const allXs = [...sourceXs, targetX];

              newLines.push({
                id: `coherence-flow-${flow.edgeId}`,
                type: 'coherence_flow',
                edgeId: flow.edgeId,
                x1: Math.min(...allXs),
                y1: sourceY,
                x2: Math.max(...allXs),
                y2: targetY,
                routeY,
                sourceXs,
                sourceY,
                targetX,
                targetY,
                flowType: flow.flowType,
                error: flow.status !== 'works',
                label: flow.relationshipTag,
                relatedNodes: [...flow.fromNodeIds, flow.toNodeId],
                paraIndex: currentActiveParagraphIndex,
              });
            });
          }
        }
      }
    }

    const nextSvgBounds = getConnectorBounds(newLines, container.offsetWidth + 100, container.offsetHeight + 100);
    setLines(previousLines => sameLines(previousLines, newLines) ? previousLines : newLines);
    setSvgBounds(previousBounds => sameSvgBounds(previousBounds, nextSvgBounds) ? previousBounds : nextSvgBounds);
  }, [coherenceFlows, paragraphs]);

  // Auto-center on first render
  const centered = useRef(false);
  useLayoutEffect(() => {
    centered.current = false;
  }, [paragraphs.length]);

  useLayoutEffect(() => {
    measure();

    if (!centered.current && wrapperRef.current && contentRef.current) {
      const wW = wrapperRef.current.clientWidth;
      const cW = contentRef.current.scrollWidth;
      const newX = Math.max(40, (wW - cW) / 2);
      setOffset({ x: newX, y: 40 });
      offsetRef.current = { x: newX, y: 40 };
      centered.current = true;
    }

    const ro = new ResizeObserver(measure);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [measure, activeParagraphIndex]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      measure();
      secondFrame = requestAnimationFrame(measure);
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [measure, visibleCoherenceMapParaIndex, activeParagraphIndex]);

  // Wheel: ctrl/meta = zoom, otherwise = pan
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (snapshotMode) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale(s => Math.max(0.2, Math.min(3, s - e.deltaY * 0.008)));
      } else {
        if (!wheelPanEnabled) return;
        e.preventDefault();
        setOffset(o => ({ x: o.x - e.deltaX * 0.8, y: o.y - e.deltaY * 0.8 }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
	  }, [snapshotMode, wheelPanEnabled]);

  // Mouse pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (snapshotMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || (!panThroughNodes && target.closest('[data-no-pan="true"]'))) return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
  }, [panThroughNodes, snapshotMode]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const newOffset = {
      x: panStart.current.ox + (e.clientX - panStart.current.x),
      y: panStart.current.oy + (e.clientY - panStart.current.y),
    };
    setOffset(newOffset);
    offsetRef.current = newOffset;
  }, []);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const macroHasInternal = internalErrors(macroAnswer.errors).length > 0;
  const activeCoherenceFlow = useMemo(() => {
    return selectedFlowId
      ? coherenceFlowMap.get(selectedFlowId)
      : resolvedPreviewFlowSolutionId
      ? coherenceFlowMap.get(resolvedPreviewFlowSolutionId)
      : undefined;
  }, [coherenceFlowMap, resolvedPreviewFlowSolutionId, selectedFlowId]);

  const activeSuggestOrderAction = useMemo(() => {
    return activeCoherenceFlow?.issue.solutionActions?.find(action =>
      action.type === 'suggest_order' &&
      (action.currentOrder?.length || action.proposedOrder?.length)
    );
  }, [activeCoherenceFlow]);

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>();

    if (snapshotFocusSet.size > 0) {
      snapshotFocusSet.forEach(nodeId => ids.add(nodeId));
    }

    const activeFlow = activeCoherenceFlow;
    if (activeFlow) {
      ids.add(paraNodeId(activeFlow.paragraphIndex));
      activeFlow.fromNodeIds.forEach(nodeId => ids.add(nodeId));
      ids.add(activeFlow.toNodeId);
      activeSuggestOrderAction?.currentOrder?.forEach(nodeId => ids.add(nodeId));
      activeSuggestOrderAction?.proposedOrder?.forEach(nodeId => ids.add(nodeId));
      activeFlow.issue.affectedNodes?.sentences?.forEach(({ paraIndex, sentenceIndex }) => {
        ids.add(paraNodeId(paraIndex));
        ids.add(sentenceNodeId(paraIndex, sentenceIndex));
      });
    }

    if (!selectedError) return ids;

    ids.add(selectedError.nodeId);
    selectedError.error.affectedNodes?.paragraphs?.forEach(index => {
      ids.add(paraNodeId(index));
    });
    selectedError.error.affectedNodes?.sentences?.forEach(({ paraIndex, sentenceIndex }) => {
      ids.add(paraNodeId(paraIndex));
      ids.add(sentenceNodeId(paraIndex, sentenceIndex));
    });

    const sentenceMatch = selectedError.nodeId.match(/^sentence-(\d+)-(\d+)$/);
    if (sentenceMatch) {
      ids.add(paraNodeId(Number(sentenceMatch[1])));
    }

    return ids;
  }, [activeCoherenceFlow, activeSuggestOrderAction, selectedError, snapshotFocusSet]);

  const isLineHighlighted = useCallback((line: LineData) => {
    if (snapshotFocusSet.size > 0) {
      if (line.edgeKind === 'bus') return false;

              if (line.edgeKind === 'macro_to_para') {
        return line.paraIndex !== undefined
          && snapshotFocusSet.has('macro')
          && snapshotFocusSet.has(paraNodeId(line.paraIndex));
      }

      if (line.edgeKind === 'para_to_sentence' && line.sentenceIndex !== undefined) {
        return line.paraIndex !== undefined
          && snapshotFocusSet.has(paraNodeId(line.paraIndex))
          && snapshotFocusSet.has(sentenceNodeId(line.paraIndex, line.sentenceIndex));
      }

      if (line.edgeKind === 'sentence_to_sentence') {
        return line.paraIndex !== undefined && (
          line.fromSentenceIndex !== undefined
          && line.toSentenceIndex !== undefined
          && snapshotFocusSet.has(sentenceNodeId(line.paraIndex, line.fromSentenceIndex))
          && snapshotFocusSet.has(sentenceNodeId(line.paraIndex, line.toSentenceIndex))
        );
      }

      if (line.edgeKind === 'para_to_para') {
        return line.fromParaIndex !== undefined
          && line.toParaIndex !== undefined
          && snapshotFocusSet.has(paraNodeId(line.fromParaIndex))
          && snapshotFocusSet.has(paraNodeId(line.toParaIndex));
      }

      return (line.relatedNodes || []).length > 0
        && (line.relatedNodes || []).every(nodeId => snapshotFocusSet.has(nodeId));
    }

    if (selectedEdgeId) {
      if (line.edgeId === selectedEdgeId) return true;

      const macroParaMatch = selectedEdgeId.match(/^edge:macro->para:(\d+)$/);
      if (macroParaMatch) {
        const paraIndex = Number(macroParaMatch[1]);
        return line.id === 'macro-drop' || (line.edgeKind === 'macro_to_para' && line.paraIndex === paraIndex);
      }

      const paraSentenceMatch = selectedEdgeId.match(/^edge:para:(\d+)->sentence:(\d+)$/);
      if (paraSentenceMatch) {
        const paraIndex = Number(paraSentenceMatch[1]);
        const sentenceIndex = Number(paraSentenceMatch[2]);
        return line.edgeKind === 'para_to_sentence'
          && line.paraIndex === paraIndex
          && (line.sentenceIndex === sentenceIndex || line.sentenceIndex === undefined);
      }

      return false;
    }

    if (!selectedError) return false;

    const paragraphMatch = selectedError.nodeId.match(/^para-(\d+)$/);
    const sentenceMatch = selectedError.nodeId.match(/^sentence-(\d+)-(\d+)$/);

    if (sentenceMatch) {
      const paraIndex = Number(sentenceMatch[1]);
      const sentenceIndex = Number(sentenceMatch[2]);

      if (selectedError.error.type === 'relational' && selectedError.error.direction === 'horizontal') {
        return line.edgeKind === 'sentence_to_sentence'
          && line.paraIndex === paraIndex
          && (line.fromSentenceIndex === sentenceIndex || line.toSentenceIndex === sentenceIndex);
      }

      return line.edgeKind === 'para_to_sentence'
        && line.paraIndex === paraIndex
        && (line.sentenceIndex === sentenceIndex || line.sentenceIndex === undefined);
    }

    if (paragraphMatch) {
      const paraIndex = Number(paragraphMatch[1]);

      if (selectedError.error.type === 'relational' && selectedError.error.direction === 'horizontal') {
        return line.edgeKind === 'para_to_para'
          && (line.fromParaIndex === paraIndex || line.toParaIndex === paraIndex);
      }

      return line.edgeKind === 'macro_to_para' && line.paraIndex === paraIndex;
    }

    if (selectedError.nodeId === 'macro') {
      return line.edgeKind === 'macro_to_para';
    }

    return false;
  }, [selectedEdgeId, selectedError, snapshotFocusSet]);

  const focusLocalPoint = useCallback((x: number, y: number) => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const nextOffset = {
      x: Math.round(wrapper.clientWidth * 0.5 - x * scale),
      y: Math.round(wrapper.clientHeight * 0.46 - y * scale),
    };
    setOffset(nextOffset);
    offsetRef.current = nextOffset;
  }, [scale]);

  const focusElement = useCallback((el: HTMLElement | null) => {
    if (!el || !contentRef.current) return false;

    const content = contentRef.current;
    const contentRect = content.getBoundingClientRect();
    const totalScaleX = contentRect.width / (content.offsetWidth || 1);
    const totalScaleY = contentRect.height / (content.offsetHeight || 1);
    const rect = el.getBoundingClientRect();

    focusLocalPoint(
      (rect.left - contentRect.left) / totalScaleX + (rect.width / totalScaleX) / 2,
      (rect.top - contentRect.top) / totalScaleY + (rect.height / totalScaleY) / 2
    );
    return true;
  }, [focusLocalPoint]);

  const focusNodeById = useCallback((nodeId: string) => {
    if (nodeId === 'macro') return focusElement(macroRef.current);

    const paraMatch = nodeId.match(/^para-(\d+)$/);
    if (paraMatch) {
      const paraIndex = Number(paraMatch[1]);
      const refIndex = paragraphs.findIndex(para => para.index === paraIndex);
      return focusElement(refIndex >= 0 ? paraRefs.current[refIndex] : null);
    }

    const sentenceMatch = nodeId.match(/^sentence-(\d+)-(\d+)$/);
    if (sentenceMatch) {
      const paraIndex = Number(sentenceMatch[1]);
      const sentenceIndex = Number(sentenceMatch[2]);
      const para = paragraphs.find(p => p.index === paraIndex);
      const sentenceRefIndex = para?.sentences.findIndex(sentence => sentence.index === sentenceIndex) ?? -1;
      return focusElement(sentenceRefIndex >= 0 ? sentenceRefs.current[paraIndex]?.[sentenceRefIndex] : null);
    }

    return false;
  }, [focusElement, paragraphs]);

  const focusSnapshotNodes = useCallback((nodeIds: string[]) => {
    if (!wrapperRef.current || !contentRef.current || nodeIds.length === 0) return;

    const elements = nodeIds
      .map(nodeId => {
        if (nodeId === 'macro') return macroRef.current;

        const paraMatch = nodeId.match(/^para-(\d+)$/);
        if (paraMatch) {
          const paraIndex = Number(paraMatch[1]);
          const refIndex = paragraphs.findIndex(para => para.index === paraIndex);
          return refIndex >= 0 ? paraRefs.current[refIndex] : null;
        }

        const sentenceMatch = nodeId.match(/^sentence-(\d+)-(\d+)$/);
        if (sentenceMatch) {
          const paraIndex = Number(sentenceMatch[1]);
          const sentenceIndex = Number(sentenceMatch[2]);
          const para = paragraphs.find(p => p.index === paraIndex);
          const sentenceRefIndex = para?.sentences.findIndex(sentence => sentence.index === sentenceIndex) ?? -1;
          return sentenceRefIndex >= 0 ? sentenceRefs.current[paraIndex]?.[sentenceRefIndex] : null;
        }

        return null;
      })
      .filter((element): element is HTMLDivElement => !!element);

    if (!elements.length) return;

    const content = contentRef.current;
    const wrapper = wrapperRef.current;
    const contentRect = content.getBoundingClientRect();
    const totalScaleX = contentRect.width / (content.offsetWidth || 1);
    const totalScaleY = contentRect.height / (content.offsetHeight || 1);

    const localRects = elements.map(element => {
      const rect = element.getBoundingClientRect();
      return {
        left: (rect.left - contentRect.left) / totalScaleX,
        top: (rect.top - contentRect.top) / totalScaleY,
        right: (rect.right - contentRect.left) / totalScaleX,
        bottom: (rect.bottom - contentRect.top) / totalScaleY,
      };
    });

    const minX = Math.min(...localRects.map(rect => rect.left));
    const maxX = Math.max(...localRects.map(rect => rect.right));
    const minY = Math.min(...localRects.map(rect => rect.top));
    const maxY = Math.max(...localRects.map(rect => rect.bottom));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const horizontalPadding = Math.min(72, wrapper.clientWidth * 0.12);
    const verticalPadding = Math.min(72, wrapper.clientHeight * 0.14);
    const fitScale = Math.min(
      (wrapper.clientWidth - horizontalPadding * 2) / boundsWidth,
      (wrapper.clientHeight - verticalPadding * 2) / boundsHeight,
    );
    const nextScale = Math.max(0.32, Math.min(snapshotScale, fitScale));
    const nextOffset = {
      x: Math.round(wrapper.clientWidth * 0.5 - centerX * nextScale),
      y: Math.round(wrapper.clientHeight * 0.48 - centerY * nextScale),
    };

    setScale(nextScale);
    setOffset(nextOffset);
    offsetRef.current = nextOffset;
  }, [paragraphs, snapshotScale]);

  useLayoutEffect(() => {
    if (!snapshotMode && !snapshotFocusKey) return;
    const focusNodeIds = snapshotFocusKey ? snapshotFocusKey.split('|') : [];

    const firstFrame = window.requestAnimationFrame(() => {
      measure();
      focusSnapshotNodes(focusNodeIds);
    });
    const secondFrame = window.requestAnimationFrame(() => {
      measure();
      focusSnapshotNodes(focusNodeIds);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeParagraphIndex, focusSnapshotNodes, measure, snapshotFocusKey, snapshotMode]);

  useEffect(() => {
    if (!previewEdgeSolutionId) {
      lastFocusedPreviewEdgeRef.current = null;
      return;
    }

    if (lastFocusedPreviewEdgeRef.current === previewEdgeSolutionId) return;

    const frame = window.requestAnimationFrame(() => {
      const proposedAction = previewActions.find(action =>
        (action.type === 'add_node' || action.type === 'add_bridge') &&
        action.targetEdgeId === previewEdgeSolutionId &&
        action.proposedText
      );

      if (proposedAction) {
        const line = lines.find(candidate => candidate.edgeId === previewEdgeSolutionId && candidate.type === 'horizontal_sibling')
          || lines.find(candidate => candidate.edgeId === previewEdgeSolutionId);

        if (line) {
          const tagY = line.type === 'horizontal_sibling' ? line.y1 : (line.y1 + line.y2) / 2;
          const proposedNodeHeight = 146;
          const proposedNodeY = line.type === 'horizontal_sibling'
            ? (line.nodeBottomY ?? tagY + 96) + 28
            : tagY + 34;

          focusLocalPoint((line.x1 + line.x2) / 2, proposedNodeY + proposedNodeHeight / 2);
          lastFocusedPreviewEdgeRef.current = previewEdgeSolutionId;
          return;
        }
      }

      const rewriteTarget = previewActions.find(action => action.type === 'rewrite_node' && action.targetNodeId)?.targetNodeId;
      if (rewriteTarget && focusNodeById(rewriteTarget)) {
        lastFocusedPreviewEdgeRef.current = previewEdgeSolutionId;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusLocalPoint, focusNodeById, lines, previewActions, previewEdgeSolutionId]);

  useEffect(() => {
    if (!showSolution || !selectedError?.error.proposedFix?.proposedText) {
      lastFocusedInternalPreviewRef.current = null;
      return;
    }

    if (lastFocusedInternalPreviewRef.current === selectedError.nodeId) return;

    const frame = window.requestAnimationFrame(() => {
      if (focusNodeById(selectedError.nodeId)) {
        lastFocusedInternalPreviewRef.current = selectedError.nodeId;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusNodeById, selectedError, showSolution]);

  return (
    <div 
      ref={wrapperRef}
      className="w-full relative bg-[#F2F2F2] rounded-[20px] border border-black/[0.04] overflow-hidden"
      style={{ height: '100%', minHeight: 480, cursor: snapshotMode ? 'default' : 'grab', userSelect: 'none' }}
      onMouseDown={snapshotMode ? undefined : onMouseDown}
      onMouseMove={snapshotMode ? undefined : onMouseMove}
      onMouseUp={snapshotMode ? undefined : onMouseUp}
      onMouseLeave={snapshotMode ? undefined : onMouseUp}
    >

      {/* Controls toolbar — always visible, z-index above everything */}
      {!snapshotMode && <div
        data-no-pan="true"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 9,
          padding: 3,
          boxShadow: '0px 5.492px 5.492px 0px rgba(0,0,0,0.04), 0px 1.098px 3.295px 0px rgba(0,0,0,0.04)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
	          <button
	          onClick={() => {
	            setScale(s => Math.max(0.2, s - 0.1));
	          }}
          disabled={scale <= 0.2}
          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', opacity: scale <= 0.2 ? 0.3 : 1 }}
          title="Zoom out"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 9, width: 30, textAlign: 'center', color: 'rgba(0,0,0,0.46)', fontWeight: 600, letterSpacing: '0.02em' }}>
          {Math.round(scale * 100)}%
        </span>
	          <button
	          onClick={() => {
	            setScale(s => Math.min(3, s + 0.1));
	          }}
          disabled={scale >= 3}
          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', opacity: scale >= 3 ? 0.3 : 1 }}
          title="Zoom in"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
	          <button
	          onClick={() => {
	            setScale(1);
            centered.current = false;
            if (wrapperRef.current && contentRef.current) {
              const wW = wrapperRef.current.clientWidth;
              const cW = contentRef.current.scrollWidth;
              const newX = Math.max(40, (wW - cW) / 2);
              setOffset({ x: newX, y: 40 });
              offsetRef.current = { x: newX, y: 40 };
            }
          }}
          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer' }}
          title="Reset view"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        {!isFullscreen && onRequestFullscreen && (
          <>
            <div style={{ width: 1, height: 12, background: 'rgba(0,0,0,0.1)', margin: '0 1px' }} />
            <button
              onClick={onRequestFullscreen}
              aria-label="Full map"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer' }}
              title="Full map"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>
              </svg>
            </button>
          </>
        )}
      </div>}

      {/* Panning canvas */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          pointerEvents: snapshotMode ? 'none' : 'auto',
        }}
      >
        <div ref={contentRef} style={{ position: 'relative', padding: '48px 64px 96px 64px', minWidth: 480 }}>
          {/* SVG connector layer */}
          <svg
            width={svgBounds.w}
            height={svgBounds.h}
            viewBox={`${svgBounds.x} ${svgBounds.y} ${svgBounds.w} ${svgBounds.h}`}
            style={{ position: 'absolute', top: svgBounds.y, left: svgBounds.x, pointerEvents: 'none', zIndex: selectedEdgeId ? 40 : 30, overflow: 'visible' }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="rgba(23,23,23,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
              <marker id="arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="rgba(23,23,23,0.06)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
              <marker id="arrow-highlight" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#E6961F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
              <marker id="arrow-error" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#E6961F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
              <marker id="arrow-solution" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
            </defs>
            {lines.map(l => {
              const edgeReview = l.edgeId ? edgeReviewMap.get(l.edgeId) : undefined;
              const edgeIssue = edgeReview?.issues?.[0];
              const hasEdgeIssue = !!edgeIssue && edgeReview?.status !== 'works';
              const shouldShowEdgeIssue = showInCanvasFeedback && hasEdgeIssue;
              const isErr = showInCanvasFeedback && (l.error || hasEdgeIssue);
              const isDrop = l.type === 'vertical_drop';
              const isHighlighted = isLineHighlighted(l);
              if (l.type === 'coherence_flow') {
                const flow = l.edgeId ? coherenceFlowMap.get(l.edgeId) : undefined;
                if (!flow || !l.sourceXs?.length || l.targetX === undefined || l.routeY === undefined || l.sourceY === undefined || l.targetY === undefined) return null;

                const highlightsWholeFlow = !!activeSuggestOrderAction && activeCoherenceFlow?.paragraphIndex === flow.paragraphIndex;
                const isSelectedFlow = selectedFlowId === flow.edgeId || resolvedPreviewFlowSolutionId === flow.edgeId || highlightsWholeFlow;
                const hasFlowIssue = showInCanvasFeedback && flow.status !== 'works';
                const isEvidenceFocused = !showInCanvasFeedback && isLineHighlighted(l);
                const stroke = isSelectedFlow
                  ? '#E6961F'
                  : isEvidenceFocused
                  ? '#3B82F6'
                  : hasFlowIssue
                  ? 'rgba(230,150,31,0.48)'
                  : 'rgba(23,23,23,0.18)';
                const strokeW = isSelectedFlow || isEvidenceFocused ? 2 : 1.25;
                const marker = isSelectedFlow || hasFlowIssue
                  ? 'url(#arrow-error)'
                  : isEvidenceFocused
                  ? 'url(#arrow-solution)'
                  : 'url(#arrow)';
                const labelX = (Math.min(...l.sourceXs, l.targetX) + Math.max(...l.sourceXs, l.targetX)) / 2;
                const labelY = l.routeY - 18;
                const onFlowTagClick = (event: React.MouseEvent) => {
                  event.stopPropagation();
                  if (!showInCanvasFeedback || !hasFlowIssue) return;
                  setSelectedError(null);
                  setSelectedEdgeId(null);
                  setPreviewEdgeSolutionId(null);
                  setOpenProposedNodeDetailId(null);
                  setSelectedFlowId(selectedFlowId === flow.edgeId ? null : flow.edgeId);
                };

                return (
                  <g key={l.id}>
                    {flow.flowType === 'joint' && l.sourceXs.length > 1 ? (
                      <>
                        {l.sourceXs.map((sourceX, sourceIndex) => (
                          <path
                            key={`${l.id}-source-${sourceIndex}`}
                            d={`M${sourceX},${l.sourceY} L${sourceX},${l.routeY}`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={strokeW}
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                            className="transition-colors duration-150"
                          />
                        ))}
                        <path
                          d={`M${Math.min(...l.sourceXs, l.targetX)},${l.routeY} L${Math.max(...l.sourceXs, l.targetX)},${l.routeY}`}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={strokeW}
                          strokeDasharray="4 3"
                          strokeLinecap="round"
                          className="transition-colors duration-150"
                        />
                        <path
                          d={`M${l.targetX},${l.routeY} L${l.targetX},${l.targetY}`}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={strokeW}
                          strokeDasharray="4 3"
                          strokeLinecap="round"
                          markerEnd={marker}
                          className="transition-colors duration-150"
                        />
                      </>
                    ) : (
                      <path
                        d={`M${l.sourceXs[0]},${l.sourceY} L${l.sourceXs[0]},${l.routeY} L${l.targetX},${l.routeY} L${l.targetX},${l.targetY}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeW}
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                        markerEnd={marker}
                        className="transition-colors duration-150"
                      />
                    )}
                    <foreignObject x={labelX - 64} y={labelY} width="128" height="28" style={{ pointerEvents: hasFlowIssue && showInCanvasFeedback ? 'auto' : 'none' }}>
                      <div className="flex h-full w-full items-center justify-center">
                        <button
                          data-no-pan="true"
                          type="button"
                          disabled={!hasFlowIssue || !showInCanvasFeedback}
                          onClick={onFlowTagClick}
                          onMouseDown={event => event.stopPropagation()}
                          className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-[3px] font-sans text-[8.5px] font-semibold uppercase tracking-widest whitespace-nowrap shadow-[0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)] transition-all ${
                            isSelectedFlow
                              ? 'border-[#E6961F]/50 bg-white text-[#8A5B0A]'
                              : hasFlowIssue
                              ? 'border-[#EC6A5B]/30 bg-white text-[#9F3D31] hover:border-[#E6961F]/50'
                              : 'border-black/[0.06] bg-white text-[#737373]'
                          }`}
                        >
                          {hasFlowIssue && <span className="h-1.5 w-1.5 rounded-[3px] bg-[#EC6A5B]" />}
                          {flow.relationshipTag}
                        </button>
                      </div>
                    </foreignObject>
                  </g>
                );
              }
              if (l.focusOnly && !isHighlighted && !hasEdgeIssue) return null;
              const hasActiveSelection = !!selectedError || !!selectedEdgeId;
              const isMuted = hasActiveSelection && !isHighlighted;
              const isEvidenceFocused = !showInCanvasFeedback && isHighlighted;
              const color = hasActiveSelection
                ? isHighlighted ? '#E6961F' : 'rgba(23,23,23,0.06)'
                : isEvidenceFocused ? '#3B82F6'
                : isErr ? '#E6961F' : 'rgba(23,23,23,0.18)';
              const strokeW = hasActiveSelection
                ? isHighlighted ? 2 : 0.9
                : isEvidenceFocused ? 2
                : isErr ? 1.5 : 1.2;
              const markerId = hasActiveSelection
                ? isHighlighted ? "url(#arrow-highlight)" : "url(#arrow-muted)"
                : isEvidenceFocused ? "url(#arrow-solution)"
                : isErr ? "url(#arrow-error)" : "url(#arrow)";
              const strokeDasharray = isErr ? '4 3' : undefined;
              const isSelectedEdge = !!l.edgeId && selectedEdgeId === l.edgeId;
              const isPreviewingEdge = !!l.edgeId && previewEdgeSolutionId === l.edgeId;
              const baseTagText = l.label || (hasEdgeIssue ? edgeReview?.relationshipTag : '');
              const tagText = getPreviewRelationshipTag(l.edgeId, baseTagText || '');
              const proposedNodeAction = isPreviewingEdge
                ? previewActions.find(action =>
                    (action.type === 'add_node' || action.type === 'add_bridge') &&
                    action.targetEdgeId === l.edgeId &&
                    action.proposedText
                  )
                : undefined;
              const proposedNodeWhyBetter = proposedNodeAction?.whyBetter || proposedNodeAction?.details;
              const proposedNodeId = proposedNodeAction?.proposedNodeId || proposedNodeAction?.targetNodeId || `proposed-${l.edgeId}`;
              const isProposedNodeDetailOpen = !!proposedNodeId && openProposedNodeDetailId === proposedNodeId;
              const shouldRenderTag = !!tagText && (
                l.type === 'horizontal_sibling'
                || (shouldShowEdgeIssue && (l.id.startsWith('para-drop-') || l.id.startsWith('s-route-')))
              );
              const tagX = l.type === 'horizontal_sibling' || l.id.startsWith('s-route-') ? (l.x1 + l.x2) / 2 : l.x1;
              const tagY = l.type === 'horizontal_sibling' ? (l.routeY ?? l.y1) : (l.y1 + l.y2) / 2;
              const proposedNodeHeight = isProposedNodeDetailOpen ? 238 : 146;
              const proposedNodeY = l.type === 'horizontal_sibling'
                ? (l.nodeBottomY ?? tagY + 96) + 28
                : tagY + 34;
              const pairedSentenceDrop = l.id.startsWith('s-route-')
                ? lines.find(line => line.edgeId === l.edgeId && line.id.startsWith('s-drop-'))
                : null;
              const cardY = l.type === 'horizontal_sibling'
                ? (proposedNodeAction ? proposedNodeY + proposedNodeHeight + 42 : (l.nodeBottomY ?? tagY + 96) + 42)
                : pairedSentenceDrop
                ? Math.max(pairedSentenceDrop.y1, pairedSentenceDrop.y2) + 132
                : l.edgeKind === 'para_to_sentence' || l.edgeKind === 'macro_to_para'
                ? Math.max(l.y1, l.y2) + 132
                : tagY + 64;
              const onEdgeTagClick = (event: React.MouseEvent) => {
                if (!showInCanvasFeedback || !l.edgeId || !hasEdgeIssue) return;
                event.stopPropagation();
                setSelectedError(null);
                setShowSolution(false);
                setSelectedEdgeId(selectedEdgeId === l.edgeId ? null : l.edgeId || null);
                setSelectedFlowId(null);
                setPreviewEdgeSolutionId(null);
                setPreviewFlowSolutionId(null);
                setOpenProposedNodeDetailId(null);
              };
              const edgeTag = shouldRenderTag ? (
                <>
                  <foreignObject x={tagX - 58} y={tagY - 12} width="116" height="24" style={{ pointerEvents: hasEdgeIssue && showInCanvasFeedback ? 'auto' : 'none' }}>
                    <div className="flex items-center justify-center w-full h-full">
                      <button
                        data-no-pan="true"
                        type="button"
                        disabled={!hasEdgeIssue || !showInCanvasFeedback}
                        onClick={onEdgeTagClick}
                        onMouseDown={event => event.stopPropagation()}
	                        className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-[6px] border text-[8.5px] font-sans font-semibold uppercase tracking-widest whitespace-nowrap text-center transition-all duration-200 ${AMBIENT_LOW} ${
                          isPreviewingEdge
                            ? 'border-[#3B82F6]/45 bg-[#E5F3FE] text-[#2563EB]'
                            : isSelectedEdge || isHighlighted
                            ? showInCanvasFeedback
                              ? 'border-[#E6961F]/45 bg-white text-[#8A5B0A]'
                              : 'border-[#3B82F6]/35 bg-white text-[#2563EB]'
                            : isMuted
                            ? 'border-black/[0.04] text-[#A3A3A3] opacity-40'
                            : shouldShowEdgeIssue
                            ? 'border-[#EC6A5B]/30 bg-white text-[#9F3D31]'
                            : 'border-black/[0.06] bg-white text-[#737373]'
                        } ${shouldShowEdgeIssue ? 'cursor-pointer hover:border-[#E6961F]/50' : 'cursor-default'}`}
                      >
                        {shouldShowEdgeIssue && <span className={`h-1.5 w-1.5 rounded-[3px] ${isPreviewingEdge ? 'bg-[#3B82F6]' : 'bg-[#EC6A5B]'}`} />}
                        {tagText}
                      </button>
                    </div>
                  </foreignObject>

                  <AnimatePresence initial={false}>
                    {showInCanvasFeedback && hasEdgeIssue && isSelectedEdge && edgeIssue && (
                      <motion.g
                        key={`edge-card-${l.edgeId}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        {proposedNodeAction && (
                          <g>
                            <motion.line
                              x1={tagX}
                              y1={tagY + 13}
                              x2={tagX}
                              initial={{ y2: tagY + 24, opacity: 0 }}
                              animate={{ y2: proposedNodeY - 2, opacity: 1 }}
                              exit={{ y2: tagY + 24, opacity: 0 }}
                              transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                              stroke="#3B82F6"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeDasharray="4 3"
                              markerEnd="url(#arrow-solution)"
                            />
                            <foreignObject x={tagX - 130} y={proposedNodeY} width="260" height={proposedNodeHeight} style={{ pointerEvents: 'auto' }}>
                              <motion.div
                                data-no-pan="true"
                                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                                className="h-full rounded-[12px] border border-[#3B82F6]/35 bg-[#E5F3FE] px-4 py-3.5 shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]"
                                onMouseDown={event => event.stopPropagation()}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="rounded-[5px] bg-white px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-widest text-[#2563EB]">
                                    {proposedNodeAction.proposedLabel || (proposedNodeAction.type === 'add_bridge' ? 'BRIDGE' : 'NEW')}
                                  </span>
                                  <span className="rounded-[5px] bg-[#3B82F6] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-widest text-white">
                                    thêm
                                  </span>
                                </div>
                                <p className="font-sans text-[10.5px] leading-relaxed text-[#1E3A8A] [text-wrap:pretty]">
                                  {proposedNodeAction.proposedText}
                                </p>
                                {proposedNodeWhyBetter && (
                                  <button
                                    type="button"
                                    className="mt-2 flex w-full items-center justify-between rounded-[7px] border border-[#3B82F6]/15 bg-white/60 px-2 py-1.5 font-sans text-[9px] font-semibold text-[#2563EB]"
                                    onClick={event => {
                                      event.stopPropagation();
                                      setOpenProposedNodeDetailId(current => current === proposedNodeId ? null : proposedNodeId);
                                    }}
                                  >
                                    <span>Tại sao tốt hơn</span>
                                    <span className={`transition-transform duration-200 ${isProposedNodeDetailOpen ? 'rotate-180' : ''}`}>⌄</span>
                                  </button>
                                )}
                                <AnimatePresence initial={false}>
                                  {proposedNodeWhyBetter && isProposedNodeDetailOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ type: "spring", bounce: 0, duration: 0.24 }}
                                      className="overflow-hidden"
                                    >
                                      <p className="mt-2 border-t border-[#3B82F6]/15 pt-2 font-sans text-[8.8px] leading-relaxed text-[#2563EB]/75">
                                        {proposedNodeWhyBetter}
                                      </p>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            </foreignObject>
                          </g>
                        )}
                        <motion.line
                          x1={tagX}
                          y1={proposedNodeAction ? proposedNodeY + proposedNodeHeight : tagY + 13}
                          x2={tagX}
                          initial={{ y2: proposedNodeAction ? proposedNodeY + proposedNodeHeight + 14 : tagY + 24, opacity: 0 }}
                          animate={{ y2: cardY - 4, opacity: 1 }}
                          exit={{ y2: proposedNodeAction ? proposedNodeY + proposedNodeHeight + 14 : tagY + 24, opacity: 0 }}
                          transition={{ type: "spring", bounce: 0, duration: 0.36 }}
                          stroke={proposedNodeAction ? "#3B82F6" : "#E6961F"}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeDasharray={proposedNodeAction ? "4 3" : undefined}
                          markerEnd={proposedNodeAction ? "url(#arrow-solution)" : "url(#arrow-highlight)"}
                        />
                        <foreignObject x={tagX - 158} y={cardY} width="316" height="680" style={{ pointerEvents: 'auto' }}>
                          <motion.div
                            data-no-pan="true"
                            initial={{ opacity: 0, y: -10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.32 }}
                            className="rounded-[12px] border border-[#E6961F]/25 bg-white p-4 shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]"
                            style={{ transformOrigin: 'top center' }}
                            onMouseDown={event => event.stopPropagation()}
                          >
	                            <div className="mb-3 flex items-center justify-between gap-3">
	                              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#E6961F]">
	                                Relationship lỗi
	                              </p>
	                              <span className="rounded-[5px] bg-[#FFF4EE] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#9F3D31]">
	                                {edgeReview?.status}
	                              </span>
	                            </div>
	                            <h4 className="mb-2 font-sans text-[13px] font-semibold leading-snug text-[#171717]">{edgeIssue.title}</h4>
                            <div className="space-y-2 font-sans text-[11px] leading-relaxed text-[#525252]">
                              <p><span className="font-semibold text-[#9F3D31]">Sai vì: </span>{edgeIssue.whyWrong}</p>
                              <p><span className="font-semibold text-[#8A5B0A]">Ảnh hưởng mục đích: </span>{edgeIssue.impactOnPurpose}</p>
                              <p><span className="font-semibold text-[#737373]">Ảnh hưởng người đọc: </span>{edgeIssue.impactOnReader}</p>
                            </div>
                            <button
                              type="button"
                              className="mt-3 w-full rounded-[8px] bg-[#141413] py-2 font-sans text-[12px] font-medium text-white transition-colors hover:bg-black"
	                              onClick={event => {
	                                event.stopPropagation();
	                                const nextEdgeId = isPreviewingEdge ? null : l.edgeId || null;
	                                setPreviewEdgeSolutionId(nextEdgeId);
	                                setPreviewFlowSolutionId(null);
	                                setOpenProposedNodeDetailId(null);
	                              }}
                            >
                              {isPreviewingEdge ? 'Hoàn tác preview' : 'Sửa trên pyramid'}
                            </button>
                            <AnimatePresence initial={false}>
                              {isPreviewingEdge && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 rounded-[8px] border border-[#3B82F6]/15 bg-[#E5F3FE] p-3">
	                                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2563EB]">Đang sửa trên pyramid</p>
	                                    <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#2563EB]/80">
	                                      Nhãn quan hệ, phần được ảnh hưởng, hoặc phần mới đã chuyển sang bản đề xuất màu xanh.
	                                    </p>
	                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </foreignObject>
                      </motion.g>
                    )}
                  </AnimatePresence>
                </>
              ) : null;

              if (l.type === 'horizontal_sibling') {
                const midX = (l.x1 + l.x2) / 2;
                const dir = l.x2 >= l.x1 ? 1 : -1;
                const sourceStemX = l.x1 + dir * 14;
                const targetStemX = l.x2 - dir * 14;
                const d = l.routeY !== undefined
                  ? `M${l.x1},${l.y1} L${sourceStemX},${l.y1} L${sourceStemX},${l.routeY} L${targetStemX},${l.routeY} L${targetStemX},${l.y2} L${l.x2},${l.y2}`
                  : `M${l.x1},${l.y1} C${midX},${l.y1} ${midX},${l.y2} ${l.x2},${l.y2}`;
                return (
                  <g key={l.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeW}
                      strokeDasharray={strokeDasharray}
                      strokeLinecap="round"
                      markerEnd={markerId}
                      className="transition-colors duration-150"
                    />
                    {edgeTag}
                  </g>
                );
              }

              return (
                <g key={l.id}>
                  <line
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeDasharray={strokeDasharray}
                    strokeLinecap="round"
                    markerEnd={isDrop || l.id.startsWith('s-route-') ? markerId : undefined}
                    className="transition-colors duration-150"
                  />
                  {edgeTag}
                </g>
              );
            })}
          </svg>

          {/* MACRO ANSWER */}
          <div className={`flex justify-center mb-10 transition-opacity duration-300 ${
            hasEvidenceFocus && !highlightedNodeIds.has('macro')
              ? 'opacity-25 grayscale'
              : !(!selectedError || selectedError.nodeId === 'macro') && selectedError
              ? 'opacity-30 grayscale'
              : 'opacity-100'
          }`}>
            <div 
              ref={macroRef}
              onClick={() => {
                setSelectedEdgeId(null);
                setSelectedFlowId(null);
                setPreviewEdgeSolutionId(null);
                setPreviewFlowSolutionId(null);
                setOpenProposedNodeDetailId(null);
                if (showInCanvasFeedback && macroHasInternal) {
                  if (selectedError?.nodeId === 'macro') setSelectedError(null);
                  else setSelectedError({ nodeId: 'macro', error: internalErrors(macroAnswer.errors)[0] });
                }
              }}
              className={`relative z-10 w-[420px] rounded-[16px] px-6 py-5 transition-all duration-200 cursor-pointer ${NODE_BASE} ${showInCanvasFeedback && macroHasInternal ? NODE_ERROR : NODE_ACTIVE} ${highlightedNodeIds.has('macro') ? (showInCanvasFeedback ? NODE_RELATION : NODE_EVIDENCE_FOCUS) : ''} ${previewTargetNodeIds.has('macro') ? 'ring-2 ring-[#3B82F6]/35' : ''}`}
            >
              <p className={`mb-3 inline-flex rounded-[6px] px-2.5 py-1 font-sans text-[9px] font-semibold tracking-[0.14em] uppercase ${showInCanvasFeedback && macroHasInternal ? 'bg-white text-[#EC6A5B]' : 'bg-white text-[#2563EB]'}`}>
                Lập trường chính
              </p>
              <p className="font-sans text-[16px] font-semibold leading-relaxed text-[#171717] [text-wrap:pretty]">
                {getPreviewNodeText('macro', macroAnswer.text)}
              </p>
              <AnimatePresence initial={false}>
                {showInCanvasFeedback && macroHasInternal && selectedError?.nodeId === 'macro' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-rose-200">
                      <h3 className="font-sans text-[11px] font-bold uppercase tracking-widest text-rose-500 mb-2">Lỗi Logic</h3>
                    <p className="font-sans text-[13px] text-rose-900 leading-relaxed mb-3">{selectedError.error.message}</p>
                    {selectedError.error.explanation && (
                      <div className="mb-3 bg-rose-50 rounded-[8px] p-3">
                        <p className="font-sans text-[11px] font-medium text-rose-800 mb-1">Giải thích:</p>
                        <p className="font-sans text-[12px] text-rose-700 leading-relaxed">{selectedError.error.explanation}</p>
                      </div>
                    )}
                    {selectedError.error.suggestion && (
                      <div className="mb-4">
                        <p className="font-sans text-[11px] font-medium text-emerald-600 mb-1">Gợi ý sửa:</p>
                        <p className="font-sans text-[12px] text-emerald-700 leading-relaxed">{selectedError.error.suggestion}</p>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSolution(!showSolution); }}
                      className="w-full bg-[#141413] hover:bg-black text-white font-sans text-[12px] font-medium py-2 rounded-[8px] transition-colors flex items-center justify-center gap-2"
                    >
                      {showSolution ? 'Hoàn tác (Về bản gốc)' : 'Xem giải pháp'}
                    </button>
                      {showSolution && selectedError.error.proposedFix && (
                        <div className="mt-3 pt-3 border-t border-black/10 animate-in fade-in duration-300">
                          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] mb-1">Thay đổi cấu trúc:</p>
                          <p className="font-sans text-[12px] text-black/80 leading-relaxed">{selectedError.error.proposedFix.details}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {showInCanvasFeedback && macroHasInternal && selectedError?.nodeId !== 'macro' && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#EC6A5B] rounded-[5px] shadow-sm animate-pulse border-2 border-white" />
              )}
            </div>
          </div>

          <div className="relative z-10 flex gap-32 items-start">
            {paragraphs.map((para, i) => {
              const internalErrs = internalErrors(para.errors);
              const hasErr = internalErrs.length > 0;
              const paragraphFlows = coherenceFlows.filter(flow => flow.paragraphIndex === para.index);
              const problematicParagraphFlows = paragraphFlows.filter(flow => flow.status !== 'works');
              const hasCoherenceMap = problematicParagraphFlows.length > 0;
              const isCoherenceMapOpen = visibleCoherenceMapParaIndex === para.index;
              const previewFlowForParagraph = resolvedPreviewFlowSolutionId
                ? paragraphFlows.find(flow => flow.edgeId === resolvedPreviewFlowSolutionId)
                : undefined;
              const previewSuggestAction = isCoherenceMapOpen
                ? previewFlowForParagraph?.issue.solutionActions?.find(action =>
                    action.type === 'suggest_order' &&
                    action.proposedOrder?.length
                  )
                : undefined;
              const paragraphSentenceById = new Map(para.sentences.map(sentence => [
                sentenceNodeId(para.index, sentence.index),
                sentence,
              ]));
              const hasParagraphIssue = hasErr
                || para.errors.some(error => error.type === 'relational')
                || para.sentences.some(sentence => sentence.errors.length > 0)
                || hasCoherenceMap
                || relationshipReviews.some(review =>
                  review.status !== 'works' &&
                  (
                    review.fromNodeId === paraNodeId(para.index) ||
                    review.toNodeId === paraNodeId(para.index) ||
                    review.fromNodeId.startsWith(`sentence-${para.index}-`) ||
                    review.toNodeId.startsWith(`sentence-${para.index}-`) ||
                    review.issues.some(issue =>
                      issue.affectedNodes?.paragraphs?.includes(para.index) ||
                      issue.affectedNodes?.sentences?.some(sentence => sentence.paraIndex === para.index)
                    )
                  )
                );
	              const isActive = activeParagraphIndex === para.index;
	              const paraId = paraNodeId(para.index);
		              const isRelationHighlighted = highlightedNodeIds.has(paraId);

              const isAffected = hasEvidenceFocus
                ? highlightedNodeIds.has(paraId)
                : selectedError
                ? (selectedError.error.affectedNodes?.paragraphs?.includes(para.index) ||
                   selectedError.nodeId === `para-${para.index}` ||
                   selectedError.nodeId.startsWith(`sentence-${para.index}-`))
                : true;
                 
              return (
                <div key={para.index} className={`flex flex-col items-center transition-opacity duration-300 ${!isAffected ? 'opacity-25 grayscale' : 'opacity-100'}`}>
                  <div
                    ref={el => { paraRefs.current[i] = el; }}
                    data-no-pan="true"
                    onClick={() => {
	                      setSelectedEdgeId(null);
	                      setSelectedFlowId(null);
	                      visibleCoherenceMapParaIndexRef.current = null;
	                      setVisibleCoherenceMapParaIndex(null);
	                      setPreviewEdgeSolutionId(null);
	                      setPreviewFlowSolutionId(null);
	                      setOpenProposedNodeDetailId(null);
                      if (showInCanvasFeedback && hasErr) {
                        if (selectedError?.nodeId === `para-${para.index}`) setSelectedError(null);
                        else setSelectedError({ nodeId: `para-${para.index}`, error: internalErrs[0] });
                      }
                      onParagraphClick(isActive ? null : para.index);
                    }}
                    className={`relative w-[220px] shrink-0 rounded-[16px] px-5 py-4 transition-all duration-200 cursor-pointer ${
                      selectedError?.nodeId === paraId
                        ? 'ring-4 ring-[#EC6A5B]/20 z-50'
                        : previewTargetNodeIds.has(paraId)
                        ? 'ring-2 ring-[#3B82F6]/35 z-30'
                      : isRelationHighlighted ? `${showInCanvasFeedback ? NODE_RELATION : NODE_EVIDENCE_FOCUS} z-30` : ''
                    } ${
                      isActive
                        ? `${NODE_ACTIVE} scale-[1.02] z-20`
                        : showInCanvasFeedback && hasErr
                        ? `${NODE_BASE} ${NODE_ERROR} z-10`
                        : `${NODE_BASE} hover:-translate-y-0.5 hover:border-[#3B82F6]/20 z-10`
                    }`}
                  >
                    <div className={`mb-3 inline-flex rounded-[6px] px-2 py-1 font-sans text-[9px] font-semibold tracking-[0.12em] uppercase ${isActive ? 'bg-white text-[#2563EB]' : 'bg-[#F5F5F5] text-[#737373]'}`}>
                      {para.label}
                    </div>
                    <div className="font-sans text-[13px] leading-relaxed text-[#404040] [text-wrap:pretty]">
                      {getPreviewNodeText(paraId, para.job)}
                    </div>
                    {previewTargetNodeIds.has(paraId) && (
                      <div className="absolute -top-2 -right-2 rounded-[5px] border border-white bg-[#3B82F6] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-widest text-white shadow-sm">
                        sửa
                      </div>
                    )}
                    
                    <AnimatePresence initial={false}>
                      {showInCanvasFeedback && hasErr && selectedError?.nodeId === `para-${para.index}` && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-rose-200 cursor-default" onClick={e => e.stopPropagation()}>
                            <h3 className="font-sans text-[11px] font-bold uppercase tracking-widest text-rose-500 mb-2">Lỗi Logic</h3>
                            <p className="font-sans text-[13px] text-rose-900 leading-relaxed mb-3">{selectedError.error.message}</p>
                            {selectedError.error.explanation && (
                              <div className="mb-3 bg-rose-50 rounded-[8px] p-3">
                                <p className="font-sans text-[11px] font-medium text-rose-800 mb-1">Giải thích:</p>
                                <p className="font-sans text-[12px] text-rose-700 leading-relaxed">{selectedError.error.explanation}</p>
                              </div>
                            )}
                            {selectedError.error.suggestion && (
                              <div className="mb-4">
                                <p className="font-sans text-[11px] font-medium text-emerald-600 mb-1">Gợi ý sửa:</p>
                                <p className="font-sans text-[12px] text-emerald-700 leading-relaxed">{selectedError.error.suggestion}</p>
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowSolution(!showSolution); }}
                              className="w-full bg-[#141413] hover:bg-black text-white font-sans text-[12px] font-medium py-2 rounded-[8px] transition-colors flex items-center justify-center gap-2"
                            >
                              {showSolution ? 'Hoàn tác (Về bản gốc)' : 'Xem giải pháp'}
                            </button>
                            {showSolution && selectedError.error.proposedFix && (
                              <div className="mt-3 pt-3 border-t border-black/10 animate-in fade-in duration-300">
                                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] mb-1">Thay đổi cấu trúc:</p>
                                <p className="font-sans text-[12px] text-black/80 leading-relaxed">{selectedError.error.proposedFix.details}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {showInCanvasFeedback && hasParagraphIssue && selectedError?.nodeId !== `para-${para.index}` && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#EC6A5B] rounded-[5px] shadow-sm animate-pulse border-2 border-white" />
                    )}
                  </div>

                  {/* SENTENCES */}
                  <div className="relative w-full z-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex justify-center">
                      <AnimatePresence initial={false}>
                      {isActive && para.sentences && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, marginTop: 64 }}
                          animate={{ opacity: 1, y: 0, marginTop: 64 }}
                          exit={{ opacity: 0, y: -10, marginTop: 64 }}
                          transition={{ type: "spring", duration: 0.24, bounce: 0 }}
                          className="w-max shrink-0"
                          onAnimationStart={measure}
                          onUpdate={measure}
                          onAnimationComplete={measure}
                        >
	                        <div className="flex gap-28 items-start justify-center px-3 pt-3 pb-4">
	                          {para.sentences.map((s, si) => {
	                            const sErrs = s.errors.filter(e => e.type === 'internal');
	                            const hasE = sErrs.length > 0;
	                            const sentenceId = sentenceNodeId(para.index, s.index);
                            const isInternalPreview = showSolution && selectedError?.nodeId === sentenceId && !!selectedError.error.proposedFix?.proposedText;
                            const isSolutionHighlighted = snapshotSolutionSet.has(sentenceId);
                            const previewWhyBetter = isInternalPreview || previewTargetNodeIds.has(sentenceId)
	                              ? getPreviewNodeWhyBetter(sentenceId)
	                              : undefined;
                            const isSentenceRelationHighlighted = highlightedNodeIds.has(sentenceId);
                            const isSAffected = hasEvidenceFocus
                              ? highlightedNodeIds.has(sentenceId)
                              : selectedError
                              ? (selectedError.error.affectedNodes?.sentences?.some(aff => aff.paraIndex === para.index && aff.sentenceIndex === s.index) ||
                                 selectedError.nodeId === `sentence-${para.index}-${s.index}`)
                              : true;
                               
	                            return (
	                              <motion.div
	                                key={sentenceId}
	                                ref={el => {
	                                  if (!sentenceRefs.current[para.index]) sentenceRefs.current[para.index] = [];
	                                  sentenceRefs.current[para.index][si] = el;
                                }}
                                className="w-[200px] shrink-0"
	                              >
	                              <motion.div
	                                data-no-pan="true"
                                onClick={(e) => {
                                  e.stopPropagation();
	                                  setSelectedEdgeId(null);
	                                  setSelectedFlowId(null);
	                                  setPreviewEdgeSolutionId(null);
	                                  setPreviewFlowSolutionId(null);
	                                  setOpenProposedNodeDetailId(null);
                                  if (showInCanvasFeedback && hasE) {
                                    if (selectedError?.nodeId === `sentence-${para.index}-${s.index}`) setSelectedError(null);
                                    else setSelectedError({ nodeId: `sentence-${para.index}-${s.index}`, error: sErrs[0] });
                                  }
                                }}
                                  className={`relative w-[200px] shrink-0 rounded-[14px] px-4 py-4 transition-all cursor-pointer ${
                                    isInternalPreview
                                      ? 'ring-2 ring-[#3B82F6]/35 z-50'
                                    : isSolutionHighlighted
                                      ? 'ring-1 ring-[#3478F6]/35 z-30'
                                    : selectedError?.nodeId === sentenceId
                                    ? 'ring-4 ring-[#EC6A5B]/20 z-50'
                                    : previewTargetNodeIds.has(sentenceId)
                                    ? 'ring-2 ring-[#3B82F6]/35 z-30'
                                    : isSentenceRelationHighlighted ? `${showInCanvasFeedback ? NODE_RELATION : NODE_EVIDENCE_FOCUS} z-30` : ''
                                } ${
                                  isInternalPreview ? `${NODE_BASE} bg-[#E5F3FE] z-10` :
                                  isSolutionHighlighted ? `${NODE_BASE} border-[#3478F6]/55 bg-[#EAF3FF] z-10` :
                                  showInCanvasFeedback && hasE ? `${NODE_BASE} ${NODE_ERROR} z-10` :
                                  `${NODE_BASE} ${previewTargetNodeIds.has(sentenceId) ? 'bg-[#E5F3FE]' : 'bg-[#FBFCFD]'} hover:-translate-y-0.5 hover:border-[#3B82F6]/20`
                                } ${!isSAffected ? 'opacity-25 grayscale' : 'opacity-100'}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-4 h-4 rounded-[5px] flex items-center justify-center font-mono text-[9px] bg-[#E5F3FE] text-[#2563EB]">
                                    {s.index}
                                  </span>
                                  <span className="font-mono text-[9px] text-[#737373] uppercase tracking-[0.1em]">
                                    {s.role}
                                  </span>
                                </div>
                                <div className="font-sans text-[12px] text-[#404040] leading-relaxed [text-wrap:pretty]">
                                  {getPreviewNodeText(sentenceId, s.sourceText || s.simplifiedIdea)}
                                </div>
                                {previewWhyBetter && (
                                  <div className="mt-3 rounded-[8px] border border-[#3B82F6]/15 bg-white/70 p-2 font-sans text-[9.5px] leading-relaxed text-[#2563EB]/80">
                                    <span className="font-semibold">Tốt hơn vì: </span>{previewWhyBetter}
                                  </div>
                                )}
	                                {(previewTargetNodeIds.has(sentenceId) || isInternalPreview) && (
	                                  <div className="absolute -top-2 -right-2 rounded-[5px] border border-white bg-[#3B82F6] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-widest text-white shadow-sm">
	                                    sửa
	                                  </div>
	                                )}
                                
                                <AnimatePresence initial={false}>
                                  {showInCanvasFeedback && hasE && selectedError?.nodeId === `sentence-${para.index}-${s.index}` && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                                      className="overflow-hidden"
                                      onUpdate={measure}
                                    >
                                      <div className="mt-4 pt-4 border-t border-rose-200 cursor-default" onClick={e => e.stopPropagation()}>
                                        <h3 className="font-sans text-[11px] font-bold uppercase tracking-widest text-rose-500 mb-2">Lỗi Logic</h3>
                                        <p className="font-sans text-[13px] text-rose-900 leading-relaxed mb-3">{selectedError.error.message}</p>
                                        {selectedError.error.explanation && (
                                          <div className="mb-3 bg-rose-50 rounded-[8px] p-3">
                                            <p className="font-sans text-[11px] font-medium text-rose-800 mb-1">Giải thích:</p>
                                            <p className="font-sans text-[12px] text-rose-700 leading-relaxed">{selectedError.error.explanation}</p>
                                          </div>
                                        )}
                                        {selectedError.error.suggestion && (
                                          <div className="mb-4">
                                            <p className="font-sans text-[11px] font-medium text-emerald-600 mb-1">Gợi ý sửa:</p>
                                            <p className="font-sans text-[12px] text-emerald-700 leading-relaxed">{selectedError.error.suggestion}</p>
                                          </div>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setShowSolution(!showSolution); }}
                                          className="w-full bg-[#141413] hover:bg-black text-white font-sans text-[12px] font-medium py-2 rounded-[8px] transition-colors flex items-center justify-center gap-2"
                                        >
                                          {showSolution ? 'Hoàn tác (Về bản gốc)' : 'Xem giải pháp'}
                                        </button>
                                        {showSolution && selectedError.error.proposedFix && (
                                          <div className="mt-3 pt-3 border-t border-black/10 animate-in fade-in duration-300">
                                            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] mb-1">Thay đổi cấu trúc:</p>
                                            <p className="font-sans text-[12px] text-black/80 leading-relaxed">{selectedError.error.proposedFix.details}</p>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {showInCanvasFeedback && hasE && selectedError?.nodeId !== `sentence-${para.index}-${s.index}` && (
                                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#EC6A5B] rounded-[5px] shadow-sm animate-pulse border-2 border-white" />
                                )}
                              </motion.div>
                              </motion.div>
                            );
	                          })}
	                        </div>
                          {previewSuggestAction?.proposedOrder?.length && (
                            <div
                              data-no-pan="true"
                              className="mx-auto mb-3 mt-1 w-fit max-w-[980px] rounded-[12px] border border-[#3B82F6]/25 bg-[#E5F3FE] px-4 py-3 shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]"
                              onMouseDown={event => event.stopPropagation()}
                            >
                              <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2563EB]">Correct order preview</p>
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {previewSuggestAction.proposedOrder.map((nodeId, proposedIndex) => {
                                  const sentence = paragraphSentenceById.get(nodeId);
                                  return (
                                    <div key={nodeId} className="flex items-center gap-2">
                                      <div className="w-[150px] rounded-[8px] border border-[#3B82F6]/20 bg-white/80 px-2.5 py-2">
                                        <p className="font-mono text-[8px] font-semibold uppercase tracking-widest text-[#2563EB]">{shortNodeLabel(nodeId)}</p>
                                        {sentence && (
                                          <p className="mt-1 line-clamp-2 font-sans text-[9.5px] leading-snug text-[#1E3A8A]/80">{sentence.sourceText || sentence.simplifiedIdea}</p>
                                        )}
                                      </div>
                                      {proposedIndex < (previewSuggestAction.proposedOrder?.length || 0) - 1 && (
                                        <span className="font-mono text-[11px] font-semibold text-[#2563EB]/45">→</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {showInCanvasFeedback && hasCoherenceMap && (
                            <div className="mt-1 flex justify-center">
                              <button
                                type="button"
                                data-no-pan="true"
                                onMouseDown={event => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const nextOpen = !isCoherenceMapOpen;
                                  const firstFlowId = problematicParagraphFlows[0]?.edgeId || null;

                                  setSelectedError(null);
                                  setSelectedEdgeId(null);
                                  setPreviewEdgeSolutionId(null);
                                  setPreviewFlowSolutionId(null);
                                  setOpenProposedNodeDetailId(null);
                                  visibleCoherenceMapParaIndexRef.current = nextOpen ? para.index : null;
                                  setVisibleCoherenceMapParaIndex(nextOpen ? para.index : null);
                                  setSelectedFlowId(nextOpen ? firstFlowId : null);
                                }}
                                className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] shadow-sm transition-all ${
                                  isCoherenceMapOpen
                                    ? 'border-[#E6961F]/35 bg-white text-[#8A5B0A]'
                                    : 'border-black/[0.06] bg-white/90 text-[#737373] hover:border-[#E6961F]/30 hover:text-[#8A5B0A]'
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-[3px] ${isCoherenceMapOpen ? 'bg-[#E6961F]' : 'bg-[#EC6A5B]'}`} />
                                {isCoherenceMapOpen ? 'Ẩn coherence map' : 'Xem coherence map'}
                              </button>
                            </div>
                          )}
                          <AnimatePresence initial={false}>
                            {showInCanvasFeedback && hasCoherenceMap && isCoherenceMapOpen && (
                              <motion.div
                                key={`coherence-map-${para.index}`}
                                initial={{ height: 0, opacity: 0, y: -6 }}
                                animate={{ height: 'auto', opacity: 1, y: 0 }}
                                exit={{ height: 0, opacity: 0, y: -6 }}
                                transition={{ type: 'spring', duration: 0.32, bounce: 0 }}
                                className="overflow-hidden"
                                onAnimationStart={measure}
                                onUpdate={measure}
                                onAnimationComplete={measure}
                              >
                                <CoherenceFlowLayer
                                  paragraph={para}
                                  flows={paragraphFlows}
                                  selectedFlowId={selectedFlowId}
                                  previewFlowSolutionId={resolvedPreviewFlowSolutionId}
                                  openProposedNodeDetailId={openProposedNodeDetailId}
                                  renderMap={false}
                                  onSelectFlow={(flowId) => {
                                    setSelectedError(null);
                                    setSelectedEdgeId(null);
                                    setPreviewEdgeSolutionId(null);
                                    setSelectedFlowId(selectedFlowId === flowId ? null : flowId);
                                    setOpenProposedNodeDetailId(null);
                                  }}
                                  onTogglePreview={(flowId) => {
                                    setPreviewEdgeSolutionId(null);
                                    setPreviewFlowSolutionId(previewFlowSolutionId === flowId ? null : flowId);
                                    setSelectedFlowId(flowId);
                                    setOpenProposedNodeDetailId(null);
                                  }}
                                  onToggleProposedNode={(nodeId) => {
                                    setOpenProposedNodeDetailId(current => current === nodeId ? null : nodeId);
                                  }}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
