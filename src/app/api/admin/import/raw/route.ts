import { NextRequest, NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';
import { ID, Query } from 'appwrite';
import OpenAI from 'openai';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import { generateDailySessionData } from '@/lib/daily-session-generator';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ARTICLES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID!;
const READING_EXCERPTS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_READING_EXCERPTS_COLLECTION_ID!;

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: process.env.GROK_API_KEY || 'default',
    });

    const bodyText = await req.json();
    const { html, url } = bodyText;

    if (!html) {
      return NextResponse.json({ error: 'Missing HTML content' }, { status: 400, headers: corsHeaders });
    }

    // Parse HTML via JSDOM
    const dom = new JSDOM(html, { url: url || 'http://localhost' });
    const doc = dom.window.document;

    // Extract Cover Image (og:image)
    let coverImage = '';
    const ogImg = doc.querySelector('meta[property="og:image"]');
    if (ogImg) coverImage = ogImg.getAttribute('content') || '';

    // Extract Canonical URL
    let canonicalUrl = url || '';
    if (!canonicalUrl) {
      const canonical = doc.querySelector('link[rel="canonical"]');
      if (canonical) {
        canonicalUrl = canonical.getAttribute('href') || '';
      } else {
        const ogUrl = doc.querySelector('meta[property="og:url"]');
        if (ogUrl) canonicalUrl = ogUrl.getAttribute('content') || '';
      }
    }

    // Extract Section & Column
    let section = '';
    let column = '';
    const sectionMeta = doc.querySelector('meta[property="article:section"]');
    if (sectionMeta) section = sectionMeta.getAttribute('content') || '';
    
    // Parse URL for section fallback (generic)
    if (canonicalUrl) {
      try {
        const urlObj = new URL(canonicalUrl);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length >= 1) {
          if (parts[0] && !/^\d{4}$/.test(parts[0])) {
             let urlSection = parts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
             
             // If there's a sub-section before the slug (e.g. /humor/shouts-murmurs/slug)
             if (parts.length > 2 && parts[1] && !/^\d{4}$/.test(parts[1])) {
               const subSection = parts[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
               urlSection = `${urlSection} / ${subSection}`;
             }

             // Prefer URL section if meta section is missing or literal 'tags'
             if (!section || section.toLowerCase() === 'tags') {
               section = urlSection;
             }
          }
          if (parts[1] && !/^\d{4}$/.test(parts[1])) {
             column = parts[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
        }
      } catch(e) {}
    }

    if (section.toLowerCase() === 'tags') {
      section = '';
    }

    // --- CHART SANDBOXING ---
    const originalStyles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('\\n');
    const chartMap = new Map<string, string>();
    let chartIndex = 0;

    const svgs = doc.querySelectorAll('svg');
    svgs.forEach((svg: any) => {
      const w = svg.getAttribute('width');
      if (w && parseInt(w) < 100) return;

      let container: any = svg.closest('.container[class*="svelte-"]') || 
                           svg.closest('.layout-article-graphic') || 
                           svg.closest('figure') || 
                           svg.closest('[class*="svelte-"]');
                           
      if (!container) container = svg;
      if (container.dataset.sandboxed === 'true') return;
      container.dataset.sandboxed = 'true';

      const placeholderId = `CHART_SANDBOX_PLACEHOLDER_${chartIndex++}`;
      const placeholder = doc.createElement('p');
      placeholder.id = placeholderId;
      placeholder.textContent = placeholderId;
      
      const chartHTML = container.outerHTML;
      const srcDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
            </style>
            ${originalStyles}
          </head>
          <body>
            ${chartHTML}
          </body>
        </html>
      `;

      const iframeHTML = `<iframe 
        srcdoc="${escapeHtml(srcDoc)}" 
        style="width: 100%; border: none; overflow: hidden; margin: 2rem 0; background: transparent;" 
        scrolling="no"
        sandbox="allow-scripts allow-same-origin"
        onload="this.style.height = this.contentWindow.document.documentElement.scrollHeight + 'px';"
      ></iframe>`;

      chartMap.set(placeholderId, iframeHTML);
      container.replaceWith(placeholder);
    });

    // Run Readability
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      throw new Error('Readability failed to parse the article content.');
    }

    // Sanitize the HTML
    const DOMPurify = createDOMPurify(dom.window as any);
    const cleanHTML = DOMPurify.sanitize(article.content || '', { ADD_ATTR: ['id'] });

    // Re-inject the sandboxed iframes
    let finalHTML = cleanHTML;
    chartMap.forEach((iframeHTML, placeholderId) => {
      const regex = new RegExp(`<p[^>]*id="${placeholderId}"[^>]*>.*?${placeholderId}.*?</p>`, 'g');
      finalHTML = finalHTML.replace(regex, iframeHTML);
    });

    // Generate a URL-friendly slug
    const title = article.title || 'Untitled';
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
          { status: 409, headers: corsHeaders }
        );
      }
    }

    // 2. AI Hook Extraction
    let hookExcerpt = article.excerpt || '';
    try {
      const prompt = `You are an editorial assistant. Extract EXACTLY ONE incredibly compelling, powerful, and context-free sentence (or two short sentences) directly from the provided text to use as a hook/excerpt.
RULES:
1. It MUST be an exact extraction (verbatim) from the text. DO NOT generate new text. DO NOT summarize.
2. It must hook the reader.
3. No introductory text, no quotes around it, just the raw extracted text.

Article Text:
${(article.textContent || '').slice(0, 15000)}`;

      const aiResponse = await openai.chat.completions.create({
        model: 'grok-4.3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
      });

      hookExcerpt = aiResponse.choices[0].message.content?.trim() || '';
      if (hookExcerpt.startsWith('"') && hookExcerpt.endsWith('"')) {
        hookExcerpt = hookExcerpt.slice(1, -1);
      }
    } catch (e) {
      console.warn('AI Hook extraction failed.', e);
    }

    if (!hookExcerpt) {
      const sentences = (article.textContent || '').split(/(?<=[.!?])\\s+/);
      const validSentences = sentences.filter((s: string) => s.length > 20);
      hookExcerpt = validSentences.slice(0, 2).join(' ') || 'An insightful look into the latest ideas and analysis.';
      if (hookExcerpt.length > 200) {
        hookExcerpt = hookExcerpt.substring(0, 197) + '...';
      }
    }

    // 3. Save to Appwrite
    const articleData = {
      title: title.trim(),
      slug: slug,
      body: finalHTML,
      excerpt: hookExcerpt,
      cover_image_id: coverImage || '',
      source: article.siteName || 'Web',
      source_issue: 'Imported via Extension',
      section: section || '',
      column: column || '',
      author: article.byline ? article.byline.trim() : (article.siteName || 'Unknown'),
      published_at: new Date().toISOString(),
      status: 'published',
      reading_time: Math.max(1, Math.ceil((article.textContent || '').split(/\\s+/).length / 200)),
    };

    const newDoc = await serverDatabases.createDocument(
      DATABASE_ID,
      ARTICLES_COLLECTION_ID,
      ID.unique(),
      articleData
    );

    // 4. Manual mining is now done via the Admin Panel, no longer auto-fired here.

    // Generate IELTS questions & Featured Phrases in the background
    // (We don't await this so it doesn't block the API response)
    const rawText = article.textContent || finalHTML.replace(/<[^>]*>?/gm, '');
    generateDailySessionData(newDoc.$id, rawText).catch(console.error);

    return NextResponse.json({ success: true, articleId: newDoc.$id }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Import Raw API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
