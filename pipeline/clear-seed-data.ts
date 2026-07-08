#!/usr/bin/env tsx
import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ARTICLES_COL = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID || 'articles';

async function main() {
  console.log('Connecting to Appwrite...');
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);

  console.log('Fetching articles...');
  const { documents } = await databases.listDocuments(DB_ID, ARTICLES_COL, [
    Query.limit(100)
  ]);

  console.log(`Found ${documents.length} articles. Deleting seed data...`);
  let deletedCount = 0;

  for (const doc of documents) {
    if (doc.source_issue !== 'Imported') {
      await databases.deleteDocument(DB_ID, ARTICLES_COL, doc.$id);
      console.log(`Deleted ${doc.title}`);
      deletedCount++;
    } else {
      console.log(`Skipped ${doc.title} (Real user import)`);
    }
  }

  console.log(`Done. Deleted ${deletedCount} seed articles.`);
}

main().catch(console.error);
