import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveQuoteEvidence, resolveQuoteEvidenceGroup } from '@/lib/assessment-evidence-resolver';
import { buildEssayManifest } from '@/lib/writing-analysis-contract';
import { TAXONOMY_BY_CODE } from '@/lib/assessment-error-taxonomy';
import { hasVerifiedComparisonChanges } from '@/lib/writing-assessment-findings';
import type { WritingAnalysis } from '@/types/writing';
import {
  assessmentPipelineV3Prompts,
  assessmentPipelineV4Prompts,
  assessmentPipelineV6Prompts,
  languageFindingSpanErrors,
  linkTaskResponsePointFindings,
  mergeSupportingInventoryPoints,
  normalizeLanguageReplacementAgainstContext,
  pruneNestedLanguageFindings,
  reconcileCriterionBand,
  reconcileInventoryPointGranularity,
} from '@/lib/writing-assessment-pipeline-v2';

const essay = [
  'Social media spreads news quickly.',
  'People may act on false reports, and people may share them again.',
].join('\n\n');
const manifest = buildEssayManifest(essay);

test('resolves an exact quote without model-supplied offsets', () => {
  const evidence = resolveQuoteEvidence(essay, manifest, {
    paragraphIndex: 1,
    sourceText: 'People may act on false reports',
    role: 'primary',
  });
  assert.ok(evidence);
  assert.equal(evidence.matchType, 'exact');
  assert.equal(essay.slice(evidence.startChar, evidence.endChar), evidence.sourceText);
});

test('does not treat an unchanged comparison essay as a verified rewrite', () => {
  const originalEssay = 'The essay is already strong.';
  const analysis = {
    comparison: {
      targetBand: 9,
      revisedEssay: originalEssay,
      changes: [],
    },
  } as unknown as WritingAnalysis;

  assert.equal(hasVerifiedComparisonChanges(analysis, originalEssay), false);
});

test('renders a comparison rewrite whenever the revised essay differs', () => {
  const originalEssay = 'Social media is useful.';
  const revisedEssay = 'Social media is useful when used responsibly.';
  const withoutChanges = {
    comparison: {
      targetBand: 9,
      revisedEssay,
      changes: [],
    },
  } as unknown as WritingAnalysis;
  const withChanges = {
    comparison: {
      targetBand: 9,
      revisedEssay,
      changes: [{
        criterion: 'taskAchievement',
        originalText: 'Social media is useful.',
        revisedText: revisedEssay,
        reasonVi: 'Làm rõ điều kiện của nhận định.',
      }],
    },
  } as unknown as WritingAnalysis;

  assert.equal(hasVerifiedComparisonChanges(withoutChanges, originalEssay), true);
  assert.equal(hasVerifiedComparisonChanges(withChanges, originalEssay), true);
});

test('resolves punctuation and apostrophe variation through token matching', () => {
  const source = 'Students’ decisions can change quickly.';
  const sourceManifest = buildEssayManifest(source);
  const evidence = resolveQuoteEvidence(source, sourceManifest, {
    paragraphIndex: 0,
    sourceText: "Students' decisions can change quickly",
    role: 'context',
  });
  assert.ok(evidence);
  assert.equal(evidence.matchType, 'token');
  assert.equal(evidence.sourceText, 'Students’ decisions can change quickly');
});

test('splits model ellipses into separate source anchors', () => {
  const evidence = resolveQuoteEvidenceGroup(essay, manifest, {
    paragraphIndex: 1,
    sourceText: 'People may act on false reports ... people may share them again',
    role: 'affected',
  });
  assert.equal(evidence.length, 2);
  assert.deepEqual(evidence.map(item => item?.sourceText), [
    'People may act on false reports',
    'people may share them again',
  ]);
});

test('treats a model paragraph index as a hint rather than source truth', () => {
  const evidence = resolveQuoteEvidence(essay, manifest, {
    paragraphIndex: 0,
    sourceText: 'People may act on false reports',
    role: 'primary',
  });

  assert.equal(evidence?.paragraphIndex, 1);
  assert.equal(evidence?.sourceText, 'People may act on false reports');
});

test('repairs a long quote with one omitted source token', () => {
  const source = 'When used responsibly, social media offers its ability to connect people and provide many useful chances.';
  const sourceManifest = buildEssayManifest(source);
  const evidence = resolveQuoteEvidence(source, sourceManifest, {
    paragraphIndex: 0,
    sourceText: 'its ability to connect people and many useful chances',
    role: 'primary',
  });

  assert.equal(evidence?.matchType, 'fuzzy');
  assert.equal(
    evidence?.sourceText,
    'its ability to connect people and provide many useful chances',
  );
});

test('does not fuzzily resolve a short or ambiguous quote', () => {
  const source = 'Useful chances matter. Useful choices matter.';
  const sourceManifest = buildEssayManifest(source);
  const evidence = resolveQuoteEvidence(source, sourceManifest, {
    paragraphIndex: 0,
    sourceText: 'useful things matter',
    role: 'primary',
  });

  assert.equal(evidence, undefined);
});

test('the v3 examiner explicitly requires the outweigh macro test', () => {
  assert.match(assessmentPipelineV3Prompts.examiner, /stating "outweigh" is not enough/i);
  assert.match(assessmentPipelineV3Prompts.examiner, /establish why one side carries greater weight/i);
  assert.ok(TAXONOMY_BY_CODE.has('unsupported_comparative_judgment'));
});

test('v4 gives each focused reviewer an explicit criterion boundary', () => {
  assert.match(assessmentPipelineV4Prompts.taskResponse, /Run three complete checks/i);
  assert.match(assessmentPipelineV4Prompts.coherenceCohesion, /given information to new information/i);
  assert.match(assessmentPipelineV4Prompts.lexicalResource, /Do not turn an argument/i);
  assert.match(assessmentPipelineV4Prompts.grammar, /Use criterion "grammatical_range_accuracy" only/i);
});

test('v6 inspects every task point without promising exhaustive error discovery', () => {
  assert.match(assessmentPipelineV6Prompts.taskResponse, /does not mean claiming exhaustive error discovery/i);
  assert.match(assessmentPipelineV6Prompts.taskResponse, /do not impose an error quota/i);
  assert.match(assessmentPipelineV6Prompts.taskResponse, /otherwise keep findingIds=\[\]/i);
  assert.match(assessmentPipelineV6Prompts.taskResponseAudit, /There is no minimum finding count/i);
  assert.match(assessmentPipelineV6Prompts.taskResponseAudit, /otherwise findingIds=\[\] is valid/i);
  assert.match(assessmentPipelineV6Prompts.taskResponseForensic, /cannot guarantee that every possible weakness has been discovered/i);
});

test('v6 keeps syntax-owned forms out of lexical feedback and requires atomic language findings', () => {
  assert.match(assessmentPipelineV6Prompts.lexicalResource, /has becoming/i);
  assert.match(assessmentPipelineV6Prompts.lexicalResource, /belongs to Grammar, not Lexical Resource/i);
  assert.match(assessmentPipelineV6Prompts.lexicalResource, /one defect per finding/i);
  assert.match(assessmentPipelineV6Prompts.grammar, /one grammatical defect per finding/i);
  assert.match(assessmentPipelineV6Prompts.grammar, /smallest editable span/i);
});

test('v6 grammar feedback preserves meaning and avoids unexplained metalanguage', () => {
  assert.match(assessmentPipelineV6Prompts.grammar, /preserve the proposition/i);
  assert.match(assessmentPipelineV6Prompts.grammar, /"is evident"/i);
  assert.match(assessmentPipelineV6Prompts.grammar, /"has become" is present perfect/i);
  assert.match(assessmentPipelineV6Prompts.grammar, /Prefer "sau 'has' cần dùng 'become'"/i);
});

test('v6 rejects a grammar repair that completes a fragment with an empty predicate', () => {
  const errors = languageFindingSpanErrors({
    findings: [{
      id: 'grammar:empty-conclusion',
      criterion: 'grammatical_range_accuracy',
      scope: 'local',
      severity: 'moderate',
      evidence: [{
        paragraphIndex: 3,
        sourceText: 'its ability to connect people and provide many useful chances.',
        role: 'primary',
      }],
      errorLabelVi: 'Câu kết luận chưa hoàn chỉnh',
      explanationVi: 'Mệnh đề chính thiếu vị ngữ.',
      repairVi: 'Thêm vị ngữ.',
      replacementText: 'its ability to connect people and provide many useful chances is clear.',
    }],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /semantically empty predicate/i);
});

test('v6 rejects nested language evidence that would create overlapping highlights', () => {
  const errors = languageFindingSpanErrors({
    findings: [
      {
        id: 'grammar:possessive',
        criterion: 'grammatical_range_accuracy',
        scope: 'local',
        severity: 'minor',
        evidence: [{
          paragraphIndex: 1,
          sourceText: "millions of user's data",
          role: 'primary',
        }],
        errorLabelVi: 'Sai dạng sở hữu',
        explanationVi: 'Danh từ chỉ nhiều người dùng cần dạng số nhiều.',
        repairVi: "Đổi thành users' data.",
        replacementText: "millions of users' data",
      },
      {
        id: 'grammar:reported-clause',
        criterion: 'grammatical_range_accuracy',
        scope: 'local',
        severity: 'minor',
        evidence: [{
          paragraphIndex: 1,
          sourceText: "showed millions of user's data is spread quickly",
          role: 'primary',
        }],
        errorLabelVi: 'Mệnh đề sau động từ chưa hoàn chỉnh',
        explanationVi: 'Mệnh đề tường thuật cần được nối và chia thì phù hợp.',
        repairVi: "Đổi thành showed that millions of users' data were spread quickly.",
        replacementText: "showed that millions of users' data were spread quickly",
      },
    ],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /nested evidence/i);
});

test('v6 rejects the same local defect being owned by both lexical resource and grammar', () => {
  const errors = languageFindingSpanErrors({
    findings: [
      {
        id: 'lexical:recently-chatgpt',
        criterion: 'lexical_resource',
        scope: 'local',
        severity: 'minor',
        evidence: [{
          paragraphIndex: 1,
          sourceText: 'recently Chat GPT',
          role: 'primary',
        }],
        errorLabelVi: 'Chọn dạng từ chưa đúng',
        explanationVi: 'Cụm thời gian cần dạng tính từ.',
        repairVi: 'Đổi recently thành recent.',
        replacementText: 'recent Chat GPT',
      },
      {
        id: 'grammar:recently',
        criterion: 'grammatical_range_accuracy',
        scope: 'local',
        severity: 'minor',
        evidence: [{
          paragraphIndex: 1,
          sourceText: 'recently',
          role: 'primary',
        }],
        errorLabelVi: 'Sai dạng từ',
        explanationVi: 'Trạng từ không bổ nghĩa trực tiếp cho danh từ leak.',
        repairVi: 'Đổi thành recent.',
        replacementText: 'recent',
      },
    ],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /one owning language criterion/i);
});

test('v6 does not merge adjacent but semantically independent Task Response points', () => {
  const points = mergeSupportingInventoryPoints([
    {
      id: 'point:fake-news',
      paragraphIndex: 1,
      sourceText: 'the spread of false information and "fake news"',
      sourceSentenceIndexes: [2, 3],
      side: 'disadvantage',
      promise: 'False information can create harmful mistaken beliefs.',
    },
    {
      id: 'point:privacy',
      paragraphIndex: 1,
      sourceText: 'privacy concerns are also significant',
      sourceSentenceIndexes: [4, 5, 6],
      side: 'disadvantage',
      promise: 'Social media can expose or misuse personal data.',
    },
  ]);

  assert.equal(points.length, 2);
  assert.deepEqual(points.map(point => point.id), ['point:fake-news', 'point:privacy']);
});

test('v6 prefers the finer inventory when another pass bundles independent promises', () => {
  const points = reconcileInventoryPointGranularity(
    [{
      id: 'point:bundled',
      paragraphIndex: 1,
      sourceText: 'the spread of false information and "fake news"',
      sourceSentenceIndexes: [2, 3, 4, 5, 6],
      side: 'disadvantage',
      promise: 'Fake news is harmful and personal data can be leaked.',
    }],
    [
      {
        id: 'point:fake-news',
        paragraphIndex: 1,
        sourceText: 'the spread of false information and "fake news"',
        sourceSentenceIndexes: [2, 3],
        side: 'disadvantage',
        promise: 'Fake news can lead people to false assumptions.',
      },
      {
        id: 'point:privacy',
        paragraphIndex: 1,
        sourceText: 'privacy concerns are also significant',
        sourceSentenceIndexes: [4, 5, 6],
        side: 'disadvantage',
        promise: 'Personal data can be misused and leaked.',
      },
    ],
  );

  assert.equal(points.length, 2);
  assert.deepEqual(points.map(point => point.sourceText), [
    'the spread of false information and "fake news"',
    'privacy concerns are also significant',
  ]);
});

test('v6 keeps the first inventory when it is finer than the second opinion', () => {
  const split = [
    {
      id: 'point:connection',
      paragraphIndex: 2,
      sourceText: 'stay in touch with families and friends',
      sourceSentenceIndexes: [2, 3],
      side: 'advantage' as const,
      promise: 'Social media helps people maintain long-distance relationships.',
    },
    {
      id: 'point:opportunities',
      paragraphIndex: 2,
      sourceText: 'opens opportunities for education, work and business',
      sourceSentenceIndexes: [4, 5],
      side: 'advantage' as const,
      promise: 'Social media creates education, employment, and business opportunities.',
    },
  ];
  const bundled = [{
    id: 'point:bundled',
    paragraphIndex: 2,
    sourceText: 'Online platforms allow people stay in touch',
    sourceSentenceIndexes: [2, 3, 4, 5],
    side: 'advantage' as const,
    promise: 'Social media helps relationships and creates opportunities.',
  }];

  const points = reconcileInventoryPointGranularity(split, bundled);

  assert.equal(points.length, 2);
  assert.deepEqual(points.map(point => point.sourceText), split.map(point => point.sourceText));
});

test('v6 does not treat coordinated nouns as three independent argument points', () => {
  const bundled = [{
    id: 'point:opportunities',
    paragraphIndex: 2,
    sourceText: 'social media opens opportunities for education, work and business',
    sourceSentenceIndexes: [4, 5],
    side: 'advantage' as const,
    promise: 'Social media creates education, employment, and business opportunities.',
  }];
  const atomized = ['education', 'work', 'business'].map((sourceText, index) => ({
    id: `point:${index + 1}`,
    paragraphIndex: 2,
    sourceText,
    sourceSentenceIndexes: [4, 5],
    side: 'advantage' as const,
    promise: `Social media provides opportunities for ${sourceText}.`,
  }));

  const points = reconcileInventoryPointGranularity(bundled, atomized);

  assert.equal(points.length, 1);
  assert.equal(points[0]?.sourceText, bundled[0].sourceText);
});

test('v6 folds a generic paragraph umbrella into its concrete points', () => {
  const inventory = [
    {
      id: 'point:umbrella',
      paragraphIndex: 1,
      sourceText: 'can lead to several concerning issues',
      sourceSentenceIndexes: [1],
      side: 'disadvantage' as const,
      promise: 'Social media creates several concerning issues.',
    },
    {
      id: 'point:fake-news',
      paragraphIndex: 1,
      sourceText: 'the spread of false information and "fake news"',
      sourceSentenceIndexes: [2, 3],
      side: 'disadvantage' as const,
      promise: 'Social media spreads false information.',
    },
    {
      id: 'point:privacy',
      paragraphIndex: 1,
      sourceText: 'Personal data can be misused and leaked.',
      sourceSentenceIndexes: [4, 5, 6],
      side: 'disadvantage' as const,
      promise: 'Social media creates privacy risks.',
    },
  ];

  const points = reconcileInventoryPointGranularity(inventory, inventory);

  assert.equal(points.length, 2);
  assert.ok(points.every(point => point.sourceSentenceIndexes.includes(1)));
});

test('v6 removes a duplicated left-context token from a local replacement', () => {
  const source = 'One of the biggest problems is that the spread of false information.';
  const sourceManifest = buildEssayManifest(source);
  const finding = normalizeLanguageReplacementAgainstContext({
    id: 'gra:1',
    criterion: 'grammatical_range_accuracy',
    scope: 'local',
    severity: 'moderate',
    evidence: [{
      paragraphIndex: 0,
      sourceText: 'that the spread',
      role: 'primary',
    }],
    requirementIds: [],
    errorLabelVi: 'Cấu trúc câu bị gãy',
    explanationVi: 'Cấu trúc is that the spread không hoàn chỉnh.',
    repairVi: 'Bỏ that.',
    replacementText: 'is the spread',
  }, source, sourceManifest);

  assert.equal(finding.replacementText, 'the spread');
  assert.equal(
    source.replace('that the spread', finding.replacementText || ''),
    'One of the biggest problems is the spread of false information.',
  );
});

test('v6 preserves a replacement that does not duplicate surrounding context', () => {
  const source = 'Social media has becoming important.';
  const sourceManifest = buildEssayManifest(source);
  const finding = normalizeLanguageReplacementAgainstContext({
    id: 'gra:1',
    criterion: 'grammatical_range_accuracy',
    scope: 'local',
    severity: 'moderate',
    evidence: [{
      paragraphIndex: 0,
      sourceText: 'has becoming',
      role: 'primary',
    }],
    requirementIds: [],
    errorLabelVi: 'Sai dạng động từ',
    explanationVi: 'Sau has cần past participle.',
    repairVi: 'Đổi becoming thành become.',
    replacementText: 'has become',
  }, source, sourceManifest);

  assert.equal(finding.replacementText, 'has become');
});

test('v6 keeps the smallest independently highlightable language finding', () => {
  const findings = pruneNestedLanguageFindings([
    {
      id: 'gra:broad',
      criterion: 'grammatical_range_accuracy',
      scope: 'local',
      severity: 'moderate',
      evidence: [{
        paragraphIndex: 1,
        sourceText: "millions of user's data is spread quickly",
        role: 'primary',
      }],
      errorLabelVi: 'Cấu trúc câu có nhiều lỗi',
      explanationVi: 'Span này gộp nhiều lỗi cục bộ.',
      repairVi: 'Sửa cả cụm.',
      replacementText: 'millions of users’ data were spread quickly',
    },
    {
      id: 'gra:local',
      criterion: 'grammatical_range_accuracy',
      scope: 'local',
      severity: 'minor',
      evidence: [{
        paragraphIndex: 1,
        sourceText: "user's data",
        role: 'primary',
      }],
      errorLabelVi: 'Sai sở hữu',
      explanationVi: 'Cụm này dùng sở hữu số ít không đúng.',
      repairVi: 'Đổi thành user data.',
      replacementText: 'user data',
    },
  ]);

  assert.deepEqual(findings.map(finding => finding.id), ['gra:local']);
});

test('v6 keeps separate non-overlapping language corrections', () => {
  const findings = pruneNestedLanguageFindings([
    {
      id: 'gra:subject',
      criterion: 'grammatical_range_accuracy',
      scope: 'local',
      severity: 'minor',
      evidence: [{
        paragraphIndex: 1,
        sourceText: "user's data",
        role: 'primary',
      }],
      errorLabelVi: 'Sai sở hữu',
      explanationVi: 'Cụm sở hữu chưa đúng.',
      repairVi: 'Đổi thành user data.',
      replacementText: 'user data',
    },
    {
      id: 'gra:verb',
      criterion: 'grammatical_range_accuracy',
      scope: 'local',
      severity: 'minor',
      evidence: [{
        paragraphIndex: 1,
        sourceText: 'is spread',
        role: 'primary',
      }],
      errorLabelVi: 'Sai hòa hợp',
      explanationVi: 'Động từ chưa hòa hợp với chủ ngữ.',
      repairVi: 'Đổi thành were spread.',
      replacementText: 'were spread',
    },
  ]);

  assert.deepEqual(findings.map(finding => finding.id), ['gra:subject', 'gra:verb']);
});

test('v6 links an unassigned Task Response finding by its unique sentence range', () => {
  const source = [
    'Social media has both benefits and drawbacks.',
    [
      'False news is a major problem.',
      'Unchecked reports can create false assumptions.',
      'Privacy is also a concern.',
      'Personal data can be misused.',
      'A recent leak exposed user records.',
    ].join(' '),
    'Social media can also connect people.',
    'Overall, its benefits are greater.',
  ].join('\n\n');
  const sourceManifest = buildEssayManifest(source);
  const result = linkTaskResponsePointFindings({
    taskRequirements: [],
    findings: [
      {
        id: 'finding:fake-news',
        criterion: 'task_response',
        scope: 'local',
        severity: 'minor',
        evidence: [{
          paragraphIndex: 1,
          sourceText: 'Unchecked reports can create false assumptions.',
          role: 'primary',
        }],
        errorLabelVi: 'Hậu quả còn trừu tượng',
        explanationVi: 'Bạn chưa chỉ ra tác hại cụ thể.',
        repairVi: 'Bổ sung một hậu quả thực tế.',
      },
      {
        id: 'finding:privacy',
        criterion: 'task_response',
        scope: 'local',
        severity: 'moderate',
        evidence: [{
          paragraphIndex: 1,
          sourceText: 'A recent leak exposed user records.',
          role: 'primary',
        }],
        errorLabelVi: 'Ví dụ chưa khớp',
        explanationVi: 'Bạn chưa nối ví dụ với mạng xã hội.',
        repairVi: 'Giải thích mối liên hệ hoặc đổi ví dụ.',
      },
    ],
    pointAudit: [{
      id: 'point:privacy',
      paragraphIndex: 1,
      sourceText: 'Privacy is also a concern.',
      sourceSentenceIndexes: [3, 4, 5],
      mechanism: 'present',
      consequence: 'abstract',
      example: 'mismatched',
      status: 'partly_developed',
      findingIds: [],
      noteVi: 'Điểm này cần được phát triển thêm.',
    }],
  }, source, sourceManifest);

  assert.deepEqual(result.pointAudit[0]?.findingIds, ['finding:privacy']);
});

test('v6 leaves point-to-finding links unresolved when sentence evidence is ambiguous', () => {
  const source = [
    'Social media has both benefits and drawbacks.',
    'Privacy is also a concern. Personal data can be misused.',
    'Social media can also connect people.',
    'Overall, its benefits are greater.',
  ].join('\n\n');
  const sourceManifest = buildEssayManifest(source);
  const finding = (id: string, sourceText: string) => ({
    id,
    criterion: 'task_response' as const,
    scope: 'local' as const,
    severity: 'minor' as const,
    evidence: [{
      paragraphIndex: 1,
      sourceText,
      role: 'primary' as const,
    }],
    errorLabelVi: 'Ý chưa phát triển đủ',
    explanationVi: 'Bạn chưa giải thích đủ.',
    repairVi: 'Bổ sung phần giải thích.',
  });
  const result = linkTaskResponsePointFindings({
    taskRequirements: [],
    findings: [
      finding('finding:claim', 'Privacy is also a concern.'),
      finding('finding:support', 'Personal data can be misused.'),
    ],
    pointAudit: [{
      id: 'point:privacy',
      paragraphIndex: 1,
      sourceText: 'Privacy is also a concern.',
      sourceSentenceIndexes: [1, 2],
      mechanism: 'missing',
      consequence: 'abstract',
      example: 'none',
      status: 'partly_developed',
      findingIds: [],
      noteVi: 'Điểm này cần được phát triển thêm.',
    }],
  }, source, sourceManifest);

  assert.deepEqual(result.pointAudit[0]?.findingIds, []);
});

test('v6 lets a specialist move an initial criterion score by one band', () => {
  assert.equal(reconcileCriterionBand(6, 7), 7);
  assert.equal(reconcileCriterionBand(7, 6), 6);
});

test('v6 treats a larger scoring disagreement as uncertainty', () => {
  assert.equal(reconcileCriterionBand(5, 7), 6);
  assert.equal(reconcileCriterionBand(8, 5), 7);
});
