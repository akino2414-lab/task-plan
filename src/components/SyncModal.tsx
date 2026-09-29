import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Smartphone,
  Laptop,
  QrCode,
  Copy,
  Check,
  Download,
  Upload,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import { SyncStatus } from '../services/sync';
import { SyncData } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncCode: string;
  onUpdateSyncCode: (newCode: string) => void;
  syncStatus: SyncStatus;
  onForceSync: () => void;
  shareUrl: string;
  onExportBackup: () => void;
  onImportBackup: (importedData: SyncData) => void;
  lastSyncedTime: number;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncCode,
  onUpdateSyncCode,
  syncStatus,
  onForceSync,
  shareUrl,
  onExportBackup,
  onImportBackup,
  lastSyncedTime,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    }
  }, [shareUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      onUpdateSyncCode(inputCode.trim().toUpperCase());
      setInputCode('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.tasks)) {
          onImportBackup(parsed);
          setImportError('');
          onClose();
        } else {
          setImportError('無効なバックアップファイル形式です');
        }
      } catch (err) {
        setImportError('ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>PC・スマートフォン 同期設定</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  リアルタイム
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                同じ同期コードを使うことで、複数端末で同一リストを共有できます
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
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Visual sync diagram */}
          <div className="flex items-center justify-around p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/30">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                PCブラウザ
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-bold">クラウド自動同期</span>
              </div>
              <span className="text-[10px] text-slate-500">
                同期コード: <strong className="text-indigo-600 dark:text-indigo-400">{syncCode}</strong>
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                スマートフォン
              </span>
            </div>
          </div>

          {/* QR Code and Share Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* QR Code */}
            <div className="flex flex-col items-center p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Sync QR Code"
                  className="w-36 h-36 rounded-lg shadow-inner mb-2 bg-white p-1"
                />
              ) : (
                <div className="w-36 h-36 rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                  <QrCode className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                スマホのカメラで読み取る
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                ログイン不要ですぐにこのToDoが開きます
              </span>
            </div>

            {/* Direct Link & Status */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  現在の同期コード
                </label>
                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 font-mono font-bold text-indigo-700 dark:text-indigo-300 text-sm tracking-wider flex-1">
                    {syncCode}
                  </div>
                  <button
                    onClick={onForceSync}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="今すぐ強制同期"
                  >
                    <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  共有用URLをコピー
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 flex-1 truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? '完了' : 'コピー'}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                最終同期: {lastSyncedTime ? new Date(lastSyncedTime).toLocaleTimeString() : 'ローカル'}
              </div>
            </div>
          </div>

          {/* Connect to an existing Sync Code */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              別の端末の同期コードを入力して接続:
            </label>
            <form onSubmit={handleApplyCode} className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="例: FLOW-XXXX"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono tracking-wider text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold transition-colors"
              >
                <span>接続する</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Backup / Export / Import */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              データのバックアップと復元 (JSON):
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onExportBackup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>バックアップを保存 (JSON)</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>JSONから復元</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {importError && (
              <p className="text-xs text-rose-500 mt-1 font-medium">{importError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>端末間の通信は安全に保護されています</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
