import { NextRequest, NextResponse } from 'next/server';
import { generateGrokJSON } from '@/lib/grok';

const SYSTEM_PROMPT = `You are an expert IELTS writing tutor and bilingual dictionary. 
Your task is to provide the best academic English translation for a Vietnamese phrase, fitting seamlessly into the student's current essay draft.

Respond ONLY with a valid JSON object.

Schema:
{
  "pos": string,           // Part of speech abbreviation: "n.", "v.", "adj.", "adv.", "phr."
  "pronunciation": string, // IPA phonetic transcription (optional, leave empty if N/A)
  "definition": string,    // Brief explanation (in Vietnamese) of why this English phrase fits the specific context of their essay
  "example": string,       // A natural example sentence showing the word in an academic context
  "word": string,          // The suggested English translation (the phrase itself)
  "topics": string[]       // 1-3 relevant topic tags from this exact list: ["Nature", "Technology", "Personality", "Life", "Personal Growth", "Work", "Science", "Society"]
}

Rules:
- Provide the single most natural, academic English phrase that matches the Vietnamese input AND the provided essay context.
- The 'word' field must be the English translation.
- The 'definition' field should explain in Vietnamese why this translation is appropriate for their specific essay context.
- Keep the explanation under 30 words.
- 'topics' must only contain values from the provided list, pick the most relevant 1-3.
- Respond ONLY with the JSON object, nothing else.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phrase, context } = body;

    if (!phrase) {
      return NextResponse.json({ error: 'Missing phrase' }, { status: 400 });
    }

    const userPrompt = context
      ? `Vietnamese phrase to translate: "${phrase}"\n\nCurrent essay draft for context:\n"${context}"\n\nProvide the best English translation for this context.`
      : `Vietnamese phrase to translate: "${phrase}"\n\nProvide the best academic English translation.`;

    const translation = await generateGrokJSON(SYSTEM_PROMPT, userPrompt);

    return NextResponse.json(translation);
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
