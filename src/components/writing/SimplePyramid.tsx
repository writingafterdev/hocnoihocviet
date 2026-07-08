'use client';

import { useRef, useLayoutEffect, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MacroAnswerNode as MacroAnswerNodeType,
  ParagraphMoveNode,
  PyramidError,
} from '@/types/writing';

interface SimplePyramidProps {
  macroAnswer: MacroAnswerNodeType;
  paragraphs: ParagraphMoveNode[];
  activeParagraphIndex: number | null;
  onParagraphClick: (index: number | null) => void;
  isFullscreen?: boolean;
  onRequestFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

interface LineData {
  id: string;
  type: 'vertical_bus' | 'vertical_drop' | 'horizontal_sibling';
  x1: number; y1: number;
  x2: number; y2: number;
  error?: boolean;
  label?: string;
}

interface SvgBounds {
  x: number;
  y: number;
  w: number;
  h: number;
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
    minY = Math.min(minY, line.y1, line.y2);
    maxX = Math.max(maxX, line.x1, line.x2);
    maxY = Math.max(maxY, line.y1, line.y2);

    if (line.type === 'horizontal_sibling' && line.label) {
      const midX = (line.x1 + line.x2) / 2;
      minX = Math.min(minX, midX - 60);
      maxX = Math.max(maxX, midX + 60);
      minY = Math.min(minY, line.y1 - 16);
      maxY = Math.max(maxY, line.y1 + 24);
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

export default function SimplePyramid({
  macroAnswer,
  paragraphs: rawParagraphs,
  activeParagraphIndex,
  onParagraphClick,
  isFullscreen = false,
  onRequestFullscreen,
  onExitFullscreen,
}: SimplePyramidProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedError, setSelectedError] = useState<{ nodeId: string; error: PyramidError } | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const macroRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentenceRefs = useRef<{ [paraIndex: number]: (HTMLDivElement | null)[] }>({});

  const [lines, setLines] = useState<LineData[]>([]);
  const [svgBounds, setSvgBounds] = useState<SvgBounds>({ x: 0, y: 0, w: 2000, h: 1200 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const offsetRef = useRef({ x: 40, y: 40 });
  const activeParagraphIndexRef = useRef(activeParagraphIndex);

  const paragraphs = useMemo(() => 
    rawParagraphs.filter(p => {
      const lower = p.label.toLowerCase();
      return !['introduction', 'conclusion', 'mở bài', 'kết bài'].includes(lower);
    }),
  [rawParagraphs]);

  // Keep offsetRef in sync
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useLayoutEffect(() => {
    activeParagraphIndexRef.current = activeParagraphIndex;
  }, [activeParagraphIndex]);

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
      newLines.push({ id: 'macro-drop', type: 'vertical_drop', x1: macroX, y1: macroY, x2: macroX, y2: midY });

      // Horizontal bus
      const paraXs = paraPositions.map(p => p.x + p.w / 2);
      if (paraXs.length > 1) {
        newLines.push({ id: 'horizontal-bus', type: 'vertical_bus', x1: paraXs[0], y1: midY, x2: paraXs[paraXs.length - 1], y2: midY });
      }

      // Drops to paragraphs
      paraPositions.forEach((p, i) => {
        const pX = p.x + p.w / 2;
        const vertErr = verticalRelError(paragraphs[i].errors);
        newLines.push({ id: `para-drop-${i}`, type: 'vertical_drop', x1: pX, y1: midY, x2: pX, y2: paraTopY, error: !!vertErr });
      });

      // Horizontal sibling arrows
      for (let i = 0; i < paraPositions.length - 1; i++) {
        const cur = paraPositions[i];
        const nxt = paraPositions[i + 1];
        const horizErr = horizontalRelError(paragraphs[i].errors);
        newLines.push({ 
          id: `para-sib-${i}`, 
          type: 'horizontal_sibling', 
          x1: cur.x + cur.w, y1: cur.y + 40, 
          x2: nxt.x - 2, y2: nxt.y + 40, 
          error: !!horizErr,
          label: paragraphs[i].transitionToNext || "BỔ SUNG"
        });
      }

      // Sentence level
      const currentActiveParagraphIndex = activeParagraphIndexRef.current;
      if (currentActiveParagraphIndex !== null) {
        const activeIdx = paragraphs.findIndex(p => p.index === currentActiveParagraphIndex);
        const activeP = paraPositions[activeIdx];
        const sPos = (sentenceRefs.current[currentActiveParagraphIndex] || [])
          .map(r => r ? getLocalPos(r) : null)
          .filter(Boolean) as { x: number; y: number; w: number; h: number }[];

        if (activeP && sPos.length > 0) {
          const paraX = activeP.x + activeP.w / 2;
          const paraBottomY = activeP.y + activeP.h;
          const sentenceTopY = sPos[0].y;
          const midY2 = paraBottomY + (sentenceTopY - paraBottomY) / 2;

          newLines.push({ id: 'para-to-s-bus', type: 'vertical_drop', x1: paraX, y1: paraBottomY, x2: paraX, y2: midY2 });

          const sXs = sPos.map(s => s.x + s.w / 2);
          const minX = Math.min(...sXs, paraX);
          const maxX = Math.max(...sXs, paraX);
          if (minX !== maxX) {
            newLines.push({ id: 'horizontal-s-bus', type: 'vertical_bus', x1: minX, y1: midY2, x2: maxX, y2: midY2 });
          }

          sPos.forEach((s, i) => {
            const sX = s.x + s.w / 2;
            newLines.push({ id: `s-drop-${i}`, type: 'vertical_drop', x1: sX, y1: midY2, x2: sX, y2: sentenceTopY });
          });

          // Horizontal sibling arrows for sentences
          for (let i = 0; i < sPos.length - 1; i++) {
            const a = sPos[i];
            const b = sPos[i + 1];
            const horizErr = horizontalRelError(paragraphs[activeIdx].sentences[i]?.errors || []);
            newLines.push({ 
              id: `s-sibling-${i}`, 
              type: 'horizontal_sibling', 
              x1: a.x + a.w, y1: a.y + 40, 
              x2: b.x - 2, y2: b.y + 40, 
              error: !!horizErr,
              label: paragraphs[activeIdx].sentences[i].transitionToNext || ""
            });
          }
        }
      }
    }

    setLines(newLines);
    setSvgBounds(getConnectorBounds(newLines, container.offsetWidth + 100, container.offsetHeight + 100));
  }, [paragraphs]);

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

  // Wheel: ctrl/meta = zoom, otherwise = pan
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale(s => Math.max(0.2, Math.min(3, s - e.deltaY * 0.008)));
      } else {
        e.preventDefault();
        setOffset(o => ({ x: o.x - e.deltaX * 0.8, y: o.y - e.deltaY * 0.8 }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Mouse pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-pan="true"]')) return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
  }, []);

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

  return (
    <div 
      ref={wrapperRef}
      className="w-full relative bg-[#F8F9FA] rounded-[20px] border border-black/5 overflow-hidden" 
      style={{ height: '100%', cursor: 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >

      {/* Controls toolbar — always visible, z-index above everything */}
      <div
        data-no-pan="true"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          padding: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
          disabled={scale <= 0.2}
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', opacity: scale <= 0.2 ? 0.3 : 1 }}
          title="Zoom out"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 9, width: 30, textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontWeight: 600, letterSpacing: '0.06em' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.1))}
          disabled={scale >= 3}
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', opacity: scale >= 3 ? 0.3 : 1 }}
          title="Zoom in"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
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
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}
          title="Reset view"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        {!isFullscreen && onRequestFullscreen && (
          <>
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
            <button
              onClick={onRequestFullscreen}
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}
              title="Expand fullscreen"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>
              </svg>
            </button>
          </>
        )}
        {isFullscreen && onExitFullscreen && (
          <>
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
            <button
              onClick={onExitFullscreen}
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}
              title="Exit fullscreen"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v4H3M21 8h-4V3M16 21v-4h4M3 16h4v4"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Panning canvas */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <div ref={contentRef} style={{ position: 'relative', padding: '48px 64px 96px 64px', minWidth: 480 }}>
          {/* SVG connector layer */}
          <svg
            width={svgBounds.w}
            height={svgBounds.h}
            viewBox={`${svgBounds.x} ${svgBounds.y} ${svgBounds.w} ${svgBounds.h}`}
            style={{ position: 'absolute', top: svgBounds.y, left: svgBounds.x, pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
              <marker id="arrow-error" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
            </defs>
            {lines.map(l => {
              const isErr = l.error;
              const isDrop = l.type === 'vertical_drop';
              const color = isErr ? '#f59e0b' : 'rgba(0,0,0,0.15)';
              const strokeW = isErr ? 1.5 : 1.2;
              const markerId = isErr ? "url(#arrow-error)" : "url(#arrow)";

              if (l.type === 'horizontal_sibling') {
                const midX = (l.x1 + l.x2) / 2;
                return (
                  <g key={l.id}>
                    <path
                      d={`M${l.x1},${l.y1} C${midX},${l.y1} ${midX},${l.y2} ${l.x2},${l.y2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeW}
                      strokeDasharray={isErr ? '4 3' : undefined}
                      strokeLinecap="round"
                      markerEnd={markerId}
                    />
                    {l.label && (
                      <foreignObject x={midX - 50} y={l.y1 - 10} width="100" height="20">
                        <div className="flex items-center justify-center w-full h-full">
                          <span className="bg-white px-2 py-[1px] rounded-[6px] border border-black/10 text-[8.5px] font-sans font-bold text-black/60 uppercase tracking-widest whitespace-nowrap shadow-sm text-center">
                            {l.label}
                          </span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              }

              return (
                <line
                  key={l.id}
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeDasharray={isErr ? '4 3' : undefined}
                  strokeLinecap="round"
                  markerEnd={isDrop ? markerId : undefined}
                />
              );
            })}
          </svg>

          {/* MACRO ANSWER */}
          <div className={`flex justify-center mb-10 transition-opacity duration-300 ${!(!selectedError || selectedError.nodeId === 'macro') && selectedError ? 'opacity-30 grayscale' : 'opacity-100'}`}>
            <div 
              ref={macroRef}
              onClick={() => {
                if (macroHasInternal) {
                  if (selectedError?.nodeId === 'macro') setSelectedError(null);
                  else setSelectedError({ nodeId: 'macro', error: internalErrors(macroAnswer.errors)[0] });
                }
              }}
              className="relative z-10 w-[420px] rounded-[12px] px-6 py-5 transition-all duration-200 border bg-[#FDE047] border-black/10 shadow-sm cursor-pointer"
            >
              <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-black/60 mb-2">
                Lập trường chính
              </p>
              <p className="font-sans text-[15px] font-medium leading-relaxed text-[#111]">
                {macroAnswer.text}
              </p>
              <AnimatePresence initial={false}>
                {macroHasInternal && selectedError?.nodeId === 'macro' && (
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
              {macroHasInternal && selectedError?.nodeId !== 'macro' && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-rose-500 rounded-full shadow-sm animate-pulse border-2 border-white" />
              )}
            </div>
          </div>

          <div className="relative z-10 flex gap-32 items-start">
            {paragraphs.map((para, i) => {
              const internalErrs = internalErrors(para.errors);
              const hasErr = internalErrs.length > 0;
              const isActive = activeParagraphIndex === para.index;
              
              const isAffected = selectedError ? 
                (selectedError.error.affectedNodes?.paragraphs?.includes(para.index) || 
                 selectedError.nodeId === `para-${para.index}` ||
                 selectedError.nodeId.startsWith(`sentence-${para.index}-`)) : true;
                 
              return (
                <div key={para.index} className={`flex flex-col items-center transition-opacity duration-300 ${!isAffected && selectedError ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                  <div
                    ref={el => { paraRefs.current[i] = el; }}
                    data-no-pan="true"
                    onClick={() => {
                      if (hasErr) {
                        if (selectedError?.nodeId === `para-${para.index}`) setSelectedError(null);
                        else setSelectedError({ nodeId: `para-${para.index}`, error: internalErrs[0] });
                      }
                      onParagraphClick(isActive ? null : para.index);
                    }}
                    className={`relative w-[220px] shrink-0 rounded-[12px] px-5 py-4 transition-all duration-200 cursor-pointer border ${
                      selectedError?.nodeId === `para-${para.index}` ? 'ring-4 ring-rose-500/30 z-50' : ''
                    } ${
                      isActive
                        ? 'bg-[#66E2B1] border-2 border-black/30 shadow-[0_12px_40px_rgba(0,0,0,0.12)] scale-[1.02] z-20'
                        : hasErr
                        ? 'bg-[#66E2B1] border-rose-400 shadow-sm z-10'
                        : 'bg-[#66E2B1] border-black/10 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-black/20 z-10'
                    }`}
                  >
                    <div className={`font-sans text-[10px] font-bold tracking-[0.12em] uppercase mb-2 ${isActive ? 'text-black' : 'text-black/60'}`}>
                      {para.label}
                    </div>
                    <div className="font-sans text-[13px] leading-relaxed text-black/80">
                      {para.job}
                    </div>
                    
                    <AnimatePresence initial={false}>
                      {hasErr && selectedError?.nodeId === `para-${para.index}` && (
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
                    
                    {hasErr && selectedError?.nodeId !== `para-${para.index}` && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-rose-500 rounded-full shadow-sm animate-pulse border-2 border-white" />
                    )}
                  </div>

                  {/* SENTENCES */}
                  <div className="relative w-full z-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex justify-center">
                      <AnimatePresence initial={false}>
                      {isActive && para.sentences && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: "auto", opacity: 1, marginTop: 64 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                          className="w-max shrink-0 overflow-hidden"
                          onUpdate={measure}
                        >
                        <div className="flex gap-28 items-start justify-center pb-4">
                          {para.sentences.map((s, si) => {
                            const sErrs = s.errors.filter(e => e.type === 'internal');
                            const hasE = sErrs.length > 0;
                            const isSAffected = selectedError ? 
                              (selectedError.error.affectedNodes?.sentences?.some(aff => aff.paraIndex === para.index && aff.sentenceIndex === s.index) || 
                               selectedError.nodeId === `sentence-${para.index}-${s.index}`) : true;
                               
                            return (
                              <div
                                key={si}
                                ref={el => {
                                  if (!sentenceRefs.current[para.index]) sentenceRefs.current[para.index] = [];
                                  sentenceRefs.current[para.index][si] = el;
                                }}
                                data-no-pan="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasE) {
                                    if (selectedError?.nodeId === `sentence-${para.index}-${s.index}`) setSelectedError(null);
                                    else setSelectedError({ nodeId: `sentence-${para.index}-${s.index}`, error: sErrs[0] });
                                  }
                                }}
                                className={`relative w-[200px] shrink-0 rounded-[10px] px-4 py-4 transition-all cursor-pointer border ${
                                  selectedError?.nodeId === `sentence-${para.index}-${s.index}` ? 'ring-4 ring-rose-500/30 z-50' : ''
                                } ${
                                  hasE ? 'bg-[#96DAED] border-rose-400 shadow-sm z-10' :
                                  'bg-[#96DAED] border-black/10 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-black/20'
                                } ${!isSAffected && selectedError ? 'opacity-30 grayscale' : 'opacity-100'}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-4 h-4 rounded flex items-center justify-center font-mono text-[9px] bg-black/10 text-black/60">
                                    {si + 1}
                                  </span>
                                  <span className="font-mono text-[9px] text-black/60 uppercase tracking-[0.1em]">
                                    {s.role}
                                  </span>
                                </div>
                                <div className="font-sans text-[12px] text-black/80 leading-relaxed">
                                  {s.simplifiedIdea}
                                </div>
                                
                                <AnimatePresence initial={false}>
                                  {hasE && selectedError?.nodeId === `sentence-${para.index}-${s.index}` && (
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

                                {hasE && selectedError?.nodeId !== `sentence-${para.index}-${s.index}` && (
                                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-rose-500 rounded-full shadow-sm animate-pulse border-2 border-white" />
                                )}
                              </div>
                            );
                          })}
                          </div>
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
