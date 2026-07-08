import { NextRequest, NextResponse } from 'next/server';

const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const MODEL         = 'grok-4.3';

const SYSTEM_PROMPT = `You are an expert editorial editor for a high-end magazine.
I will provide you with the full text of an article.
Your task is to summarize the article into a punchy, engaging "1-minute read" (about 150-200 words).
Do NOT use markdown. Return ONLY the summarized text. Maintain the tone of the original piece (e.g., analytical, humorous, or investigative).`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROK_API_KEY not configured' }, { status: 500 });
  }

  let text: string;
  try {
    const body = await req.json();
    text = body.text || '';
    if (!text || text.length < 50) {
      throw new Error('Text must be provided and have substantial length');
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body, expected { text: string }' }, { status: 400 });
  }

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
          { role: 'user',   content: text.slice(0, 15000) }, // Limit to ~15k chars to stay safely within token limits
        ],
        temperature: 0.5,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Grok Summarize] API error:', res.status, errorText);
      return NextResponse.json({ error: `Grok API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim() ?? '';
    
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[Grok Summarize] Fetch error:', err);
    return NextResponse.json({ error: 'Network error reaching Grok API' }, { status: 503 });
  }
}
