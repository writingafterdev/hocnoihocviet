'use client';
import { useState, useEffect } from 'react';
import { databases, DB_ID, COLLECTIONS, getCoverUrl } from '@/lib/appwrite';
import { getCurrentUser } from '@/lib/auth';
import { Query } from 'appwrite';
import ArticleCard from '@/components/ArticleCard';
import type { Article, Bookmark } from '@/types';
import Link from 'next/link';

export default function BookmarksPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) { setAuthed(false); setLoading(false); return; }
      setAuthed(true);

      const bm = await databases.listDocuments(DB_ID, COLLECTIONS.bookmarks, [
        Query.equal('user_id', user.$id),
        Query.orderDesc('created_at'),
        Query.limit(50),
      ]);

      if (bm.documents.length === 0) { setLoading(false); return; }

      const ids = bm.documents.map((d) => d.article_id as string);
      const art = await databases.listDocuments(DB_ID, COLLECTIONS.articles, [
        Query.equal('$id', ids),
      ]);
      setArticles(art.documents as unknown as Article[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="container py-16 text-center">
        <div className="skeleton" style={{ height: 24, width: 200, margin: '0 auto' }} />
      </div>
    );
  }

  if (authed === false) {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <h1 className="auth-title">Your Bookmarks</h1>
          <p className="auth-subtitle">Sign in to see your saved articles</p>
          <Link href="/auth/login" className="btn btn-primary w-full">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="container">
        <h1 className="display-md font-serif mb-8">Your Bookmarks</h1>
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔖</p>
            <p className="text-muted">No bookmarks yet. Start saving articles you love!</p>
            <Link href="/articles" className="btn btn-primary mt-4">Browse articles</Link>
          </div>
        ) : (
          <div className="grid-articles stagger">
            {articles.map((a) => <ArticleCard key={a.$id} article={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}
