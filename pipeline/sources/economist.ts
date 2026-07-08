// pipeline/sources/economist.ts
// The Economist — EPUB/AZW3 pipeline config

import type { EpubChapter } from '../shared/epub-parser.js';
import type { PipelineArticle } from '../../src/types/index.js';
import { formatArticle } from '../shared/ai.js';
import slugify from '../shared/slugify.js';

/** Economist section title → blog category slug */
const SECTION_MAP: Record<string, string> = {
  'leaders':               'politics-world',
  'briefing':              'in-depth',
  'united states':         'united-states',
  'britain':               'britain',
  'europe':                'europe',
  'asia':                  'asia',
  'china':                 'asia',
  'middle east & africa':  'middle-east-africa',
  'middle east and africa':'middle-east-africa',
  'the americas':          'the-americas',
  'international':         'international',
  'business':              'business',
  'finance & economics':   'finance-economics',
  'finance and economics': 'finance-economics',
  'science & technology':  'science-technology',
  'science and technology':'science-technology',
  'books & arts':          'culture-books',
  'books and arts':        'culture-books',
};

/** Sections to skip entirely */
const SKIP_SECTIONS = new Set([
  'letters', 'letter', 'the world this week', 'obituary', 'obituaries',
  'crossword', 'economic & financial indicators', 'indicators',
]);

export function classifyChapter(chapter: EpubChapter): string | null {
  const title = chapter.title.toLowerCase().trim();

  for (const skip of SKIP_SECTIONS) {
    if (title.includes(skip)) return null;
  }

  for (const [key, cat] of Object.entries(SECTION_MAP)) {
    if (title.includes(key)) return cat;
  }

  return 'international'; // fallback
}

export async function processEpubChapters(
  chapters: EpubChapter[],
  issueDate: string
): Promise<PipelineArticle[]> {
  const articles: PipelineArticle[] = [];

  for (const chapter of chapters) {
    const categorySlug = classifyChapter(chapter);
    if (!categorySlug) {
      console.log(`   ⏭️  Skipping: "${chapter.title}"`);
      continue;
    }

    console.log(`   📝 Processing: "${chapter.title}" → ${categorySlug}`);
    try {
      const formatted = await formatArticle(chapter.html, {
        magazine: 'The Economist',
        section: chapter.title,
        issue: issueDate,
      });

      articles.push({
        title: formatted.title || chapter.title,
        slug: slugify(formatted.title || chapter.title),
        author: formatted.author || 'The Economist',
        excerpt: formatted.excerpt,
        body: formatted.body,
        source: 'economist',
        source_issue: issueDate,
        category_slug: categorySlug,
        tags: formatted.tags,
        reading_time: formatted.reading_time,
      });
    } catch (err) {
      console.error(`   ❌ AI format failed for "${chapter.title}": ${err}`);
    }
  }

  return articles;
}
