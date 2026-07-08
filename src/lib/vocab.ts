// src/lib/vocab.ts
// Client-side vocab bank helpers — uses the browser Appwrite SDK

import { databases, DB_ID, COLLECTIONS, Query } from './appwrite';
import { ID } from 'appwrite';

export type Mastery = 'new' | 'learning' | 'inReview' | 'mastered';

export interface VocabEntry {
  $id?: string;
  $createdAt?: string;
  word: string;
  pos?: string;
  definition?: string;
  example?: string;
  tags?: string[];
  article_id?: string;
  article_title?: string;
  original_context?: string;
  mastery?: Mastery;
  next_review?: string;
  interval?: number;
  ease_factor?: number;
  repetitions?: number;
}

// ─── Save a word to the current user's Vocab Bank ────────────────────────────
// Requires the user to be authenticated. Appwrite document-level security
// (documentSecurity: true on the collection + read/write("user:<id>") perms)
// ensures each user only sees their own words.
export async function saveVocabEntry(
  entry: Omit<VocabEntry, '$id' | '$createdAt'>,
  userId: string
): Promise<VocabEntry> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.vocab,
    ID.unique(),
    {
      word:             entry.word,
      pos:              entry.pos ?? null,
      definition:       entry.definition ?? null,
      example:          entry.example ?? null,
      tags:             entry.tags ?? [],
      article_id:       entry.article_id ?? null,
      article_title:    entry.article_title ?? null,
      original_context: entry.original_context ?? null,
      mastery:          'new',
      next_review:      new Date().toISOString(),
      interval:         0,
      ease_factor:      2.5,
      repetitions:      0,
    },
    // Document-level permissions: only this user can read/update/delete
    [
      `read("user:${userId}")`,
      `update("user:${userId}")`,
      `delete("user:${userId}")`,
    ]
  );
  return doc as unknown as VocabEntry;
}

// ─── Fetch all vocab entries for the current user ───────────────────────────
export async function listVocabEntries(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  mastery?: Mastery;
  dueOnly?: boolean;
}): Promise<VocabEntry[]> {
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(opts?.limit ?? 50),
  ];
  if (opts?.offset) queries.push(Query.offset(opts.offset));
  if (opts?.mastery) queries.push(Query.equal('mastery', opts.mastery));
  if (opts?.search) {
    queries.push(Query.search('word', opts.search));
  }
  if (opts?.dueOnly) {
    queries.push(Query.lessThanEqual('next_review', new Date().toISOString()));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.vocab, queries);
  return res.documents as unknown as VocabEntry[];
}

export async function updateMastery(
  docId: string,
  mastery: Mastery
): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.vocab, docId, { mastery });
}

// ─── SRS Algorithm ───────────────────────────────────────────────────────────
export function calculateNextReview(grade: 0 | 1 | 2 | 3, currentEntry: VocabEntry): Partial<VocabEntry> {
  // grade: 0 (Again), 1 (Hard), 2 (Good), 3 (Easy)
  let { interval = 0, ease_factor = 2.5, repetitions = 0 } = currentEntry;
  
  if (grade >= 2) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease_factor);
    
    repetitions++;
    ease_factor = ease_factor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
  } else {
    repetitions = 0;
    interval = 1;
    ease_factor = ease_factor - 0.2;
  }
  
  if (ease_factor < 1.3) ease_factor = 1.3;
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  
  // Determine mastery based on new interval
  let mastery: Mastery = 'learning';
  if (interval === 0) mastery = 'new';
  else if (interval > 14) mastery = 'mastered';
  else if (interval > 3) mastery = 'inReview';

  return {
    next_review: nextDate.toISOString(),
    interval,
    ease_factor,
    repetitions,
    mastery
  };
}

export async function updateVocabSRS(docId: string, updates: Partial<VocabEntry>): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.vocab, docId, updates);
}

// ─── Delete a vocab entry ────────────────────────────────────────────────────
export async function deleteVocabEntry(docId: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.vocab, docId);
}

// ─── Check if a word already exists for this user ───────────────────────────
export async function vocabWordExists(word: string): Promise<boolean> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.vocab, [
    Query.equal('word', word),
    Query.limit(1),
  ]);
  return res.total > 0;
}
