// src/app/page.tsx
import { getHighlightArticles, getPublishedArticles } from '@/lib/articles';
import type { Metadata } from 'next';
import FeedClient from '@/components/FeedClient';
import HomeAuthWrapper from '@/components/HomeAuthWrapper';

export const metadata: Metadata = {
  title: 'Reader & Writer — Ideas Worth Sharing',
  description: 'Curated articles from The Economist, The New Yorker, and New Scientist. Read better. Think deeper.',
};

export const revalidate = 3600;

export default async function HomePage() {
  return <HomeAuthWrapper />;
}
