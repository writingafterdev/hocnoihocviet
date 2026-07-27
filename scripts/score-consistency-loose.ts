import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildEssayManifest } from '../src/lib/writing-analysis-contract';

type Run = {
  status: string;
  evidenceSignatures?: string[];
  candidateEvidenceSignatures?: string[];
  wallTimeMs?: number;
  usage?: {
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
  };
  scores?: { overall?: number };
  counts?: { total?: number };
};

type Report = {
  cases: Array<{
    expectedOverall: number;
    sourceUrl: string;
    essay?: string;
    runs: Run[];
  }>;
};

type SourceFile = {
  results: Array<{
    status: string;
    externalOverall: string;
    sourceUrl: string;
    essay: string;
  }>;
};

type Area = {
  criterion: string;
  text: string;
  start: number;
  end: number;
  sentenceIndex: number;
};

const REPORT = resolve(process.cwd(), process.argv[2] || 'tmp/mimo-v8-consistency-5x3-temperature-0-v1-cleaned.json');
const SOURCE = resolve(process.cwd(), 'tmp/benchmark-prompt-ab/v2.2.5-vs-v2.2.6-youpass-sample/results.json');
const PAIRS = [[0, 1], [0, 2], [1, 2]] as const;
const CRITERIA = [
  'task_response',
  'coherence',
  'cohesion',
  'lexical_resource',
  'grammatical_range_accuracy',
];

function normalize(value: string) {
  return value.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
}

function tokens(value: string) {
  return normalize(value).match(/[a-z]+(?:['’][a-z]+)?/g) || [];
}

function exactJaccard(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const item of leftSet) if (rightSet.has(item)) intersection += 1;
  return intersection / union.size;
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function parse(signature: string) {
  const divider = signature.indexOf('|');
  return {
    criterion: divider < 0 ? 'unknown' : signature.slice(0, divider),
    text: divider < 0 ? signature : signature.slice(divider + 1),
  };
}

function resolveAreas(signatures: string[], essay: string): Area[] {
  const manifest = buildEssayManifest(essay);
  const normalizedEssay = normalize(essay);
  const sentences = manifest.flatMap(paragraph => paragraph.sentences);
  return signatures.map(signature => {
    const parsed = parse(signature);
    const text = normalize(parsed.text);
    const start = normalizedEssay.indexOf(text);
    const end = start < 0 ? -1 : start + text.length;
    const sentenceIndex = sentences.findIndex(sentence => {
      const sentenceStart = normalize(essay.slice(0, sentence.startChar)).length;
      const sentenceText = normalize(sentence.text);
      const sentenceEnd = sentenceStart + sentenceText.length;
      return start >= 0 && start < sentenceEnd && end > sentenceStart;
    });
    return { criterion: parsed.criterion, text, start, end, sentenceIndex };
  });
}

function sameArea(left: Area, right: Area) {
  if (left.criterion !== right.criterion) return false;
  if (left.text === right.text) return true;
  if (left.start >= 0 && right.start >= 0 && left.start < right.end && right.start < left.end) return true;
  if (left.sentenceIndex >= 0 && left.sentenceIndex === right.sentenceIndex) return true;
  return tokenOverlap(left.text, right.text) >= 0.75;
}

function looseJaccard(left: Area[], right: Area[]) {
  if (!left.length && !right.length) return 1;
  const usedRight = new Set<number>();
  let matches = 0;
  for (const leftArea of left) {
    const matchIndex = right.findIndex((rightArea, index) => !usedRight.has(index) && sameArea(leftArea, rightArea));
    if (matchIndex >= 0) {
      usedRight.add(matchIndex);
      matches += 1;
    }
  }
  return matches / (left.length + right.length - matches);
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreLayer(
  runs: Run[],
  essay: string,
  signatureForRun: (run: Run) => string[],
) {
  const allExact: number[] = [];
  const allLoose: number[] = [];
  const exactByCriterion = new Map(CRITERIA.map(criterion => [criterion, [] as number[]]));
  const looseByCriterion = new Map(CRITERIA.map(criterion => [criterion, [] as number[]]));
  const signaturesByRun = runs.map(signatureForRun);
  const areasByRun = signaturesByRun.map(signatures => resolveAreas(signatures, essay));

  for (const [leftIndex, rightIndex] of PAIRS) {
    if (!runs[leftIndex] || !runs[rightIndex]) continue;
    const leftSignatures = signaturesByRun[leftIndex] || [];
    const rightSignatures = signaturesByRun[rightIndex] || [];
    allExact.push(exactJaccard(leftSignatures, rightSignatures));
    allLoose.push(looseJaccard(areasByRun[leftIndex], areasByRun[rightIndex]));

    for (const criterion of CRITERIA) {
      exactByCriterion.get(criterion)?.push(
        exactJaccard(
          leftSignatures.filter(item => item.startsWith(`${criterion}|`)),
          rightSignatures.filter(item => item.startsWith(`${criterion}|`)),
        ),
      );
      looseByCriterion.get(criterion)?.push(
        looseJaccard(
          areasByRun[leftIndex].filter(item => item.criterion === criterion),
          areasByRun[rightIndex].filter(item => item.criterion === criterion),
        ),
      );
    }
  }

  return {
    exactEvidenceOverlap: avg(allExact),
    looseAreaOverlap: avg(allLoose),
    exactByCriterion: Object.fromEntries([...exactByCriterion].map(([criterion, values]) => [criterion, avg(values)])),
    looseByCriterion: Object.fromEntries([...looseByCriterion].map(([criterion, values]) => [criterion, avg(values)])),
    avgCount: avg(signaturesByRun.map(signatures => signatures.length)),
  };
}

async function main() {
  const [report, source] = await Promise.all([
    readFile(REPORT, 'utf8').then(raw => JSON.parse(raw) as Report),
    readFile(SOURCE, 'utf8').then(raw => JSON.parse(raw) as SourceFile),
  ]);

  const essaysByUrl = new Map(source.results.map(row => [row.sourceUrl, row.essay]));
  const allExact: number[] = [];
  const allLoose: number[] = [];
  const allCandidateExact: number[] = [];
  const allCandidateLoose: number[] = [];
  const exactByCriterion = new Map(CRITERIA.map(criterion => [criterion, [] as number[]]));
  const looseByCriterion = new Map(CRITERIA.map(criterion => [criterion, [] as number[]]));
  const candidateExactByCriterion = new Map(CRITERIA.map(criterion => [criterion, [] as number[]]));
  const candidateLooseByCriterion = new Map(CRITERIA.map(criterion => [criterion, [] as number[]]));
  const cases = [];

  for (const testCase of report.cases) {
    const essay = testCase.essay || essaysByUrl.get(testCase.sourceUrl);
    if (!essay) throw new Error(`Missing source essay for ${testCase.sourceUrl}`);
    const runs = testCase.runs.filter(run => run.status === 'complete');
    const areasByRun = runs.map(run => resolveAreas(run.evidenceSignatures || [], essay));
    const candidateAreasByRun = runs.map(run => resolveAreas(run.candidateEvidenceSignatures || run.evidenceSignatures || [], essay));
    const caseExact: number[] = [];
    const caseLoose: number[] = [];
    const caseCandidateExact: number[] = [];
    const caseCandidateLoose: number[] = [];

    for (const [leftIndex, rightIndex] of PAIRS) {
      if (!runs[leftIndex] || !runs[rightIndex]) continue;
      const leftSignatures = runs[leftIndex].evidenceSignatures || [];
      const rightSignatures = runs[rightIndex].evidenceSignatures || [];
      const leftCandidateSignatures = runs[leftIndex].candidateEvidenceSignatures || leftSignatures;
      const rightCandidateSignatures = runs[rightIndex].candidateEvidenceSignatures || rightSignatures;
      const exact = exactJaccard(leftSignatures, rightSignatures);
      const loose = looseJaccard(areasByRun[leftIndex], areasByRun[rightIndex]);
      const candidateExact = exactJaccard(leftCandidateSignatures, rightCandidateSignatures);
      const candidateLoose = looseJaccard(candidateAreasByRun[leftIndex], candidateAreasByRun[rightIndex]);
      allExact.push(exact);
      allLoose.push(loose);
      allCandidateExact.push(candidateExact);
      allCandidateLoose.push(candidateLoose);
      caseExact.push(exact);
      caseLoose.push(loose);
      caseCandidateExact.push(candidateExact);
      caseCandidateLoose.push(candidateLoose);

      for (const criterion of CRITERIA) {
        exactByCriterion.get(criterion)?.push(
          exactJaccard(
            leftSignatures.filter(item => item.startsWith(`${criterion}|`)),
            rightSignatures.filter(item => item.startsWith(`${criterion}|`)),
          ),
        );
        looseByCriterion.get(criterion)?.push(
          looseJaccard(
            areasByRun[leftIndex].filter(item => item.criterion === criterion),
            areasByRun[rightIndex].filter(item => item.criterion === criterion),
          ),
        );
        candidateExactByCriterion.get(criterion)?.push(
          exactJaccard(
            leftCandidateSignatures.filter(item => item.startsWith(`${criterion}|`)),
            rightCandidateSignatures.filter(item => item.startsWith(`${criterion}|`)),
          ),
        );
        candidateLooseByCriterion.get(criterion)?.push(
          looseJaccard(
            candidateAreasByRun[leftIndex].filter(item => item.criterion === criterion),
            candidateAreasByRun[rightIndex].filter(item => item.criterion === criterion),
          ),
        );
      }
    }

    cases.push({
      expected: testCase.expectedOverall,
      exact: avg(caseExact),
      loose: avg(caseLoose),
      candidateExact: avg(caseCandidateExact),
      candidateLoose: avg(caseCandidateLoose),
      scores: runs.map(run => run.scores?.overall),
      totals: runs.map(run => run.counts?.total),
      candidateTotals: runs.map(run => run.candidateEvidenceSignatures?.length),
    });
  }

  const completed = report.cases.flatMap(testCase => testCase.runs).filter(run => run.status === 'complete');
  const usage = completed.flatMap(run => run.usage ? [run.usage] : []);

  console.log(JSON.stringify({
    file: REPORT,
    cases: report.cases.length,
    runs: completed.length,
    exactEvidenceOverlap: avg(allExact),
    looseAreaOverlap: avg(allLoose),
    candidateExactEvidenceOverlap: avg(allCandidateExact),
    candidateLooseAreaOverlap: avg(allCandidateLoose),
    exactByCriterion: Object.fromEntries([...exactByCriterion].map(([criterion, values]) => [criterion, avg(values)])),
    looseByCriterion: Object.fromEntries([...looseByCriterion].map(([criterion, values]) => [criterion, avg(values)])),
    candidateExactByCriterion: Object.fromEntries([...candidateExactByCriterion].map(([criterion, values]) => [criterion, avg(values)])),
    candidateLooseByCriterion: Object.fromEntries([...candidateLooseByCriterion].map(([criterion, values]) => [criterion, avg(values)])),
    perCase: cases,
    avgSelectedCount: avg(completed.map(run => run.evidenceSignatures?.length || 0)),
    avgCandidateCount: avg(completed.map(run => run.candidateEvidenceSignatures?.length || run.evidenceSignatures?.length || 0)),
    avgWallTimeMs: avg(completed.map(run => run.wallTimeMs || 0)),
    avgPromptTokens: avg(usage.map(item => item.promptTokens)),
    avgCompletionTokens: avg(usage.map(item => item.completionTokens)),
    avgTotalTokens: avg(usage.map(item => item.totalTokens)),
    totalCostUsd: usage.reduce((sum, item) => sum + item.costUsd, 0),
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
