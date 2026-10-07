import { create } from 'zustand';

export type TimerType = 'feeding' | 'sleep' | 'contraction';

export interface ActiveTimer {
  id: string;
  type: TimerType;
  label: string;
  startTime: number;      // Date.now() when first started
  pausedAt?: number;      // Date.now() when last paused (undefined = running)
  totalPausedMs: number;  // accumulated pause duration in ms
  metadata?: {
    side?: 'left' | 'right' | 'both';
    sleepType?: 'nap' | 'night';
    bottleAmount?: number;
  };
}

/** Returns elapsed seconds for a timer, accounting for pauses. */
export function getElapsedSeconds(timer: ActiveTimer): number {
  const pausedMs = timer.pausedAt
    ? timer.totalPausedMs + (Date.now() - timer.pausedAt)
    : timer.totalPausedMs;
  return Math.floor((Date.now() - timer.startTime - pausedMs) / 1000);
}

/** True when timer is paused. */
export function isTimerPaused(timer: ActiveTimer): boolean {
  return timer.pausedAt !== undefined;
}

interface TimerStore {
  activeTimers: ActiveTimer[];
  startTimer: (timer: Omit<ActiveTimer, 'id' | 'totalPausedMs'>) => string;
  stopTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  updateTimer: (id: string, updates: Partial<ActiveTimer>) => void;
  clearAll: () => void;
  getTimer: (type: TimerType) => ActiveTimer | undefined;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  activeTimers: [],

  startTimer: (timer) => {
    const id = `${timer.type}_${Date.now()}`;
    // Stop existing timer of same type
    const existing = get().activeTimers.find(t => t.type === timer.type);
    if (existing) {
      set(state => ({
        activeTimers: state.activeTimers.filter(t => t.id !== existing.id),
      }));
    }
    const newTimer: ActiveTimer = { ...timer, id, totalPausedMs: 0, pausedAt: undefined };
    set(state => ({ activeTimers: [...state.activeTimers, newTimer] }));
    updateMediaSession(get().activeTimers);
    return id;
  },

  stopTimer: (id) => {
    set(state => ({
      activeTimers: state.activeTimers.filter(t => t.id !== id),
    }));
    updateMediaSession(get().activeTimers);
  },

  pauseTimer: (id) => {
    set(state => ({
      activeTimers: state.activeTimers.map(t =>
        t.id === id && !t.pausedAt ? { ...t, pausedAt: Date.now() } : t
      ),
    }));
    updateMediaSession(get().activeTimers);
  },

  resumeTimer: (id) => {
    set(state => ({
      activeTimers: state.activeTimers.map(t => {
        if (t.id !== id || !t.pausedAt) return t;
        return {
          ...t,
          totalPausedMs: t.totalPausedMs + (Date.now() - t.pausedAt),
          pausedAt: undefined,
        };
      }),
    }));
    updateMediaSession(get().activeTimers);
  },

  updateTimer: (id, updates) => {
    set(state => ({
      activeTimers: state.activeTimers.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
    updateMediaSession(get().activeTimers);
  },

  clearAll: () => {
    set({ activeTimers: [] });
    clearMediaSession();
  },

  getTimer: (type) => {
    return get().activeTimers.find(t => t.type === type);
  },
}));

// ─── Media Session API (lock screen) ─────────────────────────────────────────

function getTimerEmoji(type: TimerType): string {
  switch (type) {
    case 'feeding': return '🍼';
    case 'sleep': return '😴';
    case 'contraction': return '⏱️';
  }
}

function formatElapsedForLock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateMediaSession(timers: ActiveTimer[]) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (timers.length === 0) { clearMediaSession(); return; }

  const timer = timers[0];
  const elapsed = getElapsedSeconds(timer);
  const paused = isTimerPaused(timer);

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${getTimerEmoji(timer.type)} ${timer.label}`,
      artist: `MamiApp • ${formatElapsedForLock(elapsed)}${paused ? ' ⏸' : ''}`,
      album: timers.length > 1 ? `+${timers.length - 1} timere active` : 'Timer activ',
      artwork: [
        { src: '/assets/favicon.png', sizes: '192x192', type: 'image/png' },
        { src: '/assets/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = paused ? 'paused' : 'playing';
    navigator.mediaSession.setActionHandler('pause', () => {
      useTimerStore.getState().pauseTimer(timer.id);
    });
    navigator.mediaSession.setActionHandler('play', () => {
      useTimerStore.getState().resumeTimer(timer.id);
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      useTimerStore.getState().stopTimer(timer.id);
    });
  } catch {
    // Media Session not fully supported
  }
}

function clearMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('stop', null);
  } catch {
    // ignore
  }
}

// Actualizează Media Session la fiecare 5 secunde
if (typeof window !== 'undefined') {
  setInterval(() => {
    const timers = useTimerStore.getState().activeTimers;
    if (timers.length > 0) updateMediaSession(timers);
  }, 5000);
}
