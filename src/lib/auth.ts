// src/lib/auth.ts
// Auth helpers — client-side session management

import { account } from './appwrite';
import { databases, DB_ID, COLLECTIONS } from './appwrite';
import { ID, Query, OAuthProvider } from 'appwrite';
import type { UserMeta } from '@/types';

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export async function getUserMeta(userId: string): Promise<UserMeta | null> {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.users_meta, [
      Query.equal('user_id', userId),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return res.documents[0] as unknown as UserMeta;
  } catch {
    return null;
  }
}

/** Auto-create a users_meta row if the user doesn't have one (e.g. Google OAuth). */
export async function ensureUserMeta(userId: string, displayName?: string): Promise<UserMeta> {
  const existing = await getUserMeta(userId);
  if (existing) return existing;

  console.log('[ensureUserMeta] Creating missing users_meta for', userId);
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.users_meta, ID.unique(), {
    user_id: userId,
    display_name: displayName || '',
    avatar_id: '',
    role: 'reader',
  });
  return doc as unknown as UserMeta;
}

export async function register(email: string, password: string, name: string) {
  const user = await account.create(ID.unique(), email, password, name);
  await account.createEmailPasswordSession(email, password);
  // Create user meta document
  await databases.createDocument(DB_ID, COLLECTIONS.users_meta, ID.unique(), {
    user_id: user.$id,
    display_name: name,
    avatar_id: '',
    role: 'reader',
  });
  return user;
}

export async function login(email: string, password: string) {
  return account.createEmailPasswordSession(email, password);
}

export async function logout() {
  return account.deleteSession('current');
}

export function loginWithGoogle() {
  const success = encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:3000/');
  const failure = encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/auth/login?error=oauth_failed` : 'http://localhost:3000/auth/login?error=oauth_failed');
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a1d8fca002bb2a78d76';
  
  window.location.href = `${endpoint}/account/sessions/oauth2/google?project=${projectId}&success=${success}&failure=${failure}`;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const meta = await getUserMeta(userId);
  return meta?.role === 'admin';
}

export async function updateUserMeta(docId: string, updates: Partial<UserMeta>) {
  return databases.updateDocument(DB_ID, COLLECTIONS.users_meta, docId, updates);
}

export async function dismissExcerpts(userId: string, newExcerptIds: string[]) {
  if (newExcerptIds.length === 0) return;
  console.log('[dismissExcerpts] Starting for user:', userId, 'ids:', newExcerptIds);
  const meta = await getUserMeta(userId);
  if (!meta) {
    console.error('[dismissExcerpts] ❌ No meta doc found for user:', userId);
    return;
  }

  const currentDismissed = meta.dismissed_excerpts || [];
  const combined = Array.from(new Set([...currentDismissed, ...newExcerptIds]));
  console.log('[dismissExcerpts] Current dismissed:', currentDismissed.length, '→ New total:', combined.length);

  try {
    await updateUserMeta(meta.$id, { dismissed_excerpts: combined } as any);
    console.log('[dismissExcerpts] ✅ Successfully updated dismissed_excerpts');
  } catch (e) {
    console.error('[dismissExcerpts] ❌ Failed to update:', e);
  }
}
