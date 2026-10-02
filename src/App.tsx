import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Task,
  Category,
  TaskPriority,
  TaskStatus,
  SyncData,
  DEFAULT_CATEGORIES,
  NotificationSoundType,
  Habit,
  DEFAULT_HABITS,
} from './types';
import { Navbar, ActiveTab } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { BoardView } from './components/BoardView';
import { ListView } from './components/ListView';
import { CalendarView } from './components/CalendarView';
import { DashboardView } from './components/DashboardView';
import { HabitsView } from './components/HabitsView';
import { TaskModal } from './components/TaskModal';
import { ActiveAlertsBanner } from './components/ActiveAlertsBanner';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { SoundSettingsModal } from './components/SoundSettingsModal';
import { SyncModal } from './components/SyncModal';
import { AiPlannerModal } from './components/AiPlannerModal';
import { notificationService, ActiveAlert } from './services/notifications';
import { soundService } from './services/sound';
import { syncService, SyncStatus } from './services/sync';

// Initial seed tasks to provide an immediate intuitive experience
const INITIAL_TASKS: Task[] = [
  {
    id: 'task_1',
    title: '重要プレゼン資料の構成案作成',
    description: '来期プロジェクトの予算獲得に向けた提案スライド作成。要件の洗い出しとスケジュール策定。',
    priority: 'urgent',
    status: 'todo',
    category: 'work',
    tags: ['急ぎ', 'プレゼン', '企画'],
    dueDate: new Date().toISOString().split('T')[0], // Today
    dueTime: '17:00',
    estimatedMinutes: 60,
    order: 1,
    subtasks: [
      { id: 's1', title: '骨子アウトライン作成', completed: true },
      { id: 's2', title: '競合調査の数値反映', completed: false },
      { id: 's3', title: 'デザイン調整とPDF書き出し', completed: false },
    ],
    reminders: [
      {
        id: 'rem_1',
        datetime: new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16),
        label: '事前リマインダー',
      },
    ],
    soundType: 'bell',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'task_2',
    title: '週次定例チームミーティング準備',
    description: '進捗共有スプレッドシートのアップデートと各メンバーの課題集約。',
    priority: 'high',
    status: 'in_progress',
    category: 'work',
    tags: ['定例', 'チーム'],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    dueTime: '10:00',
    estimatedMinutes: 30,
    order: 2,
    subtasks: [
      { id: 's4', title: '課題点のアジェンダ化', completed: false },
    ],
    reminders: [],
    soundType: 'chime',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'task_3',
    title: '資格試験対策（模擬テスト第3回）',
    description: '制限時間90分で過去問演習を実施し、間違えた問題の解説ノートをまとめる。',
    priority: 'medium',
    status: 'todo',
    category: 'study',
    tags: ['勉強', '試験'],
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    dueTime: '20:00',
    estimatedMinutes: 90,
    order: 3,
    subtasks: [],
    reminders: [],
    soundType: 'marimba',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'task_4',
    title: 'ジョギング＆ストレッチ（5km）',
    description: '健康維持のための有酸素運動。',
    priority: 'low',
    status: 'done',
    category: 'health',
    tags: ['運動', '健康'],
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '08:00',
    estimatedMinutes: 45,
    order: 4,
    subtasks: [],
    reminders: [],
    soundType: 'pulse',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'task_5',
    title: '日用品の買い出し・補充',
    description: '洗剤、トイレットペーパー、常備薬などの買い出し。',
    priority: 'medium',
    status: 'todo',
    category: 'errands',
    tags: ['買い物'],
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    estimatedMinutes: 30,
    order: 5,
    subtasks: [],
    reminders: [],
    createdAt: new Date(Date.now() - 20000000).toISOString(),
  },
];

export default function App() {
  // Navigation & Theme states
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('taskflow_dark_mode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Sound & Notifications states
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundService.isEnabled());
  const [defaultSound, setDefaultSound] = useState<NotificationSoundType>(() => soundService.getDefaultSound());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    notificationService.getPermission()
  );
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

  // Cloud Sync states
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncCode, setSyncCode] = useState<string>(() => syncService.getSyncCode());
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(0);

  // App Data states (with multi-layer persistence & update survival)
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      // 1. Primary storage
      const saved = localStorage.getItem('taskflow_tasks_v2') || localStorage.getItem('taskflow_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const hasInited = localStorage.getItem('taskflow_user_data_initialized') === 'true';
          if (parsed.length > 0 || hasInited) {
            return parsed;
          }
        }
      }
      // 2. Local rolling backup
      const backup = localStorage.getItem('taskflow_tasks_backup');
      if (backup) {
        const parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          return parsedBackup;
        }
      }
    } catch (e) {
      console.warn('Failed to load local tasks:', e);
    }
    return INITIAL_TASKS;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('taskflow_categories_v2') || localStorage.getItem('taskflow_categories');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CATEGORIES;
  });

  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem('taskflow_habits_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load local habits:', e);
    }
    return DEFAULT_HABITS;
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'order' | 'title'>('order');

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskModalDefaultDate, setTaskModalDefaultDate] = useState<string | undefined>(undefined);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [isSoundModalOpen, setIsSoundModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAiPlannerModalOpen, setIsAiPlannerModalOpen] = useState(false);

  // Apply Dark Mode class to <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('taskflow_dark_mode', String(isDarkMode));
    } catch {}
  }, [isDarkMode]);

  // Persist tasks locally with backup snapshots
  useEffect(() => {
    try {
      localStorage.setItem('taskflow_tasks_v2', JSON.stringify(tasks));
      localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
      localStorage.setItem('taskflow_user_data_initialized', 'true');
      if (tasks.length > 0) {
        localStorage.setItem('taskflow_tasks_backup', JSON.stringify(tasks));
      }
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('taskflow_categories_v2', JSON.stringify(categories));
      localStorage.setItem('taskflow_categories', JSON.stringify(categories));
    } catch {}
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem('taskflow_habits_v1', JSON.stringify(habits));
    } catch {}
  }, [habits]);

  // Server master & Cloud Sync on Task / Category / Habit changes (debounced push)
  useEffect(() => {
    const availableTags = Array.from(new Set(tasks.flatMap((t) => t.tags || [])));
    const syncPayload: SyncData = {
      tasks,
      categories,
      availableTags,
      habits,
      version: Date.now(),
    };
    syncService.schedulePush(syncPayload, (status) => {
      setSyncStatus(status);
      setLastSyncedTime(syncService.getLastSynced());
    });
  }, [tasks, categories, habits]);

  // Pull initial cloud/master persistent state on mount (protect against app update / storage clears)
  useEffect(() => {
    syncService.pullMasterOrRoomData().then((serverData) => {
      if (serverData && Array.isArray(serverData.tasks)) {
        const hasLocalInited = localStorage.getItem('taskflow_user_data_initialized') === 'true';
        // If local was never customized or server has valid data, load server data
        if (!hasLocalInited || serverData.tasks.length > 0) {
          setTasks(serverData.tasks);
          if (serverData.categories && serverData.categories.length > 0) {
            setCategories(serverData.categories);
          }
          if (Array.isArray(serverData.habits) && serverData.habits.length > 0) {
            setHabits(serverData.habits);
          }
          setSyncStatus('synced');
          setLastSyncedTime(syncService.getLastSynced());
        }
      }
    });
  }, []);

  // Periodic Deadline & Reminder Checker (every 10 seconds)
  useEffect(() => {
    const checkAlerts = () => {
      const detected = notificationService.checkActiveAlerts(tasks);
      // Filter out dismissed alerts
      const filtered = detected.filter((a) => !dismissedAlertIds.has(a.id));
      setActiveAlerts(filtered);
      notificationService.notifyNewlyTriggered(filtered);
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);
  }, [tasks, dismissedAlertIds]);

  // Available tags computed from tasks
  const availableTags = useMemo(() => {
    return Array.from(new Set(tasks.flatMap((t) => t.tags || []))).filter(Boolean);
  }, [tasks]);

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q) || false;
          const matchTag = t.tags.some((tag) => tag.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchTag) return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && t.category !== selectedCategory) {
          return false;
        }

        // Priority filter
        if (selectedPriority !== 'all' && t.priority !== selectedPriority) {
          return false;
        }

        // Tag filter
        if (selectedTag !== 'all' && !t.tags.includes(selectedTag)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const priorityScore = { urgent: 1, high: 2, medium: 3, low: 4 };
          return priorityScore[a.priority] - priorityScore[b.priority];
        }
        if (sortBy === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title, 'ja');
        }
        return (a.order || 0) - (b.order || 0);
      });
  }, [tasks, searchQuery, selectedCategory, selectedPriority, selectedTag, sortBy]);

  // Task Mutations
  const handleSaveTask = (
    taskData: Omit<Task, 'id' | 'createdAt' | 'order'> & { id?: string }
  ) => {
    if (taskData.id) {
      // Edit
      setTasks(
        tasks.map((t) =>
          t.id === taskData.id
            ? {
                ...t,
                ...taskData,
                completedAt:
                  taskData.status === 'done'
                    ? t.completedAt || new Date().toISOString()
                    : undefined,
              }
            : t
        )
      );
    } else {
      // Create new
      const newTask: Task = {
        ...taskData,
        id: 'task_' + Math.random().toString(36).substring(2, 9),
        order: tasks.length + 1,
        createdAt: new Date().toISOString(),
      };
      setTasks([newTask, ...tasks]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  const handleToggleTaskStatus = (taskId: string) => {
    setTasks(
      tasks.map((t) => {
        if (t.id === taskId) {
          const nextStatus: TaskStatus = t.status === 'done' ? 'todo' : 'done';
          return {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleMoveTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
            }
          : t
      )
    );
  };

  const handleReorderTasks = (draggedTaskId: string, targetTaskId: string) => {
    const list = [...tasks];
    const fromIndex = list.findIndex((t) => t.id === draggedTaskId);
    const toIndex = list.findIndex((t) => t.id === targetTaskId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [removed] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, removed);
      // Reassign order indices
      const updated = list.map((t, idx) => ({ ...t, order: idx + 1 }));
      setTasks(updated);
    }
  };

  const handleUpdateTaskDate = (taskId: string, newDateStr: string) => {
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, dueDate: newDateStr } : t))
    );
  };

  // Snooze handlers
  const handleSnooze = (alert: ActiveAlert, minutes: number) => {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    if (alert.reminder) {
      setTasks(
        tasks.map((t) =>
          t.id === alert.task.id
            ? {
                ...t,
                reminders: t.reminders.map((r) =>
                  r.id === alert.reminder!.id ? { ...r, snoozedUntil: snoozeUntil } : r
                ),
              }
            : t
        )
      );
    }

    // Dismiss active visual alert for now
    setDismissedAlertIds((prev) => new Set([...prev, alert.id]));
  };

  const handleSnoozeUntilTomorrow = (alert: ActiveAlert) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const snoozeUntil = tomorrow.toISOString();

    if (alert.reminder) {
      setTasks(
        tasks.map((t) =>
          t.id === alert.task.id
            ? {
                ...t,
                reminders: t.reminders.map((r) =>
                  r.id === alert.reminder!.id ? { ...r, snoozedUntil: snoozeUntil } : r
                ),
              }
            : t
        )
      );
    }
    setDismissedAlertIds((prev) => new Set([...prev, alert.id]));
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds((prev) => new Set([...prev, alertId]));
  };

  // AI Planner callbacks
  const handleApplyAiSchedule = (
    updates: { taskId: string; newDueDate: string; newOrder?: number }[]
  ) => {
    const updateMap = new Map(updates.map((u) => [u.taskId, u]));
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        const u = updateMap.get(t.id);
        if (u) {
          return {
            ...t,
            dueDate: u.newDueDate,
            order: u.newOrder !== undefined ? u.newOrder : t.order,
          };
        }
        return t;
      })
    );
    // Switch to calendar view so user immediately sees the day-by-day plan applied!
    setActiveTab('calendar');
  };

  const handleAddAiGeneratedTasks = (
    newTasks: Array<Omit<Task, 'id' | 'createdAt' | 'order'>>
  ) => {
    setTasks((prevTasks) => {
      const formatted: Task[] = newTasks.map((nt, idx) => ({
        ...nt,
        id: 'task_ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + idx,
        order: prevTasks.length + idx + 1,
        createdAt: new Date().toISOString(),
      }));
      return [...formatted, ...prevTasks];
    });
    // Switch to board or calendar so user immediately sees the new roadmap tasks!
    setActiveTab('board');
  };

  // Sound callbacks
  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundService.setEnabled(next);
    setSoundEnabled(next);
  };

  const handleSetDefaultSound = (sound: NotificationSoundType) => {
    soundService.setDefaultSound(sound);
    setDefaultSound(sound);
  };

  // Sync callbacks
  const handleForceSync = async () => {
    setSyncStatus('syncing');
    const availableTags = Array.from(new Set(tasks.flatMap((t) => t.tags || [])));
    const success = await syncService.pushData({
      tasks,
      categories,
      availableTags,
      version: Date.now(),
    });
    setSyncStatus(success ? 'synced' : 'offline');
    setLastSyncedTime(syncService.getLastSynced());
  };

  const handleUpdateSyncCode = (newCode: string) => {
    syncService.setSyncCode(newCode);
    setSyncCode(newCode);
    // Pull from new code
    syncService.pullData().then((data) => {
      if (data && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        if (data.categories) setCategories(data.categories);
      }
    });
  };

  const handleExportBackup = () => {
    const data: SyncData = {
      tasks,
      categories,
      availableTags,
      habits,
      version: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (imported: SyncData) => {
    if (Array.isArray(imported.tasks)) {
      setTasks(imported.tasks);
    }
    if (Array.isArray(imported.categories)) {
      setCategories(imported.categories);
    }
    if (Array.isArray(imported.habits)) {
      setHabits(imported.habits);
    }
  };

  const handleRestoreServerBackup = async () => {
    const backupData = await syncService.restoreServerBackup();
    if (backupData && Array.isArray(backupData.tasks)) {
      setTasks(backupData.tasks);
      if (backupData.categories) setCategories(backupData.categories);
      if (Array.isArray(backupData.habits)) setHabits(backupData.habits);
      setSyncStatus('synced');
      setLastSyncedTime(syncService.getLastSynced());
      return true;
    }
    return false;
  };

  // Habits Operations
  const handleToggleHabitDate = (habitId: string, dateStr: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const exists = (h.completedDates || []).includes(dateStr);
        const nextDates = exists
          ? h.completedDates.filter((d) => d !== dateStr)
          : [...(h.completedDates || []), dateStr];

        if (!exists && soundEnabled) {
          soundService.playSound(defaultSound);
        }
        return {
          ...h,
          completedDates: nextDates,
        };
      })
    );
  };

  const handleAddHabit = (
    newHabitData: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>
  ) => {
    const newHabit: Habit = {
      ...newHabitData,
      id: 'habit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [newHabit, ...prev]);
  };

  const handleUpdateHabit = (habitId: string, updates: Partial<Habit>) => {
    setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, ...updates } : h)));
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
  };

  const handleConvertHabitToTask = (habit: Habit, dateStr: string) => {
    const newTask: Task = {
      id: 'task_from_habit_' + Date.now(),
      title: `【習慣】${habit.title}`,
      description: habit.description || `毎日の習慣（${habit.targetCount || 1}${habit.unit || '回'}）の達成`,
      priority: 'high',
      status: 'todo',
      category: habit.category || 'personal',
      tags: ['習慣', habit.unit || 'デイリー'],
      dueDate: dateStr,
      estimatedMinutes: habit.unit === '分' ? habit.targetCount : 30,
      order: tasks.length + 1,
      subtasks: [],
      reminders: [],
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTask={() => {
          setEditingTask(null);
          setTaskModalDefaultDate(undefined);
          setIsTaskModalOpen(true);
        }}
        onOpenSync={() => setIsSyncModalOpen(true)}
        onOpenSounds={() => setIsSoundModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
        syncStatus={syncStatus}
        syncCode={syncCode}
        alertsCount={activeAlerts.length}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
        {/* Active Reminders & Deadline Banner with Snooze Options */}
        <ActiveAlertsBanner
          alerts={activeAlerts}
          onSnooze={handleSnooze}
          onSnoozeUntilTomorrow={handleSnoozeUntilTomorrow}
          onCompleteTask={handleToggleTaskStatus}
          onDismiss={handleDismissAlert}
          onRequestPermission={() =>
            notificationService.requestPermission().then((p) => setNotificationPermission(p))
          }
          notificationPermission={notificationPermission}
        />

        {/* Filters & Category Tags Bar (shown on Board, List, and Calendar views) */}
        {activeTab !== 'dashboard' && activeTab !== 'habits' && activeTab !== 'planner' && (
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            categories={categories}
            availableTags={availableTags}
            totalTasksCount={filteredTasks.length}
          />
        )}

        {/* Tab Views */}
        {activeTab === 'board' && (
          <BoardView
            tasks={filteredTasks}
            categories={categories}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onToggleStatus={handleToggleTaskStatus}
            onMoveTaskStatus={handleMoveTaskStatus}
            onReorderTasks={handleReorderTasks}
            onOpenNewTaskWithDefaults={({ status, priority }) => {
              setEditingTask(null);
              setIsTaskModalOpen(true);
            }}
          />
        )}

        {activeTab === 'list' && (
          <ListView
            tasks={filteredTasks}
            categories={categories}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onToggleStatus={handleToggleTaskStatus}
            onReorderTasks={handleReorderTasks}
            onOpenNewTask={() => {
              setEditingTask(null);
              setIsTaskModalOpen(true);
            }}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            tasks={filteredTasks}
            categories={categories}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onOpenNewTaskForDate={(dateStr) => {
              setEditingTask(null);
              setTaskModalDefaultDate(dateStr);
              setIsTaskModalOpen(true);
            }}
            onUpdateTaskDate={handleUpdateTaskDate}
            onToggleStatus={handleToggleTaskStatus}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView tasks={tasks} categories={categories} />
        )}

        {activeTab === 'habits' && (
          <HabitsView
            habits={habits}
            categories={categories}
            onToggleHabitDate={handleToggleHabitDate}
            onAddHabit={handleAddHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
            onConvertHabitToTask={handleConvertHabitToTask}
          />
        )}

        {activeTab === 'planner' && (
          <div className="py-2">
            <button
              onClick={() => setIsAiPlannerModalOpen(true)}
              className="w-full p-8 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-center hover:bg-indigo-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
                <span className="text-xl">✨</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                AI日別計画プランナーを開く
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                「この日はこれやる、この日はこれやる」とタスクを自動配分したり、目標から日別スケジュールを作成します。
              </p>
            </button>
          </div>
        )}
      </main>

      {/* Task Edit/Create Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        categories={categories}
        availableTags={availableTags}
        defaultDate={taskModalDefaultDate}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsDrawerOpen}
        onClose={() => setIsNotificationsDrawerOpen(false)}
        alerts={activeAlerts}
        allTasks={tasks}
        onSnooze={handleSnooze}
        onSnoozeUntilTomorrow={handleSnoozeUntilTomorrow}
        onCompleteTask={handleToggleTaskStatus}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Sound Settings Modal */}
      <SoundSettingsModal
        isOpen={isSoundModalOpen}
        onClose={() => setIsSoundModalOpen(false)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        defaultSound={defaultSound}
        onSetDefaultSound={handleSetDefaultSound}
      />

      {/* Sync Modal (PC & Smartphone) */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncCode={syncCode}
        onUpdateSyncCode={handleUpdateSyncCode}
        syncStatus={syncStatus}
        onForceSync={handleForceSync}
        shareUrl={syncService.getShareUrl()}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onRestoreServerBackup={handleRestoreServerBackup}
        lastSyncedTime={lastSyncedTime}
      />

      {/* AI Planner Modal */}
      <AiPlannerModal
        isOpen={isAiPlannerModalOpen || activeTab === 'planner'}
        onClose={() => {
          setIsAiPlannerModalOpen(false);
          if (activeTab === 'planner') setActiveTab('board');
        }}
        tasks={tasks}
        categories={categories}
        onApplySchedule={handleApplyAiSchedule}
        onAddGeneratedTasks={handleAddAiGeneratedTasks}
      />
    </div>
  );
}
