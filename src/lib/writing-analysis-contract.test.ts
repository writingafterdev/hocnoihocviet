import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEssayManifest } from '@/lib/writing-analysis-contract';

test('sentence manifest preserves abbreviations, titles, and decimals without dropping source text', () => {
  const essay = 'For example, e.g. students may struggle. Dr. Smith disagrees. The figure was 3.5 percent.';
  const manifest = buildEssayManifest(essay);
  const sentences = manifest[0].sentences;

  assert.deepEqual(sentences.map(sentence => sentence.text), [
    'For example, e.g. students may struggle.',
    'Dr. Smith disagrees.',
    'The figure was 3.5 percent.',
  ]);
  assert.equal(
    sentences.map(sentence => essay.slice(sentence.startChar, sentence.endChar)).join(' '),
    essay,
  );
});

test('sentence manifest preserves exact offsets across paragraphs', () => {
  const essay = 'First paragraph ends here.\n\nSecond paragraph has 2.5 examples.';
  const manifest = buildEssayManifest(essay);

  assert.equal(manifest.length, 2);
  for (const paragraph of manifest) {
    for (const sentence of paragraph.sentences) {
      assert.equal(essay.slice(sentence.startChar, sentence.endChar), sentence.text);
    }
  }
});
