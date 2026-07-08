// src/lib/articles.ts
// Article fetch helpers — used in Server Components

import { serverDatabases } from './appwrite-server';
import { DB_ID, COLLECTIONS } from './appwrite';
import { Query } from 'appwrite';
import type { Article, Category, Source, Tag } from '@/types';

const ARTICLES = COLLECTIONS.articles;

export async function getPublishedArticles(opts?: {
  limit?: number;
  offset?: number;
  source?: string;
  categoryId?: string;
  search?: string;
}) {
  const queries = [
    Query.equal('status', 'published'),
    Query.orderDesc('published_at'),
    Query.limit(opts?.limit ?? 20),
  ];
  if (opts?.offset) queries.push(Query.offset(opts.offset));
  if (opts?.source) queries.push(Query.equal('source', opts.source));
  if (opts?.categoryId) queries.push(Query.equal('category_id', opts.categoryId));
  if (opts?.search) queries.push(Query.search('title', opts.search));

  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, queries);
  return res.documents as unknown as Article[];
}

export async function getFeaturedArticles(limit = 5): Promise<Article[]> {
  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, [
    Query.equal('status', 'published'),
    Query.orderDesc('published_at'),
    Query.limit(limit),
  ]);
  return res.documents as unknown as Article[];
}

export async function getHighlightArticles(limit = 20): Promise<Article[]> {
  // Fetch recently published articles — the QuoteStack will extract highlights client-side
  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, [
    Query.equal('status', 'published'),
    Query.orderDesc('published_at'),
    Query.limit(limit),
  ]);
  return (res.documents as unknown as Article[]).filter(
    (a) => a.highlights && a.highlights.length > 0,
  );
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, [
    Query.equal('slug', slug),
    Query.equal('status', 'published'),
    Query.limit(1),
  ]);
  if (res.documents.length === 0) return null;
  return res.documents[0] as unknown as Article;
}

export async function getAllPublishedSlugs(): Promise<string[]> {
  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, [
    Query.equal('status', 'published'),
    Query.select(['slug']),
    Query.limit(500),
  ]);
  return res.documents.map((d) => d.slug as string);
}

export async function getSources(): Promise<Source[]> {
  const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.sources);
  return res.documents as unknown as Source[];
}

export async function getCategories(sourceSlug?: string): Promise<Category[]> {
  const queries = sourceSlug ? [Query.equal('source_slug', sourceSlug)] : [];
  const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.categories, queries);
  return res.documents as unknown as Category[];
}

export async function getTags(): Promise<Tag[]> {
  const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.tags);
  return res.documents as unknown as Tag[];
}

export function estimateReadingTime(text: string): number {
  const words = text.replace(/<[^>]+>/g, '').split(/\s+/).length;
  return Math.ceil(words / 200);
}
