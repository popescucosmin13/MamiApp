import { useEffect, useState } from 'react';
import { toast } from "../lib/toast";
import { collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAdminStore } from '../store/adminStore';
import { logAudit, fmtDateTime } from '../lib/utils';
import type { EmailTemplate } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Branding comun emailuri (oglindă a shell-urilor din Cloud Functions)
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_LOGO_URL = 'https://example.com/assets/icon.png';

function tplHeader(gradient: string, pill: string, title: string, subtitle: string) {
  return `
  <tr>
    <td style="background:${gradient};padding:36px 30px;text-align:center;">
      <img src="${EMAIL_LOGO_URL}" width="64" height="64" alt="MamiApp" style="display:block;margin:0 auto 10px;border-radius:18px;" />
      <div style="display:inline-block;background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:8px 16px;color:#ffffff;font-size:13px;font-weight:700;">${pill}</div>
      <h1 style="margin:22px 0 8px;font-size:30px;line-height:1.2;color:#ffffff;font-weight:800;">${title}</h1>
      <p style="margin:0;color:#ffffff;font-size:16px;line-height:1.6;opacity:0.95;">${subtitle}</p>
    </td>
  </tr>`;
}

function tplFooter() {
  return `
  <tr>
    <td style="padding:26px 34px 34px;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#594d63;">Cu drag,<br /><strong>Echipa MamiApp</strong></p>
    </td>
  </tr>
  <tr>
    <td style="background:#fbf8fd;padding:22px 30px;text-align:center;border-top:1px solid #eee4f3;">
      <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#9b8aa5;">MamiApp - sprijin digital pentru parinti</p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#b0a1b8;">Acest email a fost trimis automat. Te rugam sa nu raspunzi direct la acest mesaj.</p>
    </td>
  </tr>`;
}

function tplWrap(rows: string) {
  return `<!doctype html>
<html lang="ro">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f7f3fb;font-family:Arial,Helvetica,sans-serif;color:#2b2233;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(96,63,128,0.14);">
        ${rows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function tplButton(href: string, label: string, gradient: string, shadowColor: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px auto;">
    <tr>
      <td align="center" style="border-radius:999px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:16px 30px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:${gradient};box-shadow:0 14px 28px ${shadowColor};">${label}</a>
      </td>
    </tr>
  </table>`;
}

function tplInfoBox(text: string) {
  return `
  <div style="background:#fff7fb;border:1px solid #f8d7e8;border-radius:18px;padding:18px 20px;margin:26px 0;">
    <p style="margin:0;font-size:14px;line-height:1.6;color:#75596a;">${text}</p>
  </div>`;
}

function tplLinkFallback(varName: string) {
  return `
  <p style="margin:22px 0 8px;font-size:14px;line-height:1.6;color:#7a6d82;">Daca butonul nu functioneaza, copiaza acest link in browser:</p>
  <p style="margin:0;background:#f5f0f8;border-radius:14px;padding:14px;font-size:12px;line-height:1.5;color:#7a6d82;word-break:break-all;">{{${varName}}}</p>`;
}

/** Shell-ul alb cu logo folosit de emailurile automate și medicale (buildBrandedEmail / wrapBrandedEmailShell din functions). */
function brandedShell(inner: string, opts?: { title?: string; ctaText?: string; footerHtml?: string }) {
  const title = opts?.title ? `<h1 style="font-size:20px;color:#3D3436;text-align:center;margin:0 0 16px;">${opts.title}</h1>` : '';
  const cta = opts?.ctaText
    ? `<div style="text-align:center;margin:28px 0 8px;"><a href="#" style="display:inline-block;background:#E8997A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 32px;border-radius:12px;">${opts.ctaText}</a></div>`
    : '';
  return `
  <div style="background:#FAF6F2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;">
      <img src="${EMAIL_LOGO_URL}" width="56" height="56" alt="MamiApp" style="display:block;margin:0 auto 8px;border-radius:16px;" />
      <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#B96F87;font-weight:bold;margin-bottom:18px;">MAMIAPP</div>
      ${title}
      <div style="font-size:14px;line-height:1.7;color:#5C5254;">${inner}</div>
      ${cta}
    </div>
    ${opts?.footerHtml || ''}
  </div>`;
}

const UNSUBSCRIBE_FOOTER_PREVIEW = `
  <div style="max-width:520px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#8a7580;text-align:center;">
    Primești acest email pentru că ai cont MamiApp.
    <a href="#" style="color:#D88FA8;text-decoration:underline;">Dezabonează-te aici</a>.
  </div>`;

const MEDICAL_FOOTER_PREVIEW = `
  <div style="max-width:560px;margin:16px auto 0;padding-top:16px;border-top:1px solid #eadfe7;font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#7a6d82;text-align:center;">
    Nu mai doresti remindere medicale prin MamiApp? <a href="#" style="color:#8b5cf6;">Opreste reminderele medicale</a>.
  </div>`;

// ─────────────────────────────────────────────────────────────────────────────
// Valori exemplu pentru variabile ({{var}} sau {var})
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_VALUES: Record<string, string> = {
  displayName: 'Ana',
  verificationLink: 'https://example.com/email-action?mode=verifyEmail&oobCode=EXEMPLU',
  ownerName: 'Ana Popescu',
  role: 'partener',
  inviteLink: 'https://example.com/family-invite?token=EXEMPLU',
  resetLink: 'https://example.com/email-action?mode=resetPassword&oobCode=EXEMPLU',
  personalLine: 'Emma are acum 5 luni și 12 zile — la această vârstă apar lucruri noi în fiecare săptămână, iar MamiApp ți le arată pe toate.',
  subjectLine: 'Emma are 5 luni și 12 zile 🎈',
  appUrl: 'https://example.com',
  parentName: 'Ana',
  childName: 'Mara',
  eventName: 'Vaccinul ROR',
  eventDate: '18 iulie 2026',
  daysBefore: '7',
};

function fillVars(text: string, extra?: Record<string, string>) {
  const values = { ...SAMPLE_VALUES, ...extra };
  return text
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => values[key] ?? m)
    .replace(/\{(\w+)\}/g, (m, key) => values[key] ?? m);
}

// ─────────────────────────────────────────────────────────────────────────────
// Emailuri tranzacționale (colecția emailTemplates + fallback-uri din functions)
// ─────────────────────────────────────────────────────────────────────────────

type TransactionalType = 'auth_verify_email' | 'family_invitation' | 'auth_reset_password';

const VERIFY_GRADIENT = 'linear-gradient(135deg,#f7b6cf 0%,#b99cff 55%,#7cd4d0 100%)';
const INVITE_GRADIENT = 'linear-gradient(135deg,#e8997a 0%,#d88fa8 55%,#7a9e8c 100%)';
const BTN_PURPLE = 'linear-gradient(135deg,#8b5cf6,#ec4899)';
const BTN_CORAL = 'linear-gradient(135deg,#e8997a,#d88fa8)';

const DEFAULT_VERIFY_HTML = tplWrap(`
  ${tplHeader(VERIFY_GRADIENT, 'MamiApp', 'Confirmă adresa de e-mail', 'Ultimul pas pentru activarea contului tău.')}
  <tr>
    <td style="padding:36px 34px 12px;">
      <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#2b2233;">Bună, <strong>{{displayName}}</strong>,</p>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#594d63;">Îți mulțumim că ai creat un cont în <strong>MamiApp</strong>. Pentru siguranța contului tău, confirmă adresa de e-mail apăsând butonul de mai jos.</p>
      ${tplButton('{{verificationLink}}', 'Confirmă adresa de e-mail', BTN_PURPLE, 'rgba(139,92,246,0.28)')}
      ${tplInfoBox('Dacă nu ai creat tu acest cont, poți ignora acest email. Adresa nu va fi confirmată fără accesarea linkului.')}
      ${tplLinkFallback('verificationLink')}
    </td>
  </tr>
  ${tplFooter()}
`);

const DEFAULT_INVITE_HTML = tplWrap(`
  ${tplHeader(INVITE_GRADIENT, 'MamiApp', 'Ai primit o invitație', '<strong>{{ownerName}}</strong> te-a invitat să faci parte din familie.')}
  <tr>
    <td style="padding:36px 34px 12px;">
      <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#2b2233;">Bună,</p>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#594d63;">Ai fost invitat(ă) în <strong>MamiApp</strong> cu rolul <strong>{{role}}</strong>. Acceptă invitația pentru a vedea informațiile partajate și permisiunile primite.</p>
      ${tplButton('{{inviteLink}}', 'Acceptă invitația', BTN_CORAL, 'rgba(232,153,122,0.28)')}
      ${tplInfoBox('Invitația este validă timp de <strong>7 zile</strong>. Dacă nu dorești să accepți, poți ignora acest email.')}
      ${tplLinkFallback('inviteLink')}
    </td>
  </tr>
  ${tplFooter()}
`);

const DEFAULT_RESET_HTML = tplWrap(`
  ${tplHeader(VERIFY_GRADIENT, 'MamiApp', 'Resetare parolă', 'Ai solicitat resetarea parolei contului tău MamiApp.')}
  <tr>
    <td style="padding:36px 34px 12px;">
      <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#2b2233;">Bună, <strong>{{displayName}}</strong>,</p>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#594d63;">Am primit o cerere de resetare a parolei contului tău. Apasă butonul de mai jos pentru a seta o parolă nouă.</p>
      ${tplButton('{{resetLink}}', 'Resetează parola', BTN_PURPLE, 'rgba(139,92,246,0.28)')}
      ${tplInfoBox('Dacă nu ai solicitat tu resetarea, poți ignora acest email. Parola nu se va schimba fără accesarea linkului. Linkul este valabil <strong>1 oră</strong>.')}
      ${tplLinkFallback('resetLink')}
    </td>
  </tr>
  ${tplFooter()}
`);

const TRANSACTIONAL_META: Record<TransactionalType, {
  label: string;
  emoji: string;
  desc: string;
  vars: string[];
  defaultSubject: string;
  defaultText: string;
  defaultHtml: string;
}> = {
  auth_verify_email: {
    label: 'Verificare adresă email',
    emoji: '✅',
    desc: 'Trimis la înregistrare, pentru confirmarea adresei de email.',
    vars: ['displayName', 'verificationLink'],
    defaultSubject: 'Confirma adresa de e-mail pentru MamiApp',
    defaultText: 'Buna, {{displayName}}. Confirma adresa de e-mail accesand acest link: {{verificationLink}}',
    defaultHtml: DEFAULT_VERIFY_HTML,
  },
  family_invitation: {
    label: 'Invitație familie',
    emoji: '👨‍👩‍👧',
    desc: 'Trimis când un utilizator invită un membru al familiei.',
    vars: ['ownerName', 'role', 'inviteLink'],
    defaultSubject: '{{ownerName}} te-a invitat in MamiApp',
    defaultText: 'Buna. {{ownerName}} te-a invitat in MamiApp cu rolul {{role}}. Accepta invitatia aici: {{inviteLink}}',
    defaultHtml: DEFAULT_INVITE_HTML,
  },
  auth_reset_password: {
    label: 'Resetare parolă',
    emoji: '🔑',
    desc: 'Trimis la cererea de resetare a parolei (implementare custom).',
    vars: ['displayName', 'resetLink'],
    defaultSubject: 'Resetare parola MamiApp',
    defaultText: 'Buna, {{displayName}}. Reseteaza parola accesand acest link (valid 1 ora): {{resetLink}}',
    defaultHtml: DEFAULT_RESET_HTML,
  },
};

const TRANSACTIONAL_TYPES = Object.keys(TRANSACTIONAL_META) as TransactionalType[];

// ─────────────────────────────────────────────────────────────────────────────
// Emailuri automate — retenție (colecția notificationEmails, shell buildBrandedEmail)
// ─────────────────────────────────────────────────────────────────────────────

interface SmartEmail {
  enabled: boolean;
  subject: string;
  html: string;
  dayOffset?: number;
}

const SMART_META: Record<string, { label: string; emoji: string; desc: string; vars: string[] }> = {
  winback: { label: 'Winback (reactivare)', emoji: '💛', desc: 'Trimis la 7/14/30 zile de inactivitate utilizatorilor fără push activ.', vars: ['displayName', 'personalLine', 'subjectLine'] },
  drip_0: { label: 'Onboarding — Ziua 0 (bun venit)', emoji: '👋', desc: 'Trimis în ziua înregistrării.', vars: ['displayName'] },
  drip_1: { label: 'Onboarding — Ziua 2 (asistent AI)', emoji: '🤖', desc: 'Activare: prezintă asistentul AI.', vars: ['displayName'] },
  drip_2: { label: 'Onboarding — Ziua 5 (înregistrări)', emoji: '📊', desc: 'Activare: valoarea logging-ului zilnic.', vars: ['displayName'] },
  drip_3: { label: 'Onboarding — Ziua 8 (Premium)', emoji: '⭐', desc: 'Teaser Premium la finalul primei săptămâni.', vars: ['displayName'] },
};

const DEFAULT_SMART_EMAILS: Record<string, SmartEmail> = {
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

const SMART_IDS = Object.keys(DEFAULT_SMART_EMAILS);

function renderSmartPreview(email: SmartEmail): string {
  const title = fillVars(email.subject).replace(/^[^\p{L}\p{N}]+\s*/u, '');
  return brandedShell(fillVars(email.html), {
    title,
    ctaText: 'Deschide MamiApp',
    footerHtml: UNSUBSCRIBE_FOOTER_PREVIEW,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Remindere medicale (medicalReminderSettings/default, prin callable functions)
// ─────────────────────────────────────────────────────────────────────────────

interface MedicalReminderRule {
  enabled: boolean;
  daysBefore: number[];
  sendPush: boolean;
  sendEmail: boolean;
  emailSubject: string;
  emailHtml: string;
}

interface MedicalReminderSettings {
  vaccine: MedicalReminderRule;
  appointment: MedicalReminderRule;
}

const MEDICAL_META: Record<'vaccine' | 'appointment', { label: string; emoji: string; desc: string; samples: Record<string, string> }> = {
  vaccine: {
    label: 'Reminder vaccin',
    emoji: '💉',
    desc: 'Trimis automat înainte de vaccinurile programate ale copilului.',
    samples: { eventName: 'Vaccinul ROR', daysBefore: '7', childName: 'Mara' },
  },
  appointment: {
    label: 'Reminder programare',
    emoji: '📅',
    desc: 'Trimis automat înainte de programările medicale din sarcină.',
    samples: { eventName: 'Consult obstetric', daysBefore: '2' },
  },
};

function renderMedicalPreview(rule: MedicalReminderRule, kind: 'vaccine' | 'appointment'): string {
  return brandedShell(fillVars(rule.emailHtml, MEDICAL_META[kind].samples), {
    footerHtml: MEDICAL_FOOTER_PREVIEW,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

function PreviewFrame({ html, height = 520 }: { html: string; height?: number }) {
  return (
    <iframe
      title="email-preview"
      sandbox=""
      srcDoc={html}
      style={{ width: '100%', height, border: '1px solid var(--border, #e3dcea)', borderRadius: 12, background: '#fff' }}
    />
  );
}

function VarChips({ vars, braces = 2 }: { vars: string[]; braces?: 1 | 2 }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {vars.map(v => (
        <code key={v} style={{ fontSize: 11, background: 'var(--surface2)', padding: '2px 8px', borderRadius: 6, color: 'var(--text2)' }}>
          {braces === 2 ? `{{${v}}}` : `{${v}}`}
        </code>
      ))}
    </div>
  );
}

type EmailTab = 'transactional' | 'smart' | 'medical';

interface TransactionalState {
  docId?: string;
  name: string;
  subject: string;
  text: string;
  html: string;
  updatedAt?: any;
  customized: boolean;
}

export default function EmailTemplates() {
  const { adminUser } = useAdminStore();
  const [tab, setTab] = useState<EmailTab>('transactional');

  // ── Tranzacționale ──
  const [trans, setTrans] = useState<Record<TransactionalType, TransactionalState>>(() => {
    const initial = {} as Record<TransactionalType, TransactionalState>;
    TRANSACTIONAL_TYPES.forEach(type => {
      const meta = TRANSACTIONAL_META[type];
      initial[type] = { name: meta.label, subject: meta.defaultSubject, text: meta.defaultText, html: meta.defaultHtml, customized: false };
    });
    return initial;
  });
  const [otherTemplates, setOtherTemplates] = useState<EmailTemplate[]>([]);
  const [transLoading, setTransLoading] = useState(true);
  const [transSaving, setTransSaving] = useState<TransactionalType | null>(null);
  const [openType, setOpenType] = useState<TransactionalType | null>('auth_verify_email');
  const [selectedOther, setSelectedOther] = useState<EmailTemplate | null>(null);
  const [otherSaving, setOtherSaving] = useState(false);

  // ── Automate ──
  const [smartEmails, setSmartEmails] = useState<Record<string, SmartEmail>>(DEFAULT_SMART_EMAILS);
  const [smartLoading, setSmartLoading] = useState(true);
  const [smartSaving, setSmartSaving] = useState<string | null>(null);
  const [openSmart, setOpenSmart] = useState<string | null>('winback');

  // ── Medicale ──
  const [medical, setMedical] = useState<MedicalReminderSettings | null>(null);
  const [medicalLoading, setMedicalLoading] = useState(true);
  const [medicalSaving, setMedicalSaving] = useState(false);
  const [openMedical, setOpenMedical] = useState<'vaccine' | 'appointment' | null>('vaccine');

  useEffect(() => {
    (async () => {
      // Template-uri tranzacționale din Firestore (suprascriu fallback-urile din cod)
      try {
        const snap = await getDocs(query(collection(db, 'emailTemplates'), orderBy('updatedAt', 'desc')));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate));
        const claimed = new Set<string>();
        setTrans(prev => {
          const next = { ...prev };
          TRANSACTIONAL_TYPES.forEach(type => {
            const active = docs.find(d => d.type === type && (d as any).isActive === true);
            if (active) {
              claimed.add(active.id);
              next[type] = {
                docId: active.id,
                name: active.name || TRANSACTIONAL_META[type].label,
                subject: active.subject || TRANSACTIONAL_META[type].defaultSubject,
                text: active.text || '',
                html: active.html || TRANSACTIONAL_META[type].defaultHtml,
                updatedAt: (active as any).updatedAt,
                customized: true,
              };
            }
          });
          return next;
        });
        setOtherTemplates(docs.filter(d => !claimed.has(d.id)));
      } catch (err) {
        console.error('Failed to load email templates', err);
      }
      setTransLoading(false);

      // Emailuri automate (retenție)
      try {
        const snap = await getDocs(collection(db, 'notificationEmails'));
        const merged = { ...DEFAULT_SMART_EMAILS };
        snap.docs.forEach(d => {
          if (d.id in merged) merged[d.id] = { ...merged[d.id], ...d.data() } as SmartEmail;
        });
        setSmartEmails(merged);
      } catch (err) {
        console.error('Failed to load smart emails', err);
      }
      setSmartLoading(false);

      // Remindere medicale
      try {
        const call = httpsCallable<void, MedicalReminderSettings>(functions, 'getMedicalReminderSettings');
        const result = await call();
        setMedical(result.data);
      } catch (err) {
        console.error('Failed to load medical reminder settings', err);
      }
      setMedicalLoading(false);
    })();
  }, []);

  // ── Acțiuni tranzacționale ──
  const updateTrans = (type: TransactionalType, changes: Partial<TransactionalState>) => {
    setTrans(prev => ({ ...prev, [type]: { ...prev[type], ...changes } }));
  };

  const resetTrans = (type: TransactionalType) => {
    const meta = TRANSACTIONAL_META[type];
    updateTrans(type, { subject: meta.defaultSubject, text: meta.defaultText, html: meta.defaultHtml });
  };

  const saveTrans = async (type: TransactionalType) => {
    const current = trans[type];
    if (!current.subject.trim() || !current.html.trim()) {
      toast.warning('Completează subiectul și HTML-ul.');
      return;
    }
    setTransSaving(type);
    try {
      const ref = current.docId
        ? doc(db, 'emailTemplates', current.docId)
        : doc(collection(db, 'emailTemplates'));
      await setDoc(ref, {
        name: current.name || TRANSACTIONAL_META[type].label,
        type,
        subject: current.subject.trim(),
        text: current.text || '',
        html: current.html,
        isActive: true,
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
        ...(current.docId ? {} : { createdAt: serverTimestamp(), createdBy: adminUser?.email || '' }),
      }, { merge: true });
      await logAudit(current.docId ? 'update_email_template' : 'create_email_template', 'email_template', ref.id).catch(() => {});
      updateTrans(type, { docId: ref.id, customized: true });
      toast.success(`Template "${TRANSACTIONAL_META[type].label}" salvat.`);
    } catch (err) {
      console.error(err);
      toast.error('Nu am putut salva template-ul.');
    }
    setTransSaving(null);
  };

  const saveOther = async () => {
    if (!selectedOther?.name?.trim() || !selectedOther.subject?.trim() || !selectedOther.html?.trim()) {
      toast.warning('Completează numele, subiectul și HTML-ul.');
      return;
    }
    setOtherSaving(true);
    try {
      const ref = doc(db, 'emailTemplates', selectedOther.id);
      await setDoc(ref, {
        name: selectedOther.name.trim(),
        type: selectedOther.type,
        subject: selectedOther.subject.trim(),
        html: selectedOther.html,
        text: selectedOther.text || '',
        isActive: (selectedOther as any).isActive !== false,
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit('update_email_template', 'email_template', ref.id).catch(() => {});
      setOtherTemplates(prev => prev.map(t => t.id === selectedOther.id ? selectedOther : t));
      setSelectedOther(null);
      toast.success('Template salvat.');
    } catch (err) {
      console.error(err);
      toast.error('Nu am putut salva template-ul.');
    } finally {
      setOtherSaving(false);
    }
  };

  // ── Acțiuni automate ──
  const updateSmart = (id: string, changes: Partial<SmartEmail>) => {
    setSmartEmails(prev => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  const saveSmart = async (id: string) => {
    setSmartSaving(id);
    try {
      await setDoc(doc(db, 'notificationEmails', id), {
        ...smartEmails[id],
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit('save_smart_email', 'notification_email', id).catch(() => {});
      toast.success(`Email "${SMART_META[id]?.label || id}" salvat.`);
    } catch (err) {
      console.error(err);
      toast.error('Nu am putut salva emailul.');
    }
    setSmartSaving(null);
  };

  // ── Acțiuni medicale ──
  const updateMedicalRule = (kind: 'vaccine' | 'appointment', changes: Partial<MedicalReminderRule>) => {
    setMedical(prev => prev ? { ...prev, [kind]: { ...prev[kind], ...changes } } : prev);
  };

  const saveMedical = async () => {
    if (!medical) return;
    setMedicalSaving(true);
    try {
      const call = httpsCallable<MedicalReminderSettings, MedicalReminderSettings>(functions, 'saveMedicalReminderSettings');
      const result = await call(medical);
      setMedical(result.data);
      await logAudit('save_medical_reminder_settings', 'medical_reminders', 'default').catch(() => {});
      toast.success('Reminderele medicale au fost salvate.');
    } catch (err) {
      console.error(err);
      toast.error('Nu am putut salva reminderele medicale.');
    }
    setMedicalSaving(false);
  };

  // ── Render helpers ──
  const editorGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginTop: 14 };

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>✉️ Emailuri</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
          Toate emailurile trimise de MamiApp — previzualizare exactă și editare. Modificările salvate aici sunt folosite de Cloud Functions la următoarea trimitere.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          ['transactional', '📬 Tranzacționale'],
          ['smart', '🔁 Automate (retenție)'],
          ['medical', '🩺 Remindere medicale'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === key ? 'var(--accent)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--text2)',
              transition: 'background 0.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── Tranzacționale ── */}
      {tab === 'transactional' && (
        transLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            {TRANSACTIONAL_TYPES.map(type => {
              const meta = TRANSACTIONAL_META[type];
              const state = trans[type];
              const isOpen = openType === type;
              return (
                <div key={type} className="card" style={{ marginBottom: 12, padding: 18 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setOpenType(isOpen ? null : type)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</div>
                        <div style={{ color: 'var(--text2)', fontSize: 12 }}>{meta.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${state.customized ? 'badge-blue' : 'badge-gray'}`}>
                        {state.customized ? 'Personalizat' : 'Implicit (din cod)'}
                      </span>
                      {state.updatedAt ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDateTime(state.updatedAt)}</span> : null}
                      <span style={{ color: 'var(--text3)', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={editorGrid}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Subiect
                          <input className="input" style={{ marginTop: 4 }} value={state.subject} onChange={e => updateTrans(type, { subject: e.target.value })} />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Text simplu (fallback)
                          <textarea className="input" style={{ marginTop: 4, minHeight: 64 }} value={state.text} onChange={e => updateTrans(type, { text: e.target.value })} />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>HTML
                          <textarea className="input" style={{ marginTop: 4, minHeight: 340, fontFamily: 'monospace', fontSize: 11 }} value={state.html} onChange={e => updateTrans(type, { html: e.target.value })} />
                        </label>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Variabile disponibile:</span>
                          <VarChips vars={meta.vars} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => resetTrans(type)}>Resetează la implicit</button>
                          <button className="btn btn-primary btn-sm" onClick={() => saveTrans(type)} disabled={transSaving === type}>
                            {transSaving === type ? 'Se salvează...' : 'Salvează'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                          Previzualizare — subiect: <span style={{ fontWeight: 400 }}>{fillVars(state.subject)}</span>
                        </div>
                        <PreviewFrame html={fillVars(state.html)} height={560} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {otherTemplates.length > 0 && (
              <div className="card" style={{ padding: 0, marginTop: 20 }}>
                <div style={{ padding: '14px 18px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border, #e3dcea)' }}>
                  Alte template-uri din Firestore
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Nume</th><th>Tip</th><th>Subiect</th><th>Status</th><th>Actualizat</th><th>Acțiuni</th></tr>
                    </thead>
                    <tbody>
                      {otherTemplates.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 700 }}>{t.name}</td>
                          <td><span className="badge badge-blue">{t.type}</span></td>
                          <td style={{ color: 'var(--text2)', fontSize: 12 }}>{t.subject}</td>
                          <td><span className={`badge ${(t as any).isActive ? 'badge-green' : 'badge-gray'}`}>{(t as any).isActive ? 'Activ' : 'Inactiv'}</span></td>
                          <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDateTime((t as any).updatedAt)}</td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => setSelectedOther(t)}>Editează</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* ── Automate (retenție) ── */}
      {tab === 'smart' && (
        smartLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              Corpul emailului este împachetat automat în șablonul vizual MamiApp (logo, titlu, buton „Deschide MamiApp", footer de dezabonare) — previzualizarea arată emailul final.
            </p>
            {SMART_IDS.map(id => {
              const meta = SMART_META[id];
              const email = smartEmails[id];
              const isOpen = openSmart === id;
              return (
                <div key={id} className="card" style={{ marginBottom: 12, padding: 18 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setOpenSmart(isOpen ? null : id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</div>
                        <div style={{ color: 'var(--text2)', fontSize: 12 }}>{meta.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${email.enabled ? 'badge-green' : 'badge-gray'}`}>{email.enabled ? 'Activ' : 'Oprit'}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={editorGrid}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                          <input type="checkbox" checked={email.enabled} onChange={e => updateSmart(id, { enabled: e.target.checked })} />
                          Activ
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Subiect
                          <input className="input" style={{ marginTop: 4 }} value={email.subject} onChange={e => updateSmart(id, { subject: e.target.value })} />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Conținut HTML (doar corpul)
                          <textarea className="input" style={{ marginTop: 4, minHeight: 220, fontFamily: 'monospace', fontSize: 11 }} value={email.html} onChange={e => updateSmart(id, { html: e.target.value })} />
                        </label>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Variabile disponibile:</span>
                          <VarChips vars={meta.vars} braces={1} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => updateSmart(id, { ...DEFAULT_SMART_EMAILS[id] })}>Resetează la implicit</button>
                          <button className="btn btn-primary btn-sm" onClick={() => saveSmart(id)} disabled={smartSaving === id}>
                            {smartSaving === id ? 'Se salvează...' : 'Salvează'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                          Previzualizare — subiect: <span style={{ fontWeight: 400 }}>{fillVars(email.subject)}</span>
                        </div>
                        <PreviewFrame html={renderSmartPreview(email)} height={520} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )
      )}

      {/* ── Remindere medicale ── */}
      {tab === 'medical' && (
        medicalLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : !medical ? (
          <div className="card" style={{ padding: 24, color: 'var(--text2)', fontSize: 13 }}>
            Nu am putut încărca setările reminderelor medicale. Reîncarcă pagina.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Aici editezi doar subiectul și conținutul emailurilor. Pragurile de zile și canalele se configurează în <strong>Campanii → Automatizări medicale</strong>. Conținutul este împachetat automat în șablonul vizual MamiApp (logo + card alb).
              </p>
              <button className="btn btn-primary" onClick={saveMedical} disabled={medicalSaving}>
                {medicalSaving ? 'Se salvează...' : 'Salvează tot'}
              </button>
            </div>
            {(['vaccine', 'appointment'] as const).map(kind => {
              const meta = MEDICAL_META[kind];
              const rule = medical[kind];
              const isOpen = openMedical === kind;
              return (
                <div key={kind} className="card" style={{ marginBottom: 12, padding: 18 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setOpenMedical(isOpen ? null : kind)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</div>
                        <div style={{ color: 'var(--text2)', fontSize: 12 }}>{meta.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${rule.enabled && rule.sendEmail ? 'badge-green' : 'badge-gray'}`}>
                        {rule.enabled && rule.sendEmail ? 'Email activ' : 'Email oprit'}
                      </span>
                      <span style={{ color: 'var(--text3)', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={editorGrid}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Subiect
                          <input className="input" style={{ marginTop: 4 }} value={rule.emailSubject} onChange={e => updateMedicalRule(kind, { emailSubject: e.target.value })} />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Conținut HTML (doar corpul)
                          <textarea className="input" style={{ marginTop: 4, minHeight: 220, fontFamily: 'monospace', fontSize: 11 }} value={rule.emailHtml} onChange={e => updateMedicalRule(kind, { emailHtml: e.target.value })} />
                        </label>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Variabile disponibile:</span>
                          <VarChips vars={['parentName', 'childName', 'eventName', 'eventDate', 'daysBefore']} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                          Previzualizare — subiect: <span style={{ fontWeight: 400 }}>{fillVars(rule.emailSubject, meta.samples)}</span>
                        </div>
                        <PreviewFrame html={renderMedicalPreview(rule, kind)} height={480} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )
      )}

      {/* Modal editare template custom */}
      {selectedOther && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedOther(null); }}>
          <div className="modal" style={{ maxWidth: 1100 }}>
            <h2 className="modal-title">Editează template</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" placeholder="Nume" value={selectedOther.name} onChange={e => setSelectedOther(p => p && ({ ...p, name: e.target.value }))} />
                <input className="input" placeholder="Subiect" value={selectedOther.subject} onChange={e => setSelectedOther(p => p && ({ ...p, subject: e.target.value }))} />
                <textarea className="input" placeholder="Text plain" value={selectedOther.text || ''} onChange={e => setSelectedOther(p => p && ({ ...p, text: e.target.value }))} style={{ minHeight: 60 }} />
                <textarea className="input" placeholder="HTML" value={selectedOther.html} onChange={e => setSelectedOther(p => p && ({ ...p, html: e.target.value }))} style={{ minHeight: 300, fontFamily: 'monospace', fontSize: 11 }} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={(selectedOther as any).isActive !== false} onChange={e => setSelectedOther(p => p && ({ ...p, isActive: e.target.checked } as any))} />
                  Activ
                </label>
              </div>
              <PreviewFrame html={fillVars(selectedOther.html)} height={500} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedOther(null)}>Anulează</button>
              <button className="btn btn-primary" onClick={saveOther} disabled={otherSaving}>{otherSaving ? 'Se salvează...' : 'Salvează'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
