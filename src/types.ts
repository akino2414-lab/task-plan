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

export interface SyncData {
  tasks: Task[];
  categories: Category[];
  availableTags: string[];
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
