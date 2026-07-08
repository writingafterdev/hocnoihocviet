// src/app/articles/[slug]/page.tsx
import { getArticleBySlug, getAllPublishedSlugs, getPublishedArticles } from '@/lib/articles';
import { getCoverUrl } from '@/lib/appwrite';
import CommentSection from '@/components/CommentSection';
import ArticlePageClient from '@/components/ArticlePageClient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ slug: string }>; }

export async function generateStaticParams() {
  try {
    const slugs = await getAllPublishedSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const article = await getArticleBySlug(slug);
    if (!article) return { title: 'Article Not Found' };
    return {
      title: article.title,
      description: article.excerpt,
      openGraph: {
        title: article.title,
        description: article.excerpt,
        type: 'article',
        publishedTime: article.published_at,
        authors: [article.author],
        images: article.cover_image_id
          ? [{ url: getCoverUrl(article.cover_image_id, 1200), width: 1200, height: 630 }]
          : [],
      },
    };
  } catch {
    return { title: 'Article' };
  }
}

export const revalidate = 3600;

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  // Fetch related articles
  let related: any[] = [];
  try {
    const all = await getPublishedArticles({ limit: 5 });
    related = JSON.parse(JSON.stringify(
      all.filter((a: any) => a.$id !== article.$id).slice(0, 2)
    ));
  } catch { /* ignore */ }

  const coverUrl = article.cover_image_id ? getCoverUrl(article.cover_image_id, 1440) : null;
  const serialized = JSON.parse(JSON.stringify(article));

  return (
    <ArticlePageClient article={serialized} coverUrl={coverUrl} related={related} />
  );
}
