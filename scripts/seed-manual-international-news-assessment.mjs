const taskId = 'p1-international-news';
const prompt = 'Some people think secondary school students should study international news as one of their subjects, while others believe that this is a waste of valuable school time? Discuss both these views and give your own opinion.';
const essay = `Globalization has increased the importance of preparing students for international engagement. Some argue that including international news in school curricula can improve global awareness and practical skills, while others believe it may be ineffective without proper teaching and exam relevance.

On the one hand, many believe that using international news as a new subject is essential, as it allows secondary students to explore the world and acquire practical skills for their lives. While most education systems focus on foundational subjects such as mathematics, literature, and language, they often neglect global awareness and cultural understanding. This omission is particularly problematic in today's increasingly interconnected world, where collaboration and mutual understanding between people from diverse backgrounds have become commonplace. To address this issue and promote international cooperation, integrating global news into the curriculum appears to be a highly effective solution, as it would expose students to various cultures, lifestyles, and global perspectives, thereby enriching their knowledge and preparing them for future global engagement.

On the other hand, some argue that such a subject would waste students’ time due to its inefficiency. Keeping up with global news, without proper teaching methods and structured guidance, may feel meaningless to students, particularly those who are more focused on their final exams and therefore perceive the subject as impractical. As a result, integrating this activity into the curriculum could be considered ineffective and redundant. For instance, when students are asked to study political affairs, a dynamic, complex, and often controversial topic, they may regard it as boring and irrelevant. Over time, this disinterest may diminish the subject’s effectiveness and undermine its intended educational value.

In conclusion, while adding international news to the curriculum has clear benefits in developing global awareness, its success depends on effective teaching methods. In my opinion, with proper implementation, this subject can be a valuable addition to education, helping students better prepare for a connected world.`;

function locate(sourceText, from = 0) {
  const startChar = essay.indexOf(sourceText, from);
  if (startChar < 0) throw new Error(`Missing source text: ${sourceText}`);
  return { startChar, endChar: startChar + sourceText.length, sourceText };
}

function evidence(sourceText, role, nodeId) {
  return { ...locate(sourceText), role, nodeId };
}

function refs(...items) {
  return items.map(([kind, id, label]) => ({ kind, id, label }));
}

function action(type, label, details, extra = {}) {
  return { type, label, details, ...extra };
}

function issue(id, type, title, whyWrong, impactOnPurpose, impactOnReader, options = {}) {
  return {
    id,
    errorCode: options.errorCode,
    errorLabelVi: options.errorLabelVi,
    type,
    ...(options.direction ? { direction: options.direction } : {}),
    title,
    whyWrong,
    impactOnPurpose,
    impactOnReader,
    affectedNodes: options.affectedNodes,
    solutionActions: options.solutionActions || [],
    comment: options.comment,
    evidenceSpans: options.evidenceSpans,
    nodeLinks: options.nodeLinks,
  };
}

function errorFromIssue(item) {
  const firstAction = item.solutionActions?.[0];
  return {
    type: ['internal', 'weak_support', 'unsupported_claim'].includes(item.type) ? 'internal' : 'relational',
    errorCode: item.errorCode,
    errorLabelVi: item.errorLabelVi,
    direction: item.direction,
    message: item.title,
    explanation: `${item.whyWrong} ${item.impactOnPurpose} ${item.impactOnReader}`,
    suggestion: firstAction?.details,
    affectedNodes: item.affectedNodes,
    proposedFix: firstAction ? {
      type: firstAction.type === 'rewrite_node' ? 'rewrite' : firstAction.type === 'change_relationship_tag' ? 'change_relationship' : 'add_node',
      details: firstAction.details,
      proposedText: firstAction.proposedText,
      whyBetter: firstAction.whyBetter,
    } : undefined,
    comment: item.comment,
    evidenceSpans: item.evidenceSpans,
    nodeLinks: item.nodeLinks,
  };
}

function review(nodeId, status, job, assessment, issues = []) {
  return { nodeId, status, job, assessment, issues };
}

function paragraph(index, label, job, text, sentences, reviewState, errors = [], transitionToNext = null) {
  const { startChar: paragraphStartChar, endChar: paragraphEndChar } = locate(text);
  return { index, label, job, paragraphStartChar, paragraphEndChar, errors, review: reviewState, sentences, transitionToNext };
}

function chunk(paragraphIndex, index, sourceSentenceIndex, sourceText, role, simplifiedIdea, nodeReview, errors = []) {
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
    review: nodeReview,
    transitionToNext: 'NONE',
  };
}

const body1Underdevelopment = issue(
  'issue:body1-omission-underdeveloped',
  'weak_support',
  '“Problematic” chưa được giải thích thành một hệ quả cụ thể',
  'Bạn gọi việc thiếu global awareness là “particularly problematic”, nhưng bối cảnh thế giới kết nối mới chỉ cho thấy chủ đề này quan trọng. Bạn vẫn chưa chỉ ra học sinh sẽ gặp khó khăn cụ thể nào khi học tập, hợp tác, hoặc đánh giá thông tin quốc tế.',
  'Cần nêu hệ quả cụ thể để người đọc thấy được thiếu nhận thức dẫn tới bất lợi thực tế nào; nếu không, phần đề xuất cách giải quyết chỉ đang trả lời cho nhãn “problematic” chưa được làm rõ.',
  'Người đọc phải tự điền mắt xích nhân quả trước khi có thể chấp nhận rằng international news là cần thiết, thay vì chỉ có thể thấy nó có vẻ hữu ích.',
  {
    errorCode: 'underdeveloped_idea',
    errorLabelVi: 'Ý chưa phát triển đủ',
    affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 5 }, { paraIndex: 1, sentenceIndex: 6 }, { paraIndex: 1, sentenceIndex: 8 }] },
    nodeLinks: { primaryNodeIds: ['sentence-1-5'], contextNodeIds: ['sentence-1-4', 'sentence-1-6'], affectedNodeIds: ['sentence-1-8'] },
    evidenceSpans: [
      evidence('This omission is particularly problematic', 'primary', 'sentence-1-5'),
      evidence("where collaboration and mutual understanding between people from diverse backgrounds have become commonplace", 'context', 'sentence-1-6'),
    ],
    solutionActions: [action('rewrite_node', 'Nói rõ hệ quả của khoảng trống này', 'Sau câu về thế giới kết nối, thêm một hệ quả cụ thể: học sinh thiếu khả năng hiểu các góc nhìn khác nhau hoặc đánh giá thông tin quốc tế khi học, làm việc và hợp tác.', {
      targetNodeId: 'sentence-1-5',
      proposedText: 'This gap is problematic because students who cannot interpret international perspectives are less prepared to collaborate across cultures or evaluate global issues that increasingly affect their study and work.',
      whyBetter: 'Bản sửa cho thấy rõ vì sao khoảng trống này gây bất lợi thực tế, thay vì chỉ gắn nhãn “problematic”.',
    })],
    comment: { bodyVi: 'Bạn thử dừng ở “problematic”. Ở đây bạn mới gọi tên khoảng trống; bối cảnh thế giới kết nối chưa cho người đọc biết học sinh sẽ gặp bất lợi gì. Khi bạn thêm hệ quả cụ thể, người đọc mới thấy vì sao môn này cần có trong chương trình.', solutionBodyVi: 'Bạn thêm một hệ quả cụ thể cho học sinh trước khi chuyển sang phần đề xuất cách giải quyết.', references: refs(['node', 'sentence-1-4', 'Khoảng trống về global awareness'], ['node', 'sentence-1-5', 'Nhận định “problematic”'], ['node', 'sentence-1-8', 'Phần đề xuất cách giải quyết']) },
  },
);

const body1Overclaim = issue(
  'issue:body1-overclaim-effective-solution',
  'unsupported_claim',
  '“Highly effective solution” đi nhanh hơn phần chứng minh',
  'Cụm “highly effective solution” đánh giá mức độ hiệu quả trước khi bạn cho thấy việc học tin tức tạo ra kỹ năng thực tế như thế nào. Các ý sau có nói đến tiếp xúc và kiến thức, nhưng bạn chưa nối chúng với “practical skills”.',
  'Đoạn mở đầu bằng một kết luận mạnh hơn phần chứng minh hiện có, nên các ý sau trông như đang theo sau để hợp thức hóa kết luận.',
  'Người đọc thấy một khẳng định tự tin, nhưng chưa thấy tiêu chí để tin rằng giải pháp “highly effective” thay vì chỉ “potentially useful”.',
  {
    errorCode: 'overgeneralised_claim',
    errorLabelVi: 'Khái quát quá mức',
    affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 7 }, { paraIndex: 1, sentenceIndex: 8 }, { paraIndex: 1, sentenceIndex: 9 }] },
    nodeLinks: { primaryNodeIds: ['sentence-1-7'], contextNodeIds: ['sentence-1-8', 'sentence-1-9'] },
    evidenceSpans: [evidence('appears to be a highly effective solution', 'primary', 'sentence-1-7'), evidence('thereby enriching their knowledge and preparing them for future global engagement', 'context', 'sentence-1-9')],
    solutionActions: [action('rewrite_node', 'Hạ mức khẳng định hoặc chứng minh cơ chế', 'Đổi “highly effective” thành “a potentially valuable response”, rồi thêm cách học sinh sẽ phân tích nguồn tin, so sánh góc nhìn hoặc áp dụng kiến thức vào tình huống thực tế.', {
      targetNodeId: 'sentence-1-7',
      proposedText: 'Integrating news analysis could be a valuable response because students would compare sources and perspectives, then apply that understanding to real international issues.',
      whyBetter: 'Câu mới hạ mức khẳng định và nối việc tiếp xúc với góc nhìn khác nhau với một kỹ năng cụ thể.',
    })],
    comment: { bodyVi: 'Tiếp nhé, bạn đang gọi đây là “highly effective solution” trước khi đoạn cho thấy học sinh sẽ có kỹ năng thực tế nào. Tiếp xúc với các góc nhìn khác nhau là một khởi đầu, nhưng bạn cần thêm hoạt động học cụ thể hoặc hạ mức khẳng định này.', solutionBodyVi: 'Bạn nối giải pháp với một việc học sinh thực sự làm, không chỉ với kết quả mong muốn.', references: refs(['node', 'sentence-1-7', 'Nhận định về giải pháp'], ['node', 'sentence-1-8', 'Tiếp xúc với góc nhìn đa dạng'], ['node', 'sentence-1-9', 'Kết quả được nêu']) },
  },
);

const body2TopicSentence = issue(
  'issue:body2-topic-sentence-misframed',
  'internal',
  'Câu chủ đề lệch trọng tâm của lập luận',
  'Câu mở đầu Body 2: “waste students’ time due to its inefficiency” chỉ lặp lại kết quả “inefficient”, nên chưa cho người đọc biết thời gian bị lãng phí vì sao. Nguyên nhân thật của đoạn chỉ xuất hiện ở câu sau: thiếu teaching methods và structured guidance.',
  'Câu chủ đề cần nêu đúng nguyên nhân để các câu sau cùng chứng minh một ý. Với cách viết hiện tại, Body 2 bắt đầu bằng một nhãn chung rồi mới đổi sang lý do cụ thể.',
  'Người đọc hiểu đoạn đang phản đối môn học, nhưng phải chờ sang câu sau mới biết chính xác điều gì khiến nó có thể trở nên vô ích.',
  {
    errorCode: 'misframed_topic_sentence',
    errorLabelVi: 'Câu chủ đề lệch trọng tâm',
    affectedNodes: { paragraphs: [2], sentences: [{ paraIndex: 2, sentenceIndex: 1 }, { paraIndex: 2, sentenceIndex: 2 }] },
    nodeLinks: { primaryNodeIds: ['sentence-2-1'], contextNodeIds: ['sentence-2-2'] },
    evidenceSpans: [
      evidence('would waste students’ time due to its inefficiency', 'primary', 'sentence-2-1'),
      evidence('without proper teaching methods and structured guidance', 'context', 'sentence-2-2'),
    ],
    solutionActions: [action('rewrite_node', 'Đặt nguyên nhân vào câu chủ đề', 'Nêu ngay rằng môn học chỉ có thể lãng phí thời gian khi việc học tin tức thiếu mục tiêu, hướng dẫn và liên hệ với chương trình.', {
      targetNodeId: 'sentence-2-1',
      proposedText: 'On the other hand, international news can waste students’ time when lessons lack clear teaching methods and structured guidance.',
      whyBetter: 'Câu chủ đề mới cho toàn bộ đoạn một lý do chung để các câu sau cùng làm rõ.',
    })],
    comment: { bodyVi: 'Ở câu mở đầu Body 2, bạn nói môn học lãng phí thời gian nhưng chưa nói vì sao. Câu sau mới nêu đúng lý do là thiếu hướng dẫn, nên bạn nên đưa lý do này lên ngay câu chủ đề.', solutionBodyVi: 'Bạn mở đoạn bằng thiếu hướng dẫn để các câu sau cùng làm rõ một ý chính.', references: refs(['node', 'sentence-2-1', 'Câu chủ đề Body 2'], ['node', 'sentence-2-2', 'Lý do thực sự của đoạn']) },
  },
);

const body2Ordering = issue(
  'issue:body2-conclusion-before-evidence',
  'misordered_sequence',
  'Kết luận xuất hiện trước bằng chứng',
  'Sau câu về thiếu teaching methods, bạn dùng “As a result” để kết lại, rồi mới đưa ví dụ. Vì vậy, ví dụ không còn làm rõ cho câu kết mà bị đẩy thành một ý đến muộn.',
  'Body 2 cần đi từ thiếu hướng dẫn, sang tình huống cụ thể, rồi mới kết luận rằng thời gian học có thể bị lãng phí. Thứ tự hiện tại làm mạch ý đứt giữa lý do và phần chứng minh.',
  'Người đọc phải quay lại để gắn ví dụ với claim, thay vì được dẫn qua một chuỗi lập luận theo thứ tự tự nhiên.',
  {
    errorCode: 'conclusion_before_evidence',
    errorLabelVi: 'Kết luận đứng trước bằng chứng',
    direction: 'horizontal',
    affectedNodes: { paragraphs: [2], sentences: [{ paraIndex: 2, sentenceIndex: 2 }, { paraIndex: 2, sentenceIndex: 4 }, { paraIndex: 2, sentenceIndex: 5 }, { paraIndex: 2, sentenceIndex: 6 }, { paraIndex: 2, sentenceIndex: 7 }] },
    nodeLinks: { primaryNodeIds: ['sentence-2-4'], contextNodeIds: ['sentence-2-2', 'sentence-2-5', 'sentence-2-6', 'sentence-2-7'] },
    evidenceSpans: [evidence('As a result, integrating this activity into the curriculum could be considered ineffective and redundant.', 'primary', 'sentence-2-4'), evidence('For instance, when students are asked to study political affairs', 'context', 'sentence-2-5')],
    solutionActions: [action('suggest_order', 'Đưa evidence lên trước conclusion', 'Giữ claim và reason ở đầu đoạn, sau đó đặt example cùng consequence, rồi mới dùng một mini conclusion thu thập các ý này.', {
      currentOrder: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-4', 'sentence-2-5', 'sentence-2-6', 'sentence-2-7'],
      proposedOrder: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5', 'sentence-2-6', 'sentence-2-7', 'sentence-2-4'],
      dependencyClaim: 'Điều kiện thiếu hướng dẫn + ví dụ về việc học tin tức không có mục tiêu -> kết luận rằng thời gian học không tạo ra giá trị giáo dục.',
      whyBetter: 'Phần chứng minh xuất hiện trước câu kết, nên người đọc không phải quay lại để tự nối các ý.',
    })],
    comment: { bodyVi: 'Bạn thử đi theo mạch Body 2: “As a result” đang khép ý trước khi ví dụ xuất hiện. Vì vậy bạn bắt người đọc tự sắp lại chuỗi: lý do -> ví dụ -> hệ quả -> câu kết.', solutionBodyVi: 'Bạn đưa ví dụ và hệ quả lên trước, rồi mới dùng câu kết để gom các ý lại.', references: refs(['flow', 'flow:body2-evidence-before-conclusion', 'Mạch ý Body 2'], ['node', 'sentence-2-2', 'Lý do: thiếu hướng dẫn'], ['node', 'sentence-2-4', 'Câu kết của đoạn'], ['node', 'sentence-2-5', 'Ví dụ']) },
  },
);

const body2ExampleMismatch = issue(
  'issue:body2-example-misses-mechanism',
  'weak_support',
  'Ví dụ không chứng minh đúng nguyên nhân mà đoạn đã nêu',
  'Câu trước nói nguyên nhân là “without proper teaching methods and structured guidance”. Nhưng ví dụ lại cho thấy political affairs vốn phức tạp và gây chán, chứ không cho thấy điều gì xảy ra khi giáo viên thiếu hướng dẫn. Hai ý có cùng chủ đề nhưng chưa nối với nhau rõ.',
  'Vì ví dụ lệch cơ chế, Body 2 chưa chứng minh được rằng môn học lãng phí thời gian do cách dạy thiếu cấu trúc; nó chỉ cho thấy một chủ đề có thể bị học sinh không thích.',
  'Người đọc có thể đồng ý political affairs dễ chán, nhưng vẫn chưa có lý do để đồng ý với claim lớn hơn về sự kém hiệu quả của môn học.',
  {
    errorCode: 'example_mismatch',
    errorLabelVi: 'Ví dụ lệch chức năng',
    direction: 'vertical',
    affectedNodes: { paragraphs: [2], sentences: [{ paraIndex: 2, sentenceIndex: 2 }, { paraIndex: 2, sentenceIndex: 5 }, { paraIndex: 2, sentenceIndex: 6 }, { paraIndex: 2, sentenceIndex: 7 }] },
    nodeLinks: { primaryNodeIds: ['sentence-2-5', 'sentence-2-6'], contextNodeIds: ['sentence-2-2'], affectedNodeIds: ['sentence-2-7'] },
    evidenceSpans: [evidence('without proper teaching methods and structured guidance', 'context', 'sentence-2-2'), evidence('when students are asked to study political affairs', 'primary', 'sentence-2-5'), evidence('they may regard it as boring and irrelevant', 'primary', 'sentence-2-6')],
    solutionActions: [action('rewrite_node', 'Viết example theo đúng cơ chế thiếu hướng dẫn', 'Thay example bằng tình huống giáo viên yêu cầu học sinh đọc tin nhưng không chỉ cách kiểm tra nguồn, liên hệ với môn học hay rút ra ý nghĩa.', {
      targetNodeId: 'sentence-2-5',
      proposedText: 'For instance, if teachers ask students to follow news stories without showing them how to assess sources or connect events to the curriculum, many may memorise headlines without gaining useful understanding.',
      whyBetter: 'Ví dụ mới cho thấy trực tiếp chuyện gì xảy ra khi thiếu hướng dẫn, nên nó làm rõ đúng ý chính của đoạn.',
    })],
    comment: { bodyVi: 'Ở ví dụ này, bạn nói vấn đề là thiếu hướng dẫn nhưng lại chuyển sang political affairs “phức tạp và dễ chán”. Vì thế bạn chưa cho người đọc thấy thiếu hướng dẫn gây ra kết quả đó như thế nào.', solutionBodyVi: 'Bạn để thiếu hướng dẫn xuất hiện trực tiếp trong ví dụ.', references: refs(['node', 'sentence-2-2', 'Lý do: thiếu hướng dẫn'], ['node', 'sentence-2-5', 'Ví dụ hiện tại'], ['node', 'sentence-2-7', 'Kết quả được nêu']) },
  },
);

const conclusionConditional = issue(
  'issue:conclusion-condition-unspecified',
  'internal',
  'Ý kiến cuối cùng đúng hướng nhưng điều kiện còn chưa có nội dung',
  'Bạn kết luận rằng môn học có giá trị “with proper implementation”, nhưng cụm này vẫn là nhãn chung. Bài đã nhắc teaching methods và exam relevance ở mở bài, nhưng conclusion chưa thu lại thành một điều kiện cụ thể để stance có sức nặng.',
  'Opinion vẫn rõ, nhưng chưa hoàn toàn khép lại tranh luận bằng tiêu chí thực hiện nào sẽ biến môn học thành giá trị thay vì lãng phí thời gian.',
  'Người đọc biết bạn ủng hộ có điều kiện, nhưng chưa biết điều kiện đó trông như thế nào trong thực tế.',
  {
    errorCode: 'unclear_position',
    errorLabelVi: 'Vị trí chưa rõ',
    affectedNodes: { paragraphs: [3], sentences: [{ paraIndex: 3, sentenceIndex: 2 }, { paraIndex: 3, sentenceIndex: 3 }] },
    nodeLinks: { primaryNodeIds: ['sentence-3-3'], contextNodeIds: ['sentence-0-3', 'sentence-3-2'] },
    evidenceSpans: [evidence('with proper implementation', 'primary', 'sentence-3-3'), evidence('its success depends on effective teaching methods', 'context', 'sentence-3-2')],
    solutionActions: [action('rewrite_node', 'Đặt tên cho điều kiện thực hiện', 'Nêu ngắn gọn rằng môn học cần news analysis có hướng dẫn, tiêu chí đánh giá nguồn tin và liên hệ với mục tiêu học tập.', {
      targetNodeId: 'sentence-3-3',
      proposedText: 'In my view, it should be included only when lessons teach students to assess sources and connect international issues to their academic and civic lives.',
      whyBetter: 'Stance cuối cùng giải quyết trực tiếp điều kiện đã xuất hiện từ mở bài thay vì lặp lại một nhãn chung.',
    })],
    comment: { bodyVi: 'Cuối bài, bạn nói “proper implementation” nhưng chưa nói điều đó cụ thể là gì. Bạn đã nhắc teaching methods và exam relevance ở mở bài; hãy gọi lại điều kiện đó để ý kiến cuối cùng có sức nặng hơn.', solutionBodyVi: 'Bạn thu lại teaching methods và relevance thành điều kiện cụ thể.', references: refs(['prompt', 'task-requirement-opinion', 'Give your own opinion'], ['node', 'sentence-0-3', 'Điều kiện phản đối ở mở bài'], ['node', 'sentence-3-3', 'Final stance']) },
  },
);

const b1Text = `On the one hand, many believe that using international news as a new subject is essential, as it allows secondary students to explore the world and acquire practical skills for their lives. While most education systems focus on foundational subjects such as mathematics, literature, and language, they often neglect global awareness and cultural understanding. This omission is particularly problematic in today's increasingly interconnected world, where collaboration and mutual understanding between people from diverse backgrounds have become commonplace. To address this issue and promote international cooperation, integrating global news into the curriculum appears to be a highly effective solution, as it would expose students to various cultures, lifestyles, and global perspectives, thereby enriching their knowledge and preparing them for future global engagement.`;
const b2Text = `On the other hand, some argue that such a subject would waste students’ time due to its inefficiency. Keeping up with global news, without proper teaching methods and structured guidance, may feel meaningless to students, particularly those who are more focused on their final exams and therefore perceive the subject as impractical. As a result, integrating this activity into the curriculum could be considered ineffective and redundant. For instance, when students are asked to study political affairs, a dynamic, complex, and often controversial topic, they may regard it as boring and irrelevant. Over time, this disinterest may diminish the subject’s effectiveness and undermine its intended educational value.`;
const introText = `Globalization has increased the importance of preparing students for international engagement. Some argue that including international news in school curricula can improve global awareness and practical skills, while others believe it may be ineffective without proper teaching and exam relevance.`;
const conclusionText = `In conclusion, while adding international news to the curriculum has clear benefits in developing global awareness, its success depends on effective teaching methods. In my opinion, with proper implementation, this subject can be a valuable addition to education, helping students better prepare for a connected world.`;

const paragraphs = [
  paragraph(0, 'Introduction', 'Nêu hai hướng tranh luận và một stance có điều kiện', introText, [
    chunk(0, 1, 1, 'Globalization has increased the importance of preparing students for international engagement.', 'setup', 'Bối cảnh toàn cầu khiến việc chuẩn bị cho học sinh quan trọng hơn', review('sentence-0-1', 'works', 'Thiết lập bối cảnh', 'Mở bài đặt chủ đề vào bối cảnh hợp lý.')),
    chunk(0, 2, 2, 'including international news in school curricula can improve global awareness and practical skills', 'claim', 'Lợi ích được cho là có về nhận thức toàn cầu và kỹ năng thực tế', review('sentence-0-2', 'works', 'Nêu phía ủng hộ', 'Quan điểm thứ nhất được nêu chính xác.')),
    chunk(0, 3, 2, 'others believe it may be ineffective without proper teaching and exam relevance.', 'contrast', 'Phía phản đối gắn hiệu quả với cách dạy và tính liên quan', review('sentence-0-3', 'works', 'Nêu phía phản đối', 'Điều kiện phản đối tạo nền cho opinion sau này.')),
  ], review('para-0', 'works', 'Định vị tranh luận', 'Mở bài gọn, trực tiếp và tạo được tiêu chí để bài trả lời.'), [], 'CONTRAST'),
  paragraph(1, 'Body 1', 'Chứng minh vì sao international news có thể cần thiết cho học sinh', b1Text, [
    chunk(1, 1, 1, 'On the one hand, many believe that using international news as a new subject is essential', 'claim', 'International news là môn học cần thiết', review('sentence-1-1', 'works', 'Nêu claim', 'Claim rõ ràng và phù hợp với nhiệm vụ.')),
    chunk(1, 2, 1, 'as it allows secondary students to explore the world and acquire practical skills for their lives.', 'reason', 'Môn học được cho là mở rộng thế giới quan và kỹ năng sống', review('sentence-1-2', 'works', 'Đưa lợi ích ban đầu', 'Ý này đi đúng hướng nhưng cần mechanism cụ thể hơn ở phần sau.')),
    chunk(1, 3, 2, 'While most education systems focus on foundational subjects such as mathematics, literature, and language', 'setup', 'Chương trình hiện tại ưu tiên các môn nền tảng', review('sentence-1-3', 'works', 'Đặt bối cảnh hệ thống giáo dục', 'Bối cảnh này chuẩn bị cho khoảng trống cần được giải quyết.')),
    chunk(1, 4, 2, 'they often neglect global awareness and cultural understanding.', 'reason', 'Chương trình hiện tại bỏ sót nhận thức toàn cầu và hiểu biết văn hóa', review('sentence-1-4', 'works', 'Xác định khoảng trống', 'Khoảng trống liên quan trực tiếp đến claim của đoạn.')),
    chunk(1, 5, 3, 'This omission is particularly problematic', 'explanation', 'Khoảng trống được đánh giá là có vấn đề', review('sentence-1-5', 'weak', 'Giải thích tầm quan trọng của khoảng trống', 'Nhận định đúng hướng nhưng còn thiếu hệ quả cụ thể.', [body1Underdevelopment]), [errorFromIssue(body1Underdevelopment)]),
    chunk(1, 6, 3, "in today's increasingly interconnected world, where collaboration and mutual understanding between people from diverse backgrounds have become commonplace.", 'context', 'Thế giới kết nối khiến hiểu biết liên văn hóa trở nên quan trọng', review('sentence-1-6', 'works', 'Cung cấp bối cảnh', 'Bối cảnh hỗ trợ ý, nhưng chưa thay thế cho consequence cần nêu ở node trước.')),
    chunk(1, 7, 4, 'To address this issue and promote international cooperation, integrating global news into the curriculum appears to be a highly effective solution', 'mini_conclusion', 'Đưa giải pháp tích hợp international news vào chương trình', review('sentence-1-7', 'weak', 'Đề xuất solution', 'Mức độ khẳng định mạnh hơn phần mechanism đã chứng minh.', [body1Overclaim]), [errorFromIssue(body1Overclaim)]),
    chunk(1, 8, 4, 'as it would expose students to various cultures, lifestyles, and global perspectives', 'mechanism', 'Học sinh tiếp xúc với góc nhìn và lối sống đa dạng', review('sentence-1-8', 'works', 'Nêu cơ chế ban đầu', 'Exposure là một mechanism liên quan.')),
    chunk(1, 9, 4, 'thereby enriching their knowledge and preparing them for future global engagement.', 'result', 'Exposure giúp mở rộng kiến thức và chuẩn bị cho tương tác toàn cầu', review('sentence-1-9', 'works', 'Nêu outcome', 'Outcome hợp lý, nhưng cần thêm bước nối sang practical skills để nâng sức chứng minh.')),
  ], review('para-1', 'weak', 'Chứng minh lợi ích của môn học', 'Đoạn có một chuỗi claim - gap - solution tốt, nhưng hai bước quan trọng vẫn mang tính nhãn: “problematic” và “highly effective”.', [body1Underdevelopment, body1Overclaim]), [errorFromIssue(body1Underdevelopment), errorFromIssue(body1Overclaim)], 'CONTRAST'),
  paragraph(2, 'Body 2', 'Chứng minh rủi ro khi môn học được triển khai thiếu cấu trúc', b2Text, [
    chunk(2, 1, 1, 'On the other hand, some argue that such a subject would waste students’ time due to its inefficiency.', 'claim', 'Môn học có thể lãng phí thời gian khi thiếu cách dạy có cấu trúc', review('sentence-2-1', 'weak', 'Nêu claim phản đối', 'Câu chủ đề lặp lại kết quả “inefficiency” thay vì đặt nguyên nhân mà đoạn sẽ chứng minh.', [body2TopicSentence]), [errorFromIssue(body2TopicSentence)]),
    chunk(2, 2, 2, 'Keeping up with global news, without proper teaching methods and structured guidance, may feel meaningless to students', 'reason', 'Thiếu hướng dẫn khiến việc theo dõi tin tức trở nên vô nghĩa', review('sentence-2-2', 'works', 'Nêu cơ chế phản đối', 'Đây là mechanism tốt và nên trở thành trung tâm của example.')),
    chunk(2, 3, 2, 'particularly those who are more focused on their final exams and therefore perceive the subject as impractical.', 'explanation', 'Học sinh hướng tới kỳ thi có thể thấy môn học không thực dụng', review('sentence-2-3', 'works', 'Cụ thể hóa đối tượng bị ảnh hưởng', 'Ý này làm reason thực tế hơn.')),
    chunk(2, 4, 3, 'As a result, integrating this activity into the curriculum could be considered ineffective and redundant.', 'mini_conclusion', 'Kết luận rằng hoạt động kém hiệu quả và thừa', review('sentence-2-4', 'weak', 'Thu thập evidence thành conclusion', 'Kết luận đứng trước evidence nên mất sức nặng.', [body2Ordering]), [errorFromIssue(body2Ordering)]),
    chunk(2, 5, 4, 'For instance, when students are asked to study political affairs, a dynamic, complex, and often controversial topic', 'example', 'Ví dụ về việc học political affairs', review('sentence-2-5', 'weak', 'Đưa example', 'Ví dụ chuyển sang độ phức tạp của chủ đề thay vì cách dạy thiếu cấu trúc.', [body2ExampleMismatch]), [errorFromIssue(body2ExampleMismatch)]),
    chunk(2, 6, 4, 'they may regard it as boring and irrelevant.', 'result', 'Học sinh có thể thấy chủ đề nhàm chán và không liên quan', review('sentence-2-6', 'weak', 'Nêu phản ứng của học sinh', 'Kết quả này chưa chứng minh trực tiếp reason về thiếu hướng dẫn.', [body2ExampleMismatch]), [errorFromIssue(body2ExampleMismatch)]),
    chunk(2, 7, 5, 'Over time, this disinterest may diminish the subject’s effectiveness and undermine its intended educational value.', 'result', 'Sự chán nản làm giảm giá trị giáo dục', review('sentence-2-7', 'works', 'Nêu hậu quả', 'Hậu quả hợp lý nếu example trước đó được nối lại với teaching methods.')),
  ], review('para-2', 'weak', 'Chứng minh mặt hạn chế của môn học', 'Đoạn có mechanism đúng là “lack of guidance”, nhưng câu chủ đề, thứ tự evidence và example chưa cùng phục vụ mechanism đó.', [body2TopicSentence, body2Ordering, body2ExampleMismatch]), [errorFromIssue(body2TopicSentence), errorFromIssue(body2Ordering), errorFromIssue(body2ExampleMismatch)], 'CONCLUSION'),
  paragraph(3, 'Conclusion', 'Cân bằng hai phía và trả lời bằng stance cá nhân', conclusionText, [
    chunk(3, 1, 1, 'In conclusion, while adding international news to the curriculum has clear benefits in developing global awareness', 'concession', 'Công nhận lợi ích của international news', review('sentence-3-1', 'works', 'Tóm tắt mặt tích cực', 'Câu concession cân bằng với phần phản đối.')),
    chunk(3, 2, 1, 'its success depends on effective teaching methods.', 'concession', 'Hiệu quả tùy thuộc vào cách dạy', review('sentence-3-2', 'works', 'Nêu điều kiện', 'Điều kiện phù hợp với lập luận Body 2.')),
    chunk(3, 3, 2, 'In my opinion, with proper implementation, this subject can be a valuable addition to education', 'final_stance', 'Ủng hộ có điều kiện việc đưa môn học vào chương trình', review('sentence-3-3', 'weak', 'Nêu opinion cuối', 'Stance rõ nhưng điều kiện triển khai vẫn còn chung chung.', [conclusionConditional]), [errorFromIssue(conclusionConditional)]),
    chunk(3, 4, 2, 'helping students better prepare for a connected world.', 'result', 'Môn học chuẩn bị cho học sinh trong thế giới kết nối', review('sentence-3-4', 'works', 'Khép lại bằng outcome', 'Kết bài trở về đúng mục tiêu mở đầu.')),
  ], review('para-3', 'weak', 'Chốt stance và điều kiện', 'Kết luận nhất quán; chỉ cần gọi tên rõ hơn điều kiện để stance có độ quyết đoán.', [conclusionConditional]), [errorFromIssue(conclusionConditional)], null),
];

const analysis = {
  promptType: 'discuss_both',
  assessmentAudit: {
    provisionalScores: { overall: 7, taskAchievement: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRange: 7 },
    evidenceScores: { overall: 7, taskAchievement: 6.5, coherenceCohesion: 6.5, lexicalResource: 7, grammaticalRange: 7 },
    reconciliation: {
      changedCriteria: [
        { criterion: 'taskAchievement', provisionalBand: 7, evidenceBand: 6.5, finalBand: 7, reasonVi: 'Bài đáp ứng đủ task và có stance rõ, nhưng một số claim quan trọng còn thiếu cơ chế hoặc evidence khớp trực tiếp.', evidenceIds: ['issue:body1-omission-underdeveloped', 'issue:body2-example-misses-mechanism'] },
        { criterion: 'coherenceCohesion', provisionalBand: 7, evidenceBand: 6.5, finalBand: 6.5, reasonVi: 'Body 2 đảo thứ tự conclusion và example, đồng thời connective “As a result” báo hiệu một quan hệ chưa được evidence phía trước hoàn tất.', evidenceIds: ['issue:body2-conclusion-before-evidence'] },
      ],
      summaryVi: 'Bài có cấu trúc discussion rõ và lập trường nhất quán. Điểm bị giữ lại chủ yếu đến từ độ phát triển của evidence và flow trong Body 2, không phải vì bài thiếu ý.',
    },
  },
  scores: { overall: 7, taskAchievement: 7, coherenceCohesion: 6.5, lexicalResource: 7, grammaticalRange: 7 },
  taskCoverage: [
    { id: 'task-view-support', requirement: 'Discuss why international news should be studied at secondary school.', status: 'fully_addressed', evidenceNodeIds: ['sentence-1-1', 'sentence-1-4', 'sentence-1-8'], assessmentVi: 'Bài trình bày rõ lợi ích về nhận thức toàn cầu và có một cơ chế ban đầu là tiếp xúc với góc nhìn đa dạng.' },
    { id: 'task-view-opposition', requirement: 'Discuss why studying international news may waste valuable school time.', status: 'fully_addressed', evidenceNodeIds: ['sentence-2-1', 'sentence-2-2', 'sentence-2-5'], assessmentVi: 'Bài nêu đúng điều kiện khiến môn học có thể kém hiệu quả, dù example cần bám sát điều kiện đó hơn.' },
    { id: 'task-own-opinion', requirement: 'Give your own opinion.', status: 'fully_addressed', evidenceNodeIds: ['sentence-3-3'], assessmentVi: 'Bạn có opinion rõ ràng: môn học có giá trị nếu được triển khai đúng cách.' },
  ],
  pyramid: {
    macroAnswer: {
      text: 'International news should be included in secondary education when it is taught through structured, relevant activities that turn global awareness into practical learning.',
      errors: [],
      review: review('macro', 'works', 'Trả lời câu hỏi bằng một stance có điều kiện', 'Stance xuyên suốt: ủng hộ môn học, nhưng không xem nó tự động hiệu quả.'),
    },
    paragraphs,
    edgeReviews: [
      {
        edgeId: 'edge:body2-reason-example', fromNodeId: 'sentence-2-2', toNodeId: 'sentence-2-5', relationshipTag: 'EXAMPLE', expectedRelationship: 'Ví dụ phải cho thấy thiếu hướng dẫn là nguyên nhân khiến học sinh không tạo ra giá trị học tập.', actualRelationship: 'Ví dụ chỉ cho thấy political affairs có thể gây chán.', status: 'weak', assessment: 'Example cùng chủ đề nhưng chưa minh họa đúng mechanism.', issues: [body2ExampleMismatch],
      },
    ],
    coherenceFlows: [
      {
        paragraphIndex: 1,
        edgeId: 'flow:body1-gap-to-solution',
        fromNodeIds: ['sentence-1-4', 'sentence-1-6'],
        toNodeId: 'sentence-1-7',
        relationshipTag: 'BRIDGE',
        flowType: 'bridge',
        status: 'weak',
        writtenOrder: ['sentence-1-4', 'sentence-1-5', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9'],
        actualDependency: 'Khoảng trống giáo dục + bối cảnh thế giới kết nối cần dẫn tới một hệ quả cụ thể trước khi đoạn chuyển sang giải pháp tích hợp international news.',
        suggestedOrder: ['sentence-1-4', 'sentence-1-6', 'sentence-1-5', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9'],
        readerBurdenVi: 'Người đọc phải tự thêm bước trung gian: thiếu global awareness gây khó khăn cụ thể gì cho học sinh trong học tập, hợp tác hoặc đánh giá thông tin quốc tế.',
        diagnosticPattern: 'missing_bridge',
        issue: body1Underdevelopment,
      },
      {
        paragraphIndex: 2,
        edgeId: 'flow:body2-evidence-before-conclusion',
        fromNodeIds: ['sentence-2-2', 'sentence-2-5', 'sentence-2-6', 'sentence-2-7'],
        toNodeId: 'sentence-2-4',
        relationshipTag: 'JOINT SUPPORT',
        flowType: 'joint',
        status: 'broken',
        writtenOrder: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-4', 'sentence-2-5', 'sentence-2-6', 'sentence-2-7'],
        actualDependency: 'Reason về thiếu hướng dẫn cần dẫn sang example và consequence trước; sau đó mini conclusion mới có thể gom các ý này để nói curriculum integration có thể ineffective.',
        suggestedOrder: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5', 'sentence-2-6', 'sentence-2-7', 'sentence-2-4'],
        readerBurdenVi: 'Người đọc gặp “As a result” quá sớm, rồi phải quay lại gắn example phía sau vào conclusion đã đọc trước đó.',
        diagnosticPattern: 'conclusion_before_evidence',
        issue: body2Ordering,
      },
    ],
  },
  cohesionHighlights: [
    {
      ...locate('As a result'), highlightType: 'premature_conclusion_marker', label: 'Dùng sai từ nối', feedback: 'Ở “As a result”, bạn báo rằng phần nguyên nhân đã khép lại, nhưng ví dụ vẫn nằm phía sau. Cách dùng này làm người đọc đoán sai mạch của đoạn.', solutionFeedback: 'Bạn đưa ví dụ lên trước rồi giữ “As a result” cho câu kết, hoặc đổi câu này thành câu dẫn vào ví dụ.', references: refs(['flow', 'flow:body2-evidence-before-conclusion', 'Mạch ý Body 2']), paragraphIndex: 2, sentenceIndex: 4,
      errorCode: 'cohesive_device_misuse', errorLabelVi: 'Dùng sai từ nối',
    },
    {
      ...locate('this activity'), highlightType: 'reference_precision', label: 'Tham chiếu không rõ', feedback: 'Cụm “this activity” có thể là việc theo dõi news hoặc việc đưa môn học này vào chương trình. Ở câu kết, bạn nên gọi đúng đối tượng để người đọc không phải đoán.', solutionFeedback: 'Bạn dùng “teaching international news as a subject” hoặc “this curriculum component” nếu muốn giữ câu này.', references: refs(['node', 'sentence-2-4', 'Câu kết Body 2']), paragraphIndex: 2, sentenceIndex: 4,
      errorCode: 'unclear_reference', errorLabelVi: 'Tham chiếu không rõ',
    },
  ],
  lexicalHighlights: [],
  grammaticalHighlights: [],
  overallAssessment: {
    summaryVi: 'Bài đáp ứng đầy đủ dạng discuss both views và có một opinion nhất quán: international news hữu ích khi được dạy có cấu trúc. Điểm cần nâng không nằm ở việc thêm nhiều ý, mà ở việc để mỗi ý đi từ lý do, sang phần chứng minh, rồi mới tới câu kết. Body 2 hiện là nơi thấy rõ nhất khoảng cách này.',
    priorities: [
      { criterion: 'taskAchievement', titleVi: 'Biến nhận định chung thành điều người đọc có thể kiểm tra', actionVi: 'Mỗi khi dùng các nhãn như “problematic”, “effective” hoặc “inefficient”, hãy trả lời ngay: điều gì xảy ra, với ai, và vì sao điều đó dẫn đến kết luận của đoạn?', evidenceIds: ['issue:body1-omission-underdeveloped', 'issue:body1-overclaim-effective-solution'] },
      { criterion: 'coherenceCohesion', titleVi: 'Đặt phần chứng minh trước câu kết', actionVi: 'Ở Body 2, để lý do dẫn sang ví dụ, để ví dụ cho thấy hệ quả, rồi mới dùng câu kết để thu lại chuỗi đó.', evidenceIds: ['issue:body2-conclusion-before-evidence'] },
      { criterion: 'taskAchievement', titleVi: 'Để ví dụ bám đúng lý do đoạn đã nêu', actionVi: 'Khi đoạn nói vấn đề là lack of guidance, ví dụ phải cho thấy có hoặc thiếu teacher guidance, không đổi sang nguyên nhân khác như topic complexity.', evidenceIds: ['issue:body2-example-misses-mechanism'] },
    ],
    descriptorAlignment: [
      { criterion: 'taskAchievement', band: 7, rationaleVi: 'Bài trả lời đầy đủ các phần của đề và có stance rõ. Tuy nhiên, một số ý được phát triển không đều: phần giải thích chưa cụ thể và ví dụ ở Body 2 chưa làm rõ trực tiếp ý chính.', evidenceIds: ['issue:body1-omission-underdeveloped', 'issue:body2-example-misses-mechanism'] },
      { criterion: 'coherenceCohesion', band: 6.5, rationaleVi: 'Tổ chức đoạn và liên kết câu nhìn chung rõ, nhưng Body 2 ngắt mạch khi câu kết xuất hiện trước phần chứng minh; người đọc phải tự nối lý do, ví dụ và kết quả.', evidenceIds: ['issue:body2-conclusion-before-evidence'] },
      { criterion: 'lexicalResource', band: 7, rationaleVi: 'Bài có range từ vựng học thuật phù hợp. Các điểm cần sửa quan trọng hơn nằm ở việc triển khai luận điểm, không phải một lỗi lexical cục bộ.', evidenceIds: [] },
      { criterion: 'grammaticalRange', band: 7, rationaleVi: 'Cấu trúc câu nhìn chung được kiểm soát. Các vấn đề về trọng tâm và quan hệ nhân quả được đánh giá ở Task Response, không bị gán thành lỗi grammar.', evidenceIds: [] },
    ],
  },
  comparison: {
    targetBand: 8,
    revisedEssay: `Globalization has increased the importance of preparing students for international engagement. Some argue that including international news in school curricula can improve global awareness and practical skills, while others believe it may be ineffective without proper teaching and exam relevance.

On the one hand, many believe that using international news as a new subject is essential, as it allows secondary students to explore the world and acquire practical skills for their lives. While most education systems focus on foundational subjects such as mathematics, literature, and language, they often neglect global awareness and cultural understanding. This omission is particularly problematic because students who cannot interpret international perspectives are less prepared to collaborate across cultures or evaluate global issues that increasingly affect their study and work. To address this issue and promote international cooperation, integrating global news into the curriculum can be a valuable solution, as it would expose students to various cultures, lifestyles, and global perspectives, thereby enriching their knowledge and preparing them for future global engagement.

On the other hand, some argue that such a subject would waste students’ time when it is taught without proper methods and structured guidance. Keeping up with global news may feel meaningless to students, particularly those who are more focused on their final exams and therefore perceive the subject as impractical. For instance, when students are asked to study political affairs without guidance on how to assess sources or connect the topic to their studies, they may regard the lesson as boring and irrelevant. Over time, this disinterest may diminish the subject’s effectiveness and undermine its intended educational value. As a result, integrating this activity into the curriculum could be considered ineffective and redundant.

In conclusion, while adding international news to the curriculum has clear benefits in developing global awareness, its success depends on effective teaching methods. In my opinion, when lessons help students assess sources and connect international issues to their academic needs, this subject can be a valuable addition to education, helping students better prepare for a connected world.`,
    changeSummaryVi: 'Bản sửa giữ nguyên stance, bố cục và phần lớn câu gốc. Nó chỉ xử lý các lỗi đã có: thêm hệ quả cho “problematic”, hạ mức khẳng định “highly effective”, đưa lack of guidance vào câu chủ đề và ví dụ Body 2, rồi chuyển “As a result” xuống sau phần chứng minh.',
    preservedStrengthsVi: ['Giữ cấu trúc discuss both views + opinion rõ ràng.', 'Giữ insight rằng hiệu quả phụ thuộc vào proper teaching methods.', 'Giữ các ý gốc về global awareness, cultural understanding và exam relevance.'],
  },
};

const response = await fetch(`http://localhost:3000/api/writing/assessments/${taskId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, essay, analysis }),
});

if (!response.ok) throw new Error(`Persist failed: ${response.status} ${await response.text()}`);
console.log(JSON.stringify({ taskId, success: true, scores: analysis.scores, chunks: paragraphs.map(item => item.sentences.length), response: await response.json() }, null, 2));
