'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Link from 'next/link';
import TopHeader from '@/components/TopHeader';
import TranslateModal from '@/components/writing/TranslateModal';
import ScoreBar, { DimensionKey } from '@/components/writing/ScoreBar';
import SimplePyramid from '@/components/writing/SimplePyramid';
import EditablePyramid from '@/components/writing/EditablePyramid';
import EssayPanel from '@/components/writing/EssayPanel';
import { WritingAnalysis } from '@/types/writing';
import { useParams } from 'next/navigation';
import { getPromptById } from '@/lib/prompts';
import { DEMO_ANALYSIS, DEMO_ESSAY, EMPTY_ANALYSIS } from '@/lib/writing-demo';
import { motion, AnimatePresence } from 'motion/react';

type PageState = 'idle' | 'analyzing' | 'result';

function WordCount({ text }: { text: string }) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const target = 250;
  const ok = count >= target;
  return (
    <span className={`font-mono text-[11px] tabular-nums ${ok ? 'text-emerald-600' : 'text-black/40'}`}>
      {count} / {target} từ
    </span>
  );
}

export default function WritingPage() {
  const params = useParams<{ id: string }>();
  const promptData = getPromptById(params.id || '');
  const promptText = promptData?.text || '';

  const [state, setState] = useState<PageState>('idle');
  const [paragraphTexts, setParagraphTexts] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<WritingAnalysis | null>(null);
  const [planPyramid, setPlanPyramid] = useState(EMPTY_ANALYSIS.pyramid);
  const [error, setError] = useState<string | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('taskAchievement');
  const [isPyramidFullscreen, setIsPyramidFullscreen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    try {
      const cacheKey = `rnw-draft-${params.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.paragraphTexts) setParagraphTexts(parsed.paragraphTexts);
        if (parsed.planPyramid) setPlanPyramid(parsed.planPyramid);
        if (parsed.state) setState(parsed.state);
        if (parsed.analysis) setAnalysis(parsed.analysis);
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
  }, [params.id]);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const cacheKey = `rnw-draft-${params.id}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        paragraphTexts,
        planPyramid,
        state,
        analysis,
      }));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }, [paragraphTexts, planPyramid, state, analysis, params.id, isMounted]);

  const essay = planPyramid.paragraphs
    .map(p => paragraphTexts[p.index] || '')
    .filter(text => text.trim().length > 0)
    .join('\n\n');

  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !resultContainerRef.current) return;
      const rect = resultContainerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(75, Math.max(25, newWidth)));
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const handleSubmit = async () => {
    if (!promptText.trim() || !essay.trim()) return;
    setError(null);
    setState('analyzing');

    try {
      const res = await fetch('/api/writing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, essay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
      setState('result');
    } catch (err: any) {
      setError(err.message);
      setState('idle');
    }
  };

  const displayAnalysis = state === 'result' && analysis ? analysis : EMPTY_ANALYSIS;

  return (
    <div 
      className={`overflow-hidden flex flex-col text-[#141413] antialiased transition-colors duration-500 ${state === 'result' ? 'bg-[#F8F9FA]' : 'bg-[#FFFFFF]'}`}
      style={{ height: 'calc(100vh / 1.1)' }}
    >
      <TopHeader user={null} />

      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 flex-1 min-h-0">
        <div ref={resultContainerRef} className="w-full h-full flex relative min-h-0">

          {/* LEFT: Essay + Tabs / Input Form */}
                    <main 
            style={{ width: `calc(${leftWidth}% - 12px)` }}
            className={`shrink-0 bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)] p-6 md:p-8 hide-scrollbar h-full flex flex-col ${state === 'result' ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            <div className="flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between mb-8 shrink-0">
                {state === 'idle' || state === 'analyzing' ? (
                  <Link
                    href="/writing"
                    className="inline-flex items-center bg-[#141413] text-[#FFFFFF] px-4 py-2 rounded-[12px] hover:bg-black transition-colors font-sans text-[13px] font-medium"
                  >
                    <span className="mr-2">←</span> Thoát luyện tập
                  </Link>
                ) : (
                  <button
                    onClick={() => { setState('idle'); setAnalysis(null); setActiveParagraphIndex(null); }}
                    className="font-sans text-[13px] font-medium bg-[#141413] text-[#FFFFFF] px-4 py-2 rounded-[12px] hover:bg-black transition-colors flex items-center gap-1.5"
                  >
                    <span>←</span> Bài mới
                  </button>
                )}
              </div>

              <div className="mb-6 shrink-0">
                <div className="border border-[#7e8c9a]/50 p-6 bg-[#F8FAFC]">
                  <p className="font-sans text-[15px] font-semibold italic text-[#2c3338] leading-[1.65] [text-wrap:pretty]">
                    {promptText}
                  </p>
                </div>
              </div>

              <div className="border-t border-black/8 pt-6 flex flex-col flex-1 min-h-0">
                            <p className="font-mono text-[9px] font-semibold tracking-[0.12em] uppercase text-black/35 mb-4">
                              {activeDimension === 'taskAchievement' ? 'Pyramid' : 'Feedback Details'}
                            </p>
                            {activeDimension === 'taskAchievement' ? (
                              state === 'result' ? (
                                <>
                                  <SimplePyramid
                                    macroAnswer={displayAnalysis.pyramid.macroAnswer}
                                    paragraphs={displayAnalysis.pyramid.paragraphs}
                                    activeParagraphIndex={activeParagraphIndex}
                                    onParagraphClick={setActiveParagraphIndex}
                                    onRequestFullscreen={() => setIsPyramidFullscreen(true)}
                                  />
                                  <AnimatePresence>
                                  {isPyramidFullscreen && (
                                    <motion.div 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="fixed inset-0 z-50"
                                    >
                                      <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="absolute inset-0 bg-black/20" 
                                      />
                                      <div className="absolute inset-8 md:inset-12 flex justify-center">
                                        <motion.div 
                                          initial={{ opacity: 0, scale: 0.96, y: 16 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.96, y: 16 }}
                                          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                          className="w-full h-full max-w-[1400px] bg-[#F8F7F4] rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-black/5 relative" style={{ fontFamily: 'inherit' }}
                                        >
                                          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white/80 backdrop-blur-sm shrink-0 relative z-10">
                                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">Sơ đồ lập luận — Fullscreen</span>
                                          <button
                                            onClick={() => setIsPyramidFullscreen(false)}
                                            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-black/40 hover:text-black/80 transition-colors"
                                          >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v4H3M21 8h-4V3M16 21v-4h4M3 16h4v4"/></svg>
                                            Esc
                                          </button>
                                        </div>
                                        <div className="flex-1 overflow-hidden relative">
                                          <SimplePyramid
                                            macroAnswer={displayAnalysis.pyramid.macroAnswer}
                                            paragraphs={displayAnalysis.pyramid.paragraphs}
                                            activeParagraphIndex={activeParagraphIndex}
                                            onParagraphClick={setActiveParagraphIndex}
                                            isFullscreen={true}
                                            onExitFullscreen={() => setIsPyramidFullscreen(false)}
                                          />
                                        </div>
                                      </motion.div>
                                    </div>
                                  </motion.div>
                                )}
                                </AnimatePresence>
                                </>
                              ) : (
                                <>
                                  <EditablePyramid
                                    pyramid={planPyramid}
                                    onChange={setPlanPyramid}
                                    activeParagraphIndex={activeParagraphIndex}
                                    onParagraphClick={setActiveParagraphIndex}
                                    onRequestFullscreen={() => setIsPyramidFullscreen(true)}
                                  />
                                  <AnimatePresence>
                                  {isPyramidFullscreen && (
                                    <motion.div 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="fixed inset-0 z-50"
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
                                          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                          className="w-full h-full max-w-[1400px] bg-[#F8F7F4] rounded-[24px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden border border-black/5 relative"
                                          style={{ fontFamily: 'inherit' }}
                                        >
                                          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white/80 backdrop-blur-sm shrink-0 relative z-10">
                                            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">Sơ đồ lập luận — Planning</span>
                                            <button
                                              onClick={() => setIsPyramidFullscreen(false)}
                                              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-black/40 hover:text-black/80 transition-colors"
                                            >
                                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v4H3M21 8h-4V3M16 21v-4h4M3 16h4v4"/></svg>
                                              Esc
                                            </button>
                                          </div>
                                          <div className="flex-1 overflow-hidden relative hide-scrollbar">
                                            <EditablePyramid
                                              pyramid={planPyramid}
                                              onChange={setPlanPyramid}
                                              activeParagraphIndex={activeParagraphIndex}
                                              onParagraphClick={setActiveParagraphIndex}
                                              isFullscreen={true}
                                            />
                                          </div>
                                        </motion.div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                </>
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center h-48 bg-black/[0.02] rounded-[16px] border border-black-[0.04] border-dashed">
                                <span className="text-[24px] mb-3 opacity-30">🛠️</span>
                                <p className="font-sans text-[13px] text-black/40">
                                  Detailed analysis for this dimension coming soon.
                                </p>
                              </div>
                            )}
                          </div>
            </div>
          </main>

          {/* RESIZER DRAG HANDLE */}
          <div
            onMouseDown={() => setIsDragging(true)}
            className="absolute top-0 bottom-0 w-6 -ml-3 cursor-col-resize flex justify-center items-center group z-20"
            style={{ left: `${leftWidth}%` }}
          >
            <div className={`w-[4px] h-12 rounded-[10px] transition-colors duration-150 ${isDragging ? 'bg-black/30' : 'bg-black/10 group-hover:bg-black/20'}`} />
          </div>

          {/* RIGHT: Reasoning Map */}
          <aside 
            style={{ width: `calc(${100 - leftWidth}% - 12px)`, marginLeft: '24px' }}
            className="shrink-0 bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)] p-6 overflow-hidden h-full flex flex-col"
          >
            <div className="shrink-0">
              <ScoreBar scores={displayAnalysis.scores} activeDimension={activeDimension} onSelect={setActiveDimension} />
            </div>

            <div className="border-t border-black/8 pt-6 flex flex-col flex-1 min-h-0">
              {state === 'idle' || state === 'analyzing' ? (
                <div className="flex flex-col gap-4 flex-grow min-h-0">

                  {/* Essay inputs by pyramid */}
                  <div className="flex flex-col flex-grow min-h-0">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <label className="block font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-black/50">
                        Bài làm của bạn
                      </label>
                      <WordCount text={essay} />
                    </div>
                    <div className="flex flex-col gap-5 overflow-y-auto pr-2 pb-4 hide-scrollbar">
                      {planPyramid.paragraphs.map((p) => (
                        <div key={p.index} className="flex flex-col gap-2">
                          <label className="block font-mono text-[9px] font-semibold tracking-[0.1em] uppercase text-[#857F70]">
                            {p.label}
                          </label>
                          <textarea
                            value={paragraphTexts[p.index] || ''}
                            onChange={(e) => setParagraphTexts(prev => ({ ...prev, [p.index]: e.target.value }))}
                            placeholder={`Viết phần ${p.label.toLowerCase()} của bạn...`}
                            className="w-full min-h-[140px] bg-white/60 border border-black/10 rounded-[12px] px-4 py-3 font-sans text-[14px] text-[#141413] placeholder:text-black/30 resize-y focus:outline-none focus:border-[#48CAE4] focus:ring-1 focus:ring-inset focus:ring-[#48CAE4] focus:bg-white transition-all duration-200 leading-relaxed shadow-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-[10px] px-4 py-3 shrink-0">
                      <p className="font-sans text-[13px] text-rose-700">{error}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 shrink-0 pt-2">
                    <button
                      onClick={handleSubmit}
                      disabled={state === 'analyzing' || !promptText.trim() || !essay.trim()}
                      className="bg-[#111] text-[#fff] font-sans text-[13px] font-semibold px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {state === 'analyzing' ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Đang phân tích...
                        </span>
                      ) : (
                        'Phân tích bài viết →'
                      )}
                    </button>

                    <button
                      onClick={() => {
                        const parts = DEMO_ESSAY.split('\n\n');
                        const newTexts: Record<string, string> = {};
                        planPyramid.paragraphs.forEach((p, i) => {
                          newTexts[p.index] = parts[i] || '';
                        });
                        setParagraphTexts(newTexts);
                        setAnalysis(DEMO_ANALYSIS);
                        setState('result');
                      }}
                      className="font-sans text-[13px] font-medium border border-[#E2E2E2] hover:border-[#111] text-[#111] px-5 py-2.5 rounded-[10px] transition-colors"
                    >
                      Tải bài mẫu
                    </button>
                  </div>
                </div>
              ) : (
                <EssayPanel 
                  essay={essay} 
                  analysis={analysis as WritingAnalysis} 
                  activeDimension={activeDimension} 
                  onHighlightClick={(index) => setActiveParagraphIndex(index)}
                />
              )}
            </div>
          </aside>




        </div>
      </div>

      {isMounted && typeof document !== 'undefined' ? createPortal(
        <>
          <button
            onClick={() => setTranslateOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-[10px] flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:scale-105 hover:bg-neutral-800 active:scale-95 transition-all z-[100]"
            aria-label="Translate phrase"
          >
            <Search className="w-5 h-5" />
          </button>

          <TranslateModal
            isOpen={translateOpen}
            onClose={() => setTranslateOpen(false)}
            essayContext={essay}
            storageKey={`translate-task1-${params.id}`}
          />
        </>,
        document.body
      ) : null}
    </div>
  );
}
