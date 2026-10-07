// src/pages/SmartNotifications.tsx — Orchestratorul de notificări smart
// Setări globale, template-uri per tip, conținut zilnic (sarcină/copil) și statistici CTR.
import { useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, doc, getDoc, setDoc, deleteDoc,
  query, orderBy, limit, collectionGroup, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import { logAudit, fmtDateTime } from '../lib/utils';
import { useAdminStore } from '../store/adminStore';

// ── Tipuri + valori implicite (oglindesc functions/src/smartNotifications.ts) ──

type SmartType =
  | 'daily_pregnancy' | 'pregnancy_milestone' | 'daily_child' | 'monthly_birthday'
  | 'diversification' | 'weekly_insight' | 'streak' | 'winback' | 'community_reply';

interface SmartTemplate {
  title: string;
  body: string;
  deepLink: string;
  priority: number;
  enabled: boolean;
}

interface SmartSettings {
  enabled: boolean;
  dailyCap: number;
  quietStart: number;
  quietEnd: number;
  defaultHour: number;
  secondaryHour: number;
}

interface ContentItem {
  id: string;
  audience: 'pregnancy' | 'child';
  week?: number;
  month?: number;
  order: number;
  title?: string;
  body: string;
  deepLink?: string;
  enabled: boolean;
}

interface StatRow {
  type: string;
  sent: number;
  opened: number;
}

interface LogRow {
  id: string;
  path: string;
  type: string;
  title: string;
  body: string;
  sentAt?: any;
  opened?: boolean;
}

const DEFAULT_SETTINGS: SmartSettings = {
  enabled: true, dailyCap: 2, quietStart: 21, quietEnd: 8, defaultHour: 9, secondaryHour: 19,
};

const TYPE_META: Record<SmartType, { label: string; emoji: string; desc: string; vars: string }> = {
  daily_pregnancy:    { label: 'Conținut zilnic sarcină',  emoji: '🤰', desc: 'Trimis zilnic — fapte despre săptămâna curentă de sarcină, rotite din Conținut zilnic.', vars: '{week}, {content}' },
  pregnancy_milestone:{ label: 'Momente-cheie sarcină',    emoji: '🌸', desc: 'Trimestre, viabilitate, geanta de maternitate, countdown final. Copy definit în cod per moment.', vars: '{week}' },
  daily_child:        { label: 'Conținut zilnic copil',    emoji: '✨', desc: 'Trimis zilnic — fapte despre luna de vârstă a copilului, rotite din Conținut zilnic.', vars: '{childName}, {ageMonths}, {content}' },
  monthly_birthday:   { label: 'Aniversare lunară',        emoji: '🎂', desc: 'În ziua în care copilul împlinește fiecare lună (1–36).', vars: '{childName}, {ageMonths}' },
  diversification:    { label: 'Diversificare',            emoji: '🥑', desc: 'Sugestie de aliment nou, la 3 zile, pentru copii de 6–12 luni.', vars: '{childName}, {ageMonths}' },
  weekly_insight:     { label: 'Analiza săptămânii',       emoji: '📈', desc: 'Duminica — statistici din rezumatele zilnice (mese, somn).', vars: '{childName}, {feeds}, {sleepHours}' },
  streak:             { label: 'Serie de jurnal',          emoji: '🔥', desc: 'Când utilizatoarea are minimum 3 zile consecutive cu date înregistrate.', vars: '{childName}, {streak}' },
  winback:            { label: 'Reactivare (winback)',     emoji: '💛', desc: 'La 3 / 7 / 14 / 30 de zile de inactivitate, cu vârsta copilului sau săptămâna de sarcină.', vars: '{childName}, {ageMonthsDays}, {week}' },
  community_reply:    { label: 'Răspuns în comunitate',    emoji: '💬', desc: 'Imediat, când cineva răspunde la postarea utilizatoarei (max 5/zi).', vars: '{authorName}, {preview}' },
};

const DEFAULT_TEMPLATES: Record<SmartType, SmartTemplate> = {
  daily_pregnancy:    { title: '🤰 Săptămâna {week} din sarcină', body: '{content}', deepLink: '/modules/pregnancy', priority: 70, enabled: true },
  pregnancy_milestone:{ title: '🌸 Moment important în sarcină', body: '{content}', deepLink: '/modules/pregnancy', priority: 90, enabled: true },
  daily_child:        { title: '✨ Azi despre {childName}', body: '{content}', deepLink: '/(tabs)', priority: 70, enabled: true },
  monthly_birthday:   { title: '🎂 {childName} împlinește {ageMonths} luni azi!', body: 'Vezi cât a crescut și ce etape a atins luna aceasta.', deepLink: '/modules/growth', priority: 95, enabled: true },
  diversification:    { title: '🥑 Un aliment nou pentru {childName}', body: 'La {ageMonths} luni poți introduce alimente noi. Vezi sugestia de azi în ghidul de diversificare.', deepLink: '/modules/food', priority: 55, enabled: true },
  weekly_insight:     { title: '📈 Analiza săptămânii pentru {childName}', body: 'Săptămâna asta: {feeds} mese și în medie {sleepHours}h de somn pe zi. Vezi tendințele complete.', deepLink: '/(tabs)', priority: 60, enabled: true },
  streak:             { title: '🔥 Ziua {streak} de jurnal complet', body: 'Datele înregistrate constant fac analizele mult mai precise. Continuă seria azi!', deepLink: '/(tabs)/add', priority: 40, enabled: true },
  winback:            { title: '💛 {childName} are {ageMonthsDays}', body: 'S-au întâmplat multe în această perioadă de dezvoltare. Vezi ce e nou pentru vârsta lui.', deepLink: '/(tabs)', priority: 80, enabled: true },
  community_reply:    { title: '💬 Răspuns nou la postarea ta', body: '{authorName} a răspuns: "{preview}"', deepLink: '/modules/community', priority: 100, enabled: true },
};

const SMART_TYPES = Object.keys(TYPE_META) as SmartType[];
const PREGNANCY_WEEKS = Array.from({ length: 37 }, (_, i) => i + 5); // 5..41
const CHILD_MONTHS = Array.from({ length: 25 }, (_, i) => i);        // 0..24

// ── Preview push în stil iOS (valori exemplu pentru variabile) ──
const PUSH_SAMPLE_VALUES: Record<string, string> = {
  childName: 'Emma',
  ageMonths: '5',
  ageMonthsDays: '5 luni și 12 zile',
  week: '24',
  content: 'Câteva minute de tummy time pe zi, sub supraveghere, întăresc gâtul și umerii.',
  authorName: 'Ioana',
  preview: 'Și la noi a funcționat rutina de seară…',
  feeds: '38',
  sleepHours: '12.5',
  streak: '4',
};

function fillPushVars(text: string) {
  return text.replace(/\{(\w+)\}/g, (match, key) => PUSH_SAMPLE_VALUES[key] ?? match);
}

/** Mockup de notificare push așa cum apare pe lock screen (iOS). */
function PushPreview({ title, body }: { title: string; body: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #5b6b9e 0%, #7a8bb5 100%)',
      borderRadius: 16,
      padding: '18px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 1, textTransform: 'uppercase' }}>
        Previzualizare notificare
      </div>
      <div style={{
        background: 'rgba(250,250,252,0.92)',
        backdropFilter: 'blur(10px)',
        borderRadius: 16,
        padding: '10px 12px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        <img
          src="https://example.com/assets/icon.png"
          alt="MamiApp"
          width={38}
          height={38}
          style={{ borderRadius: 9, flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fillPushVars(title) || 'Titlu notificare'}
            </div>
            <div style={{ fontSize: 11, color: '#8e8e93', flexShrink: 0 }}>acum</div>
          </div>
          <div style={{ fontSize: 12.5, color: '#3a3a3c', lineHeight: 1.35, marginTop: 1, wordBreak: 'break-word' }}>
            {fillPushVars(body) || 'Mesajul notificării…'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Emailuri automate (winback + drip onboarding) — oglindesc functions ──

interface SmartEmail {
  enabled: boolean;
  subject: string;
  html: string;
  dayOffset?: number;
}

const EMAIL_META: Record<string, { label: string; emoji: string; desc: string; vars: string }> = {
  winback: { label: 'Winback (reactivare)', emoji: '💛', desc: 'Trimis la 7/14/30 zile de inactivitate utilizatorilor FĂRĂ push activ (au dezinstalat sau au refuzat notificările). Emailul e singurul canal care îi mai atinge.', vars: '{displayName}, {personalLine}, {subjectLine}, {appUrl}' },
  drip_0: { label: 'Onboarding — Ziua 0 (bun venit)', emoji: '👋', desc: 'Trimis în ziua înregistrării.', vars: '{displayName}, {appUrl}' },
  drip_1: { label: 'Onboarding — Ziua 2 (asistent AI)', emoji: '🤖', desc: 'Activare: prezintă asistentul AI.', vars: '{displayName}, {appUrl}' },
  drip_2: { label: 'Onboarding — Ziua 5 (înregistrări)', emoji: '📊', desc: 'Activare: valoarea logging-ului zilnic.', vars: '{displayName}, {appUrl}' },
  drip_3: { label: 'Onboarding — Ziua 8 (Premium)', emoji: '⭐', desc: 'Teaser Premium la finalul primei săptămâni.', vars: '{displayName}, {appUrl}' },
};

const DEFAULT_EMAILS: Record<string, SmartEmail> = {
  winback: {
    enabled: true,
    subject: '💛 {subjectLine}',
    html: '<p>Bună, {displayName}!</p><p>{personalLine}</p><p>Deschide MamiApp să vezi ce e nou pentru voi — de la etapele de dezvoltare până la sfaturile zilnice personalizate.</p>',
  },
  drip_0: {
    enabled: true, dayOffset: 0,
    subject: '🌸 Bun venit la MamiApp, {displayName}!',
    html: '<p>Ne bucurăm că ești aici! MamiApp e alături de tine în fiecare zi — de la urmărirea sarcinii sau a bebelușului, până la răspunsuri de la asistentul AI.</p><p><strong>Primul pas:</strong> completează profilul și explorează modulele de pe ecranul principal. Totul e gândit pentru mame din România.</p>',
  },
  drip_1: {
    enabled: true, dayOffset: 2,
    subject: '🤖 Ai o întrebare? Asistentul AI îți răspunde oricând',
    html: '<p>Bună, {displayName}!</p><p>Știai că poți întreba orice despre sarcină sau bebeluș, oricând, direct în aplicație? Asistentul AI din MamiApp răspunde pe baza contextului vostru — vârsta copilului, săptămâna de sarcină, istoricul înregistrat.</p><p>Încearcă azi: „De ce se trezește noaptea?” sau „Ce alimente pot introduce acum?”</p>',
  },
  drip_2: {
    enabled: true, dayOffset: 5,
    subject: '📊 Micile înregistrări fac diferența mare',
    html: '<p>Bună, {displayName}!</p><p>Mamele care înregistrează mesele și somnul câteva zile la rând primesc remindere personalizate pe ritmul real al bebelușului — nu la ore fixe.</p><p>Plus: rezumatul zilnic îți arată tipare pe care altfel nu le-ai observa.</p>',
  },
  drip_3: {
    enabled: true, dayOffset: 8,
    subject: '⭐ Deblochează tot ce poate MamiApp',
    html: '<p>Bună, {displayName}!</p><p>Cu MamiApp Premium primești răspunsuri AI nelimitate, partajare cu familia, spațiu extins pentru documente medicale și analize avansate.</p><p>Mii de mame îl folosesc deja zilnic — încearcă-l și tu.</p>',
  },
};

const EMAIL_IDS = Object.keys(DEFAULT_EMAILS);

const EMAIL_SAMPLE_VALUES: Record<string, string> = {
  displayName: 'Ana',
  personalLine: 'Emma are acum 5 luni și 12 zile — la această vârstă apar lucruri noi în fiecare săptămână, iar MamiApp ți le arată pe toate.',
  subjectLine: 'Emma are 5 luni și 12 zile 🎈',
  appUrl: 'https://example.com',
};

function renderEmailPreview(email: SmartEmail): string {
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (match, key) => EMAIL_SAMPLE_VALUES[key] ?? match);
  const title = fill(email.subject).replace(/^[^\p{L}\p{N}]+\s*/u, '');
  return `
  <div style="background:#FAF6F2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;">
      <div style="text-align:center;font-size:28px;margin-bottom:4px;">🌸</div>
      <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#B96F87;font-weight:bold;margin-bottom:18px;">MAMIAPP</div>
      <h1 style="font-size:20px;color:#3D3436;text-align:center;margin:0 0 16px;">${title}</h1>
      <div style="font-size:14px;line-height:1.7;color:#5C5254;">${fill(email.html)}</div>
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="#" style="display:inline-block;background:#E8997A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 32px;border-radius:12px;">Deschide MamiApp</a>
      </div>
    </div>
  </div>`;
}

export default function SmartNotifications() {
  const { adminUser } = useAdminStore();
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'content' | 'emails' | 'stats'>('settings');

  // ── Emailuri automate ──
  const [emails, setEmails] = useState<Record<string, SmartEmail>>(DEFAULT_EMAILS);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState<string | null>(null);

  // ── Setări globale ──
  const [settings, setSettings] = useState<SmartSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Template-uri ──
  const [templates, setTemplates] = useState<Record<SmartType, SmartTemplate>>(DEFAULT_TEMPLATES);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState<SmartType | null>(null);
  const [testSending, setTestSending] = useState<SmartType | null>(null);
  const [testUid, setTestUid] = useState('');

  // ── Conținut zilnic ──
  const [contentAudience, setContentAudience] = useState<'pregnancy' | 'child'>('pregnancy');
  const [contentBucket, setContentBucket] = useState(12);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [contentSaving, setContentSaving] = useState(false);

  // ── Statistici ──
  const [stats, setStats] = useState<StatRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Load ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'notificationSettings', 'global'));
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as SmartSettings);
      } catch (e) { console.error('Load settings failed:', e); }
      setSettingsLoading(false);

      try {
        const snap = await getDocs(collection(db, 'notificationTemplates'));
        const merged = { ...DEFAULT_TEMPLATES };
        snap.docs.forEach(d => {
          const type = d.id as SmartType;
          if (type in merged) merged[type] = { ...merged[type], ...d.data() } as SmartTemplate;
        });
        setTemplates(merged);
      } catch (e) { console.error('Load templates failed:', e); }
      setTemplatesLoading(false);

      try {
        const snap = await getDocs(collection(db, 'notificationContent'));
        setAllContent(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentItem)));
      } catch (e) { console.error('Load content failed:', e); }
      setContentLoading(false);

      try {
        const snap = await getDocs(collection(db, 'notificationEmails'));
        const merged = { ...DEFAULT_EMAILS };
        snap.docs.forEach(d => {
          if (d.id in merged) merged[d.id] = { ...merged[d.id], ...d.data() } as SmartEmail;
        });
        setEmails(merged);
      } catch (e) { console.error('Load emails failed:', e); }
      setEmailsLoading(false);

      try {
        const [statsSnap, logsSnap] = await Promise.all([
          getDocs(collection(db, 'notificationStats')),
          getDocs(query(collectionGroup(db, 'notificationLog'), orderBy('sentAt', 'desc'), limit(50))),
        ]);
        setStats(statsSnap.docs.map(d => ({
          type: d.id,
          sent: Number(d.data().sent) || 0,
          opened: Number(d.data().opened) || 0,
        })));
        setLogs(logsSnap.docs.map(d => ({
          id: d.id,
          path: d.ref.path,
          ...(d.data() as Omit<LogRow, 'id' | 'path'>),
        })));
      } catch (e) { console.error('Load stats failed:', e); }
      setStatsLoading(false);
    })();
  }, []);

  useEffect(() => {
    const bucketField = contentAudience === 'pregnancy' ? 'week' : 'month';
    setContentItems(
      allContent
        .filter(item => item.audience === contentAudience && (item as any)[bucketField] === contentBucket)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
    );
  }, [allContent, contentAudience, contentBucket]);

  // ── Acțiuni ──
  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, 'notificationSettings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit('save_smart_notification_settings', 'notification_settings', 'global').catch(() => {});
      toast.success('Setările orchestratorului au fost salvate.');
    } catch (e) {
      console.error(e);
      toast.error('Nu am putut salva setările.');
    }
    setSettingsSaving(false);
  };

  const saveTemplate = async (type: SmartType) => {
    setTemplateSaving(type);
    try {
      await setDoc(doc(db, 'notificationTemplates', type), {
        ...templates[type],
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit('save_smart_notification_template', 'notification_template', type).catch(() => {});
      toast.success(`Template "${TYPE_META[type].label}" salvat.`);
    } catch (e) {
      console.error(e);
      toast.error('Nu am putut salva template-ul.');
    }
    setTemplateSaving(null);
  };

  const resetTemplate = (type: SmartType) => {
    setTemplates(prev => ({ ...prev, [type]: { ...DEFAULT_TEMPLATES[type] } }));
  };

  const sendTest = async (type: SmartType) => {
    setTestSending(type);
    try {
      const call = httpsCallable<{ uid?: string; type: SmartType }, { ok: boolean; title: string; body: string }>(
        functions, 'sendSmartTestNotification'
      );
      const result = await call({ type, ...(testUid.trim() ? { uid: testUid.trim() } : {}) });
      toast.success(`Test trimis: "${result.data.title}"`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Nu am putut trimite testul.');
    }
    setTestSending(null);
  };

  const updateTemplate = (type: SmartType, changes: Partial<SmartTemplate>) => {
    setTemplates(prev => ({ ...prev, [type]: { ...prev[type], ...changes } }));
  };

  const updateEmail = (id: string, changes: Partial<SmartEmail>) => {
    setEmails(prev => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  const saveEmail = async (id: string) => {
    setEmailSaving(id);
    try {
      await setDoc(doc(db, 'notificationEmails', id), {
        ...emails[id],
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit('save_smart_email', 'notification_email', id).catch(() => {});
      toast.success(`Email "${EMAIL_META[id]?.label || id}" salvat.`);
    } catch (e) {
      console.error(e);
      toast.error('Nu am putut salva emailul.');
    }
    setEmailSaving(null);
  };

  const newContentItem = (): ContentItem => ({
    id: '',
    audience: contentAudience,
    ...(contentAudience === 'pregnancy' ? { week: contentBucket } : { month: contentBucket }),
    order: contentItems.length,
    body: '',
    enabled: true,
  });

  const saveContentItem = async () => {
    if (!editingItem || !editingItem.body.trim()) { toast.warning('Completează textul notificării.'); return; }
    setContentSaving(true);
    try {
      const bucketKey = editingItem.audience === 'pregnancy' ? `w${editingItem.week}` : `m${editingItem.month}`;
      const id = editingItem.id || `${editingItem.audience}_${bucketKey}_${Date.now()}`;
      const { id: _omit, ...data } = editingItem;
      const payload = {
        ...data,
        body: editingItem.body.trim(),
        title: editingItem.title?.trim() || null,
        deepLink: editingItem.deepLink?.trim() || null,
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
      };
      await setDoc(doc(db, 'notificationContent', id), payload, { merge: true });
      await logAudit('save_notification_content', 'notification_content', id).catch(() => {});
      setAllContent(prev => {
        const without = prev.filter(item => item.id !== id);
        return [...without, { ...editingItem, id }];
      });
      setEditingItem(null);
      toast.success('Conținut salvat.');
    } catch (e) {
      console.error(e);
      toast.error('Nu am putut salva conținutul.');
    }
    setContentSaving(false);
  };

  const deleteContentItem = async (item: ContentItem) => {
    if (!(await confirmDialog({ title: 'Ștergi definitiv acest conținut?' }))) return;
    try {
      await deleteDoc(doc(db, 'notificationContent', item.id));
      await logAudit('delete_notification_content', 'notification_content', item.id).catch(() => {});
      setAllContent(prev => prev.filter(x => x.id !== item.id));
      toast.success('Conținut șters.');
    } catch (e) {
      console.error(e);
      toast.error('Nu am putut șterge.');
    }
  };

  const toggleContentEnabled = async (item: ContentItem) => {
    try {
      await setDoc(doc(db, 'notificationContent', item.id), { enabled: !item.enabled }, { merge: true });
      setAllContent(prev => prev.map(x => x.id === item.id ? { ...x, enabled: !item.enabled } : x));
    } catch (e) {
      console.error(e);
      toast.error('Nu am putut actualiza.');
    }
  };

  const contentCoverage = useMemo(() => {
    const buckets = contentAudience === 'pregnancy' ? PREGNANCY_WEEKS : CHILD_MONTHS;
    const field = contentAudience === 'pregnancy' ? 'week' : 'month';
    return buckets.map(bucket => ({
      bucket,
      count: allContent.filter(item => item.audience === contentAudience && (item as any)[field] === bucket && item.enabled).length,
    }));
  }, [allContent, contentAudience]);

  const inputLabel = { fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 } as const;

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🧠 Notificări Smart</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
            Orchestratorul trimite zilnic maximum {settings.dailyCap} notificări personalizate per utilizator, la ora lui de vârf.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          ['settings', '⚙️ Setări'],
          ['templates', '📝 Template-uri'],
          ['content', '📅 Conținut zilnic'],
          ['emails', '📧 Email-uri automate'],
          ['stats', '📊 Statistici'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '6px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === key ? 'var(--accent)' : 'transparent',
              color: activeTab === key ? '#fff' : 'var(--text2)',
              transition: 'background 0.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── Tab: Setări ── */}
      {activeTab === 'settings' && (
        <div className="card" style={{ padding: 20, maxWidth: 720 }}>
          {settingsLoading ? <div className="spinner" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={e => setSettings(p => ({ ...p, enabled: e.target.checked }))}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Orchestrator activ</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Oprește complet notificările smart (campaniile manuale și cele medicale nu sunt afectate).</div>
                </div>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                <div>
                  <label style={inputLabel}>Maxim notificări / zi</label>
                  <input type="number" className="input" min={1} max={5} value={settings.dailyCap}
                    onChange={e => setSettings(p => ({ ...p, dailyCap: parseInt(e.target.value) || 2 }))} />
                </div>
                <div>
                  <label style={inputLabel}>Liniște de la ora</label>
                  <input type="number" className="input" min={0} max={23} value={settings.quietStart}
                    onChange={e => setSettings(p => ({ ...p, quietStart: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label style={inputLabel}>Liniște până la ora</label>
                  <input type="number" className="input" min={0} max={23} value={settings.quietEnd}
                    onChange={e => setSettings(p => ({ ...p, quietEnd: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label style={inputLabel}>Ora implicită</label>
                  <input type="number" className="input" min={0} max={23} value={settings.defaultHour}
                    onChange={e => setSettings(p => ({ ...p, defaultHour: parseInt(e.target.value) || 9 }))} />
                </div>
                <div>
                  <label style={inputLabel}>Ora secundară</label>
                  <input type="number" className="input" min={0} max={23} value={settings.secondaryHour}
                    onChange={e => setSettings(p => ({ ...p, secondaryHour: parseInt(e.target.value) || 19 }))} />
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 8, padding: 12, lineHeight: 1.6 }}>
                <strong>Cum funcționează:</strong> orchestratorul rulează orar (Cloud Function). Pentru fiecare utilizator alege
                ora de trimitere din istoricul lui real de utilizare (histograma deschiderilor); orele de aici sunt doar fallback
                pentru utilizatorii noi. Orele de liniște per utilizator (din aplicație) au prioritate. CTR-ul scăzut pe un tip
                de notificare îi reduce automat frecvența pentru acel utilizator.
              </div>

              <div>
                <button className="btn btn-primary" onClick={saveSettings} disabled={settingsSaving}>
                  {settingsSaving ? '⏳ Se salvează...' : '💾 Salvează setările'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Template-uri ── */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Test push către UID (gol = contul tău de admin):
            </div>
            <input className="input" placeholder="UID utilizator (opțional)" value={testUid}
              onChange={e => setTestUid(e.target.value)} style={{ maxWidth: 320, height: 34 }} />
          </div>

          {templatesLoading ? <div className="spinner" /> : SMART_TYPES.map(type => {
            const template = templates[type];
            const meta = TYPE_META[type];
            return (
              <div className="card" key={type} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{meta.emoji} {meta.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{meta.desc}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>
                      Variabile: {meta.vars}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={template.enabled}
                      onChange={e => updateTemplate(type, { enabled: e.target.checked })} />
                    {template.enabled ? 'Activ' : 'Oprit'}
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr', gap: 12, marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={inputLabel}>Titlu</label>
                      <input className="input" value={template.title}
                        onChange={e => updateTemplate(type, { title: e.target.value })} />
                    </div>
                    <div>
                      <label style={inputLabel}>Mesaj</label>
                      <textarea className="input" value={template.body} style={{ height: 60, resize: 'vertical', fontFamily: 'inherit' }}
                        onChange={e => updateTemplate(type, { body: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={inputLabel}>Deep link</label>
                      <input className="input" value={template.deepLink}
                        onChange={e => updateTemplate(type, { deepLink: e.target.value })} />
                    </div>
                    <div>
                      <label style={inputLabel}>Prioritate (0–100)</label>
                      <input type="number" className="input" min={0} max={100} value={template.priority}
                        onChange={e => updateTemplate(type, { priority: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <PushPreview title={template.title} body={template.body} />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => saveTemplate(type)} disabled={templateSaving === type}>
                    {templateSaving === type ? '⏳' : '💾 Salvează'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => resetTemplate(type)}>
                    ↺ Valorile implicite
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => sendTest(type)} disabled={testSending !== null}>
                    {testSending === type ? '⏳ Se trimite...' : '🚀 Trimite test'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Conținut zilnic ── */}
      {activeTab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" value={contentAudience} style={{ maxWidth: 180, height: 36 }}
              onChange={e => {
                const audience = e.target.value as 'pregnancy' | 'child';
                setContentAudience(audience);
                setContentBucket(audience === 'pregnancy' ? 12 : 0);
              }}>
              <option value="pregnancy">🤰 Sarcină (săptămâni)</option>
              <option value="child">👶 Copil (luni)</option>
            </select>
            <select className="input" value={contentBucket} style={{ maxWidth: 200, height: 36 }}
              onChange={e => setContentBucket(parseInt(e.target.value))}>
              {(contentAudience === 'pregnancy' ? PREGNANCY_WEEKS : CHILD_MONTHS).map(bucket => (
                <option key={bucket} value={bucket}>
                  {contentAudience === 'pregnancy' ? `Săptămâna ${bucket}` : `Luna ${bucket}`}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setEditingItem(newContentItem())}>
              + Adaugă conținut
            </button>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
              Itemii din același interval sunt rotiți zilnic — mai mulți itemi = varietate mai mare.
            </div>
          </div>

          {/* Acoperire */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
              Acoperire conținut {contentAudience === 'pregnancy' ? 'sarcină' : 'copil'}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {contentCoverage.map(({ bucket, count }) => (
                <button
                  key={bucket}
                  onClick={() => setContentBucket(bucket)}
                  title={`${count} itemi activi`}
                  style={{
                    width: 34, height: 30, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: bucket === contentBucket ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: count === 0 ? 'rgba(239,68,68,.12)' : count === 1 ? 'rgba(245,158,11,.14)' : 'rgba(16,185,129,.14)',
                    color: 'var(--text)',
                  }}
                >{bucket}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              🟥 fără conținut · 🟨 1 item · 🟩 2+ itemi — pentru intervalele goale de sarcină, orchestratorul folosește automat datele din pregnancy_weeks.
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Ordine</th>
                    <th>Text notificare</th>
                    <th>Titlu custom</th>
                    <th>Status</th>
                    <th>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {contentLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                  ) : contentItems.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
                      Niciun conținut pentru acest interval. Rulează scriptul de populare sau adaugă manual.
                    </td></tr>
                  ) : contentItems.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontSize: 13, fontWeight: 700 }}>{item.order}</td>
                      <td style={{ fontSize: 13, color: 'var(--text)', maxWidth: 480 }}>{item.body}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{item.title || '—'}</td>
                      <td>
                        <button
                          className={`badge ${item.enabled ? 'badge-green' : 'badge-gray'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => toggleContentEnabled(item)}
                        >{item.enabled ? 'Activ' : 'Oprit'}</button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => setEditingItem({ ...item })}>Editează</button>
                          <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => deleteContentItem(item)}>Șterge</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Email-uri automate ── */}
      {activeTab === 'emails' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 14, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            Emailurile automate se trimit zilnic la ora 10:00 (ora României). Toate includ automat footer de
            dezabonare, iar dezabonații sunt săriți. Variabilele din text se completează automat per utilizator.
          </div>
          {emailsLoading ? <div className="spinner" /> : EMAIL_IDS.map(id => {
            const email = emails[id];
            const meta = EMAIL_META[id];
            return (
              <div className="card" key={id} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{meta.emoji} {meta.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{meta.desc}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>
                      Variabile: {meta.vars}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={email.enabled}
                      onChange={e => updateEmail(id, { enabled: e.target.checked })} />
                    {email.enabled ? 'Activ' : 'Oprit'}
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {id !== 'winback' && (
                      <div>
                        <label style={inputLabel}>Trimis în ziua (de la înregistrare)</label>
                        <input type="number" className="input" min={0} max={30} style={{ maxWidth: 100 }}
                          value={email.dayOffset ?? 0}
                          onChange={e => updateEmail(id, { dayOffset: Math.max(0, parseInt(e.target.value) || 0) })} />
                      </div>
                    )}
                    <div>
                      <label style={inputLabel}>Subiect</label>
                      <input className="input" value={email.subject}
                        onChange={e => updateEmail(id, { subject: e.target.value })} />
                    </div>
                    <div>
                      <label style={inputLabel}>Conținut (HTML)</label>
                      <textarea className="input" value={email.html}
                        style={{ height: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                        onChange={e => updateEmail(id, { html: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEmail(id)} disabled={emailSaving === id}>
                        {emailSaving === id ? '⏳' : '💾 Salvează'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateEmail(id, { ...DEFAULT_EMAILS[id] })}>
                        ↺ Valorile implicite
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={inputLabel}>Previzualizare (cu date de exemplu)</label>
                    <iframe
                      title={`email-preview-${id}`}
                      sandbox=""
                      srcDoc={renderEmailPreview(email)}
                      style={{ width: '100%', height: 340, border: '1px solid var(--border)', borderRadius: 12, background: '#FAF6F2' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Statistici ── */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Performanță per tip de notificare</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                CTR = deschideri / trimiteri. Orchestratorul reduce automat frecvența tipurilor cu CTR scăzut.
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Tip</th><th>Trimise</th><th>Deschise</th><th>CTR</th></tr>
                </thead>
                <tbody>
                  {statsLoading ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                  ) : stats.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
                      Nicio notificare smart trimisă încă. Statisticile apar după primul ciclu al orchestratorului.
                    </td></tr>
                  ) : [...stats].sort((a, b) => b.sent - a.sent).map(row => {
                    const meta = TYPE_META[row.type as SmartType]
                      || (row.type === 'winback_email' ? { emoji: '💛', label: 'Winback email' } : EMAIL_META[row.type]);
                    const ctr = row.sent > 0 ? Math.round((row.opened / row.sent) * 100) : 0;
                    return (
                      <tr key={row.type}>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{meta ? `${meta.emoji} ${meta.label}` : row.type}</td>
                        <td style={{ fontSize: 13 }}>{row.sent}</td>
                        <td style={{ fontSize: 13 }}>{row.opened}</td>
                        <td>
                          <span className={`badge ${ctr >= 15 ? 'badge-green' : ctr >= 5 ? 'badge-blue' : 'badge-gray'}`}>{ctr}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Ultimele 50 de notificări trimise</div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Data</th><th>Tip</th><th>Titlu</th><th>Utilizator</th><th>Deschisă</th></tr>
                </thead>
                <tbody>
                  {statsLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Niciun log încă.</td></tr>
                  ) : logs.map(log => {
                    const uid = log.path.split('/')[1] || '';
                    const meta = TYPE_META[log.type as SmartType]
                      || (log.type === 'winback_email' ? { emoji: '💛', label: 'Winback email' } : EMAIL_META[log.type]);
                    return (
                      <tr key={log.path}>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{log.sentAt ? fmtDateTime(log.sentAt) : '—'}</td>
                        <td style={{ fontSize: 12 }}>{meta ? `${meta.emoji} ${meta.label}` : log.type}</td>
                        <td style={{ fontSize: 12, maxWidth: 340 }}>
                          <div style={{ fontWeight: 600 }}>{log.title}</div>
                          <div style={{ color: 'var(--text3)', fontSize: 11 }}>{log.body?.slice(0, 80)}</div>
                        </td>
                        <td style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{uid.slice(0, 12)}…</td>
                        <td><span className={`badge ${log.opened ? 'badge-green' : 'badge-gray'}`}>{log.opened ? 'Da' : 'Nu'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editare conținut ── */}
      {editingItem && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingItem(null); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2 className="modal-title">
              {editingItem.id ? '✏️ Editează conținut' : '➕ Conținut nou'} — {editingItem.audience === 'pregnancy' ? `săptămâna ${editingItem.week}` : `luna ${editingItem.month}`}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={inputLabel}>Text notificare * (max ~140 caractere pentru afișare completă)</label>
                <textarea className="input" value={editingItem.body} style={{ height: 90, resize: 'vertical', fontFamily: 'inherit' }}
                  onChange={e => setEditingItem(p => p ? { ...p, body: e.target.value } : p)} />
                <div style={{ fontSize: 11, color: editingItem.body.length > 160 ? '#EF4444' : 'var(--text3)', marginTop: 4 }}>
                  {editingItem.body.length} caractere
                </div>
              </div>
              <div>
                <label style={inputLabel}>Titlu custom (opțional — altfel se folosește template-ul tipului)</label>
                <input className="input" value={editingItem.title || ''}
                  onChange={e => setEditingItem(p => p ? { ...p, title: e.target.value } : p)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={inputLabel}>Deep link (opțional)</label>
                  <input className="input" placeholder="/modules/pregnancy" value={editingItem.deepLink || ''}
                    onChange={e => setEditingItem(p => p ? { ...p, deepLink: e.target.value } : p)} />
                </div>
                <div>
                  <label style={inputLabel}>Ordine</label>
                  <input type="number" className="input" min={0} value={editingItem.order}
                    onChange={e => setEditingItem(p => p ? { ...p, order: parseInt(e.target.value) || 0 } : p)} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={editingItem.enabled}
                  onChange={e => setEditingItem(p => p ? { ...p, enabled: e.target.checked } : p)} />
                Activ (inclus în rotația zilnică)
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setEditingItem(null)}>Anulează</button>
                <button className="btn btn-primary" onClick={saveContentItem} disabled={contentSaving}>
                  {contentSaving ? '⏳ Se salvează...' : '💾 Salvează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
