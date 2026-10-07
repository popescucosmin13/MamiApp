// src/pages/AICenter.tsx
import { useEffect, useState } from 'react';
import { collection, collectionGroup, getDocs, query, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit, fmtRelative } from '../lib/utils';
import { useAdminStore } from '../store/adminStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PromptTemplate {
  id: string;
  key: string;
  name: string;
  version: number;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPromptTemplate: string;
  status: 'active' | 'test' | 'archived';
  updatedAt: any;
  updatedBy: string;
}

interface AILog {
  id: string;
  userId: string;
  type?: string;
  module?: string;
  tokensIn?: number;
  tokensOut?: number;
  requestTokens?: number;
  responseTokens?: number;
  costUsd?: number;
  cost?: number;
  model?: string;
  success?: boolean;
  createdAt: any;
  source?: 'logs' | 'usage';
  aiRequests?: number;
}

interface AIConversation {
  id: string;
  userId?: string;
  title?: string;
  preview?: string;
  context?: 'pregnancy' | 'child';
  messageCount?: number;
  lastMessageAt?: any;
  updatedAt?: any;
  messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: any }>;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayKey(date: Date) {
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
}

function last7Days() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return dayKey(date);
  });
}

function tokens(log: AILog) {
  return (log.tokensIn || log.requestTokens || 0) + (log.tokensOut || log.responseTokens || 0);
}

function cost(log: AILog) {
  if (typeof log.costUsd === 'number') return log.costUsd;
  if (typeof log.cost === 'number') return log.cost;
  const totalTokens = tokens(log);
  return totalTokens > 0 ? (totalTokens / 1000) * 0.003 : 0;
}

function compareLogDateDesc(a: AILog, b: AILog) {
  return (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0);
}

async function loadUsageDocsFallback(): Promise<AILog[]> {
  const usersSnap = await getDocs(query(collection(db, 'users'), limit(250)));
  const nested = await Promise.all(usersSnap.docs.map(async (userDoc) => {
    const usageSnap = await getDocs(collection(db, 'users', userDoc.id, 'usage'));
    return usageSnap.docs.map((usageDoc) => {
      const data = usageDoc.data();
      return {
        id: `${userDoc.id}-${usageDoc.id}`,
        userId: userDoc.id,
        type: 'assistant',
        module: 'usage',
        success: true,
        source: 'usage' as const,
        aiRequests: Number(data.aiRequests || 0),
        createdAt: data.lastUpdated || usageDoc.id,
      } as AILog;
    });
  }));
  return nested.flat().filter((entry) => (entry.aiRequests || 0) > 0).sort(compareLogDateDesc);
}

async function loadConversationFallback(): Promise<AIConversation[]> {
  const usersSnap = await getDocs(query(collection(db, 'users'), limit(250)));
  const nested = await Promise.all(usersSnap.docs.map(async (userDoc) => {
    const snap = await getDocs(query(
      collection(db, 'users', userDoc.id, 'ai_conversations'),
      orderBy('lastMessageAt', 'desc'),
      limit(20),
    ));
    return snap.docs.map((d) => ({
      id: d.id,
      userId: userDoc.id,
      ...d.data(),
    } as AIConversation));
  }));
  return nested.flat().sort((a, b) =>
    (toDate(b.lastMessageAt || b.updatedAt)?.getTime() || 0)
    - (toDate(a.lastMessageAt || a.updatedAt)?.getTime() || 0)
  ).slice(0, 80);
}

export default function AICenter() {
  const { adminUser } = useAdminStore();
  const [tab, setTab] = useState<'usage' | 'conversations' | 'prompts' | 'logs'>('usage');
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [logs, setLogs] = useState<AILog[]>([]);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null);
  const [usage, setUsage] = useState<Array<{ day: string; cost: number; requests: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadWarning(null);
      try {
        if (tab === 'prompts') {
          const snap = await getDocs(collection(db, 'aiPromptTemplates'));
          setPrompts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PromptTemplate)));
        } else if (tab === 'conversations') {
          try {
            const snap = await getDocs(query(collectionGroup(db, 'ai_conversations'), orderBy('lastMessageAt', 'desc'), limit(80)));
            setConversations(snap.docs.map(d => {
              const userRef = d.ref.parent.parent;
              return { id: d.id, userId: userRef?.id, ...d.data() } as AIConversation;
            }));
          } catch (err: any) {
            const fallback = await loadConversationFallback();
            setConversations(fallback);
            setLoadWarning(`Am folosit fallback pe utilizatori pentru conversații. Query-ul collectionGroup a eșuat: ${err?.message || err?.code || 'eroare necunoscută'}`);
          }
        } else {
          let data: AILog[] = [];
          try {
            const snap = await getDocs(query(collection(db, 'aiUsageLogs'), orderBy('createdAt', 'desc'), limit(tab === 'logs' ? 50 : 500)));
            data = snap.docs.map(d => ({ id: d.id, source: 'logs', ...d.data() } as AILog));
          } catch (err: any) {
            setLoadWarning(`Nu pot citi aiUsageLogs: ${err?.message || err?.code || 'eroare necunoscută'}. Afișez fallback din users/*/usage.`);
          }
          if (data.length === 0) {
            const fallback = await loadUsageDocsFallback();
            if (fallback.length > 0) {
              data = fallback;
              setLoadWarning((prev) => prev || 'Nu există documente în aiUsageLogs. Afișez cererile din users/*/usage; costurile exacte apar doar după ce funcția askAI scrie loguri.');
            }
          }
          setLogs(data);

          const buckets = Object.fromEntries(last7Days().map(day => [day, { day, cost: 0, requests: 0 }]));
          data.forEach(log => {
            const createdAt = toDate(log.createdAt);
            if (!createdAt) return;
            const key = dayKey(createdAt);
            if (!(key in buckets)) return;
            buckets[key].requests += log.source === 'usage' ? (log.aiRequests || 0) : 1;
            buckets[key].cost += cost(log);
          });
          setUsage(Object.values(buckets).map(day => ({ ...day, cost: Number(day.cost.toFixed(4)) })));
        }
      } catch (e) {
        console.error(e);
        setLoadWarning(e instanceof Error ? e.message : 'Nu am putut încărca datele AI.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab]);

  const savePrompt = async (p: PromptTemplate) => {
    await updateDoc(doc(db, 'aiPromptTemplates', p.id), {
      ...p, version: p.version + 1,
      updatedAt: serverTimestamp(), updatedBy: adminUser?.email,
    });
    await logAudit('update_prompt', 'ai_prompt', p.key, `Prompt ${p.key} actualizat la v${p.version + 1}`);
    setEditingPrompt(null);
    setPrompts(prev => prev.map(x => x.id === p.id ? { ...p, version: p.version + 1 } : x));
  };

  const tt = (props: any) => (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      {props.active && props.payload?.map((e: any, i: number) => (
        <div key={i} style={{ color: e.color }}>{e.name}: <strong>{e.value}</strong></div>
      ))}
    </div>
  );

  const totalCost = logs.reduce((sum, log) => sum + cost(log), 0);
  const totalRequests = logs.reduce((sum, log) => sum + (log.source === 'usage' ? (log.aiRequests || 0) : 1), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requestsToday = logs.filter(log => {
    const createdAt = toDate(log.createdAt);
    return createdAt && createdAt >= today;
  }).reduce((sum, log) => sum + (log.source === 'usage' ? (log.aiRequests || 0) : 1), 0);
  const avgCost = totalRequests > 0 ? totalCost / totalRequests : 0;

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>AI Center</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Monitorizare, prompturi și costuri AI din Firestore</p>
      </div>

      <div className="tabs" style={{ marginBottom: 20, width: 'fit-content' }}>
        {[{ key: 'usage', label: 'Usage & Costuri' }, { key: 'conversations', label: 'Conversatii' }, { key: 'prompts', label: 'Prompt Templates' }, { key: 'logs', label: 'Logs' }].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key as any)}>{t.label}</button>
        ))}
      </div>

      {loadWarning && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,158,11,.35)', background: 'rgba(245,158,11,.08)', color: 'var(--text2)', fontSize: 13 }}>
          {loadWarning}
        </div>
      )}

      {tab === 'usage' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Cost din loguri', value: `$${totalCost.toFixed(2)}`, color: '#F59E0B' },
              { label: logs.some(l => l.source === 'usage') ? 'Cereri din usage' : 'Cereri în loguri', value: totalRequests, color: '#6366F1' },
              { label: 'Cost mediu / cerere', value: `$${avgCost.toFixed(4)}`, color: '#10B981' },
              { label: 'Cereri azi', value: requestsToday, color: '#3B82F6' },
            ].map(c => (
              <div key={c.label} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 16 }}>Cost zilnic din loguri ($)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={usage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <Tooltip content={tt} />
                  <Bar dataKey="cost" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Cost $" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 16 }}>Cereri zilnice din loguri</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={usage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={tt} />
                  <Bar dataKey="requests" fill="#6366F1" radius={[4, 4, 0, 0]} name="Cereri" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === 'conversations' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Ultima activitate</th><th>Utilizator</th><th>Context</th><th>Titlu</th><th>Mesaje</th><th>Actiuni</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : conversations.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Nu exista conversatii AI salvate inca.</td></tr>
                ) : conversations.map(c => (
                  <tr key={`${c.userId}-${c.id}`}>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtRelative(c.lastMessageAt || c.updatedAt)}</td>
                    <td><code style={{ fontSize: 11 }}>{c.userId || 'necunoscut'}</code></td>
                    <td><span className="badge badge-purple">{c.context || 'child'}</span></td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.title || 'Conversatie AI'}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2, maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.preview || 'Fara previzualizare'}</div>
                    </td>
                    <td>{c.messageCount || c.messages?.length || 0}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setSelectedConversation(c)}>Vezi</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'prompts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>
            : prompts.length === 0 ? <div className="card" style={{ color: 'var(--text3)', fontSize: 13 }}>Nu există prompt templates în Firestore.</div>
            : prompts.map(p => (
              <div key={p.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                    <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, color: 'var(--text3)', fontFamily: 'monospace' }}>{p.key}</code>
                    <span className="badge badge-gray">v{p.version}</span>
                    <span className={`badge ${p.status === 'active' ? 'badge-green' : p.status === 'test' ? 'badge-yellow' : 'badge-gray'}`}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Model: <strong style={{ color: 'var(--text2)' }}>{p.model}</strong> · Temperatură: {p.temperature}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingPrompt({ ...p })}>Editează</button>
              </div>
            ))}
        </div>
      )}

      {tab === 'logs' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Data</th><th>Tip</th><th>Model</th><th>Tokeni</th><th>Cost</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Niciun log AI înregistrat.</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtRelative(l.createdAt)}</td>
                    <td><span className="badge badge-purple">{l.type || l.module || 'assistant'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{l.model || '—'}</td>
                    <td style={{ fontSize: 13 }}>{l.source === 'usage' ? `${l.aiRequests} cereri` : tokens(l).toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: 'var(--warning)' }}>${cost(l).toFixed(4)}</td>
                    <td><span className={`badge ${l.success === false ? 'badge-red' : 'badge-green'}`}>{l.success === false ? 'Eșuat' : 'OK'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingPrompt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Editează Prompt — {editingPrompt.name}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingPrompt(null)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Model</label>
                  <input className="input" value={editingPrompt.model} onChange={e => setEditingPrompt(p => p ? ({ ...p, model: e.target.value }) : null)} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select className="input" value={editingPrompt.status} onChange={e => setEditingPrompt(p => p ? ({ ...p, status: e.target.value as PromptTemplate['status'] }) : null)}>
                    <option value="active">Activ</option>
                    <option value="test">Test</option>
                    <option value="archived">Arhivat</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Temperatură</label>
                  <input type="number" className="input" min={0} max={1} step={0.1} value={editingPrompt.temperature} onChange={e => setEditingPrompt(p => p ? ({ ...p, temperature: Number(e.target.value) }) : null)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>System Prompt</label>
                <textarea className="input" style={{ height: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={editingPrompt.systemPrompt} onChange={e => setEditingPrompt(p => p ? ({ ...p, systemPrompt: e.target.value }) : null)} />
              </div>
              <div>
                <label style={labelStyle}>User Prompt Template</label>
                <textarea className="input" style={{ height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={editingPrompt.userPromptTemplate} onChange={e => setEditingPrompt(p => p ? ({ ...p, userPromptTemplate: e.target.value }) : null)} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setEditingPrompt(null)}>Anulează</button>
                <button className="btn btn-primary" onClick={() => savePrompt(editingPrompt)}>Salvează v{editingPrompt.version + 1}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedConversation && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
              <div>
                <h2 className="modal-title" style={{ marginBottom: 4 }}>{selectedConversation.title || 'Conversatie AI'}</h2>
                <p style={{ color: 'var(--text3)', fontSize: 12 }}>
                  User: {selectedConversation.userId || 'necunoscut'} - {selectedConversation.messageCount || selectedConversation.messages?.length || 0} mesaje
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedConversation(null)}>Inchide</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflow: 'auto' }}>
              {(selectedConversation.messages || []).map((message, index) => (
                <div key={index} style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  background: message.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
                  color: message.role === 'user' ? '#fff' : 'var(--text)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}>
                  <div style={{ fontWeight: 800, fontSize: 11, opacity: 0.75, marginBottom: 4 }}>{message.role === 'user' ? 'Utilizator' : 'Asistent'}</div>
                  {message.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  display: 'block',
  marginBottom: 4,
};
