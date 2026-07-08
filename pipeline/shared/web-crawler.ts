// pipeline/shared/web-crawler.ts
// Firecrawl /crawl + smry.ai paywall bypass
// Used for The New Yorker and New Scientist pipelines

import FirecrawlApp from '@mendable/firecrawl-js';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY ?? 'fc-local' });

/** Use Firecrawl to discover all article URLs under an edition index URL */
export async function crawlEditionUrls(
  indexUrl: string,
  opts: {
    includePaths: string[];
    excludePaths: string[];
    maxPages?: number;
  }
): Promise<string[]> {
  console.log(`🕷️  Crawling ${indexUrl}…`);

  const result = await firecrawl.crawlUrl(indexUrl, {
    limit: opts.maxPages ?? 100,
    scrapeOptions: { formats: ['links'] },
    includePaths: opts.includePaths,
    excludePaths: opts.excludePaths,
  });

  if (!result.success) {
    throw new Error(`Firecrawl failed: ${(result as { error?: string }).error ?? 'unknown error'}`);
  }

  // Collect unique article URLs from all crawled pages
  const urls = new Set<string>();
  for (const page of result.data ?? []) {
    const links = (page as { links?: string[] }).links ?? [];
    links.forEach((l) => urls.add(l));
  }

  console.log(`✅ Found ${urls.size} URLs`);
  return Array.from(urls);
}

/** Fetch full article text via smry.ai paywall bypass */
export async function fetchViaSmry(articleUrl: string): Promise<string> {
  const smryUrl = `https://smry.ai/${articleUrl}`;
  console.log(`   📄 Fetching ${articleUrl.slice(0, 80)}…`);

  const res = await fetch(smryUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`smry.ai returned ${res.status} for ${articleUrl}`);

  const html = await res.text();

  // Extract the article text content from smry.ai's response
  // smry.ai returns an HTML page — grab the main content area
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const content = articleMatch?.[1] ?? mainMatch?.[1] ?? html;

  // Strip HTML tags to get plain text
  const text = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, '\n')
    .trim();

  return text;
}

/** Rate-limited batch fetcher — 1s delay between requests */
export async function fetchArticlesBatch(
  urls: string[],
  onArticle: (url: string, text: string) => Promise<void>
) {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const text = await fetchViaSmry(url);
      if (text.length < 300) {
        console.warn(`   ⚠️  Short content (${text.length} chars) — skipping ${url}`);
        continue;
      }
      await onArticle(url, text);
    } catch (err) {
      console.error(`   ❌ Failed ${url}: ${err instanceof Error ? err.message : err}`);
    }

    // Polite rate limiting
    if (i < urls.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}
