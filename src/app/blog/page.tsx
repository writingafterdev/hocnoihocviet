import { getPublishedArticles } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog - Wrong Ideas',
  description: 'Where I share my wrong ideas.',
};

export const revalidate = 1800;

export default async function BlogPage() {
  let articles: any[] = [];
  try {
    // Fetch articles specifically tagged as 'blog' source
    articles = await getPublishedArticles({ source: 'blog', limit: 24, offset: 0 });
  } catch (err) {
    console.warn('⚠️ BlogPage data fetch failed.', err);
  }

  return (
    <div className="py-8 pt-[160px] min-h-screen bg-transparent">
      <div className="max-w-[800px] mx-auto px-6">
        
        <header className="mb-12 border-b border-neutral-300 pb-8">
          <h1 className="text-[60px] md:text-[80px] leading-none text-neutral-900 tracking-tight mb-4" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
            Wrong Ideas.
          </h1>
          <p className="text-[20px] text-neutral-600 max-w-2xl font-serif italic" style={{ fontFamily: 'var(--font-lora)' }}>
            Where I share my wrong ideas, random thoughts, and everything in between.
          </p>
        </header>

        {/* Grid matching the other source layouts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article) => (
            <ArticleCard key={article.$id} article={article} />
          ))}
          {articles.length === 0 && (
            <div className="col-span-full py-16 text-center border border-dashed border-neutral-300">
              <p className="text-neutral-500 font-sans tracking-widest uppercase text-[12px]">No ideas published yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
