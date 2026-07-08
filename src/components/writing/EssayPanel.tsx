'use client';

import { useState, useCallback, useRef } from 'react';
import { WritingAnalysis, EssayHighlight, ArgumentHighlight, ParagraphMoveNode, SentenceAnnotation } from '@/types/writing';

import { BandScores } from '@/types/writing';
import { DimensionKey } from './ScoreBar';

const DIMENSION_HIGHLIGHT_STYLES: Record<DimensionKey, string> = {
  taskAchievement: 'bg-amber-200/60 box-decoration-clone px-1 rounded-[4px] cursor-pointer hover:bg-amber-300/60 transition-colors',
  coherenceCohesion: 'bg-indigo-200/60 box-decoration-clone px-1 rounded-[4px] cursor-pointer hover:bg-indigo-300/60 transition-colors',
  lexicalResource: 'bg-emerald-200/60 box-decoration-clone px-1 rounded-[4px] cursor-pointer hover:bg-emerald-300/60 transition-colors',
  grammaticalRange: 'bg-rose-200/60 box-decoration-clone px-1 rounded-[4px] cursor-pointer hover:bg-rose-300/60 transition-colors',
};

function buildArgumentHighlights(paragraphs: ParagraphMoveNode[]): ArgumentHighlight[] {
  const highlights: ArgumentHighlight[] = [];
  for (const para of paragraphs) {
    for (const sentence of para.sentences) {
      for (const error of sentence.errors) {
        highlights.push({
          startChar: sentence.startChar,
          endChar: sentence.endChar,
          highlightType: error.type === 'relational'
            ? `relational_${error.direction || 'vertical'}`
            : 'internal',
          label: `S${sentence.index} · ${sentence.role}`,
          feedback: error.message,
          paragraphIndex: para.index,
          sentenceIndex: sentence.index,
          sentenceRole: sentence.role,
          simplifiedIdea: sentence.simplifiedIdea,
          paragraphLabel: para.label,
          paragraphJob: para.job,
          error,
        });
      }
    }
  }
  return highlights;
}

function buildCoherenceHighlights(paragraphs: ParagraphMoveNode[]): EssayHighlight[] {
  const highlights: EssayHighlight[] = [];
  for (const para of paragraphs) {
    for (const error of para.errors) {
      highlights.push({
        startChar: para.paragraphStartChar,
        endChar: para.paragraphEndChar,
        highlightType: 'coherence_error',
        label: para.label,
        feedback: error.message,
        paragraphIndex: para.index,
      });
    }
  }
  return highlights;
}

interface Span {
  text: string;
  highlights: (EssayHighlight | ArgumentHighlight)[];
  startChar: number;
}

function splitEssayIntoSpans(
  essay: string,
  highlights: (EssayHighlight | ArgumentHighlight)[]
): Span[] {
  if (!highlights.length) return [{ text: essay, highlights: [], startChar: 0 }];

  // Build breakpoints
  const points = new Set<number>([0, essay.length]);
  for (const h of highlights) {
    points.add(Math.max(0, h.startChar));
    points.add(Math.min(essay.length, h.endChar));
  }

  const sorted = Array.from(points).sort((a, b) => a - b);
  const spans: Span[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const text = essay.slice(start, end);
    const activeHighlights = highlights.filter(
      (h) => h.startChar <= start && h.endChar >= end
    );
    spans.push({ text, highlights: activeHighlights, startChar: start });
  }

  return spans;
}

export default function EssayPanel({
  essay,
  analysis,
  activeDimension,
  onHighlightClick,
}: {
  essay: string;
  analysis: WritingAnalysis;
  activeDimension: keyof Omit<BandScores, 'overall'>;
  onHighlightClick?: (paragraphIndex: number) => void;
}) {

  const argumentHighlights = buildArgumentHighlights(analysis.pyramid.paragraphs);
  const coherenceHighlights = buildCoherenceHighlights(analysis.pyramid.paragraphs);

  const currentHighlights: (EssayHighlight | ArgumentHighlight)[] = {
    taskAchievement: argumentHighlights,
    coherenceCohesion: [...coherenceHighlights, ...analysis.cohesionHighlights],
    lexicalResource: analysis.lexicalHighlights,
    grammaticalRange: analysis.grammaticalHighlights,
  }[activeDimension] || [];

  const spans = splitEssayIntoSpans(essay, currentHighlights);

  const handleSpanClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, highlight: EssayHighlight | ArgumentHighlight) => {
      if (activeDimension === 'taskAchievement' && 'error' in highlight) {
        if (onHighlightClick && highlight.paragraphIndex !== undefined) {
          onHighlightClick(highlight.paragraphIndex);
        }
      }
    },
    [activeDimension, onHighlightClick]
  );

  return (
    <div className="flex flex-col h-full relative">



      {/* Essay */}
      <div className="font-sans text-[15px] leading-[1.85] text-[#141413] [text-wrap:pretty]">
        {spans.map((span, i) => {
          const topHighlight = span.highlights[0];
          if (!topHighlight) {
            return <span key={i}>{span.text}</span>;
          }

          const style = DIMENSION_HIGHLIGHT_STYLES[activeDimension] || 'bg-yellow-100';
          const isClickable = activeDimension === 'taskAchievement' && 'error' in topHighlight;

          return (
            <span
              key={i}
              className={`${style} rounded-sm`}
              onClick={isClickable ? (e) => handleSpanClick(e, topHighlight) : undefined}
              title={!isClickable ? topHighlight.feedback : undefined}
            >
              {span.text}
            </span>
          );
        })}
      </div>

    </div>
  );
}
