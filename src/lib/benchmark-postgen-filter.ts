export const BENCHMARK_POSTGEN_FILTER_VERSION = 'benchmark-postgen-filter-v1';

export interface BenchmarkPostgenFilterScores {
  overall?: string;
  taskResponse?: string;
  coherenceCohesion?: string;
  lexicalResource?: string;
  gra?: string;
}

export interface BenchmarkPostgenRemovedFinding {
  title: string;
  criterion: string;
  reason: string;
}

export interface BenchmarkPostgenFilterAudit {
  version: string;
  keptCount: number;
  removedCount: number;
  removed: BenchmarkPostgenRemovedFinding[];
}

interface FindingBlock {
  heading: string;
  title: string;
  body: string;
  criterion: string;
  severity: string;
  confidence: string;
  validEvidenceCount: number;
  evidenceKey: string;
}

function normalizeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sectionBounds(markdown: string, sectionNumber: number) {
  const start = markdown.search(new RegExp(`^##\\s+${sectionNumber}\\.`, 'im'));
  if (start < 0) return null;
  const next = markdown.slice(start + 1).search(/^##\s+\d+\./im);
  const end = next < 0 ? markdown.length : start + 1 + next;
  return { start, end };
}

function extractField(body: string, label: string) {
  const match = body.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() || '';
}

function extractEvidenceQuotes(block: string) {
  const quotes = Array.from(block.matchAll(/^>\s*(.+)$/gm))
    .map((match) => match[1].trim())
    .filter(Boolean);
  const inlineQuoted = Array.from(block.matchAll(/"([^"\n]{12,})"/g))
    .map((match) => match[1].trim())
    .filter(Boolean);
  return Array.from(new Set([...quotes, ...inlineQuoted]));
}

function quoteMatchesEssay(quote: string, normalizedEssay: string) {
  const cleaned = normalizeText(quote)
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\.\.\./g, ' ... ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 12) return false;
  if (!cleaned.includes('...')) return normalizedEssay.includes(cleaned);

  const fragments = cleaned
    .split('...')
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= 12);
  return fragments.length > 0 && fragments.every((fragment) => normalizedEssay.includes(fragment));
}

function buildEvidenceKey(quotes: string[]) {
  return quotes
    .map((quote) => normalizeText(quote).slice(0, 80))
    .sort()
    .join('|');
}

function parseMustCatchBlocks(section: string, normalizedEssay: string) {
  const pieces = section
    .split(/(?=^### Error\b)/gim)
    .map((piece) => piece.trim())
    .filter(Boolean);
  const intro = pieces.find((piece) => !/^### Error\b/im.test(piece)) || '';
  const findings = pieces
    .filter((piece) => /^### Error\b/im.test(piece))
    .map((piece): FindingBlock => {
      const [headingLine = '', ...rest] = piece.split('\n');
      const title = headingLine.replace(/^### Error\s+\d+\s*:\s*/i, '').trim() || headingLine.trim();
      const body = rest.join('\n').trim();
      const evidenceQuotes = extractEvidenceQuotes(piece);
      const validEvidenceCount = evidenceQuotes.filter((quote) => quoteMatchesEssay(quote, normalizedEssay)).length;
      return {
        heading: headingLine.trim(),
        title,
        body,
        criterion: extractField(body, 'Criterion'),
        severity: extractField(body, 'Severity'),
        confidence: extractField(body, 'Confidence'),
        validEvidenceCount,
        evidenceKey: buildEvidenceKey(evidenceQuotes),
      };
    });
  return { intro, findings };
}

function scoreNumber(value?: string) {
  if (!value) return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function isHighBand(scores?: BenchmarkPostgenFilterScores) {
  const values = [
    scoreNumber(scores?.overall),
    scoreNumber(scores?.taskResponse),
    scoreNumber(scores?.coherenceCohesion),
    scoreNumber(scores?.lexicalResource),
    scoreNumber(scores?.gra),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.some((value) => value >= 8);
}

function compactKey(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9à-ỹ\s]/gi, ' ')
    .replace(/\b(error|lỗi|vấn đề|chưa|thiếu|yếu|sai|không)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removalReason(finding: FindingBlock, seenEvidence: Set<string>, scores?: BenchmarkPostgenFilterScores) {
  const text = normalizeText(`${finding.title}\n${finding.body}`);
  const criterion = normalizeText(finding.criterion);
  const severity = normalizeText(finding.severity);
  const confidence = normalizeText(finding.confidence);

  if (finding.validEvidenceCount === 0) {
    return 'No exact original evidence quote resolves to the essay.';
  }

  if (finding.evidenceKey && seenEvidence.has(finding.evidenceKey)) {
    return 'Duplicate finding anchored to the same evidence as an earlier Must-Catch error.';
  }

  const lowCertainty = severity.includes('minor') || confidence.includes('low') || confidence.includes('medium');
  const preferenceLanguage = /\b(more natural|less natural|better choice|prefer|could be improved|acceptable|not wrong|không sai|tự nhiên hơn|nên chọn|phổ biến hơn|mượt hơn)\b/i.test(text);
  if (lowCertainty && preferenceLanguage) {
    return 'Low-certainty style/preference issue should not be a Must-Catch error.';
  }

  const isLanguage = criterion.includes('lexical') || criterion.includes('grammar') || criterion.includes('gra') || criterion.includes('lr');
  if (isLanguage && preferenceLanguage && finding.validEvidenceCount < 2) {
    return 'Single local language preference without enough repeated evidence.';
  }

  const isArgumentFlow = criterion.includes('task') || criterion.includes('coherence') || criterion.includes('cohesion');
  const broadClaim = /\b(unclear position|underdeveloped|weak development|logical gap|thiếu cơ chế|chưa phát triển|chưa rõ lập trường|không rõ lập trường|mạch lạc yếu)\b/i.test(text);
  if (isHighBand(scores) && isArgumentFlow && broadClaim && finding.validEvidenceCount < 2) {
    return 'High-band overclaim with too little anchored evidence.';
  }

  return '';
}

function renumberFinding(index: number, finding: FindingBlock) {
  return `### Error ${index}: ${finding.title}\n${finding.body}`.trim();
}

export function filterBenchmarkAssessmentMarkdown(input: {
  markdown: string;
  essay: string;
  scores?: BenchmarkPostgenFilterScores;
}) {
  const bounds = sectionBounds(input.markdown, 5);
  if (!bounds) {
    return {
      markdown: input.markdown,
      audit: {
        version: BENCHMARK_POSTGEN_FILTER_VERSION,
        keptCount: 0,
        removedCount: 0,
        removed: [],
      } satisfies BenchmarkPostgenFilterAudit,
    };
  }

  const normalizedEssay = normalizeText(input.essay);
  const section = input.markdown.slice(bounds.start, bounds.end);
  const { intro, findings } = parseMustCatchBlocks(section, normalizedEssay);
  const seenEvidence = new Set<string>();
  const kept: FindingBlock[] = [];
  const removed: BenchmarkPostgenRemovedFinding[] = [];

  for (const finding of findings) {
    const reason = removalReason(finding, seenEvidence, input.scores);
    const titleKey = compactKey(finding.title);
    const duplicateTitle = kept.some((item) => {
      const existing = compactKey(item.title);
      return titleKey && existing && (titleKey.includes(existing) || existing.includes(titleKey));
    });

    if (reason || duplicateTitle) {
      removed.push({
        title: finding.title,
        criterion: finding.criterion,
        reason: reason || 'Duplicate finding title/scope.',
      });
      continue;
    }

    if (finding.evidenceKey) seenEvidence.add(finding.evidenceKey);
    kept.push(finding);
  }

  const replacement = [
    intro || '## 5. Must-Catch Errors',
    '',
    ...(kept.length
      ? kept.flatMap((finding, index) => [renumberFinding(index + 1, finding), ''])
      : ['No Must-Catch errors survived the evidence filter.', '']),
  ].join('\n').trimEnd();

  return {
    markdown: `${input.markdown.slice(0, bounds.start)}${replacement}${input.markdown.slice(bounds.end)}`,
    audit: {
      version: BENCHMARK_POSTGEN_FILTER_VERSION,
      keptCount: kept.length,
      removedCount: removed.length,
      removed,
    } satisfies BenchmarkPostgenFilterAudit,
  };
}
