'use client';
// src/components/CardReader.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const CARD_SHADOW_LG = 'shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]';
const CARD_SHADOW = 'shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]';

function parseChunks(html: string): string[] {
  const raw = html
    .split(/(?=<p[\s>])|(?=<h[23456][\s>])|(?=<blockquote[\s>])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  let wordCount = 0;
  const TARGET = 220;

  for (const block of raw) {
    const words = block.replace(/<[^>]+>/g, '').split(/\s+/).length;
    if (current && wordCount + words > TARGET) {
      chunks.push(current.trim());
      current = block;
      wordCount = words;
    } else {
      current += (current ? '\n' : '') + block;
      wordCount += words;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export default function CardReader({ html }: { html: string }) {
  const [chunks] = useState<string[]>(() => parseChunks(html));
  const [current, setCurrent] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const total = chunks.length;

  const navigate = useCallback((dir: 'left' | 'right') => {
    if (isAnimating) return;
    if (dir === 'right' && current >= total - 1) return;
    if (dir === 'left' && current <= 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrent((i) => dir === 'right' ? i + 1 : i - 1);
      setTimeout(() => setIsAnimating(false), 60);
    }, 200);
  }, [isAnimating, current, total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') navigate('right');
      if (e.key === 'ArrowLeft') navigate('left');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    navigate(dx < 0 ? 'right' : 'left');
  }

  const progressPct = total > 1 ? ((current + 1) / total) * 100 : 100;

  if (showFull) {
    return (
      <div className="mb-8">
        <div
          className="prose prose-neutral max-w-none text-[16px] leading-[1.7] text-neutral-700"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-6 text-center">
          <button
            onClick={() => { setShowFull(false); setCurrent(0); }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[13px] text-neutral-700 ${CARD_SHADOW}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to card reader
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Stack stage */}
      <div
        className="relative w-full"
        style={{ height: 340 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-label={`Article card ${current + 1} of ${total}`}
      >
        {/* Ghost cards (peeking behind) */}
        {current + 2 < total && (
          <div className={`absolute inset-0 bg-white rounded-2xl ${CARD_SHADOW}`}
            style={{ transform: 'rotate(-1.5deg) translateY(8px) scale(0.97)', zIndex: 1 }} />
        )}
        {current + 1 < total && (
          <div className={`absolute inset-0 bg-white rounded-2xl ${CARD_SHADOW}`}
            style={{ transform: 'rotate(1deg) translateY(4px) scale(0.985)', zIndex: 2 }} />
        )}
        {/* Front card */}
        <div
          key={current}
          className={`absolute inset-0 bg-white rounded-2xl px-8 py-7 overflow-y-auto ${CARD_SHADOW_LG}`}
          style={{ zIndex: 3, transition: 'opacity 0.2s' }}
        >
          <div
            className="prose prose-neutral max-w-none text-[15px] leading-[1.7] text-neutral-700"
            dangerouslySetInnerHTML={{ __html: chunks[current] ?? '' }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-5 gap-4">
        <button
          onClick={() => navigate('left')}
          disabled={current === 0 || isAnimating}
          className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-30 ${CARD_SHADOW}`}
          aria-label="Previous card"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-[12px] text-neutral-400">{current + 1} / {total}</span>
          <div className="w-full h-1.5 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3b82f6] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => navigate('right')}
          disabled={current >= total - 1 || isAnimating}
          className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-30 ${CARD_SHADOW}`}
          aria-label="Next card"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() => setShowFull(true)}
          className="text-[12px] text-neutral-400 hover:text-neutral-700"
        >
          Read as full article ↓
        </button>
      </div>
    </div>
  );
}
