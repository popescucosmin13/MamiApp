// src/pages/Users.tsx — Gestionare utilizatori cu tabel filtrat + detalii extinse
import { useEffect, useState, useCallback, useMemo, type ComponentType } from 'react';
import { toast } from "../lib/toast";
import { confirmDialog } from "../lib/confirm";
import {
  doc, updateDoc, getDoc, getDocs, collection, query, orderBy, limit, where, Timestamp,
  setDoc, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { logAudit, fmtDate, fmtRelative, fmtDateTime } from '../lib/utils';
import type { AppUser } from '../types';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Baby,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';

const FILTERS = [
  { key: 'all',        label: 'Toți' },
  { key: 'premium',    label: '💎 Premium' },
  { key: 'pregnancy',  label: '🌸 Sarcină' },
  { key: 'child',      label: '👶 Copil' },
  { key: 'pwa',        label: 'PWA instalata' },
  { key: 'play-store', label: 'Google Play' },
  { key: 'no-pwa',     label: 'Fara PWA' },
  { key: 'blocked',    label: '🚫 Blocați' },
];

const AUTH_FILTERS = [
  { key: 'google', label: 'Google' },
  { key: 'password', label: 'Email/parola' },
  { key: 'new', label: 'Conturi noi' },
];

const NEW_ACCOUNT_DAYS = 7;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
}

function isGoogleUser(user: AppUser): boolean {
  return user.usesGoogleAuth === true || user.authProvider === 'google.com' || user.authProviderIds?.includes('google.com') === true;
}

function isPasswordUser(user: AppUser): boolean {
  return user.usesPasswordAuth === true || user.authProvider === 'password' || user.authProviderIds?.includes('password') === true;
}

function isNewAccount(user: AppUser): boolean {
  const createdAt = toDate(user.createdAt);
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() <= NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
}

function isRecentlyActive(user: AppUser): boolean {
  const lastSeen = toDate(user.appLastSeenAt || user.updatedAt || user.createdAt);
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
}

function getLastActivity(user: AppUser): any {
  return user.appLastSeenAt || user.updatedAt || user.createdAt;
}

function getAuthProviderLabel(user: AppUser): string {
  if (isGoogleUser(user)) return 'Google';
  if (isPasswordUser(user)) return 'Email/parola';
  if (user.authMissing) return 'Lipseste Auth';
  return user.authProviderLabel || user.authProvider || 'Necunoscut';
}

function getAuthProviderBadgeClass(user: AppUser): string {
  if (isGoogleUser(user)) return 'badge-blue';
  if (isPasswordUser(user)) return 'badge-gray';
  if (user.authMissing) return 'badge-red';
  return 'badge-yellow';
}

function isPwaInstalled(user: AppUser): boolean {
  const platform = user.platform?.toLowerCase() || '';
  return user.isPWA === true || platform.includes('pwa');
}

function getPwaPlatformLabel(user: AppUser): string {
  const platform = user.platform?.toLowerCase() || '';
  if (platform.includes('ios')) return 'iOS';
  if (platform.includes('android')) return 'Android';
  if (platform.includes('windows')) return 'Windows';
  if (platform.includes('mac')) return 'macOS';
  if (platform.includes('linux')) return 'Linux';
  if (isPwaInstalled(user)) return 'PWA';
  return 'Neinstalata';
}

function getInstallSource(user: AppUser): string {
  if (user.appInstallSource) return user.appInstallSource;
  if (isPwaInstalled(user)) return 'pwa';
  if (user.nativePushPlatform === 'android') return 'google_play';
  if (user.appPlatform === 'android') return 'google_play';
  if (user.appPlatform === 'ios') return 'app_store';
  if (user.appPlatform === 'web') return 'web_browser';
  return 'unknown';
}

function isPlayStoreUser(user: AppUser): boolean {
  return getInstallSource(user) === 'google_play';
}

function getInstallSourceLabel(user: AppUser): string {
  const source = getInstallSource(user);
  if (source === 'google_play') return 'Google Play';
  if (source === 'app_store') return 'App Store';
  if (source === 'pwa') return `PWA ${getPwaPlatformLabel(user)}`;
  if (source === 'web_browser') return 'Web';
  if (source === 'expo_go') return 'Expo Go';
  return 'Necunoscuta';
}

function getInstallSourceBadgeClass(user: AppUser): string {
  const source = getInstallSource(user);
  if (source === 'google_play') return 'badge-green';
  if (source === 'app_store') return 'badge-blue';
  if (source === 'pwa') return 'badge-purple';
  if (source === 'web_browser') return 'badge-gray';
  return 'badge-yellow';
}

function getVersionValue(user: AppUser): string {
  return user.appVersion || 'necunoscuta';
}

function getServiceWorkerValue(user: AppUser): string {
  return user.serviceWorkerVersion || 'fara SW';
}

function compareVersionish(a: string, b: string): number {
  const normalize = (value: string) =>
    value.replace(/^v/i, '').split(/[^\d]+/).filter(Boolean).map((part) => Number(part));
  const left = normalize(a);
  const right = normalize(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

function latestVersion(values: string[]): string | null {
  const known = values.filter((value) => value && value !== 'necunoscuta' && value !== 'fara SW');
  if (known.length === 0) return null;
  return known.sort(compareVersionish).at(-1) || null;
}

// ─── Tipuri pentru datele extinse ale unui user ────────────────────────────────

interface DeviceDoc {
  token: string;
  platform: string;
  type: string;
  registeredAt: any;
  lastUsed?: any;
}

interface AiUsageDay {
  date: string;
  aiRequests: number;
}

interface ChildSummary {
  id: string;
  name: string;
  birthDate?: any;
  isActive?: boolean;
}

interface ModuleUsage {
  childId: string;
  childName: string;
  modules: Array<{
    key: string;
    label: string;
    count: number;
  }>;
}

interface UserStats {
  devices: DeviceDoc[];
  aiToday: number;
  aiTotal: number;
  aiUsageLast7: AiUsageDay[];
  feedsCount: number;
  sleepsCount: number;
  diapersCount: number;
  feedsLast7: number;
  sleepsLast7: number;
  diapersLast7: number;
  totalSleepMinutesLast7: number;
  childrenCount: number;
  activeChildId: string | null;
  children?: ChildSummary[];
  moduleUsage?: ModuleUsage[];
  pregnancy?: {
    dueDate?: any;
    startDate?: any;
    currentWeek?: number | null;
    trimester?: string | null;
    modules: Array<{ key: string; label: string; count: number }>;
  } | null;
  summaries: any[];
  webPushToken: string | null;
  fcmToken: string | null;
}

interface UsersOverview {
  totalUsers: number;
  premiumUsers: number;
  childUsers: number;
  pregnantUsers: number;
  onboardingDone: number;
  active7d: number;
}

interface PageCursor {
  createdAtMs: number;
  uid: string;
}

const CHILD_MODULES = [
  { key: 'feeds', label: 'Mese' },
  { key: 'sleeps', label: 'Somn' },
  { key: 'diapers', label: 'Scutece' },
  { key: 'measurements', label: 'Crestere' },
  { key: 'vaccines', label: 'Vaccinuri' },
  { key: 'milestones', label: 'Etape' },
  { key: 'cdc_milestones', label: 'CDC' },
  { key: 'foods', label: 'Alimente' },
  { key: 'documents', label: 'Documente' },
  { key: 'teeth', label: 'Dinti' },
  { key: 'school', label: 'Scoala' },
];

// ─── Componentă detalii utilizator ────────────────────────────────────────────

type DetailIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function compactToken(value?: string | null): string {
  if (!value) return 'Lipsa';
  if (value.length <= 34) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

function userInitials(user: AppUser): string {
  const source = user.displayName || user.email || user.uid;
  return source
    .split(/[ @._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

function DetailMetric({
  icon: Icon,
  label,
  value,
  tone = 'blue',
  hint,
}: {
  icon: DetailIcon;
  label: string;
  value: string | number;
  tone?: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'gray';
  hint?: string;
}) {
  return (
    <div className="user-detail-metric">
      <div className={`user-detail-metric-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}

function InfoTile({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="user-info-tile">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{valueOrDash(value)}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="user-empty-state">{text}</div>;
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="user-mini-bar">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="user-mini-track">
        <i style={{ width: `${Math.max(value > 0 ? 6 : 0, pct)}%` }} />
      </div>
    </div>
  );
}

function formatAnyDate(value: any): string {
  if (!value) return '-';
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return value;
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const seconds =
    typeof value?._seconds === 'number'
      ? value._seconds
      : typeof value?.seconds === 'number'
        ? value.seconds
        : null;
  if (seconds !== null) {
    const nanoseconds = value?._nanoseconds ?? value?.nanoseconds ?? 0;
    return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000)).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return String(value);
}

function getTokenTypeInfo(type?: string) {
  if (type === 'expo') return { label: 'Expo Native', color: '#6366f1' };
  if (type === 'fcm_web') return { label: 'FCM Web', color: '#0ea5e9' };
  return { label: type || 'unknown', color: '#6b7280' };
}


function ModernUserDetailModal({ user, onClose, onChanged }: { user: AppUser; onClose: () => void; onChanged: () => void }) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'children' | 'activity' | 'devices' | 'access'>('overview');
  const [saving, setSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, boolean>>(user.moduleOverrides || {});
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [notifForm, setNotifForm] = useState({ title: '', body: '' });
  const [sendingNotif, setSendingNotif] = useState(false);

  const modulesList = [
    { id: 'assistant', label: 'Asistent AI' },
    { id: 'community', label: 'Comunitate' },
    { id: 'pregnancy', label: 'Sarcina' },
    { id: 'family', label: 'Familie' },
    { id: 'school', label: 'Scoala' },
    { id: 'documents', label: 'Documente' },
    { id: 'sleep-coach', label: 'Sleep Coach' },
    { id: 'growth', label: 'Crestere' },
    { id: 'articles', label: 'Articole' },
  ];

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);

    try {
      const getAdminUserStats = httpsCallable<{ uid: string }, UserStats>(functions, 'getAdminUserStats');
      const result = await getAdminUserStats({ uid: user.uid });
      if (result.data.children && result.data.moduleUsage) {
        setStats(result.data);
        setLoadingStats(false);
        return;
      }
      throw new Error('Functia getAdminUserStats nu include children/moduleUsage.');
    } catch {
      // Fallback below uses admin Firestore rules when the Cloud Function is older or unavailable.
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysAgoTs = Timestamp.fromDate(sevenDaysAgo);

      const userDocSnap = await getDoc(doc(db, 'users', user.uid));
      const userDocData = userDocSnap.data() || {};
      const allChildrenSnap = await getDocs(collection(db, 'users', user.uid, 'children'));
      const activeChildQuery = await getDocs(
        query(collection(db, 'users', user.uid, 'children'), where('isActive', '==', true))
      ).catch(() => ({ docs: [] as any[] }));
      const activeChildId = activeChildQuery.docs[0]?.id || allChildrenSnap.docs[0]?.id || null;

      const children: ChildSummary[] = allChildrenSnap.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          name: data.name || 'Copil',
          birthDate: data.birthDate || null,
          isActive: data.isActive === true || snap.id === activeChildId,
        };
      });

      const [devicesSnap, todayUsageSnap, usageSnap, summariesSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'devices')).catch(() => ({ docs: [] as any[], size: 0 })),
        getDoc(doc(db, 'users', user.uid, 'usage', today)).catch(() => null),
        getDocs(query(collection(db, 'users', user.uid, 'usage'), orderBy('__name__', 'desc'), limit(7))).catch(() => ({ docs: [] as any[] })),
        getDocs(query(collection(db, 'users', user.uid, 'summaries'), orderBy('__name__', 'desc'), limit(7))).catch(() => ({ docs: [] as any[] })),
      ]);

      const devices: DeviceDoc[] = devicesSnap.docs.map((snap: any) => snap.data() as DeviceDoc);
      const aiToday = todayUsageSnap?.exists() ? (todayUsageSnap.data()?.aiRequests || 0) : 0;
      const aiUsageLast7: AiUsageDay[] = usageSnap.docs.map((snap: any) => ({
        date: snap.id,
        aiRequests: snap.data().aiRequests || 0,
      }));
      const aiTotal = aiUsageLast7.reduce((sum, day) => sum + day.aiRequests, 0);
      const summaries = summariesSnap.docs.map((snap: any) => {
        const data = snap.data();
        return {
          date: snap.id,
          feedsCount: data.feedsCount ?? 0,
          sleepMinutes: data.sleepMinutes ?? 0,
          diapersCount: data.diapersCount ?? 0,
        };
      });

      const moduleUsage: ModuleUsage[] = await Promise.all(children.map(async (child) => {
        const modules = await Promise.all(CHILD_MODULES.map(async (mod) => {
          const snap = await getDocs(collection(db, 'users', user.uid, 'children', child.id, mod.key)).catch(() => null);
          return { ...mod, count: snap?.size ?? 0 };
        }));
        return { childId: child.id, childName: child.name, modules };
      }));

      let feedsCount = 0;
      let sleepsCount = 0;
      let diapersCount = 0;
      let feedsLast7 = 0;
      let sleepsLast7 = 0;
      let diapersLast7 = 0;
      let totalSleepMinutesLast7 = 0;

      if (activeChildId) {
        const basePath = `users/${user.uid}/children/${activeChildId}`;
        const [feedsAll, sleepsAll, diapersAll, feedsWeek, sleepsWeek, diapersWeek] = await Promise.all([
          getDocs(query(collection(db, basePath, 'feeds'), limit(500))).catch(() => ({ size: 0, docs: [] as any[] })),
          getDocs(query(collection(db, basePath, 'sleeps'), limit(500))).catch(() => ({ size: 0, docs: [] as any[] })),
          getDocs(query(collection(db, basePath, 'diapers'), limit(500))).catch(() => ({ size: 0, docs: [] as any[] })),
          getDocs(query(collection(db, basePath, 'feeds'), where('timestamp', '>=', sevenDaysAgoTs))).catch(() => ({ size: 0, docs: [] as any[] })),
          getDocs(query(collection(db, basePath, 'sleeps'), where('startTime', '>=', sevenDaysAgoTs))).catch(() => ({ size: 0, docs: [] as any[] })),
          getDocs(query(collection(db, basePath, 'diapers'), where('timestamp', '>=', sevenDaysAgoTs))).catch(() => ({ size: 0, docs: [] as any[] })),
        ]);
        feedsCount = feedsAll.size;
        sleepsCount = sleepsAll.size;
        diapersCount = diapersAll.size;
        feedsLast7 = feedsWeek.size;
        sleepsLast7 = sleepsWeek.size;
        diapersLast7 = diapersWeek.size;
        totalSleepMinutesLast7 = Math.round(
          sleepsWeek.docs.reduce((sum: number, snap: any) => sum + ((snap.data().duration || 0) / 60), 0)
        );
      }

      setStats({
        devices,
        aiToday,
        aiTotal,
        aiUsageLast7,
        feedsCount,
        sleepsCount,
        diapersCount,
        feedsLast7,
        sleepsLast7,
        diapersLast7,
        totalSleepMinutesLast7,
        childrenCount: children.length,
        activeChildId,
        children,
        moduleUsage,
        summaries,
        webPushToken: userDocData.webPushToken || null,
        fcmToken: userDocData.fcmToken || null,
      });
    } catch (err: any) {
      console.error('loadStats error:', err);
      setStatsError(err?.code ? `${err.code}: ${err.message}` : String(err));
    } finally {
      setLoadingStats(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function sendDirectNotif() {
    if (!notifForm.title.trim() || !notifForm.body.trim()) { toast.warning('Completeaza titlul si mesajul.'); return; }
    setSendingNotif(true);
    try {
      const ref = doc(collection(db, 'notificationCampaigns'));
      await setDoc(ref, {
        title: notifForm.title.trim(),
        body: notifForm.body.trim(),
        targetAudience: 'user_uid',
        targetUid: user.uid,
        targetUserName: user.displayName || user.email || user.uid,
        status: 'draft',
        createdBy: 'admin-direct',
        createdAt: serverTimestamp(),
      });
      const sendCampaign = httpsCallable<{ campaignId: string }, { sentCount: number; failedCount: number }>(
        functions,
        'sendNotificationCampaign'
      );
      const result = await sendCampaign({ campaignId: ref.id });
      await logAudit('send_direct_notification', 'user', user.uid, 'Notificare directa trimisa', {
        title: notifForm.title,
        sentCount: result.data.sentCount,
      });
      toast.success(result.data.sentCount > 0 ? 'Notificare trimisa cu succes.' : 'Trimis, dar utilizatorul nu are push token activ.');
      setShowNotifForm(false);
      setNotifForm({ title: '', body: '' });
    } catch (err: any) {
      console.error('sendDirectNotif error:', err);
      toast.error('Eroare la trimitere: ' + (err?.message || String(err)));
    } finally {
      setSendingNotif(false);
    }
  }

  async function saveModuleOverrides() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { moduleOverrides });
      await logAudit('update_module_overrides', 'user', user.uid, 'Module overrides actualizate', { moduleOverrides });
      onChanged();
    } catch (err) {
      console.error('Failed to save overrides:', err);
      toast.error('Nu am putut salva overrides.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserAccess(disabled: boolean) {
    const label = user.displayName || user.email || user.uid;
    if (!(await confirmDialog({ title: `Sigur vrei sa ${disabled ? 'blochezi' : 'deblochezi'} accesul pentru ${label}?` }))) return;
    setAccessSaving(true);
    try {
      const setAdminUserAccess = httpsCallable<{ uid: string; disabled: boolean }, { success: boolean }>(
        functions,
        'setAdminUserAccess'
      );
      await setAdminUserAccess({ uid: user.uid, disabled });
      await logAudit(disabled ? 'disable_user' : 'enable_user', 'user', user.uid, disabled ? 'Utilizator blocat din admin' : 'Utilizator deblocat din admin');
      onChanged();
      onClose();
    } catch (err: any) {
      console.error('toggleUserAccess error:', err);
      toast.error('Eroare la actualizarea accesului: ' + (err?.message || String(err)));
    } finally {
      setAccessSaving(false);
    }
  }

  async function deleteUserFromAdmin() {
    const label = user.displayName || user.email || user.uid;
    if (!(await confirmDialog({ title: `Stergi definitiv utilizatorul ${label}?` }))) return;
    if (!(await confirmDialog({ title: 'Confirmare finala: aceasta actiune nu poate fi anulata.' }))) return;
    setDeletingUser(true);
    try {
      const deleteAdminUser = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'deleteAdminUser');
      await deleteAdminUser({ uid: user.uid });
      await logAudit('delete_user', 'user', user.uid, 'Utilizator sters definitiv din admin');
      onChanged();
      onClose();
    } catch (err: any) {
      console.error('deleteUserFromAdmin error:', err);
      toast.error('Eroare la stergerea utilizatorului: ' + (err?.message || String(err)));
    } finally {
      setDeletingUser(false);
    }
  }

  const displayName = user.displayName || 'Utilizator fara nume';
  const plan = user.subscription?.plan || (user.isPremium ? 'premium' : 'free');
  const subscriptionStatus = user.subscription?.status || (user.isPremium ? 'active' : 'free');
  const nativePushToken = stats?.fcmToken || user.fcmToken || null;
  const webPushToken = stats?.webPushToken || user.webPushToken || null;
  const activeChild = stats?.children?.find((child) => child.id === stats.activeChildId || child.isActive);
  const totalChildRecords = (stats?.feedsCount ?? 0) + (stats?.sleepsCount ?? 0) + (stats?.diapersCount ?? 0);
  const totalWeekRecords = (stats?.feedsLast7 ?? 0) + (stats?.sleepsLast7 ?? 0) + (stats?.diapersLast7 ?? 0);
  const moduleTotals = (stats?.moduleUsage ?? []).flatMap((child) => child.modules);
  const moduleMax = Math.max(...moduleTotals.map((mod) => mod.count), 1);
  const pregnancyModules = stats?.pregnancy?.modules ?? [];
  const pregnancyModuleMax = Math.max(...pregnancyModules.map((module) => module.count), 1);
  const aiDays = [...(stats?.aiUsageLast7 ?? [])].reverse();
  const aiMax = Math.max(...aiDays.map((day) => day.aiRequests), 1);
  const tabs = [
    { key: 'overview', label: 'Overview', icon: UserRound },
    { key: 'children', label: user.profileMode === 'pregnancy' ? 'Sarcina & module' : 'Copii & module', icon: Baby },
    { key: 'activity', label: 'Activitate', icon: Activity },
    { key: 'devices', label: 'Dispozitive', icon: Smartphone },
    { key: 'access', label: 'Acces', icon: KeyRound },
  ] as const;

  const copyUid = () => {
    navigator.clipboard?.writeText(user.uid).catch(() => undefined);
  };

  return (
    <div className="modal-overlay user-detail-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal user-detail-modal">
        <div className="user-detail-hero">
          <div className="user-detail-identity">
            <div className={`user-detail-avatar ${user.profileMode === 'pregnancy' ? 'pregnancy' : 'child'}`}>
              {userInitials(user)}
            </div>
            <div>
              <div className="user-detail-kicker">User dossier</div>
              <h2>{displayName}</h2>
              <div className="user-detail-email">
                <Mail size={14} />
                <span>{user.email || 'Email lipsa'}</span>
                <button type="button" className="mini-link" onClick={copyUid}>
                  <Copy size={12} /> UID
                </button>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Inchide detalii utilizator">
            <X size={18} />
          </button>
        </div>

        <div className="user-status-strip">
          <span className={`badge ${user.authDisabled ? 'badge-red' : 'badge-green'}`}>{user.authDisabled ? 'Acces blocat' : 'Acces activ'}</span>
          <span className={`badge ${user.emailVerified ? 'badge-green' : 'badge-red'}`}>{user.emailVerified ? 'Email confirmat' : 'Email neconfirmat'}</span>
          <span className={`badge ${plan === 'premium' ? 'badge-yellow' : plan === 'basic' ? 'badge-purple' : 'badge-gray'}`}>Plan {plan}</span>
          <span className={`badge ${nativePushToken || webPushToken ? 'badge-blue' : 'badge-gray'}`}>{nativePushToken || webPushToken ? 'Push activ' : 'Push lipsa'}</span>
          <span className={`badge ${user.onboardingCompleted ? 'badge-green' : 'badge-yellow'}`}>{user.onboardingCompleted ? 'Onboarding complet' : 'Onboarding incomplet'}</span>
        </div>

        <div className="user-detail-metrics">
          <DetailMetric icon={Baby} label="Copii in cont" value={loadingStats ? '...' : stats?.childrenCount ?? 0} tone="purple" hint={activeChild ? `Activ: ${activeChild.name}` : 'Fara copil activ'} />
          <DetailMetric icon={Activity} label="Tracking total" value={loadingStats ? '...' : totalChildRecords} tone="blue" hint="Mese, somn, scutece" />
          <DetailMetric icon={Clock3} label="Ultimele 7 zile" value={loadingStats ? '...' : totalWeekRecords} tone="green" hint={`${stats?.totalSleepMinutesLast7 ? (stats.totalSleepMinutesLast7 / 60).toFixed(1) : '0'}h somn`} />
          <DetailMetric icon={Bot} label="AI azi / 7 zile" value={loadingStats ? '...' : `${stats?.aiToday ?? 0} / ${stats?.aiTotal ?? 0}`} tone="yellow" hint="Cereri asistent" />
        </div>

        {statsError && (
          <div className="user-error-box">
            <ShieldAlert size={18} />
            <div>
              <strong>Statisticile nu s-au incarcat complet</strong>
              <span>{statsError}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadStats}>
              <RefreshCw size={14} /> Reincarca
            </button>
          </div>
        )}

        <div className="user-detail-tabs">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="user-detail-body">
          {tab === 'overview' && (
            <div className="user-detail-grid two">
              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Profil si autentificare</h3>
                  <span className={`badge ${getAuthProviderBadgeClass(user)}`}>{getAuthProviderLabel(user)}</span>
                </div>
                <div className="user-info-grid">
                  <InfoTile label="Mod profil" value={user.profileMode === 'pregnancy' ? 'Sarcina' : 'Copil'} />
                  <InfoTile label="Locale" value={user.locale || 'ro'} />
                  <InfoTile label="Creat la" value={fmtDateTime(user.createdAt)} />
                  <InfoTile label="Ultima activitate" value={fmtDateTime(user.updatedAt)} />
                  <InfoTile label="Ultimul login" value={user.lastSignInTime ? fmtDateTime(user.lastSignInTime) : '-'} />
                  <InfoTile label="Provider IDs" value={user.authProviderIds?.join(', ') || '-'} />
                  <InfoTile label="UID" value={user.uid} mono />
                  <InfoTile label="Status Auth" value={user.authDisabled ? 'Dezactivat' : 'Activ'} />
                </div>
              </section>

              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Abonament si instalare</h3>
                  <span className={`badge ${plan === 'premium' ? 'badge-yellow' : 'badge-gray'}`}>{subscriptionStatus}</span>
                </div>
                <div className="user-info-grid">
                  <InfoTile label="Plan" value={plan} />
                  <InfoTile label="Sursa abonament" value={user.subscription?.source || '-'} />
                  <InfoTile label="Abonament de la" value={fmtDate(user.subscription?.startedAt)} />
                  <InfoTile label="Expira la" value={fmtDate(user.subscription?.expiresAt)} />
                  <InfoTile label="Sursa instalare" value={getInstallSourceLabel(user)} />
                  <InfoTile label="Raw source" value={user.appInstallSource || '-'} />
                  <InfoTile label="Platforma app" value={user.appPlatform || '-'} />
                  <InfoTile label="Ownership" value={user.appOwnership || '-'} />
                </div>
              </section>

              <section className="user-panel wide">
                <div className="user-panel-heading">
                  <h3>Versiuni si stare tehnica</h3>
                  <span className={`badge ${isPwaInstalled(user) ? 'badge-green' : 'badge-gray'}`}>{isPwaInstalled(user) ? 'PWA instalata' : 'Fara PWA'}</span>
                </div>
                <div className="user-info-grid four">
                  <InfoTile label="Versiune app" value={user.appVersion || '-'} />
                  <InfoTile label="Build app" value={user.appBuildVersion || '-'} />
                  <InfoTile label="Service Worker" value={user.serviceWorkerVersion || '-'} />
                  <InfoTile label="Ultima raportare app" value={user.appLastSeenAt ? fmtDateTime(user.appLastSeenAt) : '-'} />
                </div>
                {user.preferences?.notifications && (
                  <div className="user-pref-list">
                    {Object.entries(user.preferences.notifications).map(([key, val]) => (
                      <span key={key} className={`badge ${val ? 'badge-green' : 'badge-gray'}`}>
                        {key}: {val ? 'on' : 'off'}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'children' && (
            <div className="user-detail-grid two">
              {user.profileMode === 'pregnancy' ? (
                <>
                  <section className="user-panel">
                    <div className="user-panel-heading">
                      <h3>Progres sarcina</h3>
                      <span className="badge badge-purple">{stats?.pregnancy?.currentWeek ? `saptamana ${stats.pregnancy.currentWeek}` : 'date profil'}</span>
                    </div>
                    {loadingStats ? <div className="center-loader"><div className="spinner" /></div> : !stats?.pregnancy ? (
                      <EmptyState text="Profilul de sarcina nu este inca initializat." />
                    ) : (
                      <div className="user-info-grid">
                        <InfoTile label="Termen estimat" value={formatAnyDate(stats.pregnancy.dueDate)} />
                        <InfoTile label="Prima zi a ultimei menstruatii" value={formatAnyDate(stats.pregnancy.startDate)} />
                        <InfoTile label="Saptamana" value={stats.pregnancy.currentWeek || '-'} />
                        <InfoTile label="Trimestru" value={stats.pregnancy.trimester ? `Trimestrul ${stats.pregnancy.trimester}` : '-'} />
                      </div>
                    )}
                  </section>
                  <section className="user-panel">
                    <div className="user-panel-heading">
                      <h3>Module sarcina</h3>
                      <span className="badge badge-purple">completat / lipsa</span>
                    </div>
                    {loadingStats ? <div className="center-loader"><div className="spinner" /></div> : pregnancyModules.length === 0 ? (
                      <EmptyState text="Nu exista inca date de sarcina." />
                    ) : (
                      <div className="user-module-usage">
                        {pregnancyModules.map((module) => (
                          <MiniBar key={module.key} label={`${module.label}${module.count === 0 ? ' - necompletat' : ''}`} value={module.count} max={pregnancyModuleMax} />
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : <>
              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Copii</h3>
                  <span className="badge badge-blue">{stats?.childrenCount ?? 0} total</span>
                </div>
                {loadingStats ? (
                  <div className="center-loader"><div className="spinner" /></div>
                ) : (stats?.children ?? []).length === 0 ? (
                  <EmptyState text="Utilizatorul nu are copii inregistrati." />
                ) : (
                  <div className="user-child-list">
                    {(stats?.children ?? []).map((child) => (
                      <div className="user-child-card" key={child.id}>
                        <div>
                          <strong>{child.name}</strong>
                          <span>Nascut: {fmtDate(child.birthDate)}</span>
                        </div>
                        <div>
                          {child.isActive && <span className="badge badge-green">activ</span>}
                          <code>{child.id.slice(0, 10)}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Module completate</h3>
                  <span className="badge badge-purple">per copil</span>
                </div>
                {loadingStats ? (
                  <div className="center-loader"><div className="spinner" /></div>
                ) : (stats?.moduleUsage ?? []).length === 0 ? (
                  <EmptyState text="Nu exista activitate pe module." />
                ) : (
                  <div className="user-module-usage">
                    {(stats?.moduleUsage ?? []).map((childUsage) => (
                      <div key={childUsage.childId} className="user-module-card">
                        <strong>{childUsage.childName}</strong>
                        {childUsage.modules.map((mod) => (
                          <MiniBar key={mod.key} label={`${mod.label}${mod.count === 0 ? ' - necompletat' : ''}`} value={mod.count} max={moduleMax} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              </>}
            </div>
          )}

          {tab === 'activity' && (
            <div className="user-detail-grid two">
              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Tracking copil activ</h3>
                  <span className="badge badge-gray">{activeChild?.name || 'fara copil activ'}</span>
                </div>
                {loadingStats ? (
                  <div className="center-loader"><div className="spinner" /></div>
                ) : (
                  <>
                    <div className="user-stat-grid">
                      <InfoTile label="Mese total" value={stats?.feedsCount ?? 0} />
                      <InfoTile label="Somn total" value={stats?.sleepsCount ?? 0} />
                      <InfoTile label="Scutece total" value={stats?.diapersCount ?? 0} />
                      <InfoTile label="Somn 7 zile" value={`${stats ? (stats.totalSleepMinutesLast7 / 60).toFixed(1) : '0'}h`} />
                    </div>
                    <div className="user-week-grid">
                      <DetailMetric icon={Database} label="Mese 7 zile" value={stats?.feedsLast7 ?? 0} tone="blue" />
                      <DetailMetric icon={Clock3} label="Somn 7 zile" value={stats?.sleepsLast7 ?? 0} tone="purple" />
                      <DetailMetric icon={Activity} label="Scutece 7 zile" value={stats?.diapersLast7 ?? 0} tone="green" />
                    </div>
                  </>
                )}
              </section>

              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Utilizare AI</h3>
                  <span className="badge badge-yellow">{stats?.aiTotal ?? 0} in 7 zile</span>
                </div>
                {loadingStats ? (
                  <div className="center-loader"><div className="spinner" /></div>
                ) : (
                  <>
                    <div className="user-ai-chart">
                      {aiDays.length === 0 ? (
                        <EmptyState text="Nu exista usage AI recent." />
                      ) : aiDays.map((day) => (
                        <div key={day.date}>
                          <span>{day.aiRequests || ''}</span>
                          <i style={{ height: `${Math.max(day.aiRequests > 0 ? 8 : 0, (day.aiRequests / aiMax) * 86)}%` }} />
                          <small>{new Date(day.date).toLocaleDateString('ro-RO', { weekday: 'short' })}</small>
                        </div>
                      ))}
                    </div>
                    {(stats?.summaries ?? []).length > 0 && (
                      <div className="user-summary-list">
                        {(stats?.summaries ?? []).map((summary: any, index: number) => (
                          <div key={index}>
                            <strong>{formatAnyDate(summary.date)}</strong>
                            <span>
                              Mese {summary.feedsCount ?? 0} | Somn {Math.round((summary.sleepMinutes ?? 0) / 60 * 10) / 10}h | Scutece {summary.diapersCount ?? 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          {tab === 'devices' && (
            <div className="user-detail-grid two">
              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Push tokens</h3>
                  <span className={`badge ${nativePushToken || webPushToken ? 'badge-green' : 'badge-gray'}`}>
                    {nativePushToken || webPushToken ? 'configurat' : 'lipsa'}
                  </span>
                </div>
                <div className="user-info-grid">
                  <InfoTile label="Native / Expo token" value={compactToken(nativePushToken)} mono />
                  <InfoTile label="Web Push token" value={compactToken(webPushToken)} mono />
                  <InfoTile label="Native platform" value={user.nativePushPlatform || '-'} />
                  <InfoTile label="Native registered" value={fmtDateTime(user.nativePushRegisteredAt)} />
                </div>
              </section>

              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Dispozitive inregistrate</h3>
                  <span className="badge badge-blue">{stats?.devices.length ?? 0}</span>
                </div>
                {loadingStats ? (
                  <div className="center-loader"><div className="spinner" /></div>
                ) : (stats?.devices ?? []).length === 0 ? (
                  <EmptyState text="Niciun dispozitiv inregistrat pentru notificari." />
                ) : (
                  <div className="user-device-list">
                    {(stats?.devices ?? []).map((device, index) => {
                      const typeInfo = getTokenTypeInfo(device.type || 'unknown');
                      const platform = device.platform || 'unknown';
                      return (
                        <div className="user-device-card" key={`${platform}-${index}`}>
                          <div className="user-device-head">
                            <div>
                              <Laptop size={18} />
                              <strong>{platform.charAt(0).toUpperCase() + platform.slice(1)}</strong>
                            </div>
                            <span style={{ color: typeInfo.color, background: `${typeInfo.color}20` }}>{typeInfo.label}</span>
                          </div>
                          <div className="user-device-meta">
                            <span>Inregistrat: {fmtDateTime(device.registeredAt)}</span>
                            <span>Ultim folosit: {device.lastUsed ? fmtRelative(device.lastUsed) : '-'}</span>
                          </div>
                          <code>{compactToken(device.token)}</code>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'access' && (
            <div className="user-detail-grid two">
              <section className="user-panel">
                <div className="user-panel-heading">
                  <h3>Module overrides</h3>
                  <span className="badge badge-gray">global fallback</span>
                </div>
                <p className="user-panel-note">
                  Grant sau Deny suprascrie planul utilizatorului. Default foloseste configuratia globala din Catalog Module.
                </p>
                <div className="user-override-list">
                  {modulesList.map((mod) => {
                    const override = moduleOverrides[mod.id];
                    return (
                      <div className="user-override-row" key={mod.id}>
                        <strong>{mod.label}</strong>
                        <div>
                          {(['grant', 'default', 'deny'] as const).map((opt) => {
                            const isActive =
                              opt === 'grant' ? override === true :
                              opt === 'deny' ? override === false :
                              override === undefined;
                            return (
                              <button
                                key={opt}
                                type="button"
                                className={isActive ? `active ${opt}` : ''}
                                onClick={() => setModuleOverrides((prev) => {
                                  const next = { ...prev };
                                  if (opt === 'default') delete next[mod.id];
                                  else next[mod.id] = opt === 'grant';
                                  return next;
                                })}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-primary" onClick={saveModuleOverrides} disabled={saving}>
                  <ShieldCheck size={15} /> {saving ? 'Se salveaza...' : 'Salveaza overrides'}
                </button>
              </section>

              <section className="user-panel danger-zone">
                <div className="user-panel-heading">
                  <h3>Actiuni cont</h3>
                  <span className={`badge ${user.authDisabled ? 'badge-red' : 'badge-green'}`}>
                    {user.authDisabled ? 'blocat' : 'activ'}
                  </span>
                </div>
                <div className="user-action-stack">
                  <button className="btn btn-ghost" onClick={() => setShowNotifForm(v => !v)}>
                    <Bell size={15} /> Trimite notificare directa
                  </button>
                  <button
                    className={`btn ${user.authDisabled ? 'btn-success' : 'btn-danger'}`}
                    onClick={() => toggleUserAccess(!user.authDisabled)}
                    disabled={accessSaving || deletingUser}
                  >
                    {user.authDisabled ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    {accessSaving ? 'Se salveaza...' : user.authDisabled ? 'Deblocheaza acces' : 'Blocheaza acces'}
                  </button>
                  <button className="btn btn-danger" onClick={deleteUserFromAdmin} disabled={accessSaving || deletingUser}>
                    <Lock size={15} /> {deletingUser ? 'Se sterge...' : 'Sterge utilizator'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>

        {showNotifForm && (
          <div className="user-notification-form">
            <div className="user-panel-heading">
              <h3>Notificare directa</h3>
              <span className="badge badge-blue">{displayName}</span>
            </div>
            <input
              className="input"
              placeholder="Titlu notificare"
              value={notifForm.title}
              onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))}
            />
            <textarea
              className="input"
              placeholder="Mesajul notificarii"
              value={notifForm.body}
              onChange={e => setNotifForm(p => ({ ...p, body: e.target.value }))}
            />
            {(notifForm.title || notifForm.body) && (
              <div className="user-notification-preview">
                <Bell size={18} />
                <div>
                  <strong>{notifForm.title || 'Titlu...'}</strong>
                  <span>{notifForm.body || 'Mesaj...'}</span>
                </div>
              </div>
            )}
            <div className="user-modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowNotifForm(false); setNotifForm({ title: '', body: '' }); }}>
                Anuleaza
              </button>
              <button className="btn btn-primary btn-sm" onClick={sendDirectNotif} disabled={sendingNotif}>
                <Bell size={14} /> {sendingNotif ? 'Se trimite...' : 'Trimite acum'}
              </button>
            </div>
          </div>
        )}

        <div className="user-modal-footer">
          <div className="user-gdpr-note">
            <ShieldCheck size={15} />
            <span>Datele medicale brute si documentele raman protejate; accesul operational se urmareste in audit.</span>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Inchide</button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [sortBy, setSortBy] = useState<'activity' | 'newest' | 'name'>('activity');
  const [overview, setOverview] = useState<UsersOverview | null>(null);
  const [nextCursor, setNextCursor] = useState<PageCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const total = overview?.totalUsers ?? users.length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const getAdminUsersPage = httpsCallable<{ pageSize: number }, { users: AppUser[]; nextCursor: PageCursor | null }>(functions, 'getAdminUsersPage');
      const result = await getAdminUsersPage({ pageSize: 100 });
      setUsers(result.data.users);
      setNextCursor(result.data.nextCursor);
    } catch (err) {
      console.error('Failed to load users', err);
    }
    setLoading(false);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const getAdminUsersOverview = httpsCallable<Record<string, never>, UsersOverview>(functions, 'getAdminUsersOverview');
      const result = await getAdminUsersOverview({});
      setOverview(result.data);
    } catch (err) {
      console.error('Failed to load users overview', err);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const getAdminUsersPage = httpsCallable<{ pageSize: number; cursor: PageCursor }, { users: AppUser[]; nextCursor: PageCursor | null }>(functions, 'getAdminUsersPage');
      const result = await getAdminUsersPage({ pageSize: 100, cursor: nextCursor });
      setUsers((current) => [...current, ...result.data.users]);
      setNextCursor(result.data.nextCursor);
    } catch (err) {
      console.error('Failed to load more users', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor]);

  useEffect(() => { void load(); void loadOverview(); }, [load, loadOverview]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesFilter = (user: AppUser) => {
      if (filter === 'premium') return user.subscription?.plan === 'premium' || user.isPremium;
      if (filter === 'pregnancy') return user.profileMode === 'pregnancy';
      if (filter === 'child') return user.profileMode === 'child';
      if (filter === 'google') return isGoogleUser(user);
      if (filter === 'password') return isPasswordUser(user);
      if (filter === 'new') return isNewAccount(user);
      if (filter === 'pwa') return isPwaInstalled(user);
      if (filter === 'play-store') return isPlayStoreUser(user);
      if (filter === 'no-pwa') return !isPwaInstalled(user);
      if (filter === 'blocked') return user.authDisabled === true;
      return true;
    };
    return users
      .filter(matchesFilter)
      .filter((user) => !normalizedSearch || user.displayName?.toLowerCase().includes(normalizedSearch) || user.email?.toLowerCase().includes(normalizedSearch))
      .slice()
      .sort((a, b) => {
        if (sortBy === 'name') return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'ro');
        const aDate = toDate(sortBy === 'newest' ? a.createdAt : getLastActivity(a))?.getTime() ?? 0;
        const bDate = toDate(sortBy === 'newest' ? b.createdAt : getLastActivity(b))?.getTime() ?? 0;
        return bDate - aDate;
      });
  }, [filter, search, sortBy, users]);
  const pwaInstalledCount = users.filter(isPwaInstalled).length;
  const pwaMissingCount = users.length - pwaInstalledCount;
  const playStoreUsersCount = users.filter(isPlayStoreUser).length;
  const googleUsersCount = users.filter(isGoogleUser).length;
  const newUsersCount = users.filter(isNewAccount).length;
  const activeUsersCount = overview?.active7d ?? users.filter(isRecentlyActive).length;
  const premiumUsersCount = overview?.premiumUsers ?? users.filter((user) => user.subscription?.plan === 'premium' || user.isPremium).length;
  const blockedUsersCount = users.filter((user) => user.authDisabled).length;
  const pushReadyUsersCount = users.filter((user) => Boolean(user.fcmToken || user.webPushToken)).length;
  const latestAppVersion = latestVersion(users.map(getVersionValue));
  const latestSwVersion = latestVersion(users.map(getServiceWorkerValue));

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>👥 Utilizatori</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
            {total.toLocaleString()} utilizatori total · {playStoreUsersCount.toLocaleString()} Google Play · {pwaInstalledCount.toLocaleString()} cu PWA instalata · {pwaMissingCount.toLocaleString()} fara PWA
          </p>
          <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
            Ultima versiune raportata: app {latestAppVersion || '—'} · PWA SW {latestSwVersion || '—'}
          </p>
          <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
            Auth: {googleUsersCount.toLocaleString()} Google · {newUsersCount.toLocaleString()} conturi noi in ultimele {NEW_ACCOUNT_DAYS} zile
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => load()}>🔄 Reîncarcă</button>
      </div>

      <div className="user-overview-grid">
        <div className="user-overview-card"><span>Total utilizatori</span><strong>{total.toLocaleString()}</strong><small>{newUsersCount.toLocaleString()} noi in pagina incarcata</small></div>
        <div className="user-overview-card accent-green"><span>Activi recent</span><strong>{activeUsersCount.toLocaleString()}</strong><small>ultimele 7 zile, dupa ultima activitate</small></div>
        <div className="user-overview-card accent-yellow"><span>Premium</span><strong>{premiumUsersCount.toLocaleString()}</strong><small>{total ? Math.round((premiumUsersCount / total) * 100) : 0}% din baza de utilizatori</small></div>
        <div className="user-overview-card accent-purple"><span>Push pregatit</span><strong>{pushReadyUsersCount.toLocaleString()}</strong><small>din cei {users.length.toLocaleString()} utilizatori incarcati</small></div>
        <div className={`user-overview-card ${blockedUsersCount ? 'accent-red' : ''}`}><span>Necesita atentie</span><strong>{blockedUsersCount.toLocaleString()}</strong><small>{blockedUsersCount ? 'conturi cu acces blocat' : 'niciun cont blocat'}</small></div>
      </div>

      <div className="users-version-note">
        <span>Ultima versiune: <strong>app {latestAppVersion || '—'}</strong> · PWA SW <strong>{latestSwVersion || '—'}</strong></span>
        <span>Autentificare Google: <strong>{googleUsersCount.toLocaleString()}</strong> · Fara PWA: <strong>{pwaMissingCount.toLocaleString()}</strong></span>
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ flexShrink: 0 }}>
          {[...FILTERS, ...AUTH_FILTERS].map(f => (
            <button key={f.key} className={`tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input" placeholder="🔍 Caută după nume sau email..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280, height: 36 }}
        />
        <select className="input users-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
          <option value="activity">Ultima activitate</option>
          <option value="newest">Cele mai noi</option>
          <option value="name">Nume A-Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="users-table-summary">
          <span><strong>{filtered.length.toLocaleString()}</strong> afisati</span>
          <span>{filter === 'all' ? 'Toate conturile' : `Filtru: ${[...FILTERS, ...AUTH_FILTERS].find((item) => item.key === filter)?.label || filter}`}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table users-table">
            <thead>
              <tr>
                <th>Utilizator</th>
                <th>Mod</th>
                <th>Abonament</th>
                <th>Email</th>
                <th>Auth</th>
                <th>PWA</th>
                <th>Sursa</th>
                <th>Versiune</th>
                <th>Push</th>
                <th>Înregistrat</th>
                <th>Ultima activitate</th>
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  Niciun utilizator găsit.
                </td></tr>
              ) : filtered.map(u => (
                <tr key={u.uid}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: u.profileMode === 'pregnancy' ? 'rgba(236,72,153,.2)' : 'rgba(99,102,241,.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>{u.profileMode === 'pregnancy' ? '🌸' : '👶'}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{u.displayName || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                        {u.authDisabled && (
                          <span className="badge badge-red" style={{ marginTop: 4 }}>Acces blocat</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.profileMode === 'pregnancy' ? 'badge-purple' : 'badge-blue'}`}>
                      {u.profileMode === 'pregnancy' ? 'Sarcină' : 'Copil'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.subscription?.plan === 'premium' ? 'badge-yellow' : 'badge-gray'}`}>
                      {u.subscription?.plan === 'premium' ? '💎 Premium' : 'Free'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.emailVerified ? 'badge-green' : 'badge-red'}`}>
                      {u.emailVerified ? 'Confirmat' : 'Neconfirmat'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span className={`badge ${getAuthProviderBadgeClass(u)}`}>
                        {getAuthProviderLabel(u)}
                      </span>
                      {isGoogleUser(u) && isPasswordUser(u) && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>si email/parola</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                      <span className={`badge ${isPwaInstalled(u) ? 'badge-green' : 'badge-gray'}`}>
                        {isPwaInstalled(u) ? 'Instalata' : 'Nu'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {getPwaPlatformLabel(u)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                      <span className={`badge ${getInstallSourceBadgeClass(u)}`}>
                        {getInstallSourceLabel(u)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {u.appPlatform || 'platforma necunoscuta'} · v{getVersionValue(u)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span
                        className={`badge ${latestAppVersion && u.appVersion === latestAppVersion ? 'badge-green' : u.appVersion ? 'badge-yellow' : 'badge-gray'}`}
                        title={`Platforma app: ${u.appPlatform || 'necunoscuta'} · Build: ${u.appBuildVersion || '—'}`}
                      >
                        App {getVersionValue(u)}
                      </span>
                      <span
                        className={`badge ${latestSwVersion && u.serviceWorkerVersion === latestSwVersion ? 'badge-green' : u.serviceWorkerVersion ? 'badge-yellow' : 'badge-gray'}`}
                        title={`Ultima raportare: ${u.appLastSeenAt ? fmtDateTime(u.appLastSeenAt) : '—'}`}
                      >
                        SW {getServiceWorkerValue(u)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span title="Native push" style={{ fontSize: 14, opacity: u.fcmToken ? 1 : 0.25 }}>📱</span>
                      <span title="PWA web push" style={{ fontSize: 14, opacity: u.webPushToken ? 1 : 0.25 }}>🌐</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span>{fmtDate(u.createdAt)}</span>
                      {isNewAccount(u) && <span className="badge badge-green">Nou</span>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtRelative(u.updatedAt)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(u)}>👁 Detalii</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && (
        <div className="users-load-more">
          <span>Au fost incarcati {users.length.toLocaleString()} din {total.toLocaleString()} utilizatori.</span>
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Se incarca...' : 'Incarca urmatorii 100'}
          </button>
        </div>
      )}

      {/* User Detail Modal */}
      {selected && (
        <ModernUserDetailModal
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
