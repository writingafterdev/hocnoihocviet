// src/app/articles/page.tsx
import { getPublishedArticles, getCategories } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';
import type { Metadata } from 'next';
import type { SourceSlug } from '@/types';

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Browse all articles from The Economist, The New Yorker, and New Scientist.',
};

export const revalidate = 1800;

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '',             label: 'All Sources' },
  { value: 'economist',     label: '🗞️ Economist' },
  { value: 'new-yorker',    label: '📖 New Yorker' },
  { value: 'new-scientist', label: '🔬 New Scientist' },
];

interface Props {
  searchParams: Promise<{ source?: string; category?: string; search?: string; page?: string }>;
}

export default async function ArticlesPage({ searchParams }: Props) {
  const params = await searchParams;
  const source = params.source ?? '';
  const categoryId = params.category ?? '';
  const search = params.search ?? '';
  const page = parseInt(params.page ?? '1', 10);
  const limit = 12;
  const offset = (page - 1) * limit;

  let articles: any[] = [];
  let categories: any[] = [];
  try {
    const res = await Promise.all([
      getPublishedArticles({
        limit,
        offset,
        source: source || undefined,
        categoryId: categoryId || undefined,
        search: search || undefined,
      }),
      getCategories(source as SourceSlug || undefined),
    ]);
    articles = res[0];
    categories = res[1];
  } catch (err) {
    console.warn('⚠️ ArticlesPage data fetch failed. Showing empty list state.', err);
  }

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams({
      ...(source && { source }),
      ...(categoryId && { category: categoryId }),
      ...(search && { search }),
    });
    Object.entries(overrides).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k); });
    return `/articles?${p.toString()}`;
  }

  return (
    <div className="pt-[160px] pb-8">
      <div className="container">
        <h1 className="display-md font-serif mb-8">Articles</h1>

        {/* Source filter bar */}
        <div className="source-filter" role="group" aria-label="Filter by source">
          {SOURCE_OPTIONS.map((opt) => (
            <a
              key={opt.value}
              href={buildUrl({ source: opt.value, page: '1' })}
              id={`filter-source-${opt.value || 'all'}`}
              className={`chip ${source === opt.value ? 'active' : ''}`}
              aria-current={source === opt.value ? 'true' : undefined}
            >
              {opt.label}
            </a>
          ))}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap" role="group" aria-label="Filter by category">
            <a href={buildUrl({ category: '', page: '1' })} className={`chip ${!categoryId ? 'active' : ''}`}>All</a>
            {categories.map((cat) => (
              <a
                key={cat.$id}
                href={buildUrl({ category: cat.$id, page: '1' })}
                id={`filter-cat-${cat.slug}`}
                className={`chip ${categoryId === cat.$id ? 'active' : ''}`}
              >
                {cat.name}
              </a>
            ))}
          </div>
        )}

        {/* Search */}
        <form method="GET" action="/articles" className="mb-8 search-wrapper" style={{ maxWidth: 420 }}>
          {source && <input type="hidden" name="source" value={source} />}
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            id="article-search"
            name="search"
            type="search"
            className="input search-input"
            placeholder="Search articles…"
            defaultValue={search}
            aria-label="Search articles"
          />
        </form>

        {/* Grid */}
        <div className="grid-articles stagger">
          {articles.map((article) => (
            <ArticleCard key={article.$id} article={article} />
          ))}
          {articles.length === 0 && (
            <p className="text-muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 0' }}>
              No articles found. Try a different filter or search term.
            </p>
          )}
        </div>

        {/* Pagination */}
        {articles.length === limit && (
          <div className="flex justify-between mt-8 py-8" style={{ borderTop: '1px solid var(--border)' }}>
            {page > 1 && (
              <a href={buildUrl({ page: String(page - 1) })} id="prev-page" className="btn btn-ghost">← Previous</a>
            )}
            <a href={buildUrl({ page: String(page + 1) })} id="next-page" className="btn btn-primary" style={{ marginLeft: 'auto' }}>
              Next page →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
