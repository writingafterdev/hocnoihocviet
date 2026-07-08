// src/lib/appwrite.ts
// Client-side Appwrite SDK (browser)

import { Client, Account, Databases, Storage, Query } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export const COLLECTIONS = {
  articles:   process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID!,
  sources:    process.env.NEXT_PUBLIC_APPWRITE_SOURCES_COLLECTION_ID!,
  categories: process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID!,
  tags:       process.env.NEXT_PUBLIC_APPWRITE_TAGS_COLLECTION_ID!,
  comments:   process.env.NEXT_PUBLIC_APPWRITE_COMMENTS_COLLECTION_ID!,
  bookmarks:  process.env.NEXT_PUBLIC_APPWRITE_BOOKMARKS_COLLECTION_ID!,
  reactions:  process.env.NEXT_PUBLIC_APPWRITE_REACTIONS_COLLECTION_ID!,
  users_meta: process.env.NEXT_PUBLIC_APPWRITE_USERS_META_COLLECTION_ID!,
  vocab:      process.env.NEXT_PUBLIC_APPWRITE_VOCAB_COLLECTION_ID!,
  global_dictionary: process.env.NEXT_PUBLIC_APPWRITE_GLOBAL_DICTIONARY_COLLECTION_ID!,
  questions:  process.env.NEXT_PUBLIC_APPWRITE_QUESTIONS_COLLECTION_ID!,
  featured_phrases: process.env.NEXT_PUBLIC_APPWRITE_FEATURED_PHRASES_COLLECTION_ID!,
  active_sessions: process.env.NEXT_PUBLIC_APPWRITE_ACTIVE_SESSIONS_COLLECTION_ID!,
};

export const BUCKETS = {
  covers:  process.env.NEXT_PUBLIC_APPWRITE_COVERS_BUCKET_ID!,
  logos:   process.env.NEXT_PUBLIC_APPWRITE_LOGOS_BUCKET_ID!,
  avatars: process.env.NEXT_PUBLIC_APPWRITE_AVATARS_BUCKET_ID!,
};

export function getCoverUrl(fileId: string, width = 800): string {
  if (!fileId) return '';
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) return fileId;
  return storage.getFileView(BUCKETS.covers, fileId).toString();
}

export function getLogoUrl(fileId: string): string {
  if (!fileId) return '';
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) return fileId;
  return storage.getFileView(BUCKETS.logos, fileId).toString();
}

export function getAvatarUrl(fileId: string): string {
  if (!fileId) return '';
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) return fileId;
  return storage.getFilePreview(BUCKETS.avatars, fileId, 64).toString();
}

export { Query };
export { client };
