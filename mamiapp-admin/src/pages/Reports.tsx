// src/pages/Reports.tsx
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

interface AiLog {
  id: string;
  userId: string;
  userEmail?: string;
  prompt?: string;
  responseTokens?: number;
  requestTokens?: number;
  model?: string;
  createdAt?: any;
  cost?: number;
  module?: string;
}

export default function Reports() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [todayRequests, setTodayRequests] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'aiUsageLogs'), orderBy('createdAt', 'desc'), limit(100))
        );
        const logsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as AiLog));
        setLogs(logsData);
        setTotalRequests(logsData.length);

        let cost = 0;
        let todayCount = 0;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        for (const log of logsData) {
          const tokens = (log.requestTokens || 0) + (log.responseTokens || 0);
          const logCost = log.cost ?? (tokens / 1000) * 0.003;
          cost += logCost;

          if (log.createdAt?.toDate) {
            const d = log.createdAt.toDate();
            if (d >= todayStart) todayCount++;
          }
        }

        setTotalCost(cost);
        setTodayRequests(todayCount);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const moduleStats: Record<string, number> = {};
  logs.forEach(l => {
    const mod = l.module || 'assistant';
    moduleStats[mod] = (moduleStats[mod] || 0) + 1;
  });

  return (
    <div style={{ padding: 24, maxWidth: 1200 }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>📋 Rapoarte AI &amp; Usage Logs</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
          Istoricul cererilor AI, costuri din loguri și distribuție pe module.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { icon: '🤖', label: 'Cereri totale (100 recente)', val: totalRequests, color: '#8B5CF6' },
              { icon: '💰', label: 'Cost total din loguri', val: `$${totalCost.toFixed(2)}`, color: '#F59E0B' },
              { icon: '📅', label: 'Cereri azi', val: todayRequests, color: '#10B981' },
              { icon: '📊', label: 'Module AI active', val: Object.keys(moduleStats).length, color: '#6366F1' },
            ].map(k => (
              <div key={k.label} className="card">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: k.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>{k.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{typeof k.val === 'number' ? k.val.toLocaleString() : k.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, marginBottom: 24 }}>
            {/* Log table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border)' }}>
                🕐 Ultimele cereri AI
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={th}>Utilizator</th>
                      <th style={th}>Modul</th>
                      <th style={th}>Tokeni</th>
                      <th style={th}>Cost</th>
                      <th style={th}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                        Nu există loguri AI înregistrate.
                      </td></tr>
                    ) : logs.map((l, i) => {
                      const tokens = (l.requestTokens || 0) + (l.responseTokens || 0);
                      const cost = l.cost ?? (tokens / 1000) * 0.003;
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                          <td style={{ ...td, fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.userEmail || l.userId?.slice(0, 10) + '…'}
                          </td>
                          <td style={td}><span className="badge badge-purple">{l.module || 'assistant'}</span></td>
                          <td style={{ ...td, fontSize: 12 }}>{tokens.toLocaleString()}</td>
                          <td style={{ ...td, fontSize: 12, color: cost > 0.01 ? 'var(--warning)' : 'var(--text3)' }}>${cost.toFixed(4)}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                            {l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Module breakdown */}
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>📱 Distribuție pe module</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(moduleStats).sort((a, b) => b[1] - a[1]).map(([mod, count]) => {
                  const pct = totalRequests > 0 ? (count / totalRequests) * 100 : 0;
                  return (
                    <div key={mod}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text2)' }}>{mod}</span>
                        <span style={{ fontWeight: 700 }}>{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border2)' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: '#8B5CF6', transition: 'width .5s' }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(moduleStats).length === 0 && (
                  <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nu există date.</p>
                )}
              </div>

              <div style={{ marginTop: 20, padding: 14, background: 'var(--surface2)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>💡 Rate Limiting</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <div>• Free: 50 req/zi</div>
                  <div>• Premium: 500 req/zi</div>
                  <div>• Resetare: Zilnic la 00:00</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: 'var(--text)' };
