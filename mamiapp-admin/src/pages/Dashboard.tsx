// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import { toast } from "../lib/toast";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Baby,
  Bell,
  Bot,
  ChevronRight,
  Crown,
  Database,
  FileText,
  Flag,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, functions } from '../firebase';
import { fmtCurrency, fmtNumber, fmtRelative, logAudit } from '../lib/utils';

const PALETTE = {
  indigo: '#6366F1',
  violet: '#8B5CF6',
  blue: '#3B82F6',
  teal: '#14B8A6',
  green: '#10B981',
  amber: '#F59E0B',
  pink: '#EC4899',
  red: '#EF4444',
  slate: '#64748B',
};

const MODULE_COLORS: Record<string, string> = {
  child: PALETTE.green,
  pregnancy: PALETTE.pink,
  general: PALETTE.indigo,
};

type TrendRow = { day: string; users: number; ai: number; cost: number };
type SegmentRow = { name: string; value: number; color: string };
type RecentUser = {
  uid: string;
  email?: string;
  displayName?: string;
  profileMode?: string;
  subscription?: { plan?: string };
  createdAt?: unknown;
  updatedAt?: unknown;
  appLastSeenAt?: unknown;
  appPlatform?: string;
  platform?: string;
  isPWA?: boolean;
  fcmToken?: string;
  webPushToken?: string;
};
type RecentPost = {
  id: string;
  title?: string;
  content?: string;
  authorName?: string;
  category?: string;
  commentsCount?: number;
  likesCount?: number;
  createdAt?: unknown;
  isPinned?: boolean;
};
type Ticket = {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  category?: string;
  createdAt?: unknown;
};
type FeatureFlagDoc = {
  id: string;
  key: string;
  name?: string;
  description?: string;
  enabled: boolean;
  enabledFor?: string;
};
type ModuleDoc = {
  id: string;
  name?: string;
  area?: string;
  enabled: boolean;
  planRequired?: string;
};
type AppConfigDoc = {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  minAppVersion?: string;
  supportEmail?: string;
  aiLimitsByPlan?: { free?: number; basic?: number; premium?: number };
  aiLimitFreePerDay?: number;
  aiLimitBasicPerDay?: number;
  aiLimitPremiumPerDay?: number;
  storageLimitFreeMb?: number;
  storageLimitPremiumMb?: number;
};

interface DashboardState {
  totalUsers: number;
  premiumUsers: number;
  pregnantUsers: number;
  childUsers: number;
  onboardingDone: number;
  newUsers7d: number;
  active7d: number;
  pwaUsers: number;
  googlePlayUsers: number;
  pushReadyUsers: number;
  nativePushUsers: number;
  webPushUsers: number;
  totalChildren: number;
  documentsCount: number;
  communityPosts: number;
  openTickets: number;
  urgentTickets: number;
  scheduledCampaigns: number;
  aiRequestsToday: number;
  aiCost7Days: number;
  trend: TrendRow[];
  modeSegments: SegmentRow[];
  installSegments: SegmentRow[];
  aiModules: SegmentRow[];
  recentUsers: RecentUser[];
  recentPosts: RecentPost[];
  tickets: Ticket[];
  flags: FeatureFlagDoc[];
  modules: ModuleDoc[];
  config: AppConfigDoc;
  recentActivity: Array<{ text: string; time: unknown }>;
}

const EMPTY_STATE: DashboardState = {
  totalUsers: 0,
  premiumUsers: 0,
  pregnantUsers: 0,
  childUsers: 0,
  onboardingDone: 0,
  newUsers7d: 0,
  active7d: 0,
  pwaUsers: 0,
  googlePlayUsers: 0,
  pushReadyUsers: 0,
  nativePushUsers: 0,
  webPushUsers: 0,
  totalChildren: 0,
  documentsCount: 0,
  communityPosts: 0,
  openTickets: 0,
  urgentTickets: 0,
  scheduledCampaigns: 0,
  aiRequestsToday: 0,
  aiCost7Days: 0,
  trend: [],
  modeSegments: [],
  installSegments: [],
  aiModules: [],
  recentUsers: [],
  recentPosts: [],
  tickets: [],
  flags: [],
  modules: [],
  config: {},
  recentActivity: [],
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as any).seconds === 'number') {
    return new Date((value as any).seconds * 1000);
  }
  return null;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
}

function lastDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - index));
    date.setHours(0, 0, 0, 0);
    return { date, key: dayLabel(date) };
  });
}

function isWithin(value: unknown, days: number) {
  const date = toDate(value);
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function getInstallSource(user: RecentUser) {
  const source = (user as any).appInstallSource;
  if (source) return source;
  if (user.isPWA || user.platform?.toLowerCase().includes('pwa')) return 'pwa';
  if (user.appPlatform === 'android') return 'google_play';
  if (user.appPlatform === 'ios') return 'app_store';
  if (user.appPlatform === 'web') return 'web';
  return 'unknown';
}

function logCost(log: any) {
  if (typeof log.costUsd === 'number') return log.costUsd;
  if (typeof log.cost === 'number') return log.cost;
  const tokens = (log.tokensIn || log.requestTokens || 0) + (log.tokensOut || log.responseTokens || 0);
  return tokens > 0 ? (tokens / 1000) * 0.003 : 0;
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

async function safeDocs(ref: any) {
  try {
    return await getDocs(ref);
  } catch {
    return { docs: [], size: 0, forEach: (_fn: any) => undefined } as any;
  }
}

async function summarizeUserNestedStats(users: RecentUser[]) {
  const sample = users.slice(0, 250);
  let children = 0;
  let documents = 0;

  await Promise.all(sample.map(async (user) => {
    const [childrenSnap, rootDocsSnap] = await Promise.all([
      safeDocs(collection(db, 'users', user.uid, 'children')),
      safeDocs(query(collection(db, 'users', user.uid, 'documents'), limit(100))),
    ]);
    children += childrenSnap.size ?? 0;
    documents += rootDocsSnap.size ?? 0;

    const childDocs = await Promise.all(childrenSnap.docs.map((childSnap: any) => (
      safeDocs(query(collection(db, 'users', user.uid, 'children', childSnap.id, 'documents'), limit(100)))
    )));
    documents += childDocs.reduce((total, snap) => total + (snap.size ?? 0), 0);
  }));

  return { children, documents };
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`modern-toggle ${checked ? 'on' : ''}`}
      aria-pressed={checked}
    >
      <span />
    </button>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  color,
  trend,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string | number;
  detail: string;
  color: string;
  trend?: string;
}) {
  return (
    <div className="ops-card metric-card">
      <div className="metric-top">
        <div className="metric-icon" style={{ background: `${color}18`, color }}>
          <Icon size={20} color={color} />
        </div>
        {trend && <span className="metric-trend">{trend}</span>}
      </div>
      <div className="metric-value">{typeof value === 'number' ? fmtNumber(value) : value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = percent(value, total);
  return (
    <div className="progress-row">
      <div className="progress-meta">
        <span>{label}</span>
        <strong style={{ color }}>{fmtNumber(value)} · {pct}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="empty-block">{text}</div>;
}

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>(EMPTY_STATE);
  const [moduleStats, setModuleStats] = useState<{
    topModules: Array<{ name: string; views: number; totalMinutes: number; category: string }>;
    avgActiveMinutesPerUser: number;
    totalActiveMinutes: number;
    usersWithData: number;
    totalUsers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleStatsLoading, setModuleStatsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const days = lastDays(7);
      const dayMap = Object.fromEntries(days.map((item) => [item.key, { day: item.key, users: 0, ai: 0, cost: 0 } as TrendRow]));
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        usersSnap,
        postsSnap,
        recentPostsSnap,
        openTicketsSnap,
        urgentTicketsSnap,
        ticketsSnap,
        scheduledCampaignsSnap,
        aiLogsSnap,
        flagsSnap,
        modulesSnap,
        activitySnap,
        configSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'community_posts'), limit(1000))).catch(() => ({ size: 0 } as any)),
        safeDocs(query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'), limit(8))),
        safeDocs(query(collection(db, 'supportTickets'), where('status', 'in', ['open', 'in_progress']), limit(300))),
        safeDocs(query(collection(db, 'supportTickets'), where('priority', '==', 'urgent'), limit(100))),
        safeDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'), limit(8))),
        safeDocs(query(collection(db, 'notificationCampaigns'), where('status', '==', 'scheduled'), limit(300))),
        safeDocs(query(collection(db, 'aiUsageLogs'), orderBy('createdAt', 'desc'), limit(600))),
        safeDocs(collection(db, 'featureFlags')),
        safeDocs(collection(db, 'moduleCatalog')),
        safeDocs(query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'), limit(8))),
        getDoc(doc(db, 'appConfig', 'global')).catch(() => null),
      ]);

      const users = usersSnap.docs.map((snap) => ({ uid: snap.id, ...snap.data() } as RecentUser));
      const nestedStats = await summarizeUserNestedStats(users);
      let premiumUsers = 0;
      let pregnantUsers = 0;
      let childUsers = 0;
      let onboardingDone = 0;
      let newUsers7d = 0;
      let active7d = 0;
      let pwaUsers = 0;
      let googlePlayUsers = 0;
      let nativePushUsers = 0;
      let webPushUsers = 0;

      users.forEach((user) => {
        const plan = user.subscription?.plan;
        if (plan === 'premium' || (user as any).isPremium) premiumUsers += 1;
        if (user.profileMode === 'pregnancy') pregnantUsers += 1;
        if (user.profileMode === 'child') childUsers += 1;
        if ((user as any).onboardingCompleted === true) onboardingDone += 1;
        if (isWithin(user.createdAt, 7)) newUsers7d += 1;
        if (isWithin(user.appLastSeenAt || user.updatedAt || user.createdAt, 7)) active7d += 1;
        if (user.isPWA || user.platform?.toLowerCase().includes('pwa')) pwaUsers += 1;
        if (getInstallSource(user) === 'google_play') googlePlayUsers += 1;
        if (typeof user.fcmToken === 'string' && user.fcmToken.length > 10) nativePushUsers += 1;
        if (typeof user.webPushToken === 'string' && user.webPushToken.length > 20) webPushUsers += 1;

        const createdAt = toDate(user.createdAt);
        if (createdAt) {
          const key = dayLabel(createdAt);
          if (dayMap[key]) dayMap[key].users += 1;
        }
      });

      const aiModules: Record<string, number> = {};
      let aiRequestsToday = 0;
      let aiCost7Days = 0;
      aiLogsSnap.docs.forEach((snap: any) => {
        const data = snap.data();
        const createdAt = toDate(data.createdAt);
        if (!createdAt) return;
        const cost = logCost(data);
        const key = dayLabel(createdAt);
        if (dayMap[key]) {
          dayMap[key].ai += 1;
          dayMap[key].cost += cost;
          aiCost7Days += cost;
        }
        if (createdAt >= todayStart) aiRequestsToday += 1;
        const moduleName = data.module || data.type || 'assistant';
        aiModules[moduleName] = (aiModules[moduleName] || 0) + 1;
      });

      const totalUsers = usersSnap.size;
      const flags = flagsSnap.docs.map((snap: any) => ({ id: snap.id, key: snap.data().key ?? snap.id, enabled: snap.data().enabled !== false, ...snap.data() } as FeatureFlagDoc));
      const modules = modulesSnap.docs.map((snap: any) => ({ id: snap.id, enabled: snap.data().enabled !== false, ...snap.data() } as ModuleDoc));

      setState({
        totalUsers,
        premiumUsers,
        pregnantUsers,
        childUsers,
        onboardingDone,
        newUsers7d,
        active7d,
        pwaUsers,
        googlePlayUsers,
        pushReadyUsers: users.filter((user) => user.fcmToken || user.webPushToken).length,
        nativePushUsers,
        webPushUsers,
        totalChildren: nestedStats.children,
        documentsCount: nestedStats.documents,
        communityPosts: postsSnap.size ?? 0,
        openTickets: openTicketsSnap.size ?? 0,
        urgentTickets: urgentTicketsSnap.size ?? 0,
        scheduledCampaigns: scheduledCampaignsSnap.size ?? 0,
        aiRequestsToday,
        aiCost7Days,
        trend: Object.values(dayMap).map((row) => ({ ...row, cost: Number(row.cost.toFixed(4)) })),
        modeSegments: [
          { name: 'Copil', value: childUsers, color: PALETTE.blue },
          { name: 'Sarcina', value: pregnantUsers, color: PALETTE.pink },
          { name: 'Nesetat', value: Math.max(totalUsers - childUsers - pregnantUsers, 0), color: PALETTE.slate },
        ],
        installSegments: [
          { name: 'Google Play', value: googlePlayUsers, color: PALETTE.green },
          { name: 'PWA', value: pwaUsers, color: PALETTE.violet },
          { name: 'Web/necunoscut', value: Math.max(totalUsers - googlePlayUsers - pwaUsers, 0), color: PALETTE.slate },
        ],
        aiModules: Object.entries(aiModules).map(([name, value], index) => ({
          name,
          value,
          color: Object.values(PALETTE)[index % Object.values(PALETTE).length],
        })).sort((a, b) => b.value - a.value),
        recentUsers: users
          .slice()
          .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
          .slice(0, 8),
        recentPosts: recentPostsSnap.docs.map((snap: any) => ({ id: snap.id, ...snap.data() } as RecentPost)),
        tickets: ticketsSnap.docs.map((snap: any) => ({ id: snap.id, ...snap.data() } as Ticket)),
        flags,
        modules,
        config: configSnap?.exists() ? configSnap.data() as AppConfigDoc : {},
        recentActivity: activitySnap.docs.map((snap: any) => ({
          text: `${snap.data().adminEmail || 'admin'} -> ${snap.data().action || 'actiune'} (${snap.data().targetType || 'system'})`,
          time: snap.data().timestamp,
        })),
      });
    } catch (error) {
      console.error('Dashboard load failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const loadModuleStats = async () => {
      try {
        const fn = httpsCallable(functions, 'getModuleStats');
        const result = await fn({});
        setModuleStats(result.data as any);
      } catch {
        setModuleStats(null);
      } finally {
        setModuleStatsLoading(false);
      }
    };
    loadModuleStats();
  }, []);

  const health = useMemo(() => {
    let score = 100;
    const risks: string[] = [];
    if (state.config.maintenanceMode) {
      score -= 30;
      risks.push('Maintenance activ');
    }
    if (state.openTickets > 5) {
      score -= Math.min(20, state.openTickets * 2);
      risks.push(`${state.openTickets} tickete deschise`);
    }
    if (state.urgentTickets > 0) {
      score -= Math.min(25, state.urgentTickets * 8);
      risks.push(`${state.urgentTickets} urgente`);
    }
    if (state.totalUsers > 0 && percent(state.pushReadyUsers, state.totalUsers) < 30) {
      score -= 10;
      risks.push('Push coverage scazut');
    }
    if (state.totalUsers > 0 && percent(state.onboardingDone, state.totalUsers) < 60) {
      score -= 10;
      risks.push('Onboarding sub 60%');
    }
    return { score: Math.max(0, score), risks };
  }, [state]);

  const aiLimits = {
    free: state.config.aiLimitsByPlan?.free ?? state.config.aiLimitFreePerDay ?? 10,
    basic: state.config.aiLimitsByPlan?.basic ?? state.config.aiLimitBasicPerDay ?? 50,
    premium: state.config.aiLimitsByPlan?.premium ?? state.config.aiLimitPremiumPerDay ?? 500,
  };

  const attentionItems = useMemo(() => [
    {
      label: state.urgentTickets ? `${state.urgentTickets} urgente de suport` : 'Nicio urgenta de suport',
      detail: state.urgentTickets ? 'Verifica si aloca tichetele urgente.' : 'Coada de suport nu are urgente.',
      to: '/support',
      tone: state.urgentTickets ? 'danger' : 'good',
    },
    {
      label: `${percent(state.onboardingDone, state.totalUsers)}% onboarding finalizat`,
      detail: state.totalUsers - state.onboardingDone > 0 ? `${state.totalUsers - state.onboardingDone} utilizatori nu au terminat configurarea.` : 'Toti utilizatorii au terminat configurarea.',
      to: '/users',
      tone: percent(state.onboardingDone, state.totalUsers) < 60 ? 'warning' : 'good',
    },
    {
      label: `${percent(state.pushReadyUsers, state.totalUsers)}% pot primi push`,
      detail: `${state.pushReadyUsers} din ${state.totalUsers} utilizatori au un token activ.`,
      to: '/notifications',
      tone: percent(state.pushReadyUsers, state.totalUsers) < 30 ? 'warning' : 'good',
    },
  ], [state]);

  const toggleMaintenance = async () => {
    const next = !state.config.maintenanceMode;
    setSaving('maintenance');
    try {
      await setDoc(doc(db, 'appConfig', 'global'), {
        ...state.config,
        maintenanceMode: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logAudit(next ? 'enable_maintenance' : 'disable_maintenance', 'app_config', 'global');
      setState((prev) => ({ ...prev, config: { ...prev.config, maintenanceMode: next } }));
    } catch {
      toast.error('Nu am putut salva maintenance mode.');
    } finally {
      setSaving(null);
    }
  };

  const toggleFlag = async (flag: FeatureFlagDoc) => {
    const next = !flag.enabled;
    setSaving(`flag:${flag.id}`);
    try {
      await setDoc(doc(db, 'featureFlags', flag.id), {
        key: flag.key,
        enabled: next,
        enabledFor: flag.enabledFor ?? (next ? 'all' : 'none'),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logAudit(next ? 'enable_flag' : 'disable_flag', 'feature_flag', flag.key);
      setState((prev) => ({
        ...prev,
        flags: prev.flags.map((item) => item.id === flag.id ? { ...item, enabled: next } : item),
      }));
    } catch {
      toast.error('Nu am putut salva feature flag.');
    } finally {
      setSaving(null);
    }
  };

  const toggleModule = async (moduleItem: ModuleDoc) => {
    const next = !moduleItem.enabled;
    setSaving(`module:${moduleItem.id}`);
    try {
      await setDoc(doc(db, 'moduleCatalog', moduleItem.id), {
        enabled: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logAudit(next ? 'enable_module' : 'disable_module', 'module', moduleItem.id);
      setState((prev) => ({
        ...prev,
        modules: prev.modules.map((item) => item.id === moduleItem.id ? { ...item, enabled: next } : item),
      }));
    } catch {
      toast.error('Nu am putut salva modulul.');
    } finally {
      setSaving(null);
    }
  };

  const tt = (payload: any) => (
    <div className="chart-tooltip">
      {payload.active && payload.payload?.map((entry: any, index: number) => (
        <div key={index} style={{ color: entry.color }}>
          {entry.name || entry.dataKey}: <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="admin-page ops-page">
        <div className="loading-shell">
          <div className="spinner" style={{ width: 44, height: 44 }} />
          <div>
            <h2>Se incarca datele admin...</h2>
            <p>Agregam utilizatori, AI, notificari, module si continut.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page ops-page fade-in">
      <div className="ops-hero">
        <div>
          <div className="page-kicker">MamiApp admin</div>
          <h1>Control center</h1>
          <p>
            Dashboard operational cu date reale din Firestore, controale live si zonele care cer atentie.
          </p>
        </div>
        <div className="hero-actions">
          <div className={`health-chip ${health.score < 65 ? 'danger' : health.score < 82 ? 'warning' : ''}`}>
            <ShieldCheck size={16} />
            Health {health.score}/100
          </div>
          <button className="btn btn-ghost" onClick={load}>
            <RefreshCw size={15} /> Reincarca
          </button>
        </div>
      </div>

      <section className="ops-attention-panel" aria-label="Prioritati operationale">
        <div className="ops-attention-intro">
          <span>Prioritati acum</span>
          <strong>Ce necesita verificare, pe scurt</strong>
        </div>
        <div className="ops-attention-list">
          {attentionItems.map((item) => (
            <Link key={item.label} to={item.to} className={`ops-attention-item ${item.tone}`}>
              <div><strong>{item.label}</strong><span>{item.detail}</span></div>
              <ChevronRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard icon={Users} label="Utilizatori total" value={state.totalUsers} detail={`${state.active7d} activi in ultimele 7 zile`} color={PALETTE.indigo} trend={`+${state.newUsers7d} noi`} />
        <MetricCard icon={Crown} label="Premium" value={`${percent(state.premiumUsers, state.totalUsers)}%`} detail={`${fmtNumber(state.premiumUsers)} conturi premium`} color={PALETTE.amber} />
        <MetricCard icon={Baby} label="Copii & sarcini" value={state.totalChildren} detail={`${state.childUsers} mod copil · ${state.pregnantUsers} sarcina`} color={PALETTE.pink} />
        <MetricCard icon={Bot} label="AI azi" value={state.aiRequestsToday} detail={`${fmtCurrency(state.aiCost7Days)} in ultimele 7 zile`} color={PALETTE.violet} />
        <MetricCard icon={Bell} label="Push coverage" value={`${percent(state.pushReadyUsers, state.totalUsers)}%`} detail={`${state.nativePushUsers} native · ${state.webPushUsers} PWA`} color={PALETTE.teal} />
        <MetricCard icon={MessageSquare} label="Comunitate" value={state.communityPosts} detail={`${state.openTickets} tickete deschise`} color={state.urgentTickets ? PALETTE.red : PALETTE.green} trend={state.urgentTickets ? `${state.urgentTickets} urgente` : undefined} />
      </div>

      <div className="ops-grid-main">
        <div className="ops-card chart-card">
          <div className="card-heading">
            <div>
              <h2>Activitate 7 zile</h2>
              <p>Inregistrari noi, cereri AI si cost estimat.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={285}>
            <AreaChart data={state.trend}>
              <defs>
                <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.indigo} stopOpacity={0.42} />
                  <stop offset="95%" stopColor={PALETTE.indigo} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.violet} stopOpacity={0.38} />
                  <stop offset="95%" stopColor={PALETTE.violet} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={tt} />
              <Area type="monotone" dataKey="users" name="Useri noi" stroke={PALETTE.indigo} fill="url(#usersGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="ai" name="AI requests" stroke={PALETTE.violet} fill="url(#aiGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Risc & atentie</h2>
              <p>Semnale care pot afecta utilizatorii.</p>
            </div>
          </div>
          {health.risks.length === 0 ? (
            <div className="good-state">
              <Sparkles size={22} />
              Platforma arata bine.
            </div>
          ) : (
            <div className="risk-list">
              {health.risks.map((risk) => (
                <div key={risk} className="risk-row">
                  <AlertTriangle size={16} color={PALETTE.amber} />
                  <span>{risk}</span>
                </div>
              ))}
            </div>
          )}
          <div className="control-row">
            <div>
              <strong>Maintenance mode</strong>
              <span>{state.config.maintenanceMode ? 'Activ - utilizatorii sunt restrictionati' : 'Oprit - aplicatia functioneaza normal'}</span>
            </div>
            <Toggle checked={Boolean(state.config.maintenanceMode)} onChange={toggleMaintenance} disabled={saving === 'maintenance'} />
          </div>
          <Link className="wide-link" to="/settings">
            Toate setarile aplicatiei <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="ops-grid-secondary">
        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Funnel utilizatori</h2>
              <p>Profil, onboarding si monetizare.</p>
            </div>
          </div>
          <ProgressRow label="Onboarding complet" value={state.onboardingDone} total={state.totalUsers} color={PALETTE.green} />
          <ProgressRow label="Premium" value={state.premiumUsers} total={state.totalUsers} color={PALETTE.amber} />
          <ProgressRow label="PWA instalata" value={state.pwaUsers} total={state.totalUsers} color={PALETTE.violet} />
          <ProgressRow label="Google Play" value={state.googlePlayUsers} total={state.totalUsers} color={PALETTE.green} />
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Mod de utilizare</h2>
              <p>Copil vs sarcina.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={205}>
            <PieChart>
              <Pie data={state.modeSegments} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={4}>
                {state.modeSegments.map((segment) => <Cell key={segment.name} fill={segment.color} />)}
              </Pie>
              <Tooltip content={tt} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-list">
            {state.modeSegments.map((segment) => (
              <div key={segment.name}><span style={{ background: segment.color }} />{segment.name}<strong>{segment.value}</strong></div>
            ))}
          </div>
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>AI modules</h2>
              <p>De unde vin cererile AI.</p>
            </div>
          </div>
          {state.aiModules.length === 0 ? <EmptyBlock text="Nu exista loguri AI inca." /> : (
            <ResponsiveContainer width="100%" height={225}>
              <BarChart data={state.aiModules.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={tt} />
                <Bar dataKey="value" name="Requests" radius={[0, 8, 8, 0]}>
                  {state.aiModules.slice(0, 8).map((row) => <Cell key={row.name} fill={row.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ops-grid-main">
        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Top module utilizate</h2>
              <p>Date din moduleUsage, ultimele 30 zile.</p>
            </div>
            <Link to="/analytics" className="mini-link">Analytics</Link>
          </div>
          {moduleStatsLoading ? (
            <div className="center-loader"><div className="spinner" /></div>
          ) : !moduleStats || moduleStats.topModules.length === 0 ? (
            <EmptyBlock text="Nu exista date de tracking pentru module inca." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={moduleStats.topModules.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={132} tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={tt} />
                  <Bar dataKey="views" name="Vizualizari" radius={[0, 8, 8, 0]}>
                    {moduleStats.topModules.slice(0, 12).map((module) => (
                      <Cell key={module.name} fill={MODULE_COLORS[module.category] ?? PALETTE.indigo} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="module-summary">
                <div><strong>{moduleStats.usersWithData}</strong><span>zile active cu tracking</span></div>
                <div><strong>{moduleStats.avgActiveMinutesPerUser} min</strong><span>medie/zi activa</span></div>
                <div><strong>{Math.round(moduleStats.totalActiveMinutes / 60)} h</strong><span>timp total</span></div>
              </div>
            </>
          )}
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Control rapid</h2>
              <p>Flags si module critice, live.</p>
            </div>
          </div>
          <div className="quick-control-list">
            {state.flags.slice(0, 6).map((flag) => (
              <div key={flag.id} className="quick-control-row">
                <div>
                  <strong>{flag.name || flag.key}</strong>
                  <span>{flag.enabledFor || 'all'} · {flag.key}</span>
                </div>
                <Toggle checked={flag.enabled} onChange={() => toggleFlag(flag)} disabled={saving === `flag:${flag.id}`} />
              </div>
            ))}
          </div>
          <div className="quick-control-list modules-list">
            {state.modules.slice(0, 8).map((module) => (
              <div key={module.id} className="quick-control-row compact">
                <div>
                  <strong>{module.name || module.id}</strong>
                  <span>{module.planRequired || 'basic'} · {module.area || 'global'}</span>
                </div>
                <Toggle checked={module.enabled} onChange={() => toggleModule(module)} disabled={saving === `module:${module.id}`} />
              </div>
            ))}
          </div>
          <Link className="wide-link" to="/flags">
            Deschide Module & Feature Flags <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="ops-grid-secondary">
        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Useri recenti</h2>
              <p>Ultimele conturi create.</p>
            </div>
            <Link to="/users" className="mini-link">Useri</Link>
          </div>
          <div className="list-stack">
            {state.recentUsers.map((user) => (
              <div key={user.uid} className="person-row">
                <div className="person-avatar">{(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{user.displayName || 'Fara nume'}</strong>
                  <span>{user.email || user.uid}</span>
                </div>
                <small>{fmtRelative(user.createdAt)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Comunitate</h2>
              <p>Postari recente si engagement.</p>
            </div>
            <Link to="/community" className="mini-link">Moderare</Link>
          </div>
          {state.recentPosts.length === 0 ? <EmptyBlock text="Nu exista postari recente." /> : (
            <div className="list-stack">
              {state.recentPosts.map((post) => (
                <div key={post.id} className="content-row">
                  <div>
                    <strong>{post.title || post.content?.slice(0, 52) || 'Postare fara titlu'}</strong>
                    <span>{post.authorName || 'Anonim'} · {post.category || 'general'} · {fmtRelative(post.createdAt)}</span>
                  </div>
                  <small>{post.commentsCount || 0} cmt</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Suport</h2>
              <p>Tickete si configurari utile.</p>
            </div>
            <Link to="/support" className="mini-link">Support</Link>
          </div>
          <div className="support-strip">
            <div><strong>{state.openTickets}</strong><span>deschise</span></div>
            <div><strong>{state.urgentTickets}</strong><span>urgente</span></div>
            <div><strong>{state.scheduledCampaigns}</strong><span>campanii</span></div>
          </div>
          <div className="list-stack">
            {state.tickets.length === 0 ? <EmptyBlock text="Nu exista tickete recente." /> : state.tickets.map((ticket) => (
              <div key={ticket.id} className="ticket-mini">
                <span className={`status-dot ${ticket.priority === 'urgent' ? 'red' : ticket.status === 'resolved' ? 'green' : 'yellow'}`} />
                <div>
                  <strong>{ticket.subject || 'Ticket fara subiect'}</strong>
                  <span>{ticket.category || 'other'} · {ticket.status || 'open'} · {fmtRelative(ticket.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ops-grid-secondary">
        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Configuratie curenta</h2>
              <p>Parametri cheie folositi de aplicatie.</p>
            </div>
            <Link to="/settings" className="mini-link">Editeaza</Link>
          </div>
          <div className="config-grid">
            <div><Settings size={16} /><span>Min app</span><strong>{state.config.minAppVersion || 'n/a'}</strong></div>
            <div><Bot size={16} /><span>AI Free</span><strong>{aiLimits.free}/zi</strong></div>
            <div><Crown size={16} /><span>AI Premium</span><strong>{aiLimits.premium}/zi</strong></div>
            <div><Database size={16} /><span>Storage Free</span><strong>{state.config.storageLimitFreeMb ?? 'n/a'} MB</strong></div>
            <div><FileText size={16} /><span>Documente</span><strong>{fmtNumber(state.documentsCount)}</strong></div>
            <div><Smartphone size={16} /><span>Install</span><strong>{state.googlePlayUsers} Play</strong></div>
          </div>
        </div>

        <div className="ops-card">
          <div className="card-heading">
            <div>
              <h2>Activitate admin</h2>
              <p>Ultimele actiuni auditate.</p>
            </div>
            <Link to="/audit" className="mini-link">Audit</Link>
          </div>
          {state.recentActivity.length === 0 ? <EmptyBlock text="Nu exista evenimente admin recente." /> : (
            <div className="activity-list">
              {state.recentActivity.map((activity, index) => (
                <div key={`${activity.text}-${index}`} className="activity-row">
                  <Activity size={15} color={PALETTE.violet} />
                  <div>
                    <strong>{activity.text}</strong>
                    <span>{fmtRelative(activity.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ops-card command-center">
          <div className="card-heading">
            <div>
              <h2>Comenzi rapide</h2>
              <p>Zone operationale frecvente.</p>
            </div>
          </div>
          {[
            { to: '/users', icon: Users, label: 'Gestionare utilizatori', sub: 'profil, auth, premium, notificari' },
            { to: '/billing', icon: Crown, label: 'Billing & Revenue', sub: 'planuri, vouchere, plati' },
            { to: '/notifications', icon: Bell, label: 'Campanii push', sub: 'segmente si trimitere' },
            { to: '/content', icon: FileText, label: 'Continut master', sub: 'vaccinuri, alimente, articole' },
            { to: '/ai', icon: Bot, label: 'AI Center', sub: 'prompturi, costuri, usage' },
            { to: '/flags', icon: Flag, label: 'Feature flags', sub: 'module si acces pe plan' },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="command-link">
              <item.icon size={17} />
              <span><strong>{item.label}</strong><small>{item.sub}</small></span>
              <ChevronRight size={15} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
