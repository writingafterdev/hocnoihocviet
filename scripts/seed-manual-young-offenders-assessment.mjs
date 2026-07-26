const taskId = 'p1-young-offenders';
const prompt = 'Young people who commit crimes should be treated the same way as adults. To what extent do you agree or disagree with this statement?';

const introduction = `Some people propose that young offenders should face the same legal consequences as their adult counterparts, regardless of age. I disagree with this proposal, despite acknowledging the reasons for it.`;
const body1 = `Those who support treating young offenders like adults often emphasize that it serves as a strong deterrent. Harsher penalties, they believe, will instill fear and discourage juveniles from engaging in criminal activities. For example, proponents might argue that a teenager committing a serious crime, such as robbery or assault, should face the same severe consequences as an adult to understand the gravity of their actions. They claim that equal treatment ensures justice for victims and maintains social order.`;
const body2 = `However, this perspective overlooks the fact that juveniles are fundamentally different from adults in terms of cognitive and emotional development. Scientific research has shown that the brains of young people are not fully developed, particularly in areas responsible for impulse control and decision-making. This immaturity often leads to poor judgment and a lack of foresight regarding the repercussions of their actions. Applying adult-level punishments for juveniles fails to account for these developmental differences and may result in unjustly harsh punishments that do not align with the offenders' capacity for rehabilitation.`;
const body3 = `Moreover, the primary focus of juvenile justice should be rehabilitation rather than punishment. Young offenders have a higher potential for change and reformation if given appropriate guidance and support. Programs that focus on education, counseling, and community service can help redirect juveniles towards a productive path, reducing the likelihood of reoffending. Treating young offenders like adults often places them in environments that are more likely to reinforce criminal behavior rather than correct it.`;
const conclusion = `In conclusion, while equal treatment of young and adult offenders might seem like a straightforward approach to justice, it fails to consider the unique needs and potential for rehabilitation among juveniles. A justice system that recognizes these differences and focuses on rehabilitation will be more effective in promoting long-term societal well-being and reducing crime.`;
const essay = [introduction, body1, body2, body3, conclusion].join('\n\n');

function locate(sourceText, from = 0) {
  const startChar = essay.indexOf(sourceText, from);
  if (startChar < 0) throw new Error(`Missing source text: ${sourceText}`);
  return { startChar, endChar: startChar + sourceText.length, sourceText };
}

function anchor(criterion, featureCode, featureEn) {
  return { criterion, featureCode, featureEn };
}

function refs(...items) {
  return items.map(([kind, id, label]) => ({ kind, id, label }));
}

function evidence(sourceText, role, nodeId) {
  return { ...locate(sourceText), role, nodeId };
}

function nodeReview(nodeId, status, job, assessment, issues = []) {
  return { nodeId, status, job, assessment, issues };
}

function errorFromIssue(item) {
  const firstAction = item.solutionActions?.[0];
  return {
    type: item.type === 'relational' || item.type === 'wrong_relationship' ? 'relational' : 'internal',
    errorCode: item.errorCode,
    errorLabelVi: item.errorLabelVi,
    message: item.title,
    explanation: item.impactOnPurpose,
    suggestion: firstAction?.details,
    affectedNodes: item.affectedNodes,
    proposedFix: firstAction ? {
      type: firstAction.type === 'rewrite_node' ? 'rewrite' : 'add_node',
      details: firstAction.details,
      proposedText: firstAction.proposedText,
      whyBetter: firstAction.whyBetter,
    } : undefined,
    comment: item.comment,
    evidenceSpans: item.evidenceSpans,
    nodeLinks: item.nodeLinks,
    descriptorAnchor: item.descriptorAnchor,
  };
}

function makeChunk(paragraphIndex, index, sourceSentenceIndex, sourceText, role, simplifiedIdea, errors = []) {
  const nodeId = `sentence-${paragraphIndex}-${index}`;
  return {
    index,
    nodeId,
    sourceSentenceIndex,
    chunkIndex: index,
    ...locate(sourceText),
    role,
    simplifiedIdea,
    errors,
    review: nodeReview(
      nodeId,
      errors.length ? 'weak' : 'works',
      simplifiedIdea,
      errors.length ? errors[0].message : '',
      [],
    ),
    transitionToNext: 'NONE',
  };
}

function makeParagraph(index, label, job, text, sentences, errors = []) {
  const paragraphRange = locate(text);
  return {
    index,
    label,
    job,
    paragraphStartChar: paragraphRange.startChar,
    paragraphEndChar: paragraphRange.endChar,
    errors,
    review: nodeReview(`para-${index}`, errors.length ? 'weak' : 'works', job, errors[0]?.message || '', []),
    sentences,
    transitionToNext: 'NONE',
  };
}

const deterrenceExampleIssue = {
  id: 'issue:body1-example-shifts-purpose',
  errorCode: 'example_mismatch',
  errorLabelVi: 'Ví dụ lệch chức năng',
  type: 'weak_support',
  title: 'Ví dụ chuyển từ deterrence sang punishment after the crime',
  whyWrong: 'Đoạn đang cần chứng minh adult punishment ngăn young people phạm tội. Tuy nhiên, ví dụ lại tập trung vào việc một teenager đã phạm robbery hoặc assault phải chịu hình phạt nặng để “understand the gravity” của hành vi.',
  impactOnPurpose: 'Ví dụ này giải thích punishment có thể dạy người đã phạm tội một bài học, nhưng chưa trực tiếp chứng minh nỗi sợ hình phạt ngăn hành vi phạm tội trước khi nó xảy ra.',
  impactOnReader: 'Người đọc phải tự đổi mục tiêu của ví dụ từ individual accountability sang general deterrence.',
  affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 1 }, { paraIndex: 1, sentenceIndex: 4 }] },
  solutionActions: [{
    type: 'rewrite_node',
    label: 'Cho ví dụ chứng minh đúng deterrence',
    details: 'Đổi trọng tâm sang việc publicity and certainty of adult-level penalties affect other teenagers before they offend.',
    targetNodeId: 'sentence-1-4',
    proposedText: 'For example, proponents might argue that publicising adult-level penalties for serious juvenile offences such as robbery or assault would make other teenagers less willing to take the same risk.',
    whyBetter: 'Bản sửa giữ nguyên opposing argument nhưng làm ví dụ trực tiếp chứng minh deterrence thay vì chuyển sang rehabilitation or retribution after the offence.',
  }],
  comment: {
    bodyVi: 'Bạn thử đối chiếu hai phần được đánh dấu: đoạn hứa chứng minh **deterrence**, nhưng ví dụ lại nói người đã phạm tội cần hiểu mức độ nghiêm trọng của hành vi. Như vậy ví dụ đang giải thích punishment sau khi crime xảy ra, chưa cho thấy hình phạt ngăn những người khác phạm tội từ đầu.',
    solutionBodyVi: 'Bản sửa chuyển đối tượng sang **other teenagers** và cho thấy adult-level penalties ảnh hưởng tới quyết định của họ trước khi hành vi xảy ra.',
    references: refs(
      ['node', 'sentence-1-1', 'Deterrence claim'],
      ['node', 'sentence-1-4', 'Robbery or assault example'],
    ),
  },
  evidenceSpans: [
    evidence('serves as a strong deterrent', 'context', 'sentence-1-1'),
    evidence('a teenager committing a serious crime, such as robbery or assault, should face the same severe consequences as an adult to understand the gravity of their actions', 'primary', 'sentence-1-4'),
  ],
  nodeLinks: { primaryNodeIds: ['sentence-1-4'], contextNodeIds: ['sentence-1-1', 'sentence-1-2', 'sentence-1-3'] },
  descriptorAnchor: anchor('task_response', 'example_mismatch', 'support is relevant to the main idea'),
};

const undevelopedJusticeIssue = {
  id: 'issue:body1-new-rationales-undeveloped',
  errorCode: 'insufficient_extension',
  errorLabelVi: 'Triển khai chưa đủ sâu',
  type: 'weak_support',
  title: 'Hai lý do mới xuất hiện ở cuối đoạn nhưng chưa được phát triển',
  whyWrong: 'Câu cuối bổ sung “justice for victims” và “social order”. Đây là hai lý do khác với deterrence, nhưng đoạn không giải thích equal treatment tạo justice cho victims hay duy trì social order bằng cách nào.',
  impactOnPurpose: 'Vì hai lý do chỉ được nêu tên, chúng chưa tăng sức nặng thực sự cho opposing view.',
  impactOnReader: 'Người đọc nhận được thêm hai kết luận nhưng không có đường lập luận để đánh giá chúng.',
  affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 5 }, { paraIndex: 1, sentenceIndex: 6 }] },
  solutionActions: [{
    type: 'rewrite_node',
    label: 'Giữ một lý do và nói rõ quan hệ của nó',
    details: 'Giữ justice for victims như một supporting rationale, rồi nói rõ why equal penalties may be perceived as proportionate for equally serious harm.',
    targetNodeId: 'sentence-1-5',
    proposedText: 'They also argue that comparable penalties recognise the seriousness of the harm suffered by victims, regardless of the offender\'s age.',
    whyBetter: 'Bản sửa phát triển một rationale có thể kiểm tra thay vì chỉ liệt kê hai abstract outcomes ở cuối đoạn.',
  }],
  comment: {
    bodyVi: 'Tiếp nhé, câu cuối mở thêm **justice for victims** và **social order**. Cả hai đều có thể là lý do hợp lệ, nhưng ở đây chúng mới chỉ được gọi tên. Để đoạn không biến thành một danh sách, bạn nên giữ một lý do và nói rõ equal treatment tạo ra kết quả đó như thế nào.',
    solutionBodyVi: 'Bản sửa giữ **justice for victims** và chỉ ra quan hệ cụ thể: mức phạt tương đương được xem là phản ánh mức độ nghiêm trọng của harm.',
    references: refs(
      ['node', 'sentence-1-5', 'Justice for victims'],
      ['node', 'sentence-1-6', 'Social order'],
    ),
  },
  evidenceSpans: [
    evidence('equal treatment ensures justice for victims', 'primary', 'sentence-1-5'),
    evidence('maintains social order', 'affected', 'sentence-1-6'),
  ],
  nodeLinks: { primaryNodeIds: ['sentence-1-5'], affectedNodeIds: ['sentence-1-6'] },
  descriptorAnchor: anchor('task_response', 'insufficient_extension', 'main ideas are sufficiently extended and supported'),
};

const deterrenceError = errorFromIssue(deterrenceExampleIssue);
const justiceError = errorFromIssue(undevelopedJusticeIssue);

const introChunks = [
  makeChunk(0, 1, 1, 'Some people propose that young offenders should face the same legal consequences as their adult counterparts, regardless of age.', 'setup', 'Nêu đề xuất đối xử young offenders giống adults'),
  makeChunk(0, 2, 2, 'I disagree with this proposal, despite acknowledging the reasons for it.', 'final_stance', 'Nêu lập trường phản đối có nhượng bộ'),
];

const body1Chunks = [
  makeChunk(1, 1, 1, 'Those who support treating young offenders like adults often emphasize that it serves as a strong deterrent.', 'claim', 'Opposing view: equal treatment creates deterrence'),
  makeChunk(1, 2, 2, 'Harsher penalties, they believe, will instill fear', 'reason', 'Harsher penalties create fear'),
  makeChunk(1, 3, 2, 'discourage juveniles from engaging in criminal activities.', 'mechanism', 'Fear discourages juvenile offending'),
  makeChunk(1, 4, 3, 'For example, proponents might argue that a teenager committing a serious crime, such as robbery or assault, should face the same severe consequences as an adult to understand the gravity of their actions.', 'example', 'Serious juvenile offenders receive adult consequences', [deterrenceError]),
  makeChunk(1, 5, 4, 'equal treatment ensures justice for victims', 'reason', 'Equal treatment is presented as justice for victims', [justiceError]),
  makeChunk(1, 6, 4, 'maintains social order.', 'reason', 'Equal treatment is presented as maintaining social order'),
];

const body2Chunks = [
  makeChunk(2, 1, 1, 'juveniles are fundamentally different from adults in terms of cognitive and emotional development.', 'claim', 'Juveniles differ developmentally from adults'),
  makeChunk(2, 2, 2, 'the brains of young people are not fully developed', 'reason', 'Young brains are not fully developed'),
  makeChunk(2, 3, 2, 'particularly in areas responsible for impulse control and decision-making.', 'explanation', 'Development affects impulse control and decisions'),
  makeChunk(2, 4, 3, 'This immaturity often leads to poor judgment', 'mechanism', 'Immaturity produces poor judgment'),
  makeChunk(2, 5, 3, 'a lack of foresight regarding the repercussions of their actions.', 'mechanism', 'Immaturity reduces foresight'),
  makeChunk(2, 6, 4, 'Applying adult-level punishments for juveniles fails to account for these developmental differences', 'mini_conclusion', 'Adult punishment ignores developmental differences'),
  makeChunk(2, 7, 4, 'may result in unjustly harsh punishments', 'mini_conclusion', 'Ignoring differences can create disproportionate punishment'),
  makeChunk(2, 8, 4, "do not align with the offenders' capacity for rehabilitation.", 'mini_conclusion', 'Punishment may conflict with rehabilitation potential'),
];

const body3Chunks = [
  makeChunk(3, 1, 1, 'the primary focus of juvenile justice should be rehabilitation rather than punishment.', 'claim', 'Juvenile justice should prioritise rehabilitation'),
  makeChunk(3, 2, 2, 'Young offenders have a higher potential for change and reformation', 'reason', 'Young offenders have strong potential for reform'),
  makeChunk(3, 3, 2, 'if given appropriate guidance and support.', 'explanation', 'Guidance and support enable change'),
  makeChunk(3, 4, 3, 'Programs that focus on education, counseling, and community service can help redirect juveniles towards a productive path', 'mechanism', 'Support programmes redirect behaviour'),
  makeChunk(3, 5, 3, 'reducing the likelihood of reoffending.', 'mini_conclusion', 'Rehabilitation can reduce reoffending'),
  makeChunk(3, 6, 4, 'Treating young offenders like adults often places them in environments that are more likely to reinforce criminal behavior rather than correct it.', 'contrast', 'Adult environments may reinforce criminal behaviour'),
];

const conclusionChunks = [
  makeChunk(4, 1, 1, 'equal treatment of young and adult offenders might seem like a straightforward approach to justice', 'concession', 'Acknowledges the appeal of equal treatment'),
  makeChunk(4, 2, 1, 'it fails to consider the unique needs and potential for rehabilitation among juveniles.', 'final_stance', 'Equal treatment ignores juvenile differences'),
  makeChunk(4, 3, 2, 'A justice system that recognizes these differences and focuses on rehabilitation will be more effective in promoting long-term societal well-being and reducing crime.', 'final_stance', 'Rehabilitation-focused justice is the preferred approach'),
];

const lexicalOne = {
  ...locate("align with the offenders' capacity for rehabilitation"),
  sourceText: "align with the offenders' capacity for rehabilitation",
  errorCode: 'inappropriate_collocation',
  errorLabelVi: 'Collocation chưa tự nhiên',
  highlightType: 'inappropriate_collocation',
  label: 'Collocation chưa tự nhiên',
  feedback: 'Ở cụm này, bạn dùng **align with capacity for rehabilitation**. “Punishment” thường *supports, undermines,* hoặc *reflects rehabilitation needs*; nó không tự nhiên khi “align with a capacity”.',
  replacementText: "support the offenders' rehabilitation",
  solutionFeedback: 'Bạn đổi thành **support the offenders\' rehabilitation** để quan hệ giữa punishment và rehabilitation trực tiếp hơn.',
  paragraphIndex: 2,
  sentenceIndex: 8,
  descriptorAnchor: anchor('lexical_resource', 'inappropriate_collocation', 'precision and appropriacy of lexical choices and collocation'),
};

const lexicalTwo = {
  ...locate('change and reformation'),
  sourceText: 'change and reformation',
  errorCode: 'repetition_limits_range',
  errorLabelVi: 'Lặp nghĩa trong một cụm',
  highlightType: 'repetition_limits_range',
  label: 'Lặp nghĩa trong một cụm',
  feedback: '**Change** và **reformation** đang thực hiện gần như cùng một chức năng trong cụm này.',
  replacementText: 'reform',
  solutionFeedback: 'Dùng **potential for reform** là đủ nghĩa và gọn hơn.',
  paragraphIndex: 3,
  sentenceIndex: 2,
  descriptorAnchor: anchor('lexical_resource', 'repetition_limits_range', 'lexical range and controlled repetition'),
};

const grammarOne = {
  ...locate('Applying adult-level punishments for juveniles'),
  sourceText: 'Applying adult-level punishments for juveniles',
  errorCode: 'preposition_error',
  errorLabelVi: 'Sai giới từ',
  highlightType: 'preposition_error',
  label: 'Sai giới từ',
  feedback: 'Với động từ **apply** theo nghĩa áp dụng hình phạt cho ai, bạn cần cấu trúc **apply something to someone**.',
  replacementText: 'Applying adult-level punishments to juveniles',
  solutionFeedback: 'Đổi **for** thành **to**.',
  paragraphIndex: 2,
  sentenceIndex: 6,
  descriptorAnchor: anchor('grammatical_range_accuracy', 'preposition_error', 'grammatical accuracy and control'),
};

const revisedEssay = `Some people propose that young offenders should face the same legal consequences as their adult counterparts, regardless of age. I disagree with this proposal, despite acknowledging the reasons for it.

Those who support treating young offenders like adults often emphasize that it serves as a strong deterrent. Harsher penalties, they believe, will instill fear and discourage juveniles from engaging in criminal activities. For example, proponents might argue that publicising adult-level penalties for serious juvenile offences such as robbery or assault would make other teenagers less willing to take the same risk. They also argue that comparable penalties recognise the seriousness of the harm suffered by victims, regardless of the offender's age.

However, this perspective overlooks the fact that juveniles are fundamentally different from adults in terms of cognitive and emotional development. Scientific research has shown that the brains of young people are not fully developed, particularly in areas responsible for impulse control and decision-making. This immaturity often leads to poor judgment and a lack of foresight regarding the repercussions of their actions. Applying adult-level punishments to juveniles fails to account for these developmental differences and may result in unjustly harsh punishments that undermine the offenders' rehabilitation.

Moreover, the primary focus of juvenile justice should be rehabilitation rather than punishment. Young offenders have a higher potential for reform if given appropriate guidance and support. Programs that focus on education, counseling, and community service can help redirect juveniles towards a productive path, reducing the likelihood of reoffending. Treating young offenders like adults often places them in environments that are more likely to reinforce criminal behavior rather than correct it.

In conclusion, while equal treatment of young and adult offenders might seem like a straightforward approach to justice, it fails to consider the unique needs and potential for rehabilitation among juveniles. A justice system that recognizes these differences and focuses on rehabilitation will be more effective in promoting long-term societal well-being and reducing crime.`;

const scores = { taskAchievement: 8, coherenceCohesion: 8, lexicalResource: 8, grammaticalRange: 8, overall: 8 };

const analysis = {
  promptType: 'agree_disagree',
  scores,
  assessmentAudit: {
    provisionalScores: scores,
    evidenceScores: scores,
    reconciliation: {
      changedCriteria: [],
      summaryVi: 'Ấn tượng ban đầu và kiểm tra evidence thống nhất ở Band 8: position rõ, lập luận phát triển tốt và ngôn ngữ được kiểm soát; các lỗi còn lại mang tính cục bộ.',
    },
  },
  taskCoverage: [
    {
      id: 'task-position',
      requirement: 'State how far you agree or disagree that young offenders should be treated the same way as adults.',
      status: 'fully_addressed',
      evidenceNodeIds: ['sentence-0-2', 'sentence-4-2', 'sentence-4-3'],
      assessmentVi: 'Bạn trả lời trực tiếp rằng bạn disagree và giữ lập trường này xuyên suốt bài.',
    },
    {
      id: 'task-support',
      requirement: 'Develop and support the stated position.',
      status: 'fully_addressed',
      evidenceNodeIds: ['sentence-2-1', 'sentence-2-6', 'sentence-3-1', 'sentence-3-4', 'sentence-3-6'],
      assessmentVi: 'Bạn phát triển position bằng hai tuyến lý do rõ: developmental differences và rehabilitation.',
    },
  ],
  argumentFlowOverview: {
    titleVi: 'Lập trường và mạch lập luận đã ổn định',
    bodyVi: 'Bài đi từ opposing rationale sang developmental differences và rehabilitation theo thứ tự người đọc có thể theo dõi dễ dàng. Không có macro restructure cần thực hiện; các góp ý dưới đây chỉ xử lý hai chỗ support chưa thực hiện đúng công việc của chúng.',
    nodeIds: ['sentence-0-2', 'sentence-1-1', 'sentence-2-1', 'sentence-3-1', 'sentence-4-3'],
  },
  argumentFlowChapters: [],
  relevanceGate: [
    ...body1Chunks,
    ...body2Chunks,
    ...body3Chunks,
  ].map(item => ({
    nodeId: item.nodeId,
    paragraphIndex: Number(item.nodeId.split('-')[1]),
    status: 'eligible',
    paragraphRoleFit: 'fits',
    coherenceEligible: true,
    reasonVi: 'Ý này thuộc đúng tuyến lập luận của đoạn.',
  })),
  pyramid: {
    macroAnswer: {
      text: 'Young offenders should not be treated in the same way as adults because developmental differences and rehabilitation potential require a different justice response.',
      errors: [],
      review: nodeReview('macro', 'works', 'Trả lời trực tiếp mức độ đồng ý', 'Position rõ, nhất quán và được hai đoạn thân bài chính hỗ trợ.', []),
    },
    paragraphs: [
      makeParagraph(0, 'Introduction', 'Nêu tranh luận và position', introduction, introChunks),
      makeParagraph(1, 'Body 1', 'Trình bày lý do ủng hộ equal treatment trước khi phản biện', body1, body1Chunks, [deterrenceError, justiceError]),
      makeParagraph(2, 'Body 2', 'Chứng minh developmental differences làm equal punishment thiếu công bằng', body2, body2Chunks),
      makeParagraph(3, 'Body 3', 'Chứng minh rehabilitation phù hợp hơn punishment', body3, body3Chunks),
      makeParagraph(4, 'Conclusion', 'Khẳng định lại position và preferred justice response', conclusion, conclusionChunks),
    ],
    edgeReviews: [],
    coherenceFlows: [],
  },
  cohesionHighlights: [],
  lexicalHighlights: [lexicalOne, lexicalTwo],
  grammaticalHighlights: [grammarOne],
  overallAssessment: {
    summaryVi: 'Đây là một bài Band 8 có position rõ và được phát triển bằng hai lý do phù hợp: developmental differences và rehabilitation. Mạch bài dễ theo dõi, paragraphing hợp lý và ngôn ngữ nhìn chung chính xác. Phần cần chỉnh chủ yếu nằm ở opposing view: một example chưa chứng minh đúng deterrence và hai rationale cuối đoạn mới chỉ được nêu tên.',
    priorities: [
      {
        criterion: 'taskAchievement',
        titleVi: 'Để mỗi example chứng minh đúng ý mà đoạn đã hứa',
        actionVi: 'Khi paragraph point là deterrence, example cần cho thấy punishment affects the decision to offend before the crime occurs.',
        evidenceIds: ['issue:body1-example-shifts-purpose'],
      },
      {
        criterion: 'taskAchievement',
        titleVi: 'Không mở thêm rationale ở cuối đoạn nếu chưa phát triển',
        actionVi: 'Giữ một rationale như justice for victims và giải thích quan hệ của nó thay vì liệt kê thêm social order.',
        evidenceIds: ['issue:body1-new-rationales-undeveloped'],
      },
      {
        criterion: 'grammaticalRange',
        titleVi: 'Sửa các lỗi local trước khi polish style',
        actionVi: 'Sửa apply punishments **to** juveniles và rút gọn các cụm bị lặp nghĩa.',
        evidenceIds: ['preposition_error', 'repetition_limits_range'],
      },
    ],
    descriptorAlignment: [
      { criterion: 'taskAchievement', band: 8, rationaleVi: 'The prompt is sufficiently addressed; the position is clear and well developed, with relevant main ideas that are extended and supported.', evidenceIds: ['task-position', 'task-support'] },
      { criterion: 'coherenceCohesion', band: 8, rationaleVi: 'The message can be followed with ease; ideas are logically sequenced and cohesion rarely attracts attention.', evidenceIds: [] },
      { criterion: 'lexicalResource', band: 8, rationaleVi: 'A wide resource is used flexibly and precisely; occasional collocational imprecision does not impede communication.', evidenceIds: ['inappropriate_collocation', 'repetition_limits_range'] },
      { criterion: 'grammaticalRange', band: 8, rationaleVi: 'A wide range of structures is used flexibly and accurately; the isolated preposition error has minimal effect.', evidenceIds: ['preposition_error'] },
    ],
  },
  comparison: {
    targetBand: 8,
    revisedEssay,
    changeSummaryVi: 'Bản sửa giữ nguyên position, paragraph order và gần như toàn bộ wording. Nó chỉ làm example thực sự chứng minh deterrence, phát triển justice for victims thay vì liệt kê social order, rồi sửa ba lỗi language cục bộ.',
    preservedStrengthsVi: [
      'Giữ position phản đối equal treatment xuyên suốt.',
      'Giữ hai lý do mạnh về developmental differences và rehabilitation.',
      'Giữ mạch opposing view → rebuttal → preferred approach.',
    ],
  },
};

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const response = await fetch(`${baseUrl}/api/writing/assessments/${taskId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, essay, analysis }),
});

if (!response.ok) throw new Error(`Persist failed: ${response.status} ${await response.text()}`);
console.log(JSON.stringify({ taskId, scores, chunks: analysis.pyramid.paragraphs.map(item => item.sentences.length), response: await response.json() }, null, 2));
