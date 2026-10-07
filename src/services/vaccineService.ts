import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { VaccineRecord } from '../types/vaccines';

const vaccinesRef = (userId: string, childId: string) =>
  collection(db, 'users', userId, 'children', childId, 'vaccines');

export const vaccineService = {
  async addVaccine(userId: string, childId: string, vaccine: Omit<VaccineRecord, 'id'>): Promise<string> {
    const ref = await addDoc(vaccinesRef(userId, childId), vaccine);
    return ref.id;
  },

  async getVaccines(userId: string, childId: string): Promise<VaccineRecord[]> {
    const q = query(vaccinesRef(userId, childId), orderBy('ageMonths', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaccineRecord));
  },

  async getPendingVaccines(userId: string, childId: string): Promise<VaccineRecord[]> {
    const q = query(
      vaccinesRef(userId, childId),
      where('status', '==', 'pending'),
      orderBy('ageMonths', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaccineRecord));
  },

  async markVaccineCompleted(
    userId: string,
    childId: string,
    vaccineId: string,
    data: {
      completedDate: Timestamp;
      batchNumber?: string;
      doctor?: string;
      reactions?: string;
    }
  ): Promise<void> {
    await updateDoc(doc(vaccinesRef(userId, childId), vaccineId), {
      ...data,
      status: 'completed',
    });
  },

  async updateVaccineStatus(
    userId: string,
    childId: string,
    vaccineId: string,
    status: VaccineRecord['status']
  ): Promise<void> {
    await updateDoc(doc(vaccinesRef(userId, childId), vaccineId), { status });
  },

  // Vaccinuri în următoarele N zile
  async getUpcomingVaccines(
    userId: string,
    childId: string,
    daysAhead = 30
  ): Promise<VaccineRecord[]> {
    const now = Timestamp.now();
    const future = Timestamp.fromDate(
      new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    );
    const q = query(
      vaccinesRef(userId, childId),
      where('status', 'in', ['pending', 'scheduled']),
      where('scheduledDate', '>=', now),
      where('scheduledDate', '<=', future),
      orderBy('scheduledDate', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaccineRecord));
  },
};
