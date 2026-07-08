'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import TopHeader from '@/components/TopHeader';

export default function ReadingPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#141413] pb-32">
      <TopHeader user={user} />
      
      <main className="w-full max-w-[1060px] mx-auto pt-6 px-4 md:px-0">
        <Link href="/" className="inline-flex items-center text-[#857F70] hover:text-[#141413] transition-colors font-sans text-[13px] font-medium mb-10">
          <span className="mr-2">←</span> Trang chủ
        </Link>
        
        <div className="flex items-start gap-6 mb-12">
          <div className="w-24 h-24 rounded-[20px] bg-[#62DAB1] flex items-center justify-center shrink-0 shadow-sm">
            <img src="/images/illustrations/il-study.svg" className="w-12 h-12 object-contain" alt="" />
          </div>
          <div className="pt-2">
            <div className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-[#857F70] mb-3">
              READING ARTICLES
            </div>
            <h1 className="font-sans font-semibold text-[32px] mb-2 tracking-tight">Đọc bài viết</h1>
            <p className="font-serif text-[#857F70]/80 text-[15px] font-normal">
              Chọn một tạp chí để bắt đầu. Bài đọc thật, tuyển chọn theo trình độ và kèm chú giải.
            </p>
          </div>
        </div>

        <hr className="border-black/10 mb-10" />

        <div className="mb-6">
          <h2 className="font-sans text-[13px] font-bold text-[#141413] tracking-wide">Nguồn bài đọc</h2>
        </div>

        <div className="grid grid-cols-2 gap-[20px]">
          {/* The Economist */}
          <Link href="/sources/economist" className="bg-[#FFB760] rounded-[16px] pt-[28px] px-[28px] pb-[24px] flex flex-col min-h-[252px] relative overflow-hidden group hover:opacity-90 transition-opacity">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-[12px] bg-white/40 flex items-center justify-center">
                <img src="/images/illustrations/il-review.svg" className="w-8 h-8 object-contain" alt="" />
              </div>
              <div className="bg-white/40 text-black/70 font-sans text-[11px] font-semibold px-3 py-1.5 rounded-full">
                12 bài
              </div>
            </div>
            <h3 className="font-sans font-semibold text-[26px] tracking-tight mb-2">The Economist</h3>
            <p className="font-sans text-[14px] leading-relaxed text-black/60 flex-grow font-normal">
              Phân tích thời sự, kinh tế và xu hướng toàn cầu.
            </p>
            <div className="pt-5 border-t border-black/10 flex items-center justify-between mt-6">
              <span className="font-sans text-[13px] font-semibold text-black/80">Xem bài đọc</span>
              <span className="text-black/60 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* The New Yorker */}
          <Link href="/sources/new-yorker" className="bg-[#62DAB1] rounded-[16px] pt-[28px] px-[28px] pb-[24px] flex flex-col min-h-[252px] relative overflow-hidden group hover:opacity-90 transition-opacity">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-[12px] bg-white/30 flex items-center justify-center">
                <img src="/images/illustrations/il-announce.svg" className="w-8 h-8 object-contain" alt="" />
              </div>
              <div className="bg-white/30 text-black/70 font-sans text-[11px] font-semibold px-3 py-1.5 rounded-full">
                9 bài
              </div>
            </div>
            <h3 className="font-sans font-semibold text-[26px] tracking-tight mb-2">The New Yorker</h3>
            <p className="font-sans text-[14px] leading-relaxed text-black/60 flex-grow font-normal">
              Phóng sự dài, văn hóa và bình luận chuyên sâu.
            </p>
            <div className="pt-5 border-t border-black/10 flex items-center justify-between mt-6">
              <span className="font-sans text-[13px] font-semibold text-black/80">Xem bài đọc</span>
              <span className="text-black/60 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* The Atlantic */}
          <Link href="/sources/atlantic" className="bg-[#FFE17B] rounded-[16px] pt-[28px] px-[28px] pb-[24px] flex flex-col min-h-[252px] relative overflow-hidden group hover:opacity-90 transition-opacity">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-[12px] bg-white/40 flex items-center justify-center">
                <img src="/images/illustrations/il-knowledge.svg" className="w-8 h-8 object-contain" alt="" />
              </div>
              <div className="bg-white/40 text-black/70 font-sans text-[11px] font-semibold px-3 py-1.5 rounded-full">
                11 bài
              </div>
            </div>
            <h3 className="font-sans font-semibold text-[26px] tracking-tight mb-2">The Atlantic</h3>
            <p className="font-sans text-[14px] leading-relaxed text-black/60 flex-grow font-normal">
              Ý tưởng lớn, tâm lý và đời sống hiện đại.
            </p>
            <div className="pt-5 border-t border-black/10 flex items-center justify-between mt-6">
              <span className="font-sans text-[13px] font-semibold text-black/80">Xem bài đọc</span>
              <span className="text-black/60 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* National Geographic */}
          <Link href="/sources/national-geographic" className="bg-[#82D8F2] rounded-[16px] pt-[28px] px-[28px] pb-[24px] flex flex-col min-h-[252px] relative overflow-hidden group hover:opacity-90 transition-opacity">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-[12px] bg-white/30 flex items-center justify-center">
                <img src="/images/illustrations/il-submit.svg" className="w-8 h-8 object-contain" alt="" />
              </div>
              <div className="bg-white/30 text-black/70 font-sans text-[11px] font-semibold px-3 py-1.5 rounded-full">
                8 bài
              </div>
            </div>
            <h3 className="font-sans font-semibold text-[26px] tracking-tight mb-2">National Geographic</h3>
            <p className="font-sans text-[14px] leading-relaxed text-black/60 flex-grow font-normal">
              Khoa học, thiên nhiên và thế giới quanh ta.
            </p>
            <div className="pt-5 border-t border-black/10 flex items-center justify-between mt-6">
              <span className="font-sans text-[13px] font-semibold text-black/80">Xem bài đọc</span>
              <span className="text-black/60 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
