// src/pages/Community.tsx — Moderare postări + raportări
import { useEffect, useState, useCallback } from 'react';
import { confirmDialog } from "../lib/confirm";
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit, fmtRelative, fmtDate } from '../lib/utils';
import type { CommunityPost } from '../types';

const TABS = [
  { key: 'all', label: '📋 Toate' },
  { key: 'review', label: '⚠️ De revizuit' },
  { key: 'reported', label: '🚩 Raportate' },
  { key: 'hidden', label: '🙈 Ascunse' },
];

const RISK_KEYWORDS = [
  'antibiotic', 'doza', 'doza dubla', 'vaccin nu', 'nu vaccin', 'covid fals',
  'tratament natural', 'medic prost', 'diagnostic', 'reteta',
];

function riskScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  RISK_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 20; });
  return Math.min(score, 100);
}

function RiskBadge({ score }: { score: number }) {
  if (score === 0) return <span className="badge badge-green">✅ OK</span>;
  if (score < 40) return <span className="badge badge-yellow">⚠️ Risc scăzut</span>;
  return <span className="badge badge-red">🚨 Risc ridicat</span>;
}

export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CommunityPost | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'), limit(100));
      if (tab === 'review') q = query(collection(db, 'community_posts'), where('status', '==', 'review'), orderBy('createdAt', 'desc'));
      if (tab === 'hidden') q = query(collection(db, 'community_posts'), where('status', '==', 'hidden'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        status: (d.data().status || 'published') as CommunityPost['status'],
        reportCount: d.data().reportCount || 0,
        aiModerationScore: riskScore((d.data().title || '') + ' ' + (d.data().content || '')),
      } as CommunityPost));
      if (tab === 'reported') data = data.filter(p => (p.reportCount ?? 0) > 0);
      setPosts(data);
    } catch { }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const action = async (post: CommunityPost, act: 'hide' | 'delete' | 'approve' | 'pin') => {
    const ref = doc(db, 'community_posts', post.id);
    if (act === 'delete') {
      if (!(await confirmDialog({ title: 'Ștergi definitiv această postare?' }))) return;
      await deleteDoc(ref);
    } else if (act === 'hide') {
      await updateDoc(ref, { status: 'hidden' });
    } else if (act === 'approve') {
      await updateDoc(ref, { status: 'published', reportCount: 0 });
    } else if (act === 'pin') {
      await updateDoc(ref, { isPinned: !post.isPinned });
    }
    await logAudit(`community_${act}`, 'post', post.id, actionReason || undefined);
    setSelected(null);
    setActionReason('');
    load();
  };

  const uniqueCategories = Array.from(new Set(posts.map(p => p.category).filter(Boolean)));

  const displayedPosts = posts.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!(p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q) || p.authorName?.toLowerCase().includes(q))) return false;
    }
    if (categoryFilter && p.category !== categoryFilter) return false;
    return true;
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    hidden: posts.filter(p => p.status === 'hidden').length,
    review: posts.filter(p => p.status === 'review').length,
    reported: posts.filter(p => (p.reportCount ?? 0) > 0).length,
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>💬 Moderare Comunitate</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>{posts.length} postări</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => load()}>🔄 Reîncarcă</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Total', val: stats.total, color: '#6366F1' },
          { label: 'Publicate', val: stats.published, color: '#10B981' },
          { label: 'Ascunse', val: stats.hidden, color: '#6B7280' },
          { label: 'De revizuit', val: stats.review, color: '#F59E0B' },
          { label: 'Raportate', val: stats.reported, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs" style={{ marginBottom: 12, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + Category filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="input" placeholder="🔍 Caută după titlu, conținut, autor..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300, height: 36 }}
        />
        <select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ height: 36, width: 'auto' }}>
          <option value="">Toate categoriile</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Autor</th>
                <th>Titlu</th>
                <th>Categorie</th>
                <th>Data</th>
                <th>Raportări</th>
                <th>Risc AI</th>
                <th>Status</th>
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : displayedPosts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  Nicio postare în această categorie.
                </td></tr>
              ) : displayedPosts.map(post => (
                <tr key={post.id}>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {post.isAnonymous ? '👤 Anonim' : post.authorName}
                    </div>
                    {post.isVerifiedSpecialist && (
                      <span className="badge badge-green" style={{ marginTop: 2 }}>✓ Specialist</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }} className="truncate">{post.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }} className="truncate">{post.content}</div>
                  </td>
                  <td><span className="badge badge-blue">{post.category}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtRelative(post.createdAt)}</td>
                  <td>
                    {(post.reportCount ?? 0) > 0 ? (
                      <span className="badge badge-red">🚩 {post.reportCount}</span>
                    ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>0</span>}
                  </td>
                  <td><RiskBadge score={post.aiModerationScore ?? 0} /></td>
                  <td>
                    <span className={`badge ${post.status === 'published' ? 'badge-green' : post.status === 'hidden' ? 'badge-gray' : 'badge-yellow'}`}>
                      {post.status}
                    </span>
                    {post.isPinned && <span className="badge badge-purple" style={{ marginLeft: 4 }}>📌</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(post)}>👁</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setActionReason(''); } }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>📝 Detalii Postare</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setActionReason(''); }}>✕</button>
            </div>

            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{selected.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>{selected.content}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>👤 {selected.isAnonymous ? 'Anonim' : selected.authorName}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>📅 {fmtDate(selected.createdAt)}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>❤️ {selected.likesCount} | 💬 {selected.commentsCount}</span>
              </div>
            </div>

            {(selected.aiModerationScore ?? 0) > 0 && (
              <div style={{
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
                borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16,
              }}>
                🤖 <strong>AI Moderare:</strong> Conținut potențial problematic detectat (scor {selected.aiModerationScore}/100).
                Verifică înainte de a aproba.
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Motiv acțiune (obligatoriu pentru audit)
              </label>
              <input
                className="input"
                placeholder="ex: Conținut medical periculos, limbaj toxic..."
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-success btn-sm" onClick={() => action(selected, 'approve')}>✅ Aprobă</button>
              <button className="btn btn-ghost btn-sm" onClick={() => action(selected, 'pin')}>
                {selected.isPinned ? '📌 Desprinde' : '📌 Fixează'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => action(selected, 'hide')}>🙈 Ascunde</button>
              <button className="btn btn-danger btn-sm" onClick={() => action(selected, 'delete')}>🗑️ Șterge definitiv</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
