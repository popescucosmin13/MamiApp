import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';

type PlanKey = 'basic' | 'premium';
type FeatureScope = 'all' | 'admin' | 'beta' | 'premium' | 'none';

interface PlanConfig {
  modules?: Record<string, boolean>;
  features?: Record<string, boolean>;
}

interface ModuleConfig {
  enabled?: boolean;
  name?: string;
  area?: 'child' | 'pregnancy' | 'global' | string;
  description?: string;
  defaultPlans?: PlanKey[];
  planRequired?: PlanKey | 'none' | string;
  badge?: string;
  badgeColor?: string;
  deniedTitle?: string;
  deniedMessage?: string;
}

interface FeatureFlagConfig {
  key: string;
  enabled: boolean;
  enabledFor: FeatureScope;
  id?: string;
}

const DEFAULT_FEATURE_FLAGS: Record<string, FeatureFlagConfig> = {
  enableCommunity: { key: 'enableCommunity', enabled: true, enabledFor: 'all' },
  enableAiAssistant: { key: 'enableAiAssistant', enabled: true, enabledFor: 'all' },
  enablePregnancyModule: { key: 'enablePregnancyModule', enabled: true, enabledFor: 'all' },
  enablePremiumPlans: { key: 'enablePremiumPlans', enabled: true, enabledFor: 'all' },
  enableDocumentOCR: { key: 'enableDocumentOCR', enabled: false, enabledFor: 'premium' },
  enableFamilySharing: { key: 'enableFamilySharing', enabled: true, enabledFor: 'premium' },
  enableSleepAI: { key: 'enableSleepAI', enabled: true, enabledFor: 'premium' },
  enableDiversificationAI: { key: 'enableDiversificationAI', enabled: true, enabledFor: 'premium' },
  enableMaintenanceMode: { key: 'enableMaintenanceMode', enabled: false, enabledFor: 'none' },
  enableBetaFeatures: { key: 'enableBetaFeatures', enabled: false, enabledFor: 'admin' },
  enableSchoolModule: { key: 'enableSchoolModule', enabled: false, enabledFor: 'none' },
  enableAdvancedAnalytics: { key: 'enableAdvancedAnalytics', enabled: true, enabledFor: 'premium' },
};

const ROUTE_MODULE_KEYS: { prefix: string; moduleId: string }[] = [
  { prefix: '/modules/family', moduleId: 'family' },
  { prefix: '/modules/school', moduleId: 'school' },
  { prefix: '/modules/documents', moduleId: 'documents' },
  { prefix: '/modules/community', moduleId: 'community' },
  { prefix: '/modules/pregnancy', moduleId: 'pregnancy' },
  { prefix: '/modules/appointments', moduleId: 'pregnancy' },
  { prefix: '/modules/nutrition', moduleId: 'pregnancy' },
  { prefix: '/modules/birth', moduleId: 'pregnancy' },
  { prefix: '/modules/settings/add-pregnancy', moduleId: 'pregnancy' },
  { prefix: '/modules/articles', moduleId: 'articles' },
];

const ROUTE_FEATURE_KEYS: { prefix: string; featureId: string }[] = [
  { prefix: '/modules/sleep-coach', featureId: 'sleepAI' },
  { prefix: '/modules/food/weekly-menu', featureId: 'diversificationAI' },
  { prefix: '/modules/food/shopping-list', featureId: 'diversificationAI' },
  { prefix: '/modules/growth', featureId: 'advancedAnalytics' },
  { prefix: '/modules/settings/subscription', featureId: 'premiumPlans' },
  { prefix: '/manage-subscription', featureId: 'premiumPlans' },
];

const MODULE_FLAG_KEYS: Record<string, string> = {
  assistant: 'enableAiAssistant',
  community: 'enableCommunity',
  pregnancy: 'enablePregnancyModule',
  birth: 'enablePregnancyModule',
  appointments: 'enablePregnancyModule',
  nutrition: 'enablePregnancyModule',
  family: 'enableFamilySharing',
  school: 'enableSchoolModule',
  'sleep-coach': 'enableSleepAI',
  growth: 'enableAdvancedAnalytics',
};

const FEATURE_FLAG_KEYS: Record<string, string> = {
  aiInsights: 'enableAiAssistant',
  premiumPlans: 'enablePremiumPlans',
  sleepAI: 'enableSleepAI',
  diversificationAI: 'enableDiversificationAI',
  advancedAnalytics: 'enableAdvancedAnalytics',
  documentOCR: 'enableDocumentOCR',
  betaFeatures: 'enableBetaFeatures',
  maintenanceMode: 'enableMaintenanceMode',
};

type AccessConfig = {
  plans: Record<string, PlanConfig>;
  modules: Record<string, ModuleConfig>;
  featureFlags: Record<string, FeatureFlagConfig>;
};

let isListenerSetup = false;
let activeUnsubscribers: Array<() => void> = [];
let globalPlans: Record<string, PlanConfig> = {};
let globalModules: Record<string, ModuleConfig> = {};
let globalFeatureFlags: Record<string, FeatureFlagConfig> = { ...DEFAULT_FEATURE_FLAGS };
let globalIsLoading = true;
const listeners: (() => void)[] = [];

function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notify() {
  listeners.forEach(fn => fn());
}

function teardownListeners() {
  activeUnsubscribers.forEach(fn => { try { fn(); } catch {} });
  activeUnsubscribers = [];
  isListenerSetup = false;
}

function setupAccessListeners() {
  if (isListenerSetup) return;
  isListenerSetup = true;
  globalIsLoading = true;

  // Timeout de siguranță: dacă moduleCatalog nu răspunde rapid, deblocăm imediat
  const safetyTimer = setTimeout(() => {
    if (globalIsLoading) {
      globalIsLoading = false;
      notify();
    }
  }, 1500);

  const unsubPlans = onSnapshot(collection(db, 'planConfigs'), (snap) => {
    globalPlans = Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as PlanConfig]));
    notify();
  }, () => { /* ignorăm erori planConfigs */ });

  const unsubModules = onSnapshot(
    collection(db, 'moduleCatalog'),
    (snap) => {
      clearTimeout(safetyTimer);
      globalModules = Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as ModuleConfig]));
      globalIsLoading = false;
      notify();
    },
    (_err) => {
      // Eroare Firestore (permisiuni / offline) — oprim toți listenerii și permitem
      // re-setup după autentificare (isListenerSetup va fi false după teardown)
      clearTimeout(safetyTimer);
      globalIsLoading = false;
      teardownListeners();
      notify();
    }
  );

  const unsubFlags = onSnapshot(collection(db, 'featureFlags'), (snap) => {
    const normalizedFlags: Record<string, FeatureFlagConfig> = { ...DEFAULT_FEATURE_FLAGS };
    snap.docs.forEach((d) => {
      const data = d.data() as FeatureFlagConfig;
      const key = data.key || d.id;
      normalizedFlags[key] = { ...data, id: d.id, key };
    });
    globalFeatureFlags = normalizedFlags;
    notify();
  });

  const unsubAppConfig = onSnapshot(doc(db, 'appConfig', 'global'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      globalFeatureFlags['enableMaintenanceMode'] = {
        key: 'enableMaintenanceMode',
        enabled: false, // Forțat oprit (era data.maintenanceMode === true)
        enabledFor: 'none',
      };
      notify();
    }
  });

  activeUnsubscribers = [
    () => { clearTimeout(safetyTimer); unsubPlans(); },
    unsubModules,
    unsubFlags,
    unsubAppConfig,
  ];
}

export function useAccessControl() {
  const { profile, isPremium } = useAuthStore();
  const userId = useAuthStore(state => state.user?.uid ?? null);
  const [plans, setPlans] = useState(globalPlans);
  const [modules, setModules] = useState(globalModules);
  const [featureFlags, setFeatureFlags] = useState(globalFeatureFlags);
  const [isLoadingAccess, setIsLoadingAccess] = useState(globalIsLoading);

  useEffect(() => {
    if (userId) {
      // Utilizator autentificat — pornim/repornim listenerii Firestore
      setupAccessListeners();
    } else {
      // Utilizator delogat — oprim listenerii și resetăm starea globală
      teardownListeners();
      globalModules = {};
      globalPlans = {};
      globalFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
      globalIsLoading = true;
    }

    // Sincronizează starea curentă IMEDIAT la mounting sau la schimbarea user-ului
    setPlans({ ...globalPlans });
    setModules({ ...globalModules });
    setFeatureFlags({ ...globalFeatureFlags });
    setIsLoadingAccess(globalIsLoading);

    // Subscrie pentru actualizări viitoare
    const unsub = subscribe(() => {
      setPlans({ ...globalPlans });
      setModules({ ...globalModules });
      setFeatureFlags({ ...globalFeatureFlags });
      setIsLoadingAccess(globalIsLoading);
    });

    return unsub;
  }, [userId]);

  return useMemo(() => {
    const plan: PlanKey = isPremium || profile?.subscription?.plan === 'premium' ? 'premium' : 'basic';
    const isBeta = Boolean((profile as any)?.isBetaTester || (profile as any)?.betaTester);

    const getFlagAccess = (flagKey?: string): 'grant' | 'deny' | 'neutral' => {
      if (!flagKey) return 'neutral';
      const flag = featureFlags[flagKey];
      if (!flag) return 'neutral';
      if (!flag.enabled || flag.enabledFor === 'none') return 'deny';
      if (flag.enabledFor === 'all') return 'grant';
      if (flag.enabledFor === 'premium') return plan === 'premium' ? 'grant' : 'deny';
      if (flag.enabledFor === 'beta') return isBeta || plan === 'premium' ? 'grant' : 'deny';
      if (flag.enabledFor === 'admin') return 'deny';
      return 'neutral';
    };

    const canUseModule = (moduleId: string) => {
      const moduleConfig = modules[moduleId];

      // ─── SURSA UNICĂ DE ADEVĂR: Admin Panel (moduleCatalog în Firestore) ───
      //
      // Ordinea de prioritate:
      // 1. enabled: false → nimeni nu poate accesa (admin a dezactivat explicit)
      // 2. moduleOverrides per user → grant/revoke individual de admin
      // 3. planRequired din moduleCatalog → controlul planului setat din admin panel
      // 4. Default: acces permis (oricine poate accesa dacă admin nu a restricționat)
      //
      // Feature flags NU mai controlează accesul la module — sunt doar pentru
      // funcții granulare independente (OCR, menținenanță, beta) gestionate
      // din tab-ul "Feature Flags" din admin panel.

      // 1. Admin a dezactivat complet modulul
      if (moduleConfig?.enabled === false) return false;

      // 2. Override individual per utilizator (setat de admin din panoul Users)
      const override = profile?.moduleOverrides?.[moduleId];
      if (typeof override === 'boolean') return override;

      // 3. planRequired setat explicit din admin panel
      if (moduleConfig?.planRequired === 'none') return false;
      if (moduleConfig?.planRequired === 'premium') return plan === 'premium';
      if (moduleConfig?.planRequired === 'basic') return true;

      // 4. Modul nu e în catalog sau planRequired nu e setat → acces liber implicit
      //    (admin panel va seta 'basic' la prima deschidere, dar până atunci nu blocăm)
      return true;
    };

    const canUseFeature = (featureId: string) => {
      const flagAccess = getFlagAccess(FEATURE_FLAG_KEYS[featureId] || featureId);
      if (flagAccess === 'deny') return false;
      if (flagAccess === 'grant') return true;

      const planFeatures = plans[plan]?.features;
      if (planFeatures && featureId in planFeatures) return planFeatures[featureId] === true;

      if (featureId === 'maintenanceMode') return false;
      return plan === 'premium';
    };

    const canUseRoutePath = (path: string) => {
      const normalizedPath = path.split('?')[0];
      const moduleMatch = ROUTE_MODULE_KEYS.find((item) => normalizedPath.startsWith(item.prefix));
      if (moduleMatch && !canUseModule(moduleMatch.moduleId)) return false;

      const featureMatch = ROUTE_FEATURE_KEYS.find((item) => normalizedPath.startsWith(item.prefix));
      if (featureMatch && !canUseFeature(featureMatch.featureId)) return false;

      return true;
    };

    return { plan, canUseModule, canUseFeature, canUseRoutePath, isLoadingAccess, modules };
  }, [featureFlags, isPremium, modules, plans, profile, profile?.moduleOverrides, profile?.subscription?.plan, isLoadingAccess]);
}
