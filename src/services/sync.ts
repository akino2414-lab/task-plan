import { Task, Category, SyncData } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

class SyncService {
  private syncCode: string = '';
  private lastSyncedTime: number = 0;
  private debounceTimer: any = null;

  constructor() {
    this.initSyncCode();
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'FLOW-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private initSyncCode() {
    if (typeof window === 'undefined') return;

    // 1. Check URL query params e.g. ?sync=FLOW-XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const paramSync = urlParams.get('sync');
    if (paramSync && paramSync.trim()) {
      this.syncCode = paramSync.trim().toUpperCase();
      localStorage.setItem('taskflow_sync_code', this.syncCode);
      return;
    }

    // 2. Check LocalStorage
    const stored = localStorage.getItem('taskflow_sync_code');
    if (stored && stored.trim()) {
      this.syncCode = stored.trim();
    } else {
      this.syncCode = this.generateCode();
      localStorage.setItem('taskflow_sync_code', this.syncCode);
    }
  }

  public getSyncCode(): string {
    return this.syncCode;
  }

  public setSyncCode(code: string): void {
    this.syncCode = code.trim().toUpperCase();
    localStorage.setItem('taskflow_sync_code', this.syncCode);
  }

  public getShareUrl(): string {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?sync=${encodeURIComponent(this.syncCode)}`;
  }

  public getLastSynced(): number {
    return this.lastSyncedTime;
  }

  // Pull data from server
  public async pullData(): Promise<SyncData | null> {
    if (!this.syncCode) return null;
    try {
      const res = await fetch(`/api/sync/${encodeURIComponent(this.syncCode)}`);
      if (res.status === 404) {
        // Room not yet saved on server
        return null;
      }
      if (!res.ok) {
        throw new Error(`Sync pull failed: ${res.statusText}`);
      }
      const json = await res.json();
      if (json && json.data) {
        this.lastSyncedTime = json.updatedAt || Date.now();
        return json.data as SyncData;
      }
      return null;
    } catch (e) {
      console.warn('Sync pull error:', e);
      return null;
    }
  }

  // Push data to server
  public async pushData(data: SyncData): Promise<boolean> {
    if (!this.syncCode) return false;
    try {
      const res = await fetch(`/api/sync/${encodeURIComponent(this.syncCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (res.ok) {
        const json = await res.json();
        this.lastSyncedTime = json.updatedAt || Date.now();
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Sync push error:', e);
      return false;
    }
  }

  // Debounced push to prevent spamming while typing
  public schedulePush(data: SyncData, callback?: (status: SyncStatus) => void) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    callback?.('syncing');
    this.debounceTimer = setTimeout(async () => {
      const success = await this.pushData(data);
      callback?.(success ? 'synced' : 'offline');
    }, 1500);
  }
}

export const syncService = new SyncService();
