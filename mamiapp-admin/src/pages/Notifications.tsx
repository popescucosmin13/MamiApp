// src/pages/Notifications.tsx — Campanii notificări push & email
import { useEffect, useState } from 'react';
import { toast } from "../lib/toast";
import { confirmDialog } from "../lib/confirm";
import { collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { logAudit, fmtDateTime } from '../lib/utils';
import { useAdminStore } from '../store/adminStore';
import type { AppUser, EmailTemplate, NotificationCampaign } from '../types';

interface EmailCampaign {
  id: string;
  subject: string;
  htmlBody: string;
  targetAudience: string;
  targetUid?: string;
  targetUserName?: string;
  targetEmail?: string;
  inactiveDays?: number;
  status: string;
  createdBy: string;
  createdAt?: any;
  scheduledAt?: any;
  sentCount?: number;
  failedCount?: number;
  audienceSize?: number;
}

interface EmailUnsubscribe {
  id: string;
  email: string;
  uid?: string | null;
  campaignId?: string | null;
  source?: string;
  unsubscribedAt?: any;
}

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

const DEFAULT_MEDICAL_SETTINGS: MedicalReminderSettings = {
  vaccine: {
    enabled: true, daysBefore: [7], sendPush: true, sendEmail: true,
    emailSubject: 'Vaccin programat: {{eventName}}',
    emailHtml: '<h2>Buna, {{parentName}}!</h2><p>Pentru {{childName}} urmeaza <strong>{{eventName}}</strong> pe <strong>{{eventDate}}</strong>.</p><p>Mai sunt {{daysBefore}} zile. Verifica detaliile in MamiApp.</p>',
  },
  appointment: {
    enabled: true, daysBefore: [2, 1], sendPush: true, sendEmail: true,
    emailSubject: 'Programare medicala in {{daysBefore}} zile',
    emailHtml: '<h2>Buna, {{parentName}}!</h2><p>Ai programarea <strong>{{eventName}}</strong> pe <strong>{{eventDate}}</strong>.</p><p>Mai sunt {{daysBefore}} zile. Gasesti detaliile in MamiApp.</p>',
  },
};

const MEDICAL_DAY_CHOICES = [14, 7, 3, 2, 1, 0];

const AUDIENCES = [
  { key: 'google_play',     label: 'Google Play Android' },
  { key: 'android_native',  label: 'Android native' },
  { key: 'all',             label: '🌐 Toți utilizatorii cu push activ' },
  { key: 'premium',         label: '💎 Doar premium' },
  { key: 'pregnancy',       label: '🌸 Mame însărcinate' },
  { key: 'child',           label: '👶 Profil copil' },
  { key: 'inactive_custom', label: '😴 Inactivi X zile' },
  { key: 'user_uid',        label: '👤 Utilizator individual' },
  { key: 'trimester3',      label: '🤱 Trimestrul 3' },
  { key: 'child_0_6',       label: '👶 Copii 0-6 luni' },
  { key: 'inactive_30',     label: '😴 Inactivi 30 zile' },
  { key: 'romania',         label: '🇷🇴 Doar România' },
];

const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES.map(a => [a.key, a.label]));
const EMAIL_AUDIENCES = [
  ...AUDIENCES,
  { key: 'target_email', label: 'Email specific' },
];
const EMAIL_AUDIENCE_LABEL = Object.fromEntries(EMAIL_AUDIENCES.map(a => [a.key, a.label]));
const EMAIL_PICKER_LIMIT = 80;

function isPwaInstalled(user: AppUser): boolean {
  const platform = user.platform?.toLowerCase() || '';
  return user.isPWA === true || platform.includes('pwa') || Boolean(user.webPushToken);
}

function getPwaPlatformLabel(user: AppUser): string {
  const platform = user.platform?.toLowerCase() || '';
  if (platform.includes('ios')) return 'PWA iOS';
  if (platform.includes('android')) return 'PWA Android';
  if (platform.includes('windows')) return 'PWA Windows';
  if (platform.includes('mac')) return 'PWA macOS';
  if (platform.includes('linux')) return 'PWA Linux';
  if (isPwaInstalled(user)) return 'PWA';
  return '';
}

function getAppPlatformLabel(user: AppUser): string {
  if (user.appInstallSource === 'google_play') return 'Google Play Android';
  const platform = (user.appPlatform || user.platform || '').toLowerCase();
  if (platform.includes('ios')) return 'iOS';
  if (platform.includes('android')) return 'Android';
  if (platform.includes('web')) return 'Web';
  if (platform.includes('windows')) return 'Windows';
  if (platform.includes('mac')) return 'macOS';
  if (platform.includes('linux')) return 'Linux';
  return user.appPlatform || user.platform || 'Necunoscuta';
}

function getUserPlatformSummary(user: AppUser): string {
  const labels = [getAppPlatformLabel(user), getPwaPlatformLabel(user)].filter(Boolean);
  return Array.from(new Set(labels)).join(' + ') || 'Necunoscuta';
}

function isEmailUnsubscribed(user: AppUser, unsubscribedEmails: Set<string>): boolean {
  return (
    user.emailMarketingUnsubscribed === true ||
    user.emailPreferences?.marketing === false ||
    unsubscribedEmails.has(user.email?.trim().toLowerCase() || '')
  );
}

async function loadUsersForNotifications(): Promise<AppUser[]> {
  const getAdminUsers = httpsCallable<Record<string, never>, { users: AppUser[] }>(functions, 'getAdminUsers');

  try {
    const result = await getAdminUsers({});
    const callableUsers = result.data.users.filter(user => Boolean(user.email));
    if (callableUsers.length > 0) return callableUsers;
  } catch (error) {
    console.error('Failed to load admin users through Cloud Function:', error);
  }

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    return usersSnap.docs
      .map(userDoc => {
        const data = userDoc.data() as Partial<AppUser>;
        return {
          ...data,
          uid: userDoc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          profileMode: data.profileMode || 'child',
          subscription: data.subscription || { plan: 'free', status: 'inactive' },
          createdAt: data.createdAt || null,
          onboardingCompleted: data.onboardingCompleted === true,
          locale: data.locale || 'ro',
        } as AppUser;
      })
      .filter(user => Boolean(user.email));
  } catch (error) {
    console.error('Failed to load users directly from Firestore:', error);
    return [];
  }
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray', scheduled: 'badge-blue', sent: 'badge-green', cancelled: 'badge-red',
};

const EMPTY_FORM = {
  title: '', body: '', targetAudience: 'all', scheduleAt: '',
  targetUid: '', targetUserName: '', inactiveDays: '30',
};

const EMPTY_EMAIL_FORM = {
  subject: '', htmlBody: '', targetAudience: 'all', scheduleAt: '',
  targetUid: '', targetUserName: '', targetEmail: '', inactiveDays: '30',
  saveAsTemplate: true, templateName: '',
};

export default function Notifications() {
  const { adminUser } = useAdminStore();
  const [activeTab, setActiveTab] = useState<'push' | 'email' | 'medical'>('push');
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailUnsubscribes, setEmailUnsubscribes] = useState<EmailUnsubscribe[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [emailUserSearch, setEmailUserSearch] = useState('');
  const [emailDirectorySearch, setEmailDirectorySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [emailForm, setEmailForm] = useState(EMPTY_EMAIL_FORM);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [medicalSettings, setMedicalSettings] = useState<MedicalReminderSettings>(DEFAULT_MEDICAL_SETTINGS);
  const [medicalLoading, setMedicalLoading] = useState(true);
  const [medicalSaving, setMedicalSaving] = useState(false);
  const [medicalTestEmail, setMedicalTestEmail] = useState('');
  const [medicalTestSending, setMedicalTestSending] = useState<'vaccine' | 'appointment' | null>(null);

  const load = async () => {
    setLoading(true);
    setUsersLoading(true);
    try {
      const [pushResult, emailResult, templatesResult, unsubscribesResult, usersResult] = await Promise.allSettled([
        getDocs(query(collection(db, 'notificationCampaigns'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'emailCampaigns'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'emailTemplates'), orderBy('updatedAt', 'desc'))),
        getDocs(query(collection(db, 'emailUnsubscribes'), orderBy('unsubscribedAt', 'desc'))),
        loadUsersForNotifications(),
      ]);
      if (pushResult.status === 'fulfilled') {
        setCampaigns(pushResult.value.docs.map(d => ({ id: d.id, ...d.data() } as NotificationCampaign)));
      } else {
        console.error('Failed to load push campaigns:', pushResult.reason);
      }
      if (emailResult.status === 'fulfilled') {
        setEmailCampaigns(emailResult.value.docs.map(d => ({ id: d.id, ...d.data() } as EmailCampaign)));
      } else {
        console.error('Failed to load email campaigns:', emailResult.reason);
      }
      if (templatesResult.status === 'fulfilled') {
        setEmailTemplates(templatesResult.value.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate)));
      } else {
        console.error('Failed to load email templates:', templatesResult.reason);
      }
      if (unsubscribesResult.status === 'fulfilled') {
        setEmailUnsubscribes(unsubscribesResult.value.docs.map(d => ({ id: d.id, ...d.data() } as EmailUnsubscribe)));
      } else {
        console.error('Failed to load email unsubscribes:', unsubscribesResult.reason);
      }
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        console.error('Failed to load users for notifications:', usersResult.reason);
        setUsers([]);
      }
    } catch { }
    setLoading(false);
    setUsersLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const loadMedicalSettings = async () => {
      try {
        const getMedicalReminderSettings = httpsCallable<Record<string, never>, MedicalReminderSettings>(functions, 'getMedicalReminderSettings');
        const result = await getMedicalReminderSettings({});
        setMedicalSettings(result.data);
      } catch (error) {
        console.error('Failed to load medical reminder settings:', error);
      } finally {
        setMedicalLoading(false);
      }
    };
    void loadMedicalSettings();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.warning('Completează titlul și mesajul.'); return; }
    if (form.targetAudience === 'user_uid' && !form.targetUid.trim()) {
      { toast.warning('Completează UID-ul utilizatorului.'); return; }
    }
    setSaving(true);
    try {
      const ref = doc(collection(db, 'notificationCampaigns'));
      const campaign: any = {
        title: form.title.trim(),
        body: form.body.trim(),
        targetAudience: form.targetAudience,
        status: form.scheduleAt ? 'scheduled' : 'draft',
        createdBy: adminUser?.email || '',
        createdAt: serverTimestamp(),
      };
      if (form.scheduleAt) campaign.scheduledAt = new Date(form.scheduleAt);
      if (form.targetAudience === 'user_uid') {
        campaign.targetUid = form.targetUid.trim();
        if (form.targetUserName.trim()) campaign.targetUserName = form.targetUserName.trim();
      }
      if (form.targetAudience === 'inactive_custom') {
        campaign.inactiveDays = parseInt(form.inactiveDays) || 30;
      }

      await setDoc(ref, campaign);
      try { await logAudit('create_campaign', 'notification_campaign', ref.id); } catch { }
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      console.error('Error creating campaign:', e);
      toast.error('Eroare la creare.');
    }
    setSaving(false);
  };

  const cancel = async (c: NotificationCampaign) => {
    if (!(await confirmDialog({ title: 'Anulezi campania?' }))) return;
    await updateDoc(doc(db, 'notificationCampaigns', c.id), { status: 'cancelled' });
    try { await logAudit('cancel_campaign', 'notification_campaign', c.id); } catch { }
    load();
  };

  const sendNow = async (c: NotificationCampaign) => {
    if (!(await confirmDialog({ title: 'Ești sigur că vrei să trimiți această notificare ACUM?' }))) return;
    setSendingId(c.id);
    try {
      const sendCampaign = httpsCallable<{ campaignId: string }, { sentCount: number; failedCount: number }>(
        functions, 'sendNotificationCampaign'
      );
      const result = await sendCampaign({ campaignId: c.id });
      try { await logAudit('send_campaign', 'notification_campaign', c.id); } catch { }
      toast.success(`✅ Trimis: ${result.data.sentCount} notificări${result.data.failedCount ? `, ${result.data.failedCount} eșuate` : ''}.`);
      load();
    } catch (e) {
      console.error('Error sending campaign:', e);
      toast.error('Eroare la trimitere. Verifică dacă funcția sendNotificationCampaign este deployată.');
    } finally {
      setSendingId(null);
    }
  };

  const remove = async (c: NotificationCampaign) => {
    if (!(await confirmDialog({ title: `Stergi definitiv notificarea "${c.title}"?` }))) return;
    await deleteDoc(doc(db, 'notificationCampaigns', c.id));
    try { await logAudit('delete_campaign', 'notification_campaign', c.id); } catch { }
    load();
  };

  const handleCreateEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.htmlBody.trim()) { toast.warning('Completează subiectul și conținutul email-ului.'); return; }
    if (emailForm.targetAudience === 'user_uid' && !emailForm.targetUid.trim()) {
      { toast.warning('Alege utilizatorul din lista de emailuri.'); return; }
    }
    if (emailForm.targetAudience === 'target_email') {
      const email = emailForm.targetEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        { toast.warning('Completeaza o adresa de email valida.'); return; }
      }
    }
    setSaving(true);
    try {
      const ref = doc(collection(db, 'emailCampaigns'));
      const campaign: any = {
        subject: emailForm.subject.trim(),
        htmlBody: emailForm.htmlBody.trim(),
        targetAudience: emailForm.targetAudience,
        status: 'draft',
        createdBy: adminUser?.email || '',
        createdAt: serverTimestamp(),
      };
      if (emailForm.targetAudience === 'user_uid') {
        campaign.targetUid = emailForm.targetUid.trim();
        if (emailForm.targetEmail.trim()) campaign.targetEmail = emailForm.targetEmail.trim().toLowerCase();
        if (emailForm.targetUserName.trim()) campaign.targetUserName = emailForm.targetUserName.trim();
      }
      if (emailForm.targetAudience === 'target_email') {
        campaign.targetEmail = emailForm.targetEmail.trim().toLowerCase();
      }
      if (emailForm.targetAudience === 'inactive_custom') {
        campaign.inactiveDays = parseInt(emailForm.inactiveDays) || 30;
      }
      await setDoc(ref, campaign);
      if (emailForm.saveAsTemplate) {
        await saveEmailTemplateFromDraft(ref.id);
      }
      try { await logAudit('create_email_campaign', 'email_campaign', ref.id); } catch { }
      setShowCreate(false);
      setEmailForm(EMPTY_EMAIL_FORM);
      load();
    } catch (e) {
      console.error('Error creating email campaign:', e);
      toast.error('Eroare la creare.');
    }
    setSaving(false);
  };

  const saveEmailTemplate = async (template: {
    name: string;
    subject: string;
    html: string;
    sourceCampaignId?: string;
  }) => {
    if (!template.subject.trim() || !template.html.trim()) return;
    const ref = doc(collection(db, 'emailTemplates'));
    await setDoc(ref, {
      name: template.name.trim() || template.subject.trim(),
      type: 'marketing',
      subject: template.subject.trim(),
      html: template.html,
      text: '',
      isActive: true,
      sourceCampaignId: template.sourceCampaignId || null,
      createdAt: serverTimestamp(),
      createdBy: adminUser?.email || '',
      updatedAt: serverTimestamp(),
      updatedBy: adminUser?.email || '',
    });
    await logAudit('create_email_template', 'email_template', ref.id).catch(() => {});
  };

  const saveEmailTemplateFromDraft = async (sourceCampaignId?: string) => {
    await saveEmailTemplate({
      name: emailForm.templateName.trim() || emailForm.subject.trim(),
      subject: emailForm.subject,
      html: emailForm.htmlBody,
      sourceCampaignId,
    });
  };

  const saveCampaignAsTemplate = async (campaign: EmailCampaign) => {
    try {
      await saveEmailTemplate({
        name: campaign.subject,
        subject: campaign.subject,
        html: campaign.htmlBody,
        sourceCampaignId: campaign.id,
      });
      toast.success('Template salvat in biblioteca.');
      load();
    } catch (error) {
      console.error('saveCampaignAsTemplate error:', error);
      toast.error('Nu am putut salva template-ul.');
    }
  };

  const useTemplate = (template: Pick<EmailTemplate, 'name' | 'subject' | 'html'>) => {
    setEmailForm(p => ({
      ...p,
      subject: template.subject,
      htmlBody: template.html,
      templateName: template.name || template.subject,
    }));
    setActiveTab('email');
    setShowCreate(true);
  };

  const useCampaignAsDraft = (campaign: EmailCampaign) => {
    setEmailForm({
      ...EMPTY_EMAIL_FORM,
      subject: campaign.subject,
      htmlBody: campaign.htmlBody,
      targetAudience: campaign.targetAudience || 'all',
      targetUid: campaign.targetUid || '',
      targetUserName: campaign.targetUserName || '',
      targetEmail: campaign.targetEmail || '',
      inactiveDays: String(campaign.inactiveDays || 30),
      templateName: campaign.subject,
      saveAsTemplate: false,
    });
    setActiveTab('email');
    setShowCreate(true);
  };

  const sendEmailNow = async (c: EmailCampaign) => {
    if (!(await confirmDialog({ title: 'Ești sigur că vrei să trimiți emailurile ACUM?' }))) return;
    setSendingId(c.id);
    try {
      const sendCampaign = httpsCallable<{ campaignId: string }, { sentCount: number; failedCount: number; skippedUnsubscribedCount?: number; audienceSize: number }>(
        functions, 'sendEmailCampaign'
      );
      const result = await sendCampaign({ campaignId: c.id });
      try { await logAudit('send_email_campaign', 'email_campaign', c.id); } catch { }
      toast.success(`✅ Email-uri trimise: ${result.data.sentCount}${result.data.failedCount ? `, ${result.data.failedCount} eșuate` : ''}${result.data.skippedUnsubscribedCount ? `, ${result.data.skippedUnsubscribedCount} dezabonate sarite` : ''}.`);
      load();
    } catch (e) {
      console.error('Error sending email campaign:', e);
      toast.error('Eroare la trimitere. Verifică dacă funcția sendEmailCampaign este deployată.');
    } finally {
      setSendingId(null);
    }
  };

  const removeEmail = async (c: EmailCampaign) => {
    if (!(await confirmDialog({ title: `Stergi definitiv campania email "${c.subject}"?` }))) return;
    await deleteDoc(doc(db, 'emailCampaigns', c.id));
    try { await logAudit('delete_email_campaign', 'email_campaign', c.id); } catch { }
    load();
  };

  const resubscribeEmail = async (item: EmailUnsubscribe) => {
    if (!(await confirmDialog({ title: `Reabonezi ${item.email} la emailurile de campanie?` }))) return;

    try {
      await deleteDoc(doc(db, 'emailUnsubscribes', item.id));
      if (item.uid) {
        await setDoc(doc(db, 'users', item.uid), {
          emailMarketingUnsubscribed: false,
          emailMarketingUnsubscribedAt: deleteField(),
          emailMarketingResubscribedAt: serverTimestamp(),
          emailPreferences: {
            marketing: true,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await logAudit('resubscribe_email', 'email_unsubscribe', item.id, `Email reabonat: ${item.email}`).catch(() => {});
      load();
    } catch (error) {
      console.error('resubscribeEmail error:', error);
      toast.error('Nu am putut reabona acest email.');
    }
  };

  const audienceMeta = (c: NotificationCampaign) => {
    if (c.targetAudience === 'user_uid') {
      const name = (c as any).targetUserName || '';
      const uid  = (c as any).targetUid || '';
      return { label: `👤 ${name || uid}`, detail: uid };
    }
    if (c.targetAudience === 'inactive_custom') {
      return { label: `😴 Inactivi ${(c as any).inactiveDays || 30} zile`, detail: null };
    }
    return { label: AUDIENCE_LABEL[c.targetAudience] || c.targetAudience, detail: null };
  };

  const emailAudienceMeta = (c: EmailCampaign) => {
    if (c.targetAudience === 'user_uid') {
      const name = c.targetUserName || '';
      const uid = c.targetUid || '';
      return { label: `👤 ${name || uid}`, detail: uid };
    }
    if (c.targetAudience === 'target_email') {
      return { label: 'Email specific', detail: c.targetEmail || null };
    }
    if (c.targetAudience === 'inactive_custom') {
      return { label: `😴 Inactivi ${c.inactiveDays || 30} zile`, detail: null };
    }
    return { label: EMAIL_AUDIENCE_LABEL[c.targetAudience] || c.targetAudience, detail: null };
  };

  const emailPickerUsers = users
    .filter(user => {
      const term = emailUserSearch.trim().toLowerCase();
      if (!term) return true;
      return (
        user.email?.toLowerCase().includes(term) ||
        user.displayName?.toLowerCase().includes(term) ||
        user.uid.toLowerCase().includes(term)
      );
    })
    .slice(0, EMAIL_PICKER_LIMIT);

  const emailDirectoryUsers = users.filter(user => {
    const term = emailDirectorySearch.trim().toLowerCase();
    if (!term) return true;
    return (
      user.email?.toLowerCase().includes(term) ||
      user.displayName?.toLowerCase().includes(term) ||
      getUserPlatformSummary(user).toLowerCase().includes(term)
    );
  });

  const selectedEmailUser = users.find(user => user.uid === emailForm.targetUid);
  const unsubscribedEmailSet = new Set(emailUnsubscribes.map(item => item.email.trim().toLowerCase()));

  const updateMedicalRule = (kind: keyof MedicalReminderSettings, changes: Partial<MedicalReminderRule>) => {
    setMedicalSettings((current) => ({ ...current, [kind]: { ...current[kind], ...changes } }));
  };

  const toggleMedicalDay = (kind: keyof MedicalReminderSettings, day: number) => {
    const current = medicalSettings[kind].daysBefore;
    const daysBefore = current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => b - a);
    updateMedicalRule(kind, { daysBefore: daysBefore.length ? daysBefore : current });
  };

  const saveMedicalSettings = async () => {
    setMedicalSaving(true);
    try {
      const saveMedicalReminderSettings = httpsCallable<MedicalReminderSettings, MedicalReminderSettings>(functions, 'saveMedicalReminderSettings');
      const result = await saveMedicalReminderSettings(medicalSettings);
      setMedicalSettings(result.data);
      await logAudit('save_medical_reminder_settings', 'medical_reminder_settings', 'default');
      toast.success('Automatizarile medicale au fost salvate.');
    } catch (error) {
      console.error('Failed to save medical reminders:', error);
      toast.error('Nu am putut salva automatizarile medicale. Verifica daca functia este publicata.');
    } finally {
      setMedicalSaving(false);
    }
  };

  const sendMedicalTest = async (kind: 'vaccine' | 'appointment') => {
    const email = medicalTestEmail.trim() || adminUser?.email || '';
    if (!email) { toast.warning('Introdu adresa la care vrei sa trimiti testul.'); return; }
    setMedicalTestSending(kind);
    try {
      const sendMedicalReminderTest = httpsCallable<{ email: string; kind: typeof kind; rule: MedicalReminderRule }, { ok: boolean; email: string }>(functions, 'sendMedicalReminderTest');
      const result = await sendMedicalReminderTest({ email, kind, rule: medicalSettings[kind] });
      toast.success(`Emailul de test a fost pus in coada pentru ${result.data.email}.`);
    } catch (error) {
      console.error('Failed to send medical test email:', error);
      toast.error('Nu am putut pune emailul de test in coada.');
    } finally {
      setMedicalTestSending(null);
    }
  };

  const medicalPreview = (rule: MedicalReminderRule, kind: 'vaccine' | 'appointment') => {
    const values: Record<string, string> = {
      parentName: 'Ana', childName: 'Mara', eventName: kind === 'vaccine' ? 'Vaccinul ROR' : 'Consult obstetric', eventDate: '18 iulie 2026', daysBefore: kind === 'vaccine' ? '7' : '2',
    };
    return Object.entries(values).reduce((html, [key, value]) => html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value), rule.emailHtml);
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>📣 Campanii</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Notificări push și emailuri segmentate</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Campanie nouă</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([['push', '🔔 Push'], ['email', '✉️ Email'], ['medical', '🩺 Automatizari medicale']] as const).map(([key, label]) => (
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

      {/* ── Push Campaigns table ── */}
      {activeTab === 'medical' && (
        <div className="medical-reminders-page">
          <div className="medical-reminders-intro">
            <div><strong>Automatizari medicale</strong><span>Jobul ruleaza zilnic la 09:00, ora Romaniei. Fiecare eveniment este trimis o singura data pentru fiecare prag selectat.</span></div>
            <div className="medical-intro-actions"><input className="input" placeholder={adminUser?.email || 'email pentru test'} value={medicalTestEmail} onChange={(event) => setMedicalTestEmail(event.target.value)} /><button className="btn btn-ghost btn-sm" onClick={() => sendMedicalTest('vaccine')} disabled={medicalTestSending !== null}>{medicalTestSending === 'vaccine' ? 'Se trimite...' : 'Test vaccin'}</button><button className="btn btn-ghost btn-sm" onClick={() => sendMedicalTest('appointment')} disabled={medicalTestSending !== null}>{medicalTestSending === 'appointment' ? 'Se trimite...' : 'Test programare'}</button><button className="btn btn-primary" onClick={saveMedicalSettings} disabled={medicalSaving || medicalLoading}>{medicalSaving ? 'Se salveaza...' : 'Salveaza'}</button></div>
          </div>
          {medicalLoading ? <div className="center-loader"><div className="spinner" /></div> : (['vaccine', 'appointment'] as const).map((kind) => {
            const rule = medicalSettings[kind];
            const isVaccine = kind === 'vaccine';
            return <section className="medical-reminder-card" key={kind}>
              <div className="medical-reminder-heading"><div><h2>{isVaccine ? 'Vaccinuri copil' : 'Programari sarcina'}</h2><p>{isVaccine ? 'Include denumirea vaccinului si copilul in email.' : 'Include tipul programarii si data ei in email.'}</p></div><label className="medical-switch"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateMedicalRule(kind, { enabled: event.target.checked })} /><span>{rule.enabled ? 'Activ' : 'Oprit'}</span></label></div>
              <div className="medical-rule-grid">
                <div>
                  <span className="medical-field-label">Trimite inainte cu</span>
                  <div className="medical-day-options">{MEDICAL_DAY_CHOICES.map((day) => <label key={day}><input type="checkbox" checked={rule.daysBefore.includes(day)} onChange={() => toggleMedicalDay(kind, day)} />{day === 0 ? 'In ziua evenimentului' : `${day} zile`}</label>)}</div>
                  <span className="medical-field-label">Canale</span>
                  <div className="medical-channel-options"><label><input type="checkbox" checked={rule.sendPush} onChange={(event) => updateMedicalRule(kind, { sendPush: event.target.checked })} />Push</label><label><input type="checkbox" checked={rule.sendEmail} onChange={(event) => updateMedicalRule(kind, { sendEmail: event.target.checked })} />Email</label></div>
                  <label className="medical-text-field">Subiect email<input className="input" value={rule.emailSubject} onChange={(event) => updateMedicalRule(kind, { emailSubject: event.target.value })} /></label>
                  <label className="medical-text-field">HTML email<textarea className="input" value={rule.emailHtml} onChange={(event) => updateMedicalRule(kind, { emailHtml: event.target.value })} /></label>
                  <small className="medical-help">Variabile: {'{{parentName}}'}, {'{{childName}}'}, {'{{eventName}}'}, {'{{eventDate}}'}, {'{{daysBefore}}'}</small>
                </div>
                <div className="medical-preview"><span>Previzualizare email</span><strong>{rule.emailSubject.replace('{{eventName}}', isVaccine ? 'Vaccinul ROR' : 'Consult obstetric').replace('{{daysBefore}}', isVaccine ? '7' : '2')}</strong><iframe title={`${kind}-email-preview`} sandbox="" srcDoc={medicalPreview(rule, kind)} /></div>
              </div>
            </section>;
          })}
        </div>
      )}

      {activeTab === 'push' && <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Titlu</th>
                <th>Audiență</th>
                <th>Status</th>
                <th>Programată</th>
                <th>Trimise</th>
                <th>Deschise</th>
                <th>Creat de</th>
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  Nicio campanie creată încă. Apasă "+ Campanie nouă".
                </td></tr>
              ) : campaigns.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.body?.slice(0, 60)}{c.body && c.body.length > 60 ? '…' : ''}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {(() => {
                      const { label, detail } = audienceMeta(c);
                      return (
                        <div>
                          <span>{label}</span>
                          {detail && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              {detail}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'}`}>{c.status}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.scheduledAt ? fmtDateTime(c.scheduledAt) : '—'}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{c.sentCount ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {c.openedCount != null && c.sentCount ? `${Math.round((c.openedCount / c.sentCount) * 100)}%` : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.createdBy}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <>
                          <button
                            className="btn btn-sm"
                            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', padding: '2px 8px', fontSize: 11 }}
                            onClick={() => sendNow(c)}
                            disabled={sendingId === c.id}
                          >
                            {sendingId === c.id ? '⏳ Se trimite...' : '🚀 Trimite'}
                          </button>
                          <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => cancel(c)}>
                            Anulează
                          </button>
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => remove(c)}>
                        Șterge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ── Email template library ── */}
      {activeTab === 'email' && (
        <div className="card" style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Biblioteca template-uri email</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {emailTemplates.length.toLocaleString()} template-uri salvate pentru reutilizare
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setEmailForm(EMPTY_EMAIL_FORM); setShowCreate(true); }}>
              + Email nou
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nume</th>
                  <th>Tip</th>
                  <th>Subiect</th>
                  <th>Status</th>
                  <th>Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td></tr>
                ) : emailTemplates.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
                    Nu exista template-uri salvate inca. Creeaza o campanie email si bifeaza salvarea ca template.
                  </td></tr>
                ) : emailTemplates.map(template => (
                  <tr key={template.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{template.name}</td>
                    <td><span className="badge badge-blue">{template.type}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{template.subject}</td>
                    <td><span className={`badge ${template.isActive ? 'badge-green' : 'badge-gray'}`}>{template.isActive ? 'Activ' : 'Inactiv'}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => useTemplate(template)}>
                        Foloseste
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Email Campaigns table ── */}
      {activeTab === 'email' && <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Biblioteca mailuri create / trimise</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            Istoric campanii email, cu optiuni de reutilizare si salvare ca template.
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subiect</th>
                <th>Audiență</th>
                <th>Status</th>
                <th>Trimise</th>
                <th>Eșuate</th>
                <th>Creat de</th>
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : emailCampaigns.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  Nicio campanie email creată încă. Apasă "+ Campanie nouă".
                </td></tr>
              ) : emailCampaigns.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{c.subject}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {c.htmlBody?.replace(/<[^>]+>/g, ' ').slice(0, 60)}…
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {(() => {
                      const { label, detail } = emailAudienceMeta(c);
                      return (
                        <div>
                          <span>{label}</span>
                          {detail && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              {detail}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'}`}>{c.status}</span></td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{c.sentCount ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.failedCount ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.createdBy}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(c.status === 'draft' || (c.status === 'sent' && (c.sentCount || 0) === 0)) && (
                        <button
                          className="btn btn-sm"
                          style={{ borderColor: 'var(--accent)', color: 'var(--accent)', padding: '2px 8px', fontSize: 11 }}
                          onClick={() => sendEmailNow(c)}
                          disabled={sendingId === c.id}
                        >
                          {sendingId === c.id ? '⏳ Se trimite...' : c.status === 'sent' ? '↻ Retrimite' : '📧 Trimite'}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => useCampaignAsDraft(c)}>
                        Foloseste
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => saveCampaignAsTemplate(c)}>
                        Template
                      </button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeEmail(c)}>
                        Șterge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {activeTab === 'email' && (
        <div className="card" style={{ padding: 0, marginTop: 16 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Emailuri utilizatori</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {usersLoading
                  ? 'Se incarca lista...'
                  : `${emailDirectoryUsers.length.toLocaleString()} din ${users.length.toLocaleString()} emailuri · ${emailUnsubscribes.length.toLocaleString()} dezabonari`}
              </div>
            </div>
            <input
              className="input"
              placeholder="Cauta email, nume sau platforma..."
              value={emailDirectorySearch}
              onChange={e => setEmailDirectorySearch(e.target.value)}
              style={{ maxWidth: 300, height: 36 }}
            />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Utilizator</th>
                  <th>Platforma</th>
                  <th>Versiune</th>
                  <th>Push</th>
                  <th>Email marketing</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td></tr>
                ) : emailDirectoryUsers.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
                    Niciun email gasit.
                  </td></tr>
                ) : emailDirectoryUsers.map(user => {
                  const unsubscribed = isEmailUnsubscribed(user, unsubscribedEmailSet);
                  return (
                    <tr key={user.uid}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{user.email}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>{user.uid.slice(0, 14)}...</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{user.displayName || '-'}</td>
                      <td>
                        <span className="badge badge-blue">{getUserPlatformSummary(user)}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {user.appVersion || '-'}{user.appBuildVersion ? ` (${user.appBuildVersion})` : ''}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span className={`badge ${user.fcmToken ? 'badge-green' : 'badge-gray'}`}>Native</span>
                          <span className={`badge ${user.webPushToken ? 'badge-green' : 'badge-gray'}`}>PWA</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${unsubscribed ? 'badge-red' : 'badge-green'}`}>
                          {unsubscribed ? 'Dezabonat' : 'Activ'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'email' && emailUnsubscribes.length > 0 && (
        <div className="card" style={{ padding: 0, marginTop: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Dezabonari email</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Utilizatorii din lista aceasta sunt sariti automat la campaniile email.
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>UID</th>
                  <th>Campanie</th>
                  <th>Data</th>
                  <th>Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {emailUnsubscribes.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{item.email}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{item.uid || '-'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{item.campaignId || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{item.unsubscribedAt ? fmtDateTime(item.unsubscribedAt) : '-'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => resubscribeEmail(item)}>
                        Reaboneaza
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal — Push */}
      {showCreate && activeTab === 'push' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setForm(EMPTY_FORM); } }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <h2 className="modal-title">🔔 Campanie Push nouă</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Titlu notificare *
                </label>
                <input className="input" placeholder="ex: Ofertă specială pentru tine! 🎁"
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Mesaj *
                </label>
                <textarea
                  className="input" placeholder="Textul notificării..."
                  value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  style={{ height: 80, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Audiență *
                </label>
                <select className="input" value={form.targetAudience}
                  onChange={e => setForm(p => ({ ...p, targetAudience: e.target.value }))}>
                  {AUDIENCES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>

              {form.targetAudience === 'user_uid' && (
                <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                      UID utilizator *
                    </label>
                    <input className="input" placeholder="ex: abc123xyz..."
                      value={form.targetUid} onChange={e => setForm(p => ({ ...p, targetUid: e.target.value }))} />
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      Găsești UID-ul în pagina Utilizatori → Detalii → lângă email.
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                      Nume (opțional)
                    </label>
                    <input className="input" placeholder="ex: Maria Ionescu"
                      value={form.targetUserName} onChange={e => setForm(p => ({ ...p, targetUserName: e.target.value }))} />
                  </div>
                </div>
              )}

              {form.targetAudience === 'inactive_custom' && (
                <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: 8, padding: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                    Zile de inactivitate *
                  </label>
                  <input type="number" className="input" min="1" max="365"
                    value={form.inactiveDays} onChange={e => setForm(p => ({ ...p, inactiveDays: e.target.value }))}
                    style={{ maxWidth: 120 }} />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Trimite către utilizatorii care nu s-au conectat în ultimele {form.inactiveDays || 30} zile.
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Programează (opțional)
                </label>
                <input type="datetime-local" className="input" value={form.scheduleAt}
                  onChange={e => setForm(p => ({ ...p, scheduleAt: e.target.value }))} />
              </div>

              {(form.title || form.body) && (
                <div style={{ background: 'linear-gradient(135deg, #5b6b9e 0%, #7a8bb5 100%)', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 1, marginBottom: 8 }}>
                    PREVIZUALIZARE — AȘA VA APĂREA PE TELEFON
                  </div>
                  <div style={{ background: 'rgba(250,250,252,0.92)', borderRadius: 14, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
                    <img src="https://example.com/assets/icon.png" alt="MamiApp" width={38} height={38} style={{ borderRadius: 9, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.title || 'Titlu...'}</div>
                        <div style={{ fontSize: 11, color: '#8e8e93', flexShrink: 0 }}>acum</div>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#3a3a3c', lineHeight: 1.35, marginTop: 1, wordBreak: 'break-word' }}>{form.body || 'Mesaj...'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
                  Anulează
                </button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                  {saving ? '⏳ Se creează...' : form.scheduleAt ? '📅 Programează' : '💾 Salvează Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create modal — Email */}
      {showCreate && activeTab === 'email' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setEmailForm(EMPTY_EMAIL_FORM); } }}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <h2 className="modal-title">✉️ Campanie Email nouă</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {emailTemplates.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                    Porneste de la un template
                  </label>
                  <select
                    className="input"
                    value=""
                    onChange={e => {
                      const template = emailTemplates.find(item => item.id === e.target.value);
                      if (template) useTemplate(template);
                    }}
                  >
                    <option value="">Alege un template...</option>
                    {emailTemplates.filter(t => t.isActive).map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.subject}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Subiect email *
                </label>
                <input className="input" placeholder="ex: Actualizare importantă MamiApp 🌸"
                  value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Conținut HTML *
                </label>
                <textarea
                  className="input" placeholder="<p>Bună ziua,</p><p>...</p>"
                  value={emailForm.htmlBody} onChange={e => setEmailForm(p => ({ ...p, htmlBody: e.target.value }))}
                  style={{ height: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Acceptă HTML complet. Emailul va fi trimis via Firebase Email Extension.
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: 12 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={emailForm.saveAsTemplate}
                    onChange={e => setEmailForm(p => ({ ...p, saveAsTemplate: e.target.checked }))}
                  />
                  Salveaza si in biblioteca de template-uri
                </label>
                {emailForm.saveAsTemplate && (
                  <input
                    className="input"
                    placeholder="Nume template (optional)"
                    value={emailForm.templateName}
                    onChange={e => setEmailForm(p => ({ ...p, templateName: e.target.value }))}
                    style={{ marginTop: 10 }}
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Audiență *
                </label>
                <select className="input" value={emailForm.targetAudience}
                  onChange={e => setEmailForm(p => ({ ...p, targetAudience: e.target.value }))}>
                  {EMAIL_AUDIENCES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>

              {emailForm.targetAudience === 'target_email' && (
                <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 8, padding: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                    Adresa email *
                  </label>
                  <input
                    className="input"
                    type="email"
                    placeholder="ex: mama@example.com"
                    value={emailForm.targetEmail}
                    onChange={e => setEmailForm(p => ({ ...p, targetEmail: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Campania va fi trimisa exclusiv catre aceasta adresa.
                  </div>
                </div>
              )}

              {emailForm.targetAudience === 'user_uid' && (
                <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                      Cauta utilizator dupa email *
                    </label>
                    <input
                      className="input"
                      placeholder="Tasteaza email, nume sau UID..."
                      value={emailUserSearch}
                      onChange={e => setEmailUserSearch(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                      Email utilizator *
                    </label>
                    <select
                      className="input"
                      value={emailForm.targetUid}
                      onChange={e => {
                        const user = users.find(item => item.uid === e.target.value);
                        setEmailForm(p => ({
                          ...p,
                          targetUid: e.target.value,
                          targetUserName: user?.displayName || user?.email || '',
                          targetEmail: user?.email || p.targetEmail,
                        }));
                      }}
                    >
                      <option value="">{usersLoading ? 'Se incarca emailurile...' : 'Alege un email...'}</option>
                      {emailPickerUsers.map(user => (
                        <option key={user.uid} value={user.uid}>
                          {user.email} - {user.displayName || 'fara nume'} - {getUserPlatformSummary(user)}
                        </option>
                      ))}
                    </select>
                    {emailUserSearch && emailPickerUsers.length >= EMAIL_PICKER_LIMIT && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        Sunt afisate primele {EMAIL_PICKER_LIMIT} rezultate. Rafineaza cautarea pentru lista completa.
                      </div>
                    )}
                    {selectedEmailUser && (
                      <div style={{
                        marginTop: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--surface)',
                        border: '1px solid var(--border2)',
                        fontSize: 12,
                        color: 'var(--text2)',
                      }}>
                        <strong style={{ color: 'var(--text)' }}>{selectedEmailUser.email}</strong>
                        <span> · {getUserPlatformSummary(selectedEmailUser)}</span>
                        <span> · UID {selectedEmailUser.uid.slice(0, 12)}...</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                      Nume (opțional)
                    </label>
                    <input className="input" placeholder="ex: Maria Ionescu"
                      value={emailForm.targetUserName} onChange={e => setEmailForm(p => ({ ...p, targetUserName: e.target.value }))} />
                  </div>
                </div>
              )}

              {emailForm.targetAudience === 'inactive_custom' && (
                <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: 8, padding: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                    Zile de inactivitate *
                  </label>
                  <input type="number" className="input" min="1" max="365"
                    value={emailForm.inactiveDays} onChange={e => setEmailForm(p => ({ ...p, inactiveDays: e.target.value }))}
                    style={{ maxWidth: 120 }} />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Trimite către utilizatorii care nu s-au conectat în ultimele {emailForm.inactiveDays || 30} zile.
                  </div>
                </div>
              )}

              {emailForm.htmlBody && (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, border: '1px solid var(--border2)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>PREVIEW HTML</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{emailForm.subject || '(fără subiect)'}</div>
                  {/* Sandbox: fără allow-scripts/same-origin, deci HTML-ul de email nu poate rula JS (anti-XSS). */}
                  <iframe
                    title="Preview email"
                    sandbox=""
                    srcDoc={emailForm.htmlBody}
                    style={{ width: '100%', height: 200, border: 0, borderRadius: 8, background: '#fff' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setEmailForm(EMPTY_EMAIL_FORM); }}>
                  Anulează
                </button>
                <button className="btn btn-primary" onClick={handleCreateEmail} disabled={saving}>
                  {saving ? '⏳ Se creează...' : '💾 Salvează Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
