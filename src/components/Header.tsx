'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { logout, getCurrentUser } from '@/lib/auth';

export default function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u);
      setLoadingAuth(false);
    });
  }, []);


  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/auth/login';
    } catch (err) {
      console.error(err);
    }
  };



  if (pathname.startsWith('/auth/login')) return null;
  if (pathname === '/') return null;

  return (
    <header className="w-full fixed top-0 left-0 z-50 pointer-events-none">
      {/* Background overlay when menu is open */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm pointer-events-auto z-30" 
            onClick={() => setIsMenuOpen(false)} 
          />
        )}
      </AnimatePresence>
      
      <div className={`w-full pointer-events-auto z-40 relative transition-all ${isMenuOpen ? 'bg-white' : 'bg-white/95 backdrop-blur-md border-b border-black/10 shadow-sm'}`}>
        
        {/* Top Navbar Container */}
        <div className="max-w-[1100px] w-full mx-auto px-6 flex items-center justify-between relative z-50 py-4">
          
          {/* Left Side */}
          <div className="flex items-center gap-8 flex-1">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-neutral-900 hover:opacity-60 transition-colors py-1 relative z-50" aria-label="Menu"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                {isMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 7h18M3 12h18M3 17h18" />
                )}
              </svg>
            </button>
            
            <Link href="/blog" className="text-[16px] font-sans font-light uppercase tracking-widest text-neutral-900 hover:opacity-60 transition-colors hidden sm:block relative z-50">
              Blog
            </Link>
          </div>

          {/* Centerpiece */}
          <div className="flex items-center justify-center flex-shrink-0 mx-8 relative z-50">
            <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-baseline group hover:opacity-80 transition-opacity">
              <span className="font-display text-[22px] sm:text-[26px] md:text-[28px] text-[#111] tracking-normal leading-none uppercase">
                Critical Writer
              </span>
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center justify-end gap-6 flex-1 relative z-50 min-w-[100px]">
            {!loadingAuth && (
              user ? (
                <button onClick={handleLogout} className="text-neutral-900 text-[12px] font-sans font-bold uppercase tracking-widest hover:opacity-60 transition-colors">
                  Sign Out
                </button>
              ) : (
                <Link href="/auth/login" className="bg-[#111] text-white text-[13px] font-sans font-bold uppercase tracking-widest px-5 py-2.5 hover:bg-neutral-800 transition-colors">
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>

        {/* Full-Width Edge-to-Edge Mega Menu Panel */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full bg-white overflow-hidden border-b border-neutral-300"
            >
              <div className="max-w-[1100px] mx-auto px-6 py-12 pt-4">
                
                <div className="flex items-center justify-between border-b border-neutral-300 pb-4 mb-8">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#111]">Curated Publications</span>
                  <Link href="/articles" onClick={() => setIsMenuOpen(false)} className="font-sans text-[11px] font-bold uppercase tracking-widest text-neutral-900 hover:opacity-60 transition-colors">
                    View All Index →
                  </Link>
                </div>
                
                {/* Source Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <Link href="/articles?source=economist" onClick={() => setIsMenuOpen(false)} className="group flex flex-col items-center text-center">
                    <div className="w-full aspect-[4/5] border border-neutral-300 overflow-hidden mb-6 bg-neutral-100 shadow-sm">
                      <img src="/economist_cover.png" alt="The Economist" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out grayscale group-hover:grayscale-0" />
                    </div>
                    <span className="font-serif text-[24px] text-neutral-900 group-hover:opacity-60 transition-colors leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>The Economist</span>
                  </Link>

                  <Link href="/articles?source=new-yorker" onClick={() => setIsMenuOpen(false)} className="group flex flex-col items-center text-center">
                    <div className="w-full aspect-[4/5] border border-neutral-300 overflow-hidden mb-6 bg-neutral-100 shadow-sm">
                      <img src="/images/new_yorker.png" alt="The New Yorker" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out grayscale group-hover:grayscale-0" />
                    </div>
                    <span className="font-serif text-[24px] text-neutral-900 group-hover:opacity-60 transition-colors leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>The New Yorker</span>
                  </Link>

                  <Link href="/articles?source=atlantic" onClick={() => setIsMenuOpen(false)} className="group flex flex-col items-center text-center">
                    <div className="w-full aspect-[4/5] border border-neutral-300 overflow-hidden mb-6 bg-neutral-100 shadow-sm">
                      <img src="/atlantic_cover.png" alt="The Atlantic" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out grayscale group-hover:grayscale-0" />
                    </div>
                    <span className="font-serif text-[24px] text-neutral-900 group-hover:opacity-60 transition-colors leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>The Atlantic</span>
                  </Link>

                  <Link href="/articles?source=new-scientist" onClick={() => setIsMenuOpen(false)} className="group flex flex-col items-center text-center">
                    <div className="w-full aspect-[4/5] border border-neutral-300 overflow-hidden mb-6 bg-neutral-100 shadow-sm">
                      <img src="/new_scientist_cover.png" alt="New Scientist" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out grayscale group-hover:grayscale-0" />
                    </div>
                    <span className="font-serif text-[24px] text-neutral-900 group-hover:opacity-60 transition-colors leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>New Scientist</span>
                  </Link>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </header>
  );
}
