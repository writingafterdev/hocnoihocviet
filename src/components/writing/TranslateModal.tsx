'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Check, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { account } from '@/lib/appwrite';
import { saveVocabEntry, vocabWordExists, type VocabEntry } from '@/lib/vocab';

export default function TranslateModal({
  isOpen,
  onClose,
  essayContext,
  storageKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  essayContext: string;
  storageKey: string;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VocabEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle');
  const [history, setHistory] = useState<VocabEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to parse translate history:', e);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery('');
      setResult(null);
      setError(null);
      setSaveStatus('idle');
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setSaveStatus('idle');

    try {
      const res = await fetch('/api/writing/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: query.trim(),
          context: essayContext,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch translation');
      const data = await res.json();

      const newEntry: VocabEntry = {
        word: data.word,
        pos: data.pos,
        definition: data.definition,
        example: data.example,
        tags: data.topics || data.tags || [],
        originalPhrase: query.trim()
      } as any; 

      setResult(newEntry);

      const updatedHistory = [newEntry, ...history.filter(h => h.word !== newEntry.word)].slice(0, 20);
      setHistory(updatedHistory);
      if (typeof window !== 'undefined' && storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
      }

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaveStatus('saving');
    try {
      const exists = await vocabWordExists(result.word);
      if (exists) {
        setSaveStatus('duplicate');
        return;
      }
      const user = await account.get();
      await saveVocabEntry({
        word: result.word,
        pos: result.pos,
        definition: result.definition,
        example: result.example,
        tags: result.tags,
        article_title: 'Essay Translation',
      }, user.$id);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const loadHistoryItem = (item: VocabEntry) => {
    setQuery((item as any).originalPhrase || item.word);
    setResult(item);
    setError(null);
    setSaveStatus('idle');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.8 }}
            className="fixed z-50 bottom-24 right-5 w-[360px] bg-white rounded-2xl flex flex-col overflow-hidden"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              boxShadow: '0px 13.18px 7.688px 0px rgba(0,0,0,0.02), 0px 5.492px 5.492px 0px rgba(0,0,0,0.04), 0px 1.098px 3.295px 0px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase font-sans">Translate & Suggest</span>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors"
              >
                <X className="w-[14px] h-[14px]" strokeWidth={2.5} />
              </button>
            </div>

            <div className="px-5 pb-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={2.2} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nhập từ tiếng Việt..."
                    className="w-full h-10 pl-9 pr-3 bg-[#f2f2f2] rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:bg-neutral-200/70 transition-colors font-sans"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!query.trim() || loading}
                  className="h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-xl disabled:opacity-30 hover:bg-neutral-800 transition-colors flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dịch'}
                </button>
              </form>
            </div>

            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-5 pb-6 flex items-center gap-3 text-neutral-400"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[13px] font-sans">Translating with context&hellip;</span>
                </motion.div>
              )}

              {error && !loading && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-5 pb-5"
                >
                  <p className="text-[13px] text-red-500 font-sans">{error}</p>
                </motion.div>
              )}

              {/* HISTORY VIEW */}
              {!result && !loading && !error && history.length > 0 && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-5 pb-5 max-h-[300px] overflow-y-auto"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-[11px] font-semibold text-neutral-400 tracking-widest uppercase font-sans">Recent Lookups</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {history.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => loadHistoryItem(item)}
                        className="text-left px-3 py-2.5 rounded-xl hover:bg-neutral-100 transition-colors group flex flex-col gap-1"
                      >
                        <div className="flex items-baseline justify-between gap-3 w-full">
                          <span className="text-[14px] font-semibold text-neutral-900 truncate">
                            {item.word}
                          </span>
                          <span className="text-[11px] text-neutral-400 font-mono uppercase tracking-widest flex-shrink-0">
                            {item.pos}
                          </span>
                        </div>
                        {(item as any).originalPhrase && (
                          <span className="text-[12px] text-neutral-500 truncate w-full">
                            "{(item as any).originalPhrase}"
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* RESULT VIEW */}
              {result && !loading && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="px-5 pb-5"
                >
                  <div className="h-px bg-neutral-100 mb-5" />

                  <div className="flex items-baseline gap-3 mb-4">
                    <h2 className="text-[26px] font-sans font-semibold text-neutral-900 leading-none">{result.word}</h2>
                    {result.pos && (
                      <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 font-medium">{result.pos}</span>
                    )}
                  </div>

                  {result.definition && (
                    <p className="text-[14px] font-sans text-neutral-700 leading-relaxed mb-4">{result.definition}</p>
                  )}

                  {result.example && (
                    <p className="text-[13px] font-sans text-neutral-500 leading-relaxed border-l-[2px] border-neutral-200 pl-3">
                      {result.example}
                    </p>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved' || saveStatus === 'duplicate'}
                    className="mt-5 w-full h-10 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all"
                    style={{
                      backgroundColor:
                        saveStatus === 'saved' ? '#10B981' :
                        saveStatus === 'duplicate' ? '#F59E0B' :
                        saveStatus === 'error' ? '#EF4444' :
                        '#000000',
                      color: '#ffffff',
                    }}
                  >
                    {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {(saveStatus === 'saved' || saveStatus === 'duplicate') && <Check className="w-4 h-4" strokeWidth={2.5} />}
                    {saveStatus === 'idle' && 'Lưu vào Từ vựng'}
                    {saveStatus === 'saving' && 'Đang lưu…'}
                    {saveStatus === 'saved' && 'Đã lưu'}
                    {saveStatus === 'duplicate' && 'Đã có trong Từ vựng'}
                    {saveStatus === 'error' && 'Thử lại'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
