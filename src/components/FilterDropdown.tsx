'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { STATUS } from './StatusBadge';

const CARD_SHADOW_LG =
  'shadow-[0px_13.18px_7.688px_0px_rgba(0,0,0,0.02),0px_5.492px_5.492px_0px_rgba(0,0,0,0.04),0px_1.098px_3.295px_0px_rgba(0,0,0,0.04)]';

export function FilterDropdown({
  label, value, options, onChange, align = 'left',
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const isActive = value !== 'All' && value !== options[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 font-serif italic text-[14px] transition-colors hover:text-neutral-900 ${isActive ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}
      >
        {label}{isActive ? `: ${value}` : ''} <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
              className={`absolute z-20 mt-2 min-w-[160px] bg-[#FFFFFF] border border-neutral-300 py-1 ${align === 'right' ? 'right-0' : 'left-0'}`}
            >
              {options.map((o, i) => (
                <motion.button
                  key={o}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.02 * i, duration: 0.15 }}
                  onClick={() => { onChange(o); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 font-serif text-[14px] hover:bg-neutral-100 transition-colors ${o === value ? 'text-[#111] italic' : 'text-neutral-700'}`}
                >
                  {STATUS[o as keyof typeof STATUS]?.label ?? o}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
