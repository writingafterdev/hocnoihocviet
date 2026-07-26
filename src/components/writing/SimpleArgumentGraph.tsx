'use client';

import { MacroAnswerNode, ParagraphMoveNode, SentenceAnnotation } from '@/types/writing';

interface SimpleArgumentGraphProps {
  macroAnswer: MacroAnswerNode;
  paragraphs: ParagraphMoveNode[];
  activeParagraphIndex?: number | null;
  onParagraphClick?: (index: number | null) => void;
  focusNodeIds?: string[];
  solutionNodeIds?: string[];
}

const CONTROLLING_ROLES = new Set(['claim', 'final_stance', 'concession', 'mini_conclusion']);

function sentenceId(paragraph: ParagraphMoveNode, sentence: SentenceAnnotation) {
  return sentence.nodeId || `sentence-${paragraph.index}-${sentence.index}`;
}

function chunkLabel(sentence: SentenceAnnotation) {
  return `C${sentence.index}`;
}

function alphaLabel(index: number) {
  return `${String.fromCharCode(97 + index)}.`;
}

function nodeText(sentence: SentenceAnnotation) {
  return sentence.sourceText?.trim() || sentence.simplifiedIdea?.trim() || '';
}

function pickControllingSentence(sentences: SentenceAnnotation[]) {
  return sentences.find(sentence => CONTROLLING_ROLES.has(sentence.role)) || sentences[0];
}

function supportRoleLabel(role: string) {
  if (role === 'example') return 'Example';
  if (role === 'mechanism') return 'Mechanism';
  if (role === 'reason') return 'Reason';
  if (role === 'comparison' || role === 'contrast') return 'Comparison';
  if (role === 'mini_conclusion') return 'Wrap-up';
  return 'Supporting detail';
}

function GraphRow({
  label,
  text,
  nodeBadge,
  role,
  active,
  dimmed,
  solution,
  indent = false,
  onClick,
}: {
  label: string;
  text: string;
  nodeBadge?: string;
  role?: string;
  active?: boolean;
  dimmed?: boolean;
  solution?: boolean;
  indent?: boolean;
  onClick?: () => void;
}) {
  const tone = solution
    ? 'border-[#37A77A]/35 bg-[#ECF8F2] text-[#165B41]'
    : active
      ? 'border-[#3478F6]/45 bg-[#EAF3FF] text-[#173B72]'
      : 'border-black/[0.14] bg-white text-[#2E3135]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group grid w-full text-left transition-opacity ${indent ? 'grid-cols-[56px_1fr]' : 'grid-cols-[40px_1fr]'} ${dimmed ? 'opacity-45' : 'opacity-100'}`}
    >
      <span className={`pt-3 font-mono text-[14px] font-semibold ${indent ? 'text-[#18B894]' : 'text-[#18B894]'}`}>{label}</span>
      <span className={`min-w-0 rounded-[8px] border px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors group-hover:border-[#3478F6]/35 ${tone}`}>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {nodeBadge && (
            <span className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase ${
              solution ? 'bg-[#D6F2E5] text-[#247657]' : active ? 'bg-white text-[#2563EB]' : 'bg-black/[0.04] text-black/38'
            }`}>
              {nodeBadge}
            </span>
          )}
          {role && (
            <span className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.12em] text-black/35">
              {role}
            </span>
          )}
        </span>
        <span className="mt-1 block font-sans text-[12px] leading-[1.55]">{text}</span>
      </span>
    </button>
  );
}

export default function SimpleArgumentGraph({
  macroAnswer,
  paragraphs,
  activeParagraphIndex = null,
  onParagraphClick,
  focusNodeIds = [],
  solutionNodeIds = [],
}: SimpleArgumentGraphProps) {
  const focusSet = new Set(focusNodeIds);
  const solutionSet = new Set(solutionNodeIds);
  const hasFocus = focusSet.size > 0 || activeParagraphIndex !== null;

  return (
    <div className="h-full min-h-0 overflow-auto bg-[#F7F8F8] px-5 py-5 hide-scrollbar">
      <div className="mx-auto w-full max-w-[980px] space-y-6">
        {macroAnswer.text?.trim() && (
          <section className="rounded-[12px] border border-black/[0.08] bg-white/70 p-3">
            <p className="mb-2 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-black/35">Whole-essay position</p>
            <p className="font-sans text-[12px] leading-[1.55] text-[#3B3F45]">{macroAnswer.text}</p>
          </section>
        )}

        {paragraphs.map((paragraph, paragraphIndex) => {
          const controlling = pickControllingSentence(paragraph.sentences);
          const controllingId = controlling ? sentenceId(paragraph, controlling) : null;
          const support = paragraph.sentences.filter(sentence => sentence !== controlling);
          const paragraphNodeIds = paragraph.sentences.map(sentence => sentenceId(paragraph, sentence));
          const paragraphFocused = activeParagraphIndex === paragraph.index || paragraphNodeIds.some(nodeId => focusSet.has(nodeId));
          const paragraphDimmed = hasFocus && !paragraphFocused;

          return (
            <section
              key={paragraph.index}
              className={`transition-opacity ${paragraphDimmed ? 'opacity-75' : 'opacity-100'}`}
            >
              <button
                type="button"
                onClick={() => onParagraphClick?.(activeParagraphIndex === paragraph.index ? null : paragraph.index)}
                className="mb-2 flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-black/35">
                  {paragraph.label || `Paragraph ${paragraphIndex + 1}`}
                </span>
                {paragraph.job && (
                  <span className="line-clamp-1 font-sans text-[10px] text-black/38">{paragraph.job}</span>
                )}
              </button>

              <div className="space-y-3">
                {controlling && controllingId && (
                  <GraphRow
                    label={`${paragraphIndex + 1}.`}
                    text={nodeText(controlling)}
                    nodeBadge={chunkLabel(controlling)}
                    role="Controlling idea"
                    active={focusSet.has(controllingId) || activeParagraphIndex === paragraph.index}
                    solution={solutionSet.has(controllingId)}
                    dimmed={focusSet.size > 0 && !focusSet.has(controllingId) && activeParagraphIndex !== paragraph.index}
                    onClick={() => onParagraphClick?.(paragraph.index)}
                  />
                )}

                {support.length > 0 && (
                  <div className="ml-[18px] space-y-3 border-l-2 border-[#D8DEE4] pl-6">
                    {support.map((sentence, supportIndex) => {
                      const id = sentenceId(paragraph, sentence);
                      return (
                        <GraphRow
                          key={id}
                          label={alphaLabel(supportIndex)}
                          text={nodeText(sentence)}
                          nodeBadge={chunkLabel(sentence)}
                          role={supportRoleLabel(sentence.role)}
                          active={focusSet.has(id) || activeParagraphIndex === paragraph.index}
                          solution={solutionSet.has(id)}
                          dimmed={focusSet.size > 0 && !focusSet.has(id) && activeParagraphIndex !== paragraph.index}
                          indent
                          onClick={() => onParagraphClick?.(paragraph.index)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
