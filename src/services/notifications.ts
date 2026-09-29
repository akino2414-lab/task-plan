import { Task, TaskReminder, NotificationSoundType } from '../types';
import { soundService } from './sound';

export type AlertType = 'reminder_due' | 'overdue' | 'due_today' | 'due_soon';

export interface ActiveAlert {
  id: string; // unique alert key
  task: Task;
  reminder?: TaskReminder;
  type: AlertType;
  title: string;
  message: string;
  timeStr: string;
  soundType?: NotificationSoundType;
}

class NotificationService {
  private notifiedKeys = new Set<string>();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  // Checks both task specific reminders AND deadline threshold alerts
  public checkActiveAlerts(tasks: Task[]): ActiveAlert[] {
    const alerts: ActiveAlert[] = [];
    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = now.toISOString().split('T')[0];

    tasks.forEach((task) => {
      if (task.status === 'done') return;

      // 1. Check custom reminders attached to the task
      if (Array.isArray(task.reminders)) {
        task.reminders.forEach((reminder) => {
          // If snoozed, check snooze expiry
          let targetMs: number;
          if (reminder.snoozedUntil) {
            targetMs = new Date(reminder.snoozedUntil).getTime();
          } else {
            targetMs = new Date(reminder.datetime).getTime();
          }

          // If time has arrived (within the last 24 hours and not yet marked triggered)
          if (nowMs >= targetMs && targetMs > nowMs - 24 * 60 * 60 * 1000) {
            const isSnoozed = Boolean(reminder.snoozedUntil && new Date(reminder.snoozedUntil).getTime() <= nowMs);
            alerts.push({
              id: `reminder_${task.id}_${reminder.id}_${targetMs}`,
              task,
              reminder,
              type: 'reminder_due',
              title: isSnoozed ? `⏰ スヌーズ通知: ${task.title}` : `🔔 リマインダー: ${task.title}`,
              message: reminder.label || `指定日時 (${new Date(reminder.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) になりました`,
              timeStr: new Date(reminder.datetime).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              soundType: task.soundType || soundService.getDefaultSound(),
            });
          }
        });
      }

      // 2. Check general due date imminent thresholds (today, overdue)
      if (task.dueDate) {
        const dueDateTimeStr = task.dueTime ? `${task.dueDate}T${task.dueTime}:00` : `${task.dueDate}T23:59:59`;
        const dueDate = new Date(dueDateTimeStr);
        const diffMs = dueDate.getTime() - nowMs;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffMs < 0) {
          // Overdue
          alerts.push({
            id: `overdue_${task.id}_${task.dueDate}`,
            task,
            type: 'overdue',
            title: `⚠️ 期限切れ: ${task.title}`,
            message: `期限を過ぎています (${Math.abs(Math.round(diffHours))}時間前)`,
            timeStr: `${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`,
            soundType: task.soundType,
          });
        } else if (task.dueDate === todayStr) {
          if (diffHours <= 2) {
            alerts.push({
              id: `due_soon_${task.id}`,
              task,
              type: 'due_soon',
              title: `⏰ まもなく締め切り: ${task.title}`,
              message: `残り約${Math.max(1, Math.round(diffHours))}時間です`,
              timeStr: task.dueTime || '本日中',
              soundType: task.soundType,
            });
          } else {
            alerts.push({
              id: `due_today_${task.id}`,
              task,
              type: 'due_today',
              title: `📅 今日のタスク: ${task.title}`,
              message: '本日が締め切り日です',
              timeStr: task.dueTime || '本日中',
              soundType: task.soundType,
            });
          }
        }
      }
    });

    return alerts;
  }

  // Trigger sound & desktop notification for newly popped alerts
  public notifyNewlyTriggered(alerts: ActiveAlert[]) {
    alerts.forEach((alert) => {
      if (!this.notifiedKeys.has(alert.id)) {
        this.notifiedKeys.add(alert.id);

        // Play the chosen sound
        soundService.playSound(alert.soundType || soundService.getDefaultSound());

        // Desktop notification
        if (this.isSupported() && Notification.permission === 'granted') {
          try {
            new Notification(alert.title, {
              body: alert.message,
              icon: '/favicon.ico',
            });
          } catch (e) {
            console.warn('Native notification failed', e);
          }
        }
      }
    });
  }

  // Reset a notified key (e.g. if user snoozed and it fires again)
  public clearKey(key: string) {
    this.notifiedKeys.delete(key);
  }
}

export const notificationService = new NotificationService();
