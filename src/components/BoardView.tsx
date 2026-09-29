import React, { useState } from 'react';
import { Plus, Kanban, Layers } from 'lucide-react';
import { Task, Category, TaskPriority, TaskStatus, PRIORITY_CONFIG } from '../types';
import { TaskCard } from './TaskCard';

interface BoardViewProps {
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  onMoveTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTasks: (draggedTaskId: string, targetTaskId: string) => void;
  onOpenNewTaskWithDefaults: (defaults: { status?: TaskStatus; priority?: TaskPriority }) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  tasks,
  categories,
  onEditTask,
  onDeleteTask,
  onToggleStatus,
  onMoveTaskStatus,
  onReorderTasks,
  onOpenNewTaskWithDefaults,
}) => {
  const [boardGrouping, setBoardGrouping] = useState<'status' | 'priority'>('status');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getCategory = (catId: string) => categories.find((c) => c.id === catId);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverColumn = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      onMoveTaskStatus(taskId, targetStatus);
    }
    setDraggedTaskId(null);
  };

  const handleDropOnTask = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId && taskId !== targetTaskId) {
      onReorderTasks(taskId, targetTaskId);
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="space-y-4">
      {/* Board Grouping Toggle Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 max-w-full overflow-x-auto">
          <span className="text-xs font-semibold text-slate-500 flex-shrink-0">表示形式:</span>
          <div className="flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setBoardGrouping('status')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md transition-all ${
                boardGrouping === 'status'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">進捗別 (未着手 / 進行中 / 完了)</span>
              <span className="sm:hidden">進捗別</span>
            </button>
            <button
              onClick={() => setBoardGrouping('priority')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md transition-all ${
                boardGrouping === 'priority'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">優先度マトリクス (緊急 / 高 / 中 / 低)</span>
              <span className="sm:hidden">優先度別</span>
            </button>
          </div>
        </div>

        <span className="text-[11px] text-slate-400 hidden sm:inline">
          ※カードをドラッグ＆ドロップして順番変更や移動ができます
        </span>
      </div>

      {/* Columns Container */}
      {boardGrouping === 'status' ? (
        /* STATUS GROUPING (Kanban: ToDo, In Progress, Done) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Column: ToDo */}
          <div
            onDragOver={(e) => handleDragOverColumn(e, 'todo')}
            onDrop={(e) => handleDropOnColumn(e, 'todo')}
            className={`rounded-2xl border p-4 bg-slate-100/70 dark:bg-slate-900/60 transition-colors min-h-[500px] flex flex-col ${
              dragOverColumn === 'todo'
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                : 'border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  未着手 (ToDo)
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {tasks.filter((t) => t.status === 'todo').length}
                </span>
              </div>
              <button
                onClick={() => onOpenNewTaskWithDefaults({ status: 'todo' })}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="タスクを追加"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1">
              {tasks
                .filter((t) => t.status === 'todo')
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    category={getCategory(task.category)}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onToggleStatus={onToggleStatus}
                    onDragStart={handleDragStart}
                    onDrop={handleDropOnTask}
                  />
                ))}
            </div>

            <button
              onClick={() => onOpenNewTaskWithDefaults({ status: 'todo' })}
              className="mt-3 w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>未着手タスクを追加</span>
            </button>
          </div>

          {/* Column: In Progress */}
          <div
            onDragOver={(e) => handleDragOverColumn(e, 'in_progress')}
            onDrop={(e) => handleDropOnColumn(e, 'in_progress')}
            className={`rounded-2xl border p-4 bg-slate-100/70 dark:bg-slate-900/60 transition-colors min-h-[500px] flex flex-col ${
              dragOverColumn === 'in_progress'
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                : 'border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  進行中 (In Progress)
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {tasks.filter((t) => t.status === 'in_progress').length}
                </span>
              </div>
              <button
                onClick={() => onOpenNewTaskWithDefaults({ status: 'in_progress' })}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="タスクを追加"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1">
              {tasks
                .filter((t) => t.status === 'in_progress')
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    category={getCategory(task.category)}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onToggleStatus={onToggleStatus}
                    onDragStart={handleDragStart}
                    onDrop={handleDropOnTask}
                  />
                ))}
            </div>

            <button
              onClick={() => onOpenNewTaskWithDefaults({ status: 'in_progress' })}
              className="mt-3 w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>進行中タスクを追加</span>
            </button>
          </div>

          {/* Column: Done */}
          <div
            onDragOver={(e) => handleDragOverColumn(e, 'done')}
            onDrop={(e) => handleDropOnColumn(e, 'done')}
            className={`rounded-2xl border p-4 bg-slate-100/70 dark:bg-slate-900/60 transition-colors min-h-[500px] flex flex-col ${
              dragOverColumn === 'done'
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                : 'border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  完了 (Done)
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {tasks.filter((t) => t.status === 'done').length}
                </span>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              {tasks
                .filter((t) => t.status === 'done')
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    category={getCategory(task.category)}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onToggleStatus={onToggleStatus}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : (
        /* PRIORITY MATRIX GROUPING (Urgent, High, Medium, Low) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
            const conf = PRIORITY_CONFIG[p];
            const pTasks = tasks.filter((t) => t.priority === p);

            return (
              <div
                key={p}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 bg-slate-100/70 dark:bg-slate-900/60 min-h-[500px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${conf.dotColor}`} />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {conf.label}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {pTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => onOpenNewTaskWithDefaults({ priority: p })}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 flex-1">
                  {pTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      category={getCategory(task.category)}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onToggleStatus={onToggleStatus}
                      onDragStart={handleDragStart}
                      onDrop={handleDropOnTask}
                    />
                  ))}
                </div>

                <button
                  onClick={() => onOpenNewTaskWithDefaults({ priority: p })}
                  className="mt-3 w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{conf.shortLabel}タスクを追加</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
