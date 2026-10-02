import { Task, Category, SyncData } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

class SyncService {
  private syncCode: string = '';
  private lastSyncedTime: number = 0;
  private debounceTimer: any = null;

  constructor() {
    this.initSyncCode();
  }

  private isPeerJoined: boolean = false;

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
      this.isPeerJoined = true;
      localStorage.setItem('taskflow_sync_code', this.syncCode);
      localStorage.setItem('taskflow_is_peer_joined', 'true');
      return;
    }

    // 2. Check LocalStorage
    const stored = localStorage.getItem('taskflow_sync_code');
    const storedPeer = localStorage.getItem('taskflow_is_peer_joined');
    if (storedPeer === 'true') {
      this.isPeerJoined = true;
    }

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
    this.isPeerJoined = true;
    localStorage.setItem('taskflow_sync_code', this.syncCode);
    localStorage.setItem('taskflow_is_peer_joined', 'true');
  }

  public getShareUrl(): string {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?sync=${encodeURIComponent(this.syncCode)}`;
  }

  public getLastSynced(): number {
    return this.lastSyncedTime;
  }

  // Pull data from server room (prioritized if user connected to a peer sync code or entered via URL), or fallback to master store
  public async pullMasterOrRoomData(): Promise<SyncData | null> {
    // 1. If this device opened via shared sync link or connected to a room, ALWAYS pull room data first!
    if (this.isPeerJoined && this.syncCode) {
      const roomData = await this.pullData();
      if (roomData && Array.isArray(roomData.tasks)) {
        return roomData;
      }
    }

    // 2. Try pulling master persistent data
    try {
      const res = await fetch('/api/storage/master');
      if (res.ok) {
        const json = await res.json();
        if (json && json.hasData && json.data) {
          this.lastSyncedTime = json.updatedAt || Date.now();
          return json.data as SyncData;
        }
      }
    } catch (e) {
      console.warn('Master storage pull error:', e);
    }

    // 3. Fallback to room sync code
    return this.pullData();
  }

  // Restore from server rolling backup
  public async restoreServerBackup(): Promise<SyncData | null> {
    try {
      const res = await fetch('/api/storage/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          this.lastSyncedTime = json.updatedAt || Date.now();
          return json.data as SyncData;
        }
      }
    } catch (e) {
      console.error('Failed to restore server backup:', e);
    }
    return null;
  }

  // Pull data from server room
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

  // Push data to server (both master persistent file and room code)
  public async pushData(data: SyncData): Promise<boolean> {
    let success = false;
    const bodyStr = JSON.stringify({ data });

    // 1. Save to master persistent store on disk
    try {
      const masterRes = await fetch('/api/storage/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
      if (masterRes.ok) {
        const json = await masterRes.json();
        this.lastSyncedTime = json.updatedAt || Date.now();
        success = true;
      }
    } catch (e) {
      console.warn('Master storage push error:', e);
    }

    // 2. Also save to sync room for peer multi-device sync
    if (this.syncCode) {
      try {
        const roomRes = await fetch(`/api/sync/${encodeURIComponent(this.syncCode)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });
        if (roomRes.ok) {
          const json = await roomRes.json();
          this.lastSyncedTime = json.updatedAt || Date.now();
          success = true;
        }
      } catch (e) {
        console.warn('Sync room push error:', e);
      }
    }

    return success;
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
