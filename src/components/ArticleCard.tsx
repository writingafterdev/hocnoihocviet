'use client';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { ImageWithFallback } from './ImageWithFallback';
import { getCoverUrl } from '@/lib/appwrite';
import { Headphones } from 'lucide-react';

const PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1486707471592-8e7eb7e36f78?w=600&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80',
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
];

interface Article {
  $id: string;
  title: string;
  slug?: string;
  cover_image_id?: string;
  excerpt?: string;
  description?: string;
  author?: string;
  source?: string;
  reading_time?: number;
  status?: string;
  $createdAt?: string;
}

export default function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  const placeholderIdx = article.$id ? article.$id.charCodeAt(2) % PLACEHOLDERS.length : 0;

  const coverId = (article as any).coverImageId || article.cover_image_id;
  const imgSrc = coverId
    ? getCoverUrl(coverId, 600)
    : PLACEHOLDERS[placeholderIdx];

  const hasAudio = article.reading_time ? article.reading_time > 3 : false; // Mocking audio availability

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(`/articles/${article.slug ?? article.$id}`)}
      className="group flex flex-col cursor-pointer"
    >
      <div className="relative w-full aspect-[3/2] overflow-hidden bg-neutral-100">
        <ImageWithFallback
          src={imgSrc}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        {hasAudio && (
          <div className="absolute bottom-2 right-2 bg-white w-6 h-6 rounded-sm flex items-center justify-center shadow-sm">
            <Headphones className="w-3.5 h-3.5 text-neutral-800" strokeWidth={2.5} />
          </div>
        )}
      </div>
      
      <div className="flex flex-col flex-1 pt-4">
        <h3 className="text-[20px] md:text-[22px] font-serif not-italic leading-[1.2] tracking-tight text-[#111] mb-2 group-hover:text-neutral-600 transition-colors text-balance">
          {article.title}
        </h3>
        
        <p className="text-[14px] leading-[1.5] text-neutral-600 line-clamp-3 mb-4 font-serif text-pretty">
          {article.excerpt ?? article.description ?? 'A short preview of the article content to hook the reader.'}
        </p>

        <div className="mt-auto">
          <span className="text-[10px] font-sans font-bold tracking-[0.08em] uppercase text-[#111]">
            By {article.author ?? 'The Editors'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
