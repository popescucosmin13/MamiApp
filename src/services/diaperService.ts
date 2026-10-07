import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { DiaperRecord, DiaperStats } from '../types/diapers';

const diapersRef = (userId: string, childId: string) =>
  collection(db, 'users', userId, 'children', childId, 'diapers');

const diaperDocRef = (userId: string, childId: string, diaperId: string) =>
  doc(db, 'users', userId, 'children', childId, 'diapers', diaperId);

function startOfToday(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

export const diaperService = {
  async addDiaper(userId: string, childId: string, diaper: Omit<DiaperRecord, 'id'>): Promise<string> {
    const ref = await addDoc(diapersRef(userId, childId), diaper);
    return ref.id;
  },

  async deleteDiaper(userId: string, childId: string, diaperId: string): Promise<void> {
    await deleteDoc(diaperDocRef(userId, childId, diaperId));
  },

  async updateDiaper(
    userId: string,
    childId: string,
    diaperId: string,
    data: Partial<Omit<DiaperRecord, 'id'>>
  ): Promise<void> {
    const updates = { ...data };
    if ('notes' in updates && updates.notes === undefined) {
      updates.notes = deleteField() as unknown as DiaperRecord['notes'];
    }
    await updateDoc(diaperDocRef(userId, childId, diaperId), updates);
  },

  async getDiapersToday(userId: string, childId: string): Promise<DiaperRecord[]> {
    const q = query(
      diapersRef(userId, childId),
      where('timestamp', '>=', startOfToday()),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiaperRecord));
  },

  async getRecentDiapers(userId: string, childId: string, limitN = 20): Promise<DiaperRecord[]> {
    const q = query(diapersRef(userId, childId), orderBy('timestamp', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiaperRecord));
  },

  calculateStats(diapers: DiaperRecord[]): DiaperStats {
    return {
      totalToday: diapers.length,
      wetToday: diapers.filter((d) => d.type === 'wet' || d.type === 'both').length,
      dirtyToday: diapers.filter((d) => d.type === 'dirty' || d.type === 'both').length,
      lastChangeTime: diapers[0]?.timestamp,
    };
  },
};
