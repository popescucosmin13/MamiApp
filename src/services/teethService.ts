import {
  collection, doc, setDoc, deleteDoc, getDocs, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ToothStatus } from '../types/teeth';

export interface ToothRecord {
  id: string;          // tooth id (u1, l3, etc.)
  status: ToothStatus;
  date: string;        // YYYY-MM-DD
  note: string;
  updatedAt: string;
}

export const teethService = {
  async getTeeth(userId: string, childId: string): Promise<ToothRecord[]> {
    const q = query(
      collection(db, 'users', userId, 'children', childId, 'teeth'),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ToothRecord);
  },

  async saveTooth(userId: string, childId: string, record: ToothRecord): Promise<void> {
    const ref = doc(db, 'users', userId, 'children', childId, 'teeth', record.id);
    await setDoc(ref, { ...record, updatedAt: new Date().toISOString() }, { merge: true });
  },

  async deleteTooth(userId: string, childId: string, toothId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'children', childId, 'teeth', toothId));
  },
};
