#!/usr/bin/env tsx
// pipeline/add-highlights-attr.ts
// One-time migration: adds the 'highlights' string array attribute to the articles collection

import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ARTICLES_COL = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID || 'articles';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function main() {
  console.log('🔧 Adding "highlights" attribute to articles collection...');

  // Check if already exists
  try {
    const attr = await databases.getAttribute(DATABASE_ID, ARTICLES_COL, 'highlights');
    if (attr.status === 'available') {
      console.log('✅ Attribute "highlights" already exists and is available. Nothing to do.');
      return;
    }
    console.log(`ℹ️ Attribute exists with status: ${attr.status}. Waiting for it...`);
  } catch {
    // Doesn't exist — create it
    console.log('   Creating string array attribute "highlights"...');
    await databases.createStringAttribute(DATABASE_ID, ARTICLES_COL, 'highlights', 2000, false, undefined, true);
  }

  // Poll until ready
  const TIMEOUT = 3 * 60 * 1000;
  const start = Date.now();
  while (true) {
    if (Date.now() - start > TIMEOUT) throw new Error('Timed out waiting for highlights attribute');
    const attr = await databases.getAttribute(DATABASE_ID, ARTICLES_COL, 'highlights');
    if (attr.status === 'available') {
      console.log('✅ "highlights" attribute is now available!');
      break;
    }
    if (attr.status === 'failed') throw new Error('"highlights" attribute creation failed');
    process.stdout.write(`\r   Status: ${attr.status}... `);
    await new Promise((r) => setTimeout(r, 2000));
  }
  process.stdout.write('\n');
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
