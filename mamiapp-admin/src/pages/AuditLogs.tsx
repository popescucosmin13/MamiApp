// src/pages/AuditLogs.tsx — Jurnal complet de acțiuni admin
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDateTime } from '../lib/utils';
import type { AuditLog } from '../types';

const ACTION_COLOR: Record<string, string> = {
  disable_user: 'badge-red', enable_flag: 'badge-green', disable_flag: 'badge-yellow',
  community_hide: 'badge-yellow', community_delete: 'badge-red', community_approve: 'badge-green',
  community_pin: 'badge-blue', update_flag_scope: 'badge-blue',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'), limit(200)));
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const uniqueActions = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  const filtered = logs.filter(l => {
    if (search && !(
      l.action?.includes(search) || l.adminEmail?.includes(search) ||
      l.targetType?.includes(search) || l.targetId?.includes(search)
    )) return false;
    if (actionFilter && l.action !== actionFilter) return false;
    if (dateFrom || dateTo) {
      const ts: Date | null = l.timestamp?.toDate ? l.timestamp.toDate() : (l.timestamp ? new Date(l.timestamp as string) : null);
      if (ts) {
        if (dateFrom && ts < new Date(dateFrom)) return false;
        if (dateTo && ts > new Date(dateTo + 'T23:59:59')) return false;
      }
    }
    return true;
  });

  const exportCSV = () => {
    const header = ['timestamp', 'adminEmail', 'action', 'targetType', 'targetId', 'reason'];
    const rows = filtered.map(l => {
      const ts: Date | null = l.timestamp?.toDate ? l.timestamp.toDate() : (l.timestamp ? new Date(l.timestamp as string) : null);
      return [
        ts ? ts.toISOString() : '',
        l.adminEmail || '',
        l.action || '',
        l.targetType || '',
        l.targetId || '',
        l.reason || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit_logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🔒 Audit & Security</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
          Toate acțiunile administratorilor sunt înregistrate. Ultimele 200 intrări.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          className="input" placeholder="🔍 Filtrează după acțiune, admin, tip..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300, height: 36 }}
        />
        <select className="input" value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ height: 36, width: 'auto' }}>
          <option value="">Toate acțiunile</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ height: 36, width: 'auto' }} title="De la dată" />
        <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ height: 36, width: 'auto' }} title="Până la dată" />
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇️ Export CSV</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data & Ora</th>
                <th>Admin</th>
                <th>Acțiune</th>
                <th>Tip țintă</th>
                <th>ID Țintă</th>
                <th>Motiv</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  {logs.length === 0 ? 'Nicio acțiune înregistrată încă.' : 'Niciun rezultat.'}
                </td></tr>
              ) : filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(log.timestamp)}
                  </td>
                  <td style={{ fontSize: 13 }}>{log.adminEmail}</td>
                  <td>
                    <span className={`badge ${ACTION_COLOR[log.action] || 'badge-gray'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{log.targetType}</td>
                  <td>
                    <code style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4 }}>
                      {log.targetId?.slice(0, 16)}…
                    </code>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 200 }}>
                    {log.reason || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
