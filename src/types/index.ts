// src/types/index.ts
// TypeScript types mirroring the Appwrite schema

export type ArticleStatus = 'draft' | 'published';
export type UserRole = 'reader' | 'admin';
export type ReactionType = 'clap' | 'like' | 'fire';
export type SourceSlug = 'economist' | 'new-yorker' | 'new-scientist';

export interface Source {
  $id: string;
  name: string;
  slug: SourceSlug;
  description: string;
  logo_id: string;
  accent_color: string;
}

export interface Category {
  $id: string;
  name: string;
  slug: string;
  source_slug: SourceSlug;
  color: string;
}

export interface Tag {
  $id: string;
  name: string;
  slug: string;
}

export interface Article {
  $id: string;
  title: string;
  slug: string;
  body: string;         // clean HTML
  excerpt: string;
  cover_image_id: string;
  source: SourceSlug;
  source_issue: string; // e.g. "2026-05-24"
  author: string;
  published_at: string;
  status: ArticleStatus;
  reading_time: number; // minutes
  category_id: string;
  tag_ids: string[];
  highlights: string[]; // 3–5 memorable quote strings extracted from body
  $createdAt: string;
  $updatedAt: string;
}

export interface Comment {
  $id: string;
  article_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
}

export interface Bookmark {
  $id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}

export interface Reaction {
  $id: string;
  user_id: string;
  article_id: string;
  type: ReactionType;
}

export interface UserMeta {
  $id: string;
  user_id: string;
  display_name: string;
  avatar_id: string;
  role: UserRole;
  dismissed_excerpts?: string[];
}

// Enriched types (joined with related data)
export interface ArticleWithSource extends Article {
  sourceData?: Source;
  categoryData?: Category;
  tagData?: Tag[];
}

// Pipeline output types
export interface PipelineArticle {
  title: string;
  slug: string;
  author: string;
  excerpt: string;
  body: string;         // clean HTML — format only, no changes to content
  source: SourceSlug;
  source_issue: string;
  category_slug: string;
  tags: string[];
  reading_time: number;
  cover_image_path?: string;
}

// Daily Session Types
export type QuestionType = 'tfng' | 'ynng' | 'matching_headings' | 'multiple_choice';

export interface Question {
  $id: string;
  article_id: string;
  type: QuestionType;
  prompt: string;
  options: string[]; // e.g. ['True', 'False', 'Not Given'] or ['A', 'B', 'C', 'D']
  correct_answer: string;
  explanation: string;
  $createdAt: string;
}

export interface FeaturedPhrase {
  $id: string;
  article_id: string;
  phrase: string;
  context: string;
  $createdAt: string;
}

export interface ActiveSession {
  $id: string;
  user_id: string;
  article_id: string;
  current_question_index: number;
  status: 'in_progress' | 'completed';
  answers: string; // JSON string mapping question_id to selected option
  $createdAt: string;
  $updatedAt: string;
}
