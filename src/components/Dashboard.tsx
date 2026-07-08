'use client';

import Link from 'next/link';
import TopHeader from '@/components/TopHeader';

export default function Dashboard({ user }: { user: any }) {
  const firstName = user?.name ? user.name.split(' ')[0] : 'bạn';

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#141413] pb-32 antialiased">
      <TopHeader user={user} />

      <main className="w-full max-w-[1060px] mx-auto pt-10 px-4 md:px-0">
        <div className="mb-12">
          <p className="font-sans text-[11px] font-semibold tracking-[0.14em] uppercase text-[#857F70] mb-4">
            CHÀO MỪNG TRỞ LẠI
          </p>
          <h1 className="font-sans text-[42px] font-medium tracking-tight mb-2 [text-wrap:balance]">
            Hellooo, {firstName}.
          </h1>
          <p className="font-sans text-[#857F70] text-[15px] [text-wrap:pretty]">
            Hôm nay học gì không?
          </p>
        </div>

        <div className="border-b border-black/10 mb-10 w-full" />

        <div className="grid grid-cols-6 gap-[20px]">
          {/* TOP ROW: Reading (Left, 2 cols) + Writing (Right, 4 cols) */}
          
          {/* Reading Articles */}
          <div className="col-span-6 md:col-span-2 flex flex-col">
            <Link href="/reading" className="flex-1 bg-[#62DAB1] rounded-[16px] pt-[28px] px-[26px] pb-[24px] flex flex-col text-[#141413] relative overflow-hidden group shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.07)] active:translate-y-0 active:scale-[0.99] active:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 block cursor-pointer min-h-[300px]">
              <div className="absolute top-5 right-5 bg-[#141413] text-[#FFFFFF] font-sans text-[10px] font-semibold tracking-[0.12em] uppercase px-3 py-1.5 rounded-md">
                BETA
              </div>
              <div className="w-12 h-12 rounded-[10px] bg-white/20 flex items-center justify-center mb-6">
                <img src="/images/illustrations/il-study.svg" className="w-7 h-7 object-contain transition-transform duration-500 group-hover:scale-105" alt="" />
              </div>
              <div className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-black/50 mb-3">
                READING ARTICLES
              </div>
              <h3 className="font-sans font-semibold text-[20px] mb-2 tracking-tight [text-wrap:balance]">Đọc báo không?</h3>
              <p className="font-sans text-[14px] leading-relaxed text-black/70 flex-grow [text-wrap:pretty]">
                The Economist, The New Yorker, The Atlantic.
              </p>
              <div className="pt-4 border-t border-black/10 flex items-center justify-between mt-5">
                <span className="font-sans text-[13px] text-black/60 font-medium">24 bài viết</span>
                <button className="group/btn w-10 h-10 rounded-full bg-white/30 flex items-center justify-center group-hover:bg-white/50 active:scale-[0.96] transition-[background-color,transform]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/btn:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </Link>
          </div>

          {/* Writing — hero card */}
          <div className="col-span-6 md:col-span-4 flex flex-col">
            <Link href="/writing" className="flex-1 bg-[#FFE17B] rounded-[16px] pt-[28px] px-[26px] pb-[24px] flex flex-col min-h-[300px] text-[#141413] relative overflow-hidden group shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.07)] active:translate-y-0 active:scale-[0.99] active:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 block">
              <div className="absolute top-5 right-5 bg-[#141413] text-[#FFFFFF] font-sans text-[10px] font-semibold tracking-[0.12em] uppercase px-3 py-1.5 rounded-md">
                BETA
              </div>
              <div className="w-14 h-14 rounded-[10px] bg-white/40 flex items-center justify-center mb-8">
                <img src="/images/illustrations/il-writing.svg" className="w-8 h-8 object-contain transition-transform duration-500 group-hover:scale-105" alt="" />
              </div>
              <div className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-black/50 mb-4">
                WRITING FOR IELTS
              </div>
              <h3 className="font-sans font-semibold text-[28px] mb-3 tracking-tight [text-wrap:balance]">Viết không?</h3>
              <p className="font-sans text-[15px] leading-relaxed text-black/70 flex-grow [text-wrap:pretty]">
                Không biết phát triển lập luận, không biết kết nối các ý, không biết sử dụng từ vựng,...come here
              </p>
              <div className="pt-5 border-t border-black/10 flex items-center justify-between mt-6">
                <span className="font-sans text-[13px] text-black/60 font-medium">Có sẵn</span>
                <button className="group/btn w-10 h-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white/70 active:scale-[0.96] transition-[background-color,transform]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/btn:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </Link>
          </div>

          {/* BOTTOM ROW: Speaking (Full width) */}
          <div className="col-span-6 flex flex-col">
            <article className="flex-1 bg-[#7CD1E8] rounded-[16px] pt-[28px] px-[26px] pb-[24px] flex flex-col text-[#141413] relative overflow-hidden group opacity-80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] active:translate-y-0 active:scale-[0.99] active:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200">
              <div className="absolute top-5 right-5 bg-black/10 text-black/60 font-sans text-[10px] font-semibold tracking-[0.12em] uppercase px-3 py-1.5 rounded-md">
                SẮP RA MẮT
              </div>
              <div className="w-14 h-14 rounded-[10px] bg-white/30 flex items-center justify-center mb-8">
                <img src="/images/illustrations/il-conversation.svg" className="w-8 h-8 object-contain transition-transform duration-500 group-hover:scale-105" alt="" />
              </div>
              <div className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-black/50 mb-4">
                SPEAKING FOR IELTS
              </div>
              <h3 className="font-sans font-semibold text-[28px] mb-3 tracking-tight [text-wrap:balance]">Nói đi?</h3>
              <p className="font-sans text-[15px] leading-relaxed text-black/70 flex-grow [text-wrap:pretty]">
                Không biết nhấn nhá? không biết khi nên dừng lại khi nào nên nói một tràng? You're at the right place
              </p>
              <div className="pt-5 border-t border-black/10 flex items-center justify-between mt-6">
                <span className="font-sans text-[13px] text-black/60 font-medium">Đang phát triển</span>
                <button className="group/btn w-10 h-10 rounded-full bg-white/30 flex items-center justify-center hover:bg-white/50 active:scale-[0.96] transition-[background-color,transform]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover/btn:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </article>
          </div>

        </div>
      </main>
    </div>
  );
}
