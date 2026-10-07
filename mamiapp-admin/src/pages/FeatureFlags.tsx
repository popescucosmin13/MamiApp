// src/pages/FeatureFlags.tsx — Module & Feature Flags management
import { useEffect, useState } from 'react';
import { toast } from "../lib/toast";
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit } from '../lib/utils';
import { useAdminStore } from '../store/adminStore';
import type { FeatureFlag } from '../types';

// ─── MODULE CATALOG ───────────────────────────────────────────────────────────

interface ModuleConfig {
  id: string;
  name: string;
  emoji: string;
  description: string;
  area: 'child' | 'pregnancy' | 'global';
  enabled: boolean;
  planRequired: 'none' | 'basic' | 'premium';
  badge?: string;
  badgeColor?: string;
  deniedTitle?: string;
  deniedMessage?: string;
}

const BADGE_COLOR_PRESETS = ['#E8997A', '#D88FA8', '#5BAA90', '#F59E0B', '#7A6FF0', '#EF4444', '#64748B'];

const DEFAULT_MODULES: Omit<ModuleConfig, 'enabled' | 'planRequired'>[] = [
  { id: 'assistant',     name: 'AI Asistent',          emoji: '✨', description: 'Chat AI și insight-uri zilnice',                    area: 'global' },
  { id: 'community',    name: 'Comunitate',            emoji: '👥', description: 'Feed comunitate și postări',                        area: 'global' },
  { id: 'family',       name: 'Partajare Familie',     emoji: '👨‍👩‍👦', description: 'Acces partajat cu membrii familiei',             area: 'global' },
  { id: 'documents',    name: 'Documente Medicale',    emoji: '📄', description: 'Upload și organizare documente',                    area: 'global' },
  { id: 'feeding',      name: 'Alăptare & Hrănire',   emoji: '🍼', description: 'Timer alăptare, biberon, mese solide',              area: 'child' },
  { id: 'sleep',        name: 'Somn',                  emoji: '😴', description: 'Timer somn și recomandări AAP',                     area: 'child' },
  { id: 'diapers',      name: 'Scutece',               emoji: '🧷', description: 'Înregistrare scutece',                             area: 'child' },
  { id: 'growth',       name: 'Creștere & Percentile', emoji: '📊', description: 'Măsurători + grafice percentile WHO',              area: 'child' },
  { id: 'vaccines',     name: 'Vaccin Calendar',       emoji: '💉', description: 'Calendar vaccinări INSP',                          area: 'child' },
  { id: 'milestones',   name: 'Milestone-uri CDC',     emoji: '🌟', description: 'Achiziții de dezvoltare pe vârstă',                area: 'child' },
  { id: 'food',         name: 'Diversificare',         emoji: '🥕', description: 'Ghid diversificare și plan săptămânal',            area: 'child' },
  { id: 'sleep-coach',  name: 'Plan Somn AI',          emoji: '🌙', description: 'Metode antrenament somn generate AI',              area: 'child' },
  { id: 'activities',   name: 'Activități',            emoji: '🎨', description: 'Activități stimulatoare pe vârstă',                area: 'child' },
  { id: 'wellbeing',    name: 'Starea Mamei',          emoji: '💚', description: 'Wellbeing și prevenire burnout',                   area: 'global' },
  { id: 'emotions',     name: 'Emoții & Respirație',   emoji: '🧘', description: 'Exerciții respirație și tehnici parentale',        area: 'global' },
  { id: 'emergency',    name: 'Urgențe',               emoji: '🚨', description: 'Acces offline la numerele de urgență',             area: 'global' },
  { id: 'school',       name: 'Modul Școlar',          emoji: '🎒', description: 'Orar și teme pentru copii 3-6 ani',               area: 'child' },
  { id: 'pregnancy',    name: 'Modul Sarcină',         emoji: '🌸', description: 'Urmărire sarcină săptămână cu săptămână',         area: 'pregnancy' },
  { id: 'appointments', name: 'Programări Medicale',   emoji: '📅', description: 'Programări și consultații sarcină',               area: 'pregnancy' },
  { id: 'nutrition',    name: 'Nutriție Sarcină',      emoji: '🥗', description: 'Ghid alimentație în sarcină',                     area: 'pregnancy' },
  { id: 'birth',        name: 'Naștere & Postpartum',  emoji: '👶', description: 'Pregătire naștere și primele săptămâni',          area: 'pregnancy' },
  { id: 'articles',     name: 'Articole',              emoji: '📰', description: 'Ghiduri și articole cu imagini/video, favorite',  area: 'global' },
];

const PLAN_LABELS: Record<string, string> = {
  none:    '🚫 Nimeni',
  basic:   '🆓 Basic + Premium',
  premium: '💎 Doar Premium',
};
const PLAN_COLORS: Record<string, string> = {
  none:    'var(--danger)',
  basic:   'var(--success)',
  premium: '#F59E0B',
};
const AREA_LABELS: Record<string, string> = {
  child:     '👶 Copil',
  pregnancy: '🌸 Sarcină',
  global:    '🌐 Global',
};
const AREA_COLORS: Record<string, string> = {
  child:     '#5BAA90',
  pregnancy: '#D88FA8',
  global:    '#5A78A0',
};

// ─── FEATURE FLAGS ────────────────────────────────────────────────────────────

const DEFAULT_FLAGS: Omit<FeatureFlag, 'id' | 'updatedAt' | 'updatedBy'>[] = [
  { key: 'enablePremiumPlans',     name: 'Abonamente Premium',    description: 'Afișează opțiunile de upgrade la Premium',             enabled: true,  enabledFor: 'all' },
  { key: 'enableDocumentOCR',      name: 'OCR Documente',         description: 'Extragere text automat din imagini documente',         enabled: false, enabledFor: 'premium' },
  { key: 'enableDiversificationAI',name: 'Diversificare AI',      description: 'Generare plan diversificare alimente cu AI',           enabled: true,  enabledFor: 'premium' },
  { key: 'enableMaintenanceMode',  name: 'Mod Mentenanță',        description: 'Blochează accesul în aplicație pentru toți userii',    enabled: false, enabledFor: 'none' },
  { key: 'enableBetaFeatures',     name: 'Funcții Beta',          description: 'Funcții experimentale vizibile doar pentru beta',      enabled: false, enabledFor: 'admin' },
];

const FOR_LABELS: Record<string, string> = {
  all: '🌐 Toți', admin: '🔑 Doar Admin', beta: '🧪 Beta',
  premium: '💎 Premium', none: '🚫 Nimeni',
};
const FOR_COLORS: Record<string, string> = {
  all: 'var(--success)', admin: 'var(--accent)', beta: 'var(--warning)',
  premium: '#F59E0B', none: 'var(--danger)',
};

function mergeFlags(saved: FeatureFlag[]) {
  const byKey = new Map<string, FeatureFlag>();
  DEFAULT_FLAGS.forEach(f => byKey.set(f.key, { ...f, id: f.key, updatedAt: null, updatedBy: '' }));
  [...saved].sort((a, b) => Number(a.id === a.key) - Number(b.id === b.key)).forEach(f => {
    const ex = byKey.get(f.key);
    byKey.set(f.key, { ...(ex || {}), ...f, id: f.id || f.key });
  });
  return Array.from(byKey.values()).sort((a, b) => {
    const ai = DEFAULT_FLAGS.findIndex(f => f.key === a.key);
    const bi = DEFAULT_FLAGS.findIndex(f => f.key === b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

// ─── TOGGLE COMPONENT ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 46, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: value ? 'var(--success)' : 'var(--border2)',
        position: 'relative', flexShrink: 0, transition: 'background .2s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, transition: 'left .2s',
        left: value ? 23 : 3, boxShadow: '0 1px 4px rgba(0,0,0,.3)',
      }} />
    </button>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function FeatureFlags() {
  const { adminUser } = useAdminStore();

  // Modules state
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<'all' | 'child' | 'pregnancy' | 'global'>('all');
  const [customizing, setCustomizing] = useState<ModuleConfig | null>(null);
  const [customForm, setCustomForm] = useState({ badge: '', badgeColor: '', deniedTitle: '', deniedMessage: '' });
  const [savingCustom, setSavingCustom] = useState(false);

  // Flags state
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);

  // Tab
  const [tab, setTab] = useState<'modules' | 'flags'>('modules');

  // User counts for affected users
  const [totalUsers, setTotalUsers] = useState(0);
  const [premiumUsers, setPremiumUsers] = useState(0);
  const [betaTesters, setBetaTesters] = useState(0);

  // ── Load modules ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setModulesLoading(true);
      try {
        const snap = await getDocs(collection(db, 'moduleCatalog'));
        const saved = new Map(snap.docs.map(d => [d.id, d.data()]));

        const merged: ModuleConfig[] = DEFAULT_MODULES.map(m => {
          const data = saved.get(m.id) as any;
          return {
            ...m,
            enabled: data?.enabled !== false,          // default: active
            planRequired: data?.planRequired ?? 'basic', // default: everyone
            badge: data?.badge || '',
            badgeColor: data?.badgeColor || '',
            deniedTitle: data?.deniedTitle || '',
            deniedMessage: data?.deniedMessage || '',
          };
        });

        // Seed sau patch module în Firestore:
        // - Modulele lipsă sunt create cu valorile default (planRequired: 'basic')
        // - Modulele existente fără planRequired sunt patch-uite (migrare date vechi)
        await Promise.all(merged.map(async m => {
          const existingData = saved.get(m.id) as any;
          if (!saved.has(m.id)) {
            // Modul nou → seed complet
            await setDoc(doc(db, 'moduleCatalog', m.id), {
              name: m.name, area: m.area, description: m.description,
              enabled: m.enabled, planRequired: m.planRequired,
              updatedAt: serverTimestamp(), updatedBy: adminUser?.email || '',
            });
          } else if (existingData && existingData.planRequired === undefined) {
            // Modul existent fără planRequired (date vechi) → adaugă câmpul
            await setDoc(doc(db, 'moduleCatalog', m.id), {
              planRequired: 'basic',
              updatedAt: serverTimestamp(), updatedBy: 'system-migration',
            }, { merge: true });
          }
        }));

        setModules(merged);
      } catch (e) {
        console.error(e);
      }
      setModulesLoading(false);
    };
    load();
  }, []);

  // ── Load user counts ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let total = 0, premium = 0, beta = 0;
        usersSnap.docs.forEach(d => {
          total++;
          const data = d.data();
          if (data.subscription?.plan === 'premium') premium++;
          if (data.isBetaTester === true || data.betaTester === true) beta++;
        });
        setTotalUsers(total);
        setPremiumUsers(premium);
        setBetaTesters(beta);
      } catch { /* ignore */ }
    };
    load();
  }, []);

  // ── Load flags ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setFlagsLoading(true);
      try {
        const snap = await getDocs(collection(db, 'featureFlags'));
        if (snap.empty) {
          const batch: FeatureFlag[] = [];
          for (const f of DEFAULT_FLAGS) {
            await setDoc(doc(db, 'featureFlags', f.key), { ...f, updatedAt: serverTimestamp(), updatedBy: adminUser?.email || '' });
            batch.push({ ...f, id: f.key, updatedAt: null, updatedBy: adminUser?.email || '' });
          }
          setFlags(batch);
        } else {
          const saved = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeatureFlag));
          setFlags(mergeFlags(saved));
          await Promise.all(DEFAULT_FLAGS.map(async f => {
            if (saved.some(s => s.key === f.key && s.id === f.key)) return;
            await setDoc(doc(db, 'featureFlags', f.key), { ...f, updatedAt: serverTimestamp(), updatedBy: adminUser?.email || '' });
          }));
        }
      } catch { setFlags(mergeFlags([])); }
      setFlagsLoading(false);
    };
    load();
  }, []);

  // ── Module actions ────────────────────────────────────────────────────────
  const toggleModule = async (m: ModuleConfig) => {
    setSavingModule(m.id);
    try {
      const newVal = !m.enabled;
      await setDoc(doc(db, 'moduleCatalog', m.id), {
        enabled: newVal, updatedAt: serverTimestamp(), updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit(newVal ? 'enable_module' : 'disable_module', 'module', m.id, `Modul ${m.name} ${newVal ? 'activat' : 'dezactivat'}`);
      setModules(prev => prev.map(x => x.id === m.id ? { ...x, enabled: newVal } : x));
    } catch { toast.error('Eroare la salvare.'); }
    setSavingModule(null);
  };

  const changePlan = async (m: ModuleConfig, val: ModuleConfig['planRequired']) => {
    setSavingModule(m.id + '_plan');
    try {
      await setDoc(doc(db, 'moduleCatalog', m.id), {
        planRequired: val, updatedAt: serverTimestamp(), updatedBy: adminUser?.email || '',
      }, { merge: true });
      await logAudit('update_module_plan', 'module', m.id, `Plan modul ${m.name} → ${val}`);
      setModules(prev => prev.map(x => x.id === m.id ? { ...x, planRequired: val } : x));
    } catch { toast.error('Eroare la salvare.'); }
    setSavingModule(null);
  };

  const openCustomize = (m: ModuleConfig) => {
    setCustomizing(m);
    setCustomForm({
      badge: m.badge || '',
      badgeColor: m.badgeColor || BADGE_COLOR_PRESETS[0],
      deniedTitle: m.deniedTitle || '',
      deniedMessage: m.deniedMessage || '',
    });
  };

  const saveCustomize = async () => {
    if (!customizing) return;
    setSavingCustom(true);
    try {
      const payload = {
        badge: customForm.badge.trim(),
        badgeColor: customForm.badge.trim() ? customForm.badgeColor : '',
        deniedTitle: customForm.deniedTitle.trim(),
        deniedMessage: customForm.deniedMessage.trim(),
        updatedAt: serverTimestamp(), updatedBy: adminUser?.email || '',
      };
      await setDoc(doc(db, 'moduleCatalog', customizing.id), payload, { merge: true });
      await logAudit('customize_module', 'module', customizing.id, `Personalizare modul ${customizing.name} (etichetă/mesaj blocare)`);
      setModules(prev => prev.map(x => x.id === customizing.id ? { ...x, ...payload } : x));
      toast.success('Salvat.');
      setCustomizing(null);
    } catch (e) {
      console.error(e);
      toast.error('Eroare la salvare.');
    }
    setSavingCustom(false);
  };

  // ── Flag actions ──────────────────────────────────────────────────────────
  const toggleFlag = async (flag: FeatureFlag) => {
    setSavingFlag(flag.id);
    try {
      const newVal = !flag.enabled;
      await updateDoc(doc(db, 'featureFlags', flag.id), { enabled: newVal, updatedAt: serverTimestamp(), updatedBy: adminUser?.email });
      await logAudit(newVal ? 'enable_flag' : 'disable_flag', 'feature_flag', flag.key, `Flag ${flag.key} ${newVal ? 'activat' : 'dezactivat'}`);
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: newVal } : f));
    } catch { toast.error('Eroare la salvare.'); }
    setSavingFlag(null);
  };

  const changeFor = async (flag: FeatureFlag, val: FeatureFlag['enabledFor']) => {
    try {
      await updateDoc(doc(db, 'featureFlags', flag.id), { enabledFor: val, updatedAt: serverTimestamp(), updatedBy: adminUser?.email });
      await logAudit('update_flag_scope', 'feature_flag', flag.key, `Scope ${flag.key} → ${val}`);
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabledFor: val } : f));
    } catch { }
  };

  // ── Compute affected users ────────────────────────────────────────────────
  const affectedCount = (enabledFor: FeatureFlag['enabledFor']): string => {
    if (enabledFor === 'all') return String(totalUsers);
    if (enabledFor === 'premium') return String(premiumUsers);
    if (enabledFor === 'beta') return String(betaTesters);
    if (enabledFor === 'admin') return 'Solo admini';
    return '0';
  };

  // ── Filtered modules ──────────────────────────────────────────────────────
  const filteredModules = modules.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(moduleSearch.toLowerCase()) || m.id.includes(moduleSearch.toLowerCase());
    const matchArea = areaFilter === 'all' || m.area === areaFilter;
    return matchSearch && matchArea;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: 960 }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>⚙️ Module & Feature Flags</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
          Controlează ce module sunt active și pentru ce plan. Modificările sunt live instant.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['modules', 'flags'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text2)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
              transition: 'all .15s',
            }}
          >
            {t === 'modules' ? '📦 Module' : '🏴 Feature Flags'}
          </button>
        ))}
      </div>

      {/* ── MODULES TAB ─────────────────────────────────────────────────── */}
      {tab === 'modules' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              className="input" placeholder="🔍 Caută modul..."
              value={moduleSearch} onChange={e => setModuleSearch(e.target.value)}
              style={{ maxWidth: 240, height: 36 }}
            />
            {(['all', 'child', 'pregnancy', 'global'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAreaFilter(a)}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  borderColor: areaFilter === a ? (a === 'all' ? 'var(--accent)' : AREA_COLORS[a]) : 'var(--border2)',
                  background: areaFilter === a ? (a === 'all' ? 'var(--accent)' : AREA_COLORS[a] + '18') : 'var(--surface)',
                  color: areaFilter === a ? (a === 'all' ? 'var(--accent)' : AREA_COLORS[a]) : 'var(--text2)',
                }}
              >
                {a === 'all' ? '🗂️ Toate' : AREA_LABELS[a]}
              </button>
            ))}
          </div>

          {/* Info banner */}
          <div style={{
            background: 'rgba(91,170,144,.08)', border: '1px solid rgba(91,170,144,.25)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#5BAA90',
            marginBottom: 16, display: 'flex', gap: 8,
          }}>
            💡 <span><strong>Activ</strong> = modulul există în aplicație. <strong>Plan</strong> = cine îl poate accesa. Dacă un modul e inactiv, nimeni nu îl vede indiferent de plan.</span>
          </div>

          {modulesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div className="spinner" style={{ width: 40, height: 40 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredModules.map(m => {
                const isSaving = savingModule === m.id || savingModule === m.id + '_plan';
                return (
                  <div
                    key={m.id}
                    className="card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                      borderLeft: `3px solid ${m.enabled ? PLAN_COLORS[m.planRequired] : 'var(--border2)'}`,
                      opacity: isSaving ? 0.6 : 1, transition: 'all .2s',
                    }}
                  >
                    {/* Emoji */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: m.enabled ? AREA_COLORS[m.area] + '18' : 'var(--surface2)', fontSize: 20, flexShrink: 0,
                    }}>
                      {m.emoji}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: m.enabled ? 'var(--text)' : 'var(--text3)' }}>{m.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                          background: AREA_COLORS[m.area] + '18', color: AREA_COLORS[m.area],
                        }}>
                          {AREA_LABELS[m.area]}
                        </span>
                        <code style={{ fontSize: 10, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, color: 'var(--text3)' }}>
                          {m.id}
                        </code>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{m.description}</div>
                      {(m.badge || m.deniedTitle || m.deniedMessage) && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {m.badge && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: (m.badgeColor || BADGE_COLOR_PRESETS[0]) + '22',
                              color: m.badgeColor || BADGE_COLOR_PRESETS[0],
                              textTransform: 'uppercase', letterSpacing: 0.4,
                            }}>
                              🏷️ {m.badge}
                            </span>
                          )}
                          {(m.deniedTitle || m.deniedMessage) && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text3)' }}>
                              🔒 mesaj blocare personalizat
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Personalizare (etichetă + mesaj blocare) */}
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '6px 10px', flexShrink: 0 }}
                      onClick={() => openCustomize(m)}
                      disabled={isSaving}
                    >
                      ✏️ Personalizează
                    </button>

                    {/* Plan selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <select
                        className="input"
                        value={m.planRequired}
                        onChange={e => changePlan(m, e.target.value as ModuleConfig['planRequired'])}
                        disabled={!m.enabled || isSaving}
                        style={{
                          width: 'auto', height: 30, fontSize: 12,
                          color: m.enabled ? PLAN_COLORS[m.planRequired] : 'var(--text3)',
                          borderColor: m.enabled ? PLAN_COLORS[m.planRequired] + '50' : 'var(--border2)',
                          opacity: m.enabled ? 1 : 0.5,
                        }}
                      >
                        {Object.entries(PLAN_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>

                    {/* Toggle activ */}
                    <Toggle value={m.enabled} onChange={() => toggleModule(m)} disabled={isSaving} />

                    {isSaving && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── FLAGS TAB ───────────────────────────────────────────────────── */}
      {tab === 'flags' && (
        <>
          <div style={{
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--warning)',
            marginBottom: 16, display: 'flex', gap: 8,
          }}>
            ⚠️ <span>Acestea sunt funcții granulare independente de module. Modificările sunt aplicate imediat.</span>
          </div>

          {flagsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div className="spinner" style={{ width: 40, height: 40 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flags.map(flag => (
                <div
                  key={flag.id}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                    borderLeft: `3px solid ${flag.enabled ? 'var(--success)' : 'var(--border2)'}`,
                    opacity: savingFlag === flag.id ? 0.6 : 1, transition: 'all .2s',
                  }}
                >
                  <Toggle value={flag.enabled} onChange={() => toggleFlag(flag)} disabled={savingFlag === flag.id} />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{flag.name}</span>
                      <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, color: 'var(--text3)', fontFamily: 'monospace' }}>
                        {flag.key}
                      </code>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{flag.description}</div>
                  </div>

                  <select
                    className="input"
                    value={flag.enabledFor}
                    onChange={e => changeFor(flag, e.target.value as FeatureFlag['enabledFor'])}
                    style={{
                      width: 'auto', height: 32, fontSize: 12,
                      color: FOR_COLORS[flag.enabledFor],
                      borderColor: FOR_COLORS[flag.enabledFor] + '40',
                    }}
                  >
                    {Object.entries(FOR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>

                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Utilizatori afectați</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{affectedCount(flag.enabledFor)}</div>
                  </div>

                  {savingFlag === flag.id && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MODAL PERSONALIZARE MODUL ──────────────────────────────────── */}
      {customizing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setCustomizing(null); }}
        >
          <div className="card" style={{ width: 480, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 2 }}>
              {customizing.emoji} Personalizează — {customizing.name}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
              Etichetă vizibilă pe cardul modulului + mesaj afișat când modulul e blocat.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Etichetă */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  🏷️ Etichetă pe card (opțional — ex: „Nou", „Curând", „Indisponibil")
                </label>
                <input
                  className="input"
                  value={customForm.badge}
                  onChange={e => setCustomForm(f => ({ ...f, badge: e.target.value }))}
                  placeholder="ex: Nou"
                  maxLength={20}
                />
                {!!customForm.badge && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {BADGE_COLOR_PRESETS.map(c => (
                      <button
                        key={c}
                        onClick={() => setCustomForm(f => ({ ...f, badgeColor: c }))}
                        style={{
                          width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: customForm.badgeColor === c ? '2px solid var(--text)' : '2px solid transparent',
                          boxShadow: customForm.badgeColor === c ? '0 0 0 2px var(--surface)' : 'none',
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border)' }} />

              {/* Mesaj blocare */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  🔒 Titlu ecran blocat (opțional — dacă e gol, se folosește textul implicit)
                </label>
                <input
                  className="input"
                  value={customForm.deniedTitle}
                  onChange={e => setCustomForm(f => ({ ...f, deniedTitle: e.target.value }))}
                  placeholder="Funcția nu este disponibilă"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  Mesaj ecran blocat
                </label>
                <textarea
                  className="input"
                  value={customForm.deniedMessage}
                  onChange={e => setCustomForm(f => ({ ...f, deniedMessage: e.target.value }))}
                  placeholder="Acest modul nu este disponibil pentru contul tău momentan."
                  style={{ minHeight: 90, resize: 'vertical' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Apare pe ecranul cu 🔒 când utilizatorul nu are acces la modul (plan insuficient sau modul blocat de admin din tab-ul de mai sus).
                </div>
              </div>

              {/* Preview */}
              <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>PREVIZUALIZARE ECRAN BLOCAT</div>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {customForm.deniedTitle || 'Funcția nu este disponibilă'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.4 }}>
                  {customForm.deniedMessage || 'Acest modul nu este disponibil pentru contul tău momentan.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn" onClick={() => setCustomizing(null)} style={{ flex: 1 }}>Anulează</button>
              <button className="btn btn-primary" onClick={saveCustomize} disabled={savingCustom} style={{ flex: 1 }}>
                {savingCustom ? 'Se salvează...' : '💾 Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
