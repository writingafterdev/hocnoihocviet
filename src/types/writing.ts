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
  /** Stable machine code from the fixed assessment taxonomy. UI should display errorLabelVi. */
  errorCode?: string;
  errorLabelVi?: string;
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
    proposedText?: string;
    whyBetter?: string;
  };
  comment?: AssessmentComment;
  evidenceSpans?: AssessmentEvidenceSpan[];
  nodeLinks?: AssessmentNodeLinks;
  descriptorAnchor?: AssessmentDescriptorAnchor;
}

export interface AssessmentReference {
  kind: 'prompt' | 'macro' | 'paragraph' | 'node' | 'edge' | 'flow' | 'highlight' | 'comment';
  id: string;
  label: string;
}

export interface AssessmentComment {
  bodyVi: string;
  solutionBodyVi?: string;
  references?: AssessmentReference[];
}

/** Machine-readable reason this finding matters to an IELTS criterion. */
export interface AssessmentDescriptorAnchor {
  criterion: 'task_response' | 'coherence_cohesion' | 'lexical_resource' | 'grammatical_range_accuracy';
  featureCode: string;
  featureEn: string;
}

/** Exact source ranges rendered as assessment evidence, not broad sentence fallbacks. */
export interface AssessmentEvidenceSpan {
  startChar: number;
  endChar: number;
  sourceText: string;
  role?: 'primary' | 'context' | 'affected';
  nodeId?: string;
}

/** Explicit node roles so the evidence map can focus every node named by a comment. */
export interface AssessmentNodeLinks {
  primaryNodeIds?: string[];
  contextNodeIds?: string[];
  affectedNodeIds?: string[];
}

export type PyramidIssueType =
  | 'internal'
  | 'relational'
  | 'logical_jump'
  | 'weak_support'
  | 'wrong_relationship'
  | 'missing_bridge'
  | 'misordered_sequence'
  | 'unsupported_claim'
  | 'redundant_node';

export interface PyramidIssue {
  id: string;
  /** Stable machine code from the fixed assessment taxonomy. UI should display errorLabelVi. */
  errorCode?: string;
  errorLabelVi?: string;
  type: PyramidIssueType;
  direction?: 'vertical' | 'horizontal';
  title: string;
  whyWrong: string;
  impactOnPurpose: string;
  impactOnReader: string;
  affectedNodes?: {
    paragraphs?: number[];
    sentences?: { paraIndex: number; sentenceIndex: number }[];
  };
  solutionActions?: PyramidSolutionAction[];
  comment?: AssessmentComment;
  evidenceSpans?: AssessmentEvidenceSpan[];
  nodeLinks?: AssessmentNodeLinks;
  descriptorAnchor?: AssessmentDescriptorAnchor;
}

export interface PyramidSolutionAction {
  type:
    | 'change_relationship_tag'
    | 'add_node'
    | 'delete_node'
    | 'rewrite_node'
    | 'change_role'
    | 'move_node'
    | 'suggest_order'
    | 'merge_nodes'
    | 'split_node'
    | 'add_bridge';
  label: string;
  details: string;
  targetNodeId?: string;
  targetNodeIds?: string[];
  targetEdgeId?: string;
  proposedNodeId?: string;
  parentNodeId?: string;
  insertAfterNodeId?: string;
  insertBeforeNodeId?: string;
  proposedRole?: SentenceRole;
  proposedLabel?: string;
  proposedText?: string;
  proposedNodes?: Array<{
    proposedNodeId: string;
    proposedRole: SentenceRole;
    proposedLabel: string;
    proposedText: string;
  }>;
  proposedRelationshipTag?: string;
  currentOrder?: string[];
  proposedOrder?: string[];
  dependencyClaim?: string;
  whyBetter?: string;
}

export interface NodeReview {
  nodeId: string;
  status: 'works' | 'weak' | 'broken';
  job: string;
  assessment: string;
  issues: PyramidIssue[];
}

export interface EdgeReview {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipTag: string;
  expectedRelationship: string;
  actualRelationship?: string;
  status: 'works' | 'weak' | 'broken';
  assessment: string;
  issues: PyramidIssue[];
}

export type CoherenceFlowType =
  | 'linear'
  | 'backward'
  | 'joint'
  | 'contrast'
  | 'bridge'
  | 'conclusion';

/** Canonical patterns for chunk-level information-order problems. */
export type CoherenceDiagnosticPattern =
  | 'joint_causes_as_chain'
  | 'cause_result_reversed'
  | 'interleaved_parallel_chains'
  | 'conclusion_before_grounds'
  | 'separated_dependent_chunks'
  // Legacy values are accepted when loading older assessments.
  | 'result_before_cause'
  | 'conclusion_before_evidence'
  | 'motivation_after_decision'
  | 'background_after_result'
  | 'missing_bridge'
  | 'joint_support_hidden'
  | 'backward_dependency'
  | 'contrast_turn_unclear'
  | 'other';

export type CoherenceRepairScope =
  | 'local_relocation'
  | 'minor_restructure'
  | 'macro_restructure';

export type RelevanceGateStatus = 'eligible' | 'questionable' | 'ineligible';

export interface RelevanceGateItem {
  nodeId: string;
  paragraphIndex: number;
  status: RelevanceGateStatus;
  paragraphRoleFit: 'fits' | 'wrong_paragraph_role' | 'unclear';
  coherenceEligible: boolean;
  reasonVi: string;
  taskResponseErrorCode?: string;
}

export interface CoherenceFlow {
  paragraphIndex: number;
  edgeId: string;
  fromNodeIds: string[];
  toNodeId: string;
  relationshipTag: string;
  flowType: CoherenceFlowType;
  status: 'works' | 'weak' | 'broken';
  writtenOrder?: string[];
  actualDependency?: string;
  suggestedOrder?: string[];
  readerBurdenVi?: string;
  diagnosticPattern?: CoherenceDiagnosticPattern;
  /** Issue kind and repair scope are deliberately separate. */
  repairScope?: CoherenceRepairScope;
  issue: PyramidIssue;
  descriptorAnchor?: AssessmentDescriptorAnchor;
}

export interface SentenceAnnotation {
  index: number;         // 1-based: S1, S2, S3...
  nodeId?: string;
  sourceSentenceIndex?: number;
  chunkIndex?: number;
  sourceText?: string;
  startChar: number;     // 0-indexed offset in original essay string
  endChar: number;
  role: SentenceRole;
  simplifiedIdea: string;
  errors: PyramidError[];
  review?: NodeReview;
  transitionToNext?: string;
}

export interface ParagraphMoveNode {
  index: number;           // 0 = intro, 1 = body1, 2 = body2, etc.
  label: string;           // "Introduction" | "Body 1" | "Conclusion"
  job: string;             // "Explain the isolation side"
  paragraphStartChar: number;
  paragraphEndChar: number;
  errors: PyramidError[];
  review?: NodeReview;
  sentences: SentenceAnnotation[];
  transitionToNext?: string;
}

export interface MacroAnswerNode {
  text: string;            // extracted thesis / whole-essay answer
  errors: PyramidError[];
  review?: NodeReview;
}

export interface EssayHighlight {
  startChar: number;
  endChar: number;
  /** Stable machine code from the fixed assessment taxonomy. UI should display errorLabelVi. */
  errorCode?: string;
  errorLabelVi?: string;
  highlightType: string;
  label: string;
  sourceText?: string;
  feedback: string;
  replacementText?: string;
  correction?: string;
  suggestedText?: string;
  solutionFeedback?: string;
  references?: AssessmentReference[];
  // For ARGUMENT tab: link back to source
  paragraphIndex?: number;
  sentenceIndex?: number;
  descriptorAnchor?: AssessmentDescriptorAnchor;
}

export interface BandScores {
  overall: number;
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
}

export interface AssessmentAudit {
  provisionalScores: BandScores;
  /** Kept for backward compatibility. In v2 the verifier does not rescore. */
  evidenceScores: BandScores;
  reconciliation: {
    changedCriteria: Array<{
      criterion: keyof Omit<BandScores, 'overall'>;
      provisionalBand: number;
      evidenceBand: number;
      finalBand: number;
      reasonVi: string;
      evidenceIds: string[];
    }>;
    summaryVi: string;
  };
}

export interface TaskCoverageItem {
  id: string;
  requirement: string;
  status: 'fully_addressed' | 'partly_addressed' | 'missing' | 'off_task';
  evidenceNodeIds: string[];
  assessmentVi: string;
}

export interface OverallAssessment {
  summaryVi: string;
  priorities: Array<{
    criterion: keyof Omit<BandScores, 'overall'>;
    titleVi: string;
    actionVi: string;
    evidenceIds: string[];
  }>;
  descriptorAlignment: Array<{
    criterion: keyof Omit<BandScores, 'overall'>;
    band: number;
    rationaleVi: string;
    evidenceIds: string[];
  }>;
}

export interface BandComparison {
  targetBand: 8 | 9;
  revisedEssay: string;
  changeSummaryVi: string;
  preservedStrengthsVi: string[];
  changes?: Array<{
    findingId: string;
    /** Additional confirmed findings resolved by the same atomic edit. */
    findingIds?: string[];
    originalText: string;
    /** Zero-based occurrence in the complete essay when originalText repeats. */
    occurrenceIndex?: number;
    revisedText: string;
    explanationVi: string;
  }>;
}

export interface ArgumentGuidingQuestion {
  id: string;
  label: string;
  questionVi: string;
  purposeVi: string;
  nodeIds: string[];
}

export interface ArgumentChunkAssignment {
  nodeId: string;
  questionId?: string;
  role: 'question' | 'conclusion' | 'unassigned';
  relevanceStatus?: RelevanceGateStatus;
  coherenceEligible?: boolean;
}

export interface ArgumentDiagnosisPoint {
  id: string;
  titleVi: string;
  bodyVi: string;
  nodeIds: string[];
}

export interface ArgumentRepairStep {
  id: string;
  titleVi: string;
  bodyVi: string;
  nodeIds: string[];
  order?: string[];
  addedNodes?: Array<{
    id: string;
    label: string;
    text: string;
    afterNodeId?: string;
  }>;
  removedNodeIds?: string[];
  mergedNodeIds?: string[];
  repairScope?: CoherenceRepairScope;
}

export type ArgumentMacroErrorType = 'none' | 'semantic_alignment' | 'coherence_order';

export interface ArgumentChunkRevision {
  nodeId: string;
  revisedText: string;
  reasonVi: string;
}

export interface ArgumentFlowChapter {
  id: string;
  paragraphIndex: number;
  titleVi: string;
  paragraphPromiseVi: string;
  macroAlignmentVi: string;
  macroErrorType?: ArgumentMacroErrorType;
  /** Canonical Illogical Progression patterns present in this paragraph. */
  coherencePatterns?: Exclude<CoherenceDiagnosticPattern, 'other'>[];
  /** Scope of the proposed order repair, independent from the error type. */
  repairScope?: CoherenceRepairScope;
  hasMacroRearrangement: boolean;
  originalOrder: string[];
  questions: ArgumentGuidingQuestion[];
  assignments: ArgumentChunkAssignment[];
  diagnosisIntroVi: string;
  diagnosis: ArgumentDiagnosisPoint[];
  repairIntroVi: string;
  repairSteps: ArgumentRepairStep[];
  finalOrder: string[];
  finalSummaryVi: string;
  feedbackOnlySolutionVi?: string;
  revisedChunks?: ArgumentChunkRevision[];
  taskAuditVi: string;
}

export interface ArgumentFlowOverview {
  titleVi: string;
  bodyVi: string;
  nodeIds: string[];
}

export interface WritingAnalysis {
  promptType: PromptType;
  assessmentAudit?: AssessmentAudit;
  scores: BandScores;
  taskCoverage?: TaskCoverageItem[];
  argumentFlowOverview?: ArgumentFlowOverview;
  argumentFlowChapters?: ArgumentFlowChapter[];
  relevanceGate?: RelevanceGateItem[];
  pyramid: {
    macroAnswer: MacroAnswerNode;
    paragraphs: ParagraphMoveNode[];
    edgeReviews?: EdgeReview[];
    coherenceFlows?: CoherenceFlow[];
  };
  cohesionHighlights: EssayHighlight[];
  lexicalHighlights: EssayHighlight[];
  grammaticalHighlights: EssayHighlight[];
  overallAssessment?: OverallAssessment;
  comparison?: BandComparison;
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
