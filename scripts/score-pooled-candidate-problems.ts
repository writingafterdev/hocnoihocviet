import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Run = {
  status: string;
  scores?: { overall?: number };
  candidateEvidenceSignatures?: string[];
  candidateSeverityEvidenceSignatures?: string[];
  candidateProblemStrengthEvidenceSignatures?: string[];
};

type Report = {
  cases: Array<{
    prompt: string;
    essay: string;
    runs: Run[];
  }>;
};

type Area = {
  problemStrength: 'core_problem' | 'worth_noting' | 'unlabeled';
  criterion: string;
  text: string;
  start: number;
  end: number;
  sentenceIndex: number;
};

const REPORT = resolve(process.cwd(), process.argv[2] || '');
if (!REPORT) throw new Error('Usage: tsx scripts/score-pooled-candidate-problems.ts <report.json>');

const PAIRS = [[0, 1], [0, 2], [1, 2]] as const;

function normalize(value: string) {
  return value.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
}

function tokens(value: string) {
  return normalize(value).match(/[a-z]+(?:['’][a-z]+)?/g) || [];
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function sentenceRanges(essay: string) {
  const ranges: Array<{ start: number; end: number; text: string }> = [];
  const pattern = /[^.!?]+[.!?]+|[^.!?]+$/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(essay))) {
    const text = match[0].trim();
    if (text) ranges.push({ start: match.index, end: match.index + match[0].length, text });
  }
  return ranges;
}

function parseSignature(signature: string): { problemStrength: Area['problemStrength']; criterion: string; text: string } {
  const parts = signature.split('|');
  if (parts[0] === 'core_problem' || parts[0] === 'worth_noting') {
    return {
      problemStrength: parts[0],
      criterion: parts[1] || 'unknown',
      text: parts.slice(2).join('|'),
    };
  }
  return {
    problemStrength: 'unlabeled',
    criterion: parts[0] || 'unknown',
    text: parts.slice(1).join('|'),
  };
}

function resolveAreas(signatures: string[], essay: string): Area[] {
  const normalizedEssay = normalize(essay);
  const sentences = sentenceRanges(essay)
    .map(sentence => ({
      start: normalize(essay.slice(0, sentence.start)).length,
      text: normalize(sentence.text),
    }))
    .map(sentence => ({ ...sentence, end: sentence.start + sentence.text.length }));

  return [...new Set(signatures)].map(signature => {
    const parsed = parseSignature(signature);
    const text = normalize(parsed.text);
    const start = normalizedEssay.indexOf(text);
    const end = start < 0 ? -1 : start + text.length;
    const sentenceIndex = sentences.findIndex(sentence => (
      start >= 0 && start < sentence.end && end > sentence.start
    ));
    return {
      problemStrength: parsed.problemStrength,
      criterion: parsed.criterion,
      text,
      start,
      end,
      sentenceIndex,
    };
  });
}

function sameProblem(left: Area, right: Area) {
  // Intentionally ignores criterion ownership.
  if (left.text === right.text) return true;
  if (left.start >= 0 && right.start >= 0 && left.start < right.end && right.start < left.end) return true;
  if (left.sentenceIndex >= 0 && left.sentenceIndex === right.sentenceIndex) return true;
  if (left.text.includes(right.text) || right.text.includes(left.text)) return true;
  return tokenOverlap(left.text, right.text) >= 0.65;
}

function looseJaccard(left: Area[], right: Area[]) {
  if (!left.length && !right.length) return 1;
  const usedRight = new Set<number>();
  let matches = 0;
  for (const leftArea of left) {
    const matchIndex = right.findIndex((rightArea, index) => (
      !usedRight.has(index) && sameProblem(leftArea, rightArea)
    ));
    if (matchIndex >= 0) {
      usedRight.add(matchIndex);
      matches += 1;
    }
  }
  return matches / (left.length + right.length - matches);
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function core(areas: Area[]) {
  return areas.filter(area => area.problemStrength === 'core_problem');
}

function worthNoting(areas: Area[]) {
  return areas.filter(area => area.problemStrength === 'worth_noting');
}

async function main() {
  const report = JSON.parse(await readFile(REPORT, 'utf8')) as Report;
  const all: number[] = [];
  const allCore: number[] = [];
  const allWorth: number[] = [];
  const cases = report.cases.map((testCase, caseIndex) => {
    const runs = testCase.runs.filter(run => run.status === 'complete');
    const areasByRun = runs.map(run => resolveAreas(
      run.candidateProblemStrengthEvidenceSignatures || run.candidateEvidenceSignatures || [],
      testCase.essay,
    ));
    const pairScores: number[] = [];
    const corePairScores: number[] = [];
    const worthPairScores: number[] = [];
    for (const [leftIndex, rightIndex] of PAIRS) {
      if (!areasByRun[leftIndex] || !areasByRun[rightIndex]) continue;
      pairScores.push(looseJaccard(areasByRun[leftIndex], areasByRun[rightIndex]));
      corePairScores.push(looseJaccard(core(areasByRun[leftIndex]), core(areasByRun[rightIndex])));
      worthPairScores.push(looseJaccard(worthNoting(areasByRun[leftIndex]), worthNoting(areasByRun[rightIndex])));
    }
    all.push(...pairScores);
    allCore.push(...corePairScores);
    allWorth.push(...worthPairScores);
    return {
      case: caseIndex + 1,
      prompt: testCase.prompt.slice(0, 90),
      scores: runs.map(run => run.scores?.overall),
      counts: areasByRun.map(areas => ({
        total: areas.length,
        core: core(areas).length,
        worthNoting: worthNoting(areas).length,
      })),
      pooledLoose: avg(pairScores),
      coreLoose: avg(corePairScores),
      worthNotingLoose: avg(worthPairScores),
    };
  });

  const output = {
    file: REPORT,
    cases: report.cases.length,
    runs: report.cases.reduce((sum, testCase) => sum + testCase.runs.filter(run => run.status === 'complete').length, 0),
    pooledCandidateLooseOverlap: avg(all),
    coreCandidateLooseOverlap: avg(allCore),
    worthNotingCandidateLooseOverlap: avg(allWorth),
    perCase: cases,
  };
  console.log(JSON.stringify(output, null, 2));
  await writeFile(
    REPORT.replace(/\.json$/u, '-pooled-core-worth-score.json'),
    JSON.stringify(output, null, 2),
    { mode: 0o600 },
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
