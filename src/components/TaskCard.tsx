import React from 'react';
import {
  GripVertical,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Bell,
  MoreVertical,
  Edit2,
  Trash2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task, Category, PRIORITY_CONFIG } from '../types';
import { soundService } from '../services/sound';

interface TaskCardProps {
  task: Task;
  category?: Category;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetTaskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  onEdit,
  onDelete,
  onToggleStatus,
  isDraggable = true,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const pConf = PRIORITY_CONFIG[task.priority];
  const isDone = task.status === 'done';

  // Check deadline status
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let isOverdue = false;
  let isDueToday = false;
  let isDueSoon = false;

  if (task.dueDate && !isDone) {
    const dueDateTime = new Date(
      task.dueTime ? `${task.dueDate}T${task.dueTime}:00` : `${task.dueDate}T23:59:59`
    );
    const diffMs = dueDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      isOverdue = true;
    } else if (task.dueDate === todayStr) {
      isDueToday = true;
      if (diffHours <= 3) isDueSoon = true;
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDone) {
      // Confetti burst on complete!
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 },
      });
      soundService.playCompleteSound();
    }
    onToggleStatus(task.id);
  };

  const completedSubtasksCount = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasksCount = task.subtasks?.length || 0;

  return (
    <div
      draggable={isDraggable && !isDone}
      onDragStart={(e) => onDragStart?.(e, task.id)}
      onDragOver={(e) => onDragOver?.(e)}
      onDrop={(e) => onDrop?.(e, task.id)}
      onClick={() => onEdit(task)}
      className={`group relative rounded-xl border p-3.5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        pConf.border
      } border-l-[5px] ${
        isDone
          ? 'opacity-65 bg-slate-50 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800'
          : isOverdue
          ? 'border-rose-400/80 dark:border-rose-800/80 bg-rose-50/20 dark:bg-rose-950/15'
          : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-600'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Drag handle */}
        {isDraggable && !isDone && (
          <div
            className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 group-hover:text-slate-500 pt-0.5"
            onClick={(e) => e.stopPropagation()}
            title="ドラッグして並び替え"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          className="text-slate-400 hover:text-indigo-600 transition-colors pt-0.5 flex-shrink-0"
          title={isDone ? '未完了に戻す' : '完了にする'}
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
          ) : (
            <Circle className="w-5 h-5 hover:stroke-indigo-600" />
          )}
        </button>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Priority & Category tags & Actions */}
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Priority badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pConf.badgeBg}`}
              >
                {pConf.label}
              </span>

              {/* Category pill */}
              {category && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>{category.name}</span>
                </span>
              )}

              {/* Estimated minutes */}
              {task.estimatedMinutes && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {task.estimatedMinutes}分
                </span>
              )}
            </div>

            {/* Quick delete / edit action buttons on hover */}
            <div
              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onEdit(task)}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="編集"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Title */}
          <div
            className={`text-sm font-bold text-slate-900 dark:text-white leading-snug break-words ${
              isDone ? 'line-through text-slate-400 dark:text-slate-500' : ''
            }`}
          >
            {task.title}
          </div>

          {/* Description preview if present */}
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Subtasks Progress */}
          {totalSubtasksCount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>サブタスク</span>
                <span>
                  {completedSubtasksCount}/{totalSubtasksCount}
                </span>
              </div>
              <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{
                    width: `${(completedSubtasksCount / totalSubtasksCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Bottom metadata: Due date, Reminders, Tags */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/50 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Due Date with Urgency formatting */}
              {task.dueDate && (
                <div
                  className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                    isDone
                      ? 'text-slate-400'
                      : isOverdue
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                      : isDueSoon
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : isDueToday
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isOverdue ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : isDueSoon ? (
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isOverdue
                      ? `期限切れ (${task.dueDate})`
                      : isDueToday
                      ? `今日中 ${task.dueTime || ''}`
                      : `${task.dueDate} ${task.dueTime || ''}`}
                  </span>
                </div>
              )}

              {/* Reminders count badge */}
              {task.reminders && task.reminders.length > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded"
                  title={`${task.reminders.length}件のリマインダー設定済み`}
                >
                  <Bell className="w-3 h-3" />
                  <span>{task.reminders.length}</span>
                </span>
              )}
            </div>

            {/* Tags preview */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-center gap-1 overflow-hidden">
                {task.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded"
                  >
                    #{t}
                  </span>
                ))}
                {task.tags.length > 2 && (
                  <span className="text-[10px] text-slate-400">
                    +{task.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
