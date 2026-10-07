// src/lib/confirm.tsx — Promise-based confirm dialog (replaces window.confirm)
import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    }),
  close: (ok) => {
    const { resolve } = get();
    resolve?.(ok);
    set({ open: false, options: null, resolve: null });
  },
}));

/** Awaitable confirmation. Returns true if the user confirms. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options);
}

/** Mount once near the app root. */
export function ConfirmHost() {
  const { open, options, close } = useConfirmStore();
  if (!open || !options) return null;

  const danger = options.danger !== false; // default to danger styling for destructive-feeling confirms
  return (
    <div
      onClick={() => close(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(4,6,12,.66)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--surface)',
          border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)',
          padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,.55)',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, marginBottom: 16,
          background: danger ? 'rgba(239,68,68,.14)' : 'var(--accent-soft)',
          color: danger ? 'var(--danger)' : 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{danger ? '⚠️' : '❓'}</div>

        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{options.title}</h3>
        {options.message && (
          <p style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 8, lineHeight: 1.55 }}>{options.message}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={() => close(false)}>
            {options.cancelLabel || 'Anulează'}
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => close(true)}
            autoFocus
          >
            {options.confirmLabel || 'Confirmă'}
          </button>
        </div>
      </div>
    </div>
  );
}
