// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import NavDock from '@/components/NavDock';


import { Newsreader, Lora, Inter } from 'next/font/google';
import localFont from 'next/font/local';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
});

const newYorker = localFont({
  src: '../../public/fonts/NewYorker.ttf',
  variable: '--font-display',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
});

export const metadata: Metadata = {
  title: { default: 'Reader & Writer', template: '%s | Reader & Writer' },
  description: 'Premium articles from The Economist, The New Yorker, and New Scientist — curated for English learners.',
  keywords: ['magazine articles', 'english learning', 'the economist', 'new yorker', 'new scientist'],
  openGraph: {
    siteName: 'Reader & Writer',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${newsreader.variable} ${lora.variable} ${newYorker.variable}`}>
      <body suppressHydrationWarning className="m-0 p-0">
        {children}
        <NavDock />
      </body>
    </html>
  );
}
