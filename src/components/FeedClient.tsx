'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Search, SlidersHorizontal } from 'lucide-react';
import HeaderActions from '@/components/HeaderActions';
import QuoteStack from '@/components/QuoteStack';
import ArticleCard from '@/components/ArticleCard';
import { FilterDropdown } from '@/components/FilterDropdown';
import { STATUS } from '@/components/StatusBadge';

const CATEGORIES = ['All', 'Productivity', 'Mindset', 'Technology', 'Health', 'Business'];
const READ_TIMES: { label: string; max: number }[] = [
  { label: 'All', max: Infinity },
  { label: '< 5 min', max: 5 },
  { label: '5–10 min', max: 10 },
  { label: '10+ min', max: Infinity },
];
const STATUS_OPTIONS = ['All', ...Object.keys(STATUS)] as const;

interface Article {
  $id: string;
  title: string;
  description?: string;
  excerpt?: string;
  author?: string;
  coverImageId?: string;
  source?: string;
  readMinutes?: number;
  status?: string;
  highlights?: string[];
  $createdAt?: string;
}

function getCategory(a: Article): string {
  if (a.source && a.source.trim() !== '') {
    const raw = a.source.toLowerCase().trim();
    if (raw.includes('economist')) return 'The Economist';
    if (raw.includes('new yorker')) return 'The New Yorker';
    if (raw.includes('new scientist')) return 'New Scientist';
    
    // Normalize to Title Case to ensure consistent grouping regardless of original case
    return a.source
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  // Mock fallback
  const fallbacks = ['The Lede', 'Culture', 'Science & Tech', 'Business'];
  const hash = (a.title || '').length % fallbacks.length;
  return fallbacks[hash];
}

export default function FeedClient({
  highlightArticles,
  articles,
}: {
  highlightArticles: Article[];
  articles: Article[];
}) {
  const [category, setCategory] = useState<string>('All');
  const [readTime, setReadTime] = useState<string>('All');
  const [status, setStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const activeFilters = [category, readTime, status].filter((v) => v !== 'All').length;
  const readMax = READ_TIMES.find((r) => r.label === readTime)?.max ?? Infinity;
  const readMin = readTime === '10+ min' ? 10 : readTime === '5–10 min' ? 5 : 0;

  const visibleArticles = articles
    .filter((a) => category === 'All' || a.source?.toLowerCase() === category.toLowerCase())
    .filter((a) => (a.readMinutes ?? 5) >= readMin && (a.readMinutes ?? 5) <= readMax)
    .filter((a) => status === 'All' || a.status === status)
    .filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.title?.toLowerCase().includes(q) || 
        a.description?.toLowerCase().includes(q) ||
        a.excerpt?.toLowerCase().includes(q) ||
        a.author?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.$createdAt ?? 0).getTime() - new Date(a.$createdAt ?? 0).getTime());

  // Group by category/source
  const groupedArticles = useMemo(() => {
    const groups: Record<string, Article[]> = {};
    visibleArticles.forEach((a) => {
      const cat = getCategory(a);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    });
    return groups;
  }, [visibleArticles]);

  return (
    <main className="flex-1 bg-white min-h-screen">


      {/* Featured Article Hero (The New Yorker Style) */}
      <section className="w-full border-b border-neutral-200">
        <QuoteStack articles={highlightArticles.length > 0 ? highlightArticles : articles} />
      </section>

      {/* Articles Feed */}
      <section className="w-full bg-[#FFFFFF]">
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-5 mb-10 text-[13px] text-neutral-500">
            <div className="flex items-center gap-1.5 text-neutral-900 font-bold tracking-widest uppercase text-[11px]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-900" />
              Filters
              {activeFilters > 0 && <span className="text-[#111]">({activeFilters})</span>}
            </div>
            <FilterDropdown label="Category" value={category} options={CATEGORIES} onChange={setCategory} />
            <FilterDropdown label="Read time" value={readTime} options={READ_TIMES.map((r) => r.label)} onChange={setReadTime} />
            <FilterDropdown label="Status" value={status} options={STATUS_OPTIONS as unknown as readonly string[]} onChange={setStatus} />
            
            <div className="ml-auto relative flex items-center border-b border-neutral-300 focus-within:border-neutral-900 transition-colors">
              <Search className="absolute left-1 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-1.5 w-[200px] bg-transparent border-none text-[13px] font-sans text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 transition-colors"
              />
            </div>
          </div>

          {visibleArticles.length === 0 && (
            <div className="py-20 text-center text-[15px] font-serif text-neutral-500 italic">
              No articles match your search criteria.
            </div>
          )}

          <div className="flex flex-col gap-16">
            <AnimatePresence mode="popLayout">
              {Object.entries(groupedArticles).map(([cat, articlesInCat]) => (
                <motion.div 
                  key={cat}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col"
                >
                  <div className="w-full flex items-center justify-center border-t border-b border-neutral-200 py-5 mb-10">
                    {(() => {
                      const normalizedCat = cat.toLowerCase().replace('-', ' ');
                      let logoUrl = null;
                      let logoClass = "w-auto object-contain";
                      
                      if (normalizedCat.includes('new yorker')) {
                        logoUrl = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/The_New_Yorker_Logo.svg';
                        logoClass += " h-[28px]";
                      } else if (normalizedCat.includes('economist')) {
                        logoUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/65/The_Economist_Logo.svg';
                        logoClass += " h-[48px]";
                      } else if (normalizedCat.includes('new scientist')) {
                        logoUrl = 'https://upload.wikimedia.org/wikipedia/commons/c/c0/New_Scientist_logo.svg';
                        logoClass += " h-[22px]";
                      }
                      
                      const sourceSlug = cat.toLowerCase().replace(/ /g, '-');
                      if (logoUrl) {
                        return (
                          <Link href={`/sources/${sourceSlug}`} className="flex items-center justify-center hover:opacity-80 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoUrl} alt={cat} className={logoClass} />
                          </Link>
                        );
                      }
                      return (
                        <Link href={`/sources/${sourceSlug}`} className="hover:opacity-80 transition-opacity">
                          <h2 className="text-[18px] md:text-[20px] font-serif uppercase tracking-[0.15em] text-[#111]">
                            {cat}
                          </h2>
                        </Link>
                      );
                    })()}
                  </div>
                  
                  <div className="editorial-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-10">
                    {articlesInCat.slice(0, 8).map(a => (
                      <div key={a.$id}>
                        <ArticleCard article={a as any} />
                      </div>
                    ))}
                  </div>
                  {articlesInCat.length > 8 && (
                    <div className="w-full flex justify-center mt-12 mb-4">
                      <Link href={`/sources/${cat.toLowerCase().replace(/ /g, '-')}`} className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#111] hover:opacity-60 transition-colors flex items-center gap-2">
                        View all from {cat} <span>→</span>
                      </Link>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

        </div>
      </section>
    </main>
  );
}
