interface EssayPromptBlockProps {
  prompt: string;
  className?: string;
}

export default function EssayPromptBlock({ prompt, className = '' }: EssayPromptBlockProps) {
  if (!prompt.trim()) return null;

  return (
    <div className={`border border-[#7e8c9a]/40 bg-[#F8FAFC] p-4 ${className}`}>
      <p className="font-sans text-[12px] font-semibold italic leading-[1.6] text-[#2c3338] [text-wrap:pretty]">
        {prompt}
      </p>
    </div>
  );
}
