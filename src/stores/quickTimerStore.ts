import { create } from 'zustand';

export type TimerKey = 'breastfeeding' | 'sleep';

export interface QuickTimer {
  startedAt: number;      // ms timestamp when last resumed
  accumulated: number;    // seconds already counted before last resume
  running: boolean;
  // breastfeeding extras
  side?: 'left' | 'right' | 'both';
  // sleep extras
  sleepType?: 'nap' | 'night';
}

interface QuickTimerState {
  timers: Partial<Record<TimerKey, QuickTimer>>;

  startTimer: (key: TimerKey, opts?: { side?: QuickTimer['side']; sleepType?: QuickTimer['sleepType'] }) => void;
  pauseTimer: (key: TimerKey) => void;
  resumeTimer: (key: TimerKey) => void;
  resetTimer: (key: TimerKey) => void;
  setSide: (key: TimerKey, side: QuickTimer['side']) => void;
  setSleepType: (key: TimerKey, sleepType: QuickTimer['sleepType']) => void;
  /** Returns elapsed seconds right now (live). */
  getElapsed: (key: TimerKey) => number;
}

export const useQuickTimerStore = create<QuickTimerState>((set, get) => ({
  timers: {},

  startTimer: (key, opts) => set((s) => ({
    timers: {
      ...s.timers,
      [key]: {
        startedAt: Date.now(),
        accumulated: 0,
        running: true,
        side: opts?.side ?? 'left',
        sleepType: opts?.sleepType ?? 'nap',
      },
    },
  })),

  pauseTimer: (key) => set((s) => {
    const t = s.timers[key];
    if (!t || !t.running) return s;
    const elapsed = t.accumulated + (Date.now() - t.startedAt) / 1000;
    return { timers: { ...s.timers, [key]: { ...t, accumulated: elapsed, running: false } } };
  }),

  resumeTimer: (key) => set((s) => {
    const t = s.timers[key];
    if (!t || t.running) return s;
    return { timers: { ...s.timers, [key]: { ...t, startedAt: Date.now(), running: true } } };
  }),

  resetTimer: (key) => set((s) => ({
    timers: { ...s.timers, [key]: undefined },
  })),

  setSide: (key, side) => set((s) => {
    const t = s.timers[key];
    if (!t) return s;
    return { timers: { ...s.timers, [key]: { ...t, side } } };
  }),

  setSleepType: (key, sleepType) => set((s) => {
    const t = s.timers[key];
    if (!t) return s;
    return { timers: { ...s.timers, [key]: { ...t, sleepType } } };
  }),

  getElapsed: (key) => {
    const t = get().timers[key];
    if (!t) return 0;
    if (!t.running) return Math.floor(t.accumulated);
    return Math.floor(t.accumulated + (Date.now() - t.startedAt) / 1000);
  },
}));
