import React from 'react';
import { Bell, Clock, CheckCircle2, X, AlertTriangle, Moon } from 'lucide-react';
import { ActiveAlert } from '../services/notifications';

interface ActiveAlertsBannerProps {
  alerts: ActiveAlert[];
  onSnooze: (alert: ActiveAlert, minutes: number) => void;
  onSnoozeUntilTomorrow: (alert: ActiveAlert) => void;
  onCompleteTask: (taskId: string) => void;
  onDismiss: (alertId: string) => void;
  onRequestPermission: () => void;
  notificationPermission: NotificationPermission;
}

export const ActiveAlertsBanner: React.FC<ActiveAlertsBannerProps> = ({
  alerts,
  onSnooze,
  onSnoozeUntilTomorrow,
  onCompleteTask,
  onDismiss,
  onRequestPermission,
  notificationPermission,
}) => {
  if (alerts.length === 0 && notificationPermission !== 'default') {
    return null;
  }

  // Display at most the top 2 urgent alerts in banner to avoid clutter
  const topAlerts = alerts.slice(0, 2);

  return (
    <div className="space-y-2 mb-4 animate-in slide-in-from-top-3 duration-200">
      {/* Browser Notification Permission request banner if not asked yet */}
      {notificationPermission === 'default' && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-bounce" />
            <span>
              ブラウザ通知を許可すると、アプリを閉じていても期限やリマインダーを受け取れます。
            </span>
          </div>
          <button
            onClick={onRequestPermission}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            通知を許可する
          </button>
        </div>
      )}

      {/* Active Triggered Alerts with Snooze Options */}
      {topAlerts.map((alert) => {
        const isOverdue = alert.type === 'overdue';

        return (
          <div
            key={alert.id}
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-lg transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isOverdue
                ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-950 dark:text-rose-100'
                : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-100'
            }`}
          >
            {/* Alert content */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={`p-2 rounded-xl mt-0.5 ${
                  isOverdue
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300'
                }`}
              >
                {isOverdue ? (
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                ) : (
                  <Bell className="w-5 h-5 animate-bounce" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm truncate">{alert.task.title}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOverdue
                        ? 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200'
                        : 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {alert.timeStr}
                  </span>
                </div>
                <p className="text-xs opacity-90 mt-0.5">{alert.message}</p>
              </div>
            </div>

            {/* Action buttons & SNOOZE controls */}
            <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center w-full sm:w-auto justify-end">
              {/* Snooze choices */}
              <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-[11px] font-medium text-slate-500 px-1.5 hidden md:inline flex items-center gap-1">
                  <Clock className="w-3 h-3" /> スヌーズ:
                </span>
                <button
                  onClick={() => onSnooze(alert, 5)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  title="5分後に再通知"
                >
                  5分
                </button>
                <button
                  onClick={() => onSnooze(alert, 15)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  title="15分後に再通知"
                >
                  15分
                </button>
                <button
                  onClick={() => onSnooze(alert, 60)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  title="1時間後に再通知"
                >
                  1時間
                </button>
                <button
                  onClick={() => onSnoozeUntilTomorrow(alert)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors hidden sm:inline-flex items-center gap-0.5"
                  title="明日朝9時に再通知"
                >
                  <Moon className="w-3 h-3 text-indigo-500" />
                  明日
                </button>
              </div>

              {/* Complete button */}
              <button
                onClick={() => onCompleteTask(alert.task.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>完了</span>
              </button>

              {/* Dismiss button */}
              <button
                onClick={() => onDismiss(alert.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {alerts.length > 2 && (
        <div className="text-right">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            他 {alerts.length - 2} 件の期限・リマインダーがあります (右上のベルアイコンから確認)
          </span>
        </div>
      )}
    </div>
  );
};
