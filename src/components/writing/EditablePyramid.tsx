'use client';

import { useRef, useLayoutEffect, useState, useCallback, useEffect, useMemo } from 'react';
import {
  MacroAnswerNode as MacroAnswerNodeType,
  ParagraphMoveNode,
  SentenceAnnotation,
  SentenceRole,
} from '@/types/writing';

interface EditablePyramidProps {
  pyramid: {
    macroAnswer: MacroAnswerNodeType;
    paragraphs: ParagraphMoveNode[];
  };
  onChange: (newPyramid: { macroAnswer: MacroAnswerNodeType, paragraphs: ParagraphMoveNode[] }) => void;
  activeParagraphIndex: number | null;
  onParagraphClick: (index: number | null) => void;
  onRequestFullscreen?: () => void;
  isFullscreen?: boolean;
}

interface LineData {
  id: string;
  type: 'vertical_bus' | 'vertical_drop' | 'horizontal_sibling' | 'vertical_stem';
  x1: number; y1: number;
  x2: number; y2: number;
  error?: boolean;
  label?: string;
  sourceIndex?: number;
  paraIndex?: number;
  sentenceIndex?: number;
}

interface SvgBounds {
  x: number;
  y: number;
  w: number;
  h: number;
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

    if (line.type === 'horizontal_sibling' && line.label !== undefined) {
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

export default function EditablePyramid({
  pyramid,
  onChange,
  activeParagraphIndex,
  onParagraphClick,
  onRequestFullscreen,
}: EditablePyramidProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const macroRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentenceRefs = useRef<{ [paraIndex: number]: (HTMLDivElement | null)[] }>({});
  const addParaRef = useRef<HTMLButtonElement>(null);
  const [lines, setLines] = useState<LineData[]>([]);
  const [svgBounds, setSvgBounds] = useState<SvgBounds>({ x: 0, y: 0, w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const offsetRef = useRef({ x: 40, y: 40 });
  const activeParagraphIndexRef = useRef(activeParagraphIndex);

  const visibleParagraphs = useMemo(() => 
    pyramid.paragraphs.filter(p => {
      const lower = p.label.toLowerCase();
      return !['introduction', 'conclusion', 'mở bài', 'kết bài'].includes(lower);
    }),
  [pyramid.paragraphs]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useLayoutEffect(() => {
    activeParagraphIndexRef.current = activeParagraphIndex;
  }, [activeParagraphIndex]);

  // Returns the element's position relative to the container using offset coordinates.
  // offsetLeft/offsetTop are NOT affected by CSS zoom, so these are always correct.
  const getPos = (el: HTMLElement, container: HTMLElement) => {
    let x = 0, y = 0;
    let cur: HTMLElement | null = el;
    while (cur && cur !== container) {
      x += cur.offsetLeft;
      y += cur.offsetTop;
      cur = cur.offsetParent as HTMLElement | null;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };

  const measure = useCallback(() => {
    if (!containerRef.current || !macroRef.current) return;
    const container = containerRef.current;

    const newLines: LineData[] = [];

    const macro = getPos(macroRef.current, container);
    const macroX = macro.x + macro.w / 2;
    const macroY = macro.y + macro.h;

    const paraPositions = paraRefs.current
      .slice(0, visibleParagraphs.length)
      .map(r => r ? getPos(r, container) : null)
      .filter(Boolean) as { x: number; y: number; w: number; h: number }[];

    if (paraPositions.length > 0) {
      const paraTopY = paraPositions[0].y;
      const midY = macroY + (paraTopY - macroY) / 2;

      // Stem from macro down to horizontal bus (no arrowhead)
      newLines.push({ id: 'macro-drop', type: 'vertical_stem', x1: macroX, y1: macroY, x2: macroX, y2: midY });

      // Compute bus extents
      const paraXs = paraPositions.map(p => p.x + p.w / 2);
      let busMinX = Math.min(...paraXs, macroX);
      let busMaxX = Math.max(...paraXs, macroX);

      // Add paragraph button
      if (addParaRef.current) {
        const addPos = getPos(addParaRef.current, container);
        const addX = addPos.x + addPos.w / 2;
        const addTopY = addPos.y;
        busMinX = Math.min(busMinX, addX);
        busMaxX = Math.max(busMaxX, addX);
        newLines.push({ id: 'add-para-drop', type: 'vertical_drop', x1: addX, y1: midY, x2: addX, y2: addTopY - 2 });
      }

      // Horizontal bus
      newLines.push({ id: 'horizontal-bus', type: 'vertical_bus', x1: busMinX, y1: midY, x2: busMaxX, y2: midY });

      // Drops from bus to each paragraph (with arrowheads)
      paraPositions.forEach((p, i) => {
        const pX = p.x + p.w / 2;
        newLines.push({ id: `para-drop-${i}`, type: 'vertical_drop', x1: pX, y1: midY, x2: pX, y2: p.y - 2 });
      });

      // Horizontal sibling arrows for paragraphs
      if (visibleParagraphs.length > 1) {
        for (let i = 0; i < visibleParagraphs.length - 1; i++) {
          const cur = paraPositions[i];
          const nxt = paraPositions[i + 1];
          newLines.push({ 
            id: `para-sib-${i}`, 
            type: 'horizontal_sibling', 
            x1: cur.x + cur.w, y1: cur.y + 40, 
            x2: nxt.x - 2, y2: nxt.y + 40,
            error: false,
            label: pyramid.paragraphs[i].transitionToNext || "",
            sourceIndex: i
          });
        }
      }

      // Sentence level
      const currentActiveParagraphIndex = activeParagraphIndexRef.current;
      if (currentActiveParagraphIndex !== null) {
        const activeParaIndex = visibleParagraphs.findIndex(p => p.index === currentActiveParagraphIndex);
        if (activeParaIndex !== -1 && paraPositions[activeParaIndex]) {
          const activePos = getPos(paraRefs.current[activeParaIndex]!, container);
          const paraX = activePos.x + activePos.w / 2;
          const paraBottomY = activePos.y + activePos.h;

          const sentencePositions = (sentenceRefs.current[currentActiveParagraphIndex] || [])
            .slice(0, visibleParagraphs[activeParaIndex].sentences.length)
            .map(r => r ? getPos(r, container) : null)
            .filter(Boolean) as { x: number; y: number; w: number; h: number }[];

          if (sentencePositions.length > 0) {
            const sentTopY = sentencePositions[0].y;
            const midY2 = paraBottomY + (sentTopY - paraBottomY) / 2;

            // Stem from para to sentence bus (no arrowhead)
            newLines.push({ id: 'para-to-sentence-bus', type: 'vertical_stem', x1: paraX, y1: paraBottomY, x2: paraX, y2: midY2 });

            const sentXs = sentencePositions.map(s => s.x + s.w / 2);
            const minSX = Math.min(...sentXs, paraX);
            const maxSX = Math.max(...sentXs, paraX);
            if (minSX !== maxSX) {
              newLines.push({ id: 'horizontal-sentence-bus', type: 'vertical_bus', x1: minSX, y1: midY2, x2: maxSX, y2: midY2 });
            }

            sentencePositions.forEach((s, i) => {
              const sX = s.x + s.w / 2;
              newLines.push({ id: `sentence-drop-${i}`, type: 'vertical_drop', x1: sX, y1: midY2, x2: sX, y2: s.y - 2 });
            });
            
            const para = visibleParagraphs[activeParaIndex];
            for (let i = 0; i < sentencePositions.length - 1; i++) {
              const a = sentencePositions[i];
              const b = sentencePositions[i + 1];
              newLines.push({ 
                id: `s-sibling-${i}`, 
                type: 'horizontal_sibling', 
                x1: a.x + a.w, y1: a.y + 40, 
                x2: b.x - 2, y2: b.y + 40,
                error: false,
                label: para.sentences[i].transitionToNext || "",
                paraIndex: para.index,
                sentenceIndex: para.sentences[i].index
              });
            }
          }
        }
      }
    }

    setLines(newLines);
    setSvgBounds(getConnectorBounds(newLines, container.offsetWidth, container.offsetHeight));
  }, [pyramid, visibleParagraphs]);

  const centered = useRef(false);
  useLayoutEffect(() => {
    centered.current = false;
  }, [visibleParagraphs.length]);

  useLayoutEffect(() => {
    measure();
    
    if (!centered.current && wrapperRef.current && containerRef.current) {
      const wW = wrapperRef.current.clientWidth;
      const cW = containerRef.current.scrollWidth;
      const newX = Math.max(40, (wW - cW) / 2);
      setOffset({ x: newX, y: 40 });
      offsetRef.current = { x: newX, y: 40 };
      centered.current = true;
    }

    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
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
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('[data-no-pan="true"]')) return;
    
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

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

  const [draggedParaIndex, setDraggedParaIndex] = useState<number | null>(null);
  const [draggedSentence, setDraggedSentence] = useState<{ paraIndex: number; sentenceIndex: number } | null>(null);

  const updateMacro = (text: string) => {
    onChange({ ...pyramid, macroAnswer: { ...pyramid.macroAnswer, text } });
  };

  const addParagraph = () => {
    const newIndex = pyramid.paragraphs.length > 0 ? Math.max(...pyramid.paragraphs.map(p => p.index)) + 1 : 0;
    
    const conclusionIndex = pyramid.paragraphs.findIndex(p => {
      const l = p.label.toLowerCase();
      return l === 'conclusion' || l === 'kết bài';
    });
    
    const newPara = {
      index: newIndex,
      label: '',
      job: '',
      paragraphStartChar: 0,
      paragraphEndChar: 0,
      errors: [],
      sentences: [],
    };

    const newParagraphs = [...pyramid.paragraphs];
    if (conclusionIndex !== -1) {
      newParagraphs.splice(conclusionIndex, 0, newPara);
    } else {
      newParagraphs.push(newPara);
    }

    onChange({
      ...pyramid,
      paragraphs: newParagraphs,
    });
  };

  const removeParagraph = (indexToRemove: number) => {
    onChange({
      ...pyramid,
      paragraphs: pyramid.paragraphs.filter(p => p.index !== indexToRemove),
    });
    if (activeParagraphIndex === indexToRemove) {
      onParagraphClick(null);
    }
  };

  const updateParagraph = (index: number, updates: Partial<ParagraphMoveNode>) => {
    onChange({
      ...pyramid,
      paragraphs: pyramid.paragraphs.map(p => p.index === index ? { ...p, ...updates } : p),
    });
  };

  const addSentence = (paraIndex: number) => {
    onChange({
      ...pyramid,
      paragraphs: pyramid.paragraphs.map(p => {
        if (p.index === paraIndex) {
          const newSIndex = p.sentences.length > 0 ? Math.max(...p.sentences.map(s => s.index)) + 1 : 1;
          return {
            ...p,
            sentences: [
              ...p.sentences,
              {
                index: newSIndex,
                startChar: 0, endChar: 0,
                role: 'claim' as SentenceRole,
                simplifiedIdea: '',
                errors: [],
              }
            ]
          };
        }
        return p;
      }),
    });
  };

  const removeSentence = (paraIndex: number, sentenceIndex: number) => {
    onChange({
      ...pyramid,
      paragraphs: pyramid.paragraphs.map(p => {
        if (p.index === paraIndex) {
          return {
            ...p,
            sentences: p.sentences.filter(s => s.index !== sentenceIndex),
          };
        }
        return p;
      }),
    });
  };

  const updateSentence = (paraIndex: number, sentenceIndex: number, updates: Partial<SentenceAnnotation>) => {
    onChange({
      ...pyramid,
      paragraphs: pyramid.paragraphs.map(p => {
        if (p.index === paraIndex) {
          return {
            ...p,
            sentences: p.sentences.map(s => s.index === sentenceIndex ? { ...s, ...updates } : s),
          };
        }
        return p;
      }),
    });
  };

  const handleParaDragStart = (e: React.DragEvent, index: number) => {
    setDraggedParaIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleParaDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedParaIndex === null || draggedParaIndex === index) return;
    
    const newParas = [...pyramid.paragraphs];
    const dragIdx = newParas.findIndex(p => p.index === draggedParaIndex);
    const dropIdx = newParas.findIndex(p => p.index === index);
    
    if (dragIdx > -1 && dropIdx > -1) {
      const temp = newParas[dragIdx];
      newParas.splice(dragIdx, 1);
      newParas.splice(dropIdx, 0, temp);
      onChange({ ...pyramid, paragraphs: newParas });
    }
  };

  const handleParaDragEnd = () => {
    setDraggedParaIndex(null);
  };

  const handleSentenceDragStart = (e: React.DragEvent, paraIndex: number, sentenceIndex: number) => {
    e.stopPropagation();
    setDraggedSentence({ paraIndex, sentenceIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSentenceDragOver = (e: React.DragEvent, paraIndex: number, sentenceIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSentence || draggedSentence.paraIndex !== paraIndex || draggedSentence.sentenceIndex === sentenceIndex) return;

    onChange({
      ...pyramid,
      paragraphs: pyramid.paragraphs.map(p => {
        if (p.index === paraIndex) {
          const newSentences = [...p.sentences];
          const dragIdx = newSentences.findIndex(s => s.index === draggedSentence.sentenceIndex);
          const dropIdx = newSentences.findIndex(s => s.index === sentenceIndex);
          
          if (dragIdx > -1 && dropIdx > -1) {
            const temp = newSentences[dragIdx];
            newSentences.splice(dragIdx, 1);
            newSentences.splice(dropIdx, 0, temp);
            return { ...p, sentences: newSentences };
          }
        }
        return p;
      }),
    });
  };

  const handleSentenceDragEnd = () => {
    setDraggedSentence(null);
  };

  return (
    <div 
      className="w-full relative bg-[#F8F9FA] rounded-[20px] border border-black/5 overflow-hidden"
      style={{ height: '100%' }}
    >
      {/* Zoom controls */}
      <div 
        className="absolute top-4 right-4 z-50 flex items-center gap-1 bg-white/95 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)] rounded-[8px] p-1"
        data-no-pan="true"
        onMouseDown={e => e.stopPropagation()}
      >
        <button 
          onClick={() => setScale(z => Math.max(0.2, z - 0.1))}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-black/5 text-black/40 hover:text-black/80 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={scale <= 0.2}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
        </button>
        <span className="font-mono text-[9px] font-semibold text-black/40 w-10 text-center select-none">
          {Math.round(scale * 100)}%
        </span>
        <button 
          onClick={() => setScale(z => Math.min(3, z + 0.1))}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-black/5 text-black/40 hover:text-black/80 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={scale >= 3}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div className="w-px h-4 bg-black/10 mx-0.5" />
        <button
          onClick={() => {
            setScale(1);
            centered.current = false;
            if (wrapperRef.current && containerRef.current) {
              const wW = wrapperRef.current.clientWidth;
              const cW = containerRef.current.scrollWidth;
              const newX = Math.max(40, (wW - cW) / 2);
              setOffset({ x: newX, y: 40 });
              offsetRef.current = { x: newX, y: 40 };
            }
          }}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-black/5 text-black/40 hover:text-black/80 transition-colors"
          title="Reset view"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        {onRequestFullscreen && (
          <>
            <div className="w-px h-4 bg-black/10 mx-0.5" />
            <button
              onClick={onRequestFullscreen}
              className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-black/5 text-black/40 hover:text-black/80 transition-colors"
              title="Expand fullscreen"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Pyramid Container */}
      <div 
        ref={wrapperRef}
        className="w-full h-full overflow-hidden relative cursor-grab select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >

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
          <div
            ref={containerRef}
            className="relative flex flex-col items-center gap-12 w-max px-[64px] py-[48px] pb-[96px] min-w-[480px]"
          >
            {/* SVG connector layer */}
            <svg
            width={svgBounds.w}
            height={svgBounds.h}
            viewBox={`${svgBounds.x} ${svgBounds.y} ${svgBounds.w} ${svgBounds.h}`}
            className="absolute pointer-events-none"
            style={{ zIndex: 0, left: svgBounds.x, top: svgBounds.y, overflow: 'visible' }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
            </defs>
            {lines.map((l) => {
              const color = 'rgba(0,0,0,0.15)';
              const strokeW = 1.2;
              
              if (l.type === 'horizontal_sibling') {
                const midX = (l.x1 + l.x2) / 2;
                return (
                  <g key={l.id}>
                    <path
                      d={`M${l.x1},${l.y1} C${midX},${l.y1} ${midX},${l.y2} ${l.x2},${l.y2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      markerEnd="url(#arrow)"
                    />
                  </g>
                );
              }
              const isDrop = l.type === 'vertical_drop';
              return (
                <line
                  key={l.id}
                  x1={l.x1} y1={l.y1}
                  x2={l.x2} y2={l.y2}
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeDasharray={l.id === 'add-para-drop' ? '4 4' : undefined}
                  markerEnd={isDrop ? "url(#arrow)" : undefined}
                />
              );
            })}
          </svg>

          {/* HTML LABELS FOR HORIZONTAL LINES */}
          {lines.map((l) => {
            if (l.type === 'horizontal_sibling' && l.label !== undefined) {
              const midX = (l.x1 + l.x2) / 2;
              return (
                <div
                  key={`lbl-${l.id}`}
                  style={{
                    position: 'absolute',
                    left: midX - 50,
                    top: l.y1 - 10,
                    width: 100,
                    height: 20,
                  }}
                  className="flex items-center justify-center z-20 pointer-events-auto"
                >
                  <input
                    value={l.label}
                    onChange={(e) => {
                      if (l.paraIndex !== undefined && l.sentenceIndex !== undefined) {
                        updateSentence(l.paraIndex, l.sentenceIndex, { transitionToNext: e.target.value });
                      } else if (l.sourceIndex !== undefined) {
                        updateParagraph(pyramid.paragraphs[l.sourceIndex].index, { transitionToNext: e.target.value });
                      }
                    }}
                    placeholder="Chuyển tiếp..."
                    className="bg-white px-2 py-[1px] rounded-[6px] border border-black/10 text-[8.5px] font-sans font-bold text-black/60 uppercase tracking-widest whitespace-nowrap shadow-sm text-center w-[90px] outline-none hover:border-[#10B981]/40 focus:border-[#10B981] transition-all"
                  />
                </div>
              );
            }
            return null;
          })}

          {/* MACRO ANSWER NODE */}
          <div className="flex justify-center mb-10">
            <div
              ref={macroRef}
              className="relative z-10 w-[420px] rounded-[12px] px-5 py-4 transition-all duration-200 bg-[#FDE047] border border-black/10 shadow-sm focus-within:shadow-md focus-within:border-black/30"
            >
              <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-[#A18A51] mb-2">
                Lập trường chính
              </p>
              <textarea
                value={pyramid.macroAnswer.text}
                onChange={(e) => updateMacro(e.target.value)}
                placeholder="Luận điểm cốt lõi của bài viết là gì?"
                className="w-full font-sans text-[15px] leading-relaxed text-[#111] bg-transparent outline-none resize-none placeholder:text-black/20"
                rows={2}
              />
            </div>
          </div>

          {/* PARAGRAPH ROWS */}
          <div className="relative z-10 flex gap-32 items-start">
            {visibleParagraphs.map((para, i) => {
              const isActive = activeParagraphIndex === para.index;
              const hasErr = para.errors.length > 0;

              return (
                <div key={para.index} className="flex flex-col items-center group/para">
                  {/* PARAGRAPH CARD */}
                  <div
                    ref={el => { paraRefs.current[i] = el; }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                        onParagraphClick(isActive ? null : para.index);
                      }
                    }}
                    className={`paragraph-node relative w-[220px] shrink-0 rounded-[12px] px-5 py-4 cursor-pointer transition-all duration-200 border ${
                      draggedParaIndex === para.index ? 'opacity-50 scale-[1.02] shadow-xl z-30 bg-[#66E2B1] border-2 border-black/20' :
                      isActive
                        ? 'bg-[#66E2B1] border-2 border-black/30 shadow-[0_12px_40px_rgba(0,0,0,0.12)] scale-[1.02] z-20'
                        : hasErr
                        ? 'bg-[#FFF5F5] border-[#FECDD3] shadow-sm z-10'
                        : 'bg-[#66E2B1] border-black/10 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-black/20 z-10'
                    }`}
                    draggable
                    onDragStart={(e) => handleParaDragStart(e, para.index)}
                    onDragOver={(e) => handleParaDragOver(e, para.index)}
                    onDragEnd={handleParaDragEnd}
                  >
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeParagraph(para.index); }}
                      className="absolute -top-3 -right-3 w-6 h-6 bg-white rounded-full shadow border border-black/5 flex items-center justify-center text-black/40 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover/para:opacity-100 transition-opacity z-20"
                    >
                      ×
                    </button>

                    <input
                      value={para.label}
                      onChange={(e) => updateParagraph(para.index, { label: e.target.value })}
                      placeholder="Nhãn (vd: Thân bài 1)"
                      className={`w-full font-sans text-[10px] font-bold tracking-[0.12em] uppercase mb-2 bg-transparent outline-none ${isActive ? 'text-black' : 'text-black/60'}`}
                    />
                    <textarea
                      value={para.job}
                      onChange={(e) => updateParagraph(para.index, { job: e.target.value })}
                      placeholder="Mục đích chính của đoạn văn này là gì?"
                      className="w-full font-sans text-[13px] leading-relaxed text-[#141413]/80 bg-transparent outline-none resize-none placeholder:text-black/20"
                      rows={2}
                    />
                  </div>

                  {/* SENTENCES ROW */}
                  <div className="w-full flex justify-center mt-4">
                    {isActive && (
                      <div className="relative z-10 flex gap-28 items-start mt-16 animate-in slide-in-from-top-4 fade-in duration-300">
                        {para.sentences.map((s, si) => (
                        <div 
                          key={s.index}
                          ref={el => {
                            if (!sentenceRefs.current[para.index]) sentenceRefs.current[para.index] = [];
                            sentenceRefs.current[para.index][si] = el;
                          }}
                          className={`relative group/sentence w-[200px] shrink-0 rounded-[10px] px-4 py-4 transition-all cursor-pointer border ${
                            draggedSentence?.sentenceIndex === s.index ? 'opacity-50 scale-[1.02] shadow-xl z-30 bg-[#96DAED] border-2 border-black/20' :
                            'bg-[#96DAED] border-black/10 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-black/20 focus-within:border-black/30 focus-within:shadow-[0_8px_24px_rgba(0,0,0,0.1)]'
                          }`}
                          draggable
                          onDragStart={(e) => handleSentenceDragStart(e, para.index, s.index)}
                          onDragOver={(e) => handleSentenceDragOver(e, para.index, s.index)}
                          onDragEnd={handleSentenceDragEnd}
                        >
                          <button 
                            onClick={() => removeSentence(para.index, s.index)}
                            className="absolute -top-3 -right-3 w-5 h-5 bg-white rounded-full shadow border border-black/5 flex items-center justify-center text-black/40 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover/sentence:opacity-100 transition-opacity text-[14px] z-20"
                          >
                            ×
                          </button>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-4 h-4 rounded flex items-center justify-center font-mono text-[9px] bg-black/5 text-black/40">
                              {si + 1}
                            </span>
                            <input
                              value={s.role}
                              onChange={(e) => updateSentence(para.index, s.index, { role: e.target.value as SentenceRole })}
                              placeholder="Vai trò (vd: Luận điểm)"
                              className="w-full font-mono text-[9px] text-black/40 uppercase tracking-[0.1em] bg-transparent outline-none"
                            />
                          </div>
                          <textarea
                            value={s.simplifiedIdea}
                            onChange={(e) => updateSentence(para.index, s.index, { simplifiedIdea: e.target.value })}
                            placeholder="Ý chính của câu này là gì?"
                            className="w-full font-sans text-[12px] text-[#141413]/80 leading-relaxed bg-transparent outline-none resize-none placeholder:text-black/20"
                            rows={3}
                          />
                        </div>
                      ))}

                      {/* Add Sentence Button */}
                      <button
                        onClick={() => addSentence(para.index)}
                        className="w-[140px] shrink-0 rounded-[10px] px-4 py-4 border border-dashed border-[#CBE5FB] text-[#3B82F6]/60 hover:text-[#3B82F6] hover:border-[#3B82F6]/60 hover:bg-[#F6FBFF] transition-all flex flex-col items-center justify-center gap-2 h-full min-h-[120px]"
                      >
                        <span className="text-[20px] leading-none">+</span>
                        <span className="font-sans text-[12px] font-medium">Thêm câu</span>
                      </button>
                    </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Paragraph Button */}
            <button
              ref={addParaRef}
              onClick={addParagraph}
              className="w-[220px] shrink-0 rounded-[14px] px-4 py-4 border-2 border-dashed border-emerald-400 text-emerald-500 hover:bg-emerald-50 hover:border-emerald-500 transition-all flex flex-col items-center justify-center gap-2 h-[120px]"
            >
              <span className="text-[24px] leading-none">+</span>
              <span className="font-sans text-[13px] font-medium">Thêm đoạn</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
