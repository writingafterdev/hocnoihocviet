import { NextRequest, NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';
import { DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query, ID } from 'appwrite';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROK_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { word, context, targetLanguage = 'Vietnamese' } = await req.json();

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    }

    // 1. Check Global Dictionary Cache
    try {
      const cacheResult = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.global_dictionary, [
        Query.equal('word', word.toLowerCase()),
        Query.equal('language', targetLanguage)
      ]);

      if (cacheResult.total > 0 && cacheResult.documents[0].translation) {
        return NextResponse.json({ 
          translation: cacheResult.documents[0].translation,
          cached: true
        });
      }
    } catch (dbErr) {
      console.error('Cache read error:', dbErr);
      // Proceed to generate even if cache fails
    }

    // 2. Cache Miss: Generate via Grok
    const prompt = `Translate the English word/phrase "${word}" to ${targetLanguage}. 
Context: "${context}"

Reply ONLY with the 1 to 3 word translation in ${targetLanguage}. No markdown, no reasoning, no punctuation.`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-4.3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 15, // Extremely fast, short response
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Grok translation error:', errText);
      throw new Error(`Grok translation failed: ${response.status}`);
    }

    const data = await response.json();
    const translation = data.choices[0]?.message?.content?.trim()?.replace(/['"]/g, '');

    if (!translation) {
      throw new Error('Empty translation received');
    }

    // 3. Save to Global Dictionary Cache silently
    try {
      // First verify it wasn't added by a race condition
      const check = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.global_dictionary, [
        Query.equal('word', word.toLowerCase()),
        Query.equal('language', targetLanguage)
      ]);

      if (check.total === 0) {
        await serverDatabases.createDocument(DB_ID, COLLECTIONS.global_dictionary, ID.unique(), {
          word: word.toLowerCase(),
          language: targetLanguage,
          translation: translation
        });
      } else if (!check.documents[0].translation) {
        await serverDatabases.updateDocument(DB_ID, COLLECTIONS.global_dictionary, check.documents[0].$id, {
          translation: translation
        });
      }
    } catch (saveErr) {
      console.error('Cache save error:', saveErr);
    }

    return NextResponse.json({ translation, cached: false });

  } catch (err: any) {
    console.error('Translate quick API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
