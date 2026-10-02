import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Clock,
  Trash2,
  Edit2,
  ArrowRight,
  BookOpen,
  Trophy,
  BarChart2,
  ListTodo,
  Check,
  X,
} from 'lucide-react';
import {
  Habit,
  HabitTimeOfDay,
  HabitFrequency,
  Category,
  HABIT_PRESETS,
  Task,
} from '../types';

interface HabitsViewProps {
  habits: Habit[];
  categories: Category[];
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onAddHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>) => void;
  onUpdateHabit: (habitId: string, updates: Partial<Habit>) => void;
  onDeleteHabit: (habitId: string) => void;
  onConvertHabitToTask: (habit: Habit, dateStr: string) => void;
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  categories,
  onToggleHabitDate,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onConvertHabitToTask,
}) => {
  // Selected date for viewing / checking habits (defaults to today)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<'all' | HabitTimeOfDay>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [addedAsTaskNotice, setAddedAsTaskNotice] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState(categories[0]?.id || 'study');
  const [formTimeOfDay, setFormTimeOfDay] = useState<HabitTimeOfDay>('morning');
  const [formFrequency, setFormFrequency] = useState<HabitFrequency>('daily');
  const [formTargetCount, setFormTargetCount] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('回');
  const [formColor, setFormColor] = useState('#8b5cf6');
  const [formIcon, setFormIcon] = useState('✨');

  // Date helpers
  const changeDateBy = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    const date = d.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    const isToday = dateStr === todayStr;
    const isYesterday =
      dateStr === new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const isTomorrow =
      dateStr === new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const label = isToday ? '今日' : isYesterday ? '昨日' : isTomorrow ? '明日' : '';
    return `${m}月${date}日(${dayOfWeek}) ${label ? `[${label}]` : ''}`;
  };

  // Compute Streak for a habit
  const calculateStreak = (habit: Habit): number => {
    if (!habit.completedDates || habit.completedDates.length === 0) return 0;
    const datesSet = new Set(habit.completedDates);
    let streak = 0;
    const current = new Date();

    // Check starting from today or yesterday
    let checkDate = new Date(current);
    let dateStr = checkDate.toISOString().split('T')[0];

    if (!datesSet.has(dateStr)) {
      // If not completed today yet, check if completed yesterday to maintain streak
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = checkDate.toISOString().split('T')[0];
      if (!datesSet.has(dateStr)) {
        return 0;
      }
    }

    while (datesSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = checkDate.toISOString().split('T')[0];
    }

    return streak;
  };

  // Compute best streak
  const calculateBestStreak = (habit: Habit): number => {
    if (!habit.completedDates || habit.completedDates.length === 0) return 0;
    const sorted = [...new Set(habit.completedDates)].sort();
    let max = 0;
    let current = 0;
    let prevTime: number | null = null;

    for (const dStr of sorted) {
      const time = new Date(dStr).getTime();
      if (prevTime === null) {
        current = 1;
      } else {
        const diffDays = Math.round((time - prevTime) / 86400000);
        if (diffDays === 1) {
          current++;
        } else if (diffDays > 1) {
          current = 1;
        }
      }
      prevTime = time;
      if (current > max) max = current;
    }
    return max;
  };

  // Filter habits
  const activeHabits = habits.filter((h) => !h.archived);
  const filteredHabits = activeHabits.filter((h) => {
    if (selectedTimeFilter !== 'all' && h.timeOfDay !== selectedTimeFilter) return false;
    if (selectedCategoryFilter !== 'all' && h.category !== selectedCategoryFilter) return false;
    return true;
  });

  // Today stats
  const completedTodayCount = activeHabits.filter((h) =>
    (h.completedDates || []).includes(selectedDate)
  ).length;
  const totalHabitsCount = activeHabits.length;
  const completionRate =
    totalHabitsCount > 0 ? Math.round((completedTodayCount / totalHabitsCount) * 100) : 0;

  // Maximum active streak
  const maxCurrentStreak = activeHabits.reduce(
    (max, h) => Math.max(max, calculateStreak(h)),
    0
  );

  // Total completions across all habits
  const totalCheckCount = activeHabits.reduce(
    (sum, h) => sum + (h.completedDates || []).length,
    0
  );

  // Form open helpers
  const handleOpenAddModal = (preset?: (typeof HABIT_PRESETS)[0]) => {
    setEditingHabit(null);
    if (preset) {
      setFormTitle(preset.title);
      setFormDescription(preset.description || '');
      setFormCategory(preset.category);
      setFormTimeOfDay(preset.timeOfDay);
      setFormFrequency(preset.frequency);
      setFormTargetCount(preset.targetCount);
      setFormUnit(preset.unit);
      setFormColor(preset.color);
      setFormIcon(preset.icon);
    } else {
      setFormTitle('');
      setFormDescription('');
      setFormCategory(categories[0]?.id || 'study');
      setFormTimeOfDay('morning');
      setFormFrequency('daily');
      setFormTargetCount(1);
      setFormUnit('回');
      setFormColor('#8b5cf6');
      setFormIcon('✨');
    }
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormTitle(habit.title);
    setFormDescription(habit.description || '');
    setFormCategory(habit.category);
    setFormTimeOfDay(habit.timeOfDay);
    setFormFrequency(habit.frequency);
    setFormTargetCount(habit.targetCount);
    setFormUnit(habit.unit);
    setFormColor(habit.color);
    setFormIcon(habit.icon || '✨');
    setIsAddModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingHabit) {
      onUpdateHabit(editingHabit.id, {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
        timeOfDay: formTimeOfDay,
        frequency: formFrequency,
        targetCount: Number(formTargetCount) || 1,
        unit: formUnit.trim() || '回',
        color: formColor,
        icon: formIcon,
      });
    } else {
      onAddHabit({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
        timeOfDay: formTimeOfDay,
        frequency: formFrequency,
        targetCount: Number(formTargetCount) || 1,
        unit: formUnit.trim() || '回',
        color: formColor,
        icon: formIcon,
      });
    }

    setIsAddModalOpen(false);
  };

  const handleConvertToTaskWithFeedback = (habit: Habit) => {
    onConvertHabitToTask(habit, selectedDate);
    setAddedAsTaskNotice(`「${habit.title}」を${formatDisplayDate(selectedDate)}のタスクに追加しました！`);
    setTimeout(() => {
      setAddedAsTaskNotice(null);
    }, 3000);
  };

  // Recent 7 days for mini matrix / history dots
  const recent7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (6 - i));
    const str = d.toISOString().split('T')[0];
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return { dateStr: str, label: `${d.getDate()}日(${dayOfWeek})`, short: dayOfWeek };
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Banner: Date Switcher & Key Metrics */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1 border border-slate-200 dark:border-slate-600">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 transition-colors"
              title="前日"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 text-xs sm:text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>{formatDisplayDate(selectedDate)}</span>
            </div>
            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 transition-colors"
              title="翌日"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              今日に戻る
            </button>
          )}
        </div>

        {/* Action Controls & Add Habit Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-semibold">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>リスト</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>週間継続表</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/30 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>習慣を追加</span>
          </button>
        </div>
      </div>

      {/* Progress & Stat Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Today's completion rate */}
        <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-white dark:from-slate-800 dark:via-indigo-950/30 dark:to-slate-900 rounded-2xl p-4 border border-indigo-100 dark:border-slate-700 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              今日の習慣達成度
            </span>
            <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">
              {completedTodayCount} / {totalHabitsCount} 完了
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {completionRate === 100 && totalHabitsCount > 0
              ? '🎉 完璧です！今日の習慣をすべて達成しました！'
              : completionRate >= 50
              ? '🔥 順調に進んでいます！この調子で続けましょう。'
              : '🌱 今日の第一歩を始めましょう！'}
          </p>
        </div>

        {/* Current streak */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-500">
              最長継続ストリーク
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {maxCurrentStreak}
              </span>
              <span className="text-xs font-bold text-slate-500">日連続</span>
            </div>
            <span className="text-[10px] text-slate-400">日々の小さな積み重ねが大きな力に</span>
          </div>
        </div>

        {/* Total checks */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-500">
              累計習慣達成回数
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {totalCheckCount}
              </span>
              <span className="text-xs font-bold text-slate-500">回クリア</span>
            </div>
            <span className="text-[10px] text-slate-400">登録中の習慣: {totalHabitsCount}件</span>
          </div>
        </div>
      </div>

      {/* Notice on converting habit to task */}
      {addedAsTaskNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{addedAsTaskNotice}</span>
        </div>
      )}

      {/* Filter Tabs by Time of Day */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 flex-nowrap text-xs font-semibold">
          {[
            { id: 'all', label: 'すべて', icon: Sparkles },
            { id: 'morning', label: '朝の習慣', icon: Sun },
            { id: 'afternoon', label: '昼・夕方', icon: Sunset },
            { id: 'evening', label: '夜・就寝前', icon: Moon },
            { id: 'anytime', label: 'いつでも', icon: Clock },
          ].map((item) => {
            const Icon = item.icon;
            const count =
              item.id === 'all'
                ? activeHabits.length
                : activeHabits.filter((h) => h.timeOfDay === item.id).length;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedTimeFilter(item.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors flex-shrink-0 ${
                  selectedTimeFilter === item.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedTimeFilter === item.id
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category filter */}
        <select
          value={selectedCategoryFilter}
          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="all">すべてのカテゴリ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Habit View Content */}
      {viewMode === 'list' ? (
        /* LIST VIEW */
        filteredHabits.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                登録されている習慣がまだありません
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                日々の小さな習慣を登録して、毎日の学習や生活のペースを維持しましょう。
              </p>
            </div>

            {/* Quick Presets Recommendation */}
            <div className="pt-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                ⚡ 人気習慣プリセットからワンタップで追加:
              </span>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {HABIT_PRESETS.slice(0, 4).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenAddModal(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-700/60 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-medium transition-colors"
                  >
                    <span>{p.icon}</span>
                    <span>{p.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHabits.map((habit) => {
              const isCompletedToday = (habit.completedDates || []).includes(selectedDate);
              const streak = calculateStreak(habit);
              const bestStreak = calculateBestStreak(habit);
              const category = categories.find((c) => c.id === habit.category);

              return (
                <div
                  key={habit.id}
                  className={`group bg-white dark:bg-slate-800 rounded-2xl p-4 border transition-all shadow-xs ${
                    isCompletedToday
                      ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    {/* Left: Check button & Details */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      {/* Interactive Checkbox */}
                      <button
                        onClick={() => onToggleHabitDate(habit.id, selectedDate)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 ${
                          isCompletedToday
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-600'
                        }`}
                        title={isCompletedToday ? '完了を取り消す' : '今日の習慣を達成済みにする'}
                      >
                        {isCompletedToday ? (
                          <Check className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base select-none">{habit.icon || '✨'}</span>
                          <h4
                            className={`text-sm font-bold truncate ${
                              isCompletedToday
                                ? 'text-emerald-900 dark:text-emerald-200 line-through opacity-85'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {habit.title}
                          </h4>

                          {/* Time of Day badge */}
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            {habit.timeOfDay === 'morning' && '☀️ 朝'}
                            {habit.timeOfDay === 'afternoon' && '⛅ 昼'}
                            {habit.timeOfDay === 'evening' && '🌙 夜'}
                            {habit.timeOfDay === 'anytime' && '⏱️ いつでも'}
                          </span>

                          {/* Target amount */}
                          {habit.targetCount && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                              目安: {habit.targetCount} {habit.unit}
                            </span>
                          )}

                          {/* Category */}
                          {category && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: `${category.color}15`,
                                color: category.color,
                              }}
                            >
                              {category.name}
                            </span>
                          )}
                        </div>

                        {habit.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                            {habit.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Streak & Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      {/* Streak badge */}
                      <div
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                          streak > 0
                            ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                        }`}
                        title={`現在 ${streak}日連続継続中 (最長: ${bestStreak}日)`}
                      >
                        <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'text-orange-500' : ''}`} />
                        <span>{streak}日</span>
                      </div>

                      {/* Convert to Today's Task (visible on all screens including smartphone) */}
                      <button
                        onClick={() => handleConvertToTaskWithFeedback(habit)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors font-semibold active:scale-95"
                        title="この習慣をToDoタスク一覧にも追加する"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>タスクに追加</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditModal(habit)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="習慣を編集"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => {
                          if (confirm(`習慣「${habit.title}」を削除しますか？`)) {
                            onDeleteHabit(habit.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="習慣を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 7-Day Mini Dots Matrix inside card */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-750 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-medium">直近7日間の継続:</span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {recent7Days.map((day) => {
                        const done = (habit.completedDates || []).includes(day.dateStr);
                        const isCurrent = day.dateStr === selectedDate;
                        return (
                          <button
                            key={day.dateStr}
                            onClick={() => onToggleHabitDate(habit.id, day.dateStr)}
                            className={`flex flex-col items-center gap-0.5 p-1 rounded-md transition-colors ${
                              isCurrent ? 'ring-1 ring-indigo-500' : ''
                            }`}
                            title={`${day.label}: ${done ? '達成済み' : '未達'} (クリックで切替)`}
                          >
                            <span className="text-[9px] text-slate-400">{day.short}</span>
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] transition-colors ${
                                done
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-transparent'
                              }`}
                            >
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* MATRIX VIEW (Weekly Habit Matrix) */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              <span>週間習慣マトリクス（過去7日間の達成状況）</span>
            </h3>
            <span className="text-xs text-slate-500">セルをクリックして完了切替可能</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="p-3 min-w-[160px]">習慣名</th>
                  <th className="p-3 text-center">ストリーク</th>
                  {recent7Days.map((d) => (
                    <th
                      key={d.dateStr}
                      className={`p-3 text-center min-w-[50px] ${
                        d.dateStr === selectedDate
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 font-bold'
                          : ''
                      }`}
                    >
                      <div>{d.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
                {filteredHabits.map((habit) => {
                  const streak = calculateStreak(habit);
                  return (
                    <tr key={habit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/50">
                      <td className="p-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{habit.icon || '✨'}</span>
                        <span className="truncate">{habit.title}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-orange-600 font-mono">
                        🔥 {streak}日
                      </td>
                      {recent7Days.map((d) => {
                        const done = (habit.completedDates || []).includes(d.dateStr);
                        const isCurrent = d.dateStr === selectedDate;
                        return (
                          <td
                            key={d.dateStr}
                            className={`p-2 text-center ${
                              isCurrent ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            <button
                              onClick={() => onToggleHabitDate(habit.id, d.dateStr)}
                              className={`w-7 h-7 rounded-lg mx-auto flex items-center justify-center font-bold transition-transform active:scale-90 ${
                                done
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {done ? '✓' : '・'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Popular Habits Preset Quick Carousel */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>人気の習慣プリセット（クリックですぐに習慣化）</span>
          </h4>
          <span className="text-[11px] text-slate-500">勉強・健康・生活改善</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {HABIT_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleOpenAddModal(p)}
              className="p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-left transition-all hover:border-indigo-300 flex items-center justify-between group shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl flex-shrink-0">{p.icon}</span>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    {p.title}
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {p.description}
                  </span>
                </div>
              </div>
              <Plus className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Add / Edit Habit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span>{editingHabit ? '習慣を編集' : '新しい習慣を追加'}</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Title & Icon */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  習慣のタイトル *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-12 text-center text-lg px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    title="絵文字アイコン"
                  />
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="例: 英単語 15分 / 朝のストレッチ / 読書"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  メモ・やる気の一言（任意）
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="例: スキマ時間で確実に語彙力を伸ばす"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Category & Time of Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    カテゴリー
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    実行する時間帯
                  </label>
                  <select
                    value={formTimeOfDay}
                    onChange={(e) => setFormTimeOfDay(e.target.value as HabitTimeOfDay)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="morning">☀️ 朝 (起床後・朝活)</option>
                    <option value="afternoon">⛅ 昼・夕方 (日中)</option>
                    <option value="evening">🌙 夜 (就寝前・夜活)</option>
                    <option value="anytime">⏱️ いつでも</option>
                  </select>
                </div>
              </div>

              {/* Target Count & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    目標数値
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formTargetCount}
                    onChange={(e) => setFormTargetCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    単位
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="回">回 (1回、2回...)</option>
                    <option value="分">分 (15分、30分...)</option>
                    <option value="問">問 (10問、20問...)</option>
                    <option value="ページ">ページ</option>
                    <option value="L">リットル (水など)</option>
                    <option value="km">km (ウォーキングなど)</option>
                  </select>
                </div>
              </div>

              {/* Quick Preset Pickers inside modal */}
              {!editingHabit && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-750">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                    プリセットから自動入力:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {HABIT_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormTitle(p.title);
                          setFormDescription(p.description || '');
                          setFormCategory(p.category);
                          setFormTimeOfDay(p.timeOfDay);
                          setFormTargetCount(p.targetCount);
                          setFormUnit(p.unit);
                          setFormIcon(p.icon);
                        }}
                        className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {p.icon} {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30"
                >
                  {editingHabit ? '保存する' : '習慣を追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
