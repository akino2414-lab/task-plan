import React from 'react';
import {
  CheckCircle2,
  TrendingUp,
  Flame,
  Clock,
  AlertTriangle,
  Award,
  Calendar,
  Layers,
} from 'lucide-react';
import { Task, Category, PRIORITY_CONFIG } from '../types';

interface DashboardViewProps {
  tasks: Task[];
  categories: Category[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tasks, categories }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Overdue count
  const now = new Date();
  const overdueCount = pendingTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(`${t.dueDate}T${t.dueTime || '23:59:59'}`);
    return due.getTime() < now.getTime();
  }).length;

  // Calculate 7-day completion activity
  const last7Days: { dateStr: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const count = completedTasks.filter((t) => {
      if (!t.completedAt) return false;
      return t.completedAt.startsWith(dateStr);
    }).length;
    last7Days.push({ dateStr, label: dayLabel, count });
  }

  const maxDailyCount = Math.max(...last7Days.map((d) => d.count), 4);

  // Priority breakdown
  const priorityCounts = {
    urgent: tasks.filter((t) => t.priority === 'urgent').length,
    high: tasks.filter((t) => t.priority === 'high').length,
    medium: tasks.filter((t) => t.priority === 'medium').length,
    low: tasks.filter((t) => t.priority === 'low').length,
  };

  // Category breakdown
  const categoryCounts = categories.map((cat) => {
    const count = tasks.filter((t) => t.category === cat.id).length;
    const completedCount = completedTasks.filter((t) => t.category === cat.id).length;
    return {
      cat,
      total: count,
      completed: completedCount,
      percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
    };
  });

  // Productivity Score Calculation (0-100)
  const productivityScore = Math.min(
    100,
    Math.round(
      completionRate * 0.7 +
        (completedTasks.length > 5 ? 20 : completedTasks.length * 4) -
        overdueCount * 5
    )
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Highlight Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1: Total Completion */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {completionRate}%
            </div>
            <div className="text-xs text-slate-500 font-medium">
              タスク完了率 ({completedTasks.length}/{totalTasks})
            </div>
          </div>
        </div>

        {/* Metric 2: Productivity Score */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {Math.max(0, productivityScore)}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              生産性スコア
            </div>
          </div>
        </div>

        {/* Metric 3: Active Streak */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center flex-shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {completedTasks.length > 0 ? '7' : '0'}
              <span className="text-xs font-normal text-slate-400"> 日</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              連続達成ストリーク
            </div>
          </div>
        </div>

        {/* Metric 4: Overdue Warning */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              overdueCount > 0
                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 animate-pulse'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {overdueCount > 0 ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div>
            <div
              className={`text-2xl font-black ${
                overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {overdueCount}
              <span className="text-xs font-normal text-slate-400"> 件</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {overdueCount > 0 ? '期限超過アラート' : '期限遅延なし'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Completion Histogram Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span>過去7日間のタスク達成実績</span>
              </h3>
              <p className="text-xs text-slate-500">日別の完了タスク数推移グラフ</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              合計 {last7Days.reduce((acc, cur) => acc + cur.count, 0)} 件完了
            </span>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-48 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800">
            {last7Days.map((day) => {
              const heightPercent = Math.max(8, Math.round((day.count / maxDailyCount) * 100));

              return (
                <div
                  key={day.dateStr}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.count}
                  </span>
                  <div className="w-full max-w-[42px] bg-slate-100 dark:bg-slate-800 rounded-t-xl overflow-hidden flex flex-col justify-end h-full">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300 rounded-t-xl transition-all duration-500 hover:brightness-110"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 truncate">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Breakdown Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>優先順位別の構成比</span>
          </h3>

          <div className="space-y-3">
            {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
              const conf = PRIORITY_CONFIG[p];
              const count = priorityCounts[p];
              const percent = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;

              return (
                <div key={p} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                      <span className={`w-2 h-2 rounded-full ${conf.dotColor}`} />
                      {conf.label}
                    </span>
                    <span className="font-mono text-slate-500">
                      {count}件 ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${conf.dotColor} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Allocation Breakdown */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          カテゴリー別の進捗状況
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categoryCounts.map((item) => {
            const catRate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;

            return (
              <div
                key={item.cat.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.cat.color }}
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {item.cat.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {catRate}%
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${catRate}%`,
                      backgroundColor: item.cat.color,
                    }}
                  />
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>
                    完了: {item.completed} / {item.total}
                  </span>
                  <span>全タスクの{item.percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
