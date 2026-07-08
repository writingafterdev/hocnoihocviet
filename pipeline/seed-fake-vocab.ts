#!/usr/bin/env tsx

import { Client, Databases, Users, ID, Query, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const VOCAB_COL = process.env.NEXT_PUBLIC_APPWRITE_VOCAB_COLLECTION_ID || 'vocab';
const ARTICLES_COL = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID || 'articles';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);
const users = new Users(client);

async function main() {
  console.log('🌱 Vocabulary Seeding Script starting...');

  // 1. Ensure original_context attribute exists
  try {
    const attr = await db.getAttribute(DB_ID, VOCAB_COL, 'original_context');
    if (attr.status !== 'available') {
      console.log('⚠️  original_context attribute is still processing...');
    }
  } catch {
    console.log('⚠️  Creating original_context attribute...');
    await db.createStringAttribute(DB_ID, VOCAB_COL, 'original_context', 5000, false);
    console.log('   Waiting for attribute to be available...');
    const TIMEOUT = 3 * 60 * 1000;
    const start = Date.now();
    while (true) {
      if (Date.now() - start > TIMEOUT) { console.error('Timed out'); process.exit(1); }
      try {
        const a = await db.getAttribute(DB_ID, VOCAB_COL, 'original_context');
        if (a.status === 'available') { console.log('   ✅ original_context ready\n'); break; }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // 2. Get the first user
  console.log('👤 Fetching a user to own the vocab...');
  const userList = await users.list([Query.limit(1)]);
  if (userList.users.length === 0) {
    console.error('❌ No users found in this Appwrite project. Please sign up in the app first.');
    process.exit(1);
  }
  const userId = userList.users[0].$id;
  console.log(`   Selected User ID: ${userId}`);

  // 3. Delete existing vocab entries
  console.log('🧹 Deleting all existing vocab entries...');
  let deletedCount = 0;
  while (true) {
    const res = await db.listDocuments(DB_ID, VOCAB_COL, [Query.limit(100)]);
    if (res.documents.length === 0) break;
    for (const doc of res.documents) {
      await db.deleteDocument(DB_ID, VOCAB_COL, doc.$id);
      deletedCount++;
    }
  }
  console.log(`   Deleted ${deletedCount} entries.`);

  // 4. Fetch fake articles to attach to vocab
  console.log('📚 Fetching articles to link vocab words...');
  const articlesRes = await db.listDocuments(DB_ID, ARTICLES_COL, [Query.limit(5)]);
  if (articlesRes.documents.length < 3) {
    console.error('❌ Not enough articles found. Run pipeline/seed-fake-data.ts first.');
    process.exit(1);
  }
  const articles = articlesRes.documents;

  // 5. Seed new vocab data
  const SEED_VOCAB = [
    {
      word: 'ruinous',
      pos: 'adj.',
      definition: 'Destructive or disastrous; causing ruin.',
      example: 'The strategy was ruinous to the company.',
      tags: ['Society', 'Work'],
      article: articles[0],
      original_context: 'No one in Washington or Beijing actually chose this rivalry. It emerged from a thousand small decisions, each rational in isolation, collectively ruinous. An American chip restriction here. A Chinese laboratory benchmark there.'
    },
    {
      word: 'catastrophic',
      pos: 'adj.',
      definition: 'Involving or causing sudden great damage or suffering.',
      example: 'The results of the test were catastrophic.',
      tags: ['Science', 'Nature'],
      article: articles[1], // Markets
      original_context: 'In quiet years it drifts below 15. In the weeks before the 2008 financial crisis it hit 80. Right now it is sitting at 32 — not catastrophic, but not comfortable. Markets are worried about something they cannot quite name.'
    },
    {
      word: 'insomnia',
      pos: 'n.',
      definition: 'Habitual sleeplessness; inability to sleep.',
      example: 'She suffered from terrible insomnia.',
      tags: ['Health', 'Life'],
      article: articles[2], // Sleep
      original_context: 'Historian Roger Ekirch, who spent sixteen years researching historical sleep records, believes that many cases of "sleep maintenance insomnia" — the kind where you wake at 3 a.m. and cannot get back to sleep — may be manifestations of the ancestral two-sleep pattern.'
    }
  ];

  console.log('🌱 Seeding new vocab entries with original_context...');
  for (const entry of SEED_VOCAB) {
    await db.createDocument(
      DB_ID, 
      VOCAB_COL, 
      ID.unique(), 
      {
        word: entry.word,
        pos: entry.pos,
        definition: entry.definition,
        example: entry.example,
        tags: entry.tags,
        article_id: entry.article.$id,
        article_title: entry.article.title,
        original_context: entry.original_context,
        mastery: 'learning',
        next_review: new Date().toISOString(),
        interval: 1,
        ease_factor: 2.5,
        repetitions: 1
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
    console.log(`   ✅ Seeded word: "${entry.word}" (from: ${entry.article.title})`);
  }

  console.log('\n✨ Vocabulary Seeding complete! You can now test the Fault Finder with real contexts.');
}

main().catch(console.error);
