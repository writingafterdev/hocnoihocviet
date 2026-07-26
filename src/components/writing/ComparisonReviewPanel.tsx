'use client';

import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { GitCompareArrows } from 'lucide-react';
import type { BandComparison } from '@/types/writing';
import EssayPromptBlock from './EssayPromptBlock';

interface ComparisonReviewPanelProps {
  prompt: string;
  originalEssay: string;
  improvedEssay: string;
  alreadyAtTarget?: boolean;
  changes?: BandComparison['changes'];
}

interface ComparisonColumnWidths {
  original: number;
  revised: number;
}

interface DiffToken {
  text: string;
  normalized: string;
  isWhitespace: boolean;
  changed: boolean;
}

interface DiffSegment {
  text: string;
  changed: boolean;
}

const MIN_COLUMN_WIDTH = 340;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function tokenize(text: string): DiffToken[] {
  return (text.match(/\s+|[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\s]/gu) || []).map(token => ({
    text: token,
    normalized: token.toLocaleLowerCase(),
    isWhitespace: /^\s+$/.test(token),
    changed: false,
  }));
}

function revisedDiffSegments(originalEssay: string, improvedEssay: string): DiffSegment[] {
  const originalTokens = tokenize(originalEssay).filter(token => !token.isWhitespace);
  const revisedTokens = tokenize(improvedEssay);
  const revisedContent = revisedTokens.filter(token => !token.isWhitespace);
  const rows = originalTokens.length + 1;
  const columns = revisedContent.length + 1;
  const lcs = Array.from({ length: rows }, () => new Uint16Array(columns));

  for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let revisedIndex = revisedContent.length - 1; revisedIndex >= 0; revisedIndex -= 1) {
      lcs[originalIndex][revisedIndex] = originalTokens[originalIndex].normalized === revisedContent[revisedIndex].normalized
        ? lcs[originalIndex + 1][revisedIndex + 1] + 1
        : Math.max(lcs[originalIndex + 1][revisedIndex], lcs[originalIndex][revisedIndex + 1]);
    }
  }

  const matchedRevisedTokens = new Set<number>();
  let originalIndex = 0;
  let revisedIndex = 0;
  while (originalIndex < originalTokens.length && revisedIndex < revisedContent.length) {
    if (originalTokens[originalIndex].normalized === revisedContent[revisedIndex].normalized) {
      matchedRevisedTokens.add(revisedIndex);
      originalIndex += 1;
      revisedIndex += 1;
    } else if (lcs[originalIndex + 1][revisedIndex] >= lcs[originalIndex][revisedIndex + 1]) {
      originalIndex += 1;
    } else {
      revisedIndex += 1;
    }
  }

  let contentIndex = 0;
  revisedTokens.forEach(token => {
    if (token.isWhitespace) return;
    token.changed = !matchedRevisedTokens.has(contentIndex);
    contentIndex += 1;
  });

  revisedTokens.forEach((token, index) => {
    if (!token.isWhitespace) return;
    const previous = revisedTokens.slice(0, index).reverse().find(candidate => !candidate.isWhitespace);
    const next = revisedTokens.slice(index + 1).find(candidate => !candidate.isWhitespace);
    token.changed = Boolean(previous?.changed && next?.changed);
  });

  return revisedTokens.reduce<DiffSegment[]>((segments, token) => {
    const previous = segments.at(-1);
    if (previous?.changed === token.changed) {
      previous.text += token.text;
    } else {
      segments.push({ text: token.text, changed: token.changed });
    }
    return segments;
  }, []);
}

function nthIndexOf(source: string, search: string, occurrenceIndex = 0) {
  let cursor = 0;
  for (let index = 0; index <= occurrenceIndex; index += 1) {
    const found = source.indexOf(search, cursor);
    if (found < 0) return -1;
    if (index === occurrenceIndex) return found;
    cursor = found + Math.max(1, search.length);
  }
  return -1;
}

function explicitChangeSegments(
  originalEssay: string,
  improvedEssay: string,
  changes: NonNullable<BandComparison['changes']>,
): DiffSegment[] {
  let accumulatedDelta = 0;
  const orderedChanges = changes
    .filter(change => change.originalText && change.revisedText)
    .map(change => ({
      change,
      originalStart: nthIndexOf(originalEssay, change.originalText, change.occurrenceIndex || 0),
    }))
    .filter(item => item.originalStart >= 0)
    .sort((left, right) => left.originalStart - right.originalStart);
  const ranges = orderedChanges
    .map(({ change, originalStart }) => {
      const start = originalStart + accumulatedDelta;
      const end = start + change.revisedText.length;
      accumulatedDelta += change.revisedText.length - change.originalText.length;
      return { start, end };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
  if (!ranges.length) return [{ text: improvedEssay, changed: false }];
  const merged = ranges.reduce<Array<{ start: number; end: number }>>((result, range) => {
    const previous = result.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else result.push({ ...range });
    return result;
  }, []);
  const segments: DiffSegment[] = [];
  let cursor = 0;
  merged.forEach(range => {
    if (range.start > cursor) segments.push({ text: improvedEssay.slice(cursor, range.start), changed: false });
    segments.push({ text: improvedEssay.slice(range.start, range.end), changed: true });
    cursor = range.end;
  });
  if (cursor < improvedEssay.length) segments.push({ text: improvedEssay.slice(cursor), changed: false });
  return segments;
}

function ColumnResizeHandle({ onMouseDown }: { onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void }) {
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

function EssayPane({
  title,
  prompt,
  essay,
  improved,
  diffSegments = [],
}: {
  title: string;
  prompt: string;
  essay: string;
  improved?: boolean;
  diffSegments?: DiffSegment[];
}) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[20px] bg-white p-5 shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/40">{title}</p>
        {improved && (
          <span className="rounded-[7px] bg-[#E5F3FE] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#2563EB]">
            Band 8/9
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-2 hide-scrollbar">
        <EssayPromptBlock prompt={prompt} className="mb-5" />
        <div className="whitespace-pre-wrap font-sans text-[13px] leading-[1.85] text-[#171717] [text-wrap:pretty]">
          {improved
            ? diffSegments.map((segment, index) => segment.changed ? (
                <mark
                  key={`${index}-${segment.text}`}
                  className="box-decoration-clone rounded-[4px] bg-[#DCEBFF] px-1 text-[#174EA6]"
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={`${index}-${segment.text}`}>{segment.text}</span>
              ))
            : essay}
          {!essay.trim() && <span className="text-[#737373]">No essay version is available.</span>}
        </div>
      </div>
    </section>
  );
}

export default function ComparisonReviewPanel({
  prompt,
  originalEssay,
  improvedEssay,
  alreadyAtTarget = false,
  changes = [],
}: ComparisonReviewPanelProps) {
  const [columnWidths, setColumnWidths] = useState<ComparisonColumnWidths>({ original: 1, revised: 1 });
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const diffSegments = useMemo(
    () => changes.length
      ? explicitChangeSegments(originalEssay, improvedEssay, changes)
      : revisedDiffSegments(originalEssay, improvedEssay),
    [changes, originalEssay, improvedEssay],
  );

  const startColumnResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = columnsRef.current;
    if (!container) return;

    const columns = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.getAttribute('role') !== 'separator',
    );
    const originalWidth = columns[0]?.getBoundingClientRect().width || 520;
    const revisedWidth = columns[1]?.getBoundingClientRect().width || 520;
    const totalWidth = originalWidth + revisedWidth;
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextOriginal = clamp(originalWidth + moveEvent.clientX - startX, MIN_COLUMN_WIDTH, totalWidth - MIN_COLUMN_WIDTH);
      const nextRevised = totalWidth - nextOriginal;
      setColumnWidths({ original: nextOriginal / totalWidth, revised: nextRevised / totalWidth });
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
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <header className="flex shrink-0 items-center gap-2.5 rounded-[16px] bg-white px-4 py-3 shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#E5F3FE] text-[#2563EB]">
          <GitCompareArrows size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="font-sans text-[13px] font-semibold text-[#171717]">
            {alreadyAtTarget ? 'Không có bản sửa đã xác minh' : 'Original to Band 8/9'}
          </p>
          <p className="font-sans text-[11px] text-[#737373]">
            {alreadyAtTarget
              ? 'Lượt review này chưa xác nhận được thay đổi cụ thể để tạo bản viết lại. Bài gốc được giữ nguyên và không gắn nhãn Band 8/9.'
              : 'Các phần được thay đổi trong bản Band 8/9 được đánh dấu màu xanh.'}
          </p>
        </div>
      </header>

      {alreadyAtTarget ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)] gap-4">
          <EssayPane title="Essay giữ nguyên" prompt={prompt} essay={originalEssay} />
          <aside className="rounded-[20px] bg-white p-5 shadow-[0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/40">Assessment result</p>
            <h2 className="mt-3 font-sans text-[16px] font-semibold text-[#171717]">Không tạo sample essay thiếu căn cứ</h2>
            <p className="mt-3 font-sans text-[11px] leading-relaxed text-[#565B63]">
              Các pass chuyên môn không tìm thấy lỗi đủ rõ để gắn với một thay đổi cụ thể. Điều này không tự động nâng bài lên Band 8/9; nó chỉ có nghĩa là hệ thống không nên tạo một bản viết lại mang tính phong cách rồi trình bày như một bản sửa có căn cứ.
            </p>
          </aside>
        </div>
      ) : (
        <div
          ref={columnsRef}
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: `minmax(${MIN_COLUMN_WIDTH}px, ${columnWidths.original}fr) 16px minmax(${MIN_COLUMN_WIDTH}px, ${columnWidths.revised}fr)`,
          }}
        >
          <EssayPane title="Original essay" prompt={prompt} essay={originalEssay} />
          <ColumnResizeHandle onMouseDown={startColumnResize} />
          <EssayPane
            title="Band 8/9 revised essay"
            prompt={prompt}
            essay={improvedEssay}
            improved
            diffSegments={diffSegments}
          />
        </div>
      )}
    </div>
  );
}
