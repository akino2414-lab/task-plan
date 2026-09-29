import React from 'react';
import {
  X,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ActiveAlert } from '../services/notifications';
import { Task } from '../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ActiveAlert[];
  allTasks: Task[];
  onSnooze: (alert: ActiveAlert, minutes: number) => void;
  onSnoozeUntilTomorrow: (alert: ActiveAlert) => void;
  onCompleteTask: (taskId: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  allTasks,
  onSnooze,
  onSnoozeUntilTomorrow,
  onCompleteTask,
  soundEnabled,
  onToggleSound,
}) => {
  if (!isOpen) return null;

  // Future scheduled reminders across tasks
  const scheduledTasks = allTasks.filter(
    (t) => t.status !== 'done' && Array.isArray(t.reminders) && t.reminders.length > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                通知・リマインダーセンター
              </h2>
              <p className="text-[11px] text-slate-500">
                期限切れ・至急タスク・スヌーズ設定
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Urgencies */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              今対応が必要な通知 ({alerts.length})
            </h3>
            {alerts.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                現在期限切れや直前のリマインダーはありません 🎉
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {alert.type === 'overdue' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5" />
                        ) : (
                          <Bell className="w-4 h-4 text-amber-500 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {alert.task.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {alert.message} ({alert.timeStr})
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onCompleteTask(alert.task.id)}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> 完了
                      </button>
                    </div>

                    {/* Snooze choices for each item */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> スヌーズ:
                      </span>
                      <button
                        onClick={() => onSnooze(alert, 5)}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        5分
                      </button>
                      <button
                        onClick={() => onSnooze(alert, 15)}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        15分
                      </button>
                      <button
                        onClick={() => onSnooze(alert, 60)}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        1時間
                      </button>
                      <button
                        onClick={() => onSnoozeUntilTomorrow(alert)}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        明日
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Reminders Overview */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              今後の予定リマインダー ({scheduledTasks.length}タスク)
            </h3>
            <div className="space-y-2">
              {scheduledTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    {t.title}
                  </div>
                  <div className="space-y-1">
                    {t.reminders.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-[11px] text-slate-500"
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          {r.label || 'リマインダー'}:
                        </span>
                        <span>{new Date(r.datetime).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSound}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-indigo-500" /> サウンドON
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" /> サウンドOFF
                </>
              )}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
