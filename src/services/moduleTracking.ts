import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Mapare rută → nume modul afișat în admin
const ROUTE_MODULE_MAP: Array<[string, string, 'child' | 'pregnancy' | 'general']> = [
  ['/modules/assistant',           'Asistent AI',       'general'],
  ['/modules/community',           'Comunitate',        'general'],
  ['/modules/pregnancy/birth-plan','Plan naștere',      'pregnancy'],
  ['/modules/pregnancy/vaccines',  'Vaccinuri sarcină', 'pregnancy'],
  ['/modules/pregnancy/appointments','Programări',      'pregnancy'],
  ['/modules/pregnancy/symptoms',  'Simptome',          'pregnancy'],
  ['/modules/pregnancy/breathing', 'Respirație',        'pregnancy'],
  ['/modules/pregnancy/ppd',       'Sănătate mentală',  'pregnancy'],
  ['/modules/pregnancy',           'Sarcină',           'pregnancy'],
  ['/modules/growth',              'Creștere',          'child'],
  ['/modules/feeding',             'Alăptare',          'child'],
  ['/modules/sleep',               'Somn',              'child'],
  ['/modules/diapers',             'Scutece',           'child'],
  ['/modules/vaccines',            'Vaccinuri',         'child'],
  ['/modules/milestones',          'Etape dezvoltare',  'child'],
  ['/modules/development-plans',   'Plan dezvoltare',   'child'],
  ['/modules/nutrition',           'Nutriție',          'general'],
  ['/modules/safety',              'Siguranță',         'general'],
  ['/modules/self-care',           'Self-care',         'general'],
  ['/modules/gratitude',           'Recunoștință',      'general'],
  ['/modules/exercises',           'Exerciții',         'general'],
  ['/modules',                     'Module',            'general'],
  ['/(tabs)',                       'Acasă',             'general'],
  ['/profile',                     'Profil',            'general'],
];

interface ModuleMeta { name: string; category: 'child' | 'pregnancy' | 'general' }
interface ModuleStat  { views: number; totalMinutes: number; category: string }

function resolveModule(pathname: string): ModuleMeta | null {
  for (const [prefix, name, category] of ROUTE_MODULE_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return { name, category };
    }
  }
  // Tab-uri principale
  if (pathname === '/' || pathname === '') return { name: 'Acasă', category: 'general' };
  return null;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

class ModuleTrackingService {
  private uid: string | null = null;
  private currentMeta: ModuleMeta | null = null;
  private enterTime: number | null = null;
  private dayKey: string = todayKey();
  private pending: Record<string, ModuleStat> = {};
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  setUser(uid: string | null) {
    if (uid !== this.uid) {
      this.exitCurrent();
      void this.flush();
      this.pending = {};
      this.uid = uid;
    }
    if (uid) this.startInterval();
    else this.stopInterval();
  }

  enter(pathname: string) {
    const meta = resolveModule(pathname);
    if (meta?.name === this.currentMeta?.name) return;
    this.exitCurrent();
    if (!meta) return;
    this.currentMeta = meta;
    this.enterTime = Date.now();
    this.recordView(meta);
    this.scheduleFlush();
    // Zi nouă → flush și resetăm pending
    const today = todayKey();
    if (today !== this.dayKey) {
      void this.flush();
      this.pending = {};
      this.dayKey = today;
    }
  }

  private exitCurrent() {
    if (!this.currentMeta || !this.enterTime) return;
    this.captureActiveTime();
    this.currentMeta = null;
    this.enterTime = null;
    this.scheduleFlush();
  }

  private recordView(meta: ModuleMeta) {
    const existing = this.pending[meta.name];
    if (existing) {
      existing.views += 1;
      return;
    }
    this.pending[meta.name] = { views: 1, totalMinutes: 0, category: meta.category };
  }

  private captureActiveTime() {
    if (!this.currentMeta || !this.enterTime) return;
    const minutes = (Date.now() - this.enterTime) / 60_000;
    if (minutes > 0.1) this.pending[this.currentMeta.name].totalMinutes += minutes;
    this.enterTime = Date.now();
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), 20_000);
  }

  private startInterval() {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => void this.flush(), 2 * 60_000);
  }

  private stopInterval() {
    if (this.intervalTimer) { clearInterval(this.intervalTimer); this.intervalTimer = null; }
  }

  // Apelat la visibilitychange/AppState background — sync entry înainte de flush
  flushNow() {
    this.exitCurrent();
    void this.flush();
  }

  private async flush() {
    if (!this.uid || Object.keys(this.pending).length === 0) return;
    this.captureActiveTime();
    const snapshot = { ...this.pending };
    const totalActiveMinutes = Object.values(snapshot).reduce((s, m) => s + m.totalMinutes, 0);
    try {
      await setDoc(
        doc(db, 'users', this.uid, 'moduleUsage', this.dayKey),
        { modules: snapshot, totalActiveMinutes, updatedAt: Timestamp.now() },
        { merge: true }
      );
    } catch {
      // tracking este non-critic — ignorăm erorile silențios
    }
  }
}

export const moduleTracking = new ModuleTrackingService();
