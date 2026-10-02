import React from 'react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Kanban,
  ListTodo,
  Sparkles,
  Plus,
  Bell,
  RefreshCw,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Flame,
} from 'lucide-react';
import { SyncStatus } from '../services/sync';

export type ActiveTab = 'board' | 'list' | 'calendar' | 'habits' | 'dashboard' | 'planner';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTask: () => void;
  onOpenSync: () => void;
  onOpenSounds: () => void;
  onOpenNotifications: () => void;
  syncStatus: SyncStatus;
  syncCode: string;
  alertsCount: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTask,
  onOpenSync,
  onOpenSounds,
  onOpenNotifications,
  syncStatus,
  syncCode,
  alertsCount,
  isDarkMode,
  onToggleDarkMode,
  soundEnabled,
  onToggleSound,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors w-full">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 dark:from-white dark:via-indigo-200 dark:to-slate-200 bg-clip-text text-transparent">
                  TaskFlow
                </span>
                <span className="hidden md:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  AI & 同期
                </span>
              </div>
              <p className="hidden lg:block text-[11px] text-slate-500 dark:text-slate-400">
                優先順位・日別計画・PCスマホ同期
              </p>
            </div>
          </div>

          {/* Navigation View Tabs */}
          <nav className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 sm:p-1 rounded-xl text-xs sm:text-sm font-medium overflow-x-auto scrollbar-none flex-1 min-w-0 max-w-fit mx-1 sm:mx-2 flex-nowrap scroll-smooth">
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === 'board'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="カンバンボード"
            >
              <Kanban className="w-4 h-4" />
              <span>ボード</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === 'list'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="リスト表示"
            >
              <ListTodo className="w-4 h-4" />
              <span>リスト</span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="カレンダー表示"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>カレンダー</span>
            </button>
            <button
              onClick={() => setActiveTab('habits')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === 'habits'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="毎日の習慣トラッカー"
            >
              <Flame className={`w-4 h-4 ${activeTab === 'habits' ? 'text-orange-500' : 'text-orange-400'}`} />
              <span>習慣</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="生産性グラフ"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>分析</span>
            </button>
            <button
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === 'planner'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
              }`}
              title="AIスケジュール計画立案"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>AI計画</span>
            </button>
          </nav>

          {/* Right Action Icons & Controls */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Quick Add Task Button */}
            <button
              onClick={onOpenNewTask}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-600/30 transition-transform active:scale-95"
              title="新しいタスクを作成"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">タスク追加</span>
            </button>

            {/* Data Protection & Sync Status Button */}
            <button
              onClick={onOpenSync}
              className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                syncStatus === 'syncing'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  : syncStatus === 'synced'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title={`データ保護・端末同期: ${syncCode} (常時二重保存中)`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
              />
              <span className="hidden lg:inline">
                {syncStatus === 'syncing' ? '保護保存中...' : syncStatus === 'synced' ? '保護済' : 'データ保護'}: {syncCode}
              </span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="リマインダー・期限通知"
            >
              <Bell className="w-4 h-4" />
              {alertsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {alertsCount > 9 ? '9+' : alertsCount}
                </span>
              )}
            </button>

            {/* Sound Selector / Toggle */}
            <button
              onClick={onOpenSounds}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="通知音・サウンド設定"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-indigo-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? 'ライトモードに切替' : 'ダークモードに切替'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
