const taskId = 'p1-coherence-flow-test';
const prompt = 'Some people think international news should become a subject in secondary schools. Others think this would waste valuable school time. To what extent do you agree or disagree?';

const essay = `Whether international news should become a secondary-school subject is widely debated. Although it may consume time needed for examinations, I believe it should be taught because students need to understand the wider world.

Most schools devote nearly all of their timetable to examinable subjects. Therefore, international news should become a compulsory subject. Teenagers may later study or work with people from other countries. Teachers could ask them to compare two reports of the same event. International decisions can also influence local jobs and prices. By noticing which report is biased, students can choose more reliable sources. This gives them practical skills and proves that the subject is important.

On the other hand, opponents argue that news lessons waste valuable school time. Political events are often controversial, and examinations determine students’ future opportunities. This is why they may not understand it. Moreover, teachers can select age-appropriate reports and avoid difficult conflicts. Consequently, time spent on news would reduce the hours available for mathematics and languages. Such a subject is therefore unnecessary.

In conclusion, international news can take time from examinations, but it should be included because suitable material can make it useful.`;

function range(text, occurrence = 0) {
  let start = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    start = essay.indexOf(text, start + 1);
  }
  if (start < 0) throw new Error(`Could not locate source text: ${text}`);
  return { startChar: start, endChar: start + text.length, sourceText: text };
}

const TAXONOMY = {
  underdeveloped_idea: {
    criterion: 'task_response',
    labelVi: 'Ý chưa phát triển đủ',
    featureEn: 'main ideas are extended and supported; some may be insufficiently developed',
  },
  unclear_paragraph_job: {
    criterion: 'task_response',
    labelVi: 'Vai trò đoạn chưa rõ',
    featureEn: 'relevant main ideas with a clear focus',
  },
  conclusion_before_grounds: {
    criterion: 'coherence',
    labelVi: 'Kết luận đứng trước cơ sở chứng minh',
    featureEn: 'the message can be followed with ease',
  },
  interleaved_parallel_chains: {
    criterion: 'coherence',
    labelVi: 'Hai mạch ý song song bị đan xen',
    featureEn: 'ideas are logically sequenced with clear progression',
  },
  unclear_contrast_turn: {
    criterion: 'coherence',
    labelVi: 'Chuyển hướng đối lập chưa rõ',
    featureEn: 'ideas are logically organised and relationships are clear',
  },
  cohesive_device_misuse: {
    criterion: 'cohesion',
    labelVi: 'Dùng sai từ nối',
    featureEn: 'cohesive devices are used accurately and flexibly',
  },
  unclear_reference: {
    criterion: 'cohesion',
    labelVi: 'Tham chiếu không rõ',
    featureEn: 'referencing is clear and appropriate',
  },
};

function normalizeDescriptors(value) {
  if (Array.isArray(value)) {
    value.forEach(normalizeDescriptors);
    return value;
  }
  if (!value || typeof value !== 'object') return value;

  const entry = TAXONOMY[value.errorCode];
  if (entry) {
    value.errorLabelVi = entry.labelVi;
    value.descriptorAnchor = {
      criterion: entry.criterion,
      featureCode: value.errorCode,
      featureEn: entry.featureEn,
    };
  }

  Object.values(value).forEach(normalizeDescriptors);
  return value;
}

function paragraph(index, label, job, source, sentences) {
  const location = range(source);
  return {
    index,
    label,
    job,
    paragraphStartChar: location.startChar,
    paragraphEndChar: location.endChar,
    errors: [],
    review: { nodeId: `para-${index}`, status: 'works', job, assessment: 'Không có lỗi riêng ở cấp đoạn.' },
    sentences,
  };
}

function chunk(paragraphIndex, index, sourceSentenceIndex, role, sourceText, simplifiedIdea, errors = []) {
  const location = range(sourceText);
  return {
    index,
    nodeId: `sentence-${paragraphIndex}-${index}`,
    sourceSentenceIndex,
    chunkIndex: index,
    sourceText,
    startChar: location.startChar,
    endChar: location.endChar,
    role,
    simplifiedIdea,
    errors,
    review: {
      nodeId: `sentence-${paragraphIndex}-${index}`,
      status: errors.length ? 'weak' : 'works',
      job: simplifiedIdea,
      assessment: errors.length ? errors[0].message : 'Ý này tự thân không có lỗi cần tách riêng.',
      issues: [],
    },
  };
}

const body1Chunks = [
  chunk(1, 1, 1, 'setup', 'Most schools devote nearly all of their timetable to examinable subjects.', 'Chương trình hiện ưu tiên các môn thi cử'),
  chunk(1, 2, 2, 'claim', 'Therefore, international news should become a compulsory subject.', 'Kết luận rằng international news phải là môn bắt buộc'),
  chunk(1, 3, 3, 'context', 'Teenagers may later study or work with people from other countries.', 'Nhu cầu tiếp xúc với bối cảnh quốc tế trong tương lai'),
  chunk(1, 4, 4, 'mechanism', 'Teachers could ask them to compare two reports of the same event.', 'Hoạt động học: so sánh hai nguồn tin'),
  chunk(1, 5, 5, 'context', 'International decisions can also influence local jobs and prices.', 'Sự kiện quốc tế vẫn tác động tới đời sống địa phương'),
  chunk(1, 6, 6, 'mechanism', 'By noticing which report is biased,', 'Nhận diện thiên kiến trong nguồn tin'),
  chunk(1, 7, 6, 'result', 'students can choose more reliable sources.', 'Chọn nguồn đáng tin hơn'),
  chunk(1, 8, 7, 'result', 'This gives them practical skills', 'Hình thành kỹ năng thực tế'),
  chunk(1, 9, 7, 'mini_conclusion', 'and proves that the subject is important.', 'Kết luận môn học quan trọng'),
];

const body2Chunks = [
  chunk(2, 1, 1, 'claim', 'On the other hand, opponents argue that news lessons waste valuable school time.', 'Lập trường phản đối: môn học làm tốn thời gian'),
  chunk(2, 2, 2, 'reason', 'Political events are often controversial, and examinations determine students’ future opportunities.', 'Lý do được nêu: nội dung gây tranh cãi và học sinh cần ưu tiên kỳ thi'),
  chunk(2, 3, 3, 'explanation', 'This is why they may not understand it.', 'Kết quả được nêu nhưng đối tượng và quan hệ nguyên nhân chưa rõ'),
  chunk(2, 4, 4, 'concession', 'Moreover, teachers can select age-appropriate reports and avoid difficult conflicts.', 'Giải pháp giảm rủi ro của phía ủng hộ'),
  chunk(2, 5, 5, 'result', 'Consequently, time spent on news would reduce the hours available for mathematics and languages.', 'Quay lại hệ quả của phía phản đối'),
  chunk(2, 6, 6, 'mini_conclusion', 'Such a subject is therefore unnecessary.', 'Kết luận phản đối'),
];

const intro = 'Whether international news should become a secondary-school subject is widely debated. Although it may consume time needed for examinations, I believe it should be taught because students need to understand the wider world.';
const body1 = 'Most schools devote nearly all of their timetable to examinable subjects. Therefore, international news should become a compulsory subject. Teenagers may later study or work with people from other countries. Teachers could ask them to compare two reports of the same event. International decisions can also influence local jobs and prices. By noticing which report is biased, students can choose more reliable sources. This gives them practical skills and proves that the subject is important.';
const body2 = 'On the other hand, opponents argue that news lessons waste valuable school time. Political events are often controversial, and examinations determine students’ future opportunities. This is why they may not understand it. Moreover, teachers can select age-appropriate reports and avoid difficult conflicts. Consequently, time spent on news would reduce the hours available for mathematics and languages. Such a subject is therefore unnecessary.';
const conclusion = 'In conclusion, international news can take time from examinations, but it should be included because suitable material can make it useful.';

const flowOneIssue = {
  id: 'flow-body-1-order',
  errorCode: 'conclusion_before_grounds',
  errorLabelVi: 'Kết luận đứng trước cơ sở chứng minh',
  type: 'misordered_sequence',
  title: 'Kết luận xuất hiện trước khi chuỗi lý do được xây xong',
  whyWrong: 'Hãy nhìn vào C2 trên map: "Therefore" yêu cầu một kết quả, nhưng C1 mới chỉ nói lịch học đang ưu tiên môn thi. Các lý do cho việc học sinh cần international news và cách môn học tạo ra kỹ năng chỉ xuất hiện sau đó.',
  impactOnPurpose: 'Vì quyết định "compulsory subject" xuất hiện trước lý do, đoạn chưa dẫn người đọc từ vấn đề đến một lý do đủ mạnh để đưa môn học vào chương trình.',
  impactOnReader: 'Người đọc phải giữ kết luận trong đầu rồi tự chờ các ý sau để tìm phần chứng minh cho nó.',
  affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 1 }, { paraIndex: 1, sentenceIndex: 2 }, { paraIndex: 1, sentenceIndex: 3 }, { paraIndex: 1, sentenceIndex: 5 }, { paraIndex: 1, sentenceIndex: 8 }, { paraIndex: 1, sentenceIndex: 9 }] },
  nodeLinks: { primaryNodeIds: ['sentence-1-2'], contextNodeIds: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-8', 'sentence-1-9'] },
  evidenceSpans: [range('Therefore, international news should become a compulsory subject.'), range('Teenagers may later study or work with people from other countries.'), range('International decisions can also influence local jobs and prices.'), range('This gives them practical skills and proves that the subject is important.')],
  solutionActions: [
    { type: 'move_node', label: 'Đưa kết luận xuống cuối', details: 'Giữ C2 nhưng chuyển nó xuống sau khi đã giải thích nhu cầu và kỹ năng người học nhận được.', targetNodeId: 'sentence-1-2' },
    { type: 'suggest_order', label: 'Sắp lại mạch ý', details: 'Đi từ khoảng trống chương trình, nhu cầu thực tế, hoạt động học, kỹ năng, rồi mới kết luận về curriculum.', currentOrder: body1Chunks.map(item => item.nodeId), proposedOrder: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-2', 'sentence-1-9'], whyBetter: 'Khi người đọc biết học sinh cần gì trước, hoạt động so sánh nguồn tin sẽ có mục đích rõ; kết luận về môn học bắt buộc lúc đó là kết quả của cả chuỗi, không phải một khẳng định đến quá sớm.' },
  ],
};

const flowTwoIssue = {
  id: 'flow-body-1-interrupted-chain',
  errorCode: 'interleaved_parallel_chains',
  errorLabelVi: 'Hai mạch ý song song bị đan xen',
  type: 'misordered_sequence',
  title: 'Hai lý do cho nhu cầu học bị tách bởi một hoạt động',
  whyWrong: 'Đối chiếu C3 và C5: cả hai đều trả lời cùng một câu hỏi, "vì sao học sinh cần hiểu thông tin quốc tế?" C4 về việc so sánh hai bản tin lại chen vào giữa, nên đoạn chuyển sang cách dạy trước khi hoàn thành phần giải thích vì sao cần dạy.',
  impactOnPurpose: 'Phần nhu cầu thực tế không được tích lũy thành một lý do rõ ràng, còn hoạt động lớp học xuất hiện như một kỹ thuật chưa có mục đích.',
  impactOnReader: 'Người đọc phải tự nối C3 với C5, sau đó quay ngược lại để hiểu C4 liên quan gì đến hai ý đó.',
  affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 3 }, { paraIndex: 1, sentenceIndex: 4 }, { paraIndex: 1, sentenceIndex: 5 }, { paraIndex: 1, sentenceIndex: 6 }, { paraIndex: 1, sentenceIndex: 7 }, { paraIndex: 1, sentenceIndex: 8 }] },
  nodeLinks: { primaryNodeIds: ['sentence-1-3', 'sentence-1-5'], affectedNodeIds: ['sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8'] },
  evidenceSpans: [range('Teenagers may later study or work with people from other countries.'), range('Teachers could ask them to compare two reports of the same event.'), range('International decisions can also influence local jobs and prices.'), range('By noticing which report is biased, students can choose more reliable sources.')],
  solutionActions: [
    { type: 'move_node', label: 'Đặt hai lý do cạnh nhau', details: 'Đặt C3 và C5 liền nhau. Chúng không phải một ý mới, nhưng là hai mặt của cùng một câu trả lời về nhu cầu thực tế.', targetNodeIds: ['sentence-1-3', 'sentence-1-5'] },
    { type: 'add_bridge', label: 'Thêm cầu nối sang hoạt động học', details: 'Sau C3 và C5, thêm một câu chuyển giải thích rằng học sinh cần được luyện cách đánh giá nguồn tin quốc tế thay vì chỉ tiếp nhận chúng.', proposedNodeId: 'bridge-1', proposedRole: 'mechanism', proposedLabel: 'Cầu nối', proposedText: 'Để đáp ứng nhu cầu đó, học sinh cần được luyện cách đánh giá nguồn tin quốc tế thay vì chỉ tiếp nhận chúng thụ động.', whyBetter: 'Cầu nối biến C4 từ một hoạt động ngẫu nhiên thành cách giải quyết đúng nhu cầu mà C3 và C5 vừa thiết lập.' },
  ],
};

const flowThreeIssue = {
  id: 'flow-body-2-stance-break',
  errorCode: 'unclear_contrast_turn',
  errorLabelVi: 'Chuyển hướng đối lập chưa rõ',
  type: 'logical_jump',
  title: 'Đoạn phản đối tự chuyển sang giải pháp rồi kết luận ngược lại',
  whyWrong: 'Nhìn theo thứ tự C1 → C2 → C3 → C4 → C5 → C6: C1 đang mở lập trường phản đối, nhưng C4 lại đưa ra cách giáo viên giảm rủi ro. Sau đó "Consequently" ở C5 quay trở lại hệ quả tiêu cực mà không giải thích vì sao giải pháp ở C4 không đủ.',
  impactOnPurpose: 'Đoạn không giữ được một tuyến lập luận phản đối hoàn chỉnh, nên không thể đại diện công bằng cho mặt còn lại của đề.',
  impactOnReader: 'Người đọc không biết C4 là phản biện cho opponents hay là bằng chứng cho họ; vì vậy C5 và C6 trở nên thiếu cơ sở.',
  affectedNodes: { paragraphs: [2], sentences: [{ paraIndex: 2, sentenceIndex: 1 }, { paraIndex: 2, sentenceIndex: 3 }, { paraIndex: 2, sentenceIndex: 4 }, { paraIndex: 2, sentenceIndex: 5 }, { paraIndex: 2, sentenceIndex: 6 }] },
  nodeLinks: { primaryNodeIds: ['sentence-2-4'], contextNodeIds: ['sentence-2-1', 'sentence-2-3', 'sentence-2-5', 'sentence-2-6'] },
  evidenceSpans: [range('This is why they may not understand it.'), range('Moreover, teachers can select age-appropriate reports and avoid difficult conflicts.'), range('Consequently, time spent on news would reduce the hours available for mathematics and languages.'), range('Such a subject is therefore unnecessary.')],
  solutionActions: [
    { type: 'rewrite_node', label: 'Làm rõ hoặc chuyển C4', details: 'Nếu Body 2 là đoạn phản đối, thay C4 bằng một hệ quả thực sự của việc thiếu thời gian hoặc chuyển C4 sang đoạn phản biện sau đó.', targetNodeId: 'sentence-2-4', proposedText: 'Without a clear connection to examinations or assessed skills, students may treat the subject as an additional demand rather than a useful lesson.' },
    { type: 'change_relationship_tag', label: 'Sửa quan hệ kết quả', details: 'Chỉ dùng "Consequently" sau khi C3–C4 đã tạo đúng nguyên nhân dẫn tới việc mất thời gian học môn khác.', targetEdgeId: 'flow-body-2-stance-break', proposedRelationshipTag: 'KẾT QUẢ' },
  ],
};

const revisedEssay = `Whether international news should become a secondary-school subject is widely debated. Although it may consume some time needed for examinations, I believe it should be taught because students need practical ways to understand the wider world.

Most schools devote nearly all of their timetable to examinable subjects. Yet teenagers may later study or work with people from other countries, while international decisions can affect local jobs and prices. They therefore need to interpret information that reaches them from beyond their immediate environment. In class, teachers could ask students to compare two reports of the same event. By noticing which report is biased, students can choose more reliable sources and develop a practical skill for study, work, and daily life. For this reason, international news deserves a place in the curriculum rather than being treated as an optional extra.

On the other hand, opponents reasonably worry that news lessons could take time from examination subjects. Political events can be controversial, and students may see the topic as irrelevant when teachers provide no clear purpose or guidance. Without structured tasks, the subject could become an additional demand rather than a useful lesson. This concern does not mean that all news lessons are unnecessary, however: teachers can select age-appropriate reports and connect them to skills such as judging reliability and comparing viewpoints.

In conclusion, international news can take time from examinations, but suitable material and structured teaching can turn that time into a practical form of preparation for the wider world.`;

const analysis = {
  promptType: 'agree_disagree',
  scores: { overall: 6.5, taskAchievement: 6.5, coherenceCohesion: 6, lexicalResource: 7, grammaticalRange: 7 },
  assessmentAudit: {
    provisionalScores: { overall: 6.5, taskAchievement: 6.5, coherenceCohesion: 6, lexicalResource: 7, grammaticalRange: 7 },
    evidenceScores: { overall: 6.5, taskAchievement: 6.5, coherenceCohesion: 6, lexicalResource: 7, grammaticalRange: 7 },
    reconciliation: { changedCriteria: [], summaryVi: 'Bài có lập trường rõ và có nhiều ý phù hợp, nhưng Body 1 kết luận trước khi chứng minh đủ, còn Body 2 đổi hướng lập luận giữa chừng.' },
  },
  taskCoverage: [
    { id: 'position', requirement: 'State and support a clear opinion.', status: 'fully_addressed', evidenceNodeIds: ['sentence-0-2'], assessmentVi: 'Bài có lập trường rõ: ủng hộ việc dạy international news.' },
    { id: 'counterview', requirement: 'Address the opposing view.', status: 'partly_addressed', evidenceNodeIds: ['sentence-2-1', 'sentence-2-2'], assessmentVi: 'Có nêu lo ngại về thời gian và kỳ thi, nhưng lập luận phản đối bị lẫn với giải pháp của phía ủng hộ.' },
  ],
  argumentFlowOverview: {
    titleVi: 'Lập trường đã rõ; bây giờ cần kiểm tra đường chứng minh',
    bodyVi: 'Bạn đã chọn một position nhất quán: international news nên được dạy, dù có thể lấy bớt thời gian ôn thi. Hai đoạn thân bài cũng chạm đúng hai phía của đề. Vì vậy, bước tiếp theo không phải tìm thêm ý ngay, mà là xem mỗi đoạn đã đưa người đọc đi qua đúng các câu hỏi cần thiết để tin vào kết luận hay chưa.',
    nodeIds: ['sentence-0-2', 'sentence-1-2', 'sentence-2-1', 'sentence-3-1'],
  },
  argumentFlowChapters: [
    {
      id: 'argument-chapter-body-1',
      paragraphIndex: 1,
      titleVi: 'Body 1 đưa kết luận ra trước khi các lý do được đặt đúng chỗ',
      paragraphPromiseVi: 'Đoạn muốn chứng minh rằng international news xứng đáng có vị trí trong chương trình vì nó đáp ứng một nhu cầu thực tế và tạo ra một kỹ năng hữu ích.',
      macroAlignmentVi: 'Hướng đi này phù hợp với position của bài. Vấn đề không nằm ở việc đoạn chọn sai luận điểm, mà ở việc ba phần của luận điểm bị viết xen kẽ, trong khi kết luận lại xuất hiện trước khi hai phần đầu hoàn tất.',
      macroErrorType: 'coherence_order',
      hasMacroRearrangement: true,
      originalOrder: body1Chunks.map(item => item.nodeId),
      questions: [
        {
          id: 'body-1-q1',
          label: 'Q1',
          questionVi: 'Vì sao học sinh thực sự cần hiểu thông tin quốc tế?',
          purposeVi: 'Câu hỏi này thiết lập khoảng trống hoặc nhu cầu mà môn học phải giải quyết.',
          nodeIds: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5'],
        },
        {
          id: 'body-1-q2',
          label: 'Q2',
          questionVi: 'Môn học sẽ đáp ứng nhu cầu đó bằng cách nào?',
          purposeVi: 'Câu hỏi này phải nối hoạt động trong lớp với một kỹ năng cụ thể của học sinh.',
          nodeIds: ['sentence-1-4', 'sentence-1-6', 'sentence-1-7'],
        },
        {
          id: 'body-1-q3',
          label: 'Q3',
          questionVi: 'Kết quả đó đủ để biện minh cho một vị trí trong curriculum ra sao?',
          purposeVi: 'Câu hỏi cuối nâng “một hoạt động hữu ích” thành lý do để trường dạy kỹ năng này có hệ thống.',
          nodeIds: ['sentence-1-8'],
        },
      ],
      assignments: [
        { nodeId: 'sentence-1-1', questionId: 'body-1-q1', role: 'question' },
        { nodeId: 'sentence-1-2', role: 'conclusion' },
        { nodeId: 'sentence-1-3', questionId: 'body-1-q1', role: 'question' },
        { nodeId: 'sentence-1-4', questionId: 'body-1-q2', role: 'question' },
        { nodeId: 'sentence-1-5', questionId: 'body-1-q1', role: 'question' },
        { nodeId: 'sentence-1-6', questionId: 'body-1-q2', role: 'question' },
        { nodeId: 'sentence-1-7', questionId: 'body-1-q2', role: 'question' },
        { nodeId: 'sentence-1-8', questionId: 'body-1-q3', role: 'question' },
        { nodeId: 'sentence-1-9', role: 'conclusion' },
      ],
      diagnosisIntroVi: 'Đoạn mở bằng việc trường học dành gần hết thời gian cho các môn thi, rồi lập tức kết luận international news phải trở thành môn bắt buộc. Sau kết luận đó, đoạn mới lần lượt nói học sinh sẽ tiếp xúc với người nước ngoài, giáo viên có thể cho các em so sánh bản tin, rồi quay lại ảnh hưởng của các quyết định quốc tế. Người đọc phải tự gom các lý do đang bị tách xa nhau và tự đoán hoạt động so sánh bản tin đang giải quyết nhu cầu nào.',
      diagnosis: [
        {
          id: 'body-1-diagnosis-early-conclusion',
          titleVi: 'Kết luận xuất hiện trước phần chứng minh',
          bodyVi: '“Therefore, international news should become a compulsory subject” xuất hiện ngay sau thông tin trường học ưu tiên các môn thi. Hai câu này chưa cho thấy học sinh đang thiếu năng lực gì hoặc môn học mới sẽ giải quyết thiếu hụt đó ra sao. Vì vậy, đoạn yêu cầu người đọc chấp nhận kết luận trước khi nhìn thấy lý do.',
          nodeIds: ['sentence-1-1', 'sentence-1-2'],
        },
        {
          id: 'body-1-diagnosis-split-need',
          titleVi: 'Các lý do về nhu cầu thực tế đang bị tách ra',
          bodyVi: 'Thông tin về khoảng trống trong chương trình, việc học sinh có thể học hoặc làm việc với người nước ngoài, và ảnh hưởng của quyết định quốc tế đều đang giải thích vì sao các em cần hiểu thế giới rộng hơn. Nhưng hoạt động so sánh hai bản tin chen vào giữa các lý do này, khiến chúng không tích lũy thành một nhu cầu rõ ràng.',
          nodeIds: ['sentence-1-1', 'sentence-1-3', 'sentence-1-4', 'sentence-1-5'],
        },
        {
          id: 'body-1-diagnosis-activity-before-purpose',
          titleVi: 'Hoạt động lớp học xuất hiện trước khi mục đích được làm rõ',
          bodyVi: 'Câu về việc giáo viên cho học sinh so sánh hai bản tin đến khi đoạn vẫn chưa nói xong vì sao học sinh cần năng lực này. Hoạt động nghe có vẻ hợp lý, nhưng chưa được đọc như một câu trả lời trực tiếp cho nhu cầu vừa nêu; nó giống một ví dụ dạy học xuất hiện giữa hai lý do.',
          nodeIds: ['sentence-1-3', 'sentence-1-4', 'sentence-1-5'],
        },
        {
          id: 'body-1-diagnosis-broken-process',
          titleVi: 'Một quá trình hợp lý bị giấu trong nhiều ý khác nhau',
          bodyVi: 'So sánh hai bản tin tạo cơ hội nhận diện nguồn thiên lệch; nhận diện được thiên lệch mới giúp học sinh chọn nguồn đáng tin hơn. Ba ý này thực ra tạo thành một quá trình liên tục. Khi chúng không được đặt cạnh nhau, “practical skills” trông giống một lời đánh giá chung thay vì kết quả cụ thể của hoạt động học.',
          nodeIds: ['sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8'],
        },
        {
          id: 'body-1-diagnosis-missing-curriculum-link',
          titleVi: 'Lợi ích của hoạt động chưa tự chứng minh vị trí trong chương trình',
          bodyVi: 'Ngay cả khi chuỗi so sánh bản tin → nhận diện thiên lệch → chọn nguồn đáng tin được đọc liền nhau, nó mới cho thấy đây là một hoạt động hữu ích. Đoạn vẫn chưa giải thích vì sao kỹ năng đó cần được trường dạy có hệ thống thay vì chỉ là một hoạt động phụ. Đây là thiếu hụt nội dung, nên phần sắp xếp flow sẽ chỉ đánh dấu nó để xử lý sau.',
          nodeIds: ['sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9'],
        },
        {
          id: 'body-1-diagnosis-double-conclusion',
          titleVi: 'Hai kết luận đang dùng hai mức độ khẳng định khác nhau',
          bodyVi: 'Đầu đoạn gọi môn học là “compulsory”, còn cuối đoạn chỉ nói môn học “important”. Việc sắp lại flow có thể đưa hai kết luận về cùng một khu vực để nhìn rõ sự lặp lại, nhưng mức độ khẳng định nào phù hợp sẽ được xử lý như một lỗi lập luận riêng ở bước tiếp theo.',
          nodeIds: ['sentence-1-2', 'sentence-1-9'],
        },
      ],
      repairIntroVi: 'Ở bước này ta chưa viết thêm ý mới. Ta chỉ đặt những phần đang trả lời cùng một câu hỏi cạnh nhau, rồi đi từ nhu cầu thực tế sang hoạt động học, kết quả của hoạt động và cuối cùng mới tới kết luận.',
      repairSteps: [
        {
          id: 'body-1-repair-group',
          titleVi: 'Đặt các lý do về nhu cầu thực tế cạnh nhau',
          bodyVi: 'Thông tin về khoảng trống trong chương trình, tương tác quốc tế trong tương lai và ảnh hưởng của quyết định quốc tế đều trả lời câu hỏi đầu tiên. Đặt chúng cạnh nhau giúp người đọc hiểu trọn vẹn nhu cầu trước khi đoạn chuyển sang cách môn học đáp ứng nhu cầu đó.',
          nodeIds: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5'],
          order: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-2', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9'],
        },
        {
          id: 'body-1-repair-process',
          titleVi: 'Giữ hoạt động và kết quả của nó thành một chuỗi',
          bodyVi: 'Hoạt động so sánh phải đứng trước việc nhận diện thiên lệch, và nhận diện thiên lệch phải đứng trước việc chọn nguồn đáng tin. Đây là thứ tự của chính quá trình được mô tả: người học làm một việc, đưa ra phán đoán, rồi dùng phán đoán đó để lựa chọn tốt hơn.',
          nodeIds: ['sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8'],
          order: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-2', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9'],
        },
        {
          id: 'body-1-repair-conclusion',
          titleVi: 'Đưa cả hai kết luận về sau phần lý do',
          bodyVi: 'Hai câu kết luận đều phải xuất hiện sau phần nhu cầu và quá trình học, thay vì một câu đứng ngay đầu đoạn. Khi đặt chúng cạnh nhau ở cuối, bạn cũng nhìn thấy rõ hơn việc “compulsory” và “important” chưa cùng một mức khẳng định. Phần `Tiếp theo` sẽ xử lý sự khác biệt đó trên bài gốc.',
          nodeIds: ['sentence-1-2', 'sentence-1-9'],
          order: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9', 'sentence-1-2'],
        },
      ],
      finalOrder: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-9', 'sentence-1-2'],
      finalSummaryVi: 'Thứ tự mới gom các lý do về nhu cầu trước, giữ hoạt động và kết quả thành một chuỗi, rồi mới đưa kết luận xuống cuối. Nó chưa làm lập luận đầy đủ hơn; nó chỉ giúp bạn và người đọc nhìn thấy chính xác phần nào đã có và phần nội dung nào vẫn còn thiếu.',
      revisedChunks: [
        {
          nodeId: 'sentence-1-2',
          revisedText: 'For these reasons, international news should become a compulsory subject.',
          reasonVi: 'Kết luận giờ đứng sau toàn bộ chuỗi lý do, nên “For these reasons” gọi đúng phần chứng minh vừa xuất hiện thay vì tạo một kết quả quá sớm.',
        },
      ],
      taskAuditVi: 'Các thiếu hụt về độ phát triển, mức khẳng định và bằng chứng vẫn phải được nhận xét trên bài gốc ở phần Tiếp theo.',
    },
    {
      id: 'argument-chapter-body-2',
      paragraphIndex: 2,
      titleVi: 'Body 2 chưa quyết định đang trình bày hay phản biện opponents',
      paragraphPromiseVi: 'Đoạn cần trình bày công bằng lo ngại rằng news lessons lấy thời gian khỏi các môn thi, sau đó cho biết người viết chấp nhận hoặc giới hạn lo ngại đó như thế nào.',
      macroAlignmentVi: 'Topic sentence phù hợp với phần nhượng bộ trong position. Tuy nhiên đoạn chuyển qua lại giữa tiếng nói của opponents và giải pháp của người viết mà không đánh dấu ranh giới, nên kết luận cuối không còn theo được đường lập luận trước đó.',
      macroErrorType: 'coherence_order',
      hasMacroRearrangement: true,
      originalOrder: body2Chunks.map(item => item.nodeId),
      questions: [
        { id: 'body-2-q1', label: 'Q1', questionVi: 'Opponents đang lo ngại chính xác điều gì?', purposeVi: 'Xác định claim phản đối mà đoạn sẽ trình bày.', nodeIds: ['sentence-2-1'] },
        { id: 'body-2-q2', label: 'Q2', questionVi: 'Vì sao lo ngại đó có cơ sở?', purposeVi: 'Xây nguyên nhân và hệ quả trước khi kết luận cho phía phản đối.', nodeIds: ['sentence-2-2', 'sentence-2-3', 'sentence-2-5'] },
        { id: 'body-2-q3', label: 'Q3', questionVi: 'Người viết sẽ chấp nhận hay giới hạn lo ngại đó?', purposeVi: 'Tách tiếng nói của người viết khỏi lập luận opponents và nối lại với position toàn bài.', nodeIds: ['sentence-2-4'] },
      ],
      assignments: [
        { nodeId: 'sentence-2-1', questionId: 'body-2-q1', role: 'question' },
        { nodeId: 'sentence-2-2', questionId: 'body-2-q2', role: 'question' },
        { nodeId: 'sentence-2-3', questionId: 'body-2-q2', role: 'question' },
        { nodeId: 'sentence-2-4', questionId: 'body-2-q3', role: 'question' },
        { nodeId: 'sentence-2-5', questionId: 'body-2-q2', role: 'question' },
        { nodeId: 'sentence-2-6', role: 'conclusion' },
      ],
      diagnosisIntroVi: 'Đoạn mở bằng lo ngại của opponents về thời gian học, rồi giải thích áp lực từ nội dung gây tranh cãi và kỳ thi. Khi lập luận phản đối chưa hoàn tất, đoạn bất ngờ chuyển sang giải pháp chọn tài liệu phù hợp; ngay sau đó lại quay về kết luận môn học làm mất thời gian và không cần thiết. Người đọc không biết lúc nào tiếng nói của opponents kết thúc và lúc nào người viết bắt đầu phản hồi.',
      diagnosis: [
        { id: 'body-2-diagnosis-reference', titleVi: 'Một câu không gọi tên được nguyên nhân hay kết quả', bodyVi: '“This is why they may not understand it” để cả “this”, “they” và “it” mở. Người đọc không biết political events hay exam pressure đang gây ra phản ứng nào, và học sinh không hiểu bản tin, môn học hay chính trị.', nodeIds: ['sentence-2-2', 'sentence-2-3'] },
        { id: 'body-2-diagnosis-response-too-early', titleVi: 'Phần phản hồi bắt đầu khi phía phản đối chưa nói xong', bodyVi: 'Giải pháp chọn tài liệu phù hợp xuất hiện trước hệ quả về việc giảm thời gian cho mathematics và languages. Đoạn vì thế bắt đầu phản biện một concern mà chính nó chưa trình bày hoàn chỉnh.', nodeIds: ['sentence-2-3', 'sentence-2-4', 'sentence-2-5'] },
        { id: 'body-2-diagnosis-false-result', titleVi: 'Một giải pháp lại được nối thẳng sang hệ quả tiêu cực', bodyVi: 'Câu trước nói giáo viên có thể tránh nội dung khó; câu sau dùng “Consequently” để nói môn học làm mất thời gian. Hệ quả tiêu cực có thể đi theo concern về kỳ thi, nhưng không thể được đọc như kết quả của giải pháp vừa nêu.', nodeIds: ['sentence-2-1', 'sentence-2-2', 'sentence-2-4', 'sentence-2-5'] },
        { id: 'body-2-diagnosis-final-stance', titleVi: 'Kết luận của opponents bị đọc như kết luận của người viết', bodyVi: 'Sau khi đã nêu cách giảm rủi ro, đoạn vẫn kết luận môn học “unnecessary”. Vì không có ranh giới rõ giữa hai tiếng nói, kết luận này xung đột với position ở introduction và khiến người đọc không biết bài đang đồng ý với bên nào.', nodeIds: ['sentence-0-2', 'sentence-2-4', 'sentence-2-6'] },
      ],
      repairIntroVi: 'Ta chỉ đổi vị trí những câu đang có: hoàn thành concern của opponents trước, đặt kết luận của họ ngay sau phần lý do, rồi mới chuyển sang câu đưa ra cách giảm rủi ro.',
      repairSteps: [
        { id: 'body-2-repair-opponents', titleVi: 'Hoàn thành phần lý do của opponents trước', bodyVi: 'Đặt concern về thời gian, các lý do liên quan tới nội dung gây tranh cãi và kỳ thi, rồi hệ quả giảm thời gian cho mathematics và languages cạnh nhau. Người đọc lúc đó có thể theo được toàn bộ lý do phản đối trước khi đoạn chuyển sang phản hồi.', nodeIds: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5'], order: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5', 'sentence-2-4', 'sentence-2-6'] },
        { id: 'body-2-repair-boundary', titleVi: 'Đưa câu giảm nhẹ concern sang sau kết luận của opponents', bodyVi: 'Câu về việc giáo viên chọn tài liệu phù hợp thuộc phần giới hạn concern, không thuộc chuỗi lý do của opponents. Đưa nó xuống sau “unnecessary” giúp hai tiếng nói không còn chen vào nhau. Việc “Moreover” có phù hợp hay không là lỗi cohesion riêng và sẽ được xử lý ở phần Tiếp theo.', nodeIds: ['sentence-2-5', 'sentence-2-6', 'sentence-2-4'], order: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5', 'sentence-2-6', 'sentence-2-4'] },
      ],
      finalOrder: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5', 'sentence-2-6', 'sentence-2-4'],
      finalSummaryVi: 'Thứ tự mới cho opponents nói hết concern, lý do, hệ quả và kết luận trước khi người viết đưa ra cách giảm rủi ro. Nó chưa sửa tham chiếu mơ hồ, từ nối hoặc kết luận tuyệt đối; các lỗi đó vẫn được nhận xét trên bài gốc ở phần Tiếp theo.',
      revisedChunks: [
        {
          nodeId: 'sentence-2-5',
          revisedText: 'More importantly, time spent on news would reduce the hours available for mathematics and languages.',
          reasonVi: 'Sau khi gom toàn bộ phần phản đối, câu này bổ sung hệ quả mạnh nhất của concern thay vì giả vờ là kết quả trực tiếp của câu tham chiếu mơ hồ ngay trước đó.',
        },
        {
          nodeId: 'sentence-2-4',
          revisedText: 'However, teachers can select age-appropriate reports and avoid difficult conflicts.',
          reasonVi: 'Câu đã được chuyển sang sau kết luận của opponents, nên cần một dấu hiệu đối lập để người đọc biết tiếng nói của bài đang quay lại giới hạn concern đó.',
        },
      ],
      taskAuditVi: 'Các lỗi về độ rõ của claim, tham chiếu và cohesive devices vẫn phải được xử lý riêng trên bài gốc.',
    },
  ],
  pyramid: {
    macroAnswer: { text: 'International news should be taught because students need to understand the wider world.', errors: [], review: { nodeId: 'macro', status: 'works', job: 'Nêu lập trường toàn bài', assessment: 'Lập trường rõ và trả lời trực tiếp đề.' } },
    paragraphs: [
      paragraph(0, 'Introduction', 'Nêu tranh luận và lập trường', intro, [
        chunk(0, 1, 1, 'setup', 'Whether international news should become a secondary-school subject is widely debated.', 'Nêu chủ đề tranh luận'),
        chunk(0, 2, 2, 'final_stance', 'Although it may consume time needed for examinations, I believe it should be taught because students need to understand the wider world.', 'Nêu lập trường ủng hộ có nhượng bộ'),
      ]),
      {
        ...paragraph(1, 'Body 1', 'Giải thích vì sao international news có giá trị trong chương trình', body1, body1Chunks),
        errors: [{
          type: 'internal', errorCode: 'underdeveloped_idea', errorLabelVi: 'Ý chưa phát triển đủ', message: 'Lập luận mới chứng minh rằng kỹ năng đánh giá nguồn tin là hữu ích, nhưng chưa giải thích đủ vì sao kỹ năng đó cần một vị trí chính thức trong curriculum thay vì chỉ là hoạt động phụ.', explanation: 'Sau khi sửa thứ tự, đoạn cần thêm một lý do về curriculum: vì sao đây là kỹ năng học sinh cần được tiếp cận có hệ thống.', affectedNodes: { paragraphs: [1], sentences: [{ paraIndex: 1, sentenceIndex: 8 }, { paraIndex: 1, sentenceIndex: 9 }] }, nodeLinks: { primaryNodeIds: ['sentence-1-8', 'sentence-1-9'], contextNodeIds: ['sentence-1-1'] }, evidenceSpans: [range('This gives them practical skills and proves that the subject is important.')], comment: { bodyVi: 'Sau khi đã theo mạch C3 → C5 → C4 → C6/C7, hãy nhìn lại C8/C9: đoạn mới chứng minh kỹ năng này có ích. Bạn còn cần nối thêm một bước nhỏ để giải thích vì sao trường nên dành chỗ chính thức cho kỹ năng đó.', solutionBodyVi: 'Bản sửa giữ ý về practical skills nhưng đặt nó trước kết luận curriculum, rồi cho kết luận này dựa trên cả nhu cầu thực tế lẫn kết quả học cụ thể.' }, proposedFix: { type: 'add_node', details: 'Bổ sung một câu giải thích vì sao kỹ năng đánh giá thông tin cần được dạy có hệ thống trong trường.', proposedText: 'Because these skills affect study, work, and daily decisions, schools should teach them systematically rather than leaving students to acquire them by chance.' } }],
      },
      {
        ...paragraph(2, 'Body 2', 'Trình bày lo ngại về thời gian học và điều kiện để môn học có ích', body2, body2Chunks),
        errors: [{
          type: 'internal', errorCode: 'unclear_paragraph_job', errorLabelVi: 'Vai trò đoạn chưa rõ', message: 'Đoạn mở bằng tiếng nói của opponents nhưng lại chen vào giải pháp của phía ủng hộ trước khi hoàn thành lập luận phản đối.', explanation: 'Body 2 cần hoặc hoàn thành lo ngại trước rồi mới phản biện, hoặc tách phần phản biện thành một đoạn/chuyển ý rõ ràng.', affectedNodes: { paragraphs: [2], sentences: [{ paraIndex: 2, sentenceIndex: 1 }, { paraIndex: 2, sentenceIndex: 4 }, { paraIndex: 2, sentenceIndex: 6 }] }, nodeLinks: { primaryNodeIds: ['sentence-2-1', 'sentence-2-4', 'sentence-2-6'] }, evidenceSpans: [range('On the other hand, opponents argue that news lessons waste valuable school time.'), range('Moreover, teachers can select age-appropriate reports and avoid difficult conflicts.'), range('Such a subject is therefore unnecessary.')], comment: { bodyVi: 'Đặt C1, C4 và C6 cạnh nhau trên map: C1 mở lập trường phản đối, C4 lại đưa giải pháp cho phía ủng hộ, còn C6 trở về kết luận phản đối. Hãy xác định xem đoạn này muốn làm công việc nào trước.', solutionBodyVi: 'Bản sửa giữ concern về thời gian, nhưng chỉ đưa giải pháp của giáo viên sau khi concern đã được giải thích đầy đủ và được đặt trong phần phản biện rõ ràng.' } }],
      },
      paragraph(3, 'Conclusion', 'Khép lại lập trường có điều kiện', conclusion, [
        chunk(3, 1, 1, 'final_stance', 'In conclusion, international news can take time from examinations, but it should be included because suitable material can make it useful.', 'Kết lại lập trường có điều kiện'),
      ]),
    ],
    edgeReviews: [],
    coherenceFlows: [
      { paragraphIndex: 1, edgeId: 'flow-body-1-order', fromNodeIds: ['sentence-1-1'], toNodeId: 'sentence-1-2', relationshipTag: 'THEREFORE', flowType: 'conclusion', status: 'broken', writtenOrder: body1Chunks.map(item => item.nodeId), actualDependency: 'C2 kết luận trước khi C3–C8 tạo đủ lý do và cơ chế.', suggestedOrder: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-2', 'sentence-1-9'], diagnosticPattern: 'conclusion_before_grounds', readerBurdenVi: 'Người đọc phải tự chờ và ghép các lý do xuất hiện sau kết luận.', issue: flowOneIssue },
      { paragraphIndex: 1, edgeId: 'flow-body-1-interrupted-chain', fromNodeIds: ['sentence-1-3', 'sentence-1-5'], toNodeId: 'sentence-1-4', relationshipTag: 'NHU CẦU → CÁCH ĐÁP ỨNG', flowType: 'joint', status: 'weak', writtenOrder: body1Chunks.map(item => item.nodeId), actualDependency: 'C3 và C5 là hai lý do cùng loại nhưng bị C4 cắt ngang.', suggestedOrder: ['sentence-1-1', 'sentence-1-3', 'sentence-1-5', 'sentence-1-4', 'sentence-1-6', 'sentence-1-7', 'sentence-1-8', 'sentence-1-2', 'sentence-1-9'], diagnosticPattern: 'interleaved_parallel_chains', readerBurdenVi: 'Người đọc phải tự quay lại nối hai lý do rồi mới hiểu hoạt động lớp học.', issue: flowTwoIssue },
      { paragraphIndex: 2, edgeId: 'flow-body-2-stance-break', fromNodeIds: ['sentence-2-1', 'sentence-2-3', 'sentence-2-4'], toNodeId: 'sentence-2-5', relationshipTag: 'CONSEQUENTLY', flowType: 'contrast', status: 'broken', writtenOrder: body2Chunks.map(item => item.nodeId), actualDependency: 'C4 đổi sang cách giảm rủi ro nhưng C5 lại kết luận theo hướng đối lập.', suggestedOrder: ['sentence-2-1', 'sentence-2-2', 'sentence-2-3', 'sentence-2-5', 'sentence-2-6', 'sentence-2-4'], diagnosticPattern: 'contrast_turn_unclear', readerBurdenVi: 'Người đọc không biết đoạn đang phát triển lập trường phản đối hay đang phản biện nó.', issue: flowThreeIssue },
    ],
  },
  cohesionHighlights: [
    { ...range('Therefore,'), errorCode: 'cohesive_device_misuse', errorLabelVi: 'Dùng sai từ nối', highlightType: 'cohesive_device_misuse', label: 'Dùng sai từ nối', feedback: 'Từ "Therefore" báo hiệu kết quả, nhưng phần trước chưa tạo đủ nguyên nhân cho kết luận về compulsory subject.', correction: 'For this reason,', solutionFeedback: 'Chỉ dùng liên từ kết quả sau khi các lý do và kết quả học tập đã được xây xong.' },
    { ...range('This is why they may not understand it.'), errorCode: 'unclear_reference', errorLabelVi: 'Tham chiếu không rõ', highlightType: 'unclear_reference', label: 'Tham chiếu không rõ', feedback: '"This" và "they" không chỉ rõ đang nói tới điều gì và ai không hiểu điều gì. Việc này làm mắt xích giữa concern về kỳ thi và kết quả bị mờ.', correction: 'Without clear guidance, exam-focused students may see the subject as irrelevant.', solutionFeedback: 'Gọi tên nguyên nhân và đối tượng trực tiếp để người đọc không phải đoán.' },
    { ...range('Moreover,'), errorCode: 'cohesive_device_misuse', errorLabelVi: 'Dùng sai từ nối', highlightType: 'cohesive_device_misuse', label: 'Dùng sai từ nối', feedback: '"Moreover" thường thêm bằng chứng cho cùng một hướng, nhưng câu này lại đưa giải pháp giảm bớt concern vừa được nêu.', correction: 'However,', solutionFeedback: 'Dùng tín hiệu chuyển hướng khi đoạn bắt đầu phản biện concern.' },
    { ...range('Consequently,'), errorCode: 'cohesive_device_misuse', errorLabelVi: 'Dùng sai từ nối', highlightType: 'cohesive_device_misuse', label: 'Dùng sai từ nối', feedback: 'Câu trước vừa nói giáo viên có thể tránh rủi ro; vì vậy "Consequently" không thể dẫn thẳng tới một hệ quả tiêu cực nếu không có thêm bước giải thích.', correction: 'Even so,', solutionFeedback: 'Hoặc hoàn thành lập luận phản đối trước, hoặc dùng tín hiệu nhượng bộ phù hợp.' },
  ],
  lexicalHighlights: [],
  grammaticalHighlights: [],
  overallAssessment: {
    summaryVi: 'Bài có lập trường rõ và nhiều ý phù hợp với đề. Điểm hạn chế chính là các lý do, hoạt động học, kết quả và kết luận chưa được đặt theo đường đi mà người đọc cần; vì vậy hai đoạn thân bài chưa phát triển được sức thuyết phục tương xứng với ý tưởng có sẵn.',
    priorities: [
      { criterion: 'coherenceCohesion', titleVi: 'Xây đường đi cho mỗi đoạn', actionVi: 'Trước khi kết luận, gom các ý đang trả lời cùng một câu hỏi; sau đó mới chuyển sang cách giải quyết và kết quả.', evidenceIds: ['flow-body-1-order', 'flow-body-1-interrupted-chain'] },
      { criterion: 'taskAchievement', titleVi: 'Chứng minh đúng mức độ của kết luận', actionVi: 'Khi khẳng định một môn học nên có trong curriculum, giải thích vì sao kỹ năng đó cần được dạy có hệ thống.', evidenceIds: ['sentence-1-8', 'sentence-1-9'] },
    ],
    descriptorAlignment: [
      { criterion: 'coherenceCohesion', band: 6, rationaleVi: 'Information and ideas are generally arranged coherently, but cohesion and progression are faulty in important places.', evidenceIds: ['flow-body-1-order', 'flow-body-2-stance-break'] },
      { criterion: 'taskAchievement', band: 6.5, rationaleVi: 'A relevant position is presented, but important ideas need clearer development and support.', evidenceIds: ['sentence-1-8', 'sentence-1-9'] },
    ],
  },
  comparison: {
    targetBand: 8,
    revisedEssay,
    changeSummaryVi: 'Bản sửa giữ gần như toàn bộ ý gốc, nhưng đưa lý do về nhu cầu thực tế lên trước hoạt động lớp học, nối hoạt động với kỹ năng rõ hơn, và chỉ đặt kết luận curriculum ở cuối chuỗi. Body 2 cũng tách concern của opponents khỏi phần phản biện.',
    preservedStrengthsVi: ['Giữ lập trường ủng hộ có điều kiện.', 'Giữ concern về thời gian và kỳ thi.', 'Giữ ví dụ so sánh hai nguồn tin và kỹ năng đánh giá bias.'],
  },
};

normalizeDescriptors(analysis);

const response = await fetch(`http://localhost:3000/api/writing/assessments/${taskId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, essay, analysis }),
});

if (!response.ok) {
  throw new Error(`Could not save assessment: ${await response.text()}`);
}

console.log(JSON.stringify({ taskId, paragraphs: analysis.pyramid.paragraphs.length, chunks: analysis.pyramid.paragraphs.map(item => item.sentences.length), flows: analysis.pyramid.coherenceFlows.length }));
