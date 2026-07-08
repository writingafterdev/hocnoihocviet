// src/app/api/lookup/route.ts
// Server-side vocabulary lookup via xAI Grok 4.3
// Never called directly from the client — the GROK_API_KEY stays server-side.

import { NextRequest, NextResponse } from 'next/server';

const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const MODEL         = 'grok-4.3';

const SYSTEM_PROMPT = `You are a vocabulary assistant for a reading app. When given a word or phrase and optionally the sentence it appeared in, respond ONLY with a valid JSON object — no markdown, no explanation, just raw JSON.

Schema:
{
  "pos": string,           // Part of speech abbreviation: "n.", "v.", "adj.", "adv.", "phr.", "prep.", "conj.", "interj."
  "pronunciation": string, // IPA phonetic transcription e.g. "/breɪk ðə aɪs/"
  "definition": string,    // Context-sensitive definition in 1-2 sentences — explain how the word is being USED in the provided sentence, not just its dictionary meaning
  "example": string,       // One natural example sentence showing the word in a similar context
  "topics": string[]       // 1-3 relevant topic tags from this exact list: ["Nature", "Technology", "Personality", "Life", "Personal Growth", "Work", "Science", "Society"]
}

Rules:
- If a context sentence is provided, tailor the definition to match that specific usage and meaning in that sentence
- For multi-word phrases use pos "phr."
- Keep definition under 50 words
- Example sentence should feel like it comes from a quality magazine article
- Do not include the word/phrase itself verbatim in the definition
- topics must only contain values from the provided list, pick the most relevant 1-3
- Respond ONLY with the JSON object, nothing else`;

import { serverDatabases } from '@/lib/appwrite-server';
import { DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query, ID } from 'appwrite';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROK_API_KEY not configured' }, { status: 500 });
  }

  let phrase: string;
  let context: string | undefined;
  let targetLanguage = 'English';
  let vocabEntryId: string | undefined;

  try {
    const body = await req.json();
    phrase  = (body.phrase  ?? '').trim();
    context = (body.context ?? '').trim() || undefined;
    targetLanguage = body.targetLanguage || 'English';
    vocabEntryId = body.vocabEntryId;
    if (!phrase) throw new Error('empty phrase');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 1. Check Cache
  let cachedDocId: string | null = null;
  try {
    const cacheResult = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.global_dictionary, [
      Query.equal('word', phrase.toLowerCase()),
      Query.equal('language', targetLanguage)
    ]);

    if (cacheResult.total > 0) {
      cachedDocId = cacheResult.documents[0].$id;
      const deepData = cacheResult.documents[0].deep_analysis;
      if (deepData) {
        const parsed = JSON.parse(deepData);
        // If background update is requested, do it here
        if (vocabEntryId) {
          try {
            await serverDatabases.updateDocument(DB_ID, COLLECTIONS.vocab, vocabEntryId, {
              pos: parsed.pos,
              definition: parsed.definition,
              example: parsed.example,
              tags: parsed.topics || []
            });
          } catch (e) {
             console.error('Failed to update background vocab entry from cache:', e);
          }
        }
        return NextResponse.json(parsed);
      }
    }
  } catch (dbErr) {
    console.error('Cache read error:', dbErr);
  }

  // 2. Cache Miss: Fetch from Grok
  const userMessage = context
    ? `Look up: "${phrase}"\n\nContext sentence: "${context}"\n\nTarget Language for definition: ${targetLanguage}`
    : `Look up: "${phrase}"\n\nTarget Language for definition: ${targetLanguage}`;

  try {
    const res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Grok lookup] API error:', res.status, text);
      return NextResponse.json({ error: `Grok API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    let lookup: Record<string, string | string[]>;
    try {
      const clean = content.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
      lookup = JSON.parse(clean);
    } catch {
      console.error('[Grok lookup] Failed to parse model JSON:', content);
      return NextResponse.json({ error: 'Model returned malformed JSON' }, { status: 502 });
    }

    const { pos, pronunciation, definition, example, topics } = lookup as any;
    if (!pos || !definition) {
      return NextResponse.json({ error: 'Incomplete lookup result' }, { status: 502 });
    }

    const ALLOWED_TOPICS = ['Nature', 'Technology', 'Personality', 'Life', 'Personal Growth', 'Work', 'Science', 'Society'];
    const validTopics = Array.isArray(topics)
      ? topics.filter((t: string) => ALLOWED_TOPICS.includes(t))
      : [];

    const finalResponse = { pos, pronunciation: pronunciation ?? '', definition, example: example ?? '', topics: validTopics };

    // 3. Save to Global Cache
    try {
      if (cachedDocId) {
        await serverDatabases.updateDocument(DB_ID, COLLECTIONS.global_dictionary, cachedDocId, {
          deep_analysis: JSON.stringify(finalResponse)
        });
      } else {
        await serverDatabases.createDocument(DB_ID, COLLECTIONS.global_dictionary, ID.unique(), {
          word: phrase.toLowerCase(),
          language: targetLanguage,
          deep_analysis: JSON.stringify(finalResponse)
        });
      }
    } catch (saveErr) {
      console.error('Cache save error:', saveErr);
    }

    // 4. If background update requested, save to vocab_entries
    if (vocabEntryId) {
      try {
        await serverDatabases.updateDocument(DB_ID, COLLECTIONS.vocab, vocabEntryId, {
          pos: finalResponse.pos,
          definition: finalResponse.definition,
          example: finalResponse.example,
          tags: finalResponse.topics
        });
      } catch (e) {
        console.error('Failed to update background vocab entry from Grok result:', e);
      }
    }

    return NextResponse.json(finalResponse);
  } catch (err) {
    console.error('[Grok lookup] Fetch error:', err);
    return NextResponse.json({ error: 'Network error reaching Grok API' }, { status: 503 });
  }
}
