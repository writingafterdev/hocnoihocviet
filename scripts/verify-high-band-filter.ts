/**
 * Replay the band-8 finding filter over the real reference corpus.
 *
 * The filter is pure and takes no model call, so its change can be measured
 * offline against findings that actually occurred. This turns "the band-8 essay
 * came back empty" from a hypothesis into a number.
 *
 * Feeds every "### Error N:" block from a high-band assessment through the old
 * filter and the current one, and reports what each keeps.
 *
 *   npx tsx scripts/verify-high-band-filter.ts
 *   npx tsx scripts/verify-high-band-filter.ts --corpus tmp/corpus/youpass-assessments.json
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { filterLowSignalFindingsForHighBand } from '@/lib/writing-assessment-pipeline-v2';
import type { BandScores } from '@/types/writing';

type Finding = Parameters<typeof filterLowSignalFindingsForHighBand>[0][number];

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const CORPUS = argValue('--corpus') || 'tmp/corpus/youpass-assessments.json';

const CRITERION_BY_LABEL: Record<string, Finding['criterion']> = {
  'task response': 'task_response',
  coherence: 'coherence',
  cohesion: 'cohesion',
  'lexical resource': 'lexical_resource',
  grammar: 'grammatical_range_accuracy',
};

/** The filter as it stood before the fix, reproduced exactly for comparison. */
function legacyFilter(findings: Finding[], scores: BandScores) {
  const bandFor = (criterion: Finding['criterion']) => {
    if (criterion === 'task_response') return scores.taskAchievement;
    if (criterion === 'coherence' || criterion === 'cohesion') return scores.coherenceCohesion;
    if (criterion === 'lexical_resource') return scores.lexicalResource;
    return scores.grammaticalRange;
  };
  const combined = (finding: Finding) => [
    finding.errorLabelVi, finding.diagnosisVi, finding.readerEffectVi,
    finding.repairDirectionVi, finding.replacementText,
    ...finding.evidence.map(item => item.sourceText),
  ].join(' ').toLocaleLowerCase('vi');
  const wasStyleOpinion = (finding: Finding) => {
    if (finding.criterion !== 'lexical_resource' && finding.criterion !== 'grammatical_range_accuracy') return false;
    const text = combined(finding);
    return /hoàn toàn chính xác|mặc dù[^.]{0,100}đúng|cũng chính xác|không phải lỗi chắc chắn|tự nhiên hơn|phổ biến hơn|người ta thường dùng|style preference|stylistic preference|more natural|more common|would choose|i would choose/.test(text)
      && !/không đúng nghĩa|sai nghĩa|sai cấu trúc|sai ngữ pháp|làm hỏng cấu trúc|wrong meaning|incorrect meaning|ungrammatical/.test(text);
  };
  return findings.filter(finding => {
    if (finding.verdict !== 'confirmed') return false;
    if (bandFor(finding.criterion) < 8) return true;
    if (wasStyleOpinion(finding)) return true;
    const text = combined(finding);
    if (finding.criterion === 'lexical_resource'
      && /hoàn toàn chính xác|đúng nghĩa|tự nhiên hơn|phổ biến hơn|người ta thường dùng|stylistic|style|preference|more natural|more common/.test(text)) return false;
    if (finding.criterion === 'grammatical_range_accuracy'
      && (finding.evidence.some(item => finding.replacementText && item.sourceText.includes(finding.replacementText.trim()))
        || /cũng chính xác|tự nhiên hơn|phổ biến hơn|một số ngữ cảnh|sai sót nhỏ về sự trôi chảy|style|preference|more natural|more common/.test(text))) return false;
    if (finding.criterion === 'cohesion'
      && /mặc dù hai ý liên quan|có thể cải thiện|thêm một cụm từ liên kết|could improve|would improve/.test(text)) return false;
    if (finding.severity !== 'minor') return true;
    return false;
  });
}

function parseFindings(markdown: string): Finding[] {
  const blocks = markdown.split(/^### Error \d+:/m).slice(1);
  return blocks.map((block, index) => {
    const criterionLabel = block.match(/^Criterion:\s*(.+)$/m)?.[1]?.trim().toLowerCase() || '';
    const severity = (block.match(/^Severity:\s*(major|medium|minor)/mi)?.[1] || 'medium').toLowerCase();
    const quote = block.match(/^>\s*(.+)$/m)?.[1]?.trim() || '';
    const criterion = CRITERION_BY_LABEL[criterionLabel]
      // Compound labels such as "grammar / lexical resource" take the first match.
      || Object.entries(CRITERION_BY_LABEL).find(([label]) => criterionLabel.includes(label))?.[1];
    if (!criterion || !quote) return null;
    return {
      id: `f${index}`,
      criterion,
      severity: severity === 'medium' ? 'moderate' : severity,
      confidence: 0.9,
      evidence: [{ paragraphIndex: 0, sourceText: quote, role: 'primary' }],
      // The filter reads all prose fields as one blob, so the block body stands
      // in for the diagnosis it would have carried.
      diagnosisVi: block.slice(0, 2000),
      readerEffectVi: '',
      repairDirectionVi: '',
      errorCode: 'parsed',
      verdict: 'confirmed',
      verificationVi: '',
    } as Finding;
  }).filter((finding): finding is Finding => finding !== null);
}

function bandScores(value: number): BandScores {
  return {
    taskAchievement: value,
    coherenceCohesion: value,
    lexicalResource: value,
    grammaticalRange: value,
    overall: value,
  };
}

async function main() {
  const corpus = JSON.parse(await readFile(path.resolve(CORPUS), 'utf8')) as Array<{
    humanScores: { overall?: string };
    assessmentMarkdown: string;
  }>;

  const highBand = corpus
    .map(entry => ({ band: parseFloat(entry.humanScores?.overall || ''), markdown: entry.assessmentMarkdown }))
    .filter(entry => Number.isFinite(entry.band) && entry.band >= 8 && entry.markdown);

  let legacyKept = 0;
  let currentKept = 0;
  let total = 0;
  let legacyEmpty = 0;
  let currentEmpty = 0;
  const recovered: Record<string, number> = {};

  for (const entry of highBand) {
    const findings = parseFindings(entry.markdown);
    if (!findings.length) continue;
    const scores = bandScores(Math.round(entry.band));
    const before = legacyFilter(findings, scores);
    const after = filterLowSignalFindingsForHighBand(findings, scores);
    total += findings.length;
    legacyKept += before.length;
    currentKept += after.length;
    if (!before.length) legacyEmpty += 1;
    if (!after.length) currentEmpty += 1;
    const beforeIds = new Set(before.map(finding => finding.id));
    for (const finding of after) {
      if (!beforeIds.has(finding.id)) recovered[finding.criterion] = (recovered[finding.criterion] || 0) + 1;
    }
  }

  const essays = highBand.filter(entry => parseFindings(entry.markdown).length).length;
  console.log(`high-band essays (human >= 8) with parsed findings: ${essays}`);
  console.log(`findings before any filtering:                      ${total}`);
  console.log('');
  console.log(`old filter kept:  ${legacyKept} (${(legacyKept / total * 100).toFixed(1)}%)   essays left with nothing: ${legacyEmpty} (${(legacyEmpty / essays * 100).toFixed(1)}%)`);
  console.log(`new filter kept:  ${currentKept} (${(currentKept / total * 100).toFixed(1)}%)   essays left with nothing: ${currentEmpty} (${(currentEmpty / essays * 100).toFixed(1)}%)`);
  console.log('');
  console.log('findings the old filter discarded and the new one keeps, by criterion:');
  for (const [criterion, count] of Object.entries(recovered).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${criterion.padEnd(28)} ${count}`);
  }
}

main().catch(error => {
  console.error('Verification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
