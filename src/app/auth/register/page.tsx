'use client';
import { useState } from 'react';
import Link from 'next/link';
import { register, loginWithGoogle } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await register(email, password, name);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-transparent pt-[150px] pb-24 flex flex-col items-center justify-center">
      <div className="w-full max-w-[480px] px-8 py-12 animate-fade-up">
        <h1 className="text-center font-serif text-[48px] sm:text-[56px] text-[#111] leading-none tracking-tight mb-2" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
          Join Critical Writer
        </h1>
        <p className="text-center font-serif italic text-[20px] text-neutral-600 mb-10" style={{ fontFamily: 'var(--font-lora)' }}>
          Create your free account
        </p>

        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white border border-neutral-300 py-3.5 hover:bg-neutral-50 transition-colors shadow-sm mb-6"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="font-sans text-[15px] font-medium text-neutral-800 tracking-wide">Continue with Google</span>
        </button>

        <div className="flex items-center gap-4 mb-8 w-full">
          <div className="flex-1 border-t border-neutral-300"></div>
          <span className="text-neutral-400 font-sans text-[10px] font-bold uppercase tracking-widest">Or create with email</span>
          <div className="flex-1 border-t border-neutral-300"></div>
        </div>

        <form onSubmit={handleSubmit} id="register-form" className="flex flex-col gap-8" noValidate>
          <div className="flex flex-col">
            <label htmlFor="register-name" className="font-sans text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Display Name</label>
            <input
              id="register-name"
              type="text"
              className="w-full bg-transparent border-b border-neutral-300 py-3 text-[18px] font-serif text-neutral-900 focus:outline-none focus:border-[#111] transition-colors placeholder:text-neutral-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
              style={{ fontFamily: 'var(--font-lora)' }}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="register-email" className="font-sans text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Email Address</label>
            <input
              id="register-email"
              type="email"
              className="w-full bg-transparent border-b border-neutral-300 py-3 text-[18px] font-serif text-neutral-900 focus:outline-none focus:border-[#111] transition-colors placeholder:text-neutral-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={{ fontFamily: 'var(--font-lora)' }}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="register-password" className="font-sans text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Password</label>
            <input
              id="register-password"
              type="password"
              className="w-full bg-transparent border-b border-neutral-300 py-3 text-[18px] font-serif text-neutral-900 focus:outline-none focus:border-[#111] transition-colors placeholder:text-neutral-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p role="alert" className="text-[#111] font-sans text-[14px] font-medium text-center bg-red-50 py-3 border border-red-100">
              {error}
            </p>
          )}

          <button id="register-submit" type="submit" className="mt-4 bg-[#111] text-white font-sans font-light text-[16px] py-4 w-full hover:bg-neutral-800 transition-colors tracking-wide disabled:opacity-50" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-10 text-center font-sans text-[14px] text-neutral-600 tracking-wide">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#111] hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
