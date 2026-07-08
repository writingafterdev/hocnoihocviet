'use client';

import { useState } from 'react';
import Link from 'next/link';
import { promptsDatabase } from '@/lib/prompts';
import TopHeader from '@/components/TopHeader';
import { BarChart3, LineChart, PieChart, Table as TableIcon, Map as MapIcon, Workflow, LayoutDashboard } from 'lucide-react';

const TASK1_ICONS: Record<string, { icon: React.ElementType, color: string }> = {
  'Bar Chart': { icon: BarChart3, color: 'text-blue-500' },
  'Line Graph': { icon: LineChart, color: 'text-emerald-500' },
  'Pie Chart': { icon: PieChart, color: 'text-amber-500' },
  'Table': { icon: TableIcon, color: 'text-indigo-500' },
  'Map': { icon: MapIcon, color: 'text-rose-500' },
  'Process Diagram': { icon: Workflow, color: 'text-purple-500' },
  'Multiple Charts': { icon: LayoutDashboard, color: 'text-cyan-500' }
};

const CATEGORIES_TASK2 = [
  'Agree or Disagree',
  'Discussion',
  'Advantages and Disadvantages',
  'Causes, Problems and Solutions',
  'Two-Part Question',
  'Positive or Negative Development',
];

const TOPICS_TASK2 = [
  'Education',
  'Environment',
  'Work and Careers',
  'Government & Criminal Justice',
  'Science and Technology',
  'Health',
  'Entertainment',
  'Society and Culture',
  'Economics',
  'Other Topics',
  'Travel and Transportation',
];

const CATEGORIES_TASK1 = [
  'Bar Chart',
  'Line Graph',
  'Pie Chart',
  'Table',
  'Map',
  'Process Diagram',
  'Multiple Charts'
];

const TOPICS_TASK1 = [
  'Economics',
  'Education',
  'Environment',
  'Population & Demographics',
  'Social Trends',
  'Infrastructure'
];

type TaskType = 'task1' | 'task2';

export default function PromptLibraryPage() {
  const [selectedTask, setSelectedTask] = useState<TaskType>('task2');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [catOpen, setCatOpen] = useState(true);
  const [topicOpen, setTopicOpen] = useState(true);
  const [taskOpen, setTaskOpen] = useState(true);

  const activeCategories = selectedTask === 'task1' ? CATEGORIES_TASK1 : CATEGORIES_TASK2;
  const activeTopics = selectedTask === 'task1' ? TOPICS_TASK1 : TOPICS_TASK2;

  const handleTaskSwitch = (task: TaskType) => {
    setSelectedTask(task);
    // Reset filters when switching tasks
    setSelectedCategories([]);
    setSelectedTopics([]);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const filteredPrompts = promptsDatabase.filter(prompt => {
    if (prompt.task !== selectedTask) return false;
    const matchCat = selectedCategories.length === 0 || selectedCategories.includes(prompt.category);
    const matchTopic = selectedTopics.length === 0 || selectedTopics.includes(prompt.topic);
    return matchCat && matchTopic;
  });

  return (
    <div className="w-full min-h-screen bg-[#FFFFFF] antialiased">
      <TopHeader user={null} />
      
      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-8 pt-10 pb-32">
        <Link
          href="/"
          className="inline-flex items-center text-[#857F70] hover:text-[#141413] transition-colors font-sans text-[13px] font-medium mb-10"
        >
          <span className="mr-2">←</span> Trang chủ
        </Link>



        <div className="flex items-start gap-6 mb-12">
          <div className="w-20 h-20 rounded-[18px] bg-[#FFE17B] flex items-center justify-center shrink-0">
            <img
              src={selectedTask === 'task1' ? "/images/illustrations/il-progress.svg" : "/images/illustrations/il-study.svg"}
              className="w-10 h-10 object-contain"
              alt=""
            />
          </div>
          <div className="pt-1">
            <p className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-[#857F70] mb-3">
              {selectedTask === 'task1' ? 'Mô tả biểu đồ' : 'Nghị luận xã hội'}
            </p>
            <h1 className="font-sans font-semibold text-[32px] mb-2 tracking-tight text-[#141413] [text-wrap:balance]">
              Thư viện đề thi
            </h1>
            <p className="font-sans text-[#857F70]/80 text-[15px] max-w-[560px] leading-relaxed [text-wrap:pretty]">
              Chọn một đề bài để luyện tập. Chúng mình sẽ mô phỏng lại cấu trúc lập luận của bạn và chỉ ra chính xác lỗ hổng trong logic.
            </p>
          </div>
        </div>

        <div className="border-b border-black/10 mb-10 w-full" />

        <div className="flex items-start gap-8">
          {/* Sidebar Filters */}
          <aside className="w-[280px] shrink-0 sticky top-6">
            <div className="mb-8">
              <button 
                onClick={() => setTaskOpen(!taskOpen)}
                className="w-full flex items-center justify-between font-sans text-[18px] font-semibold text-[#141413] mb-5"
              >
                Bài thi
                <svg className={`w-4 h-4 transition-transform ${taskOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`grid transition-all duration-300 ease-in-out ${taskOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-4 pt-1 pb-2">
                  {[
                    { id: 'task1', label: 'Task 1 (Mô tả biểu đồ)' },
                    { id: 'task2', label: 'Task 2 (Nghị luận xã hội)' }
                  ].map(t => (
                    <label key={t.id} className="flex items-start gap-3.5 cursor-pointer group">
                      <div className="relative flex items-center justify-center shrink-0 mt-[2px]">
                        <input
                          type="checkbox"
                          checked={selectedTask === t.id}
                          onChange={() => handleTaskSwitch(t.id as TaskType)}
                          className="peer appearance-none w-[20px] h-[20px] border-[1.5px] border-[#2c3338]/20 rounded-[6px] bg-white group-hover:border-[#2c3338]/50 checked:!bg-[#2c3338] checked:!border-[#2c3338] transition-all cursor-pointer"
                        />
                        <svg className="absolute w-[11px] h-[11px] text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 10" fill="none">
                          <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="font-sans text-[15px] font-medium leading-snug text-[#2c3338]/80 group-hover:text-[#2c3338] transition-colors pt-[1px]">
                        {t.label}
                      </span>
                    </label>
                  ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-black/5 mb-8" />

            <div className="mb-8">
              <button 
                onClick={() => setCatOpen(!catOpen)}
                className="w-full flex items-center justify-between font-sans text-[18px] font-semibold text-[#141413] mb-5"
              >
                Dạng đề
                <svg className={`w-4 h-4 transition-transform ${catOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`grid transition-all duration-300 ease-in-out ${catOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-4 pt-1 pb-2">
                  {activeCategories.map(cat => {
                    const task1Data = selectedTask === 'task1' ? TASK1_ICONS[cat] : null;
                    const Icon = task1Data?.icon;
                    const iconColor = task1Data?.color || 'text-[#2c3338]/50 group-hover:text-[#2c3338]';
                    return (
                    <label key={cat} className="flex items-start gap-3.5 cursor-pointer group">
                      <div className="relative flex items-center justify-center shrink-0 mt-[2px]">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => toggleCategory(cat)}
                          className="peer appearance-none w-[20px] h-[20px] border-[1.5px] border-[#2c3338]/20 rounded-[6px] bg-white group-hover:border-[#2c3338]/50 checked:!bg-[#2c3338] checked:!border-[#2c3338] transition-all cursor-pointer"
                        />
                        <svg className="absolute w-[11px] h-[11px] text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 10" fill="none">
                          <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex items-center gap-2.5 pt-[1px]">
                        {Icon && <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${iconColor}`} strokeWidth={2} />}
                        <span className="font-sans text-[15px] font-medium leading-snug text-[#2c3338]/80 group-hover:text-[#2c3338] transition-colors">
                          {cat}
                        </span>
                      </div>
                    </label>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-black/5 mb-8" />

            <div>
              <button 
                onClick={() => setTopicOpen(!topicOpen)}
                className="w-full flex items-center justify-between font-sans text-[18px] font-semibold text-[#141413] mb-5"
              >
                Chủ đề
                <svg className={`w-4 h-4 transition-transform ${topicOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className={`grid transition-all duration-300 ease-in-out ${topicOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-4 pt-1 pb-2">
                  {activeTopics.map(topic => (
                    <label key={topic} className="flex items-start gap-3.5 cursor-pointer group">
                      <div className="relative flex items-center justify-center shrink-0 mt-[2px]">
                        <input
                          type="checkbox"
                          checked={selectedTopics.includes(topic)}
                          onChange={() => toggleTopic(topic)}
                          className="peer appearance-none w-[20px] h-[20px] border-[1.5px] border-[#2c3338]/20 rounded-[6px] bg-white group-hover:border-[#2c3338]/50 checked:!bg-[#2c3338] checked:!border-[#2c3338] transition-all cursor-pointer"
                        />
                        <svg className="absolute w-[11px] h-[11px] text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 10" fill="none">
                          <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="font-sans text-[15px] font-medium leading-snug text-[#2c3338]/80 group-hover:text-[#2c3338] transition-colors pt-[1px]">
                        {topic}
                      </span>
                    </label>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-grow">
            {filteredPrompts.length === 0 ? (
              <div className="bg-white rounded-[16px] border border-black/5 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                <p className="font-sans text-[#857F70] text-[15px] mb-4">Không có đề bài nào khớp với bộ lọc.</p>
                <button 
                  onClick={() => { setSelectedCategories([]); setSelectedTopics([]); }}
                  className="font-sans text-[13px] font-semibold text-[#141413] underline underline-offset-4 decoration-black/20 hover:decoration-black transition-colors"
                >
                  Xoá tất cả bộ lọc
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="bg-white rounded-[14px] flex flex-row items-stretch overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.05)] transition-all duration-200"
                  >
                    {/* Thumbnail — inset, padded, rounded */}
                    <Link
                      href={`/writing/${selectedTask}/${prompt.id}`}
                      className="shrink-0 w-[148px] sm:w-[164px] flex items-center justify-center p-3 block"
                      target="_blank"
                    >
                      <div className="w-full h-[100px] rounded-[10px] overflow-hidden bg-black/5">
                        <img
                          src={prompt.image}
                          alt={prompt.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-700 ease-out"
                          loading="lazy"
                        />
                      </div>
                    </Link>

                    {/* Prompt text + badges */}
                    <Link
                      href={`/writing/${selectedTask}/${prompt.id}`}
                      className="flex-1 min-w-0 flex flex-col justify-center px-5 py-4 group"
                      target="_blank"
                    >
                      {/* Category badges */}
                      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                        <span className="font-mono text-[9px] font-semibold tracking-[0.12em] uppercase bg-black/5 text-black/50 px-2 py-0.5 rounded-[4px]">
                          {prompt.category}
                        </span>
                        <span className="font-mono text-[9px] font-semibold tracking-[0.12em] uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-[4px]">
                          {prompt.topic}
                        </span>
                      </div>

                      {/* Prompt */}
                      <p className="font-sans text-[13.5px] font-medium leading-[1.6] text-[#141413] line-clamp-3">
                        {prompt.text}
                      </p>
                    </Link>

                    {/* Action column */}
                    <div className="shrink-0 flex flex-col items-stretch border-l border-black/5 divide-y divide-black/5 w-[88px]">
                      <Link
                        href={`/writing/${selectedTask}/${prompt.id}`}
                        className="flex-1 flex flex-col items-center justify-center px-2 py-3 hover:bg-[#111] transition-colors group/btn text-center"
                        target="_blank"
                      >
                        <span className="font-sans text-[11.5px] font-semibold text-[#141413] group-hover/btn:text-white transition-colors">Viết bài</span>
                        <span className="font-mono text-[8px] font-semibold tracking-[0.1em] uppercase mt-1 opacity-0 group-hover/btn:opacity-100 group-hover/btn:text-white/70 transition-all">Bắt đầu →</span>
                      </Link>
                      <div className="flex-1 flex flex-col items-center justify-center px-2 py-3 opacity-40 cursor-not-allowed bg-black/[0.01] text-center">
                        <span className="font-sans text-[11.5px] font-semibold text-[#141413]">Lập luận</span>
                        <span className="font-mono text-[8px] font-semibold tracking-[0.1em] uppercase text-black/40 mt-1">Sắp có</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center px-2 py-3 opacity-40 cursor-not-allowed bg-black/[0.01] text-center">
                        <span className="font-sans text-[11.5px] font-semibold text-[#141413]">Từ vựng</span>
                        <span className="font-mono text-[8px] font-semibold tracking-[0.1em] uppercase text-black/40 mt-1">Sắp có</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
