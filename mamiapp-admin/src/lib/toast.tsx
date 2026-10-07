// src/lib/toast.tsx — Global toast notifications (store-based, callable from anywhere)
import { useEffect } from 'react';
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
}

let counter = 0;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

function show(type: ToastType, title: string, description?: string, duration = 4200) {
  return useToastStore.getState().push({ type, title, description, duration });
}

/** Callable from anywhere (components or plain functions). */
export const toast = {
  success: (title: string, description?: string) => show('success', title, description),
  error: (title: string, description?: string) => show('error', title, description, 6000),
  info: (title: string, description?: string) => show('info', title, description),
  warning: (title: string, description?: string) => show('warning', title, description),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};

const META: Record<ToastType, { icon: string; color: string; bg: string }> = {
  success: { icon: '✓', color: 'var(--success)', bg: 'rgba(16,185,129,.14)' },
  error:   { icon: '✕', color: 'var(--danger)',  bg: 'rgba(239,68,68,.14)' },
  info:    { icon: 'ℹ', color: 'var(--info)',    bg: 'rgba(59,130,246,.14)' },
  warning: { icon: '!', color: 'var(--warning)', bg: 'rgba(245,158,11,.14)' },
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const meta = META[t.type];

  useEffect(() => {
    if (t.duration <= 0) return;
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, dismiss]);

  return (
    <div
      className="fade-in"
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        width: 340, maxWidth: 'calc(100vw - 40px)',
        background: 'var(--surface)', border: '1px solid var(--border2)',
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 'var(--radius)', padding: '12px 14px',
        boxShadow: '0 12px 40px rgba(0,0,0,.45)',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
        background: meta.bg, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800,
      }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.title}</div>
        {t.description && (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.45 }}>{t.description}</div>
        )}
      </div>
      <button
        onClick={() => dismiss(t.id)}
        style={{
          background: 'transparent', border: 0, color: 'var(--text3)', cursor: 'pointer',
          fontSize: 15, lineHeight: 1, padding: 2, flexShrink: 0,
        }}
        aria-label="Închide"
      >✕</button>
    </div>
  );
}

/** Mount once near the app root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem t={t} />
        </div>
      ))}
    </div>
  );
}
