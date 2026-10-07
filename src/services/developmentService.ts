import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, query,
  orderBy, where, Timestamp, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  DevelopmentInsight, InsightType, Confidence, InsightSignals,
  SensitivePeriod, DevelopmentPlan, CDCMilestone,
} from '../types/development';

// ─── CDC Milestones (built-in, baza locală) ───────────────────────────────────

export const CDC_MILESTONES: Omit<CDCMilestone, 'achieved' | 'achievedDate'>[] = [
  // 2 luni
  { id: 'cdc_2_s1', ageMonths: 2, category: 'social',    text: 'Zâmbește la oameni' },
  { id: 'cdc_2_s2', ageMonths: 2, category: 'social',    text: 'Se calmează când e ținut sau vorbit' },
  { id: 'cdc_2_l1', ageMonths: 2, category: 'language',  text: 'Gungurește, face sunete "ooh" și "aah"' },
  { id: 'cdc_2_m1', ageMonths: 2, category: 'motor',     text: 'Ține capul ridicat câteva secunde pe burtică' },
  { id: 'cdc_2_c1', ageMonths: 2, category: 'cognitive', text: 'Urmărește obiectele cu privirea' },
  // 4 luni
  { id: 'cdc_4_s1', ageMonths: 4, category: 'social',    text: 'Zâmbește spontan, mai ales la persoane cunoscute' },
  { id: 'cdc_4_s2', ageMonths: 4, category: 'social',    text: 'Îi place să se joace cu oamenii' },
  { id: 'cdc_4_l1', ageMonths: 4, category: 'language',  text: 'Gungurește și bolborosește' },
  { id: 'cdc_4_l2', ageMonths: 4, category: 'language',  text: 'Imită sunete pe care le aude' },
  { id: 'cdc_4_m1', ageMonths: 4, category: 'motor',     text: 'Ține capul ferm fără sprijin' },
  { id: 'cdc_4_m2', ageMonths: 4, category: 'motor',     text: 'Împinge în picioare când e ținut în picioare' },
  { id: 'cdc_4_c1', ageMonths: 4, category: 'cognitive', text: 'Răspunde la afecțiune' },
  // 6 luni
  { id: 'cdc_6_s1', ageMonths: 6, category: 'social',    text: 'Cunoaște chipuri familiare și poate plânge la persoane străine' },
  { id: 'cdc_6_l1', ageMonths: 6, category: 'language',  text: 'Răspunde la sunete prin sunete' },
  { id: 'cdc_6_l2', ageMonths: 6, category: 'language',  text: 'Gungurește când este singur sau cu alții' },
  { id: 'cdc_6_m1', ageMonths: 6, category: 'motor',     text: 'Se rostogolește pe ambele părți' },
  { id: 'cdc_6_m2', ageMonths: 6, category: 'motor',     text: 'Stă în șezut cu sprijin' },
  { id: 'cdc_6_m3', ageMonths: 6, category: 'motor',     text: 'Susține greutatea pe picioare' },
  { id: 'cdc_6_c1', ageMonths: 6, category: 'cognitive', text: 'Duce obiecte la gură' },
  { id: 'cdc_6_c2', ageMonths: 6, category: 'cognitive', text: 'Pare curios și încearcă să ajungă la lucruri' },
  // 9 luni
  { id: 'cdc_9_s1', ageMonths: 9, category: 'social',    text: 'Poate fi timid sau anxios în prezența unor persoane noi' },
  { id: 'cdc_9_s2', ageMonths: 9, category: 'social',    text: 'Are jucării preferate' },
  { id: 'cdc_9_l1', ageMonths: 9, category: 'language',  text: 'Înțelege „nu"' },
  { id: 'cdc_9_l2', ageMonths: 9, category: 'language',  text: 'Face sunete cu consoane (mama, baba, tata)' },
  { id: 'cdc_9_m1', ageMonths: 9, category: 'motor',     text: 'Stă în șezut fără sprijin' },
  { id: 'cdc_9_m2', ageMonths: 9, category: 'motor',     text: 'Se ridică în picioare ținându-se' },
  { id: 'cdc_9_c1', ageMonths: 9, category: 'cognitive', text: 'Caută obiectele ascunse' },
  // 12 luni
  { id: 'cdc_12_s1', ageMonths: 12, category: 'social',    text: 'Timid sau anxios la persoane noi' },
  { id: 'cdc_12_l1', ageMonths: 12, category: 'language',  text: 'Spune mama/tata cu înțeles' },
  { id: 'cdc_12_l2', ageMonths: 12, category: 'language',  text: 'Încearcă să imite cuvinte' },
  { id: 'cdc_12_m1', ageMonths: 12, category: 'motor',     text: 'Se ridică singur în picioare' },
  { id: 'cdc_12_m2', ageMonths: 12, category: 'motor',     text: 'Face câțiva pași fără sprijin' },
  { id: 'cdc_12_c1', ageMonths: 12, category: 'cognitive', text: 'Explorează obiecte în moduri diferite' },
  // 15 luni
  { id: 'cdc_15_l1', ageMonths: 15, category: 'language', text: 'Spune câteva cuvinte' },
  { id: 'cdc_15_m1', ageMonths: 15, category: 'motor',    text: 'Merge singur' },
  { id: 'cdc_15_m2', ageMonths: 15, category: 'motor',    text: 'Bea din cană cu puțin ajutor' },
  { id: 'cdc_15_c1', ageMonths: 15, category: 'cognitive','text': 'Arată cu degetul spre lucruri' },
  // 18 luni
  { id: 'cdc_18_l1', ageMonths: 18, category: 'language', text: 'Spune cel puțin 10 cuvinte' },
  { id: 'cdc_18_l2', ageMonths: 18, category: 'language', text: 'Spune și arată ce vrea' },
  { id: 'cdc_18_m1', ageMonths: 18, category: 'motor',    text: 'Merge bine' },
  { id: 'cdc_18_c1', ageMonths: 18, category: 'cognitive','text': 'Știe la ce folosesc obiectele obișnuite' },
  // 24 luni
  { id: 'cdc_24_l1', ageMonths: 24, category: 'language', text: 'Folosește propoziții din 2 cuvinte' },
  { id: 'cdc_24_l2', ageMonths: 24, category: 'language', text: 'Urmează instrucțiuni simple din 2 pași' },
  { id: 'cdc_24_m1', ageMonths: 24, category: 'motor',    text: 'Urcă și coboară scările cu sprijin' },
  { id: 'cdc_24_c1', ageMonths: 24, category: 'cognitive','text': 'Sortează obiecte după culoare și formă' },
  // 36 luni
  { id: 'cdc_36_l1', ageMonths: 36, category: 'language', text: 'Vorbește în propoziții de 2-3 cuvinte' },
  { id: 'cdc_36_s1', ageMonths: 36, category: 'social',   text: 'Se joacă cu alți copii' },
  // 48 luni
  { id: 'cdc_48_l1', ageMonths: 48, category: 'language', text: 'Povestește despre activitățile zilei' },
  { id: 'cdc_48_m1', ageMonths: 48, category: 'motor',    text: 'Merge pe o singură mână' },
  // 60 luni
  { id: 'cdc_60_l1', ageMonths: 60, category: 'language', text: 'Spune numele și adresa' },
  { id: 'cdc_60_m1', ageMonths: 60, category: 'motor',    text: 'Sare, se rostogolește, se cațără' },
];

// ─── Detection Algorithm ──────────────────────────────────────────────────────

interface FeedRecord  { timestamp: any; }
interface SleepRecord { startTime: any; duration?: number; }
interface DiapRecord  { timestamp: any; }

export function detectInsights(params: {
  feeds: FeedRecord[];
  sleeps: SleepRecord[];
  diapers: DiapRecord[];
  recentMilestones: string[];      // milestones achieved in last 7 days
  symptomsPresent: boolean;
  teethingSignal: boolean;
  fussinessLogged: boolean;
}): Omit<DevelopmentInsight, 'id' | 'childId' | 'userId'>[] {
  const { feeds, sleeps, diapers, recentMilestones, symptomsPresent, teethingSignal, fussinessLogged } = params;
  const now = Date.now();
  const DAY = 86400000;

  const insights: Omit<DevelopmentInsight, 'id' | 'childId' | 'userId'>[] = [];

  const toMs = (ts: any): number => {
    if (!ts) return 0;
    if (ts?.toDate) return ts.toDate().getTime();
    if (ts?.toMillis) return ts.toMillis();
    return new Date(ts).getTime();
  };

  // ── Feeding analysis ──
  const feeds48h = feeds.filter(f => now - toMs(f.timestamp) < 2 * DAY).length;
  const feeds7d  = feeds.filter(f => now - toMs(f.timestamp) < 7 * DAY).length;
  const feedAvgPer2d = feeds7d > 0 ? (feeds7d / 7) * 2 : 0;
  const feedIncreasePercent = feedAvgPer2d > 0
    ? Math.round(((feeds48h - feedAvgPer2d) / feedAvgPer2d) * 100)
    : 0;

  // ── Sleep analysis ──
  const getMs = (s: SleepRecord) => toMs(s.startTime);
  const sleeps3nights = sleeps.filter(s => now - getMs(s) < 3 * DAY);
  const sleeps7d      = sleeps.filter(s => now - getMs(s) < 7 * DAY);

  const totalSleep3d = sleeps3nights.reduce((a, s) => a + (s.duration || 0), 0);
  const totalSleep7d = sleeps7d.reduce((a, s) => a + (s.duration || 0), 0);

  const avgSleepPer3d = sleeps7d.length > 0 ? (totalSleep7d / 7) * 3 : 0;
  const sleepChangeMins = avgSleepPer3d > 0
    ? Math.round((totalSleep3d - avgSleepPer3d) / 60)
    : 0;

  const diapers24h = diapers.filter(d => now - toMs(d.timestamp) < DAY).length;
  const diaperCountNormal = diapers24h >= 4;

  // ── Growth spurt detection ──
  if (feedIncreasePercent >= 25 && !symptomsPresent) {
    const confidence: Confidence = feedIncreasePercent >= 50 ? 'high' : feedIncreasePercent >= 35 ? 'medium' : 'low';
    insights.push({
      type: 'possible_growth_spurt',
      confidence,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(now + 3 * DAY).toISOString(),
      signals: { feedingIncreasePercent: feedIncreasePercent, diaperCountNormal, symptomsPresent },
      title: 'Posibil puseu de creștere',
      message: `Copilul a mâncat cu aproximativ ${feedIncreasePercent}% mai des decât media ultimelor 7 zile.${diaperCountNormal ? ' Scutecele sunt în număr normal — semn bun.' : ''}`,
      suggestions: [
        'Hrănește la cerere, fără a limita mesele',
        'Urmărește numărul de scutece ude — minim 4-6/zi',
        'Odihna ta contează, cere ajutor când poți',
        'Notează evoluția 2-3 zile',
      ],
      safetyNote: 'Contactează medicul dacă apar febră, letargie, refuz alimentar total sau semne de deshidratare.',
    });
  }

  // ── Sleep adjustment detection ──
  if (sleepChangeMins <= -60 && sleeps3nights.length >= 2) {
    const confidence: Confidence = sleepChangeMins <= -90 ? 'high' : 'medium';
    const hasNewMilestone = recentMilestones.length > 0;
    insights.push({
      type: 'sleep_adjustment',
      confidence,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(now + 3 * DAY).toISOString(),
      signals: {
        sleepChangeMins,
        newMilestone: recentMilestones[0],
        symptomsPresent,
        teethingSignal,
        fussinessLogged,
      },
      title: 'Somnul s-a schimbat',
      message: `Somnul total a scăzut cu aproximativ ${Math.abs(sleepChangeMins)} minute față de media ultimelor zile.${hasNewMilestone ? ` Ai notat și o achiziție nouă: ${recentMilestones[0]}.` : ''}`,
      suggestions: [
        'Păstrează rutina de seară cât mai constantă',
        'Evită suprastimularea în ultimele 30-60 min înainte de culcare',
        'Răspunde calm la treziri, fără agitație',
        'Urmărește evoluția 3-5 zile',
      ],
      safetyNote: 'Consultă medicul dacă apar febră, dureri sau refuz alimentar.',
    });
  }

  // ── New milestone detection ──
  if (recentMilestones.length > 0) {
    insights.push({
      type: 'new_milestone',
      confidence: 'high',
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(now + 7 * DAY).toISOString(),
      signals: { newMilestone: recentMilestones[0] },
      title: 'Achiziție nouă observată',
      message: `Copilul a atins o nouă etapă: "${recentMilestones[0]}". Aceasta poate modifica temporar somnul sau dispoziția.`,
      suggestions: [
        'Oferă oportunități de exersare în condiții sigure',
        'Tummy time scurt, supravegheat, de mai multe ori pe zi',
        'Laudă efortul, nu doar reușita',
        'Notează data pentru istoricul de dezvoltare',
      ],
    });
  }

  // ── Teething detection ──
  if (teethingSignal && fussinessLogged) {
    insights.push({
      type: 'teething',
      confidence: 'medium',
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(now + 3 * DAY).toISOString(),
      signals: { teethingSignal, fussinessLogged },
      title: 'Posibilă dentiție activă',
      message: 'Combinația dintre agitație și semnale de dentiție poate indica un dinte în curs de apariție.',
      suggestions: [
        'Oferă inele de dentiție reci (nu înghețate)',
        'Masajul gingiei cu un deget curat poate calma',
        'Paracetamol/ibuprofen conform recomandării medicului dacă copilul e foarte inconfortabil',
        'Verifică harta dințișorilor pentru a urmări progresul',
      ],
      safetyNote: 'Febra peste 38°C nu este cauzată de dentiție — consultă medicul.',
    });
  }

  return insights;
}

// ─── Firestore Service ─────────────────────────────────────────────────────────

export const developmentService = {
  // ── Insights ──
  async saveInsight(userId: string, childId: string, insight: Omit<DevelopmentInsight, 'id'>): Promise<string> {
    const ref = await addDoc(
      collection(db, 'users', userId, 'children', childId, 'development_insights'),
      insight,
    );
    return ref.id;
  },

  async getInsights(userId: string, childId: string): Promise<DevelopmentInsight[]> {
    const q = query(
      collection(db, 'users', userId, 'children', childId, 'development_insights'),
      orderBy('generatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DevelopmentInsight));
  },

  async deleteInsight(userId: string, childId: string, insightId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'children', childId, 'development_insights', insightId));
  },

  // ── Child Milestones ──
  async getChildMilestones(userId: string, childId: string): Promise<{ id: string; achievedDate?: string }[]> {
    const snap = await getDocs(collection(db, 'users', userId, 'children', childId, 'cdc_milestones'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async markMilestone(userId: string, childId: string, milestoneId: string, achieved: boolean, date?: string): Promise<void> {
    const ref = doc(db, 'users', userId, 'children', childId, 'cdc_milestones', milestoneId);
    if (achieved) {
      await setDoc(ref, { achieved: true, achievedDate: date ?? new Date().toISOString().split('T')[0] }, { merge: true });
    } else {
      await deleteDoc(ref);
    }
  },

  // ── Sensitive Periods (admin-managed) ──
  async getSensitivePeriods(): Promise<SensitivePeriod[]> {
    const q = query(collection(db, 'sensitive_periods'), where('isActive', '==', true), orderBy('ageFromWeeks'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SensitivePeriod));
  },

  async saveSensitivePeriod(period: Omit<SensitivePeriod, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'sensitive_periods'), { ...period, updatedAt: new Date().toISOString() });
    return ref.id;
  },

  async updateSensitivePeriod(id: string, data: Partial<SensitivePeriod>): Promise<void> {
    await updateDoc(doc(db, 'sensitive_periods', id), { ...data, updatedAt: new Date().toISOString() });
  },

  async deleteSensitivePeriod(id: string): Promise<void> {
    await deleteDoc(doc(db, 'sensitive_periods', id));
  },

  // ── Development Plans (admin) ──
  async getPlans(): Promise<DevelopmentPlan[]> {
    const q = query(collection(db, 'development_plans'), orderBy('order'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DevelopmentPlan));
  },

  async savePlan(plan: Omit<DevelopmentPlan, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'development_plans'), plan);
    return ref.id;
  },

  async updatePlan(id: string, data: Partial<DevelopmentPlan>): Promise<void> {
    await updateDoc(doc(db, 'development_plans', id), { ...data, updatedAt: new Date().toISOString() });
  },

  async deletePlan(id: string): Promise<void> {
    await deleteDoc(doc(db, 'development_plans', id));
  },
};
