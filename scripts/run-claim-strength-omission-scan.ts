import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CLAIM_STRENGTH_OMISSION_SCAN_VERSION,
  scanClaimStrengthOmission,
  type ClaimStrengthOmissionScanResult,
} from '../src/lib/claim-strength-omission-scan';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type CalibrationResult = {
  caseId: string;
  heading: string;
  examinerOverall: string;
  question: string;
  cleanedEssay: string;
  examinerPriorities: string[];
  result?: {
    promptVersion: string;
    assessmentMarkdown: string;
  };
};

type ScanRow = {
  caseId: string;
  heading: string;
  examinerOverall: string;
  examinerPriorities: string[];
  assessmentPromptVersion: string;
  scanVersion: string;
  scan?: ClaimStrengthOmissionScanResult;
  error?: string;
};

const ROOT = process.cwd();
const DEFAULT_INPUT = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/v2.1-gate/results.json',
);
const DEFAULT_OUT_DIR = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/claim-strength-omission-scan-v1',
);

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  );
  return results;
}

function markdownFor(rows: ScanRow[]) {
  return [
    '# Claim Strength Omission Scan',
    '',
    `Cases: ${rows.length}`,
    '',
    ...rows.flatMap((row) => {
      const candidate = row.scan?.candidate;
      return [
        `## ${row.caseId} - ${row.heading}`,
        '',
        `Examiner overall: ${row.examinerOverall}`,
        '',
        '### Examiner priorities',
        '',
        ...row.examinerPriorities.map((priority) => `- ${priority}`),
        '',
        '### Omission candidate',
        '',
        ...(candidate
          ? [
            `Problem: ${candidate.claimProblem} | Role: ${candidate.argumentRole} | Severity: ${candidate.severity} | Confidence: ${candidate.confidence}`,
            '',
            `Exact claim: \`${candidate.exactClaim}\``,
            '',
            `Context: \`${candidate.paragraphContext}\``,
            '',
            candidate.rationaleVi,
            '',
            `Why more explanation is insufficient: ${candidate.whyExplanationIsInsufficientVi}`,
            '',
            `Repair: ${candidate.repairVi}`,
          ]
          : [`None. ${row.error || row.scan?.summaryVi || ''}`]),
        '',
        '---',
        '',
      ];
    }),
  ].join('\n');
}

async function main() {
  const inputPath = path.resolve(argValue('--input') || DEFAULT_INPUT);
  const outDir = path.resolve(argValue('--out-dir') || DEFAULT_OUT_DIR);
  const concurrency = Math.min(
    Math.max(Number(argValue('--concurrency') || 2), 1),
    4,
  );
  const rows = JSON.parse(
    await readFile(inputPath, 'utf8'),
  ) as CalibrationResult[];
  const requestedCaseIds = new Set(
    String(argValue('--case-ids') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const selectedRows = rows.filter(
    (row) => requestedCaseIds.size === 0 || requestedCaseIds.has(row.caseId),
  );

  await mkdir(outDir, { recursive: true });

  const scanned = await runPool(
    selectedRows,
    concurrency,
    async (row): Promise<ScanRow> => {
      if (!row.result?.assessmentMarkdown) {
        return {
          caseId: row.caseId,
          heading: row.heading,
          examinerOverall: row.examinerOverall,
          examinerPriorities: row.examinerPriorities,
          assessmentPromptVersion: row.result?.promptVersion || 'missing',
          scanVersion: CLAIM_STRENGTH_OMISSION_SCAN_VERSION,
          error: 'Missing assessment markdown.',
        };
      }

      console.info('[claim-strength-omission-scan]', row.caseId);
      try {
        const scan = await scanClaimStrengthOmission({
          question: row.question,
          essay: row.cleanedEssay,
          assessmentMarkdown: row.result.assessmentMarkdown,
          requestLabel: `claim-strength-omission-scan-${row.caseId}`,
        });
        return {
          caseId: row.caseId,
          heading: row.heading,
          examinerOverall: row.examinerOverall,
          examinerPriorities: row.examinerPriorities,
          assessmentPromptVersion: row.result.promptVersion,
          scanVersion: CLAIM_STRENGTH_OMISSION_SCAN_VERSION,
          scan,
        };
      } catch (error) {
        return {
          caseId: row.caseId,
          heading: row.heading,
          examinerOverall: row.examinerOverall,
          examinerPriorities: row.examinerPriorities,
          assessmentPromptVersion: row.result.promptVersion,
          scanVersion: CLAIM_STRENGTH_OMISSION_SCAN_VERSION,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  const jsonPath = path.join(outDir, 'results.json');
  const markdownPath = path.join(outDir, 'results.md');
  await writeFile(jsonPath, JSON.stringify(scanned, null, 2));
  await writeFile(markdownPath, markdownFor(scanned));

  console.info(JSON.stringify({
    cases: scanned.length,
    errors: scanned.filter((row) => row.error).length,
    candidates: scanned.filter((row) => row.scan?.candidate).length,
    jsonPath,
    markdownPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
