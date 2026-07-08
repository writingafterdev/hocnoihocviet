'use client';
import { useState, useEffect } from 'react';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { getCurrentUser } from '@/lib/auth';
import { ID, Query } from 'appwrite';

interface Props { articleId: string; }

export default function BookmarkButton({ articleId }: Props) {
  const [saved, setSaved] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const user = await getCurrentUser();
      if (!user) { setLoading(false); return; }
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.bookmarks, [
        Query.equal('user_id', user.$id),
        Query.equal('article_id', articleId),
        Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        setSaved(true);
        setBookmarkId(res.documents[0].$id);
      }
      setLoading(false);
    }
    check();
  }, [articleId]);

  async function toggle() {
    const user = await getCurrentUser();
    if (!user) { window.location.href = '/auth/login'; return; }

    // Optimistic update
    setSaved((prev) => !prev);
    try {
      if (saved && bookmarkId) {
        await databases.deleteDocument(DB_ID, COLLECTIONS.bookmarks, bookmarkId);
        setBookmarkId(null);
      } else {
        const doc = await databases.createDocument(DB_ID, COLLECTIONS.bookmarks, ID.unique(), {
          user_id: user.$id,
          article_id: articleId,
          created_at: new Date().toISOString(),
        });
        setBookmarkId(doc.$id);
      }
    } catch {
      setSaved((prev) => !prev); // rollback
    }
  }

  if (loading) return null;

  return (
    <button
      id={`bookmark-btn-${articleId}`}
      className={`bookmark-btn ${saved ? 'saved' : ''}`}
      onClick={toggle}
      aria-label={saved ? 'Remove bookmark' : 'Save article'}
      aria-pressed={saved}
    >
      {saved ? '🔖 Saved' : '🔖 Save'}
    </button>
  );
}
