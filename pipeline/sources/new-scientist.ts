// pipeline/sources/new-scientist.ts
// New Scientist — Web pipeline config (Firecrawl + smry.ai)

import type { PipelineArticle } from '../../src/types/index.js';
import { formatArticle } from '../shared/ai.js';
import { crawlEditionUrls, fetchArticlesBatch } from '../shared/web-crawler.js';
import slugify from '../shared/slugify.js';

/** Map keywords in URL or content → category slug */
function categoryFromUrl(url: string): string {
  if (url.includes('space') || url.includes('astrono'))      return 'space-astronomy';
  if (url.includes('health') || url.includes('medicine'))    return 'health-medicine';
  if (url.includes('environment') || url.includes('climate')) return 'environment';
  if (url.includes('physics') || url.includes('maths'))       return 'physics-mathematics';
  if (url.includes('technology') || url.includes('ai-'))      return 'technology';
  if (url.includes('life') || url.includes('biology'))        return 'life-sciences';
  if (url.includes('opinion') || url.includes('comment'))     return 'opinion-comment';
  if (url.includes('feature'))                                return 'science-features';
  return 'science-news';
}

const SKIP_PATTERNS = [
  '/crossword', '/puzzle', '/subscribe', '/shop', '/app',
  '/newsletters', '/events', '/jobs', '/author/', '/tag/',
];

function shouldSkip(url: string): boolean {
  return SKIP_PATTERNS.some((p) => url.includes(p));
}

/**
 * Crawl a New Scientist issue page and process all articles
 * @param indexUrl e.g. https://www.newscientist.com/issue/2026-05-24/
 * @param issueDate e.g. "2026-05-24"
 */
export async function processNewScientistEdition(
  indexUrl: string,
  issueDate: string
): Promise<PipelineArticle[]> {
  const allUrls = await crawlEditionUrls(indexUrl, {
    includePaths: ['/article/*'],
    excludePaths: SKIP_PATTERNS,
    maxPages: 60,
  });

  const articleUrls = allUrls
    .filter((u) => u.includes('/article/'))
    .filter((u) => !shouldSkip(u));

  console.log(`🔬 New Scientist: ${articleUrls.length} articles to process`);

  const articles: PipelineArticle[] = [];

  await fetchArticlesBatch(articleUrls, async (url, text) => {
    const category = categoryFromUrl(url);
    try {
      const formatted = await formatArticle(text, {
        magazine: 'New Scientist',
        section: category.replace(/-/g, ' '),
        issue: issueDate,
      });

      articles.push({
        title: formatted.title,
        slug: slugify(formatted.title),
        author: formatted.author,
        excerpt: formatted.excerpt,
        body: formatted.body,
        source: 'new-scientist',
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
