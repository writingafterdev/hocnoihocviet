/**
 * Fault Finder (R3) API Test
 * Tests the /api/games/generate endpoint with real Vietnamese-learner vocabulary
 * and evaluates output quality from a Vietnamese user experience perspective.
 */

const BASE_URL = 'http://localhost:3000';

// Simulated words a Vietnamese English learner would have saved from The Economist / New Yorker
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

async function testGenerate() {
  console.log('\n🔵 STEP 1: Generating Fault Finder (R3) exercise...\n');
  console.log(`Words: ${TEST_WORDS.map(w => w.word).join(', ')}\n`);

  const res = await fetch(`${BASE_URL}/api/games/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId: 'R3', words: TEST_WORDS }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('❌ Generate API error:', res.status, err);
    return null;
  }

  const data = await res.json();
  if (!data.questions || !Array.isArray(data.questions)) {
    console.error('❌ Response has no questions array:', JSON.stringify(data, null, 2));
    return null;
  }

  console.log(`✅ Generated ${data.questions.length} question(s)\n`);
  return data.questions;
}

function evaluateQuestion(q, idx) {
  const issues = [];
  const passes = [];

  // --- Structural checks ---
  if (!q.word) issues.push('❌ Missing word');
  else passes.push(`✅ word: "${q.word}"`);

  if (!q.paragraph) issues.push('❌ Missing paragraph');
  else {
    const wordCount = q.paragraph.split(/\s+/).length;
    if (wordCount < 45 || wordCount > 80) {
      issues.push(`⚠️  Paragraph length: ${wordCount} words (expected 55-70)`);
    } else {
      passes.push(`✅ Paragraph length: ${wordCount} words`);
    }
  }

  if (!q.faultySegment) {
    issues.push('❌ Missing faultySegment');
  } else {
    const verbatimMatch = q.paragraph && q.paragraph.includes(q.faultySegment);
    if (!verbatimMatch) {
      issues.push(`❌ CRITICAL: faultySegment NOT verbatim in paragraph!\n     faultySegment: "${q.faultySegment}"`);
    } else {
      passes.push(`✅ faultySegment is verbatim in paragraph`);
    }
  }

  if (!q.options || q.options.length !== 3) {
    issues.push(`❌ Options count: ${q.options?.length ?? 0} (expected 3)`);
  } else {
    passes.push(`✅ 3 options present`);
  }

  if (!q.correctOption) {
    issues.push('❌ Missing correctOption');
  } else if (q.options && !q.options.includes(q.correctOption)) {
    issues.push(`❌ correctOption not in options array`);
  } else {
    passes.push(`✅ correctOption is in options`);
  }

  if (!q.faultType) {
    issues.push('❌ Missing faultType');
  } else {
    const valid = ['register', 'connotation', 'tone', 'phrasing', 'precision', 'direction'];
    if (!valid.includes(q.faultType)) {
      issues.push(`⚠️  faultType "${q.faultType}" not in expected set: ${valid.join(', ')}`);
    } else {
      passes.push(`✅ faultType: "${q.faultType}"`);
    }
  }

  // --- Vietnamese UX checks ---
  if (!q.explanation) {
    issues.push('❌ Missing explanation (should be in Vietnamese)');
  } else {
    // Heuristic: Vietnamese text tends to contain these common words
    const vietnameseIndicators = ['của', 'và', 'là', 'trong', 'này', 'một', 'không', 'có', 'được', 'để', 'khi', 'tại'];
    const hasVietnamese = vietnameseIndicators.some(w => q.explanation.toLowerCase().includes(w));
    if (!hasVietnamese) {
      issues.push(`⚠️  Explanation may NOT be in Vietnamese: "${q.explanation.slice(0, 100)}..."`);
    } else {
      passes.push(`✅ Explanation appears to be in Vietnamese`);
    }

    // Check length — should be 1-2 short sentences, not an essay
    const sentenceCount = (q.explanation.match(/[.!?]/g) || []).length;
    if (sentenceCount > 4) {
      issues.push(`⚠️  Explanation is too long (${sentenceCount} sentences — should be 1-2)`);
    } else {
      passes.push(`✅ Explanation length: ${sentenceCount} sentence(s)`);
    }
  }

  // --- Vocab word check: word should appear in paragraph ---
  if (q.word && q.paragraph) {
    const wordInParagraph = q.paragraph.toLowerCase().includes(q.word.toLowerCase());
    if (!wordInParagraph) {
      issues.push(`⚠️  Target word "${q.word}" not found in paragraph (should be used correctly)`);
    } else {
      passes.push(`✅ Target word "${q.word}" appears in paragraph`);
    }
  }

  // --- Distractor quality check ---
  if (q.options && q.correctOption) {
    const distractors = q.options.filter(o => o !== q.correctOption);
    const tooShort = distractors.filter(d => d.split(/\s+/).length < 2);
    if (tooShort.length > 0) {
      issues.push(`⚠️  Some distractors are single words (should be phrases): ${tooShort.join(', ')}`);
    } else {
      passes.push(`✅ Distractors are phrases (not single words)`);
    }
  }

  return { issues, passes };
}

function printQuestion(q, idx) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`QUESTION ${idx + 1} — Word: "${q.word}" | Fault Type: ${q.faultType}`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`\n📝 PARAGRAPH:\n${q.paragraph}`);
  console.log(`\n🎯 FAULTY SEGMENT: "${q.faultySegment}"`);
  console.log(`\n📋 OPTIONS:`);
  (q.options || []).forEach((o, i) => {
    const isCorrect = o === q.correctOption;
    console.log(`  ${isCorrect ? '✓' : ' '} [${i + 1}] ${o}`);
  });
  console.log(`\n🇻🇳 EXPLANATION (Vietnamese):\n${q.explanation}`);
}

function summarizeResults(allResults) {
  let totalPasses = 0, totalIssues = 0;
  for (const { issues, passes } of allResults) {
    totalPasses += passes.length;
    totalIssues += issues.length;
  }

  const score = Math.round((totalPasses / (totalPasses + totalIssues)) * 100);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 OVERALL SCORE: ${score}% (${totalPasses} passes, ${totalIssues} issues)`);

  if (score >= 90) console.log('🟢 VERDICT: Excellent — production ready for Vietnamese users');
  else if (score >= 70) console.log('🟡 VERDICT: Good — minor issues, mostly usable');
  else if (score >= 50) console.log('🟠 VERDICT: Needs improvement — notable issues');
  else console.log('🔴 VERDICT: Broken — serious structural or UX problems');

  console.log(`${'═'.repeat(70)}\n`);
}

// --- Main ---
async function main() {
  console.log('═'.repeat(70));
  console.log('  FAULT FINDER (R3) — API QUALITY TEST');
  console.log('  Target user: Vietnamese English learner');
  console.log('═'.repeat(70));

  const questions = await testGenerate();
  if (!questions) return;

  const allResults = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    printQuestion(q, i);

    console.log(`\n🔍 EVALUATION:`);
    const result = evaluateQuestion(q, i);

    result.passes.forEach(p => console.log(`  ${p}`));
    result.issues.forEach(e => console.log(`  ${e}`));

    allResults.push(result);
  }

  summarizeResults(allResults);
}

main().catch(console.error);
