#!/usr/bin/env tsx
// pipeline/ingest.ts
// Main ingestion entry point
// Usage:
//   npx tsx pipeline/ingest.ts --source economist ./magazines/2026-05-24.azw3
//   npx tsx pipeline/ingest.ts --source new-yorker https://www.newyorker.com/magazine/2026/05/25
//   npx tsx pipeline/ingest.ts --source new-scientist https://www.newscientist.com/issue/2026-05-24/

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename, extname } from 'path';
import 'dotenv/config';

const OUTPUT_DIR = join(process.cwd(), 'pipeline', 'output');

function usage() {
  console.log(`
Usage:
  npx tsx pipeline/ingest.ts --source economist <file.azw3|file.epub>
  npx tsx pipeline/ingest.ts --source new-yorker <edition-url>
  npx tsx pipeline/ingest.ts --source new-scientist <edition-url>
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf('--source');
  if (sourceIdx === -1 || !args[sourceIdx + 1] || !args[sourceIdx + 2]) usage();

  const source = args[sourceIdx + 1];
  const input  = args[sourceIdx + 2];

  if (!['economist', 'new-yorker', 'new-scientist'].includes(source)) {
    console.error(`Unknown source: ${source}`);
    usage();
  }

  let articles: unknown[] = [];
  let issueDate: string;

  if (source === 'economist') {
    // ── Pipeline A: EPUB/AZW3 ──
    if (!existsSync(input)) {
      console.error(`File not found: ${input}`);
      process.exit(1);
    }
    issueDate = basename(input, extname(input)); // use filename as issue date

    const { convertToEpub, parseEpub } = await import('./shared/epub-parser.js');
    const { processEpubChapters } = await import('./sources/economist.js');

    console.log(`\n🗞️  The Economist — ${issueDate}\n`);
    const epubPath = convertToEpub(input);
    const meta = await parseEpub(epubPath);
    console.log(`📚 "${meta.title}" — ${meta.chapters.length} chapters`);
    articles = await processEpubChapters(meta.chapters, issueDate);

  } else {
    // ── Pipeline B: Web crawl + smry.ai ──
    // Extract issue date from URL
    const urlObj = new URL(input);
    const pathParts = urlObj.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    issueDate = pathParts.slice(-3).join('-'); // e.g. 2026-05-25

    if (source === 'new-yorker') {
      console.log(`\n📖 The New Yorker — ${issueDate}\n`);
      const { processNewYorkerEdition } = await import('./sources/new-yorker.js');
      articles = await processNewYorkerEdition(input, issueDate);
    } else {
      console.log(`\n🔬 New Scientist — ${issueDate}\n`);
      const { processNewScientistEdition } = await import('./sources/new-scientist.js');
      articles = await processNewScientistEdition(input, issueDate);
    }
  }

  // Write output
  const outDir = join(OUTPUT_DIR, source, issueDate);
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, 'articles.json');
  writeFileSync(outPath, JSON.stringify(articles, null, 2), 'utf-8');

  console.log(`\n✅ Done! ${articles.length} articles written to:\n   ${outPath}`);
  console.log(`\nNext step: review the file, then run:\n   npx tsx pipeline/upload.ts ${outPath}\n`);
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
