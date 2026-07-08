'use client';
import { useState, useEffect } from 'react';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { Trash2, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminArticleList() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.articles, [
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]);
      setArticles(res.documents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    
    try {
      setDeletingId(id);
      const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      setArticles(prev => prev.filter(a => a.$id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.error('Failed to delete', e);
      alert('Failed to delete article.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} articles?`)) return;

    try {
      setIsBulkDeleting(true);
      for (const id of selectedIds) {
        const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          console.error(`Failed to delete ${id}:`, data.error);
        }
      }
      setArticles(prev => prev.filter(a => !selectedIds.has(a.$id)));
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Bulk delete failed', e);
      alert('Some articles failed to delete.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map(a => a.$id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[12px] font-sans uppercase tracking-widest font-bold">Loading Library...</span>
      </div>
    );
  }

  if (articles.length === 0) {
    return <p className="text-[13px] font-serif text-neutral-500">No articles found in the database.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.size > 0 && (
        <div className="flex justify-between items-center bg-red-50 border border-red-200 p-4 rounded-lg">
          <span className="text-[13px] font-sans font-bold text-red-800">{selectedIds.size} selected</span>
          <button 
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="px-4 py-2 bg-red-600 text-white text-[11px] font-sans uppercase tracking-widest font-bold rounded flex items-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Selected
          </button>
        </div>
      )}

      <div className="flex flex-col border border-black/10">
        <div className="flex items-center gap-4 p-4 border-b border-black/10 bg-[#111]/5">
          <input 
            type="checkbox" 
            checked={articles.length > 0 && selectedIds.size === articles.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
          />
          <span className="text-[11px] font-sans uppercase tracking-widest font-bold text-neutral-500">Select All</span>
        </div>

        {articles.map((article, i) => (
            <div key={article.$id} className={`flex flex-col gap-3 p-4 ${i !== articles.length - 1 ? 'border-b border-black/10' : ''}`}>
              <div className="flex items-start gap-4">
                <input 
                  type="checkbox"
                  checked={selectedIds.has(article.$id)}
                  onChange={() => toggleSelect(article.$id)}
                  className="w-4 h-4 mt-1 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                />
                
                <div className="flex-1 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <Link href={`/admin/articles/${article.$id}`} className="hover:opacity-70 transition-opacity">
                      <h4 className="text-[15px] font-heading text-[#111]">{article.title || 'Untitled Article'}</h4>
                    </Link>
                    <div className="text-[11px] font-sans uppercase tracking-widest text-neutral-400 flex gap-4">
                      <span>{new Date(article.$createdAt).toLocaleDateString()}</span>
                      <span>{article.author || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link 
                      href={`/articles/${article.slug || article.$id}`} 
                      target="_blank"
                      className="text-neutral-400 hover:text-black transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button 
                      onClick={() => handleDelete(article.$id)}
                      disabled={deletingId === article.$id || isBulkDeleting}
                      className="text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingId === article.$id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}
