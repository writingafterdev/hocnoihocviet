import assert from 'node:assert/strict';
import test from 'node:test';
import { filterLowSignalFindingsForHighBand } from '@/lib/writing-assessment-pipeline-v2';
import type { BandScores } from '@/types/writing';

type Finding = Parameters<typeof filterLowSignalFindingsForHighBand>[0][number];

const BAND_8: BandScores = {
  taskAchievement: 8,
  coherenceCohesion: 8,
  lexicalResource: 8,
  grammaticalRange: 8,
  overall: 8,
};
const BAND_6: BandScores = {
  taskAchievement: 6,
  coherenceCohesion: 6,
  lexicalResource: 6,
  grammaticalRange: 6,
  overall: 6,
};

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    criterion: 'lexical_resource',
    severity: 'minor',
    confidence: 0.9,
    evidence: [{ paragraphIndex: 1, sourceText: 'open opportunities', role: 'primary' }],
    diagnosisVi: '',
    readerEffectVi: '',
    repairDirectionVi: '',
    errorCode: 'wrong_word_choice',
    verdict: 'confirmed',
    verificationVi: '',
    ...overrides,
  } as Finding;
}

test('keeps a wrong-meaning lexical error at band 8 even though it is minor', () => {
  // "không đúng nghĩa" contains "đúng nghĩa"; the old drop pattern matched the
  // substring and discarded exactly the findings worth keeping.
  const kept = filterLowSignalFindingsForHighBand(
    [finding({ diagnosisVi: 'Từ này không đúng nghĩa trong ngữ cảnh này.' })],
    BAND_8,
  );
  assert.equal(kept.length, 1);
});

test('drops a pure style preference at band 8', () => {
  const kept = filterLowSignalFindingsForHighBand(
    [finding({ diagnosisVi: 'Cụm "create opportunities" nghe tự nhiên hơn.' })],
    BAND_8,
  );
  assert.equal(kept.length, 0);
});

test('keeps a minor but genuine grammar error at band 8', () => {
  const kept = filterLowSignalFindingsForHighBand(
    [finding({
      criterion: 'grammatical_range_accuracy',
      severity: 'minor',
      diagnosisVi: 'Sau "has" cần "become"; ở đây dùng sai thì.',
    })],
    BAND_8,
  );
  assert.equal(kept.length, 1);
});

test('drops a grammar suggestion whose replacement already appears in the evidence', () => {
  const kept = filterLowSignalFindingsForHighBand(
    [finding({
      criterion: 'grammatical_range_accuracy',
      evidence: [{ paragraphIndex: 1, sourceText: 'has become an important part', role: 'primary' }],
      replacementText: 'has become',
      diagnosisVi: 'Cân nhắc chỉnh lại cụm này.',
    })],
    BAND_8,
  );
  assert.equal(kept.length, 0);
});

test('drops a cohesion improvement suggestion at band 8 but keeps a stated breakdown', () => {
  const suggestion = finding({
    criterion: 'cohesion',
    diagnosisVi: 'Chỗ này có thể cải thiện bằng một từ nối.',
  });
  const breakdown = finding({
    criterion: 'cohesion',
    diagnosisVi: 'Đại từ "they" dùng sai, không rõ nhắc tới nhóm nào.',
  });
  assert.equal(filterLowSignalFindingsForHighBand([suggestion], BAND_8).length, 0);
  assert.equal(filterLowSignalFindingsForHighBand([breakdown], BAND_8).length, 1);
});

test('keeps everything confirmed below band 8, including soft suggestions', () => {
  const kept = filterLowSignalFindingsForHighBand(
    [
      finding({ diagnosisVi: 'Cụm này nghe tự nhiên hơn nếu đổi.' }),
      finding({ diagnosisVi: 'Từ này không đúng nghĩa.' }),
    ],
    BAND_6,
  );
  assert.equal(kept.length, 2);
});

test('always drops unconfirmed findings', () => {
  const kept = filterLowSignalFindingsForHighBand(
    [finding({ verdict: 'rejected', diagnosisVi: 'Từ này không đúng nghĩa.' })],
    BAND_6,
  );
  assert.equal(kept.length, 0);
});
