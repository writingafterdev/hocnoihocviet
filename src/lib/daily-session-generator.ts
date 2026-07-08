import { generateGrokJSON } from './grok';
import { serverDatabases } from './appwrite-server';
import { ID } from 'appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const QUESTIONS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_QUESTIONS_COLLECTION_ID!;
const PHRASES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_FEATURED_PHRASES_COLLECTION_ID!;

const SYSTEM_PROMPT = `You are an expert IELTS examiner and linguist.
Your task is to analyze the provided article text and generate exactly 5 IELTS-style comprehension questions, and 3-5 highly useful "featured phrases" for vocabulary acquisition.

The 5 questions MUST be distributed among these types:
- tfng (True / False / Not Given)
- ynng (Yes / No / Not Given)
- matching_headings
- multiple_choice

CRITICAL: For each question, you MUST include an "anchor_text" field.
This is the EXACT sentence or sentences from the article that contain the evidence needed to answer the question.
- For tfng/ynng: the sentence the statement is testing against.
- For matching_headings: the opening sentence of the relevant paragraph.
- For multiple_choice: the sentence(s) that contain the answer.
The anchor_text must be verbatim from the article — no paraphrasing.

For 'options', provide the possible answers as an array of strings.
For 'correct_answer', provide the exact string from the options array.
For 'explanation', write a precise, evidence-led explanation (2-3 sentences). Do not say "Great job" or use generic praise. Point to the exact word or phrase that resolves the question.

For the 'featured phrases', pick 3-5 phrases (2-4 words long) that are extremely useful for advanced English learners (collocations, idioms, precise verbs). For each, extract the exact 'context' sentence from the article where it appears.

You must reply with a valid JSON object strictly matching this schema:
{
  "questions": [
    {
      "type": "tfng" | "ynng" | "matching_headings" | "multiple_choice",
      "prompt": "The question or statement text",
      "anchor_text": "The exact verbatim sentence(s) from the article that contain the evidence.",
      "options": ["Option 1", "Option 2", ...],
      "correct_answer": "Option 1",
      "explanation": "Precise, evidence-led explanation pointing to the specific word or phrase."
    }
  ],
  "featured_phrases": [
    {
      "phrase": "the phrase",
      "context": "The exact sentence from the text containing the phrase."
    }
  ]
}`;

export async function generateDailySessionData(articleId: string, textContent: string) {
  try {
    // Truncate text if too long to save tokens, but keep enough for good questions
    const textToAnalyze = textContent.slice(0, 20000); 

    const userPrompt = `Article Text:\n\n${textToAnalyze}`;

    const data = await generateGrokJSON(SYSTEM_PROMPT, userPrompt);

    if (data.questions && Array.isArray(data.questions)) {
      for (const q of data.questions) {
        await serverDatabases.createDocument(
          DATABASE_ID,
          QUESTIONS_COLLECTION_ID,
          ID.unique(),
          {
            article_id: articleId,
            type: q.type,
            prompt: q.prompt,
            anchor_text: q.anchor_text || '',
            options: q.options.map(String),
            correct_answer: String(q.correct_answer),
            explanation: q.explanation || ''
          }
        );
      }
    }

    if (data.featured_phrases && Array.isArray(data.featured_phrases)) {
      for (const p of data.featured_phrases) {
        await serverDatabases.createDocument(
          DATABASE_ID,
          PHRASES_COLLECTION_ID,
          ID.unique(),
          {
            article_id: articleId,
            phrase: p.phrase,
            context: p.context
          }
        );
      }
    }

    console.log(`Generated session data for article ${articleId}`);
  } catch (error) {
    console.error("Failed to generate daily session data:", error);
    // Don't throw, we don't want to fail the article import if AI fails
  }
}
