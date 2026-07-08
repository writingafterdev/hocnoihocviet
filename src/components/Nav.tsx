'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(stored === 'dark' || (!stored && prefersDark));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  const links = [
    { href: '/', label: 'Home' },
    { href: '/articles', label: 'Articles' },
    { href: '/articles?source=economist', label: 'Economist' },
    { href: '/articles?source=new-yorker', label: 'New Yorker' },
    { href: '/articles?source=new-scientist', label: 'New Scientist' },
  ];

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="container nav-inner">
        {/* Logo */}
        <Link href="/" className="nav-logo" id="nav-logo">
          Reader<span>&</span>Writer
        </Link>

        {/* Desktop links */}
        <ul className="nav-links" role="list">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`nav-link ${pathname === l.href ? 'active' : ''}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="nav-actions">
          <button
            id="theme-toggle"
            className={`theme-toggle ${isDark ? 'active' : ''}`}
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="theme-toggle-thumb" />
          </button>

          <Link href="/bookmarks" className="btn btn-ghost btn-sm">
            Bookmarks
          </Link>
          <Link href="/auth/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
