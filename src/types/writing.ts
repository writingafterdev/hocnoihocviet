// src/types/writing.ts
// Types for IELTS Writing Task 2 Assessment

export type PromptType =
  | 'agree_disagree'
  | 'discuss_both'
  | 'advantages_disadvantages'
  | 'outweigh'
  | 'cause_effect'
  | 'problem_solution'
  | 'two_part';

export type SentenceRole =
  | 'setup'
  | 'claim'
  | 'reason'
  | 'explanation'
  | 'mechanism'
  | 'example'
  | 'comparison'
  | 'contrast'
  | 'concession'
  | 'mini_conclusion'
  | 'final_stance'
  | 'filler'
  | 'logic_jump'
  | 'unsupported_claim';

export interface PyramidError {
  type: 'relational' | 'internal';
  direction?: 'vertical' | 'horizontal'; // only for relational
  message: string; // specific, evidence-led — never generic
  explanation?: string;
  suggestion?: string;
  affectedNodes?: {
    paragraphs?: number[];
    sentences?: { paraIndex: number; sentenceIndex: number }[];
  };
  proposedFix?: {
    type: 'add_node' | 'change_role' | 'rewrite' | 'change_relationship';
    details: string;
  };
}

export interface SentenceAnnotation {
  index: number;         // 1-based: S1, S2, S3...
  startChar: number;     // 0-indexed offset in original essay string
  endChar: number;
  role: SentenceRole;
  simplifiedIdea: string;
  errors: PyramidError[];
  transitionToNext?: string;
}

export interface ParagraphMoveNode {
  index: number;           // 0 = intro, 1 = body1, 2 = body2, etc.
  label: string;           // "Introduction" | "Body 1" | "Conclusion"
  job: string;             // "Explain the isolation side"
  paragraphStartChar: number;
  paragraphEndChar: number;
  errors: PyramidError[];
  sentences: SentenceAnnotation[];
  transitionToNext?: string;
}

export interface MacroAnswerNode {
  text: string;            // extracted thesis / whole-essay answer
  errors: PyramidError[];
}

export interface EssayHighlight {
  startChar: number;
  endChar: number;
  highlightType: string;
  label: string;
  feedback: string;
  // For ARGUMENT tab: link back to source
  paragraphIndex?: number;
  sentenceIndex?: number;
}

export interface BandScores {
  overall: number;
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
}

export interface WritingAnalysis {
  promptType: PromptType;
  scores: BandScores;
  pyramid: {
    macroAnswer: MacroAnswerNode;
    paragraphs: ParagraphMoveNode[];
  };
  cohesionHighlights: EssayHighlight[];
  lexicalHighlights: EssayHighlight[];
  grammaticalHighlights: EssayHighlight[];
}

// Derived: highlights shown in the ARGUMENT tab
// Built client-side from pyramid sentence errors
export interface ArgumentHighlight extends EssayHighlight {
  paragraphIndex: number;
  sentenceIndex: number;
  sentenceRole: SentenceRole;
  simplifiedIdea: string;
  paragraphLabel: string;
  paragraphJob: string;
  error: PyramidError;
}
