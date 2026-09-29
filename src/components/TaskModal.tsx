import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Tag,
  Plus,
  Trash2,
  Bell,
  Volume2,
  Play,
  CheckCircle2,
  Folder,
} from 'lucide-react';
import {
  Task,
  TaskPriority,
  Category,
  TaskReminder,
  NotificationSoundType,
  PRIORITY_CONFIG,
  SOUND_OPTIONS,
} from '../types';
import { soundService } from '../services/sound';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'order'> & { id?: string }) => void;
  initialTask?: Task | null;
  categories: Category[];
  availableTags: string[];
  defaultDate?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  categories,
  availableTags,
  defaultDate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [category, setCategory] = useState(categories[0]?.id || 'work');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(30);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Reminders and sound
  const [reminders, setReminders] = useState<TaskReminder[]>([]);
  const [soundType, setSoundType] = useState<NotificationSoundType>(soundService.getDefaultSound());

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description || '');
      setPriority(initialTask.priority);
      setStatus(initialTask.status);
      setCategory(initialTask.category || categories[0]?.id || 'work');
      setDueDate(initialTask.dueDate || '');
      setDueTime(initialTask.dueTime || '');
      setEstimatedMinutes(initialTask.estimatedMinutes);
      setTags(initialTask.tags || []);
      setSubtasks(initialTask.subtasks || []);
      setReminders(initialTask.reminders || []);
      setSoundType(initialTask.soundType || soundService.getDefaultSound());
    } else {
      // Default initial state
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setCategory(categories[0]?.id || 'work');
      const todayStr = defaultDate || new Date().toISOString().split('T')[0];
      setDueDate(todayStr);
      setDueTime('18:00');
      setEstimatedMinutes(30);
      setTags([]);
      setSubtasks([]);
      setReminders([]);
      setSoundType(soundService.getDefaultSound());
    }
  }, [initialTask, isOpen, defaultDate, categories]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      setSubtasks([
        ...subtasks,
        {
          id: 'sub_' + Math.random().toString(36).substring(2, 9),
          title: newSubtaskTitle.trim(),
          completed: false,
        },
      ]);
      setNewSubtaskTitle('');
    }
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(
      subtasks.map((st) => (st.id === id ? { ...st, completed: !st.completed } : st))
    );
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== id));
  };

  // Add a reminder preset or custom
  const handleAddReminder = (preset?: '10m' | '30m' | '1h' | '1d' | 'today_9am') => {
    const baseDate = dueDate || new Date().toISOString().split('T')[0];
    const baseTime = dueTime || '18:00';
    const dueDateTime = new Date(`${baseDate}T${baseTime}:00`);

    let targetDate = new Date(dueDateTime);
    let label = 'カスタムリマインダー';

    if (preset === '10m') {
      targetDate = new Date(dueDateTime.getTime() - 10 * 60 * 1000);
      label = '10分前';
    } else if (preset === '30m') {
      targetDate = new Date(dueDateTime.getTime() - 30 * 60 * 1000);
      label = '30分前';
    } else if (preset === '1h') {
      targetDate = new Date(dueDateTime.getTime() - 60 * 60 * 1000);
      label = '1時間前';
    } else if (preset === '1d') {
      targetDate = new Date(dueDateTime.getTime() - 24 * 60 * 60 * 1000);
      label = '前日';
    } else if (preset === 'today_9am') {
      targetDate = new Date(`${baseDate}T09:00:00`);
      label = '当日朝 9:00';
    }

    const isoLocal = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const newRem: TaskReminder = {
      id: 'rem_' + Math.random().toString(36).substring(2, 9),
      datetime: isoLocal,
      label,
      triggered: false,
    };

    setReminders([...reminders, newRem]);
  };

  const handleUpdateReminder = (id: string, updates: Partial<TaskReminder>) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleRemoveReminder = (id: string) => {
    setReminders(reminders.filter((r) => r.id !== id));
  };

  const handleTestSound = (type: NotificationSoundType) => {
    soundService.playSound(type);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...(initialTask?.id ? { id: initialTask.id } : {}),
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      category,
      dueDate,
      dueTime: dueTime || undefined,
      estimatedMinutes,
      tags,
      subtasks,
      reminders,
      soundType,
      completedAt: status === 'done' ? (initialTask?.completedAt || new Date().toISOString()) : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${PRIORITY_CONFIG[priority].dotColor}`}
            />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {initialTask ? 'タスクを編集' : '新しいタスクを作成'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              タスク名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: クライアント向けプレゼン資料の作成"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all"
            />
          </div>

          {/* Priority Selection (Visualized & clear) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              優先順位の選択
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                const conf = PRIORITY_CONFIG[p];
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? `${conf.badgeBg} ring-2 ring-indigo-500 shadow-sm font-semibold`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${conf.dotColor}`} />
                      <span className="text-xs font-bold">{conf.shortLabel}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {conf.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ステータス
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="todo">📌 未着手 (ToDo)</option>
                <option value="in_progress">⏳ 進行中 (In Progress)</option>
                <option value="done">✅ 完了 (Done)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                カテゴリー
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Due Date & Time & Estimated Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                期日 (Date)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                時刻 (Time)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                見積もり時間 (分)
              </label>
              <select
                value={estimatedMinutes || 30}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={15}>15分 (小タスク)</option>
                <option value={30}>30分 (通常)</option>
                <option value={45}>45分</option>
                <option value={60}>1時間 (集中作業)</option>
                <option value={90}>1時間30分</option>
                <option value={120}>2時間 (ヘビータスク)</option>
                <option value={180}>3時間以上</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              詳細メモ・概要
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="参考リンク、要点、チェック事項など..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all resize-none"
            />
          </div>

          {/* Subtasks (Checklist) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>チェックリスト (サブタスク)</span>
              <span className="text-[11px] text-slate-500">
                {subtasks.filter((s) => s.completed).length}/{subtasks.length} 完了
              </span>
            </label>
            <div className="space-y-1.5 mb-2">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(st.id)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${st.completed ? 'text-emerald-500 fill-emerald-500/20' : ''}`}
                    />
                  </button>
                  <span
                    className={`flex-1 text-xs text-slate-800 dark:text-slate-200 ${
                      st.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                    }`}
                  >
                    {st.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="サブタスクを追加..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 transition-colors"
              >
                追加
              </button>
            </div>
          </div>

          {/* Multiple Reminders & Sound Section */}
          <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  通知リマインダー設定 (複数指定可能)
                </span>
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                {reminders.length}件設定中
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAddReminder('10m')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                + 10分前
              </button>
              <button
                type="button"
                onClick={() => handleAddReminder('30m')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                + 30分前
              </button>
              <button
                type="button"
                onClick={() => handleAddReminder('1h')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                + 1時間前
              </button>
              <button
                type="button"
                onClick={() => handleAddReminder('today_9am')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                + 当日朝9時
              </button>
              <button
                type="button"
                onClick={() => handleAddReminder()}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors"
              >
                + カスタム追加
              </button>
            </div>

            {/* List of active reminders for this task */}
            {reminders.length > 0 && (
              <div className="space-y-2 mt-2">
                {reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <input
                      type="text"
                      value={rem.label || ''}
                      onChange={(e) => handleUpdateReminder(rem.id, { label: e.target.value })}
                      placeholder="通知ラベル (例: 事前確認)"
                      className="w-28 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <input
                      type="datetime-local"
                      value={rem.datetime}
                      onChange={(e) => handleUpdateReminder(rem.id, { datetime: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(rem.id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Notification Sound Selection */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  通知サウンド:
                </span>
                <select
                  value={soundType}
                  onChange={(e) => {
                    const chosen = e.target.value as NotificationSoundType;
                    setSoundType(chosen);
                    soundService.playSound(chosen);
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {SOUND_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleTestSound(soundType)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>試聴</span>
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              タグ (Tags)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="タグを入力してEnter (例: 急ぎ, 会議, 資料)..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200"
              >
                追加
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              {initialTask ? '更新する' : 'タスクを保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
