'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { getCoverUrl } from '@/lib/appwrite';
import Link from 'next/link';

// Brand-specific accent text colors with distinctly premium editorial backgrounds
function getBrandTheme(source: string, index: number) {
  const s = (source || '').toLowerCase();
  
  if (s.includes('economist')) {
    // Economist: Bright Red text on a distinctly warm sand/newsprint background
    return { bg: '#F2EBE3', text: '#111111', accent: '#111' }; 
  }
  if (s.includes('new yorker')) {
    // New Yorker: Deep black accent on a deeper, tactile parchment tone
    return { bg: '#EAE3D5', text: '#1a1d1f', accent: '#111111' }; 
  }
  if (s.includes('new scientist')) {
    // New Scientist: Vibrant Blue accent on a very soft, cool ice-grey
    return { bg: '#E6ECEF', text: '#111111', accent: '#00315C' }; 
  }
  
  // Fallback themes for unknown sources
  const FALLBACKS = [
    { bg: '#F2EBE3', text: '#111111', accent: '#111' },
    { bg: '#EAE3D5', text: '#1a1d1f', accent: '#3a5a78' },
    { bg: '#E6ECEF', text: '#111111', accent: '#8f3e3e' },
  ];
  return FALLBACKS[index % FALLBACKS.length];
}

const PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1486707471592-8e7eb7e36f78?w=800&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
];

interface Article {
  $id: string;
  title: string;
  slug?: string;
  cover_image_id?: string;
  excerpt?: string;
  description?: string;
  author?: string;
  source?: string;
  reading_time?: number;
}

function StoryText({ textChunks, theme, href }: { textChunks: string[], theme: any, href: string }) {
  const [activeChunk, setActiveChunk] = useState(0);

  if (!textChunks || textChunks.length === 0) return null;

  if (textChunks.length === 1) {
    const dropCap = textChunks[0].charAt(0);
    const remaining = textChunks[0].slice(1);
    return (
      <div className="font-serif text-[18px] lg:text-[20px] leading-[1.8]">
        <span className="float-left text-[76px] leading-[0.75] font-heading pr-2 pt-2 transition-colors duration-500" style={{ color: theme.text }}>
          {dropCap}
        </span>
        <span className="opacity-95">{remaining}</span>
        <Link href={href} className="inline-block ml-2 text-[15px] font-serif italic hover:underline transition-colors duration-500" style={{ color: theme.accent }}>
          Continue reading &raquo;
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {/* Story Progress Bars */}
      <div className="flex gap-1.5 mb-6">
        {textChunks.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden relative">
            {/* Background track */}
            <div className="absolute inset-0" style={{ backgroundColor: theme.text, opacity: 0.15 }} />
            {/* Animated fill */}
            <motion.div 
              key={`${i}-${i < activeChunk ? 'done' : i === activeChunk ? 'active' : 'wait'}`}
              className="absolute top-0 left-0 bottom-0"
              style={{ backgroundColor: theme.text }}
              initial={{ width: i < activeChunk ? "100%" : "0%" }}
              animate={{ width: i === activeChunk ? "100%" : (i < activeChunk ? "100%" : "0%") }}
              transition={{ duration: i === activeChunk ? 7 : 0, ease: "linear" }}
              onAnimationComplete={() => {
                if (i === activeChunk && activeChunk < textChunks.length - 1) {
                  setActiveChunk(a => a + 1);
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="relative min-h-[220px]">
        {/* Invisible Click Targets */}
        <div className="absolute inset-0 z-20 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={() => setActiveChunk(prev => Math.max(0, prev - 1))} />
          <div className="w-2/3 h-full cursor-pointer" onClick={() => setActiveChunk(prev => Math.min(textChunks.length - 1, prev + 1))} />
        </div>

        {/* Text Display */}
        <AnimatePresence>
          <motion.div
            key={activeChunk}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 font-serif text-[18px] lg:text-[20px] leading-[1.8]"
          >
            {activeChunk === 0 ? (
              <>
                <span className="float-left text-[76px] leading-[0.75] font-heading pr-2 pt-2 transition-colors duration-500" style={{ color: theme.text }}>
                  {textChunks[activeChunk].charAt(0)}
                </span>
                <span className="opacity-95 pointer-events-none">{textChunks[activeChunk].slice(1)}</span>
              </>
            ) : (
              <span className="opacity-95 pointer-events-none">{textChunks[activeChunk]}</span>
            )}
            
            {activeChunk === textChunks.length - 1 && (
              <Link href={href} className="inline-block ml-2 text-[15px] font-serif italic hover:underline relative z-30 pointer-events-auto" style={{ color: theme.accent }}>
                Continue reading &raquo;
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function QuoteStack({ articles }: { articles: Article[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  if (!articles || articles.length === 0) return null;

  const currentIdx = index % articles.length;
  const current = articles[currentIdx];
  const theme = getBrandTheme(current.source || '', currentIdx);
  
  const navigateTo = (dir: 'prev' | 'next') => {
    setDirection(dir === 'prev' ? -1 : 1);
    setIndex((i) =>
      dir === 'prev' ? (i - 1 + articles.length) % articles.length : (i + 1) % articles.length
    );
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
  };

  const coverId = (current as any).coverImageId || current.cover_image_id;
  const slideImgSrc = coverId ? getCoverUrl(coverId, 800) : PLACEHOLDERS[currentIdx % PLACEHOLDERS.length];
  
  // Dynamic text chunking for the story carousel
  const rawText = (current as any).summary || current.excerpt || current.description || 'No excerpt available for this article. Read the full piece inside to explore the ideas and insights.';
  
  let aiSummaryChunks: string[] = [];
  
  // Mock long AI summary for the first article to demonstrate the carousel
  if (currentIdx === 0 && !(current as any).summary) {
    aiSummaryChunks = [
      "Clifton Crais’s “The Killing Age” claims that Western violence—slavery, conquest and arms-dealing—created the modern world. Drawing on the diaries of Thomas Thistlewood, an 18th-century Jamaican planter who meticulously recorded whippings, rapes and grotesque punishments, Crais argues that profits from globalised brutality financed the Industrial Revolution and that “killing has been the West’s most profound contribution to history.”",
      "The reviewer finds the thesis overstated. Brutality was hardly invented after 1780, and evidence from Steven Pinker and others shows violence has fallen sharply over centuries. What changed was not man’s inhumanity but an explosion of ideas—power looms, steam engines, printing—that turned knowledge cumulative and cheap.",
      "Colonial plunder mattered less than sheep farming to Britain’s economy, and nations with few colonies industrialised just as fast. Crais’s 700-page catalogue of horrors is vivid, yet his central claim remains unconvincing: the modern world was built by inventors, not killers."
    ];
  } else {
    // Dynamically split any text into ~160 character chunks for other articles
    const sentences = rawText.match(/[^.!?]+[.!?]+/g) || [rawText];
    let currentChunk = "";
    for (const sentence of sentences) {
      if ((currentChunk.length + sentence.length) > 160 && currentChunk.length > 0) {
        aiSummaryChunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence.trim();
      }
    }
    if (currentChunk.trim()) {
      aiSummaryChunks.push(currentChunk.trim());
    }
  }

  return (
    <div className="w-full relative overflow-hidden border-b border-neutral-200 min-h-screen flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: theme.bg, color: theme.text }}>
      
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={current.$id || currentIdx}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full flex items-center justify-center p-6 pt-[120px] pb-24 overflow-y-auto"
        >
          <div className="max-w-[1100px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Left Column: Title & Image */}
            <div className="flex flex-col gap-6 items-center text-center">
              <div className="flex flex-col items-center gap-3">
                <span 
                  className="text-[11px] font-sans font-bold tracking-[0.2em] uppercase transition-colors duration-500"
                  style={{ color: theme.accent }}
                >
                  {current.source || 'Featured'}
                </span>
                <h2 className="text-[44px] lg:text-[56px] font-heading not-italic leading-[1.05] tracking-tight max-w-[480px]">
                  &ldquo;{current.title}&rdquo;
                </h2>
              </div>
              
              <div className="w-full max-w-[400px] relative mt-2">
                <ImageWithFallback 
                  src={slideImgSrc} 
                  alt={current.title} 
                  className="w-full h-auto object-cover border border-neutral-200"
                />
              </div>
              
              <div className="text-[11px] font-sans uppercase tracking-[0.15em] mt-3 opacity-60">
                By {current.author || 'The Editors'}
              </div>
            </div>

            {/* Right Column: AI Summary Story Carousel */}
            <div className="flex flex-col justify-center h-full pt-8 lg:pt-0 max-w-[480px] mx-auto lg:mx-0 w-full">
              <div className="text-[14px] font-serif mb-4" style={{ color: theme.accent }}>
                Quick Read
              </div>
              <StoryText 
                textChunks={aiSummaryChunks} 
                theme={theme} 
                href={`/articles/${current.slug || current.$id}`} 
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      <div className="absolute top-1/2 -translate-y-1/2 left-2 lg:left-6 z-20">
        <button
          onClick={() => navigateTo('prev')}
          className="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-black/5 transition-colors bg-white/50 backdrop-blur"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-2 lg:right-6 z-20">
        <button
          onClick={() => navigateTo('next')}
          className="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-black/5 transition-colors bg-white/50 backdrop-blur"
          style={{ color: theme.text }}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
