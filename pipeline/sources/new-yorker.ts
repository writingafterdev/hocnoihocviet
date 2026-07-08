// pipeline/sources/new-yorker.ts
// The New Yorker — Web pipeline config (Firecrawl + smry.ai)

import type { PipelineArticle } from '../../src/types/index.js';
import { formatArticle } from '../shared/ai.js';
import { crawlEditionUrls, fetchArticlesBatch } from '../shared/web-crawler.js';
import slugify from '../shared/slugify.js';

/** Map URL path segment → category slug */
function categoryFromUrl(url: string): string {
  if (url.includes('/fiction/'))              return 'fiction';
  if (url.includes('/poetry/'))               return 'poetry';
  if (url.includes('/humor/'))                return 'humor';
  if (url.includes('/comment/'))              return 'opinion-comment';
  if (url.includes('/reporting-and-essays/')) return 'essays-reporting';
  if (url.includes('/books/'))                return 'books';
  if (url.includes('/film/'))                 return 'film-tv';
  if (url.includes('/television/'))           return 'film-tv';
  if (url.includes('/music/'))                return 'music';
  if (url.includes('/culture/'))              return 'culture-arts';
  return 'essays-reporting';
}

/** URLs to skip — not articles */
const SKIP_PATTERNS = [
  '/goings-on', '/cartoon', '/crossword', '/puzzle', '/video',
  '/podcast', '/newsletter', '/tag/', '/author/', '/contributor/',
];

function shouldSkip(url: string): boolean {
  return SKIP_PATTERNS.some((p) => url.includes(p));
}

/**
 * Crawl a New Yorker weekly edition index page and process all articles
 * @param indexUrl e.g. https://www.newyorker.com/magazine/2026/05/25
 * @param issueDate e.g. "2026-05-25"
 */
export async function processNewYorkerEdition(
  indexUrl: string,
  issueDate: string
): Promise<PipelineArticle[]> {
  // Extract date path for include filter
  const datePath = issueDate.replace(/-/g, '/'); // 2026/05/25

  const allUrls = await crawlEditionUrls(indexUrl, {
    includePaths: [`/magazine/${datePath}/*`],
    excludePaths: SKIP_PATTERNS,
    maxPages: 60,
  });

  const articleUrls = allUrls
    .filter((u) => u.includes(`/magazine/${datePath}/`))
    .filter((u) => !shouldSkip(u));

  console.log(`📖 New Yorker: ${articleUrls.length} articles to process`);

  const articles: PipelineArticle[] = [];

  await fetchArticlesBatch(articleUrls, async (url, text) => {
    const category = categoryFromUrl(url);
    try {
      const formatted = await formatArticle(text, {
        magazine: 'The New Yorker',
        section: category.replace(/-/g, ' '),
        issue: issueDate,
      });

      articles.push({
        title: formatted.title,
        slug: slugify(formatted.title),
        author: formatted.author,
        excerpt: formatted.excerpt,
        body: formatted.body,
        source: 'new-yorker',
        source_issue: issueDate,
        category_slug: category,
        tags: formatted.tags,
        reading_time: formatted.reading_time,
      });
      console.log(`   ✅ "${formatted.title}"`);
    } catch (err) {
      console.error(`   ❌ AI format failed for ${url}: ${err}`);
    }
  });

  return articles;
}
