'use client';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Share2, Heart, Play, Pause, Search } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { getCoverUrl } from '@/lib/appwrite';
import { FastAverageColor } from 'fast-average-color';
import TopHeader from './TopHeader';
import DictionaryModal from './DictionaryModal';

const sourceConfig: Record<string, any> = {
  'economist': { color: 'bg-[#FFB760]', illustration: 'il-review.svg', name: 'The Economist' },
  'new-yorker': { color: 'bg-[#62DAB1]', illustration: 'il-announce.svg', name: 'The New Yorker' },
  'atlantic': { color: 'bg-[#FFE17B]', illustration: 'il-knowledge.svg', name: 'The Atlantic' },
  'national-geographic': { color: 'bg-[#82D8F2]', illustration: 'il-submit.svg', name: 'National Geographic' }
};

function getSourceConfig(authorOrSource: string) {
  const s = (authorOrSource || '').toLowerCase();
  if (s.includes('economist')) return sourceConfig['economist'];
  if (s.includes('new yorker')) return sourceConfig['new-yorker'];
  if (s.includes('atlantic')) return sourceConfig['atlantic'];
  if (s.includes('national geographic')) return sourceConfig['national-geographic'];
  return null;
}


interface Article {
  $id: string;
  title: string;
  slug?: string;
  description?: string;
  excerpt?: string;
  author?: string;
  body?: string;
  source?: string;
  reading_time?: number;
  readMinutes?: number;
  status?: string;
  published_at?: string;
  cover_image_id?: string;
  original_url?: string;
}

function CustomAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (audioRef.current?.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  return (
    <div className="w-full flex items-center gap-6 border-y border-black/10 py-5 mb-12 bg-transparent">
      <button 
        onClick={toggle} 
        className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#141413] text-white hover:bg-black transition-colors rounded-none"
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
      </button>
      <div className="flex-1 flex flex-col justify-center gap-3">
        <div className="flex justify-between items-center text-[11px] font-sans uppercase tracking-[0.15em] font-bold text-[#141413]">
          <span>{isPlaying ? 'Playing Audio Edition' : 'Listen to Article'}</span>
          <span className="font-serif lowercase italic text-black/50 tracking-normal font-normal">ai narrated</span>
        </div>
        <div className="w-full h-[2px] bg-black/5 relative cursor-pointer" onClick={(e) => {
          if (!audioRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percent = clickX / rect.width;
          audioRef.current.currentTime = percent * audioRef.current.duration;
        }}>
          <div className="absolute top-0 left-0 h-full bg-[#141413] transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}



// ─── Component ────────────────────────────────────────────────────────────────
const PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1486707471592-8e7eb7e36f78?w=1440&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1440&q=80',
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1440&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1440&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1440&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1440&q=80',
];

export default function ArticlePageClient({ article, coverUrl, related = [] }: {
  article: Article;
  coverUrl: string | null;
  related: Article[];
}) {
  const router = useRouter();
  const readMins = article.reading_time ?? article.readMinutes ?? 5;
  const placeholderIdx = article.$id ? article.$id.charCodeAt(2) % PLACEHOLDERS.length : 0;
  const finalCoverUrl = coverUrl ?? PLACEHOLDERS[placeholderIdx];

  const [mounted, setMounted] = useState(false);
  const articleBodyRef = useRef<HTMLDivElement | null>(null);

  const [dictOpen, setDictOpen] = useState(false);

  // ─── Reading Modes State ────────────────────────────────────────────────────
  const [readingMode, setReadingMode] = useState<'paged' | 'full'>('full');
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Process the HTML to extract the audio and remove junk before rendering
  const processedBody = useMemo(() => {
    let html = article.body ?? '';
    
    // Nuke the native audio tags completely
    html = html.replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '');
    html = html.replace(/<figure\b[^>]*>\s*<audio\b[^>]*>[\s\S]*?<\/audio>\s*<\/figure>/gi, '');

    // Safely remove any <p> containing specific meta phrases
    html = html.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?min read(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');

    // Erase exact junk phrases wherever they appear, to handle div/span wrappers without breaking HTML nesting
    const junkPhrases = [
      'Listen to this story',
      'AI Narrated',
      'The Economist Today',
      'Handpicked stories, in your inbox',
      'A daily newsletter with the best of our journalism'
    ];
    junkPhrases.forEach(phrase => {
      html = html.replace(new RegExp(phrase, 'gi'), '');
    });

    // Remove the clock image at the end
    html = html.replace(/<img[^>]*src="[^"]*the-economist-today[^"]*"[^>]*>/gi, '');

    // Garbage collect empty tags (run 3 times to clear nested empties like <p><span></span></p>)
    const emptyTagRegex = /<(p|div|span|h[1-6])[^>]*>\s*(?:<br\s*\/?>\s*|&nbsp;|\|)*<\/\1>/gi;
    html = html.replace(emptyTagRegex, '');
    html = html.replace(emptyTagRegex, '');
    html = html.replace(emptyTagRegex, '');

    // Inject the drop-cap class into the absolute first remaining text paragraph
    let dropCapAdded = false;
    html = html.replace(/<p\b([^>]*)>/i, (match, p1) => {
      if (dropCapAdded) return match;
      dropCapAdded = true;
      if (p1.includes('class="')) {
        return `<p${p1.replace('class="', 'class="drop-cap ')}>`;
      } else if (p1.includes("class='")) {
        return `<p${p1.replace("class='", "class='drop-cap ")}>`;
      } else {
        return `<p${p1} class="drop-cap">`;
      }
    });

    // Add referrerPolicy to all images to bypass hotlinking protection
    html = html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (attrs.includes('referrerpolicy=')) return match;
      return `<img referrerpolicy="no-referrer" ${attrs}>`;
    });

    return html;
  }, [article.body]);

  // Chunk the processed body into pages for 'paged' mode (client-side only)
  const pagedChunks = useMemo(() => {
    if (!mounted || typeof window === 'undefined') return [processedBody];
    
    // Split the HTML string roughly by block-level closing tags to bypass DOM nesting issues
    const parts = processedBody.split(/(<\/(?:p|figure|blockquote|h2|h3)>)/i);
    const chunks: string[] = [];
    let currentChunk = '';
    let blockCount = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part.trim() && i === parts.length - 1) continue;
      
      currentChunk += part;
      
      if (/<\/(?:p|figure|blockquote|h2|h3)>/i.test(part)) {
        blockCount++;
        if (blockCount >= 3) {
          chunks.push(currentChunk);
          currentChunk = '';
          blockCount = 0;
        }
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }
    
    return chunks.length > 0 ? chunks : [processedBody];
  }, [processedBody, mounted]);





  return (
    <main className="flex-1 bg-[#FFFFFF] min-h-screen">
      <TopHeader user={null} />
      
      {/* ── Hero Section ── */}
      <div className="relative pt-12 pb-12 px-6 bg-transparent">
        <div className="max-w-[700px] mx-auto relative z-10 flex flex-col pt-8">
          
          <button onClick={() => router.back()} className="inline-flex items-center text-[13px] font-sans font-semibold text-black/60 hover:text-black mb-12 transition-colors">
            <span className="mr-2">←</span> Tất cả tạp chí
          </button>

          {/* Title */}
          <h1 className="text-[36px] md:text-[48px] leading-[1.1] font-sans font-semibold tracking-tight text-[#111] max-w-[900px] mb-6">
            {article.title}
          </h1>

          {/* Subtitle / Excerpt */}
          {(article.excerpt || article.description) && (
            <p className="text-[15px] font-sans text-black/60 max-w-[600px] leading-relaxed mb-8">
              {article.excerpt || article.description}
            </p>
          )}

          {/* Author & Date */}
          <div className="flex items-center gap-4 mt-2">
            {getSourceConfig(article.author || '') && (
              <div className={`w-10 h-10 rounded-[10px] ${getSourceConfig(article.author || '')!.color} flex items-center justify-center shrink-0 shadow-sm`}>
                <img src={`/images/illustrations/${getSourceConfig(article.author || '')!.illustration}`} className="w-5 h-5 object-contain" alt="" />
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#857F70]">
              <span className="font-semibold text-[#141413]/70">BY {article.author ?? 'THE EDITORS'}</span>
              <span className="opacity-50">•</span>
              <span>{readMins} MIN READ</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Main Image ── */}
      {!(article.original_url?.includes('/interactive/graphic-detail') || article.title.toLowerCase().includes('working woman') || article.title.toLowerCase().includes('glass-ceiling')) && (
        <div className="max-w-[700px] mx-auto px-6 relative z-20 mb-16">
          <ImageWithFallback
            src={finalCoverUrl}
            alt={article.title}
            className="w-full h-auto max-h-[60vh] object-cover rounded-[16px] shadow-sm"
            hideOnError
          />
        </div>
      )}

      {/* ── Article Layout (Content) ── */}
      <div className="max-w-[700px] mx-auto px-6 pb-24">
        
        {/* Right Column: Article Body */}
        <div className="w-full">
          {/* Reading Mode Switcher Tab */}
          <div className="flex flex-col gap-6 mb-8 border-b border-black/10 pb-4">
            <div className="grid grid-cols-2 w-full">
              <button 
                onClick={() => { setReadingMode('paged'); setCurrentPage(0); }}
                className={`text-[11px] font-sans font-bold uppercase tracking-[0.15em] pb-4 -mb-[17px] border-b-2 text-center transition-colors ${readingMode === 'paged' ? 'border-black text-black' : 'border-transparent text-black/40 hover:text-black/70'}`}
              >
                Paged
              </button>
              <button 
                onClick={() => { setReadingMode('full'); setCurrentPage(0); }}
                className={`text-[11px] font-sans font-bold uppercase tracking-[0.15em] pb-4 -mb-[17px] border-b-2 text-center transition-colors ${readingMode === 'full' ? 'border-black text-black' : 'border-transparent text-black/40 hover:text-black/70'}`}
              >
                Full Read
              </button>
            </div>
          </div>

          {(() => {
            const audioMatch = (article.body ?? '').match(/<audio[^>]*src=["']([^"']+)["']/i) || (article.body ?? '').match(/<source[^>]*src=["']([^"']+)["']/i);
            const audioSrc = audioMatch ? audioMatch[1] : null;
            return audioSrc ? <CustomAudioPlayer src={audioSrc} /> : null;
          })()}

          <div
            data-article-body
            ref={articleBodyRef}
            className="prose prose-neutral font-serif prose-p:font-serif prose-headings:font-heading max-w-none text-[18px] leading-[1.8] text-[#141413] editorial-prose relative"
            suppressHydrationWarning
          >
            <AnimatePresence mode="wait">
              {readingMode === 'paged' && (
                <motion.div
                  key={`mode-paged-${currentPage}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex flex-col min-h-[50vh]"
                >
                  <div className="flex-1" dangerouslySetInnerHTML={{ __html: pagedChunks[currentPage] }} />
                  
                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between mt-12 pt-6 border-t border-neutral-200">
                    <button 
                      onClick={() => {
                        setCurrentPage(p => Math.max(0, p - 1));
                        if (articleBodyRef.current) {
                          const top = articleBodyRef.current.getBoundingClientRect().top + window.scrollY - 120;
                          window.scrollTo({ top, behavior: 'smooth' });
                        }
                      }}
                      disabled={currentPage === 0}
                      className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#111] disabled:opacity-30 transition-opacity hover:opacity-70"
                    >
                      ← Previous
                    </button>
                    <span className="text-[10px] font-sans text-neutral-400 tracking-widest uppercase">
                      Page {currentPage + 1} of {pagedChunks.length}
                    </span>
                    <button 
                      onClick={() => {
                        setCurrentPage(p => Math.min(pagedChunks.length - 1, p + 1));
                        if (articleBodyRef.current) {
                          const top = articleBodyRef.current.getBoundingClientRect().top + window.scrollY - 120;
                          window.scrollTo({ top, behavior: 'smooth' });
                        }
                      }}
                      disabled={currentPage === pagedChunks.length - 1}
                      className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#111] disabled:opacity-30 transition-opacity hover:opacity-70"
                    >
                      Next →
                    </button>
                  </div>
                </motion.div>
              )}

              {readingMode === 'full' && (
                <motion.div
                  key="mode-full"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  dangerouslySetInnerHTML={{ __html: processedBody }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Related Articles (Desktop + Mobile) */}
          {related.length > 0 && (
            <div className="mt-16 pt-16 border-t border-black/10">
              <h3 className="text-[14px] font-sans font-bold uppercase tracking-widest text-neutral-900 mb-8 flex items-center gap-4">
                More like this <span className="flex-1 h-px bg-black/10 block" />
              </h3>
              <div className="flex flex-col gap-6">
                {related.map((r) => {
                  return (
                    <button
                      key={r.$id}
                      onClick={() => router.push(`/articles/${r.slug ?? r.$id}`)}
                      className="group flex gap-6 text-left items-start transition-shadow bg-white p-6 rounded-[16px] border border-black/10 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 pt-1 flex-1">
                        <h4 className="text-[18px] sm:text-[20px] font-sans font-semibold leading-snug text-neutral-900 group-hover:text-black/70 transition-colors">
                          {r.title}
                        </h4>
                        <div className="text-[11px] text-neutral-600 mt-auto">
                          <span className="font-sans uppercase tracking-widest font-medium">
                            {r.author ?? 'THE EDITORS'}
                          </span>
                        </div>
                      </div>
                      <ImageWithFallback
                        src={r.cover_image_id ? getCoverUrl(r.cover_image_id, 400) : `https://images.unsplash.com/photo-1548679847-1d4ff48016c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200&q=80`}
                        alt={r.title}
                        className="w-24 h-24 sm:w-28 sm:h-28 object-cover flex-shrink-0 bg-neutral-100 rounded-[8px]"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comment section removed */}        </div>
      </div>

      {mounted && typeof document !== 'undefined' ? createPortal(
        <>
          <button
            onClick={() => setDictOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:scale-105 hover:bg-neutral-800 active:scale-95 transition-all z-[100]"
            aria-label="Look up word"
          >
            <Search className="w-5 h-5" />
          </button>

          <DictionaryModal
            isOpen={dictOpen}
            onClose={() => setDictOpen(false)}
            articleId={article.$id}
            articleTitle={article.title}
          />
        </>,
        document.body
      ) : null}
    </main>
  );
}
