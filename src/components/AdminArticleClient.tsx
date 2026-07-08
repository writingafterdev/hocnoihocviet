'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminArticleClient({ article }: { article: any }) {
  const body = String(article.body || '');
  const preview = body.length > 900 ? `${body.slice(0, 900).trim()}...` : body;

  return (
    <div className="max-w-[800px] flex flex-col gap-10 pb-24">
      <div>
        <Link href="/admin" className="flex items-center gap-2 text-[11px] font-sans font-bold uppercase tracking-widest text-[#111]/40 hover:text-[#111] mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
        <h2 className="text-[36px] font-heading leading-tight text-[#111]">{article.title}</h2>
        <div className="flex gap-4 items-center mt-3 text-[12px] font-sans uppercase tracking-widest text-neutral-400">
          <span>{article.author || 'Unknown Author'}</span>
          <span>•</span>
          <span>{new Date(article.$createdAt).toLocaleDateString()}</span>
        </div>
        {article.url && (
          <a href={article.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline text-[13px] font-serif mt-2">
            Original Source URL
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="bg-[#FAFAF8] border border-[#111]/10 rounded-[10px] p-6">
        <h3 className="text-[14px] font-sans uppercase tracking-widest font-bold text-[#111] mb-2">
          Article Flow
        </h3>
        <p className="text-[13px] font-serif text-[#111]/60 leading-relaxed">
          This imported article stays in the editorial library flow. Vocabulary practice can draw from saved words and phrases without turning articles into reading games.
        </p>
      </div>

      <div>
        <h3 className="text-[14px] font-sans uppercase tracking-widest font-bold text-[#111] mb-5">
          Body Preview
        </h3>
        {preview ? (
          <blockquote className="border-l-[3px] border-[#111]/10 pl-5 py-1">
            <p className="text-[15px] font-serif leading-relaxed text-[#111]/70 whitespace-pre-line">
              {preview}
            </p>
          </blockquote>
        ) : (
          <p className="text-[14px] font-serif italic text-neutral-500">This article has no body text.</p>
        )}
      </div>
    </div>
  );
}
