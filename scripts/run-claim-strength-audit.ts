import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  auditClaimStrength,
  CLAIM_STRENGTH_AUDIT_VERSION,
  type ClaimStrengthAuditResult,
} from '../src/lib/claim-strength-audit';

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

type AuditRow = {
  caseId: string;
  heading: string;
  examinerOverall: string;
  examinerPriorities: string[];
  assessmentPromptVersion: string;
  auditVersion: string;
  audit?: ClaimStrengthAuditResult;
  error?: string;
};

const ROOT = process.cwd();
const DEFAULT_INPUT = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/v2.1-gate/results.json',
);
const DEFAULT_OUT_DIR = path.join(
  ROOT,
  'tmp/examiner-calibration-audit/claim-strength-audit-v1',
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

function markdownFor(rows: AuditRow[]) {
  return [
    '# Claim Strength Audit',
    '',
    `Cases: ${rows.length}`,
    '',
    ...rows.flatMap((row) => [
      `## ${row.caseId} - ${row.heading}`,
      '',
      `Examiner overall: ${row.examinerOverall}`,
      '',
      '### Examiner priorities',
      '',
      ...row.examinerPriorities.map((priority) => `- ${priority}`),
      '',
      '### Audit decisions',
      '',
      ...(row.audit?.decisions.length
        ? row.audit.decisions.flatMap((decision, index) => [
          `#### ${index + 1}. ${decision.findingTitle}`,
          '',
          `Diagnosis: ${decision.finalDiagnosis} | Position conflict: ${decision.positionConflict ? 'yes' : 'no'} | Action: ${decision.action} | Severity: ${decision.severity} | Confidence: ${decision.confidence}`,
          '',
          `Evidence: \`${decision.evidence}\``,
          '',
          decision.rationaleVi,
          '',
          `Repair: ${decision.repairVi}`,
          '',
        ])
        : [`No decisions. ${row.error || row.audit?.summaryVi || ''}`, '']),
      row.audit?.summaryVi ? `Summary: ${row.audit.summaryVi}` : '',
      '',
      '---',
      '',
    ]),
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

  const audited = await runPool(selectedRows, concurrency, async (row): Promise<AuditRow> => {
    if (!row.result?.assessmentMarkdown) {
      return {
        caseId: row.caseId,
        heading: row.heading,
        examinerOverall: row.examinerOverall,
        examinerPriorities: row.examinerPriorities,
        assessmentPromptVersion: row.result?.promptVersion || 'missing',
        auditVersion: CLAIM_STRENGTH_AUDIT_VERSION,
        error: 'Missing assessment markdown.',
      };
    }

    console.info('[claim-strength-audit]', row.caseId);
    try {
      const audit = await auditClaimStrength({
        question: row.question,
        essay: row.cleanedEssay,
        assessmentMarkdown: row.result.assessmentMarkdown,
        requestLabel: `claim-strength-audit-${row.caseId}`,
      });
      return {
        caseId: row.caseId,
        heading: row.heading,
        examinerOverall: row.examinerOverall,
        examinerPriorities: row.examinerPriorities,
        assessmentPromptVersion: row.result.promptVersion,
        auditVersion: CLAIM_STRENGTH_AUDIT_VERSION,
        audit,
      };
    } catch (error) {
      return {
        caseId: row.caseId,
        heading: row.heading,
        examinerOverall: row.examinerOverall,
        examinerPriorities: row.examinerPriorities,
        assessmentPromptVersion: row.result.promptVersion,
        auditVersion: CLAIM_STRENGTH_AUDIT_VERSION,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const jsonPath = path.join(outDir, 'results.json');
  const markdownPath = path.join(outDir, 'results.md');
  await writeFile(jsonPath, JSON.stringify(audited, null, 2));
  await writeFile(markdownPath, markdownFor(audited));

  console.info(JSON.stringify({
    cases: audited.length,
    errors: audited.filter((row) => row.error).length,
    decisions: audited.reduce(
      (total, row) => total + (row.audit?.decisions.length || 0),
      0,
    ),
    jsonPath,
    markdownPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
