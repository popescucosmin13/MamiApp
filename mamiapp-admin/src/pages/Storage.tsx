// src/pages/Storage.tsx
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DocRecord {
  id: string;
  userId: string;
  userEmail?: string;
  name: string;
  type: string;
  fileUrl?: string;
  size?: number;
  uploadedAt?: any;
}

export default function Storage() {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));

        // Aduce documentele în paralel (per utilizator și per copil), nu secvențial —
        // aceleași date, dar zeci de round-trip-uri simultane în loc de mii înlănțuite.
        const perUser = await Promise.all(usersSnap.docs.map(async (userDoc) => {
          const uid = userDoc.id;
          const userEmail = userDoc.data().email;
          const childrenSnap = await getDocs(collection(db, 'users', uid, 'children'))
            .catch(() => ({ docs: [] as any[] }));

          const childDocLists = await Promise.all(childrenSnap.docs.map(async (child) => {
            const docsSnap = await getDocs(collection(db, 'users', uid, 'children', child.id, 'documents'))
              .catch(() => ({ docs: [] as any[] }));
            return docsSnap.docs.map((d): DocRecord => {
              const data = d.data();
              return {
                id: d.id,
                userId: uid,
                userEmail,
                name: data.name || 'Document',
                type: data.type || 'other',
                fileUrl: data.fileUrl,
                size: data.size || 0,
                uploadedAt: data.uploadedAt,
              };
            });
          }));

          return childDocLists.flat();
        }));

        const allDocs: DocRecord[] = perUser.flat();
        const sizeTotal = allDocs.reduce((sum, d) => sum + (d.size || 0), 0);

        setDocs(allDocs.slice(0, 50));
        setTotalDocs(allDocs.length);
        setTotalSize(sizeTotal);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const typeColors: Record<string, string> = {
    birth_certificate: '#6366F1',
    vaccine_card: '#10B981',
    ultrasound: '#EC4899',
    analysis: '#F59E0B',
    prescription: '#8B5CF6',
    discharge_letter: '#3B82F6',
    other: '#6B7280',
  };

  const typeLabels: Record<string, string> = {
    birth_certificate: '📋 Certificate naștere',
    vaccine_card: '💉 Carnet vaccinuri',
    ultrasound: '🔬 Ecografie',
    analysis: '🧪 Analize',
    prescription: '💊 Rețetă',
    discharge_letter: '🏥 Scrisoare externare',
    other: '📄 Altele',
  };

  const byType: Record<string, number> = {};
  docs.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });

  return (
    <div style={{ padding: 24, maxWidth: 1200 }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>💾 Documente &amp; Storage</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
          Monitorizare documente medicale încărcate de utilizatori.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { icon: '📄', label: 'Total documente', val: totalDocs, color: '#6366F1' },
              { icon: '💽', label: 'Storage total', val: formatSize(totalSize), color: '#10B981' },
              { icon: '📊', label: 'Tipuri de fișiere', val: Object.keys(byType).length, color: '#F59E0B' },
              { icon: '📅', label: 'Afișate (max 50)', val: docs.length, color: '#8B5CF6' },
            ].map(k => (
              <div key={k.label} className="card">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: k.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>{k.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{typeof k.val === 'number' ? k.val.toLocaleString() : k.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, marginBottom: 24 }}>
            {/* Documents Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border)' }}>
                📋 Documente recente
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 380 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={th}>Nume</th>
                      <th style={th}>Tip</th>
                      <th style={th}>Utilizator</th>
                      <th style={th}>Mărime</th>
                      <th style={th}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                        Nu există documente încărcate.
                      </td></tr>
                    ) : docs.map((d, i) => (
                      <tr key={d.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                        <td style={{ ...td, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.name}
                        </td>
                        <td style={td}>
                          <span className="badge badge-blue" style={{ fontSize: 10 }}>{typeLabels[d.type] || d.type}</span>
                        </td>
                        <td style={{ ...td, fontSize: 11, color: 'var(--text3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.userEmail || d.userId.slice(0, 10) + '…'}
                        </td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{formatSize(d.size || 0)}</td>
                        <td style={{ ...td, fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {d.uploadedAt?.toDate ? d.uploadedAt.toDate().toLocaleDateString('ro-RO') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Type breakdown */}
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>📊 Pe tip de document</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const pct = totalDocs > 0 ? (count / totalDocs) * 100 : 0;
                  const color = typeColors[type] || '#6B7280';
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text2)', fontSize: 11 }}>{typeLabels[type] || type}</span>
                        <span style={{ fontWeight: 700, color }}>{count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border2)' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width .5s' }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(byType).length === 0 && (
                  <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nu există documente.</p>
                )}
              </div>

              <div style={{ marginTop: 20, padding: 14, background: 'rgba(239,68,68,0.05)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--danger)' }}>⚠️ Limite storage</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <div>• Free: max 5 documente</div>
                  <div>• Premium: nelimitat</div>
                  <div>• Max dimensiune fișier: 20 MB</div>
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
