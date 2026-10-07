// src/components/CommandPalette.tsx — Cmd/Ctrl+K quick navigation & actions
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Command {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  run: (nav: ReturnType<typeof useNavigate>) => void;
}

const COMMANDS: Command[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', hint: 'Prezentare generală', run: (n) => n('/') },
  { id: 'users', label: 'Utilizatori', icon: '👥', hint: 'Caută & administrează conturi', run: (n) => n('/users') },
  { id: 'children', label: 'Copii & Sarcini', icon: '👶', run: (n) => n('/children') },
  { id: 'community', label: 'Comunitate', icon: '💬', run: (n) => n('/community') },
  { id: 'content', label: 'Conținut', icon: '📝', run: (n) => n('/content') },
  { id: 'medical', label: 'Module Medicale', icon: '🏥', run: (n) => n('/medical') },
  { id: 'ai', label: 'AI Center', icon: '🤖', run: (n) => n('/ai') },
  { id: 'notifications', label: 'Notificări', icon: '🔔', run: (n) => n('/notifications') },
  { id: 'email', label: 'Email Templates', icon: '✉️', run: (n) => n('/email-templates') },
  { id: 'reports', label: 'Rapoarte', icon: '📋', run: (n) => n('/reports') },
  { id: 'billing', label: 'Abonamente & Plăți', icon: '💳', run: (n) => n('/billing') },
  { id: 'storage', label: 'Documente & Storage', icon: '💾', run: (n) => n('/storage') },
  { id: 'support', label: 'Feedback & Suport', icon: '🎧', run: (n) => n('/support') },
  { id: 'analytics', label: 'Analytics', icon: '📈', run: (n) => n('/analytics') },
  { id: 'flags', label: 'Feature Flags', icon: '🏴', run: (n) => n('/flags') },
  { id: 'audit', label: 'Audit & Security', icon: '🔒', run: (n) => n('/audit') },
  { id: 'settings', label: 'Setări Aplicație', icon: '⚙️', run: (n) => n('/settings') },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = !term
      ? COMMANDS
      : COMMANDS.filter((c) => c.label.toLowerCase().includes(term) || c.hint?.toLowerCase().includes(term));
    // If the query looks like a user search, offer it as a top action
    const extra: Command[] = term
      ? [{
          id: 'search-users',
          label: `Caută utilizatori: "${q.trim()}"`,
          icon: '🔍',
          run: (n) => n(`/users?search=${encodeURIComponent(q.trim())}`),
        }]
      : [];
    return [...extra, ...base];
  }, [q]);

  useEffect(() => { setActive(0); }, [q]);

  if (!open) return null;

  const run = (i: number) => {
    const cmd = results[i];
    if (!cmd) return;
    setOpen(false);
    cmd.run(navigate);
  };

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(4,6,12,.6)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, background: 'var(--surface)',
          border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 30px 90px rgba(0,0,0,.6)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, color: 'var(--text3)' }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(active); }
            }}
            placeholder="Sari la o pagină sau caută un utilizator…"
            style={{
              flex: 1, background: 'transparent', border: 0, outline: 'none',
              color: 'var(--text)', fontSize: 15, fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontSize: 10, color: 'var(--text3)', border: '1px solid var(--border2)',
            borderRadius: 5, padding: '2px 6px',
          }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Niciun rezultat</div>
          )}
          {results.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8, border: 0, cursor: 'pointer',
                background: i === active ? 'var(--accent-soft)' : 'transparent',
                color: 'var(--text)', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{c.label}</span>
              {c.hint && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
