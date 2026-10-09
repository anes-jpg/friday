'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Download,
  X,
  Loader2,
  Check,
  CalendarDays,
  Clock,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/* ---------- SVG Cube Replacement for react-icons/tb ---------- */
export const TbCube: React.FC<{ size?: number; className?: string; onClick?: () => void }> = ({
  size = 24,
  className,
  onClick,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    onClick={onClick}
  >
    <path d="M21 16.05V7.95a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 7.95v8.1a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16.05z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);

/* ---------- Types ---------- */
export interface SubscriptionDay {
  date: number;
  isMuted?: boolean;
  isLogo?: React.ReactNode[];
  indicators?: React.ReactNode[];
  taskCount?: number;
}

export interface SubscriptionCalendarProps {
  month: string;
  year: number;
  days: SubscriptionDay[];
  monthlyTotal: number;
  subscriptionsCount: number;
  newCount: number;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onScheduleTask?: (task: { name: string; cron: string }) => void;
}

/* ---------- Motion ---------- */
const spring = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.6,
} as const;

/* ---------- Task Scheduler Calendar Component ---------- */
export const SubscriptionCalendar: React.FC<SubscriptionCalendarProps> = ({
  month,
  year,
  days,
  monthlyTotal,
  subscriptionsCount,
  newCount,
  onPrevMonth,
  onNextMonth,
  onScheduleTask,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>('day-28');
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // New task form state
  const [taskName, setTaskName] = useState('');
  const [taskTrigger, setTaskTrigger] = useState('0 9 * * 1-5');

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 1500);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    if (onScheduleTask) {
      onScheduleTask({ name: taskName.trim(), cron: taskTrigger.trim() });
    }
    setTaskName('');
    setIsAdding(false);
  };

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring}
      className="relative w-full max-w-105 rounded-[22px] border border-black/10 bg-[hsl(var(--surface-raised))] p-4 shadow-2xl transition-all duration-300 sm:p-5 dark:border-white/10 dark:bg-[#121316]"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden sm:gap-3">
          <h2 className="truncate text-[12px] font-semibold text-zinc-800 sm:text-[13px] dark:text-[#D8D8D8]">
            {month}, {year}
          </h2>
          <span className="xs:inline-block hidden cursor-default rounded-full border border-black/10 bg-black/5 px-2.5 py-0.5 text-[9px] font-instrument uppercase whitespace-nowrap text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-[#a3a3a3]">
            Scheduler
          </span>
          <div className="ml-1 flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              title="Previous Month"
              onClick={onPrevMonth}
              className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-[#7c7b7b] dark:hover:bg-white/5 dark:hover:text-white cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              title="Next Month"
              onClick={onNextMonth}
              className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-[#7c7b7b] dark:hover:bg-white/5 dark:hover:text-white cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button
          type="button"
          title="Schedule New Task"
          onClick={() => setIsAdding(true)}
          className="flex h-7 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ink))] text-[hsl(var(--surface))] shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer dark:bg-white dark:text-black"
        >
          <Plus size={15} />
        </button>
      </div>

      <div>
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[20px] bg-white/95 p-5 backdrop-blur-md dark:bg-[#121316]/95 border border-black/10 dark:border-white/10"
            >
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))]">
                <Clock size={20} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-zinc-900 dark:text-white">
                Schedule New Task
              </h3>
              <p className="mb-4 text-center text-[10px] text-zinc-500 dark:text-zinc-400 font-instrument">
                Define a cron trigger or recurring background automation.
              </p>
              <form onSubmit={handleCreateTask} className="flex w-full flex-col gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Task Name (e.g. Daily Sync, Price Monitor)"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-[11px] outline-none focus:border-[hsl(var(--signal))] dark:border-white/10 dark:bg-white/5 text-[hsl(var(--ink))]"
                />
                <input
                  type="text"
                  placeholder="Trigger Expression (e.g. 0 9 * * 1-5)"
                  value={taskTrigger}
                  onChange={(e) => setTaskTrigger(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-[11px] font-instrument outline-none focus:border-[hsl(var(--signal))] dark:border-white/10 dark:bg-white/5 text-[hsl(var(--ink))]"
                />
                <button
                  type="submit"
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[hsl(var(--ink))] py-2 text-[11px] font-semibold text-[hsl(var(--surface))] transition-opacity hover:opacity-90 cursor-pointer dark:bg-white dark:text-black font-instrument"
                >
                  <Check size={14} /> Schedule Job
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[20px] bg-white/95 p-5 backdrop-blur-md dark:bg-[#121316]/95 border border-black/10 dark:border-white/10"
            >
              <button
                type="button"
                onClick={() => setIsSearching(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Search size={20} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-zinc-900 dark:text-white">
                Search Scheduled Tasks
              </h3>
              <div className="mt-3 w-full">
                <input
                  autoFocus
                  type="text"
                  placeholder="Filter tasks by name, cron, or trigger..."
                  className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-[11px] outline-none focus:border-[hsl(var(--signal))] dark:border-white/10 dark:bg-white/5 text-[hsl(var(--ink))]"
                />
              </div>
              <div className="mt-4 flex max-h-32 w-full flex-col gap-2 overflow-y-auto">
                <p className="text-center text-[10px] text-zinc-400 font-instrument">
                  Type to filter jobs scheduled for this month
                </p>
              </div>
            </motion.div>
          )}

          {isSummaryOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[20px] bg-white/95 p-5 backdrop-blur-md dark:bg-[#121316]/95 border border-black/10 dark:border-white/10"
            >
              <button
                type="button"
                onClick={() => setIsSummaryOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))]">
                <TbCube size={22} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-zinc-900 dark:text-white">
                Scheduler Overview
              </h3>
              <div className="mt-4 grid w-full grid-cols-2 gap-2.5 font-instrument">
                <div className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted))]">Active Jobs</div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                    {subscriptionsCount}
                  </div>
                </div>
                <div className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted))]">Today's Triggers</div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                    {newCount}
                  </div>
                </div>
                <div className="col-span-2 rounded-lg bg-[hsl(var(--signal))]/10 border border-[hsl(var(--signal))]/20 p-3">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--signal))]">Monthly Executions</div>
                  <div className="text-sm font-bold text-[hsl(var(--signal))] mt-0.5">
                    {monthlyTotal} Executed · 99.8% Pass Rate
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-[8px] font-semibold tracking-wider text-zinc-400 sm:text-[9px] dark:text-[#a0a0a0]">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
              <div
                key={d}
                className="rounded-full bg-black/5 py-1 text-center dark:bg-white/5"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {days.map((day, idx) => {
              const uniqueId = `day-${day.date}-${idx}`;
              const isActive = selectedId === uniqueId;

              return (
                <motion.button
                  key={uniqueId}
                  layout
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedId(uniqueId)}
                  transition={spring}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] font-medium transition-colors sm:h-11 sm:text-[11px] cursor-pointer ${
                    day.isMuted
                      ? 'border-transparent text-zinc-300 dark:text-neutral-700'
                      : 'border-black/5 bg-black/[0.02] text-zinc-700 hover:border-black/20 dark:border-white/5 dark:bg-white/[0.02] dark:text-[#d4d4d4] dark:hover:border-white/20'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeGlow"
                      className="absolute inset-0 z-0 rounded-xl border-[1.5px] border-[hsl(var(--signal))] bg-[hsl(var(--signal))]/10"
                      transition={spring}
                    />
                  )}

                  <div className="relative z-10 flex flex-col items-center justify-start gap-0.5 sm:gap-1">
                    <span>{day.date}</span>
                    <span className="scale-75 sm:scale-100">{day.isLogo}</span>
                  </div>

                  {day.indicators && (
                    <div className="absolute top-1 right-1 flex gap-0.5 sm:top-1.5 sm:right-1.5">
                      {day.indicators}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between gap-2 text-[8px] font-semibold tracking-widest text-zinc-400 sm:text-[9px] dark:text-[#888] font-instrument">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex cursor-default items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" />
            CRON
          </span>
          <span className="flex cursor-default items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fa6a2e]" />
            TASK
          </span>
        </div>

        <span className="whitespace-nowrap text-zinc-500 dark:text-[#a0a0a0]">
          <span className="text-zinc-900 dark:text-white font-bold">
            {subscriptionsCount}
          </span>{' '}
          JOBS /{' '}
          <span className="text-zinc-900 dark:text-white font-bold">{newCount}</span>{' '}
          ACTIVE
        </span>
      </div>

      {/* Bottom Bar */}
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-black/10 pt-3 dark:border-white/10 font-instrument">
        <div className="flex gap-3 text-zinc-400 sm:gap-3.5 dark:text-[#888]">
          <Search
            size={15}
            onClick={() => setIsSearching(true)}
            className="shrink-0 cursor-pointer transition-colors hover:text-zinc-900 dark:hover:text-white"
          />
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="relative flex items-center justify-center transition-colors hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 size={15} className="animate-spin text-[hsl(var(--signal))]" />
            ) : (
              <Download size={15} className="shrink-0" />
            )}
          </button>
          <TbCube
            size={15}
            onClick={() => setIsSummaryOpen(true)}
            className="shrink-0 cursor-pointer transition-colors hover:text-zinc-900 dark:hover:text-white"
          />
        </div>

        <div className="truncate text-[9px] font-medium text-zinc-500 sm:text-[10px] dark:text-[#888]">
          SCHEDULED RUNS :{' '}
          <span className="ml-1 text-[11px] font-bold text-zinc-900 sm:text-[11px] dark:text-white">
            {monthlyTotal} EXECUTIONS
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default SubscriptionCalendar;
