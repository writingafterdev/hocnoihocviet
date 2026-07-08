import { NextRequest, NextResponse } from 'next/server';
import { generateGrokJSON } from '@/lib/grok';
import { WritingAnalysis } from '@/types/writing';

const SYSTEM_PROMPT = `You are an expert IELTS examiner trained in Minto-style pyramid reasoning. Your task is to analyze a Task 2 essay and return a precise JSON assessment.

## Your responsibilities

1. Detect the prompt type from: agree_disagree, discuss_both, advantages_disadvantages, outweigh, cause_effect, problem_solution, two_part
2. Extract the Macro Answer — the whole-essay thesis or position in the student's own words
3. Split the essay into paragraphs. For each paragraph:
   - Assign a label: "Introduction", "Body 1", "Body 2", "Body 3", "Conclusion"
   - Assign a job: what this paragraph is doing (e.g. "Explain the advantages of technology")
   - Record paragraphStartChar and paragraphEndChar (0-indexed character offsets in the original essay)
   - Identify errors at the paragraph level
   - Split into sentences. For each sentence:
     - Record startChar and endChar (0-indexed offsets in the original essay)
     - Assign a role from: setup, claim, reason, explanation, mechanism, example, comparison, contrast, concession, mini_conclusion, final_stance, filler, logic_jump, unsupported_claim
     - Write a simplifiedIdea (10–15 words max)
     - Identify errors
4. Return cohesion highlights (linking words, missing transitions, over-repetition of connectors)
5. Return lexical highlights (strong vocabulary, weak vocabulary, inappropriate register, repetition)
6. Return grammatical highlights (range issues, errors, overly simple structures)
7. Score each rubric dimension and compute the overall band (average, rounded to nearest 0.5)

## Error rules — CRITICAL

Only include an error if it is GENUINELY broken. Do not pad. Empty arrays are correct when there are no errors.

Every error must specify:
- type: "relational" or "internal"
- If relational, direction: "vertical" (node doesn't support its parent) or "horizontal" (node doesn't connect to the previous sibling)
- message: specific and evidence-led. Name the actual word, phrase, or logical gap. NEVER say "your development is weak" or "this could be improved". Say exactly what is missing and why.

## Character offset rules

All startChar and endChar values are 0-indexed byte offsets measured from the very start of the essay string the user submitted. They must be exact — these are used to highlight spans in the UI.

## Output schema

Return exactly this JSON structure:

{
  "promptType": "agree_disagree",
  "scores": {
    "overall": 7.0,
    "taskAchievement": 7,
    "coherenceCohesion": 7,
    "lexicalResource": 7,
    "grammaticalRange": 7
  },
  "pyramid": {
    "macroAnswer": {
      "text": "...",
      "errors": []
    },
    "paragraphs": [
      {
        "index": 0,
        "label": "Introduction",
        "job": "Introduce the topic and state the writer's position",
        "paragraphStartChar": 0,
        "paragraphEndChar": 180,
        "errors": [],
        "sentences": [
          {
            "index": 1,
            "startChar": 0,
            "endChar": 92,
            "role": "setup",
            "simplifiedIdea": "Technology is increasingly present in daily life",
            "errors": []
          }
        ]
      }
    ]
  },
  "cohesionHighlights": [
    {
      "startChar": 45,
      "endChar": 59,
      "highlightType": "linker",
      "label": "Linking word",
      "feedback": "Good use of 'Furthermore' to connect the idea."
    }
  ],
  "lexicalHighlights": [],
  "grammaticalHighlights": []
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, essay } = body as { prompt: string; essay: string };

    if (!prompt || !essay) {
      return NextResponse.json({ error: 'Missing prompt or essay' }, { status: 400 });
    }

    if (essay.trim().split(/\s+/).length < 100) {
      return NextResponse.json({ error: 'Essay is too short. Please write at least 100 words.' }, { status: 400 });
    }

    const userPrompt = `TASK 2 PROMPT:\n${prompt}\n\nSTUDENT ESSAY:\n${essay}`;

    const analysis = await generateGrokJSON(SYSTEM_PROMPT, userPrompt) as WritingAnalysis;

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Writing analyze error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
