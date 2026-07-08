'use client';

import { BandScores } from '@/types/writing';

const DIMENSION_LABELS: Record<keyof Omit<BandScores, 'overall'>, string> = {
  taskAchievement: 'TA',
  coherenceCohesion: 'CC',
  lexicalResource: 'LR',
  grammaticalRange: 'GRA',
};

export type DimensionKey = keyof Omit<BandScores, 'overall'>;


interface ScoreBarProps {
  scores: BandScores;
  activeDimension: DimensionKey;
  onSelect: (dim: DimensionKey) => void;
}


export default function ScoreBar({ scores, activeDimension, onSelect }: ScoreBarProps) {
  const dimensions = (Object.keys(DIMENSION_LABELS) as Array<DimensionKey>);

  return (
    <div className="flex items-stretch gap-3 mb-8">
      {/* Overall band — hero card */}
      <div className="flex flex-col items-center justify-center min-w-[100px] shrink-0 px-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-black/40 mb-1.5">
          Overall
        </span>
        <span className="font-sans text-[42px] font-semibold leading-none tabular-nums tracking-tight text-[#141413]">
          {scores.overall.toFixed(1)}
        </span>
      </div>

      <div className="w-px bg-black/5 mx-1 my-2" />

      {/* Dimension scores */}
      <div className="flex-1 flex gap-2.5">
        {dimensions.map((key) => {
          const isActive = activeDimension === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex-1 relative rounded-[14px] px-2 py-4 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer active:scale-[0.96] outline-none select-none
                ${isActive 
                  ? 'bg-white ring-1 ring-black/10 z-10' 
                  : 'bg-black/[0.02] hover:bg-black/[0.04] ring-1 ring-transparent hover:ring-black/5 text-[#141413]/60 z-0'}`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#48CAE4] rounded-b-full" />
              )}
              <span className={`font-mono text-[14px] font-bold tracking-[0.1em] uppercase mb-1.5 text-center leading-[1.4] transition-colors
                ${isActive ? 'text-black/50' : 'text-black/40'}`}>
                {DIMENSION_LABELS[key]}
              </span>
              <span className={`font-sans text-[32px] font-semibold leading-none tabular-nums tracking-tight transition-colors
                ${isActive ? 'text-[#141413]' : 'text-inherit'}`}>
                {scores[key]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
