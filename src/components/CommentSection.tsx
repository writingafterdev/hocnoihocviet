'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Share2, ChevronUp, ChevronDown } from 'lucide-react';
import { FilterDropdown } from './FilterDropdown';

// Constants removed

type CommentNode = {
  id: string;
  author: string;
  avatar: string;
  time: string;
  score: number;
  text: string;
  replies?: CommentNode[];
};

const COMMENTS: CommentNode[] = [
  {
    id: '1', author: 'Maya Lin', avatar: '#fcd9b6', time: '3h', score: 42,
    text: 'This hit hard. I tried the two-minute rule for a month and stacked it onto my morning coffee — completely changed how I start the day.',
    replies: [
      {
        id: '1-1', author: 'Cal Newport', avatar: '#c7d8ff', time: '2h', score: 28,
        text: 'Pairing with an existing anchor habit is the part most people skip. Glad it worked for you.',
        replies: [
          { id: '1-1-1', author: 'Maya Lin', avatar: '#fcd9b6', time: '1h', score: 11, text: 'Yeah, the anchor was the unlock. Without it I\'d just forget by 10am.' },
        ],
      },
      { id: '1-2', author: 'Jordan P.', avatar: '#d1f0d8', time: '1h', score: 6, text: 'Curious what your cue was, exactly? Is it the coffee itself or sitting down?' },
    ],
  },
  {
    id: '2', author: 'Ella M.', avatar: '#e5f3fe', time: '5h', score: 17,
    text: 'Counter-take: systems are great, but goals still matter for direction. Otherwise you just get really good at the wrong thing.',
    replies: [
      { id: '2-1', author: 'Sam K.', avatar: '#fcf4db', time: '4h', score: 9, text: 'Goals as a compass, systems as the legs. Both, not either.' },
    ],
  },
  { id: '3', author: 'Devon R.', avatar: '#fdefee', time: 'yesterday', score: 4, text: 'Saved this one. Going to re-read after my next planning session.' },
];

function countReplies(node: CommentNode): number {
  if (!node.replies) return 0;
  return node.replies.reduce((n, r) => n + 1 + countReplies(r), 0);
}

function Comment({ node }: { node: CommentNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [score, setScore] = useState(node.score);
  const [vote, setVote] = useState<-1 | 0 | 1>(0);

  const setVoteTo = (v: -1 | 1) => {
    const next = vote === v ? 0 : v;
    setScore(node.score + next);
    setVote(next);
  };

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0 mt-1">
        {/* Avatars replaced with a sharp initial box */}
        <div className="w-8 h-8 bg-neutral-100 flex items-center justify-center border border-neutral-300">
          <span className="font-serif text-[12px] uppercase text-neutral-600">
            {node.author.slice(0, 2)}
          </span>
        </div>
        {!collapsed && node.replies && node.replies.length > 0 && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex-1 w-px my-2 bg-neutral-200 hover:bg-neutral-800 transition-colors"
            aria-label="Collapse thread"
          />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-serif font-bold text-[14px] text-neutral-900">{node.author}</span>
          <span className="w-1 h-1 bg-neutral-300" />
          <span className="font-serif text-[12px] uppercase tracking-widest text-neutral-400">{node.time}</span>
          {collapsed && node.replies && (
            <button onClick={() => setCollapsed(false)} className="text-[11px] font-serif uppercase tracking-widest text-[#111] ml-2">
              [+{countReplies(node)} MORE]
            </button>
          )}
        </div>

        {!collapsed && (
          <>
            <p className="font-serif text-[15px] leading-[1.6] text-neutral-800 mb-3">{node.text}</p>

            <div className="flex items-center gap-4 text-[11px] font-sans font-bold uppercase tracking-widest text-neutral-400">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVoteTo(1)}
                  className={`hover:text-neutral-900 transition-colors ${vote === 1 ? 'text-neutral-900' : ''}`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <span className={`min-w-[14px] text-center ${vote !== 0 ? 'text-neutral-900' : ''}`}>
                  {score}
                </span>
                <button
                  onClick={() => setVoteTo(-1)}
                  className={`hover:text-neutral-900 transition-colors ${vote === -1 ? 'text-neutral-900' : ''}`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <button className="hover:text-neutral-900 flex items-center gap-1 transition-colors">
                REPLY
              </button>
              <button className="hover:text-neutral-900 flex items-center gap-1 transition-colors">
                SHARE
              </button>
            </div>

            {node.replies && node.replies.length > 0 && (
              <div className="mt-6">
                {node.replies.map((r) => (
                  <Comment key={r.id} node={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Comments() {
  const total = COMMENTS.reduce((n, c) => n + 1 + countReplies(c), 0);
  const [sort, setSort] = useState('Top');

  return (
    <div className="my-10 pt-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-300">
        <h3 className="font-heading text-[28px] text-neutral-900">
          Comments <span className="text-neutral-400 font-serif italic text-[22px]">({total})</span>
        </h3>
        <FilterDropdown
          label="Sort"
          value={sort}
          options={['Top', 'New', 'Controversial']}
          onChange={setSort}
          align="right"
        />
      </div>

      <div className="flex gap-4 items-start mb-12 bg-[#FFFFFF] p-4 border border-neutral-300 shadow-sm">
        <div className="w-10 h-10 bg-neutral-900 flex items-center justify-center shrink-0">
          <span className="font-serif text-[14px] uppercase text-white">
            YOU
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            placeholder="Share your thoughts..."
            rows={2}
            className="w-full bg-transparent font-serif text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-3 mt-2">
            <button className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition-colors">
              Cancel
            </button>
            <button className="text-[11px] font-bold uppercase tracking-widest text-white bg-neutral-900 px-5 py-2 hover:bg-neutral-800 transition-colors border border-neutral-900">
              Submit
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {COMMENTS.map((c) => (
          <Comment key={c.id} node={c} />
        ))}
      </div>
    </div>
  );
}
