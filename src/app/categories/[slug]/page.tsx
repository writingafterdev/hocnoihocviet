// src/app/categories/[slug]/page.tsx
import { getPublishedArticles, getCategories } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';
import { serverDatabases } from '@/lib/appwrite-server';
import { DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Category } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.categories, [
      Query.equal('slug', slug),
      Query.limit(1)
    ]);
    
    const category = res.documents[0] as unknown as Category;
    if (!category) return { title: 'Category Not Found' };
    
    return {
      title: `${category.name} Articles`,
      description: `Read all curated articles in ${category.name} from The Economist, The New Yorker, and New Scientist.`,
    };
  } catch {
    return { title: 'Category Articles' };
  }
}

export const revalidate = 1800; // 30 minutes

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  let category: Category | undefined = undefined;
  let articles: any[] = [];

  try {
    const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.categories, [
      Query.equal('slug', slug),
      Query.limit(1)
    ]);
    category = res.documents[0] as unknown as Category | undefined;
    
    if (category) {
      articles = await getPublishedArticles({
        categoryId: category.$id,
        limit: 20
      });
    }
  } catch (err) {
    console.warn('⚠️ CategoryPage data fetch failed. Showing fallback/empty state.', err);
  }

  if (!category) notFound();

  return (
    <div className="py-12">
      <div className="container">
        {/* Header */}
        <header className="mb-12 text-center" style={{ maxWidth: '600px', margin: '0 auto 3rem auto' }}>
          <span 
            className="chip active mb-3" 
            style={{ 
              backgroundColor: category.color || 'var(--accent)', 
              borderColor: 'transparent',
              color: '#fff',
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontWeight: 600
            }}
          >
            Category
          </span>
          <h1 className="display-md font-serif mb-4" style={{ letterSpacing: '-0.02em' }}>
            {category.name}
          </h1>
          <p className="text-muted" style={{ fontSize: '1rem' }}>
            Curated articles from our premium sources in the <strong style={{ color: 'var(--text-primary)' }}>{category.name}</strong> section.
          </p>
        </header>

        {/* Grid */}
        <div className="grid-articles stagger">
          {articles.map((article) => (
            <ArticleCard key={article.$id} article={article} />
          ))}
          {articles.length === 0 && (
            <p className="text-muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 0' }}>
              No articles found in this category yet. Stay tuned! 📚
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
