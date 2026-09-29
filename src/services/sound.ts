// Web Audio API based synthesizer for diverse notification sounds
import { NotificationSoundType } from '../types';

class SoundService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private defaultSound: NotificationSoundType = 'chime';

  constructor() {
    try {
      const stored = localStorage.getItem('taskflow_sound_enabled');
      if (stored !== null) {
        this.soundEnabled = stored === 'true';
      }
      const storedSound = localStorage.getItem('taskflow_default_sound') as NotificationSoundType;
      if (storedSound) {
        this.defaultSound = storedSound;
      }
    } catch {
      // ignore
    }
  }

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('taskflow_sound_enabled', String(enabled));
    } catch {}
  }

  public getDefaultSound(): NotificationSoundType {
    return this.defaultSound;
  }

  public setDefaultSound(sound: NotificationSoundType) {
    this.defaultSound = sound;
    try {
      localStorage.setItem('taskflow_default_sound', sound);
    } catch {}
  }

  // Play a specific notification sound
  public playSound(soundType: NotificationSoundType = this.defaultSound) {
    if (!this.soundEnabled || soundType === 'mute') return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      switch (soundType) {
        case 'bell': {
          // Dual frequency metallic bell ring with rich overtone
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(880, now); // A5

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1760 * 1.15, now); // Metallic overtone

          gainNode.gain.setValueAtTime(0.2, now);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.2);
          osc2.stop(now + 1.2);
          break;
        }

        case 'marimba': {
          // Warm resonant wood percussive triad
          const freqs = [440, 554.37, 659.25]; // A4, C#5, E5
          freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + idx * 0.07);

            gain.gain.setValueAtTime(0, now + idx * 0.07);
            gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.45);
          });
          break;
        }

        case 'pulse': {
          // Futuristic short double high beep
          [1046.5, 1318.51].forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + idx * 0.09);

            gain.gain.setValueAtTime(0.15, now + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.15);
          });
          break;
        }

        case 'fanfare': {
          // Triumphant chord burst
          const chord = [523.25, 659.25, 783.99, 1046.5]; // C major
          chord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.05);

            gain.gain.setValueAtTime(0, now + idx * 0.05);
            gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.05 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.05);
            osc.stop(now + idx * 0.05 + 0.65);
          });
          break;
        }

        case 'chime':
        default: {
          // Crystal high ascending chime
          const notes = [659.25, 783.99, 987.77, 1318.51]; // E5, G5, B5, E6
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0, now + idx * 0.08);
            gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.45);
          });
          break;
        }
      }
    } catch (e) {
      console.warn('Sound error:', e);
    }
  }

  // Completion fanfare
  public playCompleteSound() {
    this.playSound('fanfare');
  }

  // Urgent alert
  public playAlertSound(sound?: NotificationSoundType) {
    this.playSound(sound || this.defaultSound);
  }
}

export const soundService = new SoundService();
