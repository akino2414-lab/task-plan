import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Task, Category, PRIORITY_CONFIG } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
  onOpenNewTaskForDate: (dateStr: string) => void;
  onUpdateTaskDate: (taskId: string, newDateStr: string) => void;
  onToggleStatus: (taskId: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  categories,
  onEditTask,
  onOpenNewTaskForDate,
  onUpdateTaskDate,
  onToggleStatus,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid dates for current month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0: Sunday, 1: Monday, ...
  const daysInMonth = lastDayOfMonth.getDate();

  // Previous month overflow days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const calendarCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Fill prev month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = prevDate.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Fill current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dateStr = curDate.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Fill next month padding to reach full rows (multiples of 7)
  const remaining = 7 - (calendarCells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split('T')[0];
      calendarCells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }
  }

  // Group tasks by date
  const tasksByDate = new Map<string, Task[]>();
  tasks.forEach((task) => {
    if (task.dueDate) {
      const list = tasksByDate.get(task.dueDate) || [];
      list.push(task);
      tasksByDate.set(task.dueDate, list);
    }
  });

  const getCategory = (catId: string) => categories.find((c) => c.id === catId);

  // Drag and drop onto a calendar date
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnDate = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      onUpdateTaskDate(taskId, targetDateStr);
    }
    setDraggedTaskId(null);
  };

  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];

  // Detail drawer for selected day
  const selectedDayTasks = selectedDayDate ? tasksByDate.get(selectedDayDate) || [] : [];

  return (
    <div className="space-y-4">
      {/* Calendar Navigation & Mode Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="前月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="次月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-500" />
            <span>
              {year}年 {month + 1}月
            </span>
          </h2>

          <button
            onClick={goToToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
          >
            今日
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>💡 日付マスにタスクをドラッグして日付を変更できます</span>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day}
              className={idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : ''}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
          {calendarCells.map((cell, idx) => {
            const dayTasks = tasksByDate.get(cell.dateStr) || [];
            const isSelected = selectedDayDate === cell.dateStr;

            return (
              <div
                key={cell.dateStr + idx}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnDate(e, cell.dateStr)}
                onClick={() => setSelectedDayDate(cell.dateStr)}
                className={`min-h-[105px] sm:min-h-[125px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer group ${
                  cell.isCurrentMonth
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50/60 dark:bg-slate-950/30 opacity-40'
                } ${
                  cell.isToday
                    ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20 dark:bg-indigo-950/15'
                    : ''
                } ${
                  isSelected
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Cell Header: Day number + Add button on hover */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      cell.isToday
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewTaskForDate(cell.dateStr);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition-opacity"
                    title={`${cell.dateStr} にタスクを追加`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Day Tasks List inside cell */}
                <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px] scrollbar-none">
                  {dayTasks.slice(0, 3).map((task) => {
                    const pConf = PRIORITY_CONFIG[task.priority];
                    const isDone = task.status === 'done';

                    return (
                      <div
                        key={task.id}
                        draggable={!isDone}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(task);
                        }}
                        className={`text-[10px] sm:text-[11px] p-1 rounded-md border flex items-center gap-1 font-medium truncate transition-all ${
                          isDone
                            ? 'line-through text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                            : `${pConf.badgeBg} hover:shadow-xs`
                        }`}
                        title={`${task.title} (${pConf.label})`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pConf.dotColor}`}
                        />
                        <span className="truncate flex-1">{task.title}</span>
                      </div>
                    );
                  })}

                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-slate-400 font-semibold px-1">
                      他 {dayTasks.length - 3} 件...
                    </div>
                  )}
                </div>

                {/* Cell Footer workload summary */}
                {dayTasks.length > 0 && (
                  <div className="text-[9px] text-slate-400 text-right mt-1 font-mono">
                    {dayTasks.length}件
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail Panel / Drawer */}
      {selectedDayDate && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs">
                {selectedDayDate}
              </span>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                この日のスケジュール ({selectedDayTasks.length}件)
              </h3>
            </div>

            <button
              onClick={() => onOpenNewTaskForDate(selectedDayDate)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>この日にタスクを追加</span>
            </button>
          </div>

          {selectedDayTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              この日にはまだタスクが割り当てられていません。
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedDayTasks.map((t) => {
                const pConf = PRIORITY_CONFIG[t.priority];
                const isDone = t.status === 'done';
                return (
                  <div
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-indigo-400 cursor-pointer shadow-xs transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pConf.badgeBg}`}
                      >
                        {pConf.shortLabel}
                      </span>
                      {t.dueTime && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> {t.dueTime}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs font-bold text-slate-900 dark:text-white truncate ${
                        isDone ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {t.title}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
