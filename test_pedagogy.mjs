/**
 * Fault Finder (R3) — Deep Pedagogical Evaluation
 * Not testing JSON structure — testing whether the actual exercise content
 * genuinely develops language sensitivity in Vietnamese English learners.
 */

const BASE_URL = 'http://localhost:3000';

const TEST_WORDS = [
  {
    word: "pragmatic",
    definition: "dealing with things sensibly and realistically",
    pos: "adjective",
    example: "The government took a pragmatic approach to the crisis.",
    article_title: "Vietnam's Economic Miracle",
    tags: ["formal", "politics"],
    mastery: 0.4
  },
  {
    word: "discrepancy",
    definition: "a difference between things that should be the same",
    pos: "noun",
    example: "There was a clear discrepancy between the official data and reality.",
    article_title: "The Truth Behind the Numbers",
    tags: ["academic", "formal"],
    mastery: 0.3
  },
  {
    word: "rhetoric",
    definition: "language designed to persuade or impress, sometimes insincere",
    pos: "noun",
    example: "His rhetoric about reform masked a more conservative agenda.",
    article_title: "Politics of Language",
    tags: ["politics", "academic"],
    mastery: 0.5
  }
];

// ─── DEEP PEDAGOGICAL RUBRIC ─────────────────────────────────────────────────
//
// The Fault Finder game targets a very specific gap in Vietnamese learners:
//
// Vietnamese marks formality through PRONOUNS + PARTICLES (anh/em/bạn + ạ/nhé/thôi)
// NOT through vocabulary choice. So a Vietnamese learner can be B2-level and still
// not internalize that "real headache" vs "significant challenges" represent
// completely different social contracts in English writing.
//
// A GOOD exercise must:
//   [A] FAULT SUBTLETY — Is the fault subtle enough to require developed intuition?
//       Bad: "turned out to be a real headache" in a diplomatic text — too obvious.
//       Good: "persistent" vs "relentless" in a heroic narrative — requires feel.
//
//   [B] CONTEXT AUTHENTICITY — Does the passage sound like real text they'd read?
//       Vietnamese learners using this app read The Economist, New Yorker, New Scientist.
//       Generic "the committee decided" academic text is less motivating than passages
//       that sound like actual journalism.
//
//   [C] DISTRACTOR QUALITY — Do wrong options feel plausible?
//       A Vietnamese learner who can't FEEL the fault will guess among options.
//       If the distractors are obviously casual/wrong, the exercise loses value.
//       Good distractors are near-misses: close in register but slightly off.
//
//   [D] TRANSFERABILITY — Does solving this build intuition for real reading?
//       Does it create a "aha, I see how this works" moment that carries over?
//
//   [E] EXPLANATION QUALITY — Does the Vietnamese explanation BUILD a mental model
//       or just STATE the answer? 
//       Bad: "Câu này sai vì quá thân mật." (just states it)
//       Good: "Trong tiếng Anh trang trọng, không ai nói 'real headache' — ngay cả
//             khi ý nghĩa đúng, cách chọn từ này phá vỡ cảm giác chuyên nghiệp
//             mà người đọc đang kỳ vọng." (explains WHY it feels wrong)

function deepEval(q, idx) {
  const report = {
    question: idx + 1,
    word: q.word,
    faultType: q.faultType,
    scores: {},
    observations: [],
    verdict: ''
  };

  // ── [A] FAULT SUBTLETY ─────────────────────────────────────────────────────
  const paragraph = q.paragraph || '';
  const fault = q.faultySegment || '';

  // Measure contrast: how many words in the fault are clearly informal?
  const veryInformalMarkers = ['real', 'sort of', 'kind of', 'a bit', 'pretty', 'really', 
    'everyone', 'all over the place', 'big deal', 'tough', 'stuff', 'things', 'get', 'got',
    'headache', 'worrying', 'worry', 'hard', 'easy', 'feel', 'felt', 'going on'];
  const markerCount = veryInformalMarkers.filter(m => fault.toLowerCase().includes(m)).length;

  if (markerCount >= 2) {
    report.scores.subtlety = 'LOW';
    report.observations.push(`⚠️  [SUBTLETY LOW] Fault "${fault}" contains ${markerCount} obvious informal markers. A B1 learner would catch this. Doesn't develop sensitivity — confirms what they already know.`);
  } else if (markerCount === 1) {
    report.scores.subtlety = 'MEDIUM';
    report.observations.push(`✅ [SUBTLETY MEDIUM] Fault has one informal marker — learner must notice context to flag it, not just spot a slang word.`);
  } else {
    report.scores.subtlety = 'HIGH';
    report.observations.push(`✅ [SUBTLETY HIGH] Fault is subtle — no obvious slang. Learner must feel the register mismatch, not just spot a red-flag word. This is the hardest and most valuable type.`);
  }

  // ── [B] CONTEXT AUTHENTICITY ───────────────────────────────────────────────
  const journalisticSignals = ['noted', 'emphasized', 'revealed', 'analysts', 'observers', 'according to',
    'committee', 'minister', 'sector', 'administration', 'policymakers', 'conference', 'forum',
    'bilateral', 'multilateral', 'stakeholders', 'framework', 'mechanism', 'indicators'];
  const jsCount = journalisticSignals.filter(s => paragraph.toLowerCase().includes(s)).length;

  if (jsCount >= 4) {
    report.scores.authenticity = 'HIGH';
    report.observations.push(`✅ [AUTHENTICITY HIGH] Passage reads like real journalism (${jsCount} domain markers). Vietnamese learners reading The Economist will recognize this register.`);
  } else if (jsCount >= 2) {
    report.scores.authenticity = 'MEDIUM';
    report.observations.push(`⚠️  [AUTHENTICITY MEDIUM] Passage is somewhat generic academic writing. Could feel like a textbook exercise rather than real-world journalism.`);
  } else {
    report.scores.authenticity = 'LOW';
    report.observations.push(`❌ [AUTHENTICITY LOW] Passage doesn't feel like authentic journalism or academic writing. Low motivation for learners.`);
  }

  // ── [C] DISTRACTOR QUALITY ─────────────────────────────────────────────────
  const options = q.options || [];
  const correct = q.correctOption || '';
  const distractors = options.filter(o => o !== correct);

  if (distractors.length === 0) {
    report.scores.distractors = 'BROKEN';
    report.observations.push(`❌ [DISTRACTORS BROKEN] No distractors found — correctOption may equal faultySegment (inverted logic bug).`);
  } else {
    // Check if distractors are near-misses (similar formality domain) or just obviously wrong
    const obviouslyInformal = distractors.filter(d => {
      const d_lower = d.toLowerCase();
      return veryInformalMarkers.some(m => d_lower.includes(m));
    });

    const allDistractorsObvious = obviouslyInformal.length === distractors.length;
    if (allDistractorsObvious) {
      report.scores.distractors = 'LOW';
      report.observations.push(`⚠️  [DISTRACTORS LOW] All distractors are obviously informal — a learner can eliminate them by register alone without understanding the precise fault. Reduces cognitive challenge.`);
    } else {
      report.scores.distractors = 'HIGH';
      report.observations.push(`✅ [DISTRACTORS HIGH] At least one distractor is near-miss — requires precise sensitivity to distinguish from correct option.`);
    }
  }

  // ── [D] TRANSFERABILITY ────────────────────────────────────────────────────
  // Heuristic: does the fault type correspond to one of the hardest gaps for Vietnamese learners?
  // Most valuable for VN learners: precision, direction, connotation (vocabulary choice subtlety)
  // Less novel: register (they likely already know "don't use slang in formal text")
  const highValueTypes = ['precision', 'direction', 'connotation'];
  const lowValueTypes = ['register'];

  if (highValueTypes.includes(q.faultType)) {
    report.scores.transferability = 'HIGH';
    report.observations.push(`✅ [TRANSFER HIGH] Fault type "${q.faultType}" targets vocabulary connotation/precision — the deepest gap for Vietnamese learners who lack native intuition for English word charge.`);
  } else if (q.faultType === 'tone') {
    report.scores.transferability = 'MEDIUM';
    report.observations.push(`⚠️  [TRANSFER MEDIUM] Tone faults are valuable but similar to register — learner may already understand "match emotional weight to context".`);
  } else if (lowValueTypes.includes(q.faultType) && report.scores.subtlety === 'LOW') {
    report.scores.transferability = 'LOW';
    report.observations.push(`❌ [TRANSFER LOW] Register fault + obvious informal markers = learner just learns "don't use slang". This doesn't build the nuanced intuition Fault Finder is designed for.`);
  } else {
    report.scores.transferability = 'MEDIUM';
    report.observations.push(`⚠️  [TRANSFER MEDIUM] Standard register fault — useful but not the most growth-producing exercise type for this audience.`);
  }

  // ── [E] EXPLANATION QUALITY ────────────────────────────────────────────────
  const explanation = q.explanation || '';

  // Does it just state the fault ("câu này quá thân mật") or explain WHY it feels wrong?
  const modelBuilding = ['vì', 'bởi vì', 'lý do', 'điều này tạo ra', 'cảm giác', 'người đọc', 
    'kỳ vọng', 'khi đọc', 'ngay cả khi', 'khiến', 'làm cho', 'do đó', 'sẽ', 'phá vỡ'];
  const modelCount = modelBuilding.filter(p => explanation.toLowerCase().includes(p)).length;

  // Does it name the replacement's specific advantage?
  const replacementExplained = explanation.toLowerCase().includes('thay') || 
    explanation.toLowerCase().includes('bằng') ||
    explanation.toLowerCase().includes('cách diễn đạt');

  if (modelCount >= 2 && replacementExplained) {
    report.scores.explanation = 'EXCELLENT';
    report.observations.push(`✅ [EXPLANATION EXCELLENT] Explains WHY the fault breaks the passage AND what the replacement achieves. Builds durable mental model.`);
  } else if (replacementExplained) {
    report.scores.explanation = 'GOOD';
    report.observations.push(`✅ [EXPLANATION GOOD] Mentions what the correct replacement achieves. Actionable.`);
  } else {
    report.scores.explanation = 'WEAK';
    report.observations.push(`⚠️  [EXPLANATION WEAK] Only states that the fault is informal/wrong — doesn't explain WHY it breaks the passage's social contract. Learner gets the answer but not the insight.`);
  }

  // ── OVERALL VERDICT ────────────────────────────────────────────────────────
  const scoreMap = { 'HIGH': 3, 'EXCELLENT': 3, 'GOOD': 2, 'MEDIUM': 2, 'LOW': 1, 'WEAK': 1, 'BROKEN': 0 };
  const total = Object.values(report.scores).reduce((s, v) => s + (scoreMap[v] || 0), 0);
  const maxScore = Object.keys(report.scores).length * 3;
  const pct = Math.round((total / maxScore) * 100);

  if (pct >= 80) report.verdict = `🟢 STRONG (${pct}%) — Genuinely builds language intuition`;
  else if (pct >= 55) report.verdict = `🟡 ADEQUATE (${pct}%) — Useful but leaves growth on the table`;
  else report.verdict = `🔴 WEAK (${pct}%) — Not developing the skill it claims to target`;

  return report;
}

async function main() {
  console.log('═'.repeat(72));
  console.log('  FAULT FINDER (R3) — PEDAGOGICAL QUALITY EVALUATION');
  console.log('  Lens: Vietnamese English learner building register sensitivity');
  console.log('═'.repeat(72));

  const res = await fetch(`${BASE_URL}/api/games/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId: 'R3', words: TEST_WORDS }),
  });

  const data = await res.json();
  const questions = data.questions || [];

  console.log(`\nGenerated ${questions.length} question(s). Evaluating pedagogical quality...\n`);

  const reports = questions.map((q, i) => deepEval(q, i));

  for (const r of reports) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`Q${r.question}: "${r.word}" | fault_type: ${r.faultType}`);
    console.log(`${'─'.repeat(72)}`);
    for (const obs of r.observations) {
      console.log(`  ${obs}`);
    }
    console.log(`\n  SCORES: ${Object.entries(r.scores).map(([k, v]) => `${k}=${v}`).join(' | ')}`);
    console.log(`  VERDICT: ${r.verdict}`);
  }

  // ── SYSTEMIC PATTERNS ──────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`);
  console.log('SYSTEMIC PATTERNS ACROSS ALL QUESTIONS:');
  console.log(`${'═'.repeat(72)}\n`);

  const allSubtleties = reports.map(r => r.scores.subtlety);
  const lowSubtle = allSubtleties.filter(s => s === 'LOW').length;
  if (lowSubtle > 0) {
    console.log(`⚠️  ${lowSubtle}/${reports.length} questions have LOW subtlety faults.`);
    console.log(`    → The generator relies too heavily on obvious informal slang (real headache, sort of, kind of).`);
    console.log(`    → This is the SINGLE BIGGEST improvement opportunity in the prompt.`);
    console.log(`    → A Vietnamese B2 learner already knows "don't use slang in formal writing".`);
    console.log(`    → The game should push toward faults that require NATIVE-LEVEL FEEL to catch.\n`);
  }

  const allTypes = reports.map(r => r.faultType);
  const uniqueTypes = [...new Set(allTypes)];
  console.log(`  Fault type distribution: ${allTypes.join(', ')}`);
  if (!uniqueTypes.includes('precision') && !uniqueTypes.includes('connotation') && !uniqueTypes.includes('direction')) {
    console.log(`  ❌ None of the highest-value fault types (precision/connotation/direction) were used.`);
    console.log(`     These target the deepest vocabulary intuition gap for Vietnamese learners.`);
  } else {
    console.log(`  ✅ At least one high-value fault type was used (${uniqueTypes.filter(t => ['precision','connotation','direction'].includes(t)).join(', ')})`);
  }

  console.log(`\n${'─'.repeat(72)}`);
  console.log('RECOMMENDATIONS:');
  console.log(`${'─'.repeat(72)}\n`);
  console.log(`  1. SUBTLETY: Add a constraint to the prompt: "The fault must NOT be a colloquial`);
  console.log(`     word or slang phrase that any intermediate learner would immediately flag.`);
  console.log(`     The fault must be formally plausible — a word that belongs to the same general`);
  console.log(`     register but is wrong in THIS specific context for reasons of connotation,`);
  console.log(`     valence, or precision."`);
  console.log();
  console.log(`  2. BIAS TOWARD HIGH-VALUE FAULT TYPES: Precision and connotation faults are`);
  console.log(`     most valuable for Vietnamese learners. Adjust prompt weighting.`);
  console.log();
  console.log(`  3. EXPLANATION DEPTH: Push the explanation prompt to explain the SOCIAL CONTRACT`);
  console.log(`     being broken, not just that it sounds wrong. E.g. "Người đọc đang tin tưởng`);
  console.log(`     vào giọng văn này — câu này phá vỡ hợp đồng đó."`);
  console.log(`\n${'═'.repeat(72)}\n`);
}

main().catch(console.error);
