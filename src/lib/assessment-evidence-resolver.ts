import type { EssayParagraphManifest } from '@/lib/writing-analysis-contract';

export interface QuoteEvidenceInput {
  paragraphIndex?: number;
  sourceText: string;
  role: 'primary' | 'context' | 'affected';
  occurrenceIndex?: number;
}

export interface ResolvedQuoteEvidence {
  paragraphIndex: number;
  sourceText: string;
  role: QuoteEvidenceInput['role'];
  occurrenceIndex?: number;
  startChar: number;
  endChar: number;
  matchType: 'exact' | 'token' | 'fuzzy';
}

interface Token {
  value: string;
  start: number;
  end: number;
}

function tokens(text: string, offset = 0): Token[] {
  const result: Token[] = [];
  const pattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    result.push({
      value: match[0].toLocaleLowerCase('en').replaceAll('’', "'"),
      start: offset + match.index,
      end: offset + match.index + match[0].length,
    });
  }
  return result;
}

function exactMatches(haystack: string, needle: string, offset: number) {
  const matches: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) break;
    matches.push({ start: offset + index, end: offset + index + needle.length });
    cursor = index + Math.max(1, needle.length);
  }
  return matches;
}

function tokenMatches(haystack: string, needle: string, offset: number) {
  const sourceTokens = tokens(haystack, offset);
  const quoteTokens = tokens(needle);
  if (!quoteTokens.length || quoteTokens.length > sourceTokens.length) return [];
  const matches: Array<{ start: number; end: number }> = [];
  for (let index = 0; index <= sourceTokens.length - quoteTokens.length; index += 1) {
    const matched = quoteTokens.every((token, quoteIndex) => (
      sourceTokens[index + quoteIndex]?.value === token.value
    ));
    if (matched) {
      matches.push({
        start: sourceTokens[index].start,
        end: sourceTokens[index + quoteTokens.length - 1].end,
      });
    }
  }
  return matches;
}

function tokenEditDistance(left: Token[], right: Token[]) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]
        + (left[leftIndex - 1].value === right[rightIndex - 1].value ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function fuzzyTokenMatches(haystack: string, needle: string, offset: number) {
  const sourceTokens = tokens(haystack, offset);
  const quoteTokens = tokens(needle);
  if (quoteTokens.length < 6 || sourceTokens.length < 6) return [];

  const candidates: Array<{ start: number; end: number; score: number }> = [];
  const minimumLength = Math.max(4, quoteTokens.length - 2);
  const maximumLength = Math.min(sourceTokens.length, quoteTokens.length + 2);
  for (let windowLength = minimumLength; windowLength <= maximumLength; windowLength += 1) {
    for (let index = 0; index <= sourceTokens.length - windowLength; index += 1) {
      const window = sourceTokens.slice(index, index + windowLength);
      const distance = tokenEditDistance(quoteTokens, window);
      const score = 1 - (distance / Math.max(quoteTokens.length, window.length));
      if (score < 0.86) continue;
      candidates.push({
        start: window[0].start,
        end: window[window.length - 1].end,
        score,
      });
    }
  }

  const ranked = candidates.sort((left, right) => right.score - left.score);
  const distinct: typeof ranked = [];
  ranked.forEach(candidate => {
    const overlapsExisting = distinct.some(existing => (
      candidate.start < existing.end && candidate.end > existing.start
    ));
    if (!overlapsExisting) distinct.push(candidate);
  });
  return distinct;
}

/**
 * Resolves model-selected quotes against the immutable essay source. Nodes are
 * deliberately not involved: renderers can map these ranges onto any later
 * decomposition by interval overlap.
 */
export function resolveQuoteEvidence(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: QuoteEvidenceInput,
): ResolvedQuoteEvidence | undefined {
  const requestedOccurrence = evidence.occurrenceIndex ?? 0;

  const paragraphScopes = evidence.paragraphIndex === undefined
    ? [manifest]
    : [
        manifest.filter(paragraph => paragraph.index === evidence.paragraphIndex),
        manifest,
      ];

  for (const candidateParagraphs of paragraphScopes) {
    for (const matchType of ['exact', 'token'] as const) {
      const candidates = candidateParagraphs.flatMap(paragraph => {
        const matches = matchType === 'exact'
          ? exactMatches(paragraph.text, evidence.sourceText, paragraph.startChar)
          : tokenMatches(paragraph.text, evidence.sourceText, paragraph.startChar);
        return matches.map(match => ({ paragraph, match }));
      });
      const selected = candidates[requestedOccurrence];
      if (!selected) continue;
      return {
        paragraphIndex: selected.paragraph.index,
        sourceText: essay.slice(selected.match.start, selected.match.end),
        role: evidence.role,
        occurrenceIndex: candidates.length > 1 ? requestedOccurrence : undefined,
        startChar: selected.match.start,
        endChar: selected.match.end,
        matchType,
      };
    }

    const fuzzyCandidates = candidateParagraphs.flatMap(paragraph => (
      fuzzyTokenMatches(paragraph.text, evidence.sourceText, paragraph.startChar)
        .map(match => ({ paragraph, match }))
    )).sort((left, right) => right.match.score - left.match.score);
    const selected = fuzzyCandidates[requestedOccurrence];
    const runnerUp = fuzzyCandidates[requestedOccurrence + 1];
    if (selected && (!runnerUp || selected.match.score - runnerUp.match.score >= 0.05)) {
      return {
        paragraphIndex: selected.paragraph.index,
        sourceText: essay.slice(selected.match.start, selected.match.end),
        role: evidence.role,
        occurrenceIndex: fuzzyCandidates.length > 1 ? requestedOccurrence : undefined,
        startChar: selected.match.start,
        endChar: selected.match.end,
        matchType: 'fuzzy',
      };
    }
  }
  return undefined;
}

export function resolveQuoteEvidenceSet(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: QuoteEvidenceInput[],
) {
  return evidence.map(item => resolveQuoteEvidence(essay, manifest, item));
}

export function resolveQuoteEvidenceGroup(
  essay: string,
  manifest: EssayParagraphManifest[],
  evidence: QuoteEvidenceInput,
) {
  const fragments = evidence.sourceText
    .split(/\s*(?:\.{3}|…)+\s*/)
    .map(fragment => fragment.trim())
    .filter(Boolean);
  const candidates = fragments.length > 1
    ? fragments.map(sourceText => ({ ...evidence, sourceText, occurrenceIndex: undefined }))
    : [evidence];
  return candidates.map(candidate => resolveQuoteEvidence(essay, manifest, candidate));
}
