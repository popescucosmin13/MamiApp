/**
 * Sleep Guidelines Engine
 * Sources:
 *   - AASM 2016 (total sleep recommendations per age)
 *   - CDC / AAP HealthyChildren.org (nap counts, bedtime routines)
 *   - Cleveland Clinic (wake window definition & ranges)
 *   - Mayo Clinic (nap transitions 12–18 months)
 *   - AAP Safe Sleep guidelines for infants
 */

import type {
  SleepGuideline,
  NextSleepRecommendation,
  SleepRecommendationStatus,
  ChildSleepProfile,
} from '../types/sleep';

// ─── Official guideline table (AASM/CDC + practical wake windows) ─────────────
export const SLEEP_GUIDELINES: SleepGuideline[] = [
  {
    id: '0_3_months',
    minAgeDays: 0,
    maxAgeDays: 119,
    totalSleepMinHours: 14,
    totalSleepMaxHours: 17,
    napsMin: undefined,
    napsMax: undefined,
    wakeWindowMinMinutes: 30,
    wakeWindowMaxMinutes: 90,
    sourceType: 'official',
    sourceName: 'AASM 2016 + Cleveland Clinic',
    note: 'Somnul este extrem de variabil în primele 3 luni. Nu există un program fix.',
  },
  {
    id: '4_6_months',
    minAgeDays: 120,
    maxAgeDays: 209,
    totalSleepMinHours: 12,
    totalSleepMaxHours: 16,
    napsMin: 3,
    napsMax: 4,
    wakeWindowMinMinutes: 120,
    wakeWindowMaxMinutes: 180,
    sourceType: 'official',
    sourceName: 'AASM 2016 + Cleveland Clinic + Mayo Clinic',
    note: 'Ritm circadian începe să se consolideze. 3–4 somnuri de zi obișnuite.',
  },
  {
    id: '6_9_months',
    minAgeDays: 210,
    maxAgeDays: 299,
    totalSleepMinHours: 12,
    totalSleepMaxHours: 16,
    napsMin: 2,
    napsMax: 3,
    wakeWindowMinMinutes: 150,
    wakeWindowMaxMinutes: 240,
    sourceType: 'official',
    sourceName: 'AASM 2016 + Cleveland Clinic',
    note: 'Mulți copii au 2–3 somnuri de zi. Somnul de noapte se consolidează.',
  },
  {
    id: '9_12_months',
    minAgeDays: 300,
    maxAgeDays: 364,
    totalSleepMinHours: 12,
    totalSleepMaxHours: 16,
    napsMin: 2,
    napsMax: 2,
    wakeWindowMinMinutes: 180,
    wakeWindowMaxMinutes: 300,
    sourceType: 'official',
    sourceName: 'AASM 2016 + Mayo Clinic',
    note: 'De obicei 2 somnuri de zi. Unii copii încep tranziția la un somn.',
  },
  {
    id: '12_18_months',
    minAgeDays: 365,
    maxAgeDays: 545,
    totalSleepMinHours: 11,
    totalSleepMaxHours: 14,
    napsMin: 1,
    napsMax: 2,
    wakeWindowMinMinutes: 240,
    wakeWindowMaxMinutes: 360,
    sourceType: 'official',
    sourceName: 'AASM 2016 + Mayo Clinic + AAP HealthyChildren',
    note: 'Tranziție de la 2 la 1 somn de zi. Variabilitate mare individuală.',
  },
  {
    id: '18_36_months',
    minAgeDays: 546,
    maxAgeDays: 1095,
    totalSleepMinHours: 11,
    totalSleepMaxHours: 14,
    napsMin: 1,
    napsMax: 1,
    wakeWindowMinMinutes: 300,
    wakeWindowMaxMinutes: 420,
    sourceType: 'official',
    sourceName: 'AASM 2016 + AAP HealthyChildren',
    note: 'De obicei un singur somn de zi. Somnul nocturn dominant.',
  },
  {
    id: '3_5_years',
    minAgeDays: 1096,
    maxAgeDays: 1825,
    totalSleepMinHours: 10,
    totalSleepMaxHours: 13,
    napsMin: 0,
    napsMax: 1,
    wakeWindowMinMinutes: undefined,
    wakeWindowMaxMinutes: undefined,
    sourceType: 'official',
    sourceName: 'AASM 2016 + CDC',
    note: 'Mulți copii renunță la somnul de zi. Somnul nocturn este prioritar.',
  },
];

// ─── Red flags ────────────────────────────────────────────────────────────────
export const RED_FLAG_LABELS: Record<string, string> = {
  fever:                'Febră',
  lethargy:            'Letargie',
  breathing_difficulty:'Dificultăți respiratorii',
  refusing_feeds:      'Refuză alimentația',
  dehydration_signs:   'Semne de deshidratare',
  inconsolable_crying: 'Plâns inconsolabil',
  unusual_sleepiness:  'Somnolență neobișnuită',
};

// ─── Sleep signal labels ──────────────────────────────────────────────────────
export const SLEEP_SIGNAL_LABELS: Record<string, string> = {
  yawning:      '🥱 Căscat',
  rubbing_eyes: '👁️ Freacă ochii',
  fussy:        '😟 Agitat',
  clingy:       '🤗 Lipitor',
  staring:      '👀 Privit în gol',
  crying:       '😢 Plâns',
  hyperactive:  '⚡ Hiperstimulat',
};

// ─── Pre-defined message library (no AI) ─────────────────────────────────────
export const SLEEP_MESSAGES: Record<SleepRecommendationStatus, {
  title: string; message: string; suggestions: string[];
}> = {
  too_early: {
    title: 'Încă pare devreme pentru somn',
    message: 'Copilul este treaz de mai puțin timp decât intervalul orientativ pentru vârsta lui.',
    suggestions: [
      'Continuă cu joacă liniștită.',
      'Urmărește semnele de oboseală.',
      'Evită stimularea excesivă.',
    ],
  },
  getting_ready: {
    title: 'Se apropie următorul somn',
    message: 'Se apropie fereastra obișnuită pentru următorul somn. Pregătește mediul.',
    suggestions: [
      'Începe rutina de somn (cântec, baie, poveste).',
      'Redu lumina și zgomotul din cameră.',
      'Evită joaca activă sau ecranele.',
    ],
  },
  recommended_now: {
    title: 'Acum este o fereastră bună pentru somn',
    message: 'Copilul este în intervalul orientativ de veghe pentru vârsta lui.',
    suggestions: [
      'Încearcă să îl așezi la somn acum.',
      'Păstrează rutina scurtă și calmă.',
      'Răspunde la semnele de oboseală.',
    ],
  },
  possibly_overtired: {
    title: 'Posibilă oboseală acumulată',
    message: 'Copilul a depășit intervalul orientativ de veghe pentru vârsta lui.',
    suggestions: [
      'Încearcă o rutină foarte calmă și scurtă.',
      'Redu stimularea suplimentară.',
      'Dacă este aproape de seară, ajustează ora de culcare.',
    ],
  },
  adjust_bedtime: {
    title: 'Ajustează ora de culcare',
    message: 'Somnul de azi sugerează o ajustare a orei de culcare de seară.',
    suggestions: [
      'Culcare mai devreme cu 15–30 minute față de obicei.',
      'Evită somnul de zi târziu.',
    ],
  },
  no_recommendation: {
    title: 'Recomandare indisponibilă',
    message: 'Nu există suficiente date sau există simptome care influențează somnul.',
    suggestions: [
      'Urmărește starea generală a copilului.',
      'Contactează medicul dacă simptomele persistă.',
    ],
  },
};

// ─── AAP Safe Sleep guidelines ────────────────────────────────────────────────
export const SAFE_SLEEP_RULES = [
  'Culcat pe spate pentru fiecare somn',
  'Suprafață fermă și plată (nu canapea, fotoliu, pernă de alăptare)',
  'Fără perne, pături, jucării moi sau bumpere în spațiul de somn',
  'Temperatura camerei confortabilă (18–21°C recomandat)',
  'Evită supraîncălzirea (verifică ceafa copilului)',
  'Nu fumați în preajma copilului sau în locuință',
];

export const SAFE_SLEEP_NOTE =
  'AAP recomandă somn sigur pentru reducerea riscurilor SUID. ' +
  'Copilul trebuie culcat pe spate, pe o suprafață fermă și plată, ' +
  'fără obiecte moi în spațiul de somn.';

// ─── Get guideline for age ────────────────────────────────────────────────────
export function getGuidelineForAge(ageDays: number): SleepGuideline | null {
  return SLEEP_GUIDELINES.find(g => ageDays >= g.minAgeDays && ageDays <= g.maxAgeDays) ?? null;
}

// ─── Format wake window nicely ────────────────────────────────────────────────
export function formatWakeWindow(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Format time from ISO string ────────────────────────────────────────────
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// ─── Calculate total sleep in last N hours ───────────────────────────────────
export function calcTotalSleepMinutes(sleepLogs: Array<{ durationMinutes?: number; startTime: string }>, lastHours = 24): number {
  const cutoff = Date.now() - lastHours * 60 * 60 * 1000;
  return sleepLogs
    .filter(s => new Date(s.startTime).getTime() >= cutoff && s.durationMinutes != null)
    .reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
}

// ─── Build personal profile from sleep history ───────────────────────────────
export function buildSleepProfile(
  childId: string,
  logs: Array<{ sleepType: string; startTime: string; durationMinutes?: number; endTime?: string }>,
): import('../types/sleep').ChildSleepProfile {
  const now = new Date().toISOString();
  const days = new Set(logs.map(l => l.startTime.slice(0, 10))).size;
  const confidence: 'low' | 'medium' | 'high' =
    days < 7 ? 'low' : days < 14 ? 'medium' : 'high';

  // Average total sleep per 24h over last 7 days
  const last7 = logs.filter(l => {
    const d = Date.now() - new Date(l.startTime).getTime();
    return d < 7 * 24 * 60 * 60 * 1000;
  });
  const totalMins7 = last7.reduce((a, l) => a + (l.durationMinutes ?? 0), 0);
  const avgTotalSleep = last7.length > 0 ? Math.round(totalMins7 / Math.max(days, 1)) : undefined;

  const nights = last7.filter(l => l.sleepType === 'night');
  const avgNight = nights.length > 0
    ? Math.round(nights.reduce((a, l) => a + (l.durationMinutes ?? 0), 0) / nights.length)
    : undefined;
  const naps = last7.filter(l => l.sleepType === 'nap');
  const avgDay = naps.length > 0
    ? Math.round(naps.reduce((a, l) => a + (l.durationMinutes ?? 0), 0) / naps.length)
    : undefined;

  return {
    childId,
    averageTotalSleep24h: avgTotalSleep,
    averageNightSleep: avgNight,
    averageDaySleep: avgDay,
    daysOfData: days,
    confidence,
    updatedAt: now,
  };
}

// ─── Main recommendation engine ───────────────────────────────────────────────
export function calculateNextSleep(input: {
  childAgeDays: number;
  lastWakeTime: Date;
  now: Date;
  totalSleepLast24hMinutes: number;
  napsToday: number;
  lastNapDurationMinutes?: number;
  sleepSignalsCount?: number;
  hasRedFlags?: boolean;
  guideline: SleepGuideline;
  profile?: import('../types/sleep').ChildSleepProfile | null;
}): NextSleepRecommendation {
  const currentWakeWindowMinutes = Math.floor(
    (input.now.getTime() - input.lastWakeTime.getTime()) / 60000
  );

  const safetyNote = input.childAgeDays < 365
    ? SAFE_SLEEP_NOTE
    : 'Recomandarea este orientativă și nu înlocuiește sfatul medicului pediatru.';

  // Red flags → stop normal recommendation
  if (input.hasRedFlags) {
    const msgs = SLEEP_MESSAGES.no_recommendation;
    return {
      recommendedStart: '', recommendedEnd: '',
      currentWakeWindowMinutes,
      targetWakeWindowMinMinutes: input.guideline.wakeWindowMinMinutes ?? 0,
      targetWakeWindowMaxMinutes: input.guideline.wakeWindowMaxMinutes ?? 0,
      status: 'no_recommendation',
      title: 'Somnul poate fi influențat de simptome',
      message: 'Ai notat simptome care pot influența somnul. Contactează medicul dacă persistă.',
      suggestions: msgs.suggestions,
      safetyNote,
    };
  }

  const minWake = input.guideline.wakeWindowMinMinutes;
  const maxWake = input.guideline.wakeWindowMaxMinutes;

  // No wake window defined (3–5 years) → general guidance
  if (!minWake || !maxWake) {
    return {
      recommendedStart: '', recommendedEnd: '',
      currentWakeWindowMinutes,
      targetWakeWindowMinMinutes: 0,
      targetWakeWindowMaxMinutes: 0,
      status: 'no_recommendation',
      title: 'Urmărește totalul de somn pe 24h',
      message: `Recomandare: ${input.guideline.totalSleepMinHours}–${input.guideline.totalSleepMaxHours}h somn per zi.`,
      suggestions: [
        'Păstrează o rutină constantă de culcare.',
        'Evită ecranele cu 60 minute înainte de somn (AAP).',
        `Totalul recomandat: ${input.guideline.totalSleepMinHours}–${input.guideline.totalSleepMaxHours}h/zi.`,
      ],
      safetyNote,
    };
  }

  // Personalize based on child's own history (weighted blend)
  let targetMin = minWake;
  let targetMax = maxWake;

  const profile = input.profile;
  if (profile && profile.daysOfData >= 7 && profile.averageWakeWindowBeforeNap1) {
    const weight = profile.daysOfData >= 14 ? 0.5 : 0.3;
    const personalWW = profile.averageWakeWindowBeforeNap1;
    targetMin = Math.round(minWake * (1 - weight) + (personalWW - 20) * weight);
    targetMax = Math.round(maxWake * (1 - weight) + (personalWW + 20) * weight);
    // Clamp to guideline bounds
    targetMin = Math.max(minWake * 0.8, Math.min(targetMin, maxWake));
    targetMax = Math.max(targetMin + 30, Math.min(targetMax, maxWake * 1.2));
  }

  const recommendedStart = new Date(input.lastWakeTime.getTime() + targetMin * 60000);
  const recommendedEnd   = new Date(input.lastWakeTime.getTime() + targetMax * 60000);

  // Classify status
  let status: SleepRecommendationStatus;
  if (currentWakeWindowMinutes < targetMin - 20) {
    status = 'too_early';
  } else if (currentWakeWindowMinutes < targetMin) {
    status = 'getting_ready';
  } else if (currentWakeWindowMinutes <= targetMax) {
    status = 'recommended_now';
  } else {
    // Check if close to bedtime
    const hourNow = input.now.getHours();
    status = hourNow >= 17 ? 'adjust_bedtime' : 'possibly_overtired';
  }

  const msgs = SLEEP_MESSAGES[status];

  // Boost suggestions if sleep signals present
  const suggestions = [...msgs.suggestions];
  if ((input.sleepSignalsCount ?? 0) >= 2) {
    suggestions.unshift('🔴 Semnele de oboseală sunt prezente — acționează acum.');
  }
  if (input.totalSleepLast24hMinutes < input.guideline.totalSleepMinHours * 60 * 0.85) {
    suggestions.push('⚠️ Totalul de somn pe 24h este sub intervalul recomandat.');
  }

  return {
    recommendedStart: recommendedStart.toISOString(),
    recommendedEnd:   recommendedEnd.toISOString(),
    currentWakeWindowMinutes,
    targetWakeWindowMinMinutes: targetMin,
    targetWakeWindowMaxMinutes: targetMax,
    status,
    title: msgs.title,
    message: msgs.message,
    suggestions,
    safetyNote,
  };
}

// ─── Total sleep status vs guideline ─────────────────────────────────────────
export type SleepTotalStatus = 'below' | 'ok' | 'above';

export function getSleepTotalStatus(
  totalMinutes: number,
  guideline: SleepGuideline,
): { status: SleepTotalStatus; message: string } {
  const minMin = guideline.totalSleepMinHours * 60;
  const maxMin = guideline.totalSleepMaxHours * 60;

  if (totalMinutes < minMin * 0.88) {
    return {
      status: 'below',
      message: `Somnul din ultimele 24h (${Math.round(totalMinutes / 60 * 10) / 10}h) este sub intervalul orientativ (${guideline.totalSleepMinHours}–${guideline.totalSleepMaxHours}h). Urmărește starea copilului și încearcă o rutină mai constantă.`,
    };
  }
  if (totalMinutes > maxMin * 1.12) {
    return {
      status: 'above',
      message: `Copilul a dormit mai mult decât intervalul orientativ (${guideline.totalSleepMinHours}–${guideline.totalSleepMaxHours}h). Poate fi normal după zile active sau în perioade de dezvoltare. Dacă apare somnolență neobișnuită, discută cu medicul.`,
    };
  }
  return {
    status: 'ok',
    message: `Somnul din ultimele 24h este în intervalul recomandat pentru vârsta copilului (${guideline.totalSleepMinHours}–${guideline.totalSleepMaxHours}h). Continuă rutina actuală.`,
  };
}
