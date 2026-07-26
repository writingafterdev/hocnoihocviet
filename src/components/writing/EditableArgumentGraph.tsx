'use client';

import {
  MacroAnswerNode as MacroAnswerNodeType,
  ParagraphMoveNode,
  SentenceAnnotation,
  SentenceRole,
} from '@/types/writing';

interface EditableArgumentGraphProps {
  graph: {
    macroAnswer: MacroAnswerNodeType;
    paragraphs: ParagraphMoveNode[];
  };
  onChange: (nextGraph: { macroAnswer: MacroAnswerNodeType; paragraphs: ParagraphMoveNode[] }) => void;
  activeParagraphIndex: number | null;
  onParagraphClick: (index: number | null) => void;
  onRequestFullscreen?: () => void;
  isFullscreen?: boolean;
}

function isEssayFrameParagraph(paragraph: ParagraphMoveNode) {
  const label = paragraph.label.toLowerCase();
  return ['introduction', 'conclusion', 'mở bài', 'kết bài'].includes(label);
}

function nextParagraphIndex(paragraphs: ParagraphMoveNode[]) {
  return paragraphs.length > 0 ? Math.max(...paragraphs.map(paragraph => paragraph.index)) + 1 : 0;
}

function nextSentenceIndex(sentences: SentenceAnnotation[]) {
  return sentences.length > 0 ? Math.max(...sentences.map(sentence => sentence.index)) + 1 : 1;
}

function supportPlaceholder(index: number) {
  return index === 0 ? 'Supporting detail / example' : 'Another supporting detail / example';
}

export default function EditableArgumentGraph({
  graph,
  onChange,
  activeParagraphIndex,
  onParagraphClick,
  onRequestFullscreen,
  isFullscreen = false,
}: EditableArgumentGraphProps) {
  const bodyParagraphs = graph.paragraphs.filter(paragraph => !isEssayFrameParagraph(paragraph));

  const updateMacro = (text: string) => {
    onChange({ ...graph, macroAnswer: { ...graph.macroAnswer, text } });
  };

  const updateParagraph = (paragraphIndex: number, updates: Partial<ParagraphMoveNode>) => {
    onChange({
      ...graph,
      paragraphs: graph.paragraphs.map(paragraph => (
        paragraph.index === paragraphIndex ? { ...paragraph, ...updates } : paragraph
      )),
    });
  };

  const addParagraph = () => {
    const newParagraph: ParagraphMoveNode = {
      index: nextParagraphIndex(graph.paragraphs),
      label: `Body ${bodyParagraphs.length + 1}`,
      job: '',
      paragraphStartChar: 0,
      paragraphEndChar: 0,
      errors: [],
      sentences: [],
    };
    const conclusionIndex = graph.paragraphs.findIndex(paragraph => {
      const label = paragraph.label.toLowerCase();
      return label === 'conclusion' || label === 'kết bài';
    });
    const paragraphs = [...graph.paragraphs];
    if (conclusionIndex >= 0) paragraphs.splice(conclusionIndex, 0, newParagraph);
    else paragraphs.push(newParagraph);
    onChange({ ...graph, paragraphs });
    onParagraphClick(newParagraph.index);
  };

  const removeParagraph = (paragraphIndex: number) => {
    onChange({
      ...graph,
      paragraphs: graph.paragraphs.filter(paragraph => paragraph.index !== paragraphIndex),
    });
    if (activeParagraphIndex === paragraphIndex) onParagraphClick(null);
  };

  const addSupport = (paragraphIndex: number) => {
    onChange({
      ...graph,
      paragraphs: graph.paragraphs.map(paragraph => {
        if (paragraph.index !== paragraphIndex) return paragraph;
        const newSupport: SentenceAnnotation = {
          index: nextSentenceIndex(paragraph.sentences),
          startChar: 0,
          endChar: 0,
          role: 'reason' as SentenceRole,
          simplifiedIdea: '',
          errors: [],
        };
        return { ...paragraph, sentences: [...paragraph.sentences, newSupport] };
      }),
    });
  };

  const updateSupport = (paragraphIndex: number, sentenceIndex: number, text: string) => {
    onChange({
      ...graph,
      paragraphs: graph.paragraphs.map(paragraph => {
        if (paragraph.index !== paragraphIndex) return paragraph;
        return {
          ...paragraph,
          sentences: paragraph.sentences.map(sentence => (
            sentence.index === sentenceIndex ? { ...sentence, simplifiedIdea: text, sourceText: text } : sentence
          )),
        };
      }),
    });
  };

  const removeSupport = (paragraphIndex: number, sentenceIndex: number) => {
    onChange({
      ...graph,
      paragraphs: graph.paragraphs.map(paragraph => {
        if (paragraph.index !== paragraphIndex) return paragraph;
        return {
          ...paragraph,
          sentences: paragraph.sentences.filter(sentence => sentence.index !== sentenceIndex),
        };
      }),
    });
  };

  const moveSupport = (paragraphIndex: number, sentenceIndex: number, direction: -1 | 1) => {
    onChange({
      ...graph,
      paragraphs: graph.paragraphs.map(paragraph => {
        if (paragraph.index !== paragraphIndex) return paragraph;
        const currentIndex = paragraph.sentences.findIndex(sentence => sentence.index === sentenceIndex);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= paragraph.sentences.length) return paragraph;
        const sentences = [...paragraph.sentences];
        const [item] = sentences.splice(currentIndex, 1);
        sentences.splice(nextIndex, 0, item);
        return { ...paragraph, sentences };
      }),
    });
  };

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-black/[0.05] bg-[#F7F8F8]">
      <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] bg-white/75 px-4 py-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">Argument outline</p>
        {onRequestFullscreen && (
          <button
            type="button"
            onClick={onRequestFullscreen}
            className="rounded-[7px] border border-black/[0.06] bg-white px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-black/45 shadow-sm transition-colors hover:text-[#171717]"
          >
            Full
          </button>
        )}
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto hide-scrollbar ${isFullscreen ? 'px-10 py-8' : 'px-5 py-5'}`}>
        <div className="mx-auto w-full max-w-[1020px] space-y-7">
          <div className="rounded-[12px] border border-black/[0.08] bg-white/75 p-3">
            <label className="mb-2 block font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-black/35">
              Whole-essay position
            </label>
            <textarea
              value={graph.macroAnswer.text}
              onChange={event => updateMacro(event.target.value)}
              placeholder="What is the essay's final position?"
              className="block min-h-[68px] w-full resize-y rounded-[8px] border border-black/[0.12] bg-white px-3 py-2.5 font-sans text-[13px] leading-relaxed text-[#171717] outline-none transition-colors placeholder:text-[#9EA4AF] focus:border-[#18B894]"
            />
          </div>

          {bodyParagraphs.map((paragraph, paragraphIndex) => {
            const active = activeParagraphIndex === paragraph.index;
            return (
              <section key={paragraph.index} className="space-y-3">
                <div className="grid grid-cols-[40px_1fr_auto] items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onParagraphClick(active ? null : paragraph.index)}
                    className={`pt-2 text-left font-mono text-[18px] font-semibold ${active ? 'text-[#129879]' : 'text-[#18B894]'}`}
                    aria-label={`Select paragraph ${paragraphIndex + 1}`}
                  >
                    {paragraphIndex + 1}.
                  </button>

                  <div className="space-y-2">
                    <input
                      value={paragraph.job}
                      onChange={event => updateParagraph(paragraph.index, { job: event.target.value })}
                      onFocus={() => onParagraphClick(paragraph.index)}
                      placeholder="Controlling Idea (e.g., Main advantage)"
                      className={`block w-full rounded-[8px] border bg-white px-3 py-2.5 font-sans text-[13px] text-[#171717] outline-none transition-colors placeholder:text-[#9EA4AF] ${
                        active ? 'border-[#18B894]/45 ring-2 ring-[#18B894]/10' : 'border-black/[0.16] focus:border-[#18B894]'
                      }`}
                    />
                    <input
                      value={paragraph.label}
                      onChange={event => updateParagraph(paragraph.index, { label: event.target.value })}
                      onFocus={() => onParagraphClick(paragraph.index)}
                      placeholder={`Body ${paragraphIndex + 1}`}
                      className="block w-full rounded-[7px] border border-transparent bg-transparent px-1 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-black/35 outline-none transition-colors placeholder:text-black/25 focus:border-black/[0.08] focus:bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeParagraph(paragraph.index)}
                    className="mt-1 rounded-[7px] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-black/30 transition-colors hover:bg-[#FFF2F0] hover:text-[#B5473A]"
                  >
                    Delete
                  </button>
                </div>

                <div className="ml-[58px] space-y-3 border-l-2 border-[#D8DEE4] pl-7">
                  {paragraph.sentences.map((sentence, supportIndex) => (
                    <div key={sentence.index} className="grid grid-cols-[34px_1fr_auto] items-start gap-3">
                      <span className="pt-2.5 font-mono text-[15px] font-semibold text-[#18B894]">
                        {String.fromCharCode(97 + supportIndex)}.
                      </span>
                      <textarea
                        value={sentence.sourceText || sentence.simplifiedIdea}
                        onChange={event => updateSupport(paragraph.index, sentence.index, event.target.value)}
                        onFocus={() => onParagraphClick(paragraph.index)}
                        placeholder={supportPlaceholder(supportIndex)}
                        className="block min-h-[52px] w-full resize-y rounded-[8px] border border-black/[0.16] bg-white px-3 py-2.5 font-sans text-[13px] leading-relaxed text-[#171717] outline-none transition-colors placeholder:text-[#9EA4AF] focus:border-[#18B894]"
                      />
                      <div className="flex items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => moveSupport(paragraph.index, sentence.index, -1)}
                          disabled={supportIndex === 0}
                          className="rounded-[6px] px-1.5 py-1 font-mono text-[10px] text-black/35 transition-colors hover:bg-black/[0.04] hover:text-black disabled:opacity-20"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSupport(paragraph.index, sentence.index, 1)}
                          disabled={supportIndex === paragraph.sentences.length - 1}
                          className="rounded-[6px] px-1.5 py-1 font-mono text-[10px] text-black/35 transition-colors hover:bg-black/[0.04] hover:text-black disabled:opacity-20"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSupport(paragraph.index, sentence.index)}
                          className="rounded-[6px] px-1.5 py-1 font-mono text-[10px] text-black/30 transition-colors hover:bg-[#FFF2F0] hover:text-[#B5473A]"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSupport(paragraph.index)}
                    className="rounded-[8px] border border-dashed border-[#8FA4A9] bg-white/40 px-3 py-2 font-sans text-[12px] font-medium text-[#7B8D92] transition-colors hover:border-[#18B894]/50 hover:text-[#129879]"
                  >
                    + Thêm ý phụ
                  </button>
                </div>
              </section>
            );
          })}

          <button
            type="button"
            onClick={addParagraph}
            className="ml-10 rounded-[8px] border border-dashed border-[#8FA4A9] bg-white/50 px-4 py-2.5 font-sans text-[12px] font-medium text-[#7B8D92] transition-colors hover:border-[#18B894]/50 hover:text-[#129879]"
          >
            + Thêm controlling idea
          </button>
        </div>
      </div>
    </section>
  );
}
