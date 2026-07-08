#!/usr/bin/env tsx
// pipeline/upload.ts
// Upload a reviewed articles.json file to Appwrite Cloud
// Usage: npx tsx pipeline/upload.ts pipeline/output/economist/2026-05-24/articles.json

import { readFileSync } from 'fs';
import { Client, Databases, ID, Query } from 'node-appwrite';
import 'dotenv/config';
import type { PipelineArticle } from '../src/types/index.js';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ARTICLES_COL = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID!;
const CATEGORIES_COL = process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID!;

async function getCategoryId(categorySlug: string): Promise<string | null> {
  try {
    const res = await db.listDocuments(DB_ID, CATEGORIES_COL, [
      Query.equal('slug', categorySlug),
      Query.limit(1),
    ]);
    return res.documents[0]?.$id ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx pipeline/upload.ts <path-to-articles.json>');
    process.exit(1);
  }

  const articles: PipelineArticle[] = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`\n⬆️  Uploading ${articles.length} articles to Appwrite…\n`);

  let uploaded = 0;
  let skipped  = 0;

  for (const article of articles) {
    try {
      const categoryId = await getCategoryId(article.category_slug);

      await db.createDocument(DB_ID, ARTICLES_COL, ID.unique(), {
        title:          article.title,
        slug:           article.slug,
        body:           article.body,
        excerpt:        article.excerpt,
        cover_image_id: article.cover_image_path ?? '',
        source:         article.source,
        source_issue:   article.source_issue,
        author:         article.author,
        published_at:   new Date().toISOString(),
        status:         'draft', // Always upload as draft — publish manually
        reading_time:   article.reading_time,
        category_id:    categoryId ?? '',
        tag_ids:        [],
      });

      console.log(`   ✅ "${article.title}"`);
      uploaded++;
    } catch (err) {
      console.error(`   ❌ "${article.title}": ${err instanceof Error ? err.message : err}`);
      skipped++;
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n✅ Done: ${uploaded} uploaded, ${skipped} failed`);
  console.log('Articles are uploaded as DRAFTS — go to the Appwrite Console to publish them.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
