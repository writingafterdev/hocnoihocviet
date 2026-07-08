import { NextRequest, NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';
import { ID, Query } from 'appwrite';
import OpenAI from 'openai';
import { generateDailySessionData } from '@/lib/daily-session-generator';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ARTICLES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID!;

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: process.env.GROK_API_KEY || 'default',
    });

    const body = await req.json();
    const { title, author, content, textContent, excerpt, coverImage, url, siteName } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a URL-friendly slug
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // 1. Deduplication Check
    if (slug) {
      const existing = await serverDatabases.listDocuments(
        DATABASE_ID,
        ARTICLES_COLLECTION_ID,
        [Query.equal('slug', slug)]
      );
      if (existing.total > 0) {
        return NextResponse.json(
          { error: 'Article already exists in library.', articleId: existing.documents[0].$id },
          { status: 409 }
        );
      }
    }

    // 2. AI Hook Extraction (Not generation!)
    // The user strictly wants to extract an existing powerful sentence/quote from the text.
    let hookExcerpt = excerpt || '';
    try {
      const prompt = `You are an editorial assistant. Extract EXACTLY ONE incredibly compelling, powerful, and context-free sentence (or two short sentences) directly from the provided text to use as a hook/excerpt.
RULES:
1. It MUST be an exact extraction (verbatim) from the text. DO NOT generate new text. DO NOT summarize.
2. It must hook the reader.
3. No introductory text, no quotes around it, just the raw extracted text.

Article Text:
${textContent.slice(0, 15000)}`; // Provide enough text to find a good hook

      const aiResponse = await openai.chat.completions.create({
        model: 'grok-4.3', // xAI model
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.0, // strict extraction
      });

      hookExcerpt = aiResponse.choices[0].message.content?.trim() || '';
      // Clean up potential quotes added by the AI despite instructions
      if (hookExcerpt.startsWith('"') && hookExcerpt.endsWith('"')) {
        hookExcerpt = hookExcerpt.slice(1, -1);
      }
    } catch (e) {
      console.warn('AI Hook extraction failed.', e);
    }

    // Final fallback if both AI and Readability failed
    if (!hookExcerpt) {
      // Find the first meaningful paragraph text (avoiding short menu strings)
      const sentences = textContent.split(/(?<=[.!?])\\s+/);
      const validSentences = sentences.filter((s: string) => s.length > 20);
      hookExcerpt = validSentences.slice(0, 2).join(' ') || 'An insightful look into the latest ideas and analysis.';
      if (hookExcerpt.length > 200) {
        hookExcerpt = hookExcerpt.substring(0, 197) + '...';
      }
    }

    // 3. Save to Appwrite using exact Schema attributes
    const articleData = {
      title: title.trim(),
      slug: slug,
      body: content,
      excerpt: hookExcerpt || '',
      cover_image_id: coverImage || '',
      source: siteName || 'Web',
      source_issue: 'Imported',
      author: author ? author.trim() : (siteName || 'Unknown'),
      published_at: new Date().toISOString(),
      status: 'published',
      reading_time: Math.max(1, Math.ceil((textContent || '').split(/\\s+/).length / 200)),
    };

    const newDoc = await serverDatabases.createDocument(
      DATABASE_ID,
      ARTICLES_COLLECTION_ID,
      ID.unique(),
      articleData
    );

    // Generate IELTS questions & Featured Phrases in the background
    // (We don't await this so it doesn't block the API response to the extension/admin UI)
    generateDailySessionData(newDoc.$id, textContent).catch(console.error);

    return NextResponse.json({ success: true, articleId: newDoc.$id });

  } catch (error: any) {
    console.error('Import API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
