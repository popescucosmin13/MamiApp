// src/pages/Support.tsx
import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface Ticket {
  id: string;
  userId?: string;
  userEmail?: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt?: any;
  adminReply?: string;
  resolvedAt?: any;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#EF4444',
  in_progress: '#F59E0B',
  resolved: '#10B981',
  closed: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  open: '🔴 Deschis',
  in_progress: '🟡 În lucru',
  resolved: '🟢 Rezolvat',
  closed: '⚫ Închis',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadTickets = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')));
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)));
    } catch (e) {
      // Collection may not exist yet — that's fine
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTickets(); }, []);

  const updateTicket = async (id: string, data: Partial<Ticket>) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'supportTickets', id), {
        ...data,
        ...(data.status === 'resolved' ? { resolvedAt: serverTimestamp() } : {}),
      });
      await loadTickets();
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...data } : null);
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    await updateTicket(selected.id, { adminReply: reply, status: 'in_progress' });
    setReply('');
  };

  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter);
  const openCount = tickets.filter(t => t.status === 'open').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent').length;

  return (
    <div style={{ padding: 24, maxWidth: 1400 }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>🎧 Feedback &amp; Suport</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
          Tickete suport, feedback și bug reports de la utilizatori.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '📮', label: 'Total tickete', val: tickets.length, color: '#6366F1' },
          { icon: '🔴', label: 'Deschise', val: openCount, color: '#EF4444' },
          { icon: '🚨', label: 'Urgente', val: urgentCount, color: '#F59E0B' },
          { icon: '✅', label: 'Rezolvate', val: tickets.filter(t => t.status === 'resolved').length, color: '#10B981' },
        ].map(k => (
          <div key={k.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: k.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 14 }}>
          {/* Tickets list */}
          <div>
            {/* Status filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={statusFilter === s ? 'btn btn-primary' : 'btn'}
                  style={{ fontSize: 12 }}>
                  {s === 'all' ? `📋 Toate (${tickets.length})` : STATUS_LABELS[s] + ` (${tickets.filter(t => t.status === s).length})`}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <p style={{ color: 'var(--text2)', fontSize: 14 }}>
                  {tickets.length === 0 ? 'Nu există tickete de suport încă. Colecția va fi populată automat când utilizatorii trimit feedback.' : 'Nu există tickete cu filtrul selectat.'}
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={th}>Subiect</th>
                      <th style={th}>Utilizator</th>
                      <th style={th}>Status</th>
                      <th style={th}>Prioritate</th>
                      <th style={th}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => (
                      <tr key={t.id}
                        onClick={() => setSelected(t)}
                        style={{
                          borderTop: '1px solid var(--border)',
                          background: selected?.id === t.id ? 'var(--accent-soft)' : i % 2 === 0 ? 'transparent' : 'var(--surface)',
                          cursor: 'pointer',
                        }}>
                        <td style={{ ...td, fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.subject}
                        </td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--text3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.userEmail || t.userId?.slice(0, 12) + '…' || '—'}
                        </td>
                        <td style={td}>
                          <span className="badge" style={{ background: STATUS_COLORS[t.status] + '20', color: STATUS_COLORS[t.status], border: `1px solid ${STATUS_COLORS[t.status]}40`, fontSize: 11 }}>
                            {STATUS_LABELS[t.status]}
                          </span>
                        </td>
                        <td style={td}>
                          <span className="badge badge-gray" style={{ color: PRIORITY_COLORS[t.priority], fontSize: 11 }}>
                            {t.priority?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...td, fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('ro-RO') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ticket detail */}
          {selected && (
            <div className="card" style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, flex: 1, marginRight: 8 }}>{selected.subject}</div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' }}>✕</button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                {selected.userEmail || selected.userId} · {selected.createdAt?.toDate ? selected.createdAt.toDate().toLocaleString('ro-RO') : '—'}
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
                {selected.message}
              </div>

              {selected.adminReply && (
                <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>✉️ Răspuns admin:</div>
                  {selected.adminReply}
                </div>
              )}

              {/* Status change */}
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Schimbă status</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
                    <button key={s} onClick={() => updateTicket(selected.id, { status: s })}
                      disabled={saving || selected.status === s}
                      className="btn" style={{ fontSize: 11, padding: '4px 10px', opacity: selected.status === s ? 0.4 : 1, color: STATUS_COLORS[s] }}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply */}
              <div>
                <label style={lbl}>Trimite răspuns</label>
                <textarea className="input" value={reply} onChange={e => setReply(e.target.value)}
                  placeholder="Scrie un răspuns utilizatorului..."
                  style={{ minHeight: 80, resize: 'vertical', marginBottom: 8 }} />
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={sendReply} disabled={saving || !reply.trim()}>
                  {saving ? 'Se trimite...' : '📨 Trimite răspuns'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: 'var(--text)' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 };
