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
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  Task,
  Category,
  AIPlanResult,
  AIGeneratedGoalPlan,
  PlanChatMessage,
  PRIORITY_CONFIG,
  TaskPriority,
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

  // Chat Refine state for Mode 1
  const [existingChatHistory, setExistingChatHistory] = useState<PlanChatMessage[]>([]);
  const [existingChatInput, setExistingChatInput] = useState('');
  const [isRefiningExisting, setIsRefiningExisting] = useState(false);

  // Mode 2: Goal breakdown state
  const [goalInput, setGoalInput] = useState('');
  const [goalDays, setGoalDays] = useState<number>(90);
  const [goalCategory, setGoalCategory] = useState(categories[0]?.id || 'work');
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [goalPlanResult, setGoalPlanResult] = useState<AIGeneratedGoalPlan | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalAddedSuccessfully, setGoalAddedSuccessfully] = useState(false);

  // Chat Refine state for Mode 2
  const [goalChatHistory, setGoalChatHistory] = useState<PlanChatMessage[]>([]);
  const [goalChatInput, setGoalChatInput] = useState('');
  const [isRefiningGoal, setIsRefiningGoal] = useState(false);

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
      setExistingChatHistory([
        {
          id: 'init_' + Date.now(),
          role: 'assistant',
          content: '日別スケジュールを作成しました！「土日に集中させたい」「平日の負担を軽くして」「〇〇をもっと前倒しして」など、ご要望を送信すると自動で計画を再調整します。',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setPlanError(err.message || 'AI計画の生成中にエラーが発生しました。再試行してください。');
    } finally {
      setIsPlanning(false);
    }
  };

  // Refine existing plan via interactive chat
  const handleRefineExisting = async (overridePrompt?: string) => {
    const text = (overridePrompt || existingChatInput).trim();
    if (!text || isRefiningExisting || !planResult) return;

    const userMsg: PlanChatMessage = {
      id: 'msg_u_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setExistingChatHistory((prev) => [...prev, userMsg]);
    setExistingChatInput('');
    setIsRefiningExisting(true);

    try {
      const res = await fetch('/api/ai/refine-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: 'schedule',
          currentPlan: planResult,
          userMessage: text,
          history: existingChatHistory.map((m) => ({ role: m.role, content: m.content })),
          allTasks: tasks,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'ブラッシュアップに失敗しました');
      }

      const data = await res.json();
      if (data.updatedPlan) {
        setPlanResult(data.updatedPlan);
      }
      const aiMsg: PlanChatMessage = {
        id: 'msg_ai_' + Date.now(),
        role: 'assistant',
        content: data.replyMessage || 'ご要望を反映してスケジュールを更新しました！',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setExistingChatHistory((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Refine existing error:', err);
      const errAiMsg: PlanChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `⚠️ ${err.message || '調整中にエラーが発生しました。もう一度お試しください。'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setExistingChatHistory((prev) => [...prev, errAiMsg]);
    } finally {
      setIsRefiningExisting(false);
    }
  };

  // Apply the generated day schedule to the actual tasks
  const handleApplyToCalendar = () => {
    if (!planResult) return;

    const updates: { taskId: string; newDueDate: string; newOrder?: number }[] = [];
    let currentOrder = 1;

    planResult.schedule.forEach((day) => {
      day.allocatedTaskIds.forEach((taskId) => {
        const actualTask =
          tasks.find((t) => t.id === taskId) ||
          tasks.find((t) => t.title.trim() === String(taskId).trim()) ||
          tasks.find((t) => taskId.includes(t.id) || t.id.includes(taskId)) ||
          tasks.find((t) => t.title.includes(String(taskId)) || String(taskId).includes(t.title));

        if (actualTask) {
          updates.push({
            taskId: actualTask.id,
            newDueDate: day.date,
            newOrder: currentOrder++,
          });
        }
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
          days: Number(goalDays) || 30,
          category: goalCategory || 'work',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'ロードマップの生成に失敗しました');
      }

      const data: AIGeneratedGoalPlan = await res.json();
      if (!data || !Array.isArray(data.tasks) || data.tasks.length === 0) {
        throw new Error('タスクデータの取得に失敗しました。もう一度お試しください。');
      }
      setGoalPlanResult(data);
      setGoalChatHistory([
        {
          id: 'init_goal_' + Date.now(),
          role: 'assistant',
          content: '目標ロードマップを作成しました！「科目の配分を調整して」「土日に演習を寄せて」「模擬試験の回数を増やして」など、気になる点を伝えて何度でもブラッシュアップできます。',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('Goal roadmap error:', err);
      let errMsg = err.message || 'ロードマップの生成中にエラーが発生しました。再試行してください。';
      if (
        errMsg.includes('Load failed') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError')
      ) {
        errMsg = '通信エラーが発生しました。ネットワーク接続を確認し、もう一度お試しください。';
      }
      setGoalError(errMsg);
    } finally {
      setIsGeneratingGoal(false);
    }
  };

  // Refine goal roadmap via interactive chat
  const handleRefineGoal = async (overridePrompt?: string) => {
    const text = (overridePrompt || goalChatInput).trim();
    if (!text || isRefiningGoal || !goalPlanResult) return;

    const userMsg: PlanChatMessage = {
      id: 'msg_u_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setGoalChatHistory((prev) => [...prev, userMsg]);
    setGoalChatInput('');
    setIsRefiningGoal(true);

    try {
      const res = await fetch('/api/ai/refine-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: 'goal',
          currentPlan: goalPlanResult,
          userMessage: text,
          history: goalChatHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'ブラッシュアップに失敗しました');
      }

      const data = await res.json();
      if (data.updatedPlan) {
        setGoalPlanResult(data.updatedPlan);
      }
      const aiMsg: PlanChatMessage = {
        id: 'msg_ai_' + Date.now(),
        role: 'assistant',
        content: data.replyMessage || 'ご要望を反映してロードマップを更新しました！',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setGoalChatHistory((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Refine goal error:', err);
      const errAiMsg: PlanChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `⚠️ ${err.message || '調整中にエラーが発生しました。もう一度お試しください。'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setGoalChatHistory((prev) => [...prev, errAiMsg]);
    } finally {
      setIsRefiningGoal(false);
    }
  };

  // Add goal tasks to task list
  const handleAddGoalTasksToList = () => {
    if (!goalPlanResult || !Array.isArray(goalPlanResult.tasks)) return;

    const validPriorities = ['urgent', 'high', 'medium', 'low'];
    const formattedTasks = goalPlanResult.tasks.map((gt) => {
      const priority = validPriorities.includes(gt.priority) ? (gt.priority as TaskPriority) : 'medium';
      return {
        title: gt.title || '無題のタスク',
        description: gt.description || '',
        priority,
        status: 'todo' as const,
        category: gt.category || goalCategory || 'work',
        tags: Array.isArray(gt.tags) && gt.tags.length > 0 ? gt.tags : ['AI計画'],
        dueDate: gt.dueDate || new Date().toISOString().split('T')[0],
        estimatedMinutes: Number(gt.estimatedMinutes) || 30,
        subtasks: Array.isArray(gt.subtasks)
          ? gt.subtasks.map((st) => ({
              id: 'sub_' + Math.random().toString(36).substring(2, 9),
              title: st?.title || '',
              completed: false,
            }))
          : [],
        reminders: [],
      };
    });

    onAddGeneratedTasks(formattedTasks);
    setGoalAddedSuccessfully(true);
    setTimeout(() => {
      onClose();
    }, 1200);
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
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-6 pt-2 bg-slate-50/50 dark:bg-slate-850 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveMode('existing')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeMode === 'existing'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">未完了タスクを日別に自動配分 ({pendingTasks.length}件)</span>
            <span className="sm:hidden text-center truncate">タスク配分 ({pendingTasks.length})</span>
          </button>
          <button
            onClick={() => setActiveMode('goal')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeMode === 'goal'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Target className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">新しい目標から日別ロードマップ作成</span>
            <span className="sm:hidden text-center truncate">目標ロードマップ</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 max-h-[72vh] overflow-y-auto space-y-5 sm:space-y-6">
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

                {pendingTasks.length === 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span>💡 未完了タスクが現在ありません。上の「目標ロードマップ作成」タブから新しい目標を入力してスケジュールを作成してください。</span>
                    <button
                      type="button"
                      onClick={() => setActiveMode('goal')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap self-start sm:self-auto"
                    >
                      目標ロードマップへ切替
                    </button>
                  </div>
                )}

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
                          .map((tid) => {
                            return (
                              tasks.find((t) => t.id === tid) ||
                              tasks.find((t) => t.title.trim() === String(tid).trim()) ||
                              tasks.find((t) => tid.includes(t.id) || t.id.includes(tid)) ||
                              tasks.find((t) => t.title.includes(String(tid)) || String(tid).includes(t.title))
                            );
                          })
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
                              {dayTasks.length > 0 ? (
                                dayTasks.map((t) => {
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
                                })
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-slate-400 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
                                  割り当てタスク: {day.allocatedTaskIds.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Chat Refine for Schedule */}
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-gradient-to-b from-indigo-50/70 to-slate-50/50 dark:from-indigo-950/40 dark:to-slate-900/60 p-3.5 sm:p-4 space-y-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                          <span>AIと対話してスケジュールをブラッシュアップ</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300 font-semibold">
                            対話調整可能
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          「土日に集中させたい」「平日の負担を軽くして」「重要タスクを前倒し」など自由に指示できます
                        </p>
                      </div>
                    </div>

                    {/* Quick suggestion chips */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> ワンタップで指示:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          '土日に重いタスクを寄せて平日の負担を軽減して',
                          '1日あたりの作業時間を均等に分散させて',
                          '最優先・緊急のタスクをもっと前倒しして',
                          '週の終わりに予備日・調整バッファを設けて',
                        ].map((chip, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            disabled={isRefiningExisting}
                            onClick={() => handleRefineExisting(chip)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors font-medium disabled:opacity-50 text-left"
                          >
                            💬 {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Chat stream */}
                    {existingChatHistory.length > 0 && (
                      <div className="max-h-56 overflow-y-auto space-y-2 p-3 rounded-xl bg-white/90 dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800">
                        {existingChatHistory.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex gap-2 ${
                              msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {msg.role === 'assistant' && (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-amber-300" />
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white rounded-br-xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 rounded-bl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              <span
                                className={`block text-[9px] mt-1 ${
                                  msg.role === 'user'
                                    ? 'text-indigo-200 text-right'
                                    : 'text-slate-400'
                                }`}
                              >
                                {msg.timestamp}
                              </span>
                            </div>
                          </div>
                        ))}

                        {isRefiningExisting && (
                          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 py-1">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="font-medium animate-pulse">
                              AIがスケジュールを再調整中...
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chat Input */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRefineExisting();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={existingChatInput}
                        onChange={(e) => setExistingChatInput(e.target.value)}
                        placeholder="例: 平日の負担を軽くして土日に寄せて / プレゼン資料をもっと前倒しして"
                        disabled={isRefiningExisting}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!existingChatInput.trim() || isRefiningExisting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm shadow-indigo-600/20"
                      >
                        {isRefiningExisting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>送信</span>
                      </button>
                    </form>
                  </div>

                  {/* Apply Schedule to Tasks & Calendar */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      適用すると、各タスクの期限日(dueDate)がこの計画通りに自動設定されます
                    </span>
                    <button
                      onClick={handleApplyToCalendar}
                      disabled={appliedSuccessfully}
                      className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGenerateGoalRoadmap();
                }}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      達成したい目標やプロジェクト名
                    </label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      複数科目の均等配分にも対応
                    </span>
                  </div>
                  <input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGenerateGoalRoadmap();
                      }
                    }}
                    placeholder="例: 社会科の勉強　日本史、世界史、地理、公民を均等に学習できる / TOEIC 800点突破"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />

                  {/* Quick Goal Examples */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-amber-500" /> おすすめ例:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalInput('社会科の勉強　日本史、世界史、地理、公民を均等に学習できる');
                        setGoalCategory(categories.find(c => c.id === 'study')?.id || 'study');
                        setGoalDays(90);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors font-medium flex items-center gap-1"
                    >
                      <span>📚 社会科（日本史・世界史・地理・公民を均等学習）</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalInput('TOEIC 800点突破・英語学習ロードマップ');
                        setGoalCategory(categories.find(c => c.id === 'study')?.id || 'study');
                        setGoalDays(60);
                      }}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      🎯 TOEIC 800点突破
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalInput('Webプログラミング基礎からアプリ完成');
                        setGoalCategory(categories.find(c => c.id === 'work')?.id || 'work');
                        setGoalDays(30);
                      }}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      💻 Webアプリ開発
                    </button>
                  </div>
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
                      type="button"
                      onClick={handleGenerateGoalRoadmap}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700"
                    >
                      再試行
                    </button>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
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
              </form>

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

                  {/* Subject Balance Analysis (if social studies / multi-subject goal) */}
                  {(() => {
                    const subjects = [
                      { name: '日本史', color: 'bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800/70', dot: 'bg-orange-500' },
                      { name: '世界史', color: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/70', dot: 'bg-blue-500' },
                      { name: '地理', color: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70', dot: 'bg-emerald-500' },
                      { name: '公民', color: 'bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/70', dot: 'bg-purple-500' },
                    ];
                    const detected = subjects
                      .map((s) => ({
                        ...s,
                        count: (goalPlanResult.tasks || []).filter(
                          (t) => (t?.title || '').includes(s.name) || (Array.isArray(t?.tags) && t.tags.includes(s.name))
                        ).length,
                      }))
                      .filter((s) => s.count > 0);

                    if (detected.length >= 2) {
                      return (
                        <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <span>⚖️ 科目均等バランス学習分析</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                                均等配分 100%
                              </span>
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              4科目を偏りなくローテーション学習できます
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {detected.map((s) => (
                              <div
                                key={s.name}
                                className={`p-2 rounded-lg border flex items-center justify-between ${s.color}`}
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                                  <span>{s.name}</span>
                                </div>
                                <span className="font-black text-xs font-mono">{s.count}回</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Interactive Chat Refine for Goal Roadmap */}
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-gradient-to-b from-indigo-50/70 to-slate-50/50 dark:from-indigo-950/40 dark:to-slate-900/60 p-3.5 sm:p-4 space-y-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                          <span>AIと対話してロードマップをブラッシュアップ</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300 font-semibold">
                            何度でも対話修正可能
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          「科目の配分を調整して」「週末に模試を追加して」「期間を短縮して」など自由にチャットで指示できます
                        </p>
                      </div>
                    </div>

                    {/* Quick suggestion chips */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> ワンタップで改善指示:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          '社会科4科目を完全均等にローテーションして',
                          '週末に模擬テスト・過去問演習タスクを追加して',
                          '前半の基礎固め期間をもっと長めにして',
                          '1タスクあたりの学習時間を短縮して',
                          '苦手分野の克服・復習タスクを差し込んで',
                          '期日を少し前倒しにして余裕を持たせて',
                        ].map((chip, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            disabled={isRefiningGoal}
                            onClick={() => handleRefineGoal(chip)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors font-medium disabled:opacity-50 text-left"
                          >
                            💬 {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Chat Messages Stream */}
                    {goalChatHistory.length > 0 && (
                      <div className="max-h-56 overflow-y-auto space-y-2 p-3 rounded-xl bg-white/90 dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800">
                        {goalChatHistory.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex gap-2 ${
                              msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {msg.role === 'assistant' && (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-amber-300" />
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white rounded-br-xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 rounded-bl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              <span
                                className={`block text-[9px] mt-1 ${
                                  msg.role === 'user'
                                    ? 'text-indigo-200 text-right'
                                    : 'text-slate-400'
                                }`}
                              >
                                {msg.timestamp}
                              </span>
                            </div>
                          </div>
                        ))}

                        {isRefiningGoal && (
                          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 py-1">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="font-medium animate-pulse">
                              AIがご要望を反映してロードマップを再構築中...
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chat Input */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRefineGoal();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={goalChatInput}
                        onChange={(e) => setGoalChatInput(e.target.value)}
                        placeholder="例: 世界史のタスクをもう少し増やして / 最終週に総復習タスクを追加して"
                        disabled={isRefiningGoal}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!goalChatInput.trim() || isRefiningGoal}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm shadow-indigo-600/20"
                      >
                        {isRefiningGoal ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>送信</span>
                      </button>
                    </form>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      生成された日別タスク ({goalPlanResult.tasks.length}件)
                    </h4>

                    {goalPlanResult.tasks.map((gt, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                              {gt.dueDate}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {gt.title}
                            </span>
                          </div>
                          {gt.description && (
                            <p className="text-[11px] text-slate-500 mt-1">{gt.description}</p>
                          )}
                          {gt.tags && gt.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {gt.tags.map((tg, tIdx) => {
                                const isSubj = ['日本史', '世界史', '地理', '公民'].includes(tg);
                                return (
                                  <span
                                    key={tIdx}
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                      isSubj
                                        ? tg === '日本史'
                                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                          : tg === '世界史'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                          : tg === '地理'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    #{tg}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              PRIORITY_CONFIG[gt.priority]?.badgeBg || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {PRIORITY_CONFIG[gt.priority]?.shortLabel || '通常'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {gt.estimatedMinutes || 30}分
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end">
                    <button
                      onClick={handleAddGoalTasksToList}
                      disabled={goalAddedSuccessfully}
                      className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 w-full sm:w-auto ${
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
