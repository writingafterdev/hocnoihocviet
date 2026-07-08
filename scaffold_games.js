const fs = require('fs');
const path = require('path');

const games = [
  { id: 'R1', name: 'SentenceJudge', dir: 'reading' },
  { id: 'R2', name: 'OneWord', dir: 'reading' },
  { id: 'R3', name: 'FaultFinder', dir: 'reading' },
  { id: 'R4', name: 'WeightReader', dir: 'reading' },
  { id: 'R5', name: 'TheCut', dir: 'reading' },
  { id: 'R6', name: 'Signal', dir: 'reading' },
  { id: 'W1', name: 'Collapse', dir: 'writing' },
  { id: 'W2', name: 'Objection', dir: 'writing' },
  { id: 'W3', name: 'UpgradeChain', dir: 'writing' },
  { id: 'W4', name: 'WrongGenre', dir: 'writing' },
  { id: 'W5', name: 'TheMissingLink', dir: 'writing' },
  { id: 'W6', name: 'ShrinkIt', dir: 'writing' },
  { id: 'W7', name: 'Thread', dir: 'writing' },
  { id: 'W8', name: 'DriftDetector', dir: 'writing' },
  { id: 'W9', name: 'Spotlight', dir: 'writing' },
  { id: 'S1', name: 'GetItOut', dir: 'speaking' },
  { id: 'S2', name: 'ToneBall', dir: 'speaking' },
  { id: 'S3', name: 'Conductor', dir: 'speaking' },
  { id: 'S4', name: 'ChunkIt', dir: 'speaking' },
  { id: 'S5', name: 'HotSeat', dir: 'speaking' },
  { id: 'S6', name: 'Immediate', dir: 'speaking' },
  { id: 'S7', name: 'ShadowingPlus', dir: 'speaking' }
];

const template = (name) => `'use client';

import { useState } from 'react';

interface Props {
  onComplete: (outcome: number) => void;
}

export default function ${name}({ onComplete }: Props) {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[300px]">
      <h3 className="text-xl font-medium mb-4 text-[#111]">${name} (In Development)</h3>
      <p className="text-[#666] text-sm mb-8 text-center max-w-sm">
        This is a placeholder for the ${name} game interface. It will provide the specific interaction mechanics described in the design document.
      </p>
      
      <div className="flex space-x-4">
        <button
          onClick={() => onComplete(1)}
          className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-sm text-[#222] hover:bg-[#F9F9F9] transition-colors"
        >
          Simulate Win
        </button>
        <button
          onClick={() => onComplete(0)}
          className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-sm text-[#222] hover:bg-[#F9F9F9] transition-colors"
        >
          Simulate Loss
        </button>
      </div>
    </div>
  );
}
`;

games.forEach(game => {
  const filePath = path.join(__dirname, 'src/components/games', game.dir, `${game.name}.tsx`);
  fs.writeFileSync(filePath, template(game.name), 'utf8');
  console.log(`Created ${filePath}`);
});

// Create index.ts to export all games
const indexTemplate = games.map(g => `export { default as ${g.id} } from './${g.dir}/${g.name}';`).join('\\n');
fs.writeFileSync(path.join(__dirname, 'src/components/games/index.ts'), indexTemplate, 'utf8');
console.log('Created src/components/games/index.ts');
