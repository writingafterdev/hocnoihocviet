const fs = require('fs');
const path = require('path');

const templates = {
  // 1. Multiple Choice (R1, W5)
  multipleChoice: (name, desc, q, opts) => `'use client';
import { useState } from 'react';
import { motion } from 'motion/react';

export default function ${name.replace(/[^a-zA-Z0-9]/g, '')}({ onComplete }: { onComplete: (outcome: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  
  return (
    <div className="flex flex-col w-full min-h-[400px]">
      <h3 className="text-xl font-medium mb-2 text-[#111]">${name}</h3>
      <p className="text-[#666] text-sm mb-8">${desc}</p>
      
      <div className="bg-[#F9F9F9] p-6 rounded-lg border border-[#E5E5E5] mb-8 text-[#222] leading-relaxed">
        ${q}
      </div>

      <div className="flex flex-col space-y-3">
        ${opts.map((opt, i) => `
        <button
          onClick={() => setSelected(${i})}
          className={\`px-6 py-4 text-left border rounded-lg transition-colors \${selected === ${i} ? 'border-[#111] bg-[#111] text-white' : 'border-[#E5E5E5] hover:border-[#111] bg-white text-[#222]'}\`}
        >
          ${opt}
        </button>
        `).join('')}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          disabled={selected === null}
          onClick={() => onComplete(selected === 0 ? 1 : 0)}
          className="px-6 py-3 bg-[#111] text-white font-medium rounded-lg disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    </div>
  );
}`,

  // 2. Text Input (W3, W4, W6, W9)
  textInput: (name, desc, originalText) => `'use client';
import { useState } from 'react';

export default function ${name.replace(/[^a-zA-Z0-9]/g, '')}({ onComplete }: { onComplete: (outcome: number) => void }) {
  const [text, setText] = useState("");
  
  return (
    <div className="flex flex-col w-full min-h-[400px]">
      <h3 className="text-xl font-medium mb-2 text-[#111]">${name}</h3>
      <p className="text-[#666] text-sm mb-8">${desc}</p>
      
      <div className="bg-[#F9F9F9] p-6 rounded-lg border border-[#E5E5E5] mb-6 text-[#222] leading-relaxed">
        <span className="text-xs uppercase tracking-widest text-[#888] font-bold block mb-2">Original</span>
        ${originalText}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your improved version here..."
        className="w-full min-h-[120px] p-4 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111] resize-none mb-6 text-[#222]"
      />

      <div className="flex justify-end">
        <button
          disabled={text.length < 5}
          onClick={() => onComplete(text.length > 20 ? 1 : 0)}
          className="px-6 py-3 bg-[#111] text-white font-medium rounded-lg disabled:opacity-50"
        >
          Evaluate (Mock)
        </button>
      </div>
    </div>
  );
}`,

  // 3. Highlight/Tap Words (R3, R5, W2, W8)
  tapWords: (name, desc, sentence) => `'use client';
import { useState } from 'react';

export default function ${name.replace(/[^a-zA-Z0-9]/g, '')}({ onComplete }: { onComplete: (outcome: number) => void }) {
  const words = ${JSON.stringify(sentence.split(' '))};
  const [tapped, setTapped] = useState<number[]>([]);
  
  const toggleWord = (i: number) => {
    if (tapped.includes(i)) setTapped(tapped.filter(n => n !== i));
    else setTapped([...tapped, i]);
  };

  return (
    <div className="flex flex-col w-full min-h-[400px]">
      <h3 className="text-xl font-medium mb-2 text-[#111]">${name}</h3>
      <p className="text-[#666] text-sm mb-8">${desc}</p>
      
      <div className="flex flex-wrap gap-2 mb-8 p-6 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg">
        {words.map((w: string, i: number) => (
          <span
            key={i}
            onClick={() => toggleWord(i)}
            className={\`cursor-pointer px-1 py-0.5 rounded transition-colors \${tapped.includes(i) ? 'bg-[#111] text-white' : 'hover:bg-[#E5E5E5]'}\`}
          >
            {w}
          </span>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          disabled={tapped.length === 0}
          onClick={() => onComplete(tapped.length === 2 ? 1 : 0)}
          className="px-6 py-3 bg-[#111] text-white font-medium rounded-lg disabled:opacity-50"
        >
          Confirm Selection
        </button>
      </div>
    </div>
  );
}`,

  // 4. Voice/Speaking Mock (S1-S7)
  voice: (name, desc, prompt) => `'use client';
import { useState, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';

export default function ${name.replace(/[^a-zA-Z0-9]/g, '')}({ onComplete }: { onComplete: (outcome: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: any;
    if (recording) {
      interval = setInterval(() => setProgress(p => p + 5), 100);
    } else {
      setProgress(0);
    }
    if (progress >= 100) {
      setRecording(false);
      onComplete(1); // Auto win on successful record mock
    }
    return () => clearInterval(interval);
  }, [recording, progress]);

  return (
    <div className="flex flex-col items-center w-full min-h-[400px] py-8">
      <h3 className="text-xl font-medium mb-2 text-[#111]">${name}</h3>
      <p className="text-[#666] text-sm mb-12 text-center max-w-sm">${desc}</p>
      
      <div className="text-2xl font-medium text-center mb-16 text-[#111]">
        "${prompt}"
      </div>

      <button
        onClick={() => setRecording(!recording)}
        className={\`w-20 h-20 rounded-full flex items-center justify-center transition-all \${recording ? 'bg-red-500 scale-110' : 'bg-[#111] hover:scale-105'}\`}
      >
        {recording ? <Square className="text-white w-8 h-8 fill-current" /> : <Mic className="text-white w-8 h-8" />}
      </button>

      {recording && (
        <div className="w-64 h-2 bg-[#E5E5E5] rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-red-500" style={{ width: \`\${progress}%\` }} />
        </div>
      )}
    </div>
  );
}`
};

const gamesList = [
  { id: 'R1', name: 'SentenceJudge', dir: 'reading', code: templates.multipleChoice('Sentence Judge', 'Identify the best version of the highlighted sentence for logical flow.', 'The company lost millions. <mark>Thus, they threw a massive party.</mark>', ['Thus, they threw a massive party.', 'However, they threw a massive party.', 'As a result, they threw a massive party.']) },
  { id: 'R2', name: 'OneWord', dir: 'reading', code: templates.multipleChoice('One Word (RSVP)', 'Test your speed reading and comprehension.', 'What was the main character profession?', ['Software Engineer', 'Architect', 'Teacher']) },
  { id: 'R3', name: 'FaultFinder', dir: 'reading', code: templates.tapWords('Fault Finder', 'Tap the words that break the academic register of the passage.', 'The empirical results were super awesome and completely proved the hypothesis.') },

  { id: 'R4', name: 'WeightReader', dir: 'reading', code: templates.multipleChoice('Weight Reader', 'Read the passage and answer the main idea question.', 'What is the primary argument of the text?', ['The environment is in danger.', 'Economy outpaces ecology.', 'Renewable energy is cost-effective.']) },
  { id: 'R5', name: 'TheCut', dir: 'reading', code: templates.tapWords('The Cut', 'Tap to eliminate redundant words to make the sentence concise.', 'The final conclusion that we ultimately reached was absolutely perfect.') },
  { id: 'R6', name: 'Signal', dir: 'reading', code: templates.tapWords('Signal', 'Tap the target vocabulary words hidden in the text.', 'Despite the prevailing circumstances, the esoteric anomaly remained ubiquitous.') },

  { id: 'W1', name: 'Collapse', dir: 'writing', code: templates.multipleChoice('Collapse', 'Order the scrambled sentences to restore logical cohesion.', 'Which sentence comes first?', ['Therefore, the data is invalid.', 'The sensor failed during collection.']) },
  { id: 'W2', name: 'Objection', dir: 'writing', code: templates.tapWords('Objection', 'Identify the logical fallacy in the argument.', 'If we ban plastic straws, soon they will ban all plastics entirely.') },
  { id: 'W3', name: 'UpgradeChain', dir: 'writing', code: templates.textInput('Upgrade Chain', 'Rewrite this weak sentence using precise academic vocabulary.', 'The study found a lot of bad things about the new medicine.') },
  { id: 'W4', name: 'WrongGenre', dir: 'writing', code: templates.textInput('Wrong Genre', 'Rewrite this casual email into a formal professional request.', 'Hey, send me the files ASAP, I need them.') },
  { id: 'W5', name: 'TheMissingLink', dir: 'writing', code: templates.multipleChoice('The Missing Link', 'Select the correct transition word to fill the gap.', 'The weather was terrible. [___], the event was a massive success.', ['Consequently', 'Nevertheless', 'Similarly']) },
  { id: 'W6', name: 'ShrinkIt', dir: 'writing', code: templates.textInput('Shrink It', 'Summarize the core argument in a single sentence.', 'Due to the fact that the original document was lost, we had to start completely from the very beginning.') },
  { id: 'W7', name: 'Thread', dir: 'writing', code: templates.tapWords('Thread', 'Find the sentence that breaks the Given-New information flow.', 'Apples are red. Green is the color of the leaves. Trees are tall.') },
  { id: 'W8', name: 'DriftDetector', dir: 'writing', code: templates.tapWords('Drift Detector', 'Find the exact sentence where the thematic coherence drifts off topic.', 'Climate change is accelerating. Oceans are rising. I really like swimming in the ocean. Swimming is great exercise.') },
  { id: 'W9', name: 'Spotlight', dir: 'writing', code: templates.textInput('Spotlight', 'Rewrite to spotlight the foreground information (passive/cleft structure).', 'The CEO made the controversial decision.') },

  { id: 'S1', name: 'GetItOut', dir: 'speaking', code: templates.voice('Get It Out', 'Speak a complete sentence using the provided scaffold.', 'I ... [mitigate] ... [risk]') },
  { id: 'S2', name: 'ToneBall', dir: 'speaking', code: templates.voice('Tone Ball', 'Read the sentence matching the target emotion: Enthusiastic.', '"We absolutely crushed our Q3 targets!"') },
  { id: 'S3', name: 'Conductor', dir: 'speaking', code: templates.voice('Conductor', 'Read aloud with proper chunking and pauses.', '"The findings, however surprising, were undeniable."') },
  { id: 'S4', name: 'ChunkIt', dir: 'speaking', code: templates.voice('Chunk It', 'Read aloud, emphasizing the bold words.', '"I did **not** say he stole the money."') },
  { id: 'S5', name: 'HotSeat', dir: 'speaking', code: templates.voice('Hot Seat', 'Answer the question instantly using the target word.', 'Q: Why were you late? Word: Unavoidable') },
  { id: 'S6', name: 'Immediate', dir: 'speaking', code: templates.voice('Immediate', 'Translate your immediate reaction without hesitation.', '[User scenario appears on screen]') },
  { id: 'S7', name: 'ShadowingPlus', dir: 'speaking', code: templates.voice('Shadowing+', 'Listen to the native speaker and repeat perfectly.', '[Audio plays...] "It is widely acknowledged that..."') }
];

gamesList.forEach(game => {
  const filePath = path.join(__dirname, 'src/components/games', game.dir, `${game.name}.tsx`);
  fs.writeFileSync(filePath, game.code, 'utf8');
  console.log(`Overwrote ${filePath} with interactive UI`);
});
