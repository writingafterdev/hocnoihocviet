// Demo essay + analysis for previewing the Task 2 Reasoning Map UI

export const DEMO_PROMPT = `Some people believe that technology has made human communication easier and more effective. Others argue that it has caused people to become more isolated and less able to communicate face-to-face. Discuss both views and give your own opinion.`;

export const DEMO_ESSAY = `In recent decades, technology has dramatically changed the way people communicate with one another. While some argue that these changes have fostered isolation and weakened interpersonal skills, I believe that technology, on balance, strengthens human connection more than it damages it.

Those who claim technology causes isolation often point to the prevalence of social media and smartphones. People have become so absorbed in their devices that face-to-face communication has deteriorated. A teenager at a family dinner staring at a phone instead of engaging is a familiar image. However, this argument confuses correlation with causation and does not account for the social context.

On the other hand, technology has created unprecedented opportunities for meaningful connection. Platforms such as video calling allow families separated by thousands of miles to maintain daily contact. Furthermore, online communities bring together people with shared interests who would never have met otherwise. Technology does not isolate people — it expands the network of relationships available to them.

In conclusion, while concerns about isolation are understandable, the weight of evidence points in the opposite direction. Technology has made human communication more frequent, more diverse, and more accessible. The challenge is not the technology itself but how individuals choose to use it.`;

// Pre-computed character offsets for DEMO_ESSAY
// Para 0: 0–283  (Introduction)
// Para 1: 285–566 (Body 1)
// Para 2: 568–855 (Body 2)
// Para 3: 857–1058 (Conclusion)

import { WritingAnalysis } from '@/types/writing';

export const DEMO_ANALYSIS: WritingAnalysis = {
  promptType: 'discuss_both',

  scores: {
    overall: 7.0,
    taskAchievement: 7,
    coherenceCohesion: 7,
    lexicalResource: 7,
    grammaticalRange: 6,
  },

  pyramid: {
    macroAnswer: {
      text: 'Technology, on balance, strengthens human connection more than it causes isolation.',
      errors: [],
    },
    paragraphs: [
      {
        index: 0,
        label: 'Introduction',
        job: 'Introduce both views and state a clear position',
        paragraphStartChar: 0,
        paragraphEndChar: 283,
        errors: [],
        sentences: [
          {
            index: 1,
            startChar: 0,
            endChar: 99,
            role: 'setup',
            simplifiedIdea: 'Technology has changed how people communicate in recent decades',
            errors: [],
          },
          {
            index: 2,
            startChar: 100,
            endChar: 283,
            role: 'final_stance',
            simplifiedIdea: 'Writer believes technology strengthens connection more than it harms',
            errors: [],
          },
        ],
      },
      {
        index: 1,
        label: 'Body 1',
        job: 'Present the isolation argument and its limitations',
        paragraphStartChar: 285,
        paragraphEndChar: 566,
        errors: [
          {
            type: 'internal',
            message: "The paragraph presents the isolation view but never engages seriously with its strongest form. The rebuttal ('confuses correlation with causation') is asserted without evidence — what specific research or logic supports this claim?",
          },
        ],
        sentences: [
          {
            index: 1,
            startChar: 285,
            endChar: 388,
            role: 'claim',
            simplifiedIdea: 'Critics say social media and smartphones cause isolation',
            errors: [],
          },
          {
            index: 2,
            startChar: 389,
            endChar: 459,
            role: 'reason',
            simplifiedIdea: 'People absorbed in devices leads to weaker face-to-face skills',
            errors: [],
          },
          {
            index: 3,
            startChar: 460,
            endChar: 528,
            role: 'example',
            simplifiedIdea: 'Teenager on phone at family dinner as a typical image',
            errors: [
              {
                type: 'internal',
                message: "This example is anecdotal and not specific. 'A familiar image' is not evidence — it restates the claim using imagery without demonstrating any causal link between device use and reduced communication quality.",
                explanation: "'A teenager at a family dinner' is only a familiar scene. It illustrates the idea of isolation, but it does not prove that device use causes weaker face-to-face communication.",
                suggestion: 'Rewrite the example so it contains a concrete observation, mechanism, or evidence that directly supports the isolation claim.',
                affectedNodes: {
                  paragraphs: [1],
                  sentences: [{ paraIndex: 1, sentenceIndex: 3 }],
                },
                proposedFix: {
                  type: 'rewrite',
                  details: 'Rewrite the example as evidence rather than a vague image.',
                  proposedText: 'Heavy phone use during meals reduces eye contact and shortens face-to-face conversation',
                  whyBetter: 'This gives the example a causal mechanism, so it supports the isolation claim instead of only illustrating it.',
                },
              },
            ],
          },
          {
            index: 4,
            startChar: 529,
            endChar: 566,
            role: 'mini_conclusion',
            simplifiedIdea: 'The isolation argument confuses correlation with causation',
            errors: [
              {
                type: 'relational',
                direction: 'horizontal',
                message: "S4 rebuts S1–S3 but provides no bridge. The reader moves from 'familiar image' directly to 'confuses correlation with causation' with no explanation of why the correlation–causation distinction applies here.",
              },
            ],
          },
        ],
      },
      {
        index: 2,
        label: 'Body 2',
        job: 'Present the connection argument supporting the writer\'s position',
        paragraphStartChar: 568,
        paragraphEndChar: 855,
        errors: [],
        sentences: [
          {
            index: 1,
            startChar: 568,
            endChar: 642,
            role: 'claim',
            simplifiedIdea: 'Technology creates opportunities for meaningful connection',
            errors: [],
          },
          {
            index: 2,
            startChar: 643,
            endChar: 738,
            role: 'example',
            simplifiedIdea: 'Video calling allows distant families to stay in daily contact',
            errors: [],
            transitionToNext: 'BỔ SUNG',
          },
          {
            index: 3,
            startChar: 739,
            endChar: 812,
            role: 'example',
            simplifiedIdea: 'Online communities connect people with shared interests',
            errors: [
              {
                type: 'relational',
                direction: 'horizontal',
                message: "S3 introduces a second example with 'Furthermore' but does not explain how it adds to S2's point. Two examples of the same type (connection enabled by tech) without a mechanism linking them to the paragraph's claim weakens the development.",
                explanation: "Câu này liệt kê thêm một ví dụ nữa nhưng không đào sâu phân tích. Nếu chỉ nối tiếp các ví dụ bằng 'Furthermore' mà không có sự giải thích hay phát triển ý, đoạn văn sẽ giống như một danh sách liệt kê rời rạc.",
                suggestion: "Hãy kết nối ví dụ này với luận điểm chính, hoặc thay đổi nhãn quan hệ để chỉ ra nó bổ sung ý nghĩa gì cho S2.",
                affectedNodes: {
                  paragraphs: [2],
                  sentences: [{ paraIndex: 2, sentenceIndex: 2 }, { paraIndex: 2, sentenceIndex: 3 }]
                },
                proposedFix: {
                  type: 'change_relationship',
                  details: 'Thay đổi nhãn quan hệ giữa S2 và S3 từ "BỔ SUNG" thành "KẾT QUẢ" và sửa câu S3 thành câu phân tích tác động.'
                }
              },
            ],
          },
          {
            index: 4,
            startChar: 813,
            endChar: 855,
            role: 'mini_conclusion',
            simplifiedIdea: 'Technology expands relationships rather than limiting them',
            errors: [],
          },
        ],
      },
      {
        index: 3,
        label: 'Conclusion',
        job: 'Restate position and close the argument',
        paragraphStartChar: 857,
        paragraphEndChar: 1058,
        errors: [
          {
            type: 'relational',
            direction: 'vertical',
            message: "The conclusion does not refer back to the specific limitation noted in Body 1 (the correlation/causation weakness). A strong conclusion would acknowledge the nuance and reinforce why it doesn't undermine the overall position.",
          },
        ],
        sentences: [
          {
            index: 1,
            startChar: 857,
            endChar: 934,
            role: 'concession',
            simplifiedIdea: 'Isolation concerns are understandable',
            errors: [],
          },
          {
            index: 2,
            startChar: 935,
            endChar: 1014,
            role: 'final_stance',
            simplifiedIdea: 'Technology has made communication more frequent, diverse, and accessible',
            errors: [],
          },
          {
            index: 3,
            startChar: 1015,
            endChar: 1058,
            role: 'mini_conclusion',
            simplifiedIdea: 'The problem is how we use technology, not technology itself',
            errors: [],
          },
        ],
      },
    ],
    edgeReviews: [
      {
        edgeId: 'edge:sentence:2:2->3',
        fromNodeId: 'sentence-2-2',
        toNodeId: 'sentence-2-3',
        relationshipTag: 'BỔ SUNG',
        expectedRelationship: 'The second example should add a distinct supporting angle to the previous example.',
        actualRelationship: "It repeats the same broad point, technology creates connection, without showing a new mechanism.",
        status: 'weak',
        assessment: "The relationship tag says addition, but the second example does not clearly add a new layer to the argument.",
        issues: [
          {
            id: 'issue-b2-s2-s3-addition',
            type: 'wrong_relationship',
            direction: 'horizontal',
            title: 'Addition tag hides a weak relationship',
            whyWrong: "'Furthermore' adds another example, but the sentence does not explain how online communities extend the video-calling point.",
            impactOnPurpose: 'Body 2 is meant to build the stronger connection argument. Listing two similar examples without a distinct mechanism weakens development.',
            impactOnReader: 'The reader sees two examples but not a progression, so the paragraph feels like a list rather than a reasoned argument.',
            affectedNodes: {
              paragraphs: [2],
              sentences: [
                { paraIndex: 2, sentenceIndex: 2 },
                { paraIndex: 2, sentenceIndex: 3 },
              ],
            },
            solutionActions: [
              {
                type: 'change_relationship_tag',
                label: 'Change relationship tag',
                details: 'Change BỔ SUNG to MỞ RỘNG if S3 explains a different kind of connection.',
                targetEdgeId: 'edge:sentence:2:2->3',
                proposedRelationshipTag: 'MỞ RỘNG',
              },
              {
                type: 'add_bridge',
                label: 'Add a bridge node',
                details: 'Insert a short mechanism sentence between the two examples so the second example is not just another item in a list.',
                targetEdgeId: 'edge:sentence:2:2->3',
                proposedNodeId: 'proposed-bridge-2-2-3',
                parentNodeId: 'para-2',
                insertAfterNodeId: 'sentence-2-2',
                insertBeforeNodeId: 'sentence-2-3',
                proposedRole: 'mechanism',
                proposedLabel: 'BRIDGE',
                proposedText: 'This matters because digital tools sustain both existing ties and new interest-based relationships.',
                whyBetter: 'It shows why the second example matters for the paragraph: video calls maintain existing family ties, while online communities create new interest-based relationships. That progression helps the reader see development instead of a list of similar examples.',
              },
              {
                type: 'rewrite_node',
                label: 'Rewrite S3 as a mechanism',
                details: 'Explain why online communities create relationships that offline life would not make possible.',
                targetNodeId: 'sentence-2-3',
                proposedText: 'Online communities create new relationships that offline life would not make possible',
                whyBetter: 'This wording adds a distinct mechanism, making the second example extend the first rather than repeat it.',
              },
            ],
          },
        ],
      },
    ],
    coherenceFlows: [
      {
        paragraphIndex: 2,
        edgeId: 'flow:2:sentence-2-2+sentence-2-3->sentence-2-1',
        fromNodeIds: ['sentence-2-2', 'sentence-2-3'],
        toNodeId: 'sentence-2-1',
        relationshipTag: 'JOINT SUPPORT',
        flowType: 'joint',
        status: 'weak',
        issue: {
          id: 'issue-b2-flow-joint-support',
          type: 'misordered_sequence',
          direction: 'horizontal',
          title: 'Examples support the claim as a pair',
          whyWrong: 'S2 and S3 are not just two next-step additions. Together, they supply the evidence for the broader Body 2 claim that technology strengthens connection.',
          impactOnPurpose: 'Body 2 is meant to prove the stronger connection side. When the evidence is treated as a simple list after the claim, the paragraph development feels flatter.',
          impactOnReader: 'The reader meets the claim before seeing the two pieces of support as a combined reason, so the dependency has to be reconstructed mentally.',
          affectedNodes: {
            paragraphs: [2],
            sentences: [
              { paraIndex: 2, sentenceIndex: 1 },
              { paraIndex: 2, sentenceIndex: 2 },
              { paraIndex: 2, sentenceIndex: 3 },
              { paraIndex: 2, sentenceIndex: 4 },
            ],
          },
          solutionActions: [
            {
              type: 'suggest_order',
              label: 'Show suggested progression',
              details: 'Group the two examples first, then let the paragraph claim collect them into one conclusion.',
              targetEdgeId: 'flow:2:sentence-2-2+sentence-2-3->sentence-2-1',
              currentOrder: [
                'sentence-2-1',
                'sentence-2-2',
                'sentence-2-3',
                'sentence-2-4',
              ],
              proposedOrder: [
                'sentence-2-2',
                'sentence-2-3',
                'sentence-2-1',
                'sentence-2-4',
              ],
              dependencyClaim: 'S2 and S3 jointly support S1; S1 should read as the collected claim after the evidence.',
              whyBetter: 'The reader first sees the two forms of connection, maintaining family ties and creating interest-based relationships, then receives the broader claim. That order makes the support relationship visible instead of asking the reader to infer it after the fact.',
            },
          ],
        },
      },
      {
        paragraphIndex: 2,
        edgeId: 'flow:2:sentence-2-1->sentence-2-4',
        fromNodeIds: ['sentence-2-1'],
        toNodeId: 'sentence-2-4',
        relationshipTag: 'CONCLUSION',
        flowType: 'conclusion',
        status: 'works',
        issue: {
          id: 'issue-b2-flow-context-conclusion',
          type: 'relational',
          direction: 'horizontal',
          title: 'The paragraph claim leads to the mini-conclusion',
          whyWrong: 'This edge is context for the map, not an error.',
          impactOnPurpose: 'It shows where the paragraph is trying to end after the evidence is collected.',
          impactOnReader: 'The reader can see the intended final step of the paragraph.',
          affectedNodes: {
            paragraphs: [2],
            sentences: [
              { paraIndex: 2, sentenceIndex: 1 },
              { paraIndex: 2, sentenceIndex: 4 },
            ],
          },
          solutionActions: [],
        },
      },
    ],
  },

  cohesionHighlights: [
    {
      startChar: 488,
      endChar: 495,
      highlightType: 'linker',
      label: 'Contrast linker',
      feedback: "'However' correctly signals the counter-argument turn.",
    },
    {
      startChar: 568,
      endChar: 588,
      highlightType: 'linker',
      label: 'Contrast linker',
      feedback: "'On the other hand' clearly signals the shift to the writer's supported view.",
    },
    {
      startChar: 739,
      endChar: 750,
      highlightType: 'missing_link',
      label: 'Weak transition',
      feedback: "'Furthermore' here adds a second example without explaining how it extends the first — consider 'Beyond this' or integrating both examples under one explanatory claim.",
    },
    {
      startChar: 857,
      endChar: 884,
      highlightType: 'linker',
      label: 'Concession opener',
      feedback: "'In conclusion, while' is a clean opener that signals both closure and nuance.",
    },
  ],

  lexicalHighlights: [
    {
      startChar: 52,
      endChar: 73,
      highlightType: 'strong_vocab',
      label: 'Precise verb',
      feedback: "'dramatically changed' is vivid and appropriate for the register.",
    },
    {
      startChar: 309,
      endChar: 319,
      highlightType: 'strong_vocab',
      label: 'Precise adjective',
      feedback: "'prevalence' is an accurate and academically appropriate word choice.",
    },
    {
      startChar: 389,
      endChar: 407,
      highlightType: 'weak_vocab',
      label: 'Vague phrasing',
      feedback: "'absorbed in their devices' is colloquial. Consider 'preoccupied with digital devices' for a more academic register.",
    },
    {
      startChar: 606,
      endChar: 619,
      highlightType: 'strong_vocab',
      label: 'Strong collocation',
      feedback: "'unprecedented opportunities' is a strong academic collocation used correctly.",
    },
    {
      startChar: 936,
      endChar: 960,
      highlightType: 'repetition',
      label: 'Lexical repetition',
      feedback: "'communication' appears in both the conclusion's second and the body paragraphs without variation — consider 'human interaction' or 'interpersonal exchange' to show range.",
    },
  ],

  grammaticalHighlights: [],
};

export const EMPTY_ANALYSIS: WritingAnalysis = {
  promptType: 'discuss_both',
  scores: {
    overall: 0,
    taskAchievement: 0,
    coherenceCohesion: 0,
    lexicalResource: 0,
    grammaticalRange: 0,
  },
  pyramid: {
    macroAnswer: {
      text: '',
      errors: [],
    },
    paragraphs: [
      {
        index: 0,
        label: '',
        job: '',
        paragraphStartChar: 0,
        paragraphEndChar: 0,
        errors: [],
        sentences: [],
      },
      {
        index: 1,
        label: '',
        job: '',
        paragraphStartChar: 0,
        paragraphEndChar: 0,
        errors: [],
        sentences: [],
      },
      {
        index: 2,
        label: '',
        job: '',
        paragraphStartChar: 0,
        paragraphEndChar: 0,
        errors: [],
        sentences: [],
      },
    ],
  },
  cohesionHighlights: [],
  lexicalHighlights: [],
  grammaticalHighlights: [],
};
