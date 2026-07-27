'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Link from 'next/link';
import TopHeader from '@/components/TopHeader';
import TranslateModal from '@/components/writing/TranslateModal';
import ScoreBar, { DimensionKey } from '@/components/writing/ScoreBar';
import EditableArgumentGraph from '@/components/writing/EditableArgumentGraph';
import WritingReviewWorkbench from '@/components/writing/WritingReviewWorkbench';
import { WritingAnalysis } from '@/types/writing';
import { useParams } from 'next/navigation';
import { getPromptById } from '@/lib/prompts';
import { EMPTY_ANALYSIS } from '@/lib/writing-demo';
import { motion, AnimatePresence } from 'motion/react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

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
  const [promptText, setPromptText] = useState(promptData?.text || '');

  const [state, setState] = useState<PageState>('idle');
  const [paragraphTexts, setParagraphTexts] = useState<Record<string, string>>({});
  const [resultEssay, setResultEssay] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<WritingAnalysis | null>(null);
  const [planPyramid, setPlanPyramid] = useState(EMPTY_ANALYSIS.pyramid);
  const [error, setError] = useState<string | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('taskAchievement');
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const hasLoadedDraft = useRef(false);

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(mountedTimer);
  }, []);

  useEffect(() => {
    if (state !== 'result') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [state]);

  useEffect(() => {
    const loadTimer = window.setTimeout(async () => {
      try {
        const cacheKey = `rnw-draft-task2-${params.id}`;
        const response = await authenticatedFetch(`/api/writing/assessments/${params.id}`);
        if (response.ok) {
          const { assessment } = await response.json();
          const persistedAnalysis = assessment.analysis as WritingAnalysis;
          const persistedEssay = assessment.essay as string;
          const hydratedParagraphs = Object.fromEntries(
            persistedAnalysis.pyramid.paragraphs.map((paragraph) => [
              paragraph.index,
              persistedEssay.slice(paragraph.paragraphStartChar, paragraph.paragraphEndChar),
            ]),
          );

          setParagraphTexts(hydratedParagraphs);
          setResultEssay(persistedEssay);
          setPlanPyramid(persistedAnalysis.pyramid);
          setPromptText(assessment.prompt as string);
          setAnalysis(persistedAnalysis);
          setState('result');
          return;
        }

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.prompt === promptData?.text) {
            if (parsed.paragraphTexts) setParagraphTexts(parsed.paragraphTexts);
            if (parsed.planPyramid) setPlanPyramid(parsed.planPyramid);
            if (parsed.state) setState(parsed.state);
            if (parsed.analysis) setAnalysis(parsed.analysis);
            if (typeof parsed.resultEssay === 'string') setResultEssay(parsed.resultEssay);
          }
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      } finally {
        hasLoadedDraft.current = true;
      }
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [params.id, promptData?.text]);

  useEffect(() => {
    if (!hasLoadedDraft.current) return;
    try {
      const cacheKey = `rnw-draft-task2-${params.id}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        prompt: promptText,
        paragraphTexts,
        planPyramid,
        state,
        analysis,
        resultEssay,
      }));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }, [paragraphTexts, planPyramid, state, analysis, resultEssay, params.id, promptText]);

  // Paragraphs are joined with a blank line and the assessment manifest splits on
  // exactly that, so a blank line typed inside one planner paragraph would become
  // two paragraphs downstream and shift every later paragraph index — which is
  // what every piece of evidence in the review is anchored to. Collapse them.
  const draftEssay = planPyramid.paragraphs
    .map(p => (paragraphTexts[p.index] || '').replace(/\n\s*\n+/g, '\n').trim())
    .filter(text => text.length > 0)
    .join('\n\n');
  const essay = state === 'result' && resultEssay !== null ? resultEssay : draftEssay;

  const [leftWidth, setLeftWidth] = useState(65);
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
      const res = await authenticatedFetch('/api/writing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: params.id,
          prompt: promptText,
          essay,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
      setResultEssay(essay);
      setState('result');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setState('idle');
    }
  };

  const displayAnalysis = state === 'result' && analysis ? analysis : EMPTY_ANALYSIS;

  return (
    <div
      className={`${state === 'result' ? 'overflow-auto' : 'overflow-hidden'} flex flex-col text-[#141413] antialiased transition-colors duration-500 ${state === 'result' ? 'bg-[#F8F9FA]' : 'bg-[#FFFFFF]'}`}
      style={{
        height: 'calc(100vh / 1.1)',
      }}
    >
      <TopHeader user={null} />

      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 flex-1 min-h-0">
        <div
          ref={resultContainerRef}
          className={`h-full flex relative min-h-0 ${state === 'result' ? 'min-w-[960px] w-full' : 'w-full'}`}
        >
          {state === 'result' ? (
            <WritingReviewWorkbench
              prompt={promptText}
              essay={essay}
              analysis={displayAnalysis}
              onRequestComparison={async () => {
                const response = await authenticatedFetch(`/api/writing/assessments/${params.id}/comparison`, {
                  method: 'POST',
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || 'Comparison failed');
                setAnalysis(payload.analysis);
              }}
              onStartNew={() => { setState('idle'); setAnalysis(null); setResultEssay(null); setActiveParagraphIndex(null); }}
            />
          ) : (
            <>

          {/* LEFT: Essay + Tabs / Input Form */}
                    <main 
            style={{ width: `calc(${leftWidth}% - 12px)` }}
            className="shrink-0 bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03),0_0_0_1px_rgba(0,0,0,0.04)] p-6 md:p-8 hide-scrollbar h-full flex flex-col overflow-hidden"
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
                    onClick={() => { setState('idle'); setAnalysis(null); setResultEssay(null); setActiveParagraphIndex(null); }}
                    className="font-sans text-[13px] font-medium text-[#857F70] px-1 py-2 rounded-[8px] hover:text-[#141413] transition-colors flex items-center gap-1.5"
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
                              {activeDimension === 'taskAchievement' ? 'Planning' : 'Feedback Details'}
                            </p>
                            {activeDimension === 'taskAchievement' ? (
                                <>
                                  <EditableArgumentGraph
                                    graph={planPyramid}
                                    onChange={setPlanPyramid}
                                    activeParagraphIndex={activeParagraphIndex}
                                    onParagraphClick={setActiveParagraphIndex}
                                    onRequestFullscreen={() => setIsGraphFullscreen(true)}
                                  />
                                  <AnimatePresence>
                                  {isGraphFullscreen && (
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
                                          className="w-full h-full max-w-[1400px] bg-[#F2F2F2] rounded-[24px] shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden border border-black/[0.06] relative"
                                          style={{ fontFamily: 'inherit' }}
                                        >
                                          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white/80 backdrop-blur-sm shrink-0 relative z-10">
                                            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">Argument outline — Planning</span>
                                            <button
                                              onClick={() => setIsGraphFullscreen(false)}
                                              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-black/40 hover:text-black/80 transition-colors"
                                            >
                                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v4H3M21 8h-4V3M16 21v-4h4M3 16h4v4"/></svg>
                                              Esc
                                            </button>
                                          </div>
                                          <div className="flex-1 overflow-hidden relative hide-scrollbar">
                                            <EditableArgumentGraph
                                              graph={planPyramid}
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
                            ) : (
                              <div className="flex flex-col items-center justify-center h-48 bg-black/[0.02] rounded-[16px] border border-black-[0.04] border-dashed">
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

          {/* RIGHT: Essay input */}
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

                  {/* Essay inputs by paragraph */}
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

                  </div>
                </div>
              ) : null}
            </div>
          </aside>




            </>
          )}
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
            storageKey={`translate-task2-${params.id}`}
          />
        </>,
        document.body
      ) : null}
    </div>
  );
}
