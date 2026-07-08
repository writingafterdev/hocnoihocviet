'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { ImageWithFallback } from '@/components/ImageWithFallback';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'account', label: 'Account Details' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'preferences', label: 'Preferences' },
];

const progress = [
  { label: 'Articles Read', value: '128', delta: '+12 this month', color: '#111' }, // Red
  { label: 'Highlights', value: '342', delta: '+28 this month', color: '#166534' }, // Deep Green
  { label: 'Vocab Words', value: '642', delta: '+30 this month', color: '#B45309' }, // Bronze/Ochre
  { label: 'Reviews', value: '1,248', delta: '+98 this month', color: '#1E3A8A' }, // Deep Navy
];

const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const streakDays = [true, true, true, true, true, true, false];

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <main className="w-full min-h-screen bg-[#FFFFFF] font-sans text-[#111] selection:bg-neutral-200 selection:text-[#111] pt-[220px] pb-32">
      {/* BODY */}
      <div className="max-w-[1100px] mx-auto w-full px-6 md:px-12 flex flex-col md:flex-row gap-12 md:gap-24">
        
        {/* SIDEBAR */}
        <aside className="w-full md:w-[180px] shrink-0 flex flex-col gap-4">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400 mb-2">
            Directory
          </div>
          {TABS.map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              className={`text-[13px] font-sans uppercase tracking-widest block transition-colors text-left ${activeTab === tab.id ? 'font-bold text-[#111] border-l-2 border-[#111] pl-3 -ml-[14px]' : 'text-neutral-500 hover:opacity-60'}`}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 max-w-[640px] flex flex-col gap-8">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <h1 className="text-[40px] font-serif leading-none tracking-tight text-[#111] mb-2" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                Hello, Ella
              </h1>

              {/* CARD 1: PROFILE INFO */}
              <div className="border border-neutral-300 bg-white p-8 flex flex-col sm:flex-row gap-8 items-start relative">
                <div className="w-24 h-24 rounded-full overflow-hidden shrink-0 border border-neutral-200 grayscale contrast-125">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80" 
                    alt="Ella M." 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-start justify-between w-full">
                    <div className="flex flex-col">
                      <h2 className="text-[28px] font-serif text-[#111] leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>Ella M.</h2>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#111] mt-2">New York, USA</div>
                    </div>
                    <button className="border border-neutral-300 text-[#111] px-5 py-2 text-[11px] font-bold tracking-widest uppercase hover:border-[#111] transition-colors rounded-none">
                      Edit Profile
                    </button>
                  </div>
                  <p className="mt-6 text-[15px] font-serif italic leading-relaxed text-neutral-600 max-w-[400px]" style={{ fontFamily: 'var(--font-lora)' }}>
                    Product Designer by day, life-long learner by night. Passionate about behavioral psychology, typography, and building systems that empower people.
                  </p>
                </div>
              </div>

              {/* CARD 2: THE LEDGER */}
              <div className="border border-neutral-300 bg-white flex flex-col">
                <div className="flex items-end justify-between border-b border-neutral-200 p-8 pb-4">
                  <h2 className="font-serif text-[28px] text-[#111] leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>The Ledger</h2>
                  <Link href="#" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#111] hover:underline">View All &rarr;</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 bg-neutral-200 gap-[1px]">
                  {progress.map((p, i) => (
                    <div key={i} className="flex flex-col gap-1 p-8 bg-white relative overflow-hidden group">
                      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-[0.03]" style={{ backgroundColor: p.color }}></div>
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-500 relative z-10">{p.label}</span>
                      <div className="text-[44px] font-serif leading-none tracking-tight relative z-10 mt-1" style={{ fontFamily: 'var(--font-instrument-serif)', color: p.color }}>
                        {p.value}
                      </div>
                      <span className="text-[13px] font-serif italic text-neutral-500 mt-2 relative z-10" style={{ fontFamily: 'var(--font-lora)' }}>
                        {p.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARD 3: CURRENT STREAK */}
              <div className="border border-neutral-300 bg-white p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
                <div className="flex flex-col gap-2 border-l-2 border-[#111] pl-4">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Current Streak</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[56px] font-serif leading-none tracking-tight text-[#111]" style={{ fontFamily: 'var(--font-instrument-serif)' }}>27</span>
                    <span className="text-[12px] font-bold uppercase tracking-widest text-[#111]">Days</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {week.map((d, i) => {
                    const isCurrent = i === 5;
                    const isCompleted = streakDays[i];
                    return (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-neutral-400">{d}</span>
                        <div className={`w-8 h-8 border flex items-center justify-center transition-all ${isCompleted ? (isCurrent ? 'bg-[#111] border-[#111]' : 'border-neutral-300 text-[#111]') : 'border-neutral-200'}`}>
                          {isCompleted && (
                            isCurrent ? <div className="w-2 h-2 bg-white rounded-full" /> : <div className="w-2 h-2 bg-neutral-800 rounded-full" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB: ACCOUNT DETAILS */}
          {activeTab === 'account' && (
            <>
              <h1 className="text-[40px] font-serif leading-none tracking-tight text-[#111] mb-2" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                Account Details
              </h1>
              <div className="border border-neutral-300 bg-white flex flex-col">
                <div className="p-8 flex flex-col gap-8">
                  <div className="flex items-end justify-between border-b border-neutral-200 pb-4">
                    <h2 className="font-serif text-[28px] text-[#111] leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>Identity</h2>
                    <button className="border border-[#111] text-[#111] bg-transparent px-6 py-2 text-[11px] font-bold tracking-widest uppercase hover:bg-[#111] hover:text-white transition-colors rounded-none">
                      Edit Details
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">First Name</span>
                      <span className="text-[15px] text-[#111]">Ella</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Last Name</span>
                      <span className="text-[15px] text-[#111]">M.</span>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Email Address</span>
                      <span className="text-[15px] text-[#111]">ella.m@example.com</span>
                    </div>
                  </div>
                </div>
                
                <div className="py-4 px-8 bg-[#FFFFFF] border-t border-neutral-300 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    <path fill="none" d="M1 1h22v22H1z" />
                  </svg>
                  <span className="text-[12px] font-medium text-neutral-500">Google account connected</span>
                </div>
              </div>
            </>
          )}

          {/* TAB: SUBSCRIPTION */}
          {activeTab === 'subscription' && (
            <>
              <h1 className="text-[40px] font-serif leading-none tracking-tight text-[#111] mb-2" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                Subscription
              </h1>
              <div className="border border-neutral-300 bg-white p-8 flex flex-col gap-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-neutral-200 pb-8">
                  <div className="flex flex-col gap-2">
                    <h2 className="font-serif text-[28px] text-[#111] leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>Free Tier</h2>
                    <p className="text-[15px] font-serif italic text-neutral-500" style={{ fontFamily: 'var(--font-lora)' }}>You are currently on the basic free plan.</p>
                  </div>
                  <button className="bg-[#111] text-white px-6 py-2.5 text-[11px] font-bold tracking-widest uppercase hover:bg-neutral-800 transition-colors rounded-none">
                    Upgrade to Premium
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Premium Benefits</h3>
                  <ul className="flex flex-col gap-3">
                    <li className="flex items-center gap-3 text-[14px] text-[#111]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Unlimited Saved Articles
                    </li>
                    <li className="flex items-center gap-3 text-[14px] text-[#111]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Advanced Vocabulary spaced-repetition
                    </li>
                    <li className="flex items-center gap-3 text-[14px] text-[#111]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Offline reading mode
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'preferences' && (
            <>
              <h1 className="text-[40px] font-serif leading-none tracking-tight text-[#111] mb-2" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                Preferences
              </h1>
              <div className="border border-neutral-300 bg-white p-8 flex flex-col gap-8">
                <div className="flex items-end justify-between border-b border-neutral-200 pb-4">
                  <h2 className="font-serif text-[28px] text-[#111] leading-none" style={{ fontFamily: 'var(--font-instrument-serif)' }}>Reading Experience</h2>
                </div>
                
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Default Typography</span>
                    <select className="w-full max-w-xs border border-neutral-300 bg-white p-3 text-[14px] font-serif outline-none focus:border-[#111]" style={{ fontFamily: 'var(--font-lora)' }}>
                      <option>Lora (Serif)</option>
                      <option>Inter (Sans-serif)</option>
                      <option>Geist Mono (Monospace)</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Theme</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-[14px]">
                        <input type="radio" name="theme" defaultChecked className="accent-[#111]" /> Light
                      </label>
                      <label className="flex items-center gap-2 text-[14px]">
                        <input type="radio" name="theme" className="accent-[#111]" /> Dark
                      </label>
                      <label className="flex items-center gap-2 text-[14px]">
                        <input type="radio" name="theme" className="accent-[#111]" /> System
                      </label>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}

        </div>

      </div>
    </main>
  );
}
