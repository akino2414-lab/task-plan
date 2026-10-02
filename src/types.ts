export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type NotificationSoundType = 'chime' | 'bell' | 'marimba' | 'pulse' | 'fanfare' | 'mute';

export interface TaskReminder {
  id: string;
  datetime: string; // ISO string or YYYY-MM-DDTHH:mm
  label?: string; // e.g. "開始15分前", "前日確認", "カスタム"
  triggered?: boolean;
  snoozedUntil?: string; // ISO string if currently snoozed
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  tags: string[];
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  estimatedMinutes?: number;
  order: number;
  subtasks: Subtask[];
  reminders: TaskReminder[];
  soundType?: NotificationSoundType;
  createdAt: string; // ISO string
  completedAt?: string; // ISO string
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  category: string;
  timeOfDay: HabitTimeOfDay;
  frequency: HabitFrequency;
  targetCount: number;
  unit: string;
  color: string;
  icon?: string;
  completedDates: string[]; // YYYY-MM-DD
  createdAt: string;
  archived?: boolean;
}

export interface SyncData {
  tasks: Task[];
  categories: Category[];
  availableTags: string[];
  habits?: Habit[];
  version: number;
}

export interface ScheduledDay {
  date: string;
  dayLabel: string;
  theme: string;
  allocatedTaskIds: string[];
  explanation: string;
  totalEstimatedMinutes: number;
}

export interface AIPlanResult {
  planSummary: string;
  schedule: ScheduledDay[];
  productivityAdvice: string;
}

export interface AIGeneratedGoalPlan {
  title: string;
  overview: string;
  tasks: Array<{
    title: string;
    description?: string;
    dueDate: string;
    priority: TaskPriority;
    category: string;
    tags?: string[];
    estimatedMinutes?: number;
    subtasks?: Array<{ title: string }>;
  }>;
}

export interface PlanChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const SOUND_OPTIONS: { id: NotificationSoundType; name: string; description: string }[] = [
  { id: 'chime', name: '🔔 チャイム (Chime)', description: '優しく透明感のある高音チャイム' },
  { id: 'bell', name: '⏰ ベル (Bell)', description: 'しっかりと気づかせるクリアなベル音' },
  { id: 'marimba', name: '🎵 マリンバ (Marimba)', description: '心地よいアコースティックな音色' },
  { id: 'pulse', name: '⚡ パルス (Pulse)', description: '未来的で短い電子アラート' },
  { id: 'fanfare', name: '🎺 ファンファーレ (Fanfare)', description: 'モチベーションを高める華やかなトーン' },
  { id: 'mute', name: '🔕 消音 (Mute)', description: '音を鳴らさず画面通知のみ' },
];

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    dotColor: string;
    order: number;
    description: string;
  }
> = {
  urgent: {
    label: '緊急・最優先',
    shortLabel: '緊急',
    badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    badgeText: 'text-rose-600 dark:text-rose-400',
    border: 'border-l-rose-500',
    dotColor: 'bg-rose-500',
    order: 1,
    description: '今すぐやるべき最重要タスク',
  },
  high: {
    label: '優先度：高',
    shortLabel: '高',
    badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    badgeText: 'text-amber-600 dark:text-amber-400',
    border: 'border-l-amber-500',
    dotColor: 'bg-amber-500',
    order: 2,
    description: '早めに対応が必要なタスク',
  },
  medium: {
    label: '優先度：中',
    shortLabel: '中',
    badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    badgeText: 'text-blue-600 dark:text-blue-400',
    border: 'border-l-blue-500',
    dotColor: 'bg-blue-500',
    order: 3,
    description: '通常ペースで進めるタスク',
  },
  low: {
    label: '優先度：低',
    shortLabel: '低',
    badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-l-emerald-500',
    dotColor: 'bg-emerald-500',
    order: 4,
    description: '余裕があるときにやるタスク',
  },
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: '仕事・業務', color: '#3b82f6', icon: 'Briefcase' },
  { id: 'personal', name: 'プライベート', color: '#10b981', icon: 'User' },
  { id: 'study', name: '学習・勉強', color: '#8b5cf6', icon: 'BookOpen' },
  { id: 'health', name: '健康・運動', color: '#ec4899', icon: 'Heart' },
  { id: 'errands', name: '買い物・用事', color: '#f59e0b', icon: 'ShoppingBag' },
];

export const HABIT_PRESETS = [
  {
    title: '英単語暗記 15分',
    description: '毎朝のスキマ時間で語彙力を確実にアップ',
    category: 'study',
    timeOfDay: 'morning' as HabitTimeOfDay,
    frequency: 'daily' as HabitFrequency,
    targetCount: 15,
    unit: '分',
    color: '#8b5cf6',
    icon: '📖',
  },
  {
    title: '社会科・一問一答 10問',
    description: '日本史・世界史・地理・公民の重要語句チェック',
    category: 'study',
    timeOfDay: 'afternoon' as HabitTimeOfDay,
    frequency: 'daily' as HabitFrequency,
    targetCount: 10,
    unit: '問',
    color: '#f59e0b',
    icon: '📝',
  },
  {
    title: '読書 20分',
    description: '就寝前のリラックスタイムに本を読み進める',
    category: 'study',
    timeOfDay: 'evening' as HabitTimeOfDay,
    frequency: 'daily' as HabitFrequency,
    targetCount: 20,
    unit: '分',
    color: '#3b82f6',
    icon: '📚',
  },
  {
    title: '朝のストレッチ & 散歩',
    description: '体を起こして1日の集中力を高める',
    category: 'health',
    timeOfDay: 'morning' as HabitTimeOfDay,
    frequency: 'daily' as HabitFrequency,
    targetCount: 15,
    unit: '分',
    color: '#10b981',
    icon: '🏃‍♂️',
  },
  {
    title: '水分補給 2リットル',
    description: 'こまめな水分補給で代謝と健康を維持',
    category: 'health',
    timeOfDay: 'anytime' as HabitTimeOfDay,
    frequency: 'daily' as HabitFrequency,
    targetCount: 2,
    unit: 'L',
    color: '#06b6d4',
    icon: '💧',
  },
  {
    title: '今日一番の優先タスク確認',
    description: '朝一番に重要ToDoを整理して手をつける',
    category: 'work',
    timeOfDay: 'morning' as HabitTimeOfDay,
    frequency: 'weekdays' as HabitFrequency,
    targetCount: 1,
    unit: '回',
    color: '#6366f1',
    icon: '☀️',
  },
  {
    title: '1日の振り返り・進捗チェック',
    description: '完了タスクを確認し明日の段取りをつける',
    category: 'personal',
    timeOfDay: 'evening' as HabitTimeOfDay,
    frequency: 'daily' as HabitFrequency,
    targetCount: 1,
    unit: '回',
    color: '#ec4899',
    icon: '📓',
  },
];

export const DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit_study_1',
    title: '重要語句・一問一答 10分',
    description: '毎日の基礎知識の定着と定例復習',
    category: 'study',
    timeOfDay: 'morning',
    frequency: 'daily',
    targetCount: 10,
    unit: '分',
    color: '#8b5cf6',
    icon: '📝',
    completedDates: [
      new Date(Date.now() - 86400000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'habit_health_1',
    title: '朝のストレッチ & 深呼吸',
    description: '集中力スイッチを入れて1日をスタート',
    category: 'health',
    timeOfDay: 'morning',
    frequency: 'daily',
    targetCount: 10,
    unit: '分',
    color: '#10b981',
    icon: '☀️',
    completedDates: [new Date().toISOString().split('T')[0]],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'habit_study_2',
    title: '就寝前の読書・学習復習',
    description: 'その日に学んだポイントを20分整理',
    category: 'study',
    timeOfDay: 'evening',
    frequency: 'daily',
    targetCount: 20,
    unit: '分',
    color: '#3b82f6',
    icon: '📚',
    completedDates: [new Date(Date.now() - 86400000).toISOString().split('T')[0]],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'habit_water_1',
    title: '水分補給 2リットル',
    description: 'こまめな水分補給で体調管理',
    category: 'health',
    timeOfDay: 'anytime',
    frequency: 'daily',
    targetCount: 2,
    unit: 'L',
    color: '#06b6d4',
    icon: '💧',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
];
