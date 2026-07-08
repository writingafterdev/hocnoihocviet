// pipeline/shared/ai.ts
// DeepSeek V4 Flash client — FORMAT ONLY
// Role: convert raw scraped/epub text into clean readable HTML
// STRICT RULE: Do NOT summarize, simplify, or omit any content

import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

const FORMAT_SYSTEM_PROMPT = `You are a text formatting assistant for a magazine blog.

Your ONLY job is to clean up raw scraped or extracted text and convert it into clean, readable HTML.

STRICT RULES:
1. Do NOT summarize, paraphrase, shorten, or change any part of the article content.
2. Do NOT add commentary, introductions, or conclusions that weren't in the original.
3. Do NOT omit any sentences or paragraphs.
4. DO fix: broken line breaks, stray navigation text, repeated headers, markdown artifacts, excessive whitespace.
5. DO wrap paragraphs in <p> tags, headings in <h2>/<h3>, blockquotes in <blockquote>.
6. DO preserve the author's exact words, tone, and structure.

Output a JSON object with these fields:
{
  "title": "Article title (string)",
  "author": "Author name or 'The Economist' if anonymous (string)",
  "excerpt": "First 2 sentences of the article, verbatim (string)",
  "body": "Full article as clean HTML (string)",
  "tags": ["tag1", "tag2"],
  "reading_time": 5
}`;

export interface FormattedArticle {
  title: string;
  author: string;
  excerpt: string;
  body: string;
  tags: string[];
  reading_time: number;
}

export async function formatArticle(
  rawText: string,
  context: { magazine: string; section: string; issue: string }
): Promise<FormattedArticle> {
  const userPrompt = `Magazine: ${context.magazine}
Section: ${context.section}
Issue: ${context.issue}

Raw article text to format:
---
${rawText.slice(0, 80000)}
---

Return only the JSON object, no markdown fences.`;

  const response = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: FORMAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1, // Low temp — we want deterministic formatting, not creativity
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0].message.content ?? '{}';
  return JSON.parse(text) as FormattedArticle;
}
