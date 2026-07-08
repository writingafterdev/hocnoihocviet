'use client';
import { useState, useEffect } from 'react';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { getCurrentUser } from '@/lib/auth';
import { ID, Query } from 'appwrite';
import type { ReactionType } from '@/types';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'clap',  emoji: '👏', label: 'Clap' },
  { type: 'like',  emoji: '❤️', label: 'Like' },
  { type: 'fire',  emoji: '🔥', label: 'Fire' },
];

interface Props { articleId: string; }

export default function ReactionBar({ articleId }: Props) {
  const [counts, setCounts] = useState<Record<ReactionType, number>>({ clap: 0, like: 0, fire: 0 });
  const [active, setActive] = useState<ReactionType | null>(null);
  const [reactionId, setReactionId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Fetch reaction counts
      const all = await databases.listDocuments(DB_ID, COLLECTIONS.reactions, [
        Query.equal('article_id', articleId),
        Query.limit(500),
      ]);
      const c: Record<ReactionType, number> = { clap: 0, like: 0, fire: 0 };
      all.documents.forEach((d) => { c[d.type as ReactionType]++; });
      setCounts(c);

      // Check user's reaction
      const user = await getCurrentUser();
      if (!user) return;
      const mine = all.documents.find((d) => d.user_id === user.$id);
      if (mine) { setActive(mine.type as ReactionType); setReactionId(mine.$id); }
    }
    load();
  }, [articleId]);

  async function react(type: ReactionType) {
    const user = await getCurrentUser();
    if (!user) { window.location.href = '/auth/login'; return; }

    const prev = active;
    const prevId = reactionId;

    // Optimistic
    setCounts((c) => {
      const next = { ...c };
      if (prev) next[prev]--;
      if (prev !== type) next[type]++;
      return next;
    });
    setActive(prev === type ? null : type);
    setReactionId(null);

    try {
      if (prevId) await databases.deleteDocument(DB_ID, COLLECTIONS.reactions, prevId);
      if (prev !== type) {
        const doc = await databases.createDocument(DB_ID, COLLECTIONS.reactions, ID.unique(), {
          user_id: user.$id, article_id: articleId, type,
        });
        setReactionId(doc.$id);
      }
    } catch {
      // Rollback
      setCounts((c) => {
        const next = { ...c };
        if (prev) next[prev]++;
        if (prev !== type) next[type]--;
        return next;
      });
      setActive(prev);
      setReactionId(prevId);
    }
  }

  return (
    <div className="reaction-bar" role="group" aria-label="Article reactions">
      {REACTIONS.map(({ type, emoji, label }) => (
        <button
          key={type}
          id={`reaction-${type}-${articleId}`}
          className={`reaction-btn ${active === type ? 'active' : ''}`}
          onClick={() => react(type)}
          aria-label={`${label}: ${counts[type]}`}
          aria-pressed={active === type}
        >
          <span aria-hidden="true">{emoji}</span>
          <span>{counts[type]}</span>
        </button>
      ))}
    </div>
  );
}
