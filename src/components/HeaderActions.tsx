'use client';
import { useState } from 'react';
import { Flame, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function HeaderActions() {
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasks, setTasks] = useState([
    { id: 1, label: 'Read 2 articles', done: true },
    { id: 2, label: 'Save 3 highlights', done: false },
    { id: 3, label: 'Review 20 flashcards', done: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  return (
    <div className="flex items-center gap-6 relative z-50">
      <div className="flex items-center gap-2">
        <img 
          src="/fire.gif"
          alt="Active streak"
          className="w-5 h-5 object-contain -translate-y-0.5"
        />
        <span className="text-[14px] font-heading text-[#111]">27</span>
      </div>
      
      <div className="relative">
        <button 
          onClick={() => setTasksOpen(!tasksOpen)}
          className="flex items-center gap-2 group transition-colors"
        >
          <span className="text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] group-hover:opacity-60 transition-colors border-b border-transparent group-hover:border-[#111]">Tasks for today</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#111] group-hover:opacity-60 transition-transform ${tasksOpen ? 'rotate-180' : ''}`} />
        </button>
        
        <AnimatePresence>
          {tasksOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setTasksOpen(false)} />
              <motion.div 
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-4 w-72 bg-[#FFFFFF] p-6 border border-black/10 origin-top-right shadow-xl z-20"
              >
                <div className="text-[11px] font-bold text-[#111] uppercase tracking-widest mb-6">Daily Missions</div>
                <div className="flex flex-col gap-5">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-start gap-4 cursor-pointer group" onClick={() => toggleTask(t.id)}>
                      <div className={`mt-0.5 w-4 h-4 flex items-center justify-center shrink-0 border transition-colors ${t.done ? 'bg-[#111] border-[#111] text-[#FFFFFF]' : 'border-black/20 group-hover:border-[#111]'}`}>
                        {t.done && <Check className="w-3 h-3" strokeWidth={3} />}
                      </div>
                      <div className={`text-[12px] font-sans uppercase tracking-widest font-bold leading-tight transition-colors ${t.done ? 'text-[#111]/30 line-through' : 'text-[#111] group-hover:opacity-60'}`}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
