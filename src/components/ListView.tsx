import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Task, Category } from '../types';
import { TaskCard } from './TaskCard';

interface ListViewProps {
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  onReorderTasks: (draggedTaskId: string, targetTaskId: string) => void;
  onOpenNewTask: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  tasks,
  categories,
  onEditTask,
  onDeleteTask,
  onToggleStatus,
  onReorderTasks,
  onOpenNewTask,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const getCategory = (catId: string) => categories.find((c) => c.id === catId);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId && taskId !== targetTaskId) {
      onReorderTasks(taskId, targetTaskId);
    }
    setDraggedTaskId(null);
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const completedTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Pending Tasks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>未完了タスク</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-semibold">
              {pendingTasks.length}件
            </span>
          </h3>

          <button
            onClick={onOpenNewTask}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規タスク</span>
          </button>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
            未完了のタスクはありません。素晴らしいペースです！ 🎉
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                category={getCategory(task.category)}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onToggleStatus={onToggleStatus}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2">
            <span>完了したタスク</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
              {completedTasks.length}件
            </span>
          </h3>

          <div className="space-y-2">
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                category={getCategory(task.category)}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onToggleStatus={onToggleStatus}
                isDraggable={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
