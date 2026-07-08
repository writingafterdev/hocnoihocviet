import { Client, Databases, Storage, ID, Permission, Role, OrderBy } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

// Load environment variables — try the root .env.local (one level up from pipeline/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'readernwriter';

const ARTICLES_COL = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID || 'articles';
const SOURCES_COL = process.env.NEXT_PUBLIC_APPWRITE_SOURCES_COLLECTION_ID || 'sources';
const CATEGORIES_COL = process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID || 'categories';
const TAGS_COL = process.env.NEXT_PUBLIC_APPWRITE_TAGS_COLLECTION_ID || 'tags';
const COMMENTS_COL = process.env.NEXT_PUBLIC_APPWRITE_COMMENTS_COLLECTION_ID || 'comments';
const BOOKMARKS_COL = process.env.NEXT_PUBLIC_APPWRITE_BOOKMARKS_COLLECTION_ID || 'bookmarks';
const REACTIONS_COL = process.env.NEXT_PUBLIC_APPWRITE_REACTIONS_COLLECTION_ID || 'reactions';
const USERS_META_COL = process.env.NEXT_PUBLIC_APPWRITE_USERS_META_COLLECTION_ID || 'users_meta';

const BUCKETS = {
  covers: process.env.NEXT_PUBLIC_APPWRITE_COVERS_BUCKET_ID || 'covers',
  logos: process.env.NEXT_PUBLIC_APPWRITE_LOGOS_BUCKET_ID || 'source-logos',
  avatars: process.env.NEXT_PUBLIC_APPWRITE_AVATARS_BUCKET_ID || 'avatars',
};

async function main() {
  console.log('🚀 Appwrite Schema Setup Script starting...');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`Database ID: ${DATABASE_ID}`);

  if (!PROJECT_ID || PROJECT_ID === 'your-project-id' || !API_KEY || API_KEY === 'your-api-key-here') {
    console.error('\n❌ ERROR: Appwrite Project ID or API Key is missing or using placeholder values in .env.local.');
    console.error('Please follow these steps to configure your credentials:');
    console.error('1. Sign in to https://cloud.appwrite.io');
    console.error('2. Create a new project called "Reader & Writer"');
    console.error('3. Copy the Project ID into NEXT_PUBLIC_APPWRITE_PROJECT_ID in .env.local');
    console.error('4. Go to Project Settings -> API Keys, create a key with full database/storage/users access, and copy it to APPWRITE_API_KEY in .env.local');
    console.error('5. Re-run this setup script.\n');
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);
  const storage = new Storage(client);

  // 1. Ensure Database exists
  console.log('\n📦 Step 1: Checking database...');
  let dbExists = false;
  try {
    await databases.get(DATABASE_ID);
    console.log(`   Database "${DATABASE_ID}" already exists.`);
    dbExists = true;
  } catch (err: any) {
    if (err.code === 404) {
      console.log(`   Database "${DATABASE_ID}" not found. Creating it...`);
      await databases.create(DATABASE_ID, 'Reader & Writer');
      console.log('   ✅ Database created.');
      dbExists = true;
    } else {
      console.error('   ❌ Error checking/creating database:', err.message);
      throw err;
    }
  }

  // Helper: Create collection if not exists
  async function ensureCollection(colId: string, name: string, permissions: string[]) {
    try {
      await databases.getCollection(DATABASE_ID, colId);
      console.log(`   Collection "${name}" already exists.`);
    } catch (err: any) {
      if (err.code === 404) {
        console.log(`   Collection "${name}" not found. Creating it...`);
        await databases.createCollection(DATABASE_ID, colId, name, permissions);
        console.log(`   ✅ Collection "${name}" created.`);
      } else {
        throw err;
      }
    }
  }

  // ── Attribute helpers (fire-and-forget; call waitForCollection afterwards) ──

  async function queueStringAttribute(colId: string, key: string, size: number, required: boolean, array = false, defaultValue?: string) {
    try {
      const attr = await databases.getAttribute(DATABASE_ID, colId, key);
      if (attr.status === 'available' || attr.status === 'processing') return;
    } catch {}
    console.log(`   Queuing string attribute "${key}" on "${colId}"...`);
    await databases.createStringAttribute(DATABASE_ID, colId, key, size, required, defaultValue, array);
  }

  async function queueIntegerAttribute(colId: string, key: string, required: boolean, array = false, defaultValue?: number) {
    try {
      const attr = await databases.getAttribute(DATABASE_ID, colId, key);
      if (attr.status === 'available' || attr.status === 'processing') return;
    } catch {}
    console.log(`   Queuing integer attribute "${key}" on "${colId}"...`);
    await databases.createIntegerAttribute(DATABASE_ID, colId, key, required, undefined, undefined, defaultValue, array);
  }

  // Poll listAttributes for a collection until all are 'available' (or one fails)
  async function waitForCollection(colId: string, expectedCount: number) {
    console.log(`   Waiting for all ${expectedCount} attributes on "${colId}" to be ready...`);
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max
    const start = Date.now();
    while (true) {
      if (Date.now() - start > TIMEOUT_MS) {
        throw new Error(`Timed out waiting for attributes on "${colId}" after 5 minutes`);
      }
      const res = await databases.listAttributes(DATABASE_ID, colId);
      const attrs = res.attributes;
      const failed = attrs.find((a: any) => a.status === 'failed');
      if (failed) throw new Error(`Attribute "${(failed as any).key}" failed on "${colId}"`);
      const ready = attrs.filter((a: any) => a.status === 'available').length;
      const allReady = attrs.length >= expectedCount && ready === expectedCount;
      if (allReady) {
        console.log(`   All ${expectedCount} attributes ready on "${colId}" (${Math.round((Date.now() - start) / 1000)}s)`);
        break;
      }
      process.stdout.write(`\r   ${ready}/${expectedCount} attributes ready on "${colId}"...  `);
      await new Promise((r) => setTimeout(r, 3000));
    }
    process.stdout.write('\n');
  }

  // Helper: Create index with waiting
  async function ensureIndex(colId: string, key: string, type: 'key' | 'unique' | 'fulltext', attributes: string[], orders?: OrderBy[]) {
    try {
      const res = await databases.listIndexes(DATABASE_ID, colId);
      const exists = res.indexes.some((idx) => idx.key === key);
      if (exists) return;
    } catch {}

    console.log(`   Creating index "${key}" (${type}) on "${colId}" for [${attributes.join(', ')}]...`);
    await databases.createIndex(DATABASE_ID, colId, key, type as any, attributes, orders);

    const TIMEOUT_MS = 3 * 60 * 1000;
    const start = Date.now();
    while (true) {
      if (Date.now() - start > TIMEOUT_MS) throw new Error(`Timed out waiting for index "${key}" on "${colId}"`);
      const res = await databases.listIndexes(DATABASE_ID, colId);
      const idx = res.indexes.find((i) => i.key === key);
      if (!idx || idx.status === 'available') break;
      if (idx.status === 'failed') throw new Error(`Index "${key}" creation failed`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // 2. Ensure Collections exist
  console.log('\n🗂️ Step 2: Creating collections...');
  const publicRead = [Permission.read(Role.any())];
  const authenticatedAll = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  const commentPerms = [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];

  await ensureCollection(SOURCES_COL, 'Sources', publicRead);
  await ensureCollection(CATEGORIES_COL, 'Categories', publicRead);
  await ensureCollection(TAGS_COL, 'Tags', publicRead);
  await ensureCollection(ARTICLES_COL, 'Articles', publicRead);
  await ensureCollection(COMMENTS_COL, 'Comments', commentPerms);
  await ensureCollection(BOOKMARKS_COL, 'Bookmarks', authenticatedAll);
  await ensureCollection(REACTIONS_COL, 'Reactions', authenticatedAll);
  await ensureCollection(USERS_META_COL, 'Users Meta', authenticatedAll);

  // 3. Collection Attributes
  console.log('\n📝 Step 3: Setting up attributes...');

  // SOURCES (5 attributes)
  console.log('\n--- Sources ---');
  await queueStringAttribute(SOURCES_COL, 'name', 255, true);
  await queueStringAttribute(SOURCES_COL, 'slug', 255, true);
  await queueStringAttribute(SOURCES_COL, 'description', 1000, true);
  await queueStringAttribute(SOURCES_COL, 'logo_id', 255, false);
  await queueStringAttribute(SOURCES_COL, 'accent_color', 7, true);
  await waitForCollection(SOURCES_COL, 5);
  await ensureIndex(SOURCES_COL, 'slug', 'unique', ['slug']);

  // CATEGORIES (4 attributes)
  console.log('\n--- Categories ---');
  await queueStringAttribute(CATEGORIES_COL, 'name', 255, true);
  await queueStringAttribute(CATEGORIES_COL, 'slug', 255, true);
  await queueStringAttribute(CATEGORIES_COL, 'source_slug', 255, true);
  await queueStringAttribute(CATEGORIES_COL, 'color', 7, true);
  await waitForCollection(CATEGORIES_COL, 4);
  await ensureIndex(CATEGORIES_COL, 'slug', 'key', ['slug']);
  await ensureIndex(CATEGORIES_COL, 'source_slug', 'key', ['source_slug']);

  // TAGS (2 attributes)
  console.log('\n--- Tags ---');
  await queueStringAttribute(TAGS_COL, 'name', 255, true);
  await queueStringAttribute(TAGS_COL, 'slug', 255, true);
  await waitForCollection(TAGS_COL, 2);
  await ensureIndex(TAGS_COL, 'slug', 'unique', ['slug']);

  // ARTICLES (13 attributes)
  console.log('\n--- Articles ---');
  await queueStringAttribute(ARTICLES_COL, 'title', 255, true);
  await queueStringAttribute(ARTICLES_COL, 'slug', 255, true);
  await queueStringAttribute(ARTICLES_COL, 'body', 500000, true);
  await queueStringAttribute(ARTICLES_COL, 'excerpt', 2000, true);
  await queueStringAttribute(ARTICLES_COL, 'cover_image_id', 255, false);
  await queueStringAttribute(ARTICLES_COL, 'source', 255, true);
  await queueStringAttribute(ARTICLES_COL, 'source_issue', 255, true);
  await queueStringAttribute(ARTICLES_COL, 'author', 255, true);
  await queueStringAttribute(ARTICLES_COL, 'published_at', 255, true);
  await queueStringAttribute(ARTICLES_COL, 'status', 255, true);
  await queueIntegerAttribute(ARTICLES_COL, 'reading_time', true);
  await queueStringAttribute(ARTICLES_COL, 'category_id', 255, false);
  await queueStringAttribute(ARTICLES_COL, 'tag_ids', 255, false, true);
  await waitForCollection(ARTICLES_COL, 13);
  await ensureIndex(ARTICLES_COL, 'slug', 'unique', ['slug']);
  await ensureIndex(ARTICLES_COL, 'status', 'key', ['status']);
  await ensureIndex(ARTICLES_COL, 'published_at', 'key', ['published_at'], [OrderBy.Desc]);
  await ensureIndex(ARTICLES_COL, 'source', 'key', ['source']);
  await ensureIndex(ARTICLES_COL, 'category_id', 'key', ['category_id']);
  await ensureIndex(ARTICLES_COL, 'title', 'fulltext', ['title']);

  // COMMENTS (5 attributes)
  console.log('\n--- Comments ---');
  await queueStringAttribute(COMMENTS_COL, 'article_id', 255, true);
  await queueStringAttribute(COMMENTS_COL, 'user_id', 255, true);
  await queueStringAttribute(COMMENTS_COL, 'body', 5000, true);
  await queueStringAttribute(COMMENTS_COL, 'created_at', 255, true);
  await queueStringAttribute(COMMENTS_COL, 'parent_id', 255, false);
  await waitForCollection(COMMENTS_COL, 5);
  await ensureIndex(COMMENTS_COL, 'article_id', 'key', ['article_id']);
  await ensureIndex(COMMENTS_COL, 'user_id', 'key', ['user_id']);

  // BOOKMARKS (3 attributes)
  console.log('\n--- Bookmarks ---');
  await queueStringAttribute(BOOKMARKS_COL, 'user_id', 255, true);
  await queueStringAttribute(BOOKMARKS_COL, 'article_id', 255, true);
  await queueStringAttribute(BOOKMARKS_COL, 'created_at', 255, true);
  await waitForCollection(BOOKMARKS_COL, 3);
  await ensureIndex(BOOKMARKS_COL, 'user_article', 'unique', ['user_id', 'article_id'], [OrderBy.Asc, OrderBy.Asc]);

  // REACTIONS (3 attributes)
  console.log('\n--- Reactions ---');
  await queueStringAttribute(REACTIONS_COL, 'user_id', 255, true);
  await queueStringAttribute(REACTIONS_COL, 'article_id', 255, true);
  await queueStringAttribute(REACTIONS_COL, 'type', 255, true);
  await waitForCollection(REACTIONS_COL, 3);
  await ensureIndex(REACTIONS_COL, 'user_article_reaction', 'unique', ['user_id', 'article_id', 'type'], [OrderBy.Asc, OrderBy.Asc, OrderBy.Asc]);

  // USERS_META (4 attributes)
  console.log('\n--- Users Meta ---');
  await queueStringAttribute(USERS_META_COL, 'user_id', 255, true);
  await queueStringAttribute(USERS_META_COL, 'display_name', 255, true);
  await queueStringAttribute(USERS_META_COL, 'avatar_id', 255, false);
  await queueStringAttribute(USERS_META_COL, 'role', 255, true);
  await waitForCollection(USERS_META_COL, 4);
  await ensureIndex(USERS_META_COL, 'user_id', 'unique', ['user_id']);

  // 4. Storage Buckets
  console.log('\n🪣 Step 4: Creating storage buckets...');
  async function ensureBucket(bucketId: string, name: string) {
    try {
      await storage.getBucket(bucketId);
      console.log(`   Bucket "${name}" already exists.`);
    } catch (err: any) {
      if (err.code === 404) {
        console.log(`   Bucket "${name}" not found. Creating it...`);
        // permissions: [Permission.read(Role.any()), Permission.write(Role.users())]
        await storage.createBucket(
          bucketId,
          name,
          [Permission.read(Role.any()), Permission.create(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())],
          false, // fileSecurity — false = bucket-level permissions apply
          true   // enabled
        );
        console.log(`   ✅ Bucket "${name}" created.`);
      } else {
        throw err;
      }
    }
  }

  await ensureBucket(BUCKETS.covers, 'Covers');
  await ensureBucket(BUCKETS.logos, 'Source Logos');
  await ensureBucket(BUCKETS.avatars, 'Avatars');

  // 5. Seeding Data
  console.log('\n🌱 Step 5: Seeding initial sources and categories...');

  // Seed Sources
  const seedSources = [
    {
      $id: 'economist',
      name: 'The Economist',
      slug: 'economist' as const,
      description: 'Insightful analysis of global news, politics, business, finance, science, technology and culture.',
      accent_color: '#E3120B',
      logo_id: '',
    },
    {
      $id: 'new-yorker',
      name: 'The New Yorker',
      slug: 'new-yorker' as const,
      description: 'A weekly magazine with a signature mix of reporting, commentary, criticism, essays, fiction, satire, cartoons, and poetry.',
      accent_color: '#000000',
      logo_id: '',
    },
    {
      $id: 'new-scientist',
      name: 'New Scientist',
      slug: 'new-scientist' as const,
      description: 'The world\'s most popular weekly science and technology publication, covering outstanding discoveries and essential issues.',
      accent_color: '#0072CE',
      logo_id: '',
    },
  ];

  for (const src of seedSources) {
    try {
      await databases.createDocument(DATABASE_ID, SOURCES_COL, src.$id, {
        name: src.name,
        slug: src.slug,
        description: src.description,
        accent_color: src.accent_color,
        logo_id: src.logo_id,
      });
      console.log(`   ✅ Seeded source: ${src.name}`);
    } catch (err: any) {
      if (err.code === 409) {
        console.log(`   Source "${src.name}" already seeded.`);
      } else {
        console.error(`   ❌ Failed to seed source "${src.name}":`, err.message);
      }
    }
  }

  // Seed Categories
  const seedCategories = [
    // Economist
    { name: 'Politics & World Affairs', slug: 'politics-world-affairs', source_slug: 'economist', color: '#1E3A8A' },
    { name: 'In Depth', slug: 'in-depth', source_slug: 'economist', color: '#0F172A' },
    { name: 'United States', slug: 'united-states', source_slug: 'economist', color: '#B91C1C' },
    { name: 'Britain', slug: 'britain', source_slug: 'economist', color: '#7C2D12' },
    { name: 'Europe', slug: 'europe', source_slug: 'economist', color: '#2563EB' },
    { name: 'Asia', slug: 'asia', source_slug: 'economist', color: '#059669' },
    { name: 'Middle East & Africa', slug: 'middle-east-africa', source_slug: 'economist', color: '#D97706' },
    { name: 'The Americas', slug: 'the-americas', source_slug: 'economist', color: '#9333EA' },
    { name: 'International', slug: 'international', source_slug: 'economist', color: '#4F46E5' },
    { name: 'Business', slug: 'business', source_slug: 'economist', color: '#0369A1' },
    { name: 'Finance & Economics', slug: 'finance-economics', source_slug: 'economist', color: '#0D9488' },
    { name: 'Science & Technology', slug: 'science-technology', source_slug: 'economist', color: '#059669' },
    { name: 'Culture & Books', slug: 'culture-books', source_slug: 'economist', color: '#B45309' },

    // New Yorker
    { name: 'Opinion & Comment', slug: 'opinion-comment', source_slug: 'new-yorker', color: '#111827' },
    { name: 'Essays & Reporting', slug: 'essays-reporting', source_slug: 'new-yorker', color: '#374151' },
    { name: 'Fiction', slug: 'fiction', source_slug: 'new-yorker', color: '#6B7280' },
    { name: 'Poetry', slug: 'poetry', source_slug: 'new-yorker', color: '#9CA3AF' },
    { name: 'Culture & Arts', slug: 'culture-arts', source_slug: 'new-yorker', color: '#4B5563' },
    { name: 'Books', slug: 'books', source_slug: 'new-yorker', color: '#1F2937' },
    { name: 'Film & TV', slug: 'film-tv', source_slug: 'new-yorker', color: '#DC2626' },
    { name: 'Music', slug: 'music', source_slug: 'new-yorker', color: '#2563EB' },
    { name: 'Humor', slug: 'humor', source_slug: 'new-yorker', color: '#D97706' },

    // New Scientist
    { name: 'Science News', slug: 'science-news', source_slug: 'new-scientist', color: '#2563EB' },
    { name: 'Opinion & Comment', slug: 'opinion-comment-ns', source_slug: 'new-scientist', color: '#1E40AF' },
    { name: 'Science Features', slug: 'science-features', source_slug: 'new-scientist', color: '#4F46E5' },
    { name: 'Technology', slug: 'technology', source_slug: 'new-scientist', color: '#059669' },
    { name: 'Environment', slug: 'environment', source_slug: 'new-scientist', color: '#047857' },
    { name: 'Health & Medicine', slug: 'health-medicine', source_slug: 'new-scientist', color: '#DC2626' },
    { name: 'Space & Astronomy', slug: 'space-astronomy', source_slug: 'new-scientist', color: '#7C3AED' },
    { name: 'Physics & Mathematics', slug: 'physics-mathematics', source_slug: 'new-scientist', color: '#EC4899' },
    { name: 'Life Sciences', slug: 'life-sciences', source_slug: 'new-scientist', color: '#10B981' },
  ];

  for (const cat of seedCategories) {
    const docId = `${cat.source_slug}_${cat.slug}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 36);
    try {
      await databases.createDocument(DATABASE_ID, CATEGORIES_COL, docId, {
        name: cat.name,
        slug: cat.slug,
        source_slug: cat.source_slug,
        color: cat.color,
      });
      console.log(`   ✅ Seeded category: ${cat.name} (${cat.source_slug})`);
    } catch (err: any) {
      if (err.code === 409) {
        console.log(`   Category "${cat.name}" for "${cat.source_slug}" already seeded.`);
      } else {
        console.error(`   ❌ Failed to seed category "${cat.name}":`, err.message);
      }
    }
  }

  console.log('\n✨ Appwrite Database Setup completed successfully! All collections, attributes, indexes, storage buckets, and seeds are ready. ✨\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal configuration error during Appwrite setup:', err);
  process.exit(1);
});
