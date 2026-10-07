import { useEffect, useMemo, useState } from 'react';
import { toast } from "../lib/toast";
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit, fmtDate } from '../lib/utils';
import { useAdminStore } from '../store/adminStore';
import type { AppUser } from '../types';

type PlanKey = 'basic' | 'premium';

interface PremiumVoucher {
  id: string;
  code: string;
  plan: PlanKey;
  durationDays: number;
  maxRedemptions: number;
  redeemedCount: number;
  isActive: boolean;
  expiresAt?: any;
  createdAt?: any;
  createdBy?: string;
}

interface PlanConfig {
  id: PlanKey;
  name: string;
  aiLimitPerDay: number;
  storageLimitMb: number;
  modules: Record<string, boolean>;
  features: Record<string, boolean>;
  updatedAt?: any;
}

interface ModuleConfig {
  id: string;
  name: string;
  area: 'child' | 'pregnancy' | 'global';
  description: string;
  enabled: boolean;
  defaultPlans: PlanKey[];
  badge?: string;
  badgeColor?: string;
  deniedTitle?: string;
  deniedMessage?: string;
  updatedAt?: any;
}

const MODULES: ModuleConfig[] = [
  { id: 'feeding', name: 'Hranire', area: 'child', description: 'Alaptare, biberon si solide', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'sleep', name: 'Somn', area: 'child', description: 'Timer somn si istoric', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'diapers', name: 'Scutece', area: 'child', description: 'Urmarire scutece si iritatii', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'growth', name: 'Crestere', area: 'child', description: 'Masuratori si percentile', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'vaccines', name: 'Vaccinuri', area: 'child', description: 'Calendar si notificari vaccinuri', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'milestones', name: 'Etape', area: 'child', description: 'Etape de dezvoltare CDC', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'food', name: 'Alimentatie', area: 'child', description: 'Diversificare si alimente introduse', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'emotions', name: 'Emotii', area: 'child', description: 'Stare emotionala si exercitii', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'development', name: 'Dezvoltare', area: 'child', description: 'Perioade sensibile + achizitii', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'teeth', name: 'Dintistori', area: 'child', description: 'Harta dinti bebe', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'activities', name: 'Activitati', area: 'child', description: 'Activitati pe varsta', enabled: true, defaultPlans: ['premium'] },
  { id: 'sleep-coach', name: 'Sleep Coach', area: 'child', description: 'Planuri si ghiduri de somn', enabled: true, defaultPlans: ['premium'] },
  { id: 'documents', name: 'Documente', area: 'global', description: 'Documente medicale si storage', enabled: true, defaultPlans: ['premium'] },
  { id: 'emergency', name: 'Urgente', area: 'global', description: 'Informatii urgente si contacte', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'community', name: 'Comunitate', area: 'global', description: 'Feed comunitate', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'family', name: 'Familie', area: 'child', description: 'Partajare familie si permisiuni', enabled: true, defaultPlans: ['premium'] },
  { id: 'assistant', name: 'Asistent AI', area: 'global', description: 'Chat si insight-uri AI', enabled: true, defaultPlans: ['premium'] },
  { id: 'pregnancy', name: 'Sarcina', area: 'pregnancy', description: 'Dashboard sarcina, saptamani si istoric', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'birth', name: 'Nastere', area: 'pregnancy', description: 'Postpartum, acte si prima saptamana', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'appointments', name: 'Programari', area: 'pregnancy', description: 'Programari medicale', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'nutrition', name: 'Nutritie', area: 'pregnancy', description: 'Ghid nutritie sarcina', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'wellbeing', name: 'Bunastare', area: 'pregnancy', description: 'Stare mama si wellbeing', enabled: true, defaultPlans: ['basic', 'premium'] },
  { id: 'contractions', name: 'Contractii', area: 'pregnancy', description: 'Timer contractii si regula 5-1-1', enabled: true, defaultPlans: ['premium'] },
  { id: 'fetal_movements', name: 'Miscari fetale', area: 'pregnancy', description: 'Contor si istoric miscari fetale', enabled: true, defaultPlans: ['premium'] },
  { id: 'birth_plan', name: 'Plan nastere', area: 'pregnancy', description: 'Plan nastere si preferinte', enabled: true, defaultPlans: ['premium'] },
];

const FEATURES = [
  { id: 'advancedReports', label: 'Rapoarte avansate' },
  { id: 'prioritySupport', label: 'Suport prioritar' },
  { id: 'unlimitedDocuments', label: 'Documente nelimitate' },
  { id: 'aiInsights', label: 'Insight-uri AI' },
  { id: 'earlyAccess', label: 'Early access' },
];

const defaultPlan = (id: PlanKey): PlanConfig => ({
  id,
  name: id === 'premium' ? 'Premium' : 'Basic',
  aiLimitPerDay: id === 'premium' ? 500 : 50,
  storageLimitMb: id === 'premium' ? 2048 : 100,
  modules: Object.fromEntries(MODULES.map((m) => [m.id, m.defaultPlans.includes(id)])),
  features: Object.fromEntries(FEATURES.map((f) => [f.id, id === 'premium'])),
});

const isPremium = (u: AppUser) => u.subscription?.plan === 'premium' && u.subscription?.status === 'active';
const isBasic = (u: AppUser) => !isPremium(u);

function cleanCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export default function Billing() {
  const { adminUser } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vouchers, setVouchers] = useState<PremiumVoucher[]>([]);
  const [plans, setPlans] = useState<Record<PlanKey, PlanConfig>>({
    basic: defaultPlan('basic'),
    premium: defaultPlan('premium'),
  });
  const [modules, setModules] = useState<ModuleConfig[]>(MODULES);
  const [tab, setTab] = useState<'users' | 'vouchers' | 'access'>('users');
  const [search, setSearch] = useState('');
  const [voucherDraft, setVoucherDraft] = useState({
    code: '',
    plan: 'premium' as PlanKey,
    durationDays: 30,
    maxRedemptions: 1,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [usersSnap, vouchersSnap, plansSnap, modulesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'premiumVouchers'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'planConfigs')),
        getDocs(collection(db, 'moduleCatalog')),
      ]);

      setUsers(usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      setVouchers(vouchersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PremiumVoucher)));

      const nextPlans = { basic: defaultPlan('basic'), premium: defaultPlan('premium') };
      plansSnap.docs.forEach((d) => {
        if (d.id === 'basic' || d.id === 'premium') nextPlans[d.id] = { ...nextPlans[d.id], ...d.data(), id: d.id } as PlanConfig;
      });
      setPlans(nextPlans);

      const savedModules = new Map(modulesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as ModuleConfig]));
      setModules(MODULES.map((m) => ({ ...m, ...(savedModules.get(m.id) || {}) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, []);

  const premiumUsers = useMemo(() => users.filter(isPremium), [users]);
  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((u) => (
      !term ||
      u.email?.toLowerCase().includes(term) ||
      u.displayName?.toLowerCase().includes(term) ||
      u.uid.toLowerCase().includes(term)
    ));
  }, [users, search]);

  const grantPremium = async (u: AppUser, days: number) => {
    const expiresAt = days > 0 ? Timestamp.fromDate(new Date(Date.now() + days * 86400000)) : null;
    const subscription = {
      plan: 'premium',
      status: 'active',
      source: 'admin',
      provider: 'admin',
      startedAt: serverTimestamp(),
      expiresAt,
      updatedAt: serverTimestamp(),
      updatedBy: adminUser?.email || 'admin',
    };

    await updateDoc(doc(db, 'users', u.uid), {
      subscription,
      isPremium: true,
      updatedAt: serverTimestamp(),
    });
    await logAudit('grant_premium', 'user', u.uid, `Premium acordat manual pentru ${days || 'nelimitat'} zile`, { days });
    await load();
  };

  const setBasicPlan = async (u: AppUser) => {
    await updateDoc(doc(db, 'users', u.uid), {
      subscription: {
        plan: 'basic',
        status: 'active',
        source: 'admin',
        provider: 'admin',
        updatedAt: serverTimestamp(),
        updatedBy: adminUser?.email || 'admin',
      },
      isPremium: false,
      updatedAt: serverTimestamp(),
    });
    await logAudit('set_basic_plan', 'user', u.uid, 'Plan schimbat manual la Basic');
    await load();
  };

  const changeUserPlan = async (u: AppUser, value: string) => {
    try {
      setSaving(true);
      if (value === 'basic') {
        await setBasicPlan(u);
      } else if (value === 'premium_30') {
        await grantPremium(u, 30);
      } else if (value === 'premium_365') {
        await grantPremium(u, 365);
      } else if (value === 'premium_unlimited') {
        await grantPremium(u, 0);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Nu am putut schimba planul. Verifica permisiunile adminului.');
    } finally {
      setSaving(false);
    }
  };

  const updateUserModule = async (u: AppUser, moduleId: string, enabled: boolean) => {
    await updateDoc(doc(db, 'users', u.uid), {
      [`moduleOverrides.${moduleId}`]: enabled,
      updatedAt: serverTimestamp(),
    });
    await logAudit('update_user_module_access', 'user', u.uid, `${moduleId} = ${enabled}`, { moduleId, enabled });
    setUsers((prev) => prev.map((item) => item.uid === u.uid ? {
      ...item,
      moduleOverrides: { ...(item.moduleOverrides || {}), [moduleId]: enabled },
    } : item));
  };

  const createVoucher = async () => {
    const code = cleanCode(voucherDraft.code || `MAMI-${Math.random().toString(36).slice(2, 8)}`);
    if (code.length < 4) {
      toast.error('Codul trebuie sa aiba minim 4 caractere.');
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, 'premiumVouchers', code);
      const voucher: Omit<PremiumVoucher, 'id'> = {
        code,
        plan: voucherDraft.plan,
        durationDays: Number(voucherDraft.durationDays) || 30,
        maxRedemptions: Number(voucherDraft.maxRedemptions) || 1,
        redeemedCount: 0,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: adminUser?.email || 'admin',
      };
      await setDoc(ref, voucher);
      await logAudit('create_voucher', 'premium_voucher', code, 'Voucher premium creat', voucher);
      setVoucherDraft({ code: '', plan: 'premium', durationDays: 30, maxRedemptions: 1 });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleVoucher = async (v: PremiumVoucher) => {
    await updateDoc(doc(db, 'premiumVouchers', v.id), {
      isActive: !v.isActive,
      updatedAt: serverTimestamp(),
      updatedBy: adminUser?.email || 'admin',
    });
    await logAudit('toggle_voucher', 'premium_voucher', v.code, `Voucher ${!v.isActive ? 'activat' : 'dezactivat'}`);
    await load();
  };

  const savePlan = async (plan: PlanConfig) => {
    await setDoc(doc(db, 'planConfigs', plan.id), {
      ...plan,
      updatedAt: serverTimestamp(),
      updatedBy: adminUser?.email || 'admin',
    }, { merge: true });
    await logAudit('update_plan_config', 'plan_config', plan.id, 'Plan actualizat din admin', plan);
  };

  const saveModule = async (module: ModuleConfig) => {
    await setDoc(doc(db, 'moduleCatalog', module.id), {
      ...module,
      updatedAt: serverTimestamp(),
      updatedBy: adminUser?.email || 'admin',
    }, { merge: true });
    await logAudit('update_module_config', 'module', module.id, 'Modul actualizat din admin', module);
  };

  const togglePlanModule = async (planId: PlanKey, moduleId: string) => {
    const next = {
      ...plans[planId],
      modules: { ...plans[planId].modules, [moduleId]: !plans[planId].modules[moduleId] },
    };
    setPlans((prev) => ({ ...prev, [planId]: next }));
    await savePlan(next);
  };

  const togglePlanFeature = async (planId: PlanKey, featureId: string) => {
    const next = {
      ...plans[planId],
      features: { ...plans[planId].features, [featureId]: !plans[planId].features[featureId] },
    };
    setPlans((prev) => ({ ...prev, [planId]: next }));
    await savePlan(next);
  };

  const toggleGlobalModule = async (module: ModuleConfig) => {
    const next = { ...module, enabled: !module.enabled };
    setModules((prev) => prev.map((m) => m.id === module.id ? next : m));
    await saveModule(next);
  };

  const updateModuleField = (id: string, field: 'badge' | 'badgeColor' | 'deniedTitle' | 'deniedMessage', value: string) => {
    setModules((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveModuleField = async (
    module: ModuleConfig,
    field: 'badge' | 'badgeColor' | 'deniedTitle' | 'deniedMessage',
    value: string,
  ) => {
    const next = { ...module, [field]: value };
    setModules((prev) => prev.map((m) => m.id === module.id ? next : m));
    await saveModule(next);
  };

  const statCards = [
    { label: 'Premium activ', value: premiumUsers.length, sub: `${users.length} utilizatori total`, color: '#F59E0B' },
    { label: 'Basic / Free', value: users.filter(isBasic).length, sub: 'fara premium activ', color: '#10B981' },
    { label: 'Vouchere active', value: vouchers.filter((v) => v.isActive).length, sub: `${vouchers.length} coduri create`, color: '#6366F1' },
    { label: 'Module active', value: modules.filter((m) => m.enabled).length, sub: `${modules.length} module configurate`, color: '#3B82F6' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1280 }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Abonamente, vouchere si acces</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
            Gestioneaza Premium, coduri voucher, module globale si acces pe planuri direct in Firestore.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => load()} disabled={loading}>Reincarca</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))', gap: 14, marginBottom: 20 }}>
        {statCards.map((k) => (
          <div key={k.label} className="card">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: k.color + '22', marginBottom: 10 }} />
            <div style={{ fontSize: 24, fontWeight: 800 }}>{k.value.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{k.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="tabs" style={{ width: 'fit-content', marginBottom: 18 }}>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Utilizatori</button>
        <button className={`tab ${tab === 'vouchers' ? 'active' : ''}`} onClick={() => setTab('vouchers')}>Vouchere</button>
        <button className={`tab ${tab === 'access' ? 'active' : ''}`} onClick={() => setTab('access')}>Planuri & module</button>
      </div>

      {loading ? (
        <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
      ) : tab === 'users' ? (
        <>
          <input className="input" placeholder="Cauta dupa nume, email sau UID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360, marginBottom: 12 }} />
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Utilizator</th>
                    <th>Plan</th>
                    <th>Expira</th>
                    <th>Module speciale</th>
                    <th>Schimba plan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.uid}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{u.displayName || 'Utilizator'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email || u.uid}</div>
                      </td>
                      <td>
                        <span className={`badge ${isPremium(u) ? 'badge-yellow' : 'badge-gray'}`}>
                          {isPremium(u) ? 'Premium activ' : 'Basic'}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{u.subscription?.source || 'standard'}</div>
                      </td>
                      <td>{u.subscription?.expiresAt ? fmtDate(u.subscription.expiresAt) : isPremium(u) ? 'Nelimitat' : '-'}</td>
                      <td>
                        <select
                          className="input"
                          style={{ width: 210 }}
                          defaultValue=""
                          onChange={(e) => {
                            const [moduleId, val] = e.target.value.split(':');
                            if (moduleId) updateUserModule(u, moduleId, val === 'on').catch(() => toast.error('Nu am putut salva accesul.'));
                            e.currentTarget.value = '';
                          }}
                        >
                          <option value="">Alege override...</option>
                          {modules.map((m) => (
                            <option key={m.id} value={`${m.id}:${u.moduleOverrides?.[m.id] === true ? 'off' : 'on'}`}>
                              {m.name}: {u.moduleOverrides?.[m.id] === true ? 'dezactiveaza' : 'activeaza'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="input"
                          value={isPremium(u) ? 'premium_current' : 'basic_current'}
                          disabled={saving}
                          onChange={(e) => changeUserPlan(u, e.target.value)}
                          style={{ width: 190 }}
                        >
                          <option value={isPremium(u) ? 'premium_current' : 'basic_current'}>
                            {isPremium(u) ? 'Premium actual' : 'Basic actual'}
                          </option>
                          <option value="basic">Basic</option>
                          <option value="premium_30">Premium 30 zile</option>
                          <option value="premium_365">Premium 1 an</option>
                          <option value="premium_unlimited">Premium nelimitat</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : tab === 'vouchers' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card">
            <h2 style={{ fontSize: 15, marginBottom: 14 }}>Creeaza voucher Premium</h2>
            <label style={label}>Cod</label>
            <input className="input" placeholder="ex: MAMI30" value={voucherDraft.code} onChange={(e) => setVoucherDraft({ ...voucherDraft, code: e.target.value })} />
            <label style={label}>Plan</label>
            <select className="input" value={voucherDraft.plan} onChange={(e) => setVoucherDraft({ ...voucherDraft, plan: e.target.value as PlanKey })}>
              <option value="premium">Premium</option>
              <option value="basic">Basic</option>
            </select>
            <label style={label}>Durata zile</label>
            <input className="input" type="number" min={1} value={voucherDraft.durationDays} onChange={(e) => setVoucherDraft({ ...voucherDraft, durationDays: Number(e.target.value) })} />
            <label style={label}>Utilizari maxime</label>
            <input className="input" type="number" min={1} value={voucherDraft.maxRedemptions} onChange={(e) => setVoucherDraft({ ...voucherDraft, maxRedemptions: Number(e.target.value) })} />
            <button className="btn btn-primary" disabled={saving} onClick={createVoucher} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
              Creeaza voucher
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Cod</th><th>Plan</th><th>Durata</th><th>Folosiri</th><th>Status</th><th>Actiuni</th></tr></thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td><code>{v.code}</code></td>
                    <td>{v.plan}</td>
                    <td>{v.durationDays} zile</td>
                    <td>{v.redeemedCount || 0} / {v.maxRedemptions}</td>
                    <td><span className={`badge ${v.isActive ? 'badge-green' : 'badge-gray'}`}>{v.isActive ? 'Activ' : 'Inactiv'}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => toggleVoucher(v)}>{v.isActive ? 'Dezactiveaza' : 'Activeaza'}</button></td>
                  </tr>
                ))}
                {vouchers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>Nu exista vouchere.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(['basic', 'premium'] as PlanKey[]).map((planId) => (
            <div key={planId} className="card">
              <h2 style={{ fontSize: 16, marginBottom: 4 }}>{plans[planId].name}</h2>
              <p style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>Controleaza exact ce primeste planul.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={label}>AI / zi</label>
                  <input className="input" type="number" value={plans[planId].aiLimitPerDay} onChange={(e) => setPlans((p) => ({ ...p, [planId]: { ...p[planId], aiLimitPerDay: Number(e.target.value) } }))} onBlur={() => savePlan(plans[planId])} />
                </div>
                <div>
                  <label style={label}>Storage MB</label>
                  <input className="input" type="number" value={plans[planId].storageLimitMb} onChange={(e) => setPlans((p) => ({ ...p, [planId]: { ...p[planId], storageLimitMb: Number(e.target.value) } }))} onBlur={() => savePlan(plans[planId])} />
                </div>
              </div>
              <div className="section-title">Module</div>
              {modules.map((m) => (
                <label key={m.id} style={checkRow}>
                  <input type="checkbox" checked={Boolean(plans[planId].modules[m.id])} onChange={() => togglePlanModule(planId, m.id)} />
                  <span>{m.name}</span>
                  {!m.enabled && <span className="badge badge-red">global oprit</span>}
                </label>
              ))}
              <div className="section-title" style={{ marginTop: 18 }}>Functii</div>
              {FEATURES.map((f) => (
                <label key={f.id} style={checkRow}>
                  <input type="checkbox" checked={Boolean(plans[planId].features[f.id])} onChange={() => togglePlanFeature(planId, f.id)} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          ))}

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>Module globale</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 10 }}>
              {modules.map((m) => (
                <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{m.name}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12 }}>{m.description}</div>
                    </div>
                    <button className={`btn btn-sm ${m.enabled ? 'btn-success' : 'btn-danger'}`} onClick={() => toggleGlobalModule(m)}>
                      {m.enabled ? 'Activ' : 'Oprit'}
                    </button>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="badge badge-blue">{m.area}</span>
                    {m.badge && <span className="badge" style={{ backgroundColor: m.badgeColor || '#E8997A', color: 'white' }}>{m.badge}</span>}
                  </div>
                  
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input 
                      className="input" 
                      style={{ flex: 1, padding: '4px 8px', fontSize: 11, height: 28 }} 
                      placeholder="Tag UI (ex: In curand)" 
                      value={m.badge || ''} 
                      onChange={(e) => updateModuleField(m.id, 'badge', e.target.value)} 
                      onBlur={(e) => saveModuleField(m, 'badge', e.currentTarget.value)} 
                    />
                    <input 
                      className="input" 
                      style={{ width: 70, padding: '4px 8px', fontSize: 11, height: 28 }} 
                      placeholder="#HEX" 
                      value={m.badgeColor || ''} 
                      onChange={(e) => updateModuleField(m.id, 'badgeColor', e.target.value)} 
                      onBlur={(e) => saveModuleField(m, 'badgeColor', e.currentTarget.value)} 
                    />
                  </div>
                  
                  <div style={{ marginTop: 8 }}>
                    <input 
                      className="input" 
                      style={{ width: '100%', padding: '4px 8px', fontSize: 11, height: 28, marginBottom: 4 }} 
                      placeholder="Titlu refuz acces" 
                      value={m.deniedTitle || ''} 
                      onChange={(e) => updateModuleField(m.id, 'deniedTitle', e.target.value)} 
                      onBlur={(e) => saveModuleField(m, 'deniedTitle', e.currentTarget.value)} 
                    />
                    <textarea 
                      className="input" 
                      style={{ width: '100%', padding: '4px 8px', fontSize: 11, height: 40, resize: 'none' }} 
                      placeholder="Mesaj refuz acces" 
                      value={m.deniedMessage || ''} 
                      onChange={(e) => updateModuleField(m.id, 'deniedMessage', e.target.value)} 
                      onBlur={(e) => saveModuleField(m, 'deniedMessage', e.currentTarget.value)} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text3)',
  marginTop: 12,
  marginBottom: 5,
  fontWeight: 700,
  textTransform: 'uppercase',
};

const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 0',
  color: 'var(--text2)',
  fontSize: 13,
};
