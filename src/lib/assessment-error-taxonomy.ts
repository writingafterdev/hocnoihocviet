export const ERROR_LABELS_VI: Record<string, string> = {
  // Task Achievement / Task Response
  unclear_position: 'Vị trí chưa rõ',
  partial_prompt_coverage: 'Trả lời đề chưa đủ phần',
  underdeveloped_idea: 'Ý chưa phát triển đủ',
  unsupported_claim: 'Nhận định thiếu chứng minh',
  overgeneralised_claim: 'Khái quát quá mức',
  irrelevant_detail: 'Chi tiết lệch trọng tâm',
  weak_example: 'Ví dụ yếu',
  example_mismatch: 'Ví dụ lệch chức năng',
  missing_mechanism: 'Thiếu cơ chế giải thích',
  premature_conclusion: 'Kết luận quá sớm',
  unclear_paragraph_job: 'Vai trò đoạn chưa rõ',
  misframed_topic_sentence: 'Câu chủ đề lệch trọng tâm',
  unbalanced_coverage: 'Triển khai mất cân bằng',
  repetitive_argument: 'Lập luận bị lặp',
  insufficient_extension: 'Triển khai chưa đủ sâu',
  missing_qualification: 'Thiếu giới hạn cho nhận định',
  internal_contradiction: 'Lập luận tự mâu thuẫn',
  off_task: 'Ý không trả lời đề',

  // Coherence: idea/chunk flow.
  joint_causes_as_chain: 'Hai cơ sở bị viết thành một chuỗi',
  cause_result_reversed: 'Nguyên nhân và kết quả bị đảo',
  interleaved_parallel_chains: 'Hai mạch ý song song bị đan xen',
  conclusion_before_grounds: 'Kết luận đứng trước cơ sở chứng minh',
  separated_dependent_chunks: 'Hai ý phụ thuộc bị tách quá xa',
  unclear_progression: 'Mạch ý chưa rõ',
  misordered_information: 'Thông tin đặt sai thứ tự',
  backward_dependency: 'Ý sau mới giải thích ý trước',
  missing_bridge: 'Thiếu cầu nối ý',
  logical_jump: 'Nhảy logic',
  hidden_joint_support: 'Hai ý cùng chứng minh nhưng bị giấu',
  result_before_cause: 'Kết quả đứng trước nguyên nhân',
  conclusion_before_evidence: 'Kết luận đứng trước bằng chứng',
  unclear_contrast_turn: 'Chuyển hướng đối lập chưa rõ',
  paragraph_topic_drift: 'Đoạn bị trượt trọng tâm',
  weak_chunk_sequence: 'Chuỗi ý chưa liền mạch',

  // Cohesion: textual glue from the band descriptors.
  cohesive_device_misuse: 'Dùng sai từ nối',
  cohesive_device_overuse: 'Lạm dụng từ nối',
  cohesive_device_omission: 'Thiếu dấu hiệu liên kết',
  mechanical_linking: 'Liên kết máy móc',
  unclear_reference: 'Tham chiếu không rõ',
  inaccurate_reference: 'Tham chiếu sai',
  underused_substitution: 'Thiếu thay thế để tránh lặp',
  inaccurate_substitution: 'Thay thế sai',
  repetitive_reference: 'Tham chiếu/lặp từ gây nặng câu',
  faulty_sentence_link: 'Liên kết trong câu bị lỗi',
  faulty_cross_sentence_link: 'Liên kết giữa câu bị lỗi',
  brand_new_theme: 'Chủ đề mới xuất hiện đột ngột',
  broken_given_new_progression: 'Thông tin cũ và mới nối chưa tự nhiên',
  broken_theme_rheme_chain: 'Mạch chủ đề bị đứt',
  broken_lexical_chain: 'Chuỗi từ vựng liên kết bị đứt',

  // Lexical Resource
  imprecise_word_choice: 'Chọn từ chưa chính xác',
  inappropriate_collocation: 'Collocation chưa tự nhiên',
  awkward_phrase: 'Cụm diễn đạt gượng',
  repetition_limits_range: 'Lặp từ làm hẹp vốn từ',
  wrong_register: 'Sai sắc thái học thuật',
  word_form_error: 'Sai dạng từ',
  spelling_error: 'Sai chính tả',
  memorised_or_formulaic_phrase: 'Cụm công thức/memorised',
  overbroad_academic_wording: 'Từ học thuật quá rộng',
  strong_academic_phrase: 'Cụm học thuật đáng giữ',

  // Grammar
  subject_verb_agreement: 'Sai hòa hợp chủ vị',
  tense_error: 'Sai thì',
  article_error: 'Sai mạo từ',
  preposition_error: 'Sai giới từ',
  clause_boundary_error: 'Ranh giới mệnh đề lỗi',
  sentence_fragment: 'Câu thiếu thành phần',
  run_on_sentence: 'Câu nối tràn',
  modifier_error: 'Bổ nghĩa sai vị trí',
  parallelism_error: 'Sai cấu trúc song song',
  punctuation_error: 'Sai dấu câu',
  complex_structure_breakdown: 'Cấu trúc phức bị gãy',
  controlled_complex_structure: 'Cấu trúc phức kiểm soát tốt',
};

export type AssessmentCriterion =
  | 'task_response'
  | 'coherence'
  | 'cohesion'
  | 'lexical_resource'
  | 'grammatical_range_accuracy';

export interface AssessmentTaxonomyEntry {
  code: string;
  criterion: AssessmentCriterion;
  labelVi: string;
  descriptorFeatureEn: string;
  detectWhen: string;
  excludeWhen: string;
}

/**
 * Prompt-facing handbook. Labels alone are too ambiguous for an LLM: each
 * error needs an observable test and a criterion boundary.
 */
export const ASSESSMENT_TAXONOMY: AssessmentTaxonomyEntry[] = [
  {
    code: 'unclear_position', criterion: 'task_response', labelVi: 'Vị trí chưa rõ',
    descriptorFeatureEn: 'a clear and developed position throughout the response',
    detectWhen: 'The reader cannot state the writer\'s answer, or the stated answer shifts across the essay.',
    excludeWhen: 'The position is clear but one paragraph is badly ordered; that is Coherence.',
  },
  {
    code: 'partial_prompt_coverage', criterion: 'task_response', labelVi: 'Trả lời đề chưa đủ phần',
    descriptorFeatureEn: 'the main parts of the prompt are appropriately addressed',
    detectWhen: 'One explicit task demand, view, question, or required opinion receives no substantive answer.',
    excludeWhen: 'A covered part is merely shorter than another; use unbalanced_coverage only when the imbalance is consequential.',
  },
  {
    code: 'unbalanced_coverage', criterion: 'task_response', labelVi: 'Triển khai mất cân bằng',
    descriptorFeatureEn: 'some parts may be more fully covered than others',
    detectWhen: 'Required parts are present, but one is developed too thinly to function as an adequate answer.',
    excludeWhen: 'A part is absent altogether; use partial_prompt_coverage.',
  },
  {
    code: 'unsupported_comparative_judgment', criterion: 'task_response', labelVi: 'Phép cân chưa được chứng minh',
    descriptorFeatureEn: 'a clear and developed position that directly answers an outweigh task',
    detectWhen: 'The response states which side outweighs the other but never compares their relative scope, severity, duration, reversibility, or significance.',
    excludeWhen: 'The comparison is demonstrated even if the exact phrase "outweigh" is not repeated.',
  },
  {
    code: 'misframed_topic_sentence', criterion: 'task_response', labelVi: 'Câu chủ đề lệch trọng tâm',
    descriptorFeatureEn: 'a clear, developed position that directly answers the task',
    detectWhen: 'The topic sentence promises an argument that does not support the macro position or answer the assigned task demand.',
    excludeWhen: 'The promise is appropriate but its supporting chunks are in the wrong order; that is Coherence.',
  },
  {
    code: 'unclear_paragraph_job', criterion: 'task_response', labelVi: 'Vai trò đoạn chưa rõ',
    descriptorFeatureEn: 'relevant main ideas with a clear focus',
    detectWhen: 'The paragraph contains material but never establishes what proposition the material is meant to prove.',
    excludeWhen: 'The proposition is clear and only a local reference or connective is faulty; that is Cohesion.',
  },
  {
    code: 'underdeveloped_idea', criterion: 'task_response', labelVi: 'Ý chưa phát triển đủ',
    descriptorFeatureEn: 'main ideas are extended and supported; some may be insufficiently developed',
    detectWhen: 'A relevant idea is named but the paragraph does not complete the why, how, condition, or effect needed for it to support the paragraph point.',
    excludeWhen: 'All needed propositions exist but are misplaced; that is Coherence.',
  },
  {
    code: 'missing_mechanism', criterion: 'task_response', labelVi: 'Thiếu cơ chế giải thích',
    descriptorFeatureEn: 'ideas are well extended and supported',
    detectWhen: 'The text asserts A leads to B but omits the intermediate process that makes that relationship testable.',
    excludeWhen: 'The process exists later and only needs relocation; that is Coherence.',
  },
  {
    code: 'unsupported_claim', criterion: 'task_response', labelVi: 'Nhận định thiếu chứng minh',
    descriptorFeatureEn: 'main ideas are supported',
    detectWhen: 'A consequential claim has no reason, explanation, example, or evidence capable of supporting it anywhere in scope.',
    excludeWhen: 'Support exists but appears before or after the wrong proposition; that is Coherence.',
  },
  {
    code: 'overgeneralised_claim', criterion: 'task_response', labelVi: 'Khái quát quá mức',
    descriptorFeatureEn: 'focus and precision may lapse through over-generalisation',
    detectWhen: 'The strength or scope of a claim exceeds what the supplied reasoning can justify.',
    excludeWhen: 'A single adjective is locally inaccurate while the proposition remains valid; that may be Lexical Resource.',
  },
  {
    code: 'missing_qualification', criterion: 'task_response', labelVi: 'Thiếu giới hạn cho nhận định',
    descriptorFeatureEn: 'a relevant, well-developed position with precision',
    detectWhen: 'A defensible claim needs a condition, population, degree, or exception to remain accurate.',
    excludeWhen: 'The intended scope is clear and only article, tense, or preposition is wrong; that is Grammar.',
  },
  {
    code: 'irrelevant_detail', criterion: 'task_response', labelVi: 'Chi tiết lệch trọng tâm',
    descriptorFeatureEn: 'ideas are relevant to the task and paragraph focus',
    detectWhen: 'A chunk does not answer the paragraph promise and cannot serve as necessary context, support, qualification, or consequence.',
    excludeWhen: 'It belongs to the same line of thought but is separated from its partner; that is Coherence.',
  },
  {
    code: 'off_task', criterion: 'task_response', labelVi: 'Ý không trả lời đề',
    descriptorFeatureEn: 'the response directly addresses the requirements of the task',
    detectWhen: 'The proposition answers a different question or changes the task subject.',
    excludeWhen: 'It addresses the task but performs the wrong paragraph role; use irrelevant_detail or misframed_topic_sentence.',
  },
  {
    code: 'weak_example', criterion: 'task_response', labelVi: 'Ví dụ yếu',
    descriptorFeatureEn: 'main ideas are supported with relevant detail',
    detectWhen: 'The example is relevant but too generic, hypothetical, or thin to demonstrate the claimed relationship.',
    excludeWhen: 'The example demonstrates a different claim; use example_mismatch.',
  },
  {
    code: 'example_mismatch', criterion: 'task_response', labelVi: 'Ví dụ lệch chức năng',
    descriptorFeatureEn: 'support is relevant to the main idea',
    detectWhen: 'The example illustrates a different proposition from the one it is presented as supporting.',
    excludeWhen: 'The example supports the right point but is placed too far from it; that is Coherence.',
  },
  {
    code: 'premature_conclusion', criterion: 'task_response', labelVi: 'Kết luận quá sớm',
    descriptorFeatureEn: 'conclusions are justified by developed support',
    detectWhen: 'The paragraph or essay concludes more than its completed development can justify.',
    excludeWhen: 'The necessary grounds exist later and the defect is principally order; use conclusion_before_grounds.',
  },
  {
    code: 'repetitive_argument', criterion: 'task_response', labelVi: 'Lập luận bị lặp',
    descriptorFeatureEn: 'ideas are extended rather than repeated',
    detectWhen: 'A later proposition restates an earlier claim without adding reason, qualification, evidence, or consequence.',
    excludeWhen: 'The repetition is only lexical wording while the proposition advances; that may be Lexical Resource or Cohesion.',
  },
  {
    code: 'insufficient_extension', criterion: 'task_response', labelVi: 'Triển khai chưa đủ sâu',
    descriptorFeatureEn: 'main ideas are sufficiently extended and supported',
    detectWhen: 'The paragraph contains some support but stops before the chain can establish the promised conclusion.',
    excludeWhen: 'A specific causal middle step is absent; prefer missing_mechanism.',
  },
  {
    code: 'internal_contradiction', criterion: 'task_response', labelVi: 'Lập luận tự mâu thuẫn',
    descriptorFeatureEn: 'a clear and consistent position',
    detectWhen: 'Two propositions in the writer\'s own case cannot both be accepted without qualification.',
    excludeWhen: 'The paragraph fairly presents an opposing view before rebutting it.',
  },

  {
    code: 'joint_causes_as_chain', criterion: 'coherence', labelVi: 'Hai cơ sở bị viết thành một chuỗi',
    descriptorFeatureEn: 'information and ideas are logically sequenced',
    detectWhen: 'Two independent grounds answer the same paragraph question but the written order implies that one causes the other.',
    excludeWhen: 'One ground genuinely causes the next; then the chain is valid.',
  },
  {
    code: 'cause_result_reversed', criterion: 'coherence', labelVi: 'Nguyên nhân và kết quả bị đảo',
    descriptorFeatureEn: 'a clear overall progression that can be followed with ease',
    detectWhen: 'The reader encounters a result, decision, or evaluation before the cause that makes it intelligible.',
    excludeWhen: 'A deliberate thesis previews a later argument without claiming the proof is already complete.',
  },
  {
    code: 'interleaved_parallel_chains', criterion: 'coherence', labelVi: 'Hai mạch ý song song bị đan xen',
    descriptorFeatureEn: 'ideas are logically sequenced with clear progression',
    detectWhen: 'Chunks answering two different paragraph questions alternate instead of completing one line before the other.',
    excludeWhen: 'The alternation is an explicit point-by-point comparison and each contrast pair is complete.',
  },
  {
    code: 'conclusion_before_grounds', criterion: 'coherence', labelVi: 'Kết luận đứng trước cơ sở chứng minh',
    descriptorFeatureEn: 'the message can be followed with ease',
    detectWhen: 'A local conclusion appears before the existing grounds that justify it, forcing retrospective reconstruction.',
    excludeWhen: 'The grounds do not exist anywhere; that is unsupported_claim or premature_conclusion under Task Response.',
  },
  {
    code: 'separated_dependent_chunks', criterion: 'coherence', labelVi: 'Hai ý phụ thuộc bị tách quá xa',
    descriptorFeatureEn: 'a clear and logical progression of ideas',
    detectWhen: 'An explanation, qualification, result, or completion is separated from the idea it directly completes by unrelated material.',
    excludeWhen: 'The missing partner does not exist; that is Task Response, not relocation.',
  },
  {
    code: 'missing_bridge', criterion: 'coherence', labelVi: 'Thiếu cầu nối ý',
    descriptorFeatureEn: 'relationships between ideas are clear',
    detectWhen: 'Two existing idea groups are both relevant but their relationship cannot be inferred from the propositions or textual signals.',
    excludeWhen: 'The absent content is a new reason or mechanism needed to prove the claim; that is Task Response.',
  },
  {
    code: 'unclear_contrast_turn', criterion: 'coherence', labelVi: 'Chuyển hướng đối lập chưa rõ',
    descriptorFeatureEn: 'ideas are logically organised and relationships are clear',
    detectWhen: 'A contrast or concession has no identifiable target, so the reader cannot tell which proposition is being limited or opposed.',
    excludeWhen: 'The target is clear but the connective itself is grammatically or semantically wrong; that is Cohesion.',
  },
  {
    code: 'unclear_progression', criterion: 'coherence', labelVi: 'Mạch ý chưa rõ',
    descriptorFeatureEn: 'there is a clear overall progression',
    detectWhen: 'The paragraph contains multiple order/relationship failures but no more specific canonical pattern describes the combined effect.',
    excludeWhen: 'A canonical pattern applies; use the specific code instead.',
  },

  {
    code: 'cohesive_device_misuse', criterion: 'cohesion', labelVi: 'Dùng sai từ nối',
    descriptorFeatureEn: 'cohesive devices are used accurately and flexibly',
    detectWhen: 'The connective explicitly signals a relationship that the surrounding propositions do not have.',
    excludeWhen: 'The relationship itself is missing because content is absent; that is Task Response or Coherence.',
  },
  {
    code: 'cohesive_device_overuse', criterion: 'cohesion', labelVi: 'Lạm dụng từ nối',
    descriptorFeatureEn: 'cohesion rarely attracts attention and is not mechanical',
    detectWhen: 'Repeated explicit connectives make relationships mechanical or redundant rather than easier to follow.',
    excludeWhen: 'Repeated wording, not linking devices, limits vocabulary; that is Lexical Resource.',
  },
  {
    code: 'cohesive_device_omission', criterion: 'cohesion', labelVi: 'Thiếu dấu hiệu liên kết',
    descriptorFeatureEn: 'relationships are signalled clearly where needed',
    detectWhen: 'The propositions have an inferable relationship but the local transition is ambiguous without a textual signal.',
    excludeWhen: 'No logical relationship exists until new content is added; that is not a cohesion fix.',
  },
  {
    code: 'mechanical_linking', criterion: 'cohesion', labelVi: 'Liên kết máy móc',
    descriptorFeatureEn: 'cohesion is well managed rather than faulty or mechanical',
    detectWhen: 'Devices are applied as a formula and do not accurately reflect the semantic relationship.',
    excludeWhen: 'The device is accurate and merely frequent; use overuse only if it noticeably attracts attention.',
  },
  {
    code: 'unclear_reference', criterion: 'cohesion', labelVi: 'Tham chiếu không rõ',
    descriptorFeatureEn: 'referencing is clear and appropriate',
    detectWhen: 'A pronoun or referring expression has two plausible antecedents or none that the reader can identify.',
    excludeWhen: 'The antecedent is clear but factually wrong; use inaccurate_reference.',
  },
  {
    code: 'inaccurate_reference', criterion: 'cohesion', labelVi: 'Tham chiếu sai',
    descriptorFeatureEn: 'referencing is accurate',
    detectWhen: 'The referring expression points to the wrong entity, number, event, or proposition.',
    excludeWhen: 'The grammar of the pronoun is wrong but its referent remains clear; that may be Grammar.',
  },
  {
    code: 'underused_substitution', criterion: 'cohesion', labelVi: 'Thiếu thay thế để tránh lặp',
    descriptorFeatureEn: 'substitution is used appropriately',
    detectWhen: 'Needless repetition makes the text heavy and an unambiguous substitute would preserve meaning.',
    excludeWhen: 'Repeating the key term is necessary for lexical cohesion or precision.',
  },
  {
    code: 'inaccurate_substitution', criterion: 'cohesion', labelVi: 'Thay thế sai',
    descriptorFeatureEn: 'substitution is accurate and appropriate',
    detectWhen: 'A substitute changes the referent or scope of the original expression.',
    excludeWhen: 'The substitute is semantically accurate but stylistically awkward; that may be Lexical Resource.',
  },
  {
    code: 'repetitive_reference', criterion: 'cohesion', labelVi: 'Tham chiếu hoặc lặp từ gây nặng câu',
    descriptorFeatureEn: 'referencing and repetition support cohesion without attracting attention',
    detectWhen: 'Repeated naming of the same participant or proposition obstructs local flow.',
    excludeWhen: 'Repetition limits vocabulary across the essay; that is Lexical Resource.',
  },
  {
    code: 'brand_new_theme', criterion: 'cohesion', labelVi: 'Chủ đề mới xuất hiện đột ngột',
    descriptorFeatureEn: 'given and new information progress clearly across sentences',
    detectWhen: 'A sentence begins from a new theme that has no recoverable link to the preceding discourse.',
    excludeWhen: 'The idea is linked but placed in the wrong reasoning sequence; that is Coherence.',
  },
  {
    code: 'broken_given_new_progression', criterion: 'cohesion', labelVi: 'Thông tin cũ và mới nối chưa tự nhiên',
    descriptorFeatureEn: 'cohesion within and between sentences supports progression',
    detectWhen: 'New information is introduced before the shared/given element that would let the reader attach it.',
    excludeWhen: 'The propositions themselves are in the wrong causal/evidential order; that is Coherence.',
  },
  {
    code: 'broken_theme_rheme_chain', criterion: 'cohesion', labelVi: 'Mạch chủ đề bị đứt',
    descriptorFeatureEn: 'information moves coherently from sentence to sentence',
    detectWhen: 'A preceding rheme is not picked up or transformed into a recoverable next theme, causing a local discourse break.',
    excludeWhen: 'The topic changes because the content is irrelevant; that is Task Response.',
  },
  {
    code: 'broken_lexical_chain', criterion: 'cohesion', labelVi: 'Chuỗi từ vựng liên kết bị đứt',
    descriptorFeatureEn: 'lexical cohesion makes relationships recoverable',
    detectWhen: 'Related ideas use wording that does not preserve a clear semantic chain for the reader.',
    excludeWhen: 'A word is simply inaccurate or an unnatural collocation; that is Lexical Resource.',
  },
  {
    code: 'faulty_sentence_link', criterion: 'cohesion', labelVi: 'Liên kết trong câu bị lỗi',
    descriptorFeatureEn: 'cohesion within sentences is accurate',
    detectWhen: 'A clause-level linker creates an incorrect or ambiguous semantic relation inside one sentence.',
    excludeWhen: 'The clause boundary itself is ungrammatical; that is Grammar.',
  },
  {
    code: 'faulty_cross_sentence_link', criterion: 'cohesion', labelVi: 'Liên kết giữa câu bị lỗi',
    descriptorFeatureEn: 'cohesion between sentences is accurate',
    detectWhen: 'A cross-sentence link misstates how two adjacent propositions relate.',
    excludeWhen: 'They are non-adjacent because of ordering; that is Coherence.',
  },

  {
    code: 'imprecise_word_choice', criterion: 'lexical_resource', labelVi: 'Chọn từ chưa chính xác',
    descriptorFeatureEn: 'vocabulary is used precisely and appropriately',
    detectWhen: 'Replacing the smallest local word or phrase corrects meaning without changing the intended argument.',
    excludeWhen: 'The phrase names a weak or wrong proposition and replacement would change the argument; that is Task Response.',
  },
  {
    code: 'inappropriate_collocation', criterion: 'lexical_resource', labelVi: 'Collocation chưa tự nhiên',
    descriptorFeatureEn: 'collocation is natural and appropriate',
    detectWhen: 'The word combination is non-idiomatic or inappropriate in context and has a local replacement.',
    excludeWhen: 'The wording is natural but the idea is logically weak.',
  },
  {
    code: 'awkward_phrase', criterion: 'lexical_resource', labelVi: 'Cụm diễn đạt gượng',
    descriptorFeatureEn: 'lexical choices are flexible and natural',
    detectWhen: 'A locally editable phrase is understandable but unnatural enough to impede precision or fluency.',
    excludeWhen: 'The whole sentence must be re-reasoned; that is not a local lexical edit.',
  },
  {
    code: 'repetition_limits_range', criterion: 'lexical_resource', labelVi: 'Lặp từ làm hẹp vốn từ',
    descriptorFeatureEn: 'a sufficiently wide resource permits flexibility and precision',
    detectWhen: 'Avoidable repetition across the response noticeably restricts lexical range.',
    excludeWhen: 'Repetition is needed for cohesion or exact topic reference.',
  },
  {
    code: 'wrong_register', criterion: 'lexical_resource', labelVi: 'Sai sắc thái học thuật',
    descriptorFeatureEn: 'style and word choice are appropriate for the task',
    detectWhen: 'A local expression is too informal, emotive, absolute, or otherwise mismatched to academic argument.',
    excludeWhen: 'The claim itself is overgeneralised; do not hide a Task Response issue as register.',
  },
  {
    code: 'word_form_error', criterion: 'lexical_resource', labelVi: 'Sai dạng từ',
    descriptorFeatureEn: 'word formation is accurate',
    detectWhen: 'The lexical root is suitable but the noun/verb/adjective/adverb form is wrong.',
    excludeWhen: 'The form is grammatically acceptable but the lexical item is semantically wrong.',
  },
  {
    code: 'spelling_error', criterion: 'lexical_resource', labelVi: 'Sai chính tả',
    descriptorFeatureEn: 'spelling errors are rare and do not impede communication',
    detectWhen: 'The source contains a genuine spelling error.',
    excludeWhen: 'British/American variants are both acceptable.',
  },
  {
    code: 'memorised_or_formulaic_phrase', criterion: 'lexical_resource', labelVi: 'Cụm công thức hoặc học thuộc',
    descriptorFeatureEn: 'vocabulary is flexible rather than memorised or formulaic',
    detectWhen: 'A stock phrase is imprecise, poorly fitted, or disproportionately ornate in this context.',
    excludeWhen: 'A conventional academic phrase fits naturally and precisely.',
  },
  {
    code: 'overbroad_academic_wording', criterion: 'lexical_resource', labelVi: 'Từ học thuật quá rộng',
    descriptorFeatureEn: 'lexical choices convey precise meanings',
    detectWhen: 'A broad academic term has a local, more exact replacement while preserving the same proposition.',
    excludeWhen: 'Precision requires adding an omitted reason or consequence; that is Task Response.',
  },

  {
    code: 'subject_verb_agreement', criterion: 'grammatical_range_accuracy', labelVi: 'Sai hòa hợp chủ vị',
    descriptorFeatureEn: 'grammar is accurate and error-free sentences are frequent',
    detectWhen: 'Subject number/person and finite verb do not agree.', excludeWhen: 'The apparent mismatch is licensed by the actual head noun.',
  },
  {
    code: 'tense_error', criterion: 'grammatical_range_accuracy', labelVi: 'Sai thì',
    descriptorFeatureEn: 'tense is used accurately',
    detectWhen: 'The tense/aspect conflicts with the intended time or discourse relation.', excludeWhen: 'A different tense is stylistically possible without changing accuracy.',
  },
  {
    code: 'article_error', criterion: 'grammatical_range_accuracy', labelVi: 'Sai mạo từ',
    descriptorFeatureEn: 'articles are used accurately',
    detectWhen: 'An article is missing, unnecessary, or incorrect for countability/definiteness.', excludeWhen: 'Zero article is licensed.',
  },
  {
    code: 'preposition_error', criterion: 'grammatical_range_accuracy', labelVi: 'Sai giới từ',
    descriptorFeatureEn: 'prepositions are used accurately',
    detectWhen: 'The selected or omitted preposition is grammatically incorrect.', excludeWhen: 'The alternative is a regional or acceptable variant.',
  },
  {
    code: 'clause_boundary_error', criterion: 'grammatical_range_accuracy', labelVi: 'Ranh giới mệnh đề lỗi',
    descriptorFeatureEn: 'sentence forms and punctuation are well controlled',
    detectWhen: 'Clauses are joined or separated in a grammatically invalid way.', excludeWhen: 'The grammar is valid but the semantic link is wrong; that is Cohesion.',
  },
  {
    code: 'sentence_fragment', criterion: 'grammatical_range_accuracy', labelVi: 'Câu thiếu thành phần',
    descriptorFeatureEn: 'sentence forms are complete and accurate',
    detectWhen: 'A purported sentence lacks a required main clause or constituent.', excludeWhen: 'A deliberate minor sentence is contextually acceptable.',
  },
  {
    code: 'run_on_sentence', criterion: 'grammatical_range_accuracy', labelVi: 'Câu nối tràn',
    descriptorFeatureEn: 'complex structures are controlled',
    detectWhen: 'Independent clauses are joined without valid coordination, subordination, or punctuation.', excludeWhen: 'A long sentence is structurally valid.',
  },
  {
    code: 'modifier_error', criterion: 'grammatical_range_accuracy', labelVi: 'Bổ nghĩa sai vị trí',
    descriptorFeatureEn: 'complex structures are accurate',
    detectWhen: 'A modifier attaches grammatically to the wrong element or dangles.', excludeWhen: 'Its attachment is clear and only the proposition is implausible.',
  },
  {
    code: 'parallelism_error', criterion: 'grammatical_range_accuracy', labelVi: 'Sai cấu trúc song song',
    descriptorFeatureEn: 'a range of structures is used accurately',
    detectWhen: 'Coordinated items do not share a grammatically compatible form.', excludeWhen: 'The semantic items differ but grammar remains valid.',
  },
  {
    code: 'punctuation_error', criterion: 'grammatical_range_accuracy', labelVi: 'Sai dấu câu',
    descriptorFeatureEn: 'punctuation is well controlled',
    detectWhen: 'Punctuation violates sentence structure or obscures the intended boundary.', excludeWhen: 'The difference is optional style.',
  },
  {
    code: 'complex_structure_breakdown', criterion: 'grammatical_range_accuracy', labelVi: 'Cấu trúc phức bị gãy',
    descriptorFeatureEn: 'complex structures are used with flexibility and accuracy',
    detectWhen: 'A complex construction contains interacting grammatical errors that cannot be represented by one narrower code.', excludeWhen: 'A narrower grammar code fully explains the error.',
  },
];

export const TAXONOMY_BY_CODE = new Map(ASSESSMENT_TAXONOMY.map(entry => [entry.code, entry]));

export function taxonomyEntries(criteria: AssessmentCriterion[]) {
  const allowed = new Set(criteria);
  return ASSESSMENT_TAXONOMY.filter(entry => allowed.has(entry.criterion));
}

export function taxonomyPrompt(criteria: AssessmentCriterion[]) {
  return taxonomyEntries(criteria)
    .map(entry => [
      `${entry.code}=${entry.labelVi}`,
      `Descriptor basis: ${entry.descriptorFeatureEn}.`,
      `Use when: ${entry.detectWhen}`,
      `Do not use when: ${entry.excludeWhen}`,
    ].join(' '))
    .join('\n');
}

export function isTaxonomyCodeFor(code: string | undefined, criteria: AssessmentCriterion[]) {
  if (!code) return false;
  const entry = TAXONOMY_BY_CODE.get(code);
  return Boolean(entry && criteria.includes(entry.criterion));
}

export function errorLabelVi(errorCode?: string, fallback = 'Điểm cần sửa') {
  if (!errorCode) return fallback;
  return ERROR_LABELS_VI[errorCode] || fallback;
}

export function inferTaskErrorCode(type?: string, title = '', message = '') {
  const haystack = `${type || ''} ${title} ${message}`.toLowerCase();
  if (haystack.includes('missing_bridge')) return 'missing_bridge';
  if (haystack.includes('misordered') || haystack.includes('thứ tự')) return 'misordered_information';
  if (haystack.includes('unsupported')) return 'unsupported_claim';
  if (haystack.includes('overclaim') || haystack.includes('highly effective') || haystack.includes('quá mức')) return 'overgeneralised_claim';
  if (haystack.includes('topic sentence') || haystack.includes('thesis') || haystack.includes('claim') || haystack.includes('trọng tâm')) return 'misframed_topic_sentence';
  if (haystack.includes('example') || haystack.includes('ví dụ')) return 'example_mismatch';
  if (haystack.includes('conclusion') || haystack.includes('kết luận')) return 'premature_conclusion';
  if (haystack.includes('weak_support') || haystack.includes('underdevelop') || haystack.includes('chưa được giải thích')) return 'underdeveloped_idea';
  if (haystack.includes('logical_jump')) return 'logical_jump';
  return 'underdeveloped_idea';
}

export function inferCoherenceErrorCode(type?: string, title = '', diagnosticPattern?: string) {
  if (diagnosticPattern && diagnosticPattern !== 'other') {
    if (diagnosticPattern === 'joint_support_hidden') return 'joint_causes_as_chain';
    if (diagnosticPattern === 'contrast_turn_unclear') return 'unclear_contrast_turn';
    if (diagnosticPattern === 'result_before_cause') return 'cause_result_reversed';
    if (diagnosticPattern === 'conclusion_before_evidence') return 'conclusion_before_grounds';
    if (diagnosticPattern === 'motivation_after_decision' || diagnosticPattern === 'background_after_result' || diagnosticPattern === 'backward_dependency') {
      return 'separated_dependent_chunks';
    }
    return diagnosticPattern;
  }

  const haystack = `${type || ''} ${title}`.toLowerCase();
  if (haystack.includes('bridge')) return 'missing_bridge';
  if (haystack.includes('jump')) return 'logical_jump';
  if (haystack.includes('order') || haystack.includes('thứ tự')) return 'misordered_information';
  if (haystack.includes('conclusion')) return 'conclusion_before_grounds';
  if (haystack.includes('result')) return 'cause_result_reversed';
  return 'unclear_progression';
}

export function inferLanguageErrorCode(highlightType = '', label = '', criterion?: 'lexical' | 'grammar') {
  const haystack = `${highlightType} ${label}`.toLowerCase();
  if (criterion === 'lexical') {
    if (haystack.includes('collocation')) return 'inappropriate_collocation';
    if (haystack.includes('repetition')) return 'repetition_limits_range';
    if (haystack.includes('register')) return 'wrong_register';
    if (haystack.includes('word_form')) return 'word_form_error';
    if (haystack.includes('spelling')) return 'spelling_error';
    if (haystack.includes('strong') || haystack.includes('strength')) return 'strong_academic_phrase';
    if (haystack.includes('precision') || haystack.includes('broad')) return 'imprecise_word_choice';
    return 'imprecise_word_choice';
  }

  if (haystack.includes('agreement')) return 'subject_verb_agreement';
  if (haystack.includes('tense')) return 'tense_error';
  if (haystack.includes('article')) return 'article_error';
  if (haystack.includes('preposition')) return 'preposition_error';
  if (haystack.includes('clause')) return 'clause_boundary_error';
  if (haystack.includes('fragment')) return 'sentence_fragment';
  if (haystack.includes('run')) return 'run_on_sentence';
  if (haystack.includes('punctuation')) return 'punctuation_error';
  if (haystack.includes('strength')) return 'controlled_complex_structure';
  if (haystack.includes('complex')) return 'complex_structure_breakdown';
  return 'complex_structure_breakdown';
}

export function commentScaffoldCue(index: number, errorLabel: string, positive = false) {
  const noun = positive ? 'điểm' : 'lỗi';
  const prompts = [
    `Hãy bắt đầu bằng cách nhìn vào evidence được highlight: bạn thử tìm xem ${noun} “${errorLabel}” nằm ở đâu trước khi đọc giải thích.`,
    `Tiếp nhé, giờ nhìn sang phần evidence này và tự hỏi: vì sao nó bị gọi là “${errorLabel}”?`,
    `Ok, ở điểm này hãy nhìn kỹ phần được đánh dấu trước: dấu hiệu nào cho thấy “${errorLabel}”?`,
    `Một bước nữa: nhìn vào node/span này và thử nối nó với mục đích của đoạn trước khi đọc phần phân tích.`,
  ];
  return prompts[index % prompts.length];
}
