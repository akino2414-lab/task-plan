import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Check,
  Bell,
  Sparkles,
} from 'lucide-react';
import { NotificationSoundType, SOUND_OPTIONS } from '../types';
import { soundService } from '../services/sound';
import { notificationService } from '../services/notifications';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  defaultSound: NotificationSoundType;
  onSetDefaultSound: (sound: NotificationSoundType) => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  onToggleSound,
  defaultSound,
  onSetDefaultSound,
}) => {
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  if (!isOpen) return null;

  const handlePreview = (sound: NotificationSoundType) => {
    soundService.playSound(sound);
  };

  const handleTestNotification = async () => {
    const perm = await notificationService.requestPermission();
    if (perm === 'granted') {
      soundService.playSound(defaultSound);
      try {
        new Notification('🔔 通知テスト成功！', {
          body: `選択中のサウンド「${SOUND_OPTIONS.find((s) => s.id === defaultSound)?.name}」で通知されます。`,
          icon: '/favicon.ico',
        });
        setTestNotificationSent(true);
        setTimeout(() => setTestNotificationSent(false), 3000);
      } catch (e) {
        console.warn('Test notification error:', e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                通知音・サウンド設定
              </h2>
              <p className="text-xs text-slate-500">
                お好みの通知音を選択・試聴できます
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Master Sound Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  効果音・通知音の再生
                </div>
                <div className="text-[11px] text-slate-500">
                  タスク完了チャイムや期限アラームを再生します
                </div>
              </div>
            </div>
            <button
              onClick={onToggleSound}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                soundEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sound Presets List */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              デフォルトの通知サウンドを選択:
            </label>
            <div className="space-y-2">
              {SOUND_OPTIONS.map((opt) => {
                const isSelected = defaultSound === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onSetDefaultSound(opt.id);
                      handlePreview(opt.id);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{opt.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {opt.description}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(opt.id);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-sm"
                    >
                      <Play className="w-3 h-3 fill-current text-indigo-500" />
                      <span>試聴</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Desktop Notification button */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={handleTestNotification}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            >
              <Bell className="w-4 h-4 text-indigo-500" />
              <span>テスト通知を発行する</span>
            </button>
            {testNotificationSent && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                通知を送信しました！
              </span>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              保存して閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
