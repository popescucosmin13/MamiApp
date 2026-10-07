/**
 * Smart Notifications — orchestrator de notificări personalizate pentru retenție.
 *
 * Arhitectură:
 *  - notificationOrchestrator (orar): generează candidați per utilizator din
 *    datele lui reale (sarcină/copil/activitate), îi scorează, aplică limite
 *    anti-spam și trimite maximum `dailyCap` notificări/zi la ora personală
 *    de vârf a utilizatorului.
 *  - onCommunityCommentCreated: push imediat la răspunsuri în comunitate.
 *  - onNotificationLogOpened: agregare CTR per tip (client marchează opened).
 *  - sendSmartTestNotification (admin): trimite un tip de notificare de test.
 *
 * Colecții:
 *  - notificationSettings/global      — setări globale (editabile în admin)
 *  - notificationTemplates/{type}     — template-uri titlu/corp (admin)
 *  - notificationContent/{id}         — conținut zilnic sarcină/copil (admin)
 *  - notificationStats/{type}         — contoare sent/opened per tip
 *  - users/{uid}/notificationState/current — stare per utilizator (cap zilnic, CTR)
 *  - users/{uid}/notificationLog/{id} — istoric trimiteri (client setează opened)
 *  - users/{uid}/engagement/stats     — histograma orelor de deschidere a aplicației
 */

import * as functions from 'firebase-functions/v2/https';
import * as scheduledFunctions from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { createHash, randomUUID } from 'node:crypto';

if (!getApps().length) initializeApp();
const db = getFirestore();

const SMART_MAIL_FROM = process.env.MAMIAPP_TRANSACTIONAL_FROM || 'MamiApp <noreply@example.com>';
const SMART_MAIL_REPLY_TO = process.env.MAMIAPP_TRANSACTIONAL_REPLY_TO || 'noreply@example.com';
const SMART_APP_URL = process.env.APP_PUBLIC_URL || 'https://example.com';
const SMART_UNSUBSCRIBE_URL =
  process.env.EMAIL_UNSUBSCRIBE_URL ||
  `https://us-central1-${process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'your-firebase-project'}.cloudfunctions.net/unsubscribeEmail`;

// =========================================================
// Tipuri
// =========================================================

export type SmartNotificationType =
  | 'daily_pregnancy'
  | 'pregnancy_milestone'
  | 'daily_child'
  | 'monthly_birthday'
  | 'diversification'
  | 'weekly_insight'
  | 'streak'
  | 'winback'
  | 'community_reply';

type SmartTemplate = {
  title: string;
  body: string;
  deepLink: string;
  priority: number; // 0-100, mai mare = mai important
  enabled: boolean;
};

type SmartSettings = {
  enabled: boolean;
  dailyCap: number;
  quietStart: number; // ora de început liniște (ex. 21)
  quietEnd: number;   // ora de sfârșit liniște (ex. 8)
  defaultHour: number;   // ora implicită de trimitere dacă nu avem istoric
  secondaryHour: number; // a doua fereastră (pentru al 2-lea push din cap)
};

type Candidate = {
  type: SmartNotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  score: number;
};

type UserContext = {
  uid: string;
  userData: FirebaseFirestore.DocumentData;
  prefs: Record<string, boolean>;
  now: BucharestNow;
  state: FirebaseFirestore.DocumentData;
  child: (FirebaseFirestore.DocumentData & { id: string }) | null;
  pregnancy: FirebaseFirestore.DocumentData | null;
};

type BucharestNow = {
  hour: number;
  dateKey: string;   // YYYY-MM-DD
  dayOfYear: number;
  dayOfMonth: number;
  weekday: number;   // 0 = duminică
  date: Date;
};

// =========================================================
// Setări + template-uri implicite (suprascrise din Firestore de admin)
// =========================================================

export const DEFAULT_SMART_SETTINGS: SmartSettings = {
  enabled: true,
  dailyCap: 2,
  quietStart: 21,
  quietEnd: 8,
  defaultHour: 9,
  secondaryHour: 19,
};

export const DEFAULT_SMART_TEMPLATES: Record<SmartNotificationType, SmartTemplate> = {
  daily_pregnancy: {
    title: '🤰 Săptămâna {week} din sarcină',
    body: '{content}',
    deepLink: '/modules/pregnancy',
    priority: 70,
    enabled: true,
  },
  pregnancy_milestone: {
    title: '🌸 Moment important în sarcină',
    body: '{content}',
    deepLink: '/modules/pregnancy',
    priority: 90,
    enabled: true,
  },
  daily_child: {
    title: '✨ Azi despre {childName}',
    body: '{content}',
    deepLink: '/(tabs)',
    priority: 70,
    enabled: true,
  },
  monthly_birthday: {
    title: '🎂 {childName} împlinește {ageMonths} luni azi!',
    body: 'Vezi cât a crescut și ce etape a atins luna aceasta.',
    deepLink: '/modules/growth',
    priority: 95,
    enabled: true,
  },
  diversification: {
    title: '🥑 Un aliment nou pentru {childName}',
    body: 'La {ageMonths} luni poți introduce alimente noi. Vezi sugestia de azi în ghidul de diversificare.',
    deepLink: '/modules/food',
    priority: 55,
    enabled: true,
  },
  weekly_insight: {
    title: '📈 Analiza săptămânii pentru {childName}',
    body: 'Săptămâna asta: {feeds} mese și în medie {sleepHours}h de somn pe zi. Vezi tendințele complete.',
    deepLink: '/(tabs)',
    priority: 60,
    enabled: true,
  },
  streak: {
    title: '🔥 Ziua {streak} de jurnal complet',
    body: 'Datele înregistrate constant fac analizele mult mai precise. Continuă seria azi!',
    deepLink: '/(tabs)/add',
    priority: 40,
    enabled: true,
  },
  winback: {
    title: '💛 {childName} are {ageMonthsDays}',
    body: 'S-au întâmplat multe în această perioadă de dezvoltare. Vezi ce e nou pentru vârsta lui.',
    deepLink: '/(tabs)',
    priority: 80,
    enabled: true,
  },
  community_reply: {
    title: '💬 Răspuns nou la postarea ta',
    body: '{authorName} a răspuns: "{preview}"',
    deepLink: '/modules/community',
    priority: 100,
    enabled: true,
  },
};

const WINBACK_BUCKETS = [3, 7, 14, 30];

// Copy dedicat pentru winback în modul sarcină
const WINBACK_PREGNANCY = {
  title: '💛 Ești în săptămâna {week}',
  body: 'Bebelușul tău crește în fiecare zi. Vezi ce se dezvoltă chiar acum.',
};

// Momente-cheie în sarcină: săptămână → mesaj (prioritate mare)
const PREGNANCY_MILESTONES: Record<number, { title: string; body: string; deepLink?: string }> = {
  13: { title: '🌱 Bun venit în trimestrul 2!', body: 'Grețurile scad de obicei, energia revine. Vezi ce urmează în această etapă.' },
  18: { title: '👣 Primele mișcări se apropie', body: 'Între săptămânile 18–22 multe mame simt primele mișcări. Fii atentă la fluturașii din burtică!' },
  24: { title: '🎉 Pragul viabilității', body: 'Săptămâna 24 e un moment important: plămânii bebelușului produc surfactant.' },
  28: { title: '💜 Trimestrul 3 a început', body: 'De acum e recomandat să numeri mișcările bebelușului zilnic — 10 mișcări în 2 ore.' },
  35: { title: '🎒 E timpul pentru geanta de maternitate', body: 'Pregătește geanta din timp. Ai checklist-ul complet în aplicație.', deepLink: '/modules/pregnancy/hospital-bag' },
  37: { title: '⏱️ Regula 5-1-1 pentru contracții', body: 'Bebe e considerat la termen. Învață când e momentul să pleci la maternitate.', deepLink: '/modules/pregnancy/contractions' },
};

// Countdown final: zile rămase → mesaj
const PREGNANCY_COUNTDOWN: Record<number, { title: string; body: string }> = {
  14: { title: '🗓️ Mai sunt 14 zile până la termen', body: 'Verifică geanta de maternitate și planul de naștere. Totul e pregătit?' },
  7:  { title: '⭐ O săptămână până la termen', body: 'Odihnește-te cât poți. Semnele travaliului: contracții regulate, ruperea membranelor.' },
  1:  { title: '💗 Mâine e ziua estimată!', body: 'Termenul e o estimare — bebe poate veni oricând în următoarele zile. Ești pregătită!' },
};

// Ferestre de veghe recomandate (luni → ore) — folosite și în client
export const WAKE_WINDOWS_HOURS: Array<{ maxMonths: number; hours: number }> = [
  { maxMonths: 1, hours: 1 },
  { maxMonths: 3, hours: 1.5 },
  { maxMonths: 6, hours: 2.25 },
  { maxMonths: 9, hours: 3 },
  { maxMonths: 12, hours: 3.75 },
  { maxMonths: 18, hours: 5 },
  { maxMonths: 60, hours: 6 },
];

// =========================================================
// Helpers
// =========================================================

function bucharestNow(): BucharestNow {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour')) % 24;
  const local = new Date(Date.UTC(year, month - 1, day));
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((local.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
  return {
    hour,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dayOfYear,
    dayOfMonth: day,
    weekday: local.getUTCDay(),
    date: now,
  };
}

function isQuietHour(hour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

function renderSmartTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function ageInMonthsAndDays(birthDate: Date, now: Date): { months: number; days: number } {
  let months = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  let anchor = new Date(birthDate);
  anchor.setMonth(anchor.getMonth() + months);
  if (anchor > now) {
    months -= 1;
    anchor = new Date(birthDate);
    anchor.setMonth(anchor.getMonth() + months);
  }
  const days = Math.floor((now.getTime() - anchor.getTime()) / 86_400_000);
  return { months: Math.max(0, months), days: Math.max(0, days) };
}

function formatAgeRo(months: number, days: number): string {
  const monthsPart = months === 1 ? 'o lună' : `${months} luni`;
  if (months === 0) return days === 1 ? 'o zi' : `${days} zile`;
  if (days === 0) return monthsPart;
  const daysPart = days === 1 ? 'o zi' : `${days} zile`;
  return `${monthsPart} și ${daysPart}`;
}

function pregnancyWeekFromDueDate(dueDate: Date, now: Date): { week: number; daysLeft: number } {
  const msLeft = dueDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / 86_400_000);
  const week = Math.min(42, Math.max(1, 40 - Math.floor(daysLeft / 7)));
  return { week, daysLeft };
}

function isExpoToken(token: unknown): token is string {
  return typeof token === 'string'
    && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

async function sendExpoPush(messages: Array<Record<string, unknown>>) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo push failed with ${response.status}`);
  return response.json();
}

/**
 * Trimite push pe UN singur canal (web push PWA are prioritate, apoi Expo native)
 * și scrie în notificationLog + notificationStats + notificationState.
 * Returnează true dacă s-a trimis.
 */
async function deliverSmartNotification(
  uid: string,
  userData: FirebaseFirestore.DocumentData,
  candidate: Candidate,
  nowKey: string,
  isNewDay: boolean,
): Promise<boolean> {
  const webPushToken = userData.webPushToken;
  const expoPushToken = userData.fcmToken;
  const hasWeb = typeof webPushToken === 'string' && webPushToken.length > 20;
  const hasExpo = isExpoToken(expoPushToken);
  if (!hasWeb && !hasExpo) return false;

  const logRef = db.collection(`users/${uid}/notificationLog`).doc();
  const data: Record<string, string> = {
    ...candidate.data,
    type: candidate.type,
    logId: logRef.id,
  };

  try {
    if (hasWeb) {
      // Data-only: fără câmpul `notification`, browserul nu afișează automat
      // notificarea — o afișează doar service worker-ul (sw-custom.js), o singură
      // dată. Cu `notification` + showNotification în SW apăreau DUBLATE pe PWA.
      await getMessaging().send({
        token: webPushToken,
        data: { ...data, title: candidate.title, body: candidate.body },
        webpush: { headers: { Urgency: 'high' } },
      });
    } else {
      await sendExpoPush([{
        to: expoPushToken,
        title: candidate.title,
        body: candidate.body,
        sound: 'default',
        priority: 'high',
        channelId: 'reminders',
        data,
      }]);
    }
  } catch (error) {
    console.warn(`Smart push failed for ${uid} (${candidate.type}):`, error);
    return false;
  }

  const nowTs = Timestamp.now();
  await Promise.all([
    logRef.set({
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      data,
      sentAt: nowTs,
      opened: false,
    }),
    db.doc(`notificationStats/${candidate.type}`).set({
      sent: FieldValue.increment(1),
      updatedAt: nowTs,
    }, { merge: true }),
    db.doc(`users/${uid}/notificationState/current`).set({
      date: nowKey,
      // La prima trimitere dintr-o zi nouă resetăm contorul (altfel am incrementa
      // valoarea rămasă de ieri și am bloca trimiterile de azi)
      sentToday: isNewDay ? 1 : FieldValue.increment(1),
      lastType: candidate.type,
      lastSentAt: nowTs,
      typeStats: {
        [candidate.type]: { sent: FieldValue.increment(1), lastSentDate: nowKey },
      },
    }, { merge: true }),
  ]).catch((error) => console.warn(`Smart log write failed for ${uid}:`, error));

  return true;
}

async function loadSmartSettings(): Promise<SmartSettings> {
  const snap = await db.doc('notificationSettings/global').get();
  const data = snap.data() || {};
  return {
    enabled: data.enabled !== false,
    dailyCap: Number.isInteger(data.dailyCap) && data.dailyCap > 0 ? Math.min(data.dailyCap, 5) : DEFAULT_SMART_SETTINGS.dailyCap,
    quietStart: Number.isInteger(data.quietStart) ? data.quietStart : DEFAULT_SMART_SETTINGS.quietStart,
    quietEnd: Number.isInteger(data.quietEnd) ? data.quietEnd : DEFAULT_SMART_SETTINGS.quietEnd,
    defaultHour: Number.isInteger(data.defaultHour) ? data.defaultHour : DEFAULT_SMART_SETTINGS.defaultHour,
    secondaryHour: Number.isInteger(data.secondaryHour) ? data.secondaryHour : DEFAULT_SMART_SETTINGS.secondaryHour,
  };
}

async function loadSmartTemplates(): Promise<Record<SmartNotificationType, SmartTemplate>> {
  const snap = await db.collection('notificationTemplates').get();
  const merged = { ...DEFAULT_SMART_TEMPLATES };
  for (const doc of snap.docs) {
    const type = doc.id as SmartNotificationType;
    if (!(type in DEFAULT_SMART_TEMPLATES)) continue;
    const data = doc.data();
    merged[type] = {
      title: typeof data.title === 'string' && data.title ? data.title.slice(0, 120) : merged[type].title,
      body: typeof data.body === 'string' && data.body ? data.body.slice(0, 400) : merged[type].body,
      deepLink: typeof data.deepLink === 'string' && data.deepLink ? data.deepLink : merged[type].deepLink,
      priority: Number.isFinite(data.priority) ? Math.max(0, Math.min(100, data.priority)) : merged[type].priority,
      enabled: data.enabled !== false,
    };
  }
  return merged;
}

/** Ora personală de trimitere: vârful din histograma deschiderilor, altfel implicit. */
function pickSendHours(
  engagement: FirebaseFirestore.DocumentData | undefined,
  settings: SmartSettings,
): number[] {
  const hours = engagement?.hours as Record<string, number> | undefined;
  const isAllowed = (h: number) => !isQuietHour(h, settings.quietStart, settings.quietEnd);
  if (!hours) return [settings.defaultHour, settings.secondaryHour].filter(isAllowed);

  const sorted = Object.entries(hours)
    .map(([h, count]) => ({ hour: Number(h), count: Number(count) || 0 }))
    .filter((e) => e.hour >= 0 && e.hour <= 23 && isAllowed(e.hour))
    .sort((a, b) => b.count - a.count);

  const primary = sorted[0]?.count ? sorted[0].hour : settings.defaultHour;
  // A doua fereastră: următorul vârf la distanță de minim 4 ore, altfel ora secundară globală
  const secondary = sorted.find((e) => e.count > 0 && Math.abs(e.hour - primary) >= 4)?.hour
    ?? settings.secondaryHour;
  return [primary, secondary].filter(isAllowed);
}

/** Penalizare pe baza CTR-ului istoric al utilizatorului pentru acest tip. */
function ctrMultiplier(state: FirebaseFirestore.DocumentData, type: SmartNotificationType): number {
  const stats = state.typeStats?.[type];
  const sent = Number(stats?.sent) || 0;
  const opened = Number(stats?.opened) || 0;
  if (sent < 5) return 1; // prea puține date
  const ctr = opened / sent;
  return Math.max(0.3, Math.min(1.5, 0.5 + ctr * 2));
}

function sentTodayForType(state: FirebaseFirestore.DocumentData, type: SmartNotificationType, dateKey: string): boolean {
  return state.typeStats?.[type]?.lastSentDate === dateKey;
}

// =========================================================
// Generatoare de candidați
// =========================================================

async function pickDailyContent(
  audience: 'pregnancy' | 'child',
  bucket: number,
  dayOfYear: number,
): Promise<{ title?: string; body: string; deepLink?: string } | null> {
  const field = audience === 'pregnancy' ? 'week' : 'month';
  const snap = await db.collection('notificationContent')
    .where('audience', '==', audience)
    .where(field, '==', bucket)
    .where('enabled', '==', true)
    .get();
  if (snap.empty) return null;
  const items = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const item = items[dayOfYear % items.length];
  if (!item?.body) return null;
  return {
    title: typeof item.title === 'string' && item.title ? item.title : undefined,
    body: String(item.body),
    deepLink: typeof item.deepLink === 'string' && item.deepLink ? item.deepLink : undefined,
  };
}

/** Fallback pentru sarcină: compune din pregnancy_weeks (date la 2-4 săptămâni). */
async function pregnancyWeekFallback(week: number, dayOfYear: number): Promise<string | null> {
  const snap = await db.collection('pregnancy_weeks')
    .where('week', '<=', week)
    .orderBy('week', 'desc')
    .limit(1)
    .get();
  const data = snap.docs[0]?.data();
  if (!data) return null;
  const pool: string[] = [
    data.development ? `Bebe e cât ${String(data.babySize).toLowerCase()} ${data.emoji || ''} — ${data.development}` : '',
    data.motherChanges ? `Corpul tău acum: ${data.motherChanges}` : '',
    ...(Array.isArray(data.tips) ? data.tips.map((t: string) => `Sfatul zilei: ${t}`) : []),
  ].filter(Boolean);
  if (!pool.length) return null;
  return pool[dayOfYear % pool.length];
}

async function candidatesForUser(
  ctx: UserContext,
  templates: Record<SmartNotificationType, SmartTemplate>,
): Promise<Candidate[]> {
  const { prefs, now, state, child, pregnancy } = ctx;
  const candidates: Candidate[] = [];

  const push = (
    type: SmartNotificationType,
    values: Record<string, string>,
    overrides?: { title?: string; body?: string; deepLink?: string; priorityBoost?: number },
  ) => {
    const template = templates[type];
    if (!template.enabled) return;
    if (sentTodayForType(state, type, now.dateKey)) return;
    const title = renderSmartTemplate(overrides?.title ?? template.title, values);
    const body = renderSmartTemplate(overrides?.body ?? template.body, values);
    const screen = overrides?.deepLink ?? template.deepLink;
    candidates.push({
      type,
      title,
      body,
      data: { screen },
      score: (template.priority + (overrides?.priorityBoost || 0)) * ctrMultiplier(state, type),
    });
  };

  const childName = child?.name ? String(child.name) : 'bebelușul tău';

  // ── Sarcină: conținut zilnic + momente-cheie + countdown ──
  const dueDate = pregnancy ? toDate(pregnancy.dueDate) : null;
  if (dueDate && prefs.dailyContent !== false) {
    const { week, daysLeft } = pregnancyWeekFromDueDate(dueDate, now.date);

    const countdown = daysLeft >= 0 ? PREGNANCY_COUNTDOWN[daysLeft] : undefined;
    const milestone = PREGNANCY_MILESTONES[week];
    // Momentele-cheie se trimit cel mult o dată la 5 zile (o dată per săptămână-cheie)
    const lastMilestoneDate = state.typeStats?.pregnancy_milestone?.lastSentDate;
    const milestoneRecentlySent = typeof lastMilestoneDate === 'string'
      && (new Date(now.dateKey).getTime() - new Date(lastMilestoneDate).getTime()) < 5 * 86_400_000;
    if (countdown && !milestoneRecentlySent) {
      push('pregnancy_milestone', { week: String(week) }, { title: countdown.title, body: countdown.body });
    } else if (milestone && !milestoneRecentlySent) {
      push('pregnancy_milestone', { week: String(week) }, {
        title: milestone.title,
        body: milestone.body,
        deepLink: milestone.deepLink,
      });
    }

    const content = await pickDailyContent('pregnancy', week, now.dayOfYear);
    const fallback = content ? null : await pregnancyWeekFallback(week, now.dayOfYear);
    const body = content?.body || fallback;
    if (body) {
      push('daily_pregnancy', { week: String(week), content: body }, {
        title: content?.title,
        deepLink: content?.deepLink,
      });
    }
  }

  // ── Copil: aniversare lunară + conținut zilnic + diversificare ──
  const birthDate = child ? toDate(child.birthDate) : null;
  if (birthDate && child) {
    const { months, days } = ageInMonthsAndDays(birthDate, now.date);
    const values = {
      childName,
      ageMonths: String(months),
      ageMonthsDays: formatAgeRo(months, days),
    };

    // Aniversare lunară: ziua din lună coincide (cu clamp la final de lună)
    if (prefs.milestones !== false && months >= 1 && months <= 36 && days === 0) {
      push('monthly_birthday', values);
    }

    if (prefs.dailyContent !== false) {
      const content = await pickDailyContent('child', Math.min(months, 24), now.dayOfYear);
      if (content?.body) {
        push('daily_child', { ...values, content: content.body }, {
          title: content.title,
          deepLink: content.deepLink,
        });
      }
    }

    // Diversificare: 6-12 luni, o dată la 3 zile
    if (prefs.dailyContent !== false && months >= 6 && months < 12 && now.dayOfYear % 3 === 0) {
      push('diversification', values);
    }

    // Insight săptămânal: duminica, din rezumatele existente
    if (prefs.aiSummary !== false && now.weekday === 0) {
      const summariesSnap = await db.collection(`users/${ctx.uid}/summaries`)
        .orderBy('date', 'desc')
        .limit(7)
        .get();
      if (summariesSnap.size >= 3) {
        const docs = summariesSnap.docs.map((d) => d.data());
        const feeds = docs.reduce((s, d) => s + (Number(d.feedsCount) || 0), 0);
        const sleepAvg = docs.reduce((s, d) => s + (Number(d.sleepMinutes) || 0), 0) / docs.length / 60;
        if (feeds > 0 || sleepAvg > 0) {
          push('weekly_insight', {
            ...values,
            feeds: String(feeds),
            sleepHours: (Math.round(sleepAvg * 10) / 10).toString(),
          });
        }
      }

      // Streak: zile consecutive cu activitate înregistrată (din aceleași rezumate)
      if (prefs.dailyContent !== false && summariesSnap.size >= 3) {
        let streak = 0;
        for (const d of summariesSnap.docs.map((x) => x.data())) {
          const active = (Number(d.feedsCount) || 0) + (Number(d.diapersCount) || 0) + (Number(d.sleepMinutes) || 0) > 0;
          if (!active) break;
          streak += 1;
        }
        if (streak >= 3) {
          push('streak', { ...values, streak: String(streak) });
        }
      }
    }
  }

  // ── Winback: utilizatori inactivi la praguri fixe ──
  const lastSeen = toDate(ctx.userData.appLastSeenAt) || toDate(ctx.userData.updatedAt);
  if (lastSeen) {
    const inactiveDays = Math.floor((now.date.getTime() - lastSeen.getTime()) / 86_400_000);
    if (WINBACK_BUCKETS.includes(inactiveDays)) {
      if (dueDate) {
        const { week } = pregnancyWeekFromDueDate(dueDate, now.date);
        push('winback', { week: String(week), childName, ageMonthsDays: '' }, {
          title: WINBACK_PREGNANCY.title,
          body: WINBACK_PREGNANCY.body,
          deepLink: '/modules/pregnancy',
          priorityBoost: inactiveDays >= 14 ? 10 : 0,
        });
      } else if (birthDate) {
        const { months, days } = ageInMonthsAndDays(birthDate, now.date);
        push('winback', {
          childName,
          ageMonths: String(months),
          ageMonthsDays: formatAgeRo(months, days),
        }, { priorityBoost: inactiveDays >= 14 ? 10 : 0 });
      }
    }
  }

  return candidates;
}

// =========================================================
// Email — winback fallback + drip onboarding
// =========================================================

type SmartEmailTemplate = {
  enabled: boolean;
  subject: string;
  html: string;
  dayOffset?: number;
};

function escapeHtmlSmart(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Logo-ul MamiApp folosit în emailuri — servit din Firebase Hosting. */
const EMAIL_LOGO_URL =
  process.env.MAMIAPP_EMAIL_LOGO_URL || 'https://example.com/assets/icon.png';

/** Șablonul vizual comun al emailurilor automate MamiApp. */
function buildBrandedEmail(input: { title: string; bodyHtml: string; ctaText?: string; ctaUrl?: string }) {
  const cta = input.ctaText && input.ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
         <a href="${escapeHtmlSmart(input.ctaUrl)}" style="display:inline-block;background:#E8997A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 32px;border-radius:12px;">${escapeHtmlSmart(input.ctaText)}</a>
       </div>`
    : '';
  return `
  <div style="background:#FAF6F2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;">
      <img src="${EMAIL_LOGO_URL}" width="56" height="56" alt="MamiApp" style="display:block;margin:0 auto 8px;border-radius:16px;" />
      <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#B96F87;font-weight:bold;margin-bottom:18px;">MAMIAPP</div>
      <h1 style="font-size:20px;color:#3D3436;text-align:center;margin:0 0 16px;">${input.title}</h1>
      <div style="font-size:14px;line-height:1.7;color:#5C5254;">${input.bodyHtml}</div>
      ${cta}
    </div>
  </div>`;
}

export const DEFAULT_SMART_EMAILS: Record<string, SmartEmailTemplate> = {
  winback: {
    enabled: true,
    subject: '💛 {subjectLine}',
    html: '<p>Bună, {displayName}!</p><p>{personalLine}</p><p>Deschide MamiApp să vezi ce e nou pentru voi — de la etapele de dezvoltare până la sfaturile zilnice personalizate.</p>',
  },
  drip_0: {
    enabled: true,
    dayOffset: 0,
    subject: '🌸 Bun venit la MamiApp, {displayName}!',
    html: '<p>Ne bucurăm că ești aici! MamiApp e alături de tine în fiecare zi — de la urmărirea sarcinii sau a bebelușului, până la răspunsuri de la asistentul AI.</p><p><strong>Primul pas:</strong> completează profilul și explorează modulele de pe ecranul principal. Totul e gândit pentru mame din România.</p>',
  },
  drip_1: {
    enabled: true,
    dayOffset: 2,
    subject: '🤖 Ai o întrebare? Asistentul AI îți răspunde oricând',
    html: '<p>Bună, {displayName}!</p><p>Știai că poți întreba orice despre sarcină sau bebeluș, oricând, direct în aplicație? Asistentul AI din MamiApp răspunde pe baza contextului vostru — vârsta copilului, săptămâna de sarcină, istoricul înregistrat.</p><p>Încearcă azi: „De ce se trezește noaptea?” sau „Ce alimente pot introduce acum?”</p>',
  },
  drip_2: {
    enabled: true,
    dayOffset: 5,
    subject: '📊 Micile înregistrări fac diferența mare',
    html: '<p>Bună, {displayName}!</p><p>Mamele care înregistrează mesele și somnul câteva zile la rând primesc remindere personalizate pe ritmul real al bebelușului — nu la ore fixe.</p><p>Plus: rezumatul zilnic îți arată tipare pe care altfel nu le-ai observa.</p>',
  },
  drip_3: {
    enabled: true,
    dayOffset: 8,
    subject: '⭐ Deblochează tot ce poate MamiApp',
    html: '<p>Bună, {displayName}!</p><p>Cu MamiApp Premium primești răspunsuri AI nelimitate, partajare cu familia, spațiu extins pentru documente medicale și analize avansate.</p><p>Mii de mame îl folosesc deja zilnic — încearcă-l și tu.</p>',
  },
};

async function loadSmartEmailTemplate(id: string): Promise<SmartEmailTemplate | null> {
  const fallback = DEFAULT_SMART_EMAILS[id];
  if (!fallback) return null;
  const snap = await db.doc(`notificationEmails/${id}`).get();
  const data = snap.data() || {};
  return {
    enabled: data.enabled !== false && fallback.enabled,
    subject: typeof data.subject === 'string' && data.subject ? data.subject.slice(0, 180) : fallback.subject,
    html: typeof data.html === 'string' && data.html ? data.html.slice(0, 20_000) : fallback.html,
    dayOffset: Number.isInteger(data.dayOffset) && data.dayOffset >= 0 ? data.dayOffset : fallback.dayOffset,
  };
}

async function isEmailUnsubscribed(userData: FirebaseFirestore.DocumentData, email: string): Promise<boolean> {
  if (userData.emailMarketingUnsubscribed === true) return true;
  if (userData.emailPreferences?.marketing === false) return true;
  const docId = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const snap = await db.doc(`emailUnsubscribes/${docId}`).get();
  return snap.exists;
}

function appendSmartUnsubscribeFooter(html: string, url: string) {
  const safeUrl = escapeHtmlSmart(url);
  return `${html}
    <div style="max-width:520px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#8a7580;text-align:center;">
      Primești acest email pentru că ai cont MamiApp.
      <a href="${safeUrl}" style="color:#D88FA8;text-decoration:underline;">Dezabonează-te aici</a>.
    </div>`;
}

/** Pune emailul în coadă (extensia Trigger Email), cu token de dezabonare + log + statistici. */
async function queueSmartEmail(input: {
  uid: string;
  email: string;
  subject: string;
  html: string;
  type: string;
  nowKey: string;
}): Promise<void> {
  const token = randomUUID();
  const unsubscribeLink = `${SMART_UNSUBSCRIBE_URL}?token=${encodeURIComponent(token)}`;
  const nowTs = Timestamp.now();
  const logRef = db.collection(`users/${input.uid}/notificationLog`).doc();

  await Promise.all([
    db.collection('emailUnsubscribeTokens').doc(token).set({
      token,
      email: input.email,
      uid: input.uid,
      campaignId: `smart_${input.type}`,
      createdAt: nowTs,
      usedAt: null,
    }),
    db.collection('mail').add({
      to: [input.email],
      from: SMART_MAIL_FROM,
      replyTo: SMART_MAIL_REPLY_TO,
      message: {
        subject: input.subject,
        html: appendSmartUnsubscribeFooter(input.html, unsubscribeLink),
      },
      metadata: { type: `smart_${input.type}`, uid: input.uid },
      createdAt: nowTs,
    }),
    logRef.set({
      type: input.type,
      channel: 'email',
      title: input.subject,
      body: '',
      sentAt: nowTs,
      opened: false,
    }),
    db.doc(`notificationStats/${input.type}`).set({
      sent: FieldValue.increment(1),
      updatedAt: nowTs,
    }, { merge: true }),
  ]);
}

const WINBACK_EMAIL_BUCKETS = [7, 14, 30];

/**
 * Winback pe email — fallback pentru utilizatorii FĂRĂ token push valid
 * (au dezinstalat aplicația sau au refuzat notificările). Emailul e singurul
 * canal care îi mai poate aduce înapoi. Rulează o dată pe zi (ora 10).
 */
async function maybeSendWinbackEmail(
  uid: string,
  userData: FirebaseFirestore.DocumentData,
  now: BucharestNow,
): Promise<void> {
  if (now.hour !== 10) return;

  const email = typeof userData.email === 'string' ? userData.email.trim() : '';
  if (!email || !email.includes('@')) return;

  const lastSeen = toDate(userData.appLastSeenAt) || toDate(userData.updatedAt);
  if (!lastSeen) return;
  const inactiveDays = Math.floor((now.date.getTime() - lastSeen.getTime()) / 86_400_000);
  if (!WINBACK_EMAIL_BUCKETS.includes(inactiveDays)) return;

  const stateRef = db.doc(`users/${uid}/notificationState/current`);
  const stateSnap = await stateRef.get();
  if (stateSnap.data()?.winbackEmailLastDate === now.dateKey) return;

  const template = await loadSmartEmailTemplate('winback');
  if (!template?.enabled) return;
  if (await isEmailUnsubscribed(userData, email)) return;

  // Linia personală: vârsta copilului sau săptămâna de sarcină
  const displayName = String(userData.displayName || '').split(' ')[0] || 'mămico';
  let personalLine = 'S-au întâmplat multe de când nu ne-am văzut.';
  let subjectLine = 'Ne e dor de voi în MamiApp';

  try {
    if (userData.profileMode === 'pregnancy') {
      const pregnancySnap = await db.doc(`users/${uid}/pregnancy/current`).get();
      const dueDate = toDate(pregnancySnap.data()?.dueDate);
      if (dueDate) {
        const { week } = pregnancyWeekFromDueDate(dueDate, now.date);
        personalLine = `Ești în săptămâna ${week} de sarcină — bebelușul tău crește în fiecare zi și avem informații noi pregătite pentru această etapă.`;
        subjectLine = `Săptămâna ${week} din sarcină a venit cu noutăți`;
      }
    } else {
      const childSnap = await db.collection(`users/${uid}/children`).where('isActive', '==', true).limit(1).get();
      const child = childSnap.docs[0]?.data();
      const birthDate = child ? toDate(child.birthDate) : null;
      if (child && birthDate) {
        const { months, days } = ageInMonthsAndDays(birthDate, now.date);
        const childName = String(child.name || 'bebelușul tău');
        personalLine = `${childName} are acum ${formatAgeRo(months, days)} — la această vârstă apar lucruri noi în fiecare săptămână, iar MamiApp ți le arată pe toate.`;
        subjectLine = `${childName} are ${formatAgeRo(months, days)} 🎈`;
      }
    }
  } catch {
    // păstrăm linia generică
  }

  const values = { displayName, personalLine, subjectLine, appUrl: SMART_APP_URL };
  const subject = renderSmartTemplate(template.subject, values);
  const html = buildBrandedEmail({
    title: subjectLine,
    bodyHtml: renderSmartTemplate(template.html, values),
    ctaText: 'Deschide MamiApp',
    ctaUrl: SMART_APP_URL,
  });

  await queueSmartEmail({ uid, email, subject, html, type: 'winback_email', nowKey: now.dateKey });
  await stateRef.set({ winbackEmailLastDate: now.dateKey }, { merge: true }).catch(() => {});
}

// =========================================================
// sendOnboardingDripEmails — secvența de activare (zilele 0/2/5/8)
// =========================================================

export const sendOnboardingDripEmails = scheduledFunctions.onSchedule(
  { schedule: '0 10 * * *', timeZone: 'Europe/Bucharest', memory: '256MiB', timeoutSeconds: 300 },
  async () => {
    const now = bucharestNow();
    const stepIds = ['drip_0', 'drip_1', 'drip_2', 'drip_3'];
    const templates = await Promise.all(stepIds.map((id) => loadSmartEmailTemplate(id)));

    const maxOffset = Math.max(...templates.map((t) => t?.dayOffset ?? 0));
    const cutoff = Timestamp.fromDate(new Date(now.date.getTime() - (maxOffset + 2) * 86_400_000));
    const usersSnap = await db.collection('users').where('createdAt', '>=', cutoff).get();

    let sentCount = 0;
    for (const userDoc of usersSnap.docs) {
      try {
        const uid = userDoc.id;
        const userData = userDoc.data();
        const email = typeof userData.email === 'string' ? userData.email.trim() : '';
        if (!email || !email.includes('@')) continue;

        const createdAt = toDate(userData.createdAt);
        if (!createdAt) continue;
        const daysSince = Math.floor((now.date.getTime() - createdAt.getTime()) / 86_400_000);

        const stepIndex = templates.findIndex((t) => t?.enabled && t.dayOffset === daysSince);
        if (stepIndex === -1) continue;
        const template = templates[stepIndex]!;
        const stepId = stepIds[stepIndex];

        const stateRef = db.doc(`users/${uid}/notificationState/current`);
        const stateSnap = await stateRef.get();
        if (stateSnap.data()?.drip?.[stepId]) continue; // deja trimis

        if (await isEmailUnsubscribed(userData, email)) continue;

        const displayName = String(userData.displayName || '').split(' ')[0] || 'mămico';
        const values = { displayName, appUrl: SMART_APP_URL };
        const subject = renderSmartTemplate(template.subject, values);
        const html = buildBrandedEmail({
          title: subject.replace(/^[^\p{L}\p{N}]+\s*/u, ''),
          bodyHtml: renderSmartTemplate(template.html, values),
          ctaText: 'Deschide MamiApp',
          ctaUrl: SMART_APP_URL,
        });

        await queueSmartEmail({ uid, email, subject, html, type: stepId, nowKey: now.dateKey });
        await stateRef.set({ drip: { [stepId]: now.dateKey } }, { merge: true });
        sentCount += 1;
      } catch (error) {
        console.warn('Drip email failed for user:', userDoc.id, error);
      }
    }

    console.log(`sendOnboardingDripEmails: sent ${sentCount} emails`);
  }
);

// =========================================================
// notificationOrchestrator — rulează orar
// =========================================================

export const notificationOrchestrator = scheduledFunctions.onSchedule(
  { schedule: '0 * * * *', timeZone: 'Europe/Bucharest', memory: '512MiB', timeoutSeconds: 540 },
  async () => {
    const settings = await loadSmartSettings();
    if (!settings.enabled) return;

    const now = bucharestNow();
    if (isQuietHour(now.hour, settings.quietStart, settings.quietEnd)) return;

    const templates = await loadSmartTemplates();
    const usersSnap = await db.collection('users').get();
    let sentCount = 0;

    for (const userDoc of usersSnap.docs) {
      try {
        const uid = userDoc.id;
        const userData = userDoc.data();

        const hasToken = isExpoToken(userData.fcmToken)
          || (typeof userData.webPushToken === 'string' && userData.webPushToken.length > 20);
        if (!hasToken) {
          // Fără push (dezinstalat / refuzat) — emailul e singurul canal de winback
          await maybeSendWinbackEmail(uid, userData, now).catch(() => {});
          continue;
        }

        // Ore de liniște per utilizator (suprascriu setarea globală)
        const userQuietStart = Number.isInteger(userData.preferences?.quietHoursStart)
          ? userData.preferences.quietHoursStart : settings.quietStart;
        const userQuietEnd = Number.isInteger(userData.preferences?.quietHoursEnd)
          ? userData.preferences.quietHoursEnd : settings.quietEnd;
        if (isQuietHour(now.hour, userQuietStart, userQuietEnd)) continue;

        const [stateSnap, engagementSnap] = await Promise.all([
          db.doc(`users/${uid}/notificationState/current`).get(),
          db.doc(`users/${uid}/engagement/stats`).get(),
        ]);
        let state = stateSnap.data() || {};

        // Reset zilnic al contorului
        const isNewDay = state.date !== now.dateKey;
        if (isNewDay) {
          state = { ...state, date: now.dateKey, sentToday: 0 };
        }
        const sentToday = Number(state.sentToday) || 0;
        if (sentToday >= settings.dailyCap) continue;

        // Fereastra personală de trimitere
        const sendHours = pickSendHours(engagementSnap.data(), settings);
        const hourIndex = sendHours.indexOf(now.hour);
        if (hourIndex === -1) continue;
        // A doua fereastră e folosită doar dacă mai e loc în cap
        if (hourIndex > 0 && sentToday === 0) {
          // nu am trimis nimic azi — permitem și în fereastra secundară
        } else if (hourIndex > sentToday) {
          continue;
        }

        const prefs = (userData.preferences?.notifications || {}) as Record<string, boolean>;
        const [childSnap, pregnancySnap] = await Promise.all([
          db.collection(`users/${uid}/children`).where('isActive', '==', true).limit(1).get(),
          userData.profileMode === 'pregnancy'
            ? db.doc(`users/${uid}/pregnancy/current`).get()
            : Promise.resolve(null),
        ]);
        const childDoc = childSnap.docs[0];
        const ctx: UserContext = {
          uid,
          userData,
          prefs,
          now,
          state,
          child: childDoc ? { id: childDoc.id, ...childDoc.data() } : null,
          pregnancy: pregnancySnap?.exists ? pregnancySnap.data() || null : null,
        };

        const candidates = await candidatesForUser(ctx, templates);
        if (!candidates.length) continue;

        // Anti-repetiție: tipurile non-zilnice nu se trimit două zile la rând
        const repeatable = new Set<SmartNotificationType>(['daily_pregnancy', 'daily_child']);
        const filtered = candidates.filter((c) =>
          repeatable.has(c.type) || c.score >= 85 || state.lastType !== c.type
        );
        const pool = filtered.length ? filtered : candidates;
        pool.sort((a, b) => b.score - a.score);

        const delivered = await deliverSmartNotification(uid, userData, pool[0], now.dateKey, isNewDay);
        if (delivered) sentCount += 1;
      } catch (error) {
        console.warn('Orchestrator user failed:', userDoc.id, error);
      }
    }

    console.log(`notificationOrchestrator: sent ${sentCount} notifications at hour ${now.hour}`);
  }
);

// =========================================================
// onCommunityCommentCreated — răspunsuri în comunitate (imediat)
// =========================================================

export const onCommunityCommentCreated = onDocumentCreated(
  { document: 'community_posts/{postId}/comments/{commentId}', memory: '256MiB' },
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;

    const postId = event.params.postId;
    const postSnap = await db.doc(`community_posts/${postId}`).get();
    const post = postSnap.data();
    const authorId = post?.authorId;
    if (!authorId || authorId === comment.authorId) return;

    const userSnap = await db.doc(`users/${authorId}`).get();
    const userData = userSnap.data();
    if (!userData) return;

    const prefs = (userData.preferences?.notifications || {}) as Record<string, boolean>;
    if (prefs.community === false) return;

    const settings = await loadSmartSettings();
    const now = bucharestNow();
    const quietStart = Number.isInteger(userData.preferences?.quietHoursStart)
      ? userData.preferences.quietHoursStart : settings.quietStart;
    const quietEnd = Number.isInteger(userData.preferences?.quietHoursEnd)
      ? userData.preferences.quietHoursEnd : settings.quietEnd;
    if (isQuietHour(now.hour, quietStart, quietEnd)) return;

    const templates = await loadSmartTemplates();
    const template = templates.community_reply;
    if (!template.enabled) return;

    const preview = String(comment.content || comment.text || '').slice(0, 80);
    const authorName = String(comment.authorName || 'Cineva');
    const candidate: Candidate = {
      type: 'community_reply',
      title: renderSmartTemplate(template.title, { authorName, preview }),
      body: renderSmartTemplate(template.body, { authorName, preview }),
      data: { screen: `/modules/community/post/${postId}`, postId },
      score: template.priority,
    };

    // Notificările de comunitate sunt tranzacționale — nu consumă capul zilnic,
    // dar sunt limitate la 5/zi ca să nu devină spam la postări virale.
    const stateSnap = await db.doc(`users/${authorId}/notificationState/current`).get();
    const state = stateSnap.data() || {};
    const isNewDay = state.date !== now.dateKey;
    const communityToday = isNewDay ? 0 : Number(state.communitySentToday) || 0;
    if (communityToday >= 5) return;

    const delivered = await deliverSmartNotification(authorId, userData, candidate, now.dateKey, isNewDay);
    if (delivered) {
      await db.doc(`users/${authorId}/notificationState/current`).set({
        date: now.dateKey,
        // deliverSmartNotification a setat/incrementat sentToday; compensăm ca
        // push-urile de comunitate să nu consume capul zilnic al orchestratorului
        sentToday: FieldValue.increment(-1),
        communitySentToday: isNewDay ? 1 : FieldValue.increment(1),
      }, { merge: true }).catch(() => {});
    }
  }
);

// =========================================================
// onNotificationLogOpened — agregare CTR
// =========================================================

export const onNotificationLogOpened = onDocumentUpdated(
  { document: 'users/{uid}/notificationLog/{logId}', memory: '256MiB' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.opened === true || after.opened !== true) return;

    const type = String(after.type || 'unknown');
    await Promise.all([
      db.doc(`notificationStats/${type}`).set({
        opened: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      }, { merge: true }),
      db.doc(`users/${event.params.uid}/notificationState/current`).set({
        typeStats: { [type]: { opened: FieldValue.increment(1) } },
      }, { merge: true }),
    ]);
  }
);

// =========================================================
// sendSmartTestNotification — test din admin panel
// =========================================================

export const sendSmartTestNotification = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 60, cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
    const adminSnap = await db.doc(`adminUsers/${callerUid}`).get();
    if (!adminSnap.exists || adminSnap.data()?.isActive !== true) {
      throw new functions.HttpsError('permission-denied', 'Acces admin necesar');
    }

    const targetUid = typeof request.data?.uid === 'string' && request.data.uid ? request.data.uid : callerUid;
    const requestedType = request.data?.type as SmartNotificationType | undefined;

    const userSnap = await db.doc(`users/${targetUid}`).get();
    const userData = userSnap.data();
    if (!userData) throw new functions.HttpsError('not-found', 'Utilizator inexistent');

    const now = bucharestNow();
    const templates = await loadSmartTemplates();
    const [childSnap, pregnancySnap] = await Promise.all([
      db.collection(`users/${targetUid}/children`).where('isActive', '==', true).limit(1).get(),
      db.doc(`users/${targetUid}/pregnancy/current`).get(),
    ]);
    const childDoc = childSnap.docs[0];
    const ctx: UserContext = {
      uid: targetUid,
      userData,
      prefs: {}, // testul ignoră preferințele
      now,
      state: {}, // testul ignoră capul zilnic și CTR-ul
      child: childDoc ? { id: childDoc.id, ...childDoc.data() } : null,
      pregnancy: pregnancySnap.exists ? pregnancySnap.data() || null : null,
    };

    const candidates = await candidatesForUser(ctx, templates);
    const candidate = requestedType
      ? candidates.find((c) => c.type === requestedType)
      : candidates.sort((a, b) => b.score - a.score)[0];

    if (!candidate) {
      throw new functions.HttpsError(
        'failed-precondition',
        `Niciun candidat disponibil${requestedType ? ` pentru tipul ${requestedType}` : ''} — utilizatorul nu are date potrivite (sarcină/copil).`
      );
    }

    // Testul nu trebuie să reseteze contorul zilnic real — tratăm ca zi existentă
    const delivered = await deliverSmartNotification(targetUid, userData, candidate, now.dateKey, false);
    if (!delivered) {
      throw new functions.HttpsError('failed-precondition', 'Utilizatorul nu are token push activ.');
    }
    return { ok: true, type: candidate.type, title: candidate.title, body: candidate.body };
  }
);
