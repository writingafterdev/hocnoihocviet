'use client';
import { useMemo, useState, useEffect } from 'react';
import {
  SlidersHorizontal, ChevronDown, ArrowRight,
  FolderOpen, Dumbbell, Plus, Search, Check, Trash2, Loader2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import TopHeader from '@/components/TopHeader';


import { listVocabEntries, deleteVocabEntry, type VocabEntry } from '@/lib/vocab';

const MASTERY: Record<string, { label: string; color: string; bg: string }> = {
  mastered: { label: 'Mastered',  color: '#3b5e47', bg: '#3b5e4715' },
  inReview: { label: 'In review', color: '#b85d19', bg: '#b85d1915' },
  learning: { label: 'Learning',  color: '#111', bg: '#11115' },
  new:      { label: 'New',       color: '#11111160', bg: 'transparent' },
};

const TAG_COLORS = [
  { text: '#3b5e47', bg: '#3b5e4712', border: '#3b5e4730' }, // Sage green
  { text: '#2b4c7e', bg: '#2b4c7e12', border: '#2b4c7e30' }, // Slate blue
  { text: '#111', bg: '#11112', border: '#11130' }, // Brick red
  { text: '#b85d19', bg: '#b85d1912', border: '#b85d1930' }, // Rust orange
  { text: '#6b4c7a', bg: '#6b4c7a12', border: '#6b4c7a30' }, // Muted plum
  { text: '#5c6b73', bg: '#5c6b7312', border: '#5c6b7330' }, // Blue grey
  { text: '#8b6d4d', bg: '#8b6d4d12', border: '#8b6d4d30' }, // Warm brown
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function ExampleText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="italic font-serif text-[#111]/70 leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <span key={i} className="not-italic font-sans font-medium text-[#111]">{p.slice(2, -2)}</span>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
}

function ProgressDonut({ counts, total }: { counts: Record<string, number>, total: number }) {
  const segments: { key: string; value: number }[] = [
    { key: 'mastered', value: counts.mastered || 0 },
    { key: 'inReview', value: counts.inReview || 0 },
    { key: 'learning', value: counts.learning || 0 },
    { key: 'new',      value: counts.new || 0 },
  ];
  const R = 56;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative w-[160px] h-[160px]">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
        {segments.map((s) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * C;
          const dash = `${len} ${C - len}`;
          
          const color = MASTERY[s.key].color;

          const el = (
            <circle key={s.key} cx="80" cy="80" r={R} fill="none" strokeWidth="8" stroke={color} strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="butt" className="transition-all duration-500" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[32px] font-heading tracking-tight text-[#111] leading-none">{total}</div>
        <div className="text-[9px] font-sans uppercase tracking-widest text-[#111]/40 mt-1">Total Words</div>
      </div>
    </div>
  );
}

function SidebarDropdown({ value, options, onChange, placeholder }: { value: string, options: string[], onChange: (v: string) => void, placeholder: string }) {
  const [open, setOpen] = useState(false);
  
  const displayValue = value === 'All' || value === 'All topics' ? placeholder : value;
  
  return (
    <div className="relative mt-2">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-full inline-flex items-center justify-between border-b border-black/10 pb-2 text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] hover:opacity-60 hover:border-[#111] transition-colors"
      >
        {displayValue} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{ transformOrigin: 'top center' }}
              className="absolute z-20 top-full left-0 right-0 mt-2 max-h-[240px] overflow-y-auto bg-[#FFFFFF] border border-black/10 shadow-xl py-2"
            >
              {options.map((o) => (
                <button
                  key={o}
                  onClick={() => { onChange(o); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[11px] font-sans uppercase tracking-widest hover:bg-[#111]/5 transition-colors ${o === value ? 'text-[#111] font-bold' : 'text-[#111]/70 font-medium'}`}
                >
                  {o.length > 30 ? o.slice(0, 30) + '...' : o}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LibraryPage() {
  const [vocabData, setVocabData] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Filters
  const [filterMastery, setFilterMastery] = useState<string>('All');
  const [filterPos, setFilterPos] = useState<string>('All');
  const [filterTag, setFilterTag] = useState<string>('All topics');

  const activeFilterCount = (filterMastery !== 'All' ? 1 : 0) + (filterPos !== 'All' ? 1 : 0) + (filterTag !== 'All topics' ? 1 : 0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    import('@/lib/auth').then(({ getCurrentUser }) => {
      getCurrentUser().then((user) => {
        if (!user) {
          setLoading(false);
          return;
        }
        listVocabEntries({ limit: 100 })
          .then(data => { setVocabData(data); setLoading(false); })
          .catch(err => { console.error(err); setLoading(false); });
      });
    });
  }, []);

  const uniquePos = useMemo(() => Array.from(new Set(vocabData.map(v => v.pos).filter(Boolean) as string[])).sort(), [vocabData]);
  const uniqueTags = useMemo(() => Array.from(new Set(vocabData.flatMap(v => v.tags || []))).sort(), [vocabData]);

  const filtered = useMemo(() => {
    let result = vocabData;

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(v => v.word.toLowerCase().includes(q) || v.definition?.toLowerCase().includes(q));
    }

    if (filterMastery !== 'All') {
      const val = filterMastery === 'Mastered' ? 'mastered' :
                  filterMastery === 'In review' ? 'inReview' :
                  filterMastery === 'Learning' ? 'learning' : 'new';
      result = result.filter(v => (v.mastery || 'new') === val);
    }

    if (filterPos !== 'All') {
      result = result.filter(v => v.pos === filterPos);
    }

    if (filterTag !== 'All topics') {
      result = result.filter(v => v.tags?.includes(filterTag));
    }

    return result;
  }, [query, vocabData, filterMastery, filterPos, filterTag]);

  function clearFilters() {
    setFilterMastery('All');
    setFilterPos('All');
    setFilterTag('All topics');
    setQuery('');
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this word from your bank?')) return;
    try {
      setDeletingId(id);
      await deleteVocabEntry(id);
      setVocabData(prev => prev.filter(v => v.$id !== id));
    } catch (e) {
      console.error('Failed to delete vocab', e);
      alert('Failed to delete word.');
    } finally {
      setDeletingId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { mastered: 0, inReview: 0, learning: 0, new: 0 };
    vocabData.forEach(v => {
      if (v.mastery && c[v.mastery] !== undefined) c[v.mastery]++;
      else c.new++;
    });
    return c;
  }, [vocabData]);

  return (
    <main className="w-full min-h-screen bg-[#FFFFFF] selection:bg-neutral-200 selection:text-[#111]">
      <TopHeader user={null} />
      
      <div className="w-full max-w-[1060px] mx-auto px-4 md:px-0 pt-10 pb-32 flex flex-col">
        
        {/* Page Header (Hero) */}
        <div className="flex items-start gap-6 mb-12">
          <div className="w-20 h-20 rounded-[18px] bg-[#FFE17B] flex items-center justify-center shrink-0">
            <img
              src="/images/illustrations/il-knowledge.svg"
              className="w-10 h-10 object-contain"
              alt=""
            />
          </div>
          <div className="pt-1">
            <div className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-[#857F70] mb-3">
              YOUR LIBRARY • {vocabData.length || 0} WORDS
            </div>
            <h1 className="font-sans font-semibold text-[32px] tracking-tight text-[#141413]">Vocabulary Bank</h1>
          </div>
        </div>

        {/* ── Main Content Area (Dictionary) ── */}
        <div className="flex flex-col">
          
          {/* Toolbar */}
          <div className="border-b border-black/10 pb-4 mb-6">
            {/* Row 1: Search + Sort + Actions */}
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                
                {/* Search */}
                <div className="relative group">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111]/40 group-focus-within:text-[#111] transition-colors" />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search words..." 
                    className="pl-7 w-[200px] bg-transparent text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] placeholder:text-[#111]/30 focus:outline-none focus:border-b focus:border-[#111] pb-1 transition-all"
                  />
                </div>

                <div className="w-px h-4 bg-black/10" />

                <button className="text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] hover:opacity-60 transition-colors">
                  Sort: <span className="text-[#111]/60">Recent</span>
                </button>

                <div className="w-px h-4 bg-black/10" />

                {/* Filter toggle */}
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 text-[11px] font-sans uppercase tracking-widest font-bold transition-colors ${showFilters || activeFilterCount > 0 ? 'text-[#111]' : 'text-[#111] hover:opacity-60'}`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 bg-[#111] text-[#FFFFFF] flex items-center justify-center text-[8px] font-bold">{activeFilterCount}</span>
                  )}
                </button>
              </div>
              
              <div className="flex items-center gap-6">
                <button className="text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] hover:opacity-60 transition-colors">
                  Import
                </button>
                <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111] text-white rounded-[10px] text-[11px] font-sans uppercase tracking-widest font-bold hover:bg-[#333] transition-colors shadow-sm">
                  <Dumbbell className="w-3 h-3" /> Practice
                </button>
                <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#111] text-[#111] bg-transparent rounded-[10px] text-[11px] font-sans uppercase tracking-widest font-bold hover:bg-[#f9f9f9] transition-colors">
                  <FolderOpen className="w-3 h-3" /> Flashcards
                </button>
              </div>
            </div>

            {/* Row 2: Filters (collapsible) */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-start gap-8 pt-6">
                    {/* Mastery */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-sans uppercase tracking-widest font-bold text-[#111]/40">Mastery</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(['All', 'Mastered', 'In review', 'Learning', 'New'] as const).map((d) => {
                          const isActive = filterMastery === d;
                          return (
                            <button 
                              key={d} 
                              onClick={() => setFilterMastery(d)} 
                              className={`text-[10px] font-sans uppercase tracking-widest font-bold px-3 py-1.5 transition-colors border
                                ${isActive 
                                  ? 'bg-[#111] text-[#FFFFFF] border-[#111]' 
                                  : 'bg-transparent text-[#111] border-black/10 hover:border-[#111] hover:opacity-60'
                                }
                              `}
                            >
                              {d}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Part of Speech */}
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      <span className="text-[9px] font-sans uppercase tracking-widest font-bold text-[#111]/40">Part of Speech</span>
                      <SidebarDropdown value={filterPos} placeholder="All Parts of Speech" options={['All', ...uniquePos]} onChange={setFilterPos} />
                    </div>

                    {/* Topics */}
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      <span className="text-[9px] font-sans uppercase tracking-widest font-bold text-[#111]/40">Topics</span>
                      <SidebarDropdown value={filterTag} placeholder="All Topics" options={['All topics', ...uniqueTags]} onChange={setFilterTag} />
                    </div>

                    {/* Clear */}
                    {activeFilterCount > 0 && (
                      <button 
                        onClick={clearFilters} 
                        className="self-end text-[9px] font-sans uppercase tracking-widest font-bold text-[#111] hover:opacity-60/70 transition-colors pb-2"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dictionary List */}
          <div className="flex flex-col">
            {loading ? (
              <div className="py-12 flex items-center justify-center text-[11px] font-sans uppercase tracking-widest font-bold text-[#111]/40">
                Loading index...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-[11px] font-sans uppercase tracking-widest font-bold text-[#111]/40">
                {query ? 'No matching words found.' : 'Your index is empty.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map((v) => {
                  return (
                    <div key={v.$id || v.word} className="flex flex-col border border-black/10 rounded-[16px] p-6 group hover:border-black/20 hover:shadow-sm transition-all bg-white">
                      
                      {/* Header: Word & Pos */}
                      <div className="flex items-baseline justify-between gap-4 mb-4">
                        <div className="flex items-baseline gap-4 overflow-hidden">
                          <h2 className="text-[28px] font-sans font-semibold tracking-tight text-[#141413] leading-none group-hover:opacity-60 transition-colors cursor-pointer truncate capitalize" title={v.word}>
                            {v.word}
                          </h2>
                          {v.pos && (
                            <span className="text-[14px] font-serif italic text-[#111]/50 shrink-0">
                              {v.pos}
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => v.$id && handleDelete(v.$id)}
                          disabled={deletingId === v.$id}
                          className="text-neutral-300 hover:text-red-600 transition-colors disabled:opacity-50 shrink-0"
                          title="Delete word"
                        >
                          {deletingId === v.$id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      {/* Tags */}
                      {v.tags && v.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {v.tags.map((t, idx) => {
                            const c = getTagColor(t);
                            return (
                              <span 
                                key={idx} 
                                className="px-2 py-1 text-[9px] font-sans uppercase tracking-widest font-bold border rounded-[6px]"
                                style={{ color: c.text, backgroundColor: c.bg, borderColor: c.border }}
                              >
                                {t}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Definition */}
                      <div className="flex-1 mb-6">
                        {v.definition ? (
                          <p className="text-[15px] font-serif leading-relaxed text-[#141413]/80 line-clamp-3" title={v.definition}>
                            {v.definition}
                          </p>
                        ) : (
                          <p className="text-[15px] font-serif leading-relaxed text-[#111]/40 italic">
                            No definition provided.
                          </p>
                        )}
                      </div>
                      
                      {/* Footer: Date & Mastery */}
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5">
                        <span className="text-[9px] font-sans uppercase tracking-widest font-bold text-[#111]/30">
                          {v.$createdAt ? new Date(v.$createdAt).toLocaleDateString() : 'Today'}
                        </span>
                        <span 
                          className="text-[9px] font-sans uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px]"
                          style={{ color: MASTERY[v.mastery || 'new'].color, backgroundColor: MASTERY[v.mastery || 'new'].bg }}
                        >
                          {MASTERY[v.mastery || 'new'].label}
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
            
            <button className="mt-10 self-center inline-flex items-center gap-2 text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] border-b border-[#111] pb-1 hover:opacity-60 hover:border-[#111] transition-colors">
              <Plus className="w-3 h-3" /> Add a new word
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
