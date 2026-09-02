// src/lib/articles.ts
// Article fetch helpers — used in Server Components

import { serverDatabases } from './appwrite-server';
import { DB_ID, COLLECTIONS } from './appwrite';
import { Query } from 'appwrite';
import type { Article, Category, Source, Tag } from '@/types';

const ARTICLES = COLLECTIONS.articles;

// Appwrite SDK documents have a null prototype, which Next.js refuses to pass
// from Server Components to Client Components. Round-trip through JSON to get
// plain objects.
function toPlain<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value));
}

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
  return toPlain<Article[]>(res.documents);
}

export async function getFeaturedArticles(limit = 5): Promise<Article[]> {
  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, [
    Query.equal('status', 'published'),
    Query.orderDesc('published_at'),
    Query.limit(limit),
  ]);
  return toPlain<Article[]>(res.documents);
}

export async function getHighlightArticles(limit = 20): Promise<Article[]> {
  // Fetch recently published articles — the QuoteStack will extract highlights client-side
  const res = await serverDatabases.listDocuments(DB_ID, ARTICLES, [
    Query.equal('status', 'published'),
    Query.orderDesc('published_at'),
    Query.limit(limit),
  ]);
  return toPlain<Article[]>(res.documents).filter(
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
  return toPlain<Article>(res.documents[0]);
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
  return toPlain<Source[]>(res.documents);
}

export async function getCategories(sourceSlug?: string): Promise<Category[]> {
  const queries = sourceSlug ? [Query.equal('source_slug', sourceSlug)] : [];
  const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.categories, queries);
  return toPlain<Category[]>(res.documents);
}

export async function getTags(): Promise<Tag[]> {
  const res = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.tags);
  return toPlain<Tag[]>(res.documents);
}

export function estimateReadingTime(text: string): number {
  const words = text.replace(/<[^>]+>/g, '').split(/\s+/).length;
  return Math.ceil(words / 200);
}
