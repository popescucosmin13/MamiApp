import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { MeasurementRecord, calculateZScore, zScoreToPercentile } from '../types/growth';

const measurementsRef = (userId: string, childId: string) =>
  collection(db, 'users', userId, 'children', childId, 'measurements');

export const growthService = {
  async addMeasurement(
    userId: string,
    childId: string,
    measurement: Omit<MeasurementRecord, 'id'>
  ): Promise<string> {
    const ref = await addDoc(measurementsRef(userId, childId), measurement);
    return ref.id;
  },

  async getMeasurements(userId: string, childId: string): Promise<MeasurementRecord[]> {
    const q = query(measurementsRef(userId, childId), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeasurementRecord));
  },

  // Validare input măsurători
  validateMeasurement(data: { weight?: number; height?: number; headCircumference?: number }): string | null {
    if (data.weight !== undefined) {
      if (data.weight < 0 || data.weight > 50)
        return 'Greutatea trebuie să fie între 0 și 50 kg.';
    }
    if (data.height !== undefined) {
      if (data.height < 30 || data.height > 200)
        return 'Înălțimea trebuie să fie între 30 și 200 cm.';
    }
    if (data.headCircumference !== undefined) {
      if (data.headCircumference < 25 || data.headCircumference > 60)
        return 'Perimetrul cranian trebuie să fie între 25 și 60 cm.';
    }
    return null;
  },
};
