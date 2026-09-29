import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  CalendarDays,
  Target,
  Lightbulb,
  Check,
} from 'lucide-react';
import {
  Task,
  Category,
  AIPlanResult,
  AIGeneratedGoalPlan,
  PRIORITY_CONFIG,
} from '../types';

interface AiPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  categories: Category[];
  onApplySchedule: (taskDateUpdates: { taskId: string; newDueDate: string; newOrder?: number }[]) => void;
  onAddGeneratedTasks: (newTasks: Array<Omit<Task, 'id' | 'createdAt' | 'order'>>) => void;
}

export const AiPlannerModal: React.FC<AiPlannerModalProps> = ({
  isOpen,
  onClose,
  tasks,
  categories,
  onApplySchedule,
  onAddGeneratedTasks,
}) => {
  const [activeMode, setActiveMode] = useState<'existing' | 'goal'>('existing');

  // Mode 1: Existing tasks scheduler state
  const [daysToPlan, setDaysToPlan] = useState<number>(30);
  const [targetHoursPerDay, setTargetHoursPerDay] = useState<number>(4);
  const [userGoalNote, setUserGoalNote] = useState<string>('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<AIPlanResult | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [appliedSuccessfully, setAppliedSuccessfully] = useState(false);

  // Mode 2: Goal breakdown state
  const [goalInput, setGoalInput] = useState('');
  const [goalDays, setGoalDays] = useState<number>(90);
  const [goalCategory, setGoalCategory] = useState(categories[0]?.id || 'work');
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [goalPlanResult, setGoalPlanResult] = useState<AIGeneratedGoalPlan | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalAddedSuccessfully, setGoalAddedSuccessfully] = useState(false);

  if (!isOpen) return null;

  const pendingTasks = tasks.filter((t) => t.status !== 'done');

  // Trigger AI plan on existing tasks
  const handleGenerateExistingPlan = async () => {
    if (pendingTasks.length === 0) return;
    setIsPlanning(true);
    setPlanResult(null);
    setPlanError(null);
    setAppliedSuccessfully(false);

    try {
      const res = await fetch('/api/ai/plan-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: pendingTasks.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            estimatedMinutes: t.estimatedMinutes || 30,
            category: t.category,
            tags: t.tags,
          })),
          daysToPlan,
          targetHoursPerDay,
          userGoal: userGoalNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'AI計画の生成に失敗しました');
      }

      const data: AIPlanResult = await res.json();
      setPlanResult(data);
    } catch (err: any) {
      console.error(err);
      setPlanError(err.message || 'AI計画の生成中にエラーが発生しました。再試行してください。');
    } finally {
      setIsPlanning(false);
    }
  };

  // Apply the generated day schedule to the actual tasks
  const handleApplyToCalendar = () => {
    if (!planResult) return;

    const updates: { taskId: string; newDueDate: string; newOrder?: number }[] = [];
    let currentOrder = 1;

    planResult.schedule.forEach((day) => {
      day.allocatedTaskIds.forEach((taskId) => {
        updates.push({
          taskId,
          newDueDate: day.date,
          newOrder: currentOrder++,
        });
      });
    });

    onApplySchedule(updates);
    setAppliedSuccessfully(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Trigger AI goal breakdown
  const handleGenerateGoalRoadmap = async () => {
    if (!goalInput.trim()) return;
    setIsGeneratingGoal(true);
    setGoalPlanResult(null);
    setGoalError(null);
    setGoalAddedSuccessfully(false);

    try {
      const res = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalInput.trim(),
          days: goalDays,
          category: goalCategory,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'ロードマップの生成に失敗しました');
      }

      const data: AIGeneratedGoalPlan = await res.json();
      setGoalPlanResult(data);
    } catch (err: any) {
      console.error(err);
      setGoalError(err.message || 'ロードマップの生成中にエラーが発生しました。再試行してください。');
    } finally {
      setIsGeneratingGoal(false);
    }
  };

  // Add goal tasks to task list
  const handleAddGoalTasksToList = () => {
    if (!goalPlanResult) return;

    const formattedTasks = goalPlanResult.tasks.map((gt) => ({
      title: gt.title,
      description: gt.description,
      priority: gt.priority,
      status: 'todo' as const,
      category: gt.category || goalCategory,
      tags: gt.tags || ['AI計画'],
      dueDate: gt.dueDate,
      estimatedMinutes: gt.estimatedMinutes || 30,
      subtasks: (gt.subtasks || []).map((st) => ({
        id: 'sub_' + Math.random().toString(36).substring(2, 9),
        title: st.title,
        completed: false,
      })),
      reminders: [],
    }));

    onAddGeneratedTasks(formattedTasks);
    setGoalAddedSuccessfully(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-6 overflow-hidden transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white dark:from-slate-800/80 dark:via-indigo-950/40 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI 日別スケジュール立案 (Smart Planner)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                「この日はこれ、この日はこれ」と無理のない日別計画を自動生成します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-850">
          <button
            onClick={() => setActiveMode('existing')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeMode === 'existing'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>未完了タスクを日別に自動配分 ({pendingTasks.length}件)</span>
          </button>
          <button
            onClick={() => setActiveMode('goal')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeMode === 'goal'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>新しい目標から日別ロードマップ作成</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
          {activeMode === 'existing' ? (
            /* MODE 1: Schedule Existing Tasks */
            <div className="space-y-5">
              {/* Configuration panel */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      計画期間 (短期〜長期)
                    </label>
                    <select
                      value={daysToPlan}
                      onChange={(e) => setDaysToPlan(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value={3}>3日間 (直近・短期集中スプリント)</option>
                      <option value={5}>5日間 (平日1週間・今週中)</option>
                      <option value={7}>1週間 (7日間バランス計画)</option>
                      <option value={14}>2週間 (スプリント・中期配分)</option>
                      <option value={30}>1ヶ月 (30日間マイルストーン計画)</option>
                      <option value={60}>2ヶ月 (60日間プロジェクト計画)</option>
                      <option value={90}>3ヶ月 (四半期クォーター計画)</option>
                      <option value={180}>半年 (180日間長期ロードマップ)</option>
                    </select>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[
                        { label: '3日', value: 3 },
                        { label: '1週間', value: 7 },
                        { label: '2週間', value: 14 },
                        { label: '1ヶ月', value: 30 },
                        { label: '2ヶ月', value: 60 },
                        { label: '3ヶ月', value: 90 },
                        { label: '半年', value: 180 },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setDaysToPlan(p.value)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-colors ${
                            daysToPlan === p.value
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      1日の作業目安時間 (時間)
                    </label>
                    <select
                      value={targetHoursPerDay}
                      onChange={(e) => setTargetHoursPerDay(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    >
                      <option value={2}>2時間 (スキマ時間・副業ペース)</option>
                      <option value={4}>4時間 (半日集中)</option>
                      <option value={6}>6時間 (フルタイム)</option>
                      <option value={8}>8時間 (最大集中)</option>
                    </select>

                    {daysToPlan >= 30 && (
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2 bg-indigo-50 dark:bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        🌟 <strong>長期計画モード</strong>:
                        {daysToPlan >= 180 ? '半年間' : daysToPlan >= 90 ? '3ヶ月間' : daysToPlan >= 60 ? '2ヶ月間' : '1ヶ月間'}の重要マイルストーン日にタスクを無理なく配分します。
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    追加の要望・フォーカスしたいこと (任意)
                  </label>
                  <input
                    type="text"
                    value={userGoalNote}
                    onChange={(e) => setUserGoalNote(e.target.value)}
                    placeholder="例: 月初・月終わりに重いタスクを集中させたい / 前半で基盤を固めたい"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {planError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                    <span>{planError}</span>
                    <button
                      onClick={handleGenerateExistingPlan}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700"
                    >
                      再試行
                    </button>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleGenerateExistingPlan}
                    disabled={isPlanning || pendingTasks.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
                  >
                    {isPlanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AIがスケジュールを最適化中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>日別計画を作成する</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated Plan Result */}
              {planResult && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Summary & Productivity Advice */}
                  <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>AI プランサマリー & アドバイス</span>
                    </div>
                    <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                      {planResult.planSummary}
                    </p>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 italic">
                      💡 {planResult.productivityAdvice}
                    </p>
                  </div>

                  {/* Day by Day Cards ("この日はこれやるこの日はこれやる") */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      📅 日別スケジュール割り当て計画
                    </h3>

                    <div className="grid grid-cols-1 gap-3">
                      {planResult.schedule.map((day) => {
                        const dayTasks = day.allocatedTaskIds
                          .map((tid) => tasks.find((t) => t.id === tid))
                          .filter(Boolean) as Task[];

                        return (
                          <div
                            key={day.date}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm space-y-2.5"
                          >
                            {/* Day Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-bold text-xs">
                                  {day.dayLabel || day.date}
                                </span>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  テーマ: {day.theme}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                約{Math.round(day.totalEstimatedMinutes / 60)}時間 (
                                {day.totalEstimatedMinutes}分)
                              </span>
                            </div>

                            {/* Why this day explanation */}
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg">
                              🎯 <strong>配分理由:</strong> {day.explanation}
                            </p>

                            {/* Allocated Task Chips */}
                            <div className="space-y-1.5">
                              {dayTasks.map((t) => {
                                const pConf = PRIORITY_CONFIG[t.priority];
                                return (
                                  <div
                                    key={t.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2 h-2 rounded-full ${pConf.dotColor}`} />
                                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {t.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${pConf.badgeBg}`}>
                                        {pConf.shortLabel}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {t.estimatedMinutes || 30}分
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Apply Schedule to Tasks & Calendar */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      適用すると、各タスクの期限日(dueDate)がこの計画通りに自動設定されます
                    </span>
                    <button
                      onClick={handleApplyToCalendar}
                      disabled={appliedSuccessfully}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                        appliedSuccessfully
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                      }`}
                    >
                      {appliedSuccessfully ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>カレンダーとタスクに適用完了！</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4" />
                          <span>この計画をカレンダーに一括適用する</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* MODE 2: Goal-to-Roadmap Generation */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    達成したい目標やプロジェクト名
                  </label>
                  <input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="例: 来週のプレゼン発表を成功させる / 1週間で新しいプロトタイプを作る"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      達成までの目標期間 (短期〜長期)
                    </label>
                    <select
                      value={goalDays}
                      onChange={(e) => setGoalDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value={3}>3日間 (短期スプリント)</option>
                      <option value={5}>5日間 (平日1週間)</option>
                      <option value={7}>1週間 (7日間ロードマップ)</option>
                      <option value={14}>2週間 (2週間スプリント)</option>
                      <option value={30}>1ヶ月 (30日間ロードマップ)</option>
                      <option value={60}>2ヶ月 (60日間中期計画)</option>
                      <option value={90}>3ヶ月 (四半期クォーター計画)</option>
                      <option value={180}>半年 (180日間長期ロードマップ)</option>
                    </select>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[
                        { label: '1週間', value: 7 },
                        { label: '2週間', value: 14 },
                        { label: '1ヶ月', value: 30 },
                        { label: '2ヶ月', value: 60 },
                        { label: '3ヶ月', value: 90 },
                        { label: '半年', value: 180 },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setGoalDays(p.value)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-colors ${
                            goalDays === p.value
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      メインカテゴリー
                    </label>
                    <select
                      value={goalCategory}
                      onChange={(e) => setGoalCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    {goalDays >= 30 && (
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2 bg-indigo-50 dark:bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        🎯 <strong>ロードマップ生成</strong>:
                        {goalDays >= 180 ? '半年間' : goalDays >= 90 ? '3ヶ月間' : goalDays >= 60 ? '2ヶ月間' : '1ヶ月間'}の期間全体を俯瞰し、段階的なマイルストーンタスクを作成します。
                      </p>
                    )}
                  </div>
                </div>

                {goalError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                    <span>{goalError}</span>
                    <button
                      onClick={handleGenerateGoalRoadmap}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700"
                    >
                      再試行
                    </button>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleGenerateGoalRoadmap}
                    disabled={isGeneratingGoal || !goalInput.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
                  >
                    {isGeneratingGoal ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>目標を分解してスケジュール作成中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>日別ロードマップを作成する</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Goal Breakdown Result */}
              {goalPlanResult && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
                    <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-100">
                      {goalPlanResult.title}
                    </h3>
                    <p className="text-xs text-indigo-900 dark:text-indigo-200 mt-1">
                      {goalPlanResult.overview}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      生成された日別タスク ({goalPlanResult.tasks.length}件)
                    </h4>

                    {goalPlanResult.tasks.map((gt, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                              {gt.dueDate}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {gt.title}
                            </span>
                          </div>
                          {gt.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{gt.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              PRIORITY_CONFIG[gt.priority]?.badgeBg
                            }`}
                          >
                            {PRIORITY_CONFIG[gt.priority]?.shortLabel}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {gt.estimatedMinutes || 30}分
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button
                      onClick={handleAddGoalTasksToList}
                      disabled={goalAddedSuccessfully}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                        goalAddedSuccessfully
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                      }`}
                    >
                      {goalAddedSuccessfully ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>タスク一覧に追加完了！</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>これらのタスクをリストに追加する</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
