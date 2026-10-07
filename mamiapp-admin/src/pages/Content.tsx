// src/pages/Content.tsx
import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, getCountFromServer } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import { toast } from '../lib/toast';
import { logAudit } from '../lib/utils';
import { useAdminStore } from '../store/adminStore';

interface Article {
  id: string;
  title: string;
  category: string;
  week?: number;
  ageMin?: number;
  ageMax?: number;
  isPremium: boolean;
  published?: boolean;
  createdAt?: any;
  body?: string;
  contentType?: 'markdown' | 'html';
  coverImage?: string;
  videoUrl?: string;
}

// ─── Preview articol (mimic exact al ecranului din aplicație) ─────────────────

const PREVIEW_CATEGORY_META: Record<string, { emoji: string; label: string; gradient: [string, string] }> = {
  pregnancy: { emoji: '🌸', label: 'Sarcină',  gradient: ['#E8A8BF', '#C4708F'] },
  child:     { emoji: '👶', label: 'Copil',    gradient: ['#F0B294', '#D07B55'] },
  nutrition: { emoji: '🥗', label: 'Nutriție', gradient: ['#96BCA9', '#5E8272'] },
  wellbeing: { emoji: '💜', label: 'Wellbeing',gradient: ['#B698C2', '#7E5C8C'] },
};

function getYouTubeIdAdmin(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?\S*?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function previewReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function renderVideoEmbedHtml(url: string): string {
  const yt = getYouTubeIdAdmin(url);
  if (yt) {
    return `<div style="position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;margin:14px 0;">
      <iframe src="https://www.youtube.com/embed/${yt}" style="width:100%;height:100%;border:0;" allowfullscreen></iframe>
    </div>`;
  }
  return `<video src="${escapeHtml(url)}" controls playsinline style="width:100%;aspect-ratio:16/9;border-radius:16px;background:#000;margin:14px 0;display:block;"></video>`;
}

function parseInlineMd(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Reproduce exact regulile din ArticleBody (app): #, ##, listă (- și 1.), citate (>),
 * separator (---), **bold**, imagini cu legendă, video inline. Grupează liniile
 * consecutive de listă/citat într-un singur bloc vizual, la fel ca în aplicație.
 */
function markdownBodyToHtml(body: string, accentColor: string): string {
  const lines = body.split('\n');
  let html = '';
  let openList: 'ul' | 'ol' | null = null;
  let orderedIndex = 0;
  let inQuote = false;
  let leadUsed = false;
  const closeList = () => { if (openList) { html += `</${openList}>`; openList = null; } };
  const closeQuote = () => { if (inQuote) { html += '</div></div>'; inQuote = false; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      closeList(); closeQuote();
      html += `<div style="margin:14px 0;">
        <img src="${escapeHtml(imgMatch[2])}" style="width:100%;border-radius:16px;display:block;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,.08);" />
        ${imgMatch[1] ? `<div style="font-size:12px;font-style:italic;color:#A0938A;text-align:center;margin-top:6px;">${escapeHtml(imgMatch[1])}</div>` : ''}
      </div>`;
      continue;
    }
    const videoMatch = line.match(/^!video\(([^)]+)\)$/);
    if (videoMatch) {
      closeList(); closeQuote();
      html += renderVideoEmbedHtml(videoMatch[1]);
      continue;
    }
    if (/^-{3,}$|^\*{3,}$/.test(line)) {
      closeList(); closeQuote();
      html += `<div style="height:1px;background:#EEE0D6;margin:18px 0;"></div>`;
      continue;
    }
    if (line.startsWith('## ')) {
      closeList(); closeQuote();
      html += `<h2 style="font-size:17px;font-weight:700;margin:20px 0 6px;padding-left:10px;border-left:4px solid ${accentColor};color:#2A2320;">${parseInlineMd(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith('# ')) {
      closeList(); closeQuote();
      html += `<h1 style="font-size:21px;font-weight:700;margin:20px 0 8px;color:#2A2320;font-family:Georgia,serif;">${parseInlineMd(line.slice(2))}</h1>`;
      continue;
    }
    if (line.startsWith('> ')) {
      closeList();
      if (!inQuote) {
        html += `<div style="display:flex;gap:8px;align-items:flex-start;border-left:3px solid ${accentColor};background:${accentColor}12;border-radius:10px;padding:12px 14px;margin:14px 0;">
          <div style="font-family:Georgia,serif;font-size:26px;line-height:26px;color:${accentColor};">”</div>
          <div style="display:flex;flex-direction:column;gap:4px;">`;
        inQuote = true;
      }
      html += `<div style="font-size:15px;line-height:1.55;color:#2A2320;font-style:italic;">${parseInlineMd(line.slice(2))}</div>`;
      continue;
    }
    closeQuote();
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (openList !== 'ol') { closeList(); html += '<ol style="margin:10px 0;padding-left:0;list-style:none;">'; openList = 'ol'; orderedIndex = 0; }
      orderedIndex += 1;
      html += `<li style="margin-bottom:10px;line-height:1.6;color:#4A4038;display:flex;gap:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:22px;height:22px;border-radius:11px;background:${accentColor};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px;">${orderedIndex}</span>
        <span>${parseInlineMd(orderedMatch[1])}</span>
      </li>`;
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      if (openList !== 'ul') { closeList(); html += '<ul style="margin:10px 0;padding-left:20px;">'; openList = 'ul'; }
      html += `<li style="margin-bottom:8px;line-height:1.6;color:#4A4038;">${parseInlineMd(line.slice(2))}</li>`;
      continue;
    }
    closeList();
    const isLead = !leadUsed;
    leadUsed = true;
    html += isLead
      ? `<p style="margin:0 0 14px;line-height:1.6;color:#2A2320;font-size:17px;">${parseInlineMd(line)}</p>`
      : `<p style="margin:0 0 14px;line-height:1.65;color:#4A4038;font-size:14.5px;">${parseInlineMd(line)}</p>`;
  }
  closeList(); closeQuote();
  return html;
}

function buildArticlePreviewHtml(input: {
  title: string; category: string; body: string; contentType: 'markdown' | 'html';
  coverImage: string; videoUrl: string; isPremium: boolean;
}): string {
  const meta = PREVIEW_CATEGORY_META[input.category] || PREVIEW_CATEGORY_META.child;
  const accent = meta.gradient[1];
  const bodyHtml = input.contentType === 'html' ? input.body : markdownBodyToHtml(input.body, accent);
  const readMin = previewReadingMinutes(input.body.replace(/<[^>]*>/g, ' '));

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #F1E9E4; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
</style>
</head>
<body>
  <div style="max-width:390px;margin:0 auto;background:#FDF6F0;min-height:100vh;">
    <div style="position:relative;height:220px;overflow:hidden;">
      ${input.coverImage
        ? `<img src="${escapeHtml(input.coverImage)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />`
        : `<div style="position:absolute;inset:0;background:linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]});"></div>
           <div style="position:absolute;right:-10px;bottom:-24px;font-size:140px;opacity:.28;">${meta.emoji}</div>`}
      <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,.3), transparent 35%, transparent 55%, rgba(0,0,0,.78));"></div>
      <div style="position:absolute;left:20px;right:20px;bottom:20px;">
        <div style="display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.45);border-radius:14px;padding:4px 12px;margin-bottom:10px;">
          <span style="font-size:10px;font-weight:700;color:#fff;letter-spacing:1.5px;">${meta.emoji} ${meta.label.toUpperCase()}</span>
        </div>
        <div style="font-size:25px;font-weight:700;color:#fff;line-height:1.28;font-family:Georgia,serif;">${escapeHtml(input.title || 'Titlul articolului')}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.88);margin-top:10px;">
          ⏱ ${readMin} min de citit${input.isPremium ? ' · 💎 Premium' : ''}
        </div>
      </div>
    </div>
    <div style="margin-top:-28px;border-radius:28px 28px 0 0;background:#FDF6F0;padding:20px 20px 40px;position:relative;">
      <div style="height:1px;background:#EEE0D6;margin:8px 0 18px;"></div>
      ${input.videoUrl ? renderVideoEmbedHtml(input.videoUrl) : ''}
      ${bodyHtml || '<p style="color:#B0A296;font-style:italic;">Conținutul articolului va apărea aici...</p>'}
    </div>
  </div>
</body></html>`;
}

const ARTICLE_BASE_URL = 'https://example.com/modules/articles';

const DISTRIBUTE_AUDIENCES = [
  { key: 'all', label: '🌐 Toți utilizatorii' },
  { key: 'pregnancy', label: '🌸 Mame însărcinate' },
  { key: 'child', label: '👶 Profil copil' },
  { key: 'premium', label: '💎 Doar premium' },
];

function articlePlainExcerpt(body: string | undefined, maxLen = 260): string {
  if (!body) return '';
  const plain = body
    .replace(/<[^>]*>/g, ' ')          // scoate tagurile HTML (articole contentType: 'html')
    .replace(/^#+\s*/gm, '')           // titluri markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // imagini markdown ![alt](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // linkuri markdown → păstrează textul
    .replace(/[*_>`#]/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trimEnd()}…` : plain;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Același șablon vizual ca emailurile automate din Cloud Functions. */
function buildArticleEmailHtml(input: { title: string; excerpt: string; url: string }): string {
  const paragraphs = input.excerpt
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;">${escapeHtml(p.trim())}</p>`)
    .join('');
  return `
  <div style="background:#FAF6F2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;">
      <div style="text-align:center;font-size:28px;margin-bottom:4px;">🌸</div>
      <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#B96F87;font-weight:bold;margin-bottom:18px;">MAMIAPP</div>
      <h1 style="font-size:20px;color:#3D3436;text-align:center;margin:0 0 16px;">${escapeHtml(input.title)}</h1>
      <div style="font-size:14px;line-height:1.7;color:#5C5254;">${paragraphs}</div>
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#E8997A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 32px;border-radius:12px;">Citește mai mult în MamiApp →</a>
      </div>
    </div>
  </div>`;
}

type Category = 'pregnancy' | 'child' | 'nutrition' | 'wellbeing' | 'all';

const EMPTY_ARTICLE_FORM = {
  title: '', category: 'pregnancy', week: '', ageMin: '', ageMax: '',
  isPremium: false, published: true, body: '', coverImage: '', videoUrl: '',
  contentType: 'markdown' as 'markdown' | 'html',
};

const CATEGORIES = [
  { key: 'all', label: '📋 Toate' },
  { key: 'pregnancy', label: '🌸 Sarcină' },
  { key: 'child', label: '👶 Copil' },
  { key: 'nutrition', label: '🥗 Nutriție' },
  { key: 'wellbeing', label: '💆 Wellbeing' },
];

export default function Content() {
  const { adminUser } = useAdminStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<Category>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [form, setForm] = useState(EMPTY_ARTICLE_FORM);
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);
  const bodyVideoInputRef = useRef<HTMLInputElement>(null);

  // ── Preview articol ──
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const openPreviewForForm = () => setPreviewHtml(buildArticlePreviewHtml({
    title: form.title, category: form.category, body: form.body, contentType: form.contentType,
    coverImage: form.coverImage, videoUrl: form.videoUrl, isPremium: form.isPremium,
  }));
  const openPreviewForArticle = (a: Article) => setPreviewHtml(buildArticlePreviewHtml({
    title: a.title, category: a.category, body: a.body || '', contentType: a.contentType || 'markdown',
    coverImage: a.coverImage || '', videoUrl: a.videoUrl || '', isPremium: a.isPremium,
  }));

  // ── Distribuție (email + social) ──
  const [distributing, setDistributing] = useState<Article | null>(null);
  const [distSubject, setDistSubject] = useState('');
  const [distExcerpt, setDistExcerpt] = useState('');
  const [distAudience, setDistAudience] = useState('all');
  const [distSending, setDistSending] = useState(false);

  const openDistribute = (article: Article) => {
    setDistributing(article);
    setDistSubject(article.title);
    setDistExcerpt(articlePlainExcerpt(article.body));
    setDistAudience(article.category === 'pregnancy' ? 'pregnancy' : article.category === 'child' ? 'child' : 'all');
  };

  const articleUrl = (article: Article) => `${ARTICLE_BASE_URL}/${article.id}`;

  const copyToClipboard = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Nu am putut copia. Selectează manual textul.');
    }
  };

  const sendArticleEmail = async () => {
    if (!distributing) return;
    if (!distSubject.trim() || !distExcerpt.trim()) {
      toast.warning('Completează subiectul și fragmentul.');
      return;
    }
    setDistSending(true);
    try {
      const html = buildArticleEmailHtml({
        title: distributing.title,
        excerpt: distExcerpt.trim(),
        url: articleUrl(distributing),
      });
      // Reutilizăm fluxul de campanii email — campania apare în istoricul
      // din pagina Notificări, cu contoare de trimitere
      const campaignRef = doc(collection(db, 'emailCampaigns'));
      await setDoc(campaignRef, {
        subject: distSubject.trim(),
        htmlBody: html,
        targetAudience: distAudience,
        status: 'draft',
        sourceArticleId: distributing.id,
        createdBy: adminUser?.email || '',
        createdAt: serverTimestamp(),
      });
      const sendCampaign = httpsCallable<{ campaignId: string }, { sentCount: number; failedCount: number }>(
        functions, 'sendEmailCampaign'
      );
      const result = await sendCampaign({ campaignId: campaignRef.id });
      await logAudit('send_article_email', 'article', distributing.id, `Email articol: ${result.data.sentCount} trimise`).catch(() => {});
      toast.success(`✅ Email trimis: ${result.data.sentCount} destinatari${result.data.failedCount ? `, ${result.data.failedCount} eșuate` : ''}.`);
      setDistributing(null);
    } catch (e) {
      console.error('sendArticleEmail error:', e);
      toast.error('Eroare la trimitere. Verifică funcția sendEmailCampaign.');
    }
    setDistSending(false);
  };

  const [readerCounts, setReaderCounts] = useState<Record<string, number>>({});
  const [readerCountsLoading, setReaderCountsLoading] = useState(false);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'articles'));
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
      setArticles(loaded);
      loadReaderCounts(loaded);
    } finally {
      setLoading(false);
    }
  };

  /** Câți cititori unici are fiecare articol — agregare Firestore (getCountFromServer), fără să citească documentele. */
  const loadReaderCounts = async (list: Article[]) => {
    setReaderCountsLoading(true);
    try {
      const entries = await Promise.all(list.map(async (a) => {
        try {
          const snap = await getCountFromServer(collection(db, 'articles', a.id, 'reads'));
          return [a.id, snap.data().count] as const;
        } catch {
          return [a.id, 0] as const;
        }
      }));
      setReaderCounts(Object.fromEntries(entries));
    } finally {
      setReaderCountsLoading(false);
    }
  };

  useEffect(() => { loadArticles(); }, []);

  /** Încarcă un fișier în Storage la articles/ și returnează URL-ul public. */
  const uploadArticleFile = async (file: File): Promise<string> => {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const fileRef = storageRef(storage, `articles/${Date.now()}-${safeName}`);
    await uploadBytes(fileRef, file, { contentType: file.type });
    return getDownloadURL(fileRef);
  };

  const handleCoverSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadArticleFile(file);
      setForm(f => ({ ...f, coverImage: url }));
      toast.success('Copertă încărcată.');
    } catch (e) {
      console.error('cover upload error:', e);
      toast.error('Eroare la încărcarea coperții.');
    }
    setUploading(false);
  };

  const handleInsertMedia = async (file: File | undefined, kind: 'image' | 'video') => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadArticleFile(file);
      const snippet = form.contentType === 'html'
        ? (kind === 'image' ? `<img src="${url}" alt="" style="width:100%;border-radius:16px;" />` : `<video src="${url}" controls style="width:100%;border-radius:16px;"></video>`)
        : (kind === 'image' ? `![imagine](${url})` : `!video(${url})`);
      setForm(f => ({ ...f, body: `${f.body.trimEnd()}\n\n${snippet}\n` }));
      toast.success(kind === 'image' ? 'Imagine inserată în conținut.' : 'Video inserat în conținut.');
    } catch (e) {
      console.error('media upload error:', e);
      toast.error('Eroare la încărcare.');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.category) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        isPremium: form.isPremium,
        published: form.published,
        body: form.body,
        contentType: form.contentType,
        coverImage: form.coverImage,
        videoUrl: form.videoUrl.trim(),
        ...(form.week ? { week: Number(form.week) } : {}),
        ...(form.ageMin ? { ageMin: Number(form.ageMin) } : {}),
        ...(form.ageMax ? { ageMax: Number(form.ageMax) } : {}),
      };
      if (editingArticle) {
        await updateDoc(doc(db, 'articles', editingArticle.id), payload);
      } else {
        await addDoc(collection(db, 'articles'), { ...payload, createdAt: serverTimestamp() });
      }
      setShowForm(false);
      setEditingArticle(null);
      setForm(EMPTY_ARTICLE_FORM);
      await loadArticles();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (a: Article) => {
    setEditingArticle(a);
    setForm({
      title: a.title,
      category: a.category,
      week: a.week != null ? String(a.week) : '',
      ageMin: a.ageMin != null ? String(a.ageMin) : '',
      ageMax: a.ageMax != null ? String(a.ageMax) : '',
      isPremium: a.isPremium,
      published: a.published !== false,
      body: a.body || '',
      contentType: a.contentType || 'markdown',
      coverImage: a.coverImage || '',
      videoUrl: a.videoUrl || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ștergi articolul?')) return;
    await deleteDoc(doc(db, 'articles', id));
    await loadArticles();
  };

  const filtered = catFilter === 'all' ? articles : articles.filter(a => a.category === catFilter);

  return (
    <div style={{ padding: 24, maxWidth: 1200 }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>📝 Management Conținut</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
            Articole, ghiduri, conținut mapat pe săptămâni sarcină și vârstă copil.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingArticle(null); setForm(EMPTY_ARTICLE_FORM); setShowForm(true); }}>＋ Articol nou</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total articole', val: articles.length, color: '#6366F1', icon: '📄' },
          { label: 'Premium', val: articles.filter(a => a.isPremium).length, color: '#F59E0B', icon: '💎' },
          { label: 'Gratuite', val: articles.filter(a => !a.isPremium).length, color: '#10B981', icon: '✅' },
          { label: 'Sarcină', val: articles.filter(a => a.category === 'pregnancy').length, color: '#EC4899', icon: '🌸' },
          { label: 'Copil', val: articles.filter(a => a.category === 'child').length, color: '#8B5CF6', icon: '👶' },
          {
            label: 'Cititori unici (total)',
            val: readerCountsLoading ? '…' : Object.values(readerCounts).reduce((s, n) => s + n, 0),
            color: '#0EA5E9', icon: '👥',
          },
        ].map(k => (
          <div key={k.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: k.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCatFilter(c.key as Category)}
            className={catFilter === c.key ? 'btn btn-primary' : 'btn'}
            style={{ fontSize: 12 }}>{c.label}
          </button>
        ))}
      </div>

      {/* Articles Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Titlu</th>
                <th style={th}>Categorie</th>
                <th style={th}>Target</th>
                <th style={th}>Acces</th>
                <th style={th}>👥 Cititori</th>
                <th style={th}>Data</th>
                <th style={th}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                  Nu există articole. Apasă "Articol nou" pentru a adăuga.
                </td></tr>
              ) : filtered.map((a, i) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                  <td style={{ ...td, fontWeight: 600, maxWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {a.coverImage ? (
                        <img src={a.coverImage} alt="" style={{ width: 44, height: 30, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 30, borderRadius: 6, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>📄</div>
                      )}
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.title}
                        {a.videoUrl ? <span title="Are video" style={{ marginLeft: 6 }}>🎬</span> : null}
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <span className={`badge ${a.category === 'pregnancy' ? 'badge-pink' : a.category === 'child' ? 'badge-purple' : 'badge-gray'}`}>
                      {a.category}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: 'var(--text3)' }}>
                    {a.week ? `Săpt. ${a.week}` : a.ageMin != null ? `${a.ageMin}–${a.ageMax} luni` : 'General'}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span className={`badge ${a.isPremium ? 'badge-yellow' : 'badge-green'}`}>
                        {a.isPremium ? '💎 Premium' : '✅ Gratuit'}
                      </span>
                      {a.published === false && <span className="badge badge-gray">Nepublicat</span>}
                    </div>
                  </td>
                  <td style={td}>
                    {readerCountsLoading && readerCounts[a.id] === undefined ? (
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    ) : (
                      <span style={{ fontWeight: 700, color: (readerCounts[a.id] || 0) > 0 ? 'var(--text)' : 'var(--text3)' }}>
                        {readerCounts[a.id] || 0}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: 'var(--text3)' }}>
                    {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('ro-RO') : '—'}
                  </td>
                  <td style={{ ...td, display: 'flex', gap: 6 }}>
                    <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => openPreviewForArticle(a)}>👁️ Preview</button>
                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => openDistribute(a)}>📣 Distribuie</button>
                    <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => handleEdit(a)}>Editează</button>
                    <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={() => handleDelete(a.id)}>Șterge</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 540, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700 }}>{editingArticle ? '✏️ Editează articol' : '📝 Articol nou'}</h3>
              <button className="btn" style={{ fontSize: 12 }} onClick={openPreviewForForm}>👁️ Preview</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>Titlu *</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titlul articolului" /></div>
              <div><label style={lbl}>Categorie *</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="pregnancy">Sarcină</option>
                  <option value="child">Copil</option>
                  <option value="nutrition">Nutriție</option>
                  <option value="wellbeing">Wellbeing</option>
                </select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Săptămână</label>
                  <input className="input" type="number" value={form.week} onChange={e => setForm({ ...form, week: e.target.value })} placeholder="ex: 12" /></div>
                <div><label style={lbl}>Vârstă min (luni)</label>
                  <input className="input" type="number" value={form.ageMin} onChange={e => setForm({ ...form, ageMin: e.target.value })} /></div>
                <div><label style={lbl}>Vârstă max (luni)</label>
                  <input className="input" type="number" value={form.ageMax} onChange={e => setForm({ ...form, ageMax: e.target.value })} /></div>
              </div>
              {/* Copertă articol */}
              <div>
                <label style={lbl}>Imagine copertă (apare pe card și în articol)</label>
                {form.coverImage ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={form.coverImage} alt="Copertă" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => coverInputRef.current?.click()} disabled={uploading}>🔄 Schimbă</button>
                      <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setForm({ ...form, coverImage: '' })}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn" style={{ width: '100%', padding: '18px 0', borderStyle: 'dashed' }}
                    onClick={() => coverInputRef.current?.click()} disabled={uploading}>
                    {uploading ? '⏳ Se încarcă...' : '🖼️ Încarcă imagine copertă'}
                  </button>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { handleCoverSelected(e.target.files?.[0]); e.target.value = ''; }} />
              </div>

              {/* Video principal */}
              <div><label style={lbl}>Video (link YouTube sau fișier .mp4 — apare sub titlu)</label>
                <input className="input" value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..." /></div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Conținut</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
                      {(['markdown', 'html'] as const).map(ct => (
                        <button
                          key={ct}
                          onClick={() => setForm(f => ({ ...f, contentType: ct }))}
                          style={{
                            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            background: form.contentType === ct ? 'var(--surface)' : 'transparent',
                            color: form.contentType === ct ? 'var(--text)' : 'var(--text3)',
                            boxShadow: form.contentType === ct ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
                          }}
                        >
                          {ct === 'markdown' ? '📝 Markdown' : '🌐 HTML'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => bodyImageInputRef.current?.click()} disabled={uploading}
                        title="Încarcă o imagine și o inserează în conținut">🖼️ + Imagine</button>
                      <button className="btn btn-sm" onClick={() => bodyVideoInputRef.current?.click()} disabled={uploading}
                        title="Încarcă un video și îl inserează în conținut">🎬 + Video</button>
                    </div>
                  </div>
                </div>
                <textarea className="input" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                  placeholder={form.contentType === 'html' ? '<h2>Titlu</h2>\n<p>Paragraful tău aici...</p>' : 'Conținutul articolului...'}
                  style={{ minHeight: 160, resize: 'vertical', fontFamily: form.contentType === 'html' ? 'monospace' : 'inherit' }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {form.contentType === 'html' ? (
                    <>HTML brut, randat exact ca atare în aplicație (funcționează cu <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;ul&gt;/&lt;li&gt;</code>, <code>&lt;img&gt;</code>, <code>&lt;a&gt;</code> etc). Butoanele de imagine/video de mai sus inserează tag-uri HTML.</>
                  ) : (
                    <>Formatare: <code># Titlu</code> · <code>## Subtitlu</code> · <code>**bold**</code> · <code>- listă</code> · <code>1. listă numerotată</code> ·{' '}
                    <code>&gt; citat</code> · <code>---</code> separator ·{' '}
                    <code>![legendă](url imagine)</code> · <code>!video(url YouTube sau .mp4)</code>. Primul paragraf e afișat mai mare (introducere).</>
                  )}
                </div>
                <input ref={bodyImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { handleInsertMedia(e.target.files?.[0], 'image'); e.target.value = ''; }} />
                <input ref={bodyVideoInputRef} type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={e => { handleInsertMedia(e.target.files?.[0], 'video'); e.target.value = ''; }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="isPremium" checked={form.isPremium} onChange={e => setForm({ ...form, isPremium: e.target.checked })} />
                <label htmlFor="isPremium" style={{ fontSize: 13 }}>Articol Premium (vizibil doar pentru abonați)</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="published" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />
                <label htmlFor="published" style={{ fontSize: 13 }}>Publicat (vizibil în aplicație în modulul Articole)</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Anulează</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploading} style={{ flex: 1 }}>
                {saving ? 'Se salvează...' : '💾 Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distribuție modal — email + social */}
      {distributing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setDistributing(null); }}>
          <div className="card" style={{ width: 860, maxWidth: '94vw', padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>📣 Distribuie articolul</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>{distributing.title}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Coloana stânga: email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>✉️ Trimite pe email</div>
                <div><label style={lbl}>Subiect email</label>
                  <input className="input" value={distSubject} onChange={e => setDistSubject(e.target.value)} /></div>
                <div><label style={lbl}>Fragment (apare în email, cu buton „Citește mai mult")</label>
                  <textarea className="input" value={distExcerpt} onChange={e => setDistExcerpt(e.target.value)}
                    style={{ minHeight: 120, resize: 'vertical' }} /></div>
                <div><label style={lbl}>Audiență</label>
                  <select className="input" value={distAudience} onChange={e => setDistAudience(e.target.value)}>
                    {DISTRIBUTE_AUDIENCES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select></div>
                <button className="btn btn-primary" onClick={sendArticleEmail} disabled={distSending}>
                  {distSending ? '⏳ Se trimite...' : '📧 Trimite email acum'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Campania apare în istoricul din pagina Notificări → Email, cu contoare de trimitere.
                  Dezabonații sunt săriți automat.
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🌐 Distribuie pe social media</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {articleUrl(distributing)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl(distributing))}`, '_blank')}>
                      Facebook
                    </button>
                    <button className="btn btn-sm" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${distributing.title}\n${articleUrl(distributing)}`)}`, '_blank')}>
                      WhatsApp
                    </button>
                    <button className="btn btn-sm" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(distributing.title)}&url=${encodeURIComponent(articleUrl(distributing))}`, '_blank')}>
                      X / Twitter
                    </button>
                    <button className="btn btn-sm" onClick={() => copyToClipboard(`${distributing.title}\n\n${distExcerpt}\n\nCitește tot articolul în MamiApp 🌸\n${articleUrl(distributing)}`, 'Caption copiat — lipește-l în postarea de Instagram.')}>
                      📋 Copiază pentru Instagram
                    </button>
                    <button className="btn btn-sm" onClick={() => copyToClipboard(articleUrl(distributing), 'Link copiat!')}>
                      🔗 Copiază link
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                    Instagram nu acceptă distribuire directă cu link din browser — folosește „Copiază pentru Instagram"
                    și lipește textul în postare/story.
                  </div>
                </div>
              </div>

              {/* Coloana dreapta: preview email */}
              <div>
                <label style={lbl}>Previzualizare email</label>
                <iframe
                  title="article-email-preview"
                  sandbox=""
                  srcDoc={buildArticleEmailHtml({ title: distributing.title, excerpt: distExcerpt, url: articleUrl(distributing) })}
                  style={{ width: '100%', height: 480, border: '1px solid var(--border)', borderRadius: 12, background: '#FAF6F2' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setDistributing(null)}>Închide</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview articol — exact cum apare în aplicație */}
      {previewHtml && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={e => { if (e.target === e.currentTarget) setPreviewHtml(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 390, alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>👁️ Preview articol</span>
              <button className="btn btn-sm" onClick={() => setPreviewHtml(null)}>✕ Închide</button>
            </div>
            <iframe
              title="article-preview"
              srcDoc={previewHtml}
              style={{ width: 390, height: '80vh', maxHeight: 780, border: '4px solid #222', borderRadius: 32, background: '#FDF6F0' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: 'var(--text)' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 };
