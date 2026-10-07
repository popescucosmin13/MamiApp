import {
  collection, addDoc, deleteDoc, updateDoc, getDoc,
  doc, getDocs, query, orderBy, limit, where, setDoc, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { SleepRecord, SleepStats, SleepLog, SleepSignalLog, ChildSleepProfile } from '../types/sleep';
import { buildSleepProfile } from './sleepEngine';

// ─── Firestore paths ──────────────────────────────────────────────────────────
const sleepsRef      = (uid: string, cid: string) => collection(db, 'users', uid, 'children', cid, 'sleeps');
const sleepDocRef    = (uid: string, cid: string, id: string) => doc(db, 'users', uid, 'children', cid, 'sleeps', id);
const signalsRef     = (uid: string, cid: string) => collection(db, 'users', uid, 'children', cid, 'sleepSignals');
const signalDocRef   = (uid: string, cid: string, id: string) => doc(db, 'users', uid, 'children', cid, 'sleepSignals', id);
const profileDocRef  = (uid: string, cid: string) => doc(db, 'users', uid, 'sleepProfiles', cid);

function startOf24h(): Timestamp {
  return Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeTimestampToISO(ts: Timestamp): string {
  try {
    return ts.toDate().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function toSleepLog(id: string, data: any): SleepLog {
  const startTime = data.startTime instanceof Timestamp
    ? safeTimestampToISO(data.startTime)
    : (data.startTime ?? new Date().toISOString());
  const endTime = data.endTime instanceof Timestamp
    ? safeTimestampToISO(data.endTime)
    : data.endTime;
  const durationMinutes = data.durationMinutes
    ?? (data.duration ? Math.round(data.duration / 60) : undefined);
  return {
    id,
    userId: data.userId ?? '',
    childId: data.childId ?? '',
    sleepType: data.sleepType ?? data.type ?? 'nap',
    startTime,
    endTime,
    durationMinutes,
    wakeUps: data.wakeUps,
    sleepQuality: data.sleepQuality ?? data.quality,
    moodBefore: data.moodBefore,
    moodAfter: data.moodAfter,
    notes: data.notes,
    createdAt: data.createdAt ?? startTime,
    updatedAt: data.updatedAt ?? startTime,
  };
}

export const sleepService = {
  // ─── Legacy API (used by existing timer code) ──────────────────────────────
  async startSleep(userId: string, childId: string, type: 'night' | 'nap', createdBy: string): Promise<string> {
    const ref = await addDoc(sleepsRef(userId, childId), {
      startTime: Timestamp.now(),
      sleepType: type, type,
      quality: 'good', sleepQuality: 'good',
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return ref.id;
  },

  async endSleep(userId: string, childId: string, sleepId: string, quality: SleepRecord['quality']): Promise<void> {
    const endTime = Timestamp.now();
    const snap = await getDoc(sleepDocRef(userId, childId, sleepId));
    if (snap.exists()) {
      const startTime = snap.data().startTime as Timestamp;
      const durationSeconds = endTime.seconds - startTime.seconds;
      const durationMinutes = Math.round(durationSeconds / 60);
      await updateDoc(sleepDocRef(userId, childId, sleepId), {
        endTime, duration: durationSeconds, durationMinutes,
        quality, sleepQuality: quality,
        updatedAt: new Date().toISOString(),
      });
    }
  },

  // ─── SleepLog CRUD ────────────────────────────────────────────────────────
  async addSleepLog(userId: string, childId: string, log: Omit<SleepLog, 'id' | 'userId' | 'childId'>): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(sleepsRef(userId, childId), {
      ...log, userId, childId,
      createdAt: now, updatedAt: now,
    });
    return ref.id;
  },

  async updateSleepLog(userId: string, childId: string, sleepId: string, data: Partial<SleepLog>): Promise<void> {
    await updateDoc(sleepDocRef(userId, childId, sleepId), {
      ...data, updatedAt: new Date().toISOString(),
    });
  },

  async deleteSleepLog(userId: string, childId: string, sleepId: string): Promise<void> {
    await deleteDoc(sleepDocRef(userId, childId, sleepId));
  },

  // ─── Queries ──────────────────────────────────────────────────────────────
  async getSleepsLast24h(userId: string, childId: string): Promise<SleepLog[]> {
    const q = query(sleepsRef(userId, childId), where('startTime', '>=', startOf24h()), orderBy('startTime', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => toSleepLog(d.id, d.data()));
  },

  async getRecentSleepLogs(userId: string, childId: string, limitN = 30): Promise<SleepLog[]> {
    const q = query(sleepsRef(userId, childId), orderBy('startTime', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => toSleepLog(d.id, d.data()));
  },

  async getSleepLast7Days(userId: string, childId: string): Promise<SleepLog[]> {
    const cutoff = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const q = query(sleepsRef(userId, childId), where('startTime', '>=', cutoff), orderBy('startTime', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => toSleepLog(d.id, d.data()));
  },

  // ─── Sleep Signals ────────────────────────────────────────────────────────
  async addSleepSignal(userId: string, childId: string, signal: Omit<SleepSignalLog, 'id' | 'userId' | 'childId'>): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(signalsRef(userId, childId), {
      ...signal, userId, childId, createdAt: now,
    });
    return ref.id;
  },

  async getSignalsToday(userId: string, childId: string): Promise<SleepSignalLog[]> {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const q = query(signalsRef(userId, childId), where('date', '==', todayStr));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SleepSignalLog));
  },

  // ─── Child sleep profile ──────────────────────────────────────────────────
  async getSleepProfile(userId: string, childId: string): Promise<ChildSleepProfile | null> {
    const snap = await getDoc(profileDocRef(userId, childId));
    return snap.exists() ? (snap.data() as ChildSleepProfile) : null;
  },

  async rebuildAndSaveSleepProfile(userId: string, childId: string): Promise<ChildSleepProfile> {
    const logs = await sleepService.getRecentSleepLogs(userId, childId, 100);
    const profile = buildSleepProfile(childId, logs);
    await setDoc(profileDocRef(userId, childId), profile, { merge: true });
    return profile;
  },

  // ─── Stats (legacy compatible) ────────────────────────────────────────────
  calculateStats(sleeps: SleepRecord[]): SleepStats {
    const completed = sleeps.filter(s => s.endTime && s.duration);
    const totalSeconds = completed.reduce((acc, s) => acc + (s.duration || 0), 0);
    const naps = completed.filter(s => s.type === 'nap');
    const nights = completed.filter(s => s.type === 'night');
    return {
      totalHoursToday: Math.round((totalSeconds / 3600) * 10) / 10,
      totalNaps: naps.length,
      nightSleepHours: Math.round((nights.reduce((a, s) => a + (s.duration || 0), 0) / 3600) * 10) / 10,
      napHours: Math.round((naps.reduce((a, s) => a + (s.duration || 0), 0) / 3600) * 10) / 10,
      avgQuality: 'bun',
      lastSleepStart: sleeps[0]?.startTime,
    };
  },

  // Legacy aliases
  async addSleep(userId: string, childId: string, sleep: Omit<SleepRecord, 'id'>): Promise<string> {
    const ref = await addDoc(sleepsRef(userId, childId), sleep);
    return ref.id;
  },
  async updateSleep(userId: string, childId: string, sleepId: string, data: Partial<Omit<SleepRecord, 'id'>>): Promise<void> {
    await updateDoc(sleepDocRef(userId, childId, sleepId), data);
  },
  async deleteSleep(userId: string, childId: string, sleepId: string): Promise<void> {
    await deleteDoc(sleepDocRef(userId, childId, sleepId));
  },
  async getSleepsToday(userId: string, childId: string): Promise<SleepRecord[]> {
    const q = query(sleepsRef(userId, childId), where('startTime', '>=', Timestamp.fromDate(Object.assign(new Date(), { setHours: (n: number) => n }))), orderBy('startTime', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SleepRecord));
  },
  async getRecentSleeps(userId: string, childId: string, limitN = 20): Promise<SleepRecord[]> {
    const q = query(sleepsRef(userId, childId), orderBy('startTime', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SleepRecord));
  },
};
