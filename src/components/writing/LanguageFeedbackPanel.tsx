'use client';

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { EssayHighlight } from '@/types/writing';
import { errorLabelVi, inferLanguageErrorCode, isTaxonomyCodeFor } from '@/lib/assessment-error-taxonomy';
import EssayPromptBlock from './EssayPromptBlock';

export type LanguageFeedbackFilter = 'all' | 'lexical' | 'grammar';
export type LanguageFeedbackCriterion = Exclude<LanguageFeedbackFilter, 'all'>;

export interface LanguageFeedbackHighlight extends EssayHighlight {
  key: string;
  criterion: LanguageFeedbackCriterion;
}

export interface LanguageFeedbackPanelProps {
  prompt: string;
  essay: string;
  lexicalHighlights: EssayHighlight[];
  grammaticalHighlights: EssayHighlight[];
  /** Controlled filter. Omit to let the panel manage its own filter state. */
  selectedFilter?: LanguageFeedbackFilter;
  onFilterChange?: (filter: LanguageFeedbackFilter) => void;
  /** A key returned by `onHighlightChange`, for a parent-controlled active comment. */
  selectedHighlightKey?: string | null;
  onHighlightChange?: (highlight: LanguageFeedbackHighlight) => void;
  className?: string;
}

interface EssaySpan {
  text: string;
  highlight?: LanguageFeedbackHighlight;
  insertion?: boolean;
}

interface InlineDiffSegment {
  original: string;
  replacement: string;
  changed: boolean;
}

interface LanguageColumnWidths {
  essay: number;
  comments: number;
}

const LANGUAGE_COLUMN_PRESET: LanguageColumnWidths = {
  essay: 55,
  comments: 45,
};

const FILTERS: Array<{ id: LanguageFeedbackFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'lexical', label: 'Lexical' },
  { id: 'grammar', label: 'Grammar' },
];

function makeHighlightKey(criterion: LanguageFeedbackCriterion, highlight: EssayHighlight, index: number) {
  return `${criterion}-${highlight.startChar}-${highlight.endChar}-${index}`;
}

function buildHighlights(
  lexicalHighlights: EssayHighlight[],
  grammaticalHighlights: EssayHighlight[],
): LanguageFeedbackHighlight[] {
  return [
    ...lexicalHighlights.filter(isReportableLanguageHighlight).map((highlight, index) => ({
      ...highlight,
      key: makeHighlightKey('lexical', highlight, index),
      criterion: 'lexical' as const,
    })),
    ...grammaticalHighlights.filter(isReportableLanguageHighlight).map((highlight, index) => ({
      ...highlight,
      key: makeHighlightKey('grammar', highlight, index),
      criterion: 'grammar' as const,
    })),
  ].sort((left, right) => left.startChar - right.startChar || left.endChar - right.endChar);
}

function splitEssayIntoSpans(essay: string, highlights: LanguageFeedbackHighlight[]): EssaySpan[] {
  if (!highlights.length) return [{ text: essay }];

  const spans: EssaySpan[] = [];
  const sortedHighlights = [...highlights]
    .map(highlight => ({
      ...highlight,
      startChar: clamp(highlight.startChar, 0, essay.length),
      endChar: clamp(highlight.endChar, 0, essay.length),
    }))
    .sort((left, right) => left.startChar - right.startChar || right.endChar - left.endChar);

  let cursor = 0;
  for (const highlight of sortedHighlights) {
    if (highlight.startChar < cursor) continue;
    if (highlight.startChar > cursor) {
      spans.push({ text: essay.slice(cursor, highlight.startChar) });
    }

    if (highlight.startChar === highlight.endChar) {
      spans.push({ text: '', highlight, insertion: true });
      continue;
    }

    spans.push({ text: essay.slice(highlight.startChar, highlight.endChar), highlight });
    cursor = highlight.endChar;
  }

  if (cursor < essay.length) spans.push({ text: essay.slice(cursor) });
  return spans;
}

function criterionLabel(criterion: LanguageFeedbackCriterion) {
  return criterion === 'lexical' ? 'Lexical resource' : 'Grammar';
}

function highlightErrorLabel(highlight: LanguageFeedbackHighlight) {
  const inferred = inferLanguageErrorCode(highlight.highlightType, highlight.label, highlight.criterion);
  return highlight.errorLabelVi || errorLabelVi(highlight.errorCode || inferred, highlight.label);
}

function commentTone(criterion: LanguageFeedbackCriterion) {
  return criterion === 'lexical'
    ? {
        accent: 'bg-[#2563EB]',
        label: 'text-[#2563EB]',
        active: 'border-[#3478F6]/35 bg-[#F7FBFF]',
        marker: 'bg-[#E5F3FE] text-[#2563EB]',
      }
    : {
        accent: 'bg-[#EC6A5B]',
        label: 'text-[#B84B3E]',
        active: 'border-[#EC6A5B]/35 bg-[#FFF9F7]',
        marker: 'bg-[#FFF0EC] text-[#B84B3E]',
      };
}

function styleSuggestionTone() {
  return {
    accent: 'bg-[#8A94A6]',
    label: 'text-[#5B6472]',
    active: 'border-[#8A94A6]/30 bg-[#F7F8FA]',
    marker: 'bg-[#EDF0F4] text-[#596273]',
  };
}

function replacementForHighlight(highlight: EssayHighlight) {
  return highlight.replacementText || highlight.correction || highlight.suggestedText || '';
}

function isStyleSuggestion(highlight: EssayHighlight) {
  const marker = `${highlight.highlightType || ''} ${highlight.label || ''} ${highlight.errorLabelVi || ''} ${highlight.feedback || ''}`.toLowerCase();
  return highlight.highlightType === 'style_suggestion'
    || /gợi ý polish|không bắt buộc|style suggestion|style_suggestion|không phải lỗi chắc chắn/.test(marker);
}

const POSITIVE_LANGUAGE_ERROR_CODES = new Set([
  'strong_academic_phrase',
  'controlled_complex_structure',
  'worth_preserving',
]);

function isPositiveHighlight(highlight: EssayHighlight) {
  if (isStyleSuggestion(highlight)) return false;
  if (highlight.errorCode && POSITIVE_LANGUAGE_ERROR_CODES.has(highlight.errorCode)) return true;

  const marker = `${highlight.highlightType || ''} ${highlight.label || ''} ${highlight.errorLabelVi || ''} ${highlight.feedback || ''}`.toLowerCase();
  return /\b(strength|positive|worth_preserving|keep|preserve)\b/.test(marker)
    || /đáng giữ|kiểm soát tốt|dùng tự nhiên|giữ lại|cụm tốt/.test(marker);
}

function isReportableLanguageHighlight(highlight: EssayHighlight) {
  if (isPositiveHighlight(highlight)) return false;

  // Verified V2 findings already have an authoritative criterion code. Prose
  // heuristics must not hide a confirmed local language error.
  if (isTaxonomyCodeFor(highlight.errorCode, ['lexical_resource', 'grammatical_range_accuracy'])) {
    const source = highlight.sourceText || '';
    const hasSpan = typeof highlight.startChar === 'number'
      && typeof highlight.endChar === 'number'
      && highlight.endChar >= highlight.startChar;
    return Boolean(
      (source.trim().length > 0 || hasSpan)
      && replacementForHighlight(highlight).trim(),
    );
  }

  // Legacy stored assessments did not carry criterion codes. Keep a narrow
  // compatibility guard for those records only.
  const diagnostic = `${highlight.label || ''} ${highlight.feedback || ''} ${highlight.solutionFeedback || ''}`.toLowerCase();
  if (/(thesis|topic sentence|paragraph job|claim|evidence|mechanism|argument|luận điểm|lập luận|cơ chế|vai trò đoạn|chứng minh|không support|không chứng minh)/.test(diagnostic)) {
    return false;
  }

  const source = highlight.sourceText || '';
  const hasSpan = typeof highlight.startChar === 'number' && typeof highlight.endChar === 'number' && highlight.endChar >= highlight.startChar;
  const hasEvidence = source.trim().length > 0 || hasSpan;
  const hasInstruction = Boolean(
    replacementForHighlight(highlight).trim()
      || highlight.feedback?.trim()
      || highlight.solutionFeedback?.trim(),
  );

  return hasEvidence && hasInstruction;
}

function languageMarkTone(highlight: LanguageFeedbackHighlight, isActive: boolean) {
  if (isStyleSuggestion(highlight)) {
    return isActive
      ? 'bg-[#E8EDF3] text-[#293241]'
      : 'bg-[#F0F3F7] text-[#293241] hover:bg-[#E8EDF3]';
  }

  const hasReplacement = Boolean(replacementForHighlight(highlight));
  const positive = isPositiveHighlight(highlight) && !hasReplacement;

  if (positive) {
    return isActive
      ? 'bg-[#DCEBFF] text-[#174EA6]'
      : 'bg-[#EAF3FF] text-[#174EA6] hover:bg-[#DCEBFF]';
  }

  if (highlight.criterion === 'lexical') {
    return isActive
      ? 'bg-[#58D98A] text-[#053B22]'
      : 'bg-[#63E091] text-[#053B22] hover:bg-[#56D887]';
  }

  return isActive
    ? 'bg-[#FFE68A] text-[#2D2D2D]'
    : 'bg-[#FFED9C] text-[#2D2D2D] hover:bg-[#FFE68A]';
}

function diffTokens(text: string) {
  const matcher = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;
  const tokens: Array<{ text: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function splitChangedGap(original: string, replacement: string): InlineDiffSegment[] {
  if (original === replacement) return original ? [{ original, replacement: '', changed: false }] : [];

  const originalLeading = original.match(/^\s*/)?.[0] || '';
  const originalTrailing = original.match(/\s*$/)?.[0] || '';
  const replacementLeading = replacement.match(/^\s*/)?.[0] || '';
  const replacementTrailing = replacement.match(/\s*$/)?.[0] || '';
  const originalCore = original.slice(originalLeading.length, original.length - originalTrailing.length);
  const replacementCore = replacement.slice(replacementLeading.length, replacement.length - replacementTrailing.length);
  const singleToken = /^[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*$/u;

  // Character-level prefix matching makes morphology edits look broken
  // ("becom" + "ing -> e"). Keep shared whitespace, but mark the complete
  // word as the smallest useful correction unit.
  if (
    originalCore !== replacementCore
    && singleToken.test(originalCore)
    && singleToken.test(replacementCore)
  ) {
    const segments: InlineDiffSegment[] = [];
    const leading = originalLeading || replacementLeading;
    if (leading) segments.push({ original: leading, replacement: '', changed: false });
    segments.push({ original: originalCore, replacement: replacementCore, changed: true });
    const trailing = originalTrailing || replacementTrailing;
    if (trailing) segments.push({ original: trailing, replacement: '', changed: false });
    return segments;
  }

  let prefixLength = 0;
  while (
    prefixLength < original.length &&
    prefixLength < replacement.length &&
    original[prefixLength] === replacement[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < original.length - prefixLength &&
    suffixLength < replacement.length - prefixLength &&
    original[original.length - 1 - suffixLength] === replacement[replacement.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const segments: InlineDiffSegment[] = [];
  if (prefixLength) {
    segments.push({ original: original.slice(0, prefixLength), replacement: '', changed: false });
  }
  const originalEnd = suffixLength ? original.length - suffixLength : original.length;
  const replacementEnd = suffixLength ? replacement.length - suffixLength : replacement.length;
  segments.push({
    original: original.slice(prefixLength, originalEnd),
    replacement: replacement.slice(prefixLength, replacementEnd),
    changed: true,
  });
  if (suffixLength) {
    segments.push({ original: original.slice(original.length - suffixLength), replacement: '', changed: false });
  }
  return segments;
}

function inlineReplacementDiff(original: string, replacement: string): InlineDiffSegment[] {
  const originalTokens = diffTokens(original);
  const replacementTokens = diffTokens(replacement);
  const lcs = Array.from(
    { length: originalTokens.length + 1 },
    () => new Uint16Array(replacementTokens.length + 1),
  );

  for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let replacementIndex = replacementTokens.length - 1; replacementIndex >= 0; replacementIndex -= 1) {
      lcs[originalIndex][replacementIndex] = originalTokens[originalIndex].text === replacementTokens[replacementIndex].text
        ? lcs[originalIndex + 1][replacementIndex + 1] + 1
        : Math.max(lcs[originalIndex + 1][replacementIndex], lcs[originalIndex][replacementIndex + 1]);
    }
  }

  const matches: Array<{ originalIndex: number; replacementIndex: number }> = [];
  let originalIndex = 0;
  let replacementIndex = 0;
  while (originalIndex < originalTokens.length && replacementIndex < replacementTokens.length) {
    if (originalTokens[originalIndex].text === replacementTokens[replacementIndex].text) {
      matches.push({ originalIndex, replacementIndex });
      originalIndex += 1;
      replacementIndex += 1;
    } else if (lcs[originalIndex + 1][replacementIndex] >= lcs[originalIndex][replacementIndex + 1]) {
      originalIndex += 1;
    } else {
      replacementIndex += 1;
    }
  }

  const segments: InlineDiffSegment[] = [];
  let originalCursor = 0;
  let replacementCursor = 0;
  matches.forEach(match => {
    const originalToken = originalTokens[match.originalIndex];
    const replacementToken = replacementTokens[match.replacementIndex];
    segments.push(...splitChangedGap(
      original.slice(originalCursor, originalToken.start),
      replacement.slice(replacementCursor, replacementToken.start),
    ));
    segments.push({ original: originalToken.text, replacement: '', changed: false });
    originalCursor = originalToken.end;
    replacementCursor = replacementToken.end;
  });
  segments.push(...splitChangedGap(original.slice(originalCursor), replacement.slice(replacementCursor)));

  return segments.filter(segment => segment.original || segment.replacement);
}

const LanguageEvidenceMark = forwardRef<HTMLSpanElement, {
  span: EssaySpan & { highlight: LanguageFeedbackHighlight };
  isActive: boolean;
  onSelect: () => void;
}>(function LanguageEvidenceMark({
  span,
  isActive,
  onSelect,
}, ref) {
  const replacement = replacementForHighlight(span.highlight).trim();
  const text = span.text || span.highlight.sourceText || '';
  const replacementDiff = replacement ? inlineReplacementDiff(text, replacement) : [];
  const markTone = languageMarkTone(span.highlight, isActive);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Inspect ${criterionLabel(span.highlight.criterion)} feedback: ${span.highlight.label}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[#3478F6]/60 ${replacement ? '' : `rounded-[4px] px-0.5 py-px box-decoration-clone transition-colors ${markTone}`}`}
    >
      {span.insertion ? (
        <span className="inline-block h-[1.05em] min-w-1.5 rounded-[3px] bg-current/20 align-[-0.12em]" aria-hidden={!replacement}>
          {replacement ? <span className="px-0.5 font-sans text-[0.82em] font-semibold uppercase tracking-[0.03em]">{replacement}</span> : null}
        </span>
      ) : (
        <>
          {replacement ? (
            replacementDiff.map((segment, index) => segment.changed ? (
              <span key={`${index}-${segment.original}-${segment.replacement}`} className={`rounded-[4px] px-0.5 py-px box-decoration-clone transition-colors ${markTone}`}>
                {segment.original ? (
                  <span className="font-sans line-through decoration-[1.5px] decoration-[#141413]/70 decoration-solid opacity-80">
                    {segment.original}
                  </span>
                ) : null}
                {segment.replacement ? (
                  <span className={`${segment.original ? 'ml-1' : ''} font-sans text-[0.9em] font-semibold uppercase tracking-[0.035em]`}>
                    {segment.replacement}
                  </span>
                ) : null}
              </span>
            ) : (
              <span key={`${index}-${segment.original}`}>{segment.original}</span>
            ))
          ) : (
            <span>{text}</span>
          )}
        </>
      )}
    </span>
  );
});

function excerptForHighlight(essay: string, highlight: EssayHighlight) {
  const start = Math.max(0, highlight.startChar - 28);
  const end = Math.min(essay.length, highlight.endChar + 42);
  const before = start > 0 ? '...' : '';
  const after = end < essay.length ? '...' : '';
  return `${before}${essay.slice(start, end).replace(/\s+/g, ' ').trim()}${after}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ColumnResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="group flex w-4 shrink-0 cursor-col-resize items-stretch justify-center"
    >
      <div className="my-2 w-px rounded-full bg-black/[0.06] transition-colors group-hover:bg-[#3478F6]/40" />
    </div>
  );
}

export default function LanguageFeedbackPanel({
  prompt,
  essay,
  lexicalHighlights,
  grammaticalHighlights,
  selectedFilter,
  onFilterChange,
  selectedHighlightKey,
  onHighlightChange,
  className = '',
}: LanguageFeedbackPanelProps) {
  const [internalFilter, setInternalFilter] = useState<LanguageFeedbackFilter>('all');
  const [internalHighlightKey, setInternalHighlightKey] = useState<string | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [columnWidths, setColumnWidths] = useState<LanguageColumnWidths>(LANGUAGE_COLUMN_PRESET);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const essayScrollRef = useRef<HTMLElement | null>(null);
  const activeEvidenceRef = useRef<HTMLElement | null>(null);
  const commentScrollRef = useRef<HTMLDivElement | null>(null);
  const activeCommentRef = useRef<HTMLButtonElement | null>(null);

  const activeFilter = selectedFilter ?? internalFilter;
  const highlights = useMemo(
    () => buildHighlights(lexicalHighlights, grammaticalHighlights),
    [lexicalHighlights, grammaticalHighlights],
  );
  const visibleHighlights = useMemo(
    () => activeFilter === 'all'
      ? highlights
      : highlights.filter(highlight => highlight.criterion === activeFilter),
    [activeFilter, highlights],
  );
  const activeHighlightKey = selectedHighlightKey ?? internalHighlightKey;
  const activeHighlight = visibleHighlights.find(highlight => highlight.key === activeHighlightKey) || null;
  const resolvedActiveHighlightKey = activeHighlight?.key;
  const essaySpans = useMemo(() => splitEssayIntoSpans(essay, visibleHighlights), [essay, visibleHighlights]);

  useEffect(() => {
    if (!resolvedActiveHighlightKey) return;
    activeEvidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const scrollBox = commentScrollRef.current;
    const activeComment = activeCommentRef.current;
    if (!scrollBox || !activeComment) return;

    const commentRect = activeComment.getBoundingClientRect();
    const boxRect = scrollBox.getBoundingClientRect();
    const nextTop = scrollBox.scrollTop + commentRect.top - boxRect.top + 14;
    scrollBox.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [resolvedActiveHighlightKey, selectionRevision]);

  const selectFilter = (filter: LanguageFeedbackFilter) => {
    if (selectedFilter === undefined) setInternalFilter(filter);
    onFilterChange?.(filter);
  };

  const selectHighlight = (highlight: LanguageFeedbackHighlight) => {
    if (selectedHighlightKey === undefined) setInternalHighlightKey(highlight.key);
    setSelectionRevision(current => current + 1);
    onHighlightChange?.(highlight);
  };

  const startColumnResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = columnsRef.current;
    if (!container) return;

    const columnElements = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.getAttribute('role') !== 'separator',
    );
    const essayWidth = columnElements[0]?.getBoundingClientRect().width || 520;
    const commentsWidth = columnElements[1]?.getBoundingClientRect().width || 320;
    const pairTotal = essayWidth + commentsWidth;
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextEssay = clamp(essayWidth + delta, 320, pairTotal - 240);
      const nextComments = pairTotal - nextEssay;
      setColumnWidths({
        essay: (nextEssay / pairTotal) * 100,
        comments: (nextComments / pairTotal) * 100,
      });
    };

    const handleMouseUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={columnsRef}
      className={`grid h-full min-h-0 min-w-0 ${className}`}
      style={{ gridTemplateColumns: `minmax(320px, ${columnWidths.essay}fr) 16px minmax(240px, ${columnWidths.comments}fr)` }}
    >
      <section
        ref={essayScrollRef}
        aria-label="Essay language evidence"
        className="min-h-0 overflow-y-auto rounded-[20px] bg-white p-5 shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)] hide-scrollbar"
      >
        <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-3">
          <p className="font-sans text-[14px] font-semibold text-[#171717]">Essay</p>
          <p className="font-sans text-[11px] text-[#737373]">
            {visibleHighlights.length} marked {visibleHighlights.length === 1 ? 'point' : 'points'}
          </p>
        </div>

        <EssayPromptBlock prompt={prompt} className="mb-5" />

        <div className="max-w-[72ch] whitespace-pre-wrap font-sans text-[14px] leading-[1.9] text-[#171717] [text-wrap:pretty]">
          {essaySpans.map((span, index) => {
            if (!span.highlight) return <span key={`${index}-${span.text}`}>{span.text}</span>;

            const isActive = activeHighlight?.key === span.highlight.key;
            return (
              <LanguageEvidenceMark
                key={`${span.highlight.key}-${index}`}
                ref={isActive ? activeEvidenceRef : undefined}
                span={span as EssaySpan & { highlight: LanguageFeedbackHighlight }}
                isActive={isActive}
                onSelect={() => selectHighlight(span.highlight!)}
              />
            );
          })}
        </div>
      </section>

      <ColumnResizeHandle onMouseDown={startColumnResize} />

      <aside aria-label="Language feedback comments" className="flex min-h-0 min-w-0 flex-col">
        <div className="mb-4 shrink-0 px-2">
          <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Editorial comments</p>
          <div className="flex gap-1 border-b border-black/[0.08] pb-2" role="tablist" aria-label="Language feedback filter">
            {FILTERS.map(filter => {
              const isSelected = filter.id === activeFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => selectFilter(filter.id)}
                    className={`rounded-[7px] px-2 py-1 font-sans text-[9px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50 ${
                    isSelected
                      ? 'bg-[#E5F3FE] text-[#2563EB]'
                      : 'text-[#737373] hover:bg-black/[0.035] hover:text-[#404040]'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={commentScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-4 hide-scrollbar">
          {visibleHighlights.length ? (
            visibleHighlights.map((highlight, index) => {
              const isActive = activeHighlight?.key === highlight.key;
              const styleSuggestion = isStyleSuggestion(highlight);
              const tone = styleSuggestion ? styleSuggestionTone() : commentTone(highlight.criterion);
              const criterion = criterionLabel(highlight.criterion);
              const replacement = replacementForHighlight(highlight).trim();
              const displayError = highlightErrorLabel(highlight);
              return (
                <button
                  key={highlight.key}
                  ref={isActive ? activeCommentRef : undefined}
                  type="button"
                  onClick={() => selectHighlight(highlight)}
                  className={`w-full rounded-[14px] border px-3 py-3 text-left shadow-[0_2px_10px_rgba(0,0,0,0.025)] outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/50 ${
                    isActive ? tone.active : 'border-transparent bg-white hover:border-black/[0.08] hover:bg-black/[0.012]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.accent}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <h3 className="font-sans text-[13px] font-semibold leading-snug text-[#171717]">{displayError}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] ${tone.marker}`}>
                          {styleSuggestion ? 'STYLE' : highlight.criterion === 'lexical' ? 'LR' : 'GRA'}
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/40">{criterion}</span>
                        <span className="font-mono text-[8px] text-[#A3A3A3]">#{index + 1}</span>
                      </div>
                      <p className="mt-1.5 font-sans text-[11px] font-semibold leading-snug text-[#2A2A2A]">{highlight.label}</p>
                      <p className="mt-2 font-sans text-[10px] leading-relaxed text-[#737373]">
                        <span className="font-semibold text-[#595959]">Trong bài: </span>“{excerptForHighlight(essay, highlight)}”
                      </p>
                      {replacement ? (
                        <p className="mt-2 font-sans text-[11px] leading-relaxed text-[#525252]">
                          <span className={`font-semibold ${tone.label}`}>{styleSuggestion ? 'Mình sẽ chọn: ' : 'Sửa thành: '}</span>
                          <span className="rounded-[5px] bg-black/[0.04] px-1.5 py-0.5 font-semibold text-[#171717]">{replacement}</span>
                        </p>
                      ) : null}
                      <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#525252]">
                        <span className={`font-semibold ${tone.label}`}>{styleSuggestion ? 'Gợi ý: ' : 'Cần sửa: '}</span>{highlight.feedback}
                      </p>
                      {styleSuggestion && highlight.solutionFeedback ? (
                        <p className="mt-1 font-sans text-[10px] leading-relaxed text-[#737373]">{highlight.solutionFeedback}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[14px] border border-[#3478F6]/15 bg-[#F5F9FF] px-4 py-4">
              <p className="font-sans text-[13px] font-semibold text-[#171717]">
                {activeFilter === 'all'
                  ? 'Chưa xác nhận được lỗi ngôn ngữ đáng kể'
                  : activeFilter === 'lexical'
                    ? 'Chưa xác nhận được lỗi từ vựng đáng kể'
                    : 'Chưa xác nhận được lỗi ngữ pháp đáng kể'}
              </p>
              <p className="mt-2 font-sans text-[11px] leading-relaxed text-[#565B63]">
                Lần đánh giá này không tìm thấy lỗi đủ rõ để đánh dấu trong phạm vi đang xem. Điều này không có nghĩa mọi cách dùng đều hoàn hảo; bài viết chỉ được giữ nguyên vì không có correction nào đủ chắc chắn để thêm vào.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
