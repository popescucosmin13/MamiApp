import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Pregnancy,
  WeightLog,
  Symptom,
  FetalMovement,
  Contraction,
  PregnancyAppointment,
  Vital,
  JournalEntry,
  DoctorQuestion,
} from '../types/pregnancy';

const pregnancyRef = (userId: string) =>
  doc(db, 'users', userId, 'pregnancy', 'current');

const subCollRef = (userId: string, sub: string) =>
  collection(db, 'users', userId, 'pregnancy', 'current', sub);

/**
 * Asigură că documentul-parent pregnancy/current există.
 * Fără el, orice addDoc în subcollecții eșuează cu PERMISSION_DENIED
 * sau NOT_FOUND în funcție de regulile Firestore.
 */
async function ensurePregnancyDoc(userId: string): Promise<void> {
  const ref = pregnancyRef(userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      isActive: true,
      babyName: '',
      gender: 'unknown',
      weekStarted: 0,
      bagChecklist: [],
      actsChecklist: [],
      nurseryChecklist: [],
    }, { merge: true });
  }
}

export const pregnancyService = {
  // --- Sarcina principală ---
  async getPregnancy(userId: string): Promise<Pregnancy | null> {
    const snap = await getDoc(pregnancyRef(userId));
    return snap.exists() ? (snap.data() as Pregnancy) : null;
  },

  async createPregnancy(userId: string, data: Partial<Pregnancy>): Promise<void> {
    await setDoc(pregnancyRef(userId), {
      ...data,
      isActive: true,
      bagChecklist: data.bagChecklist || [],
      actsChecklist: data.actsChecklist || [],
      nurseryChecklist: data.nurseryChecklist || [],
    });
  },

  async updatePregnancy(userId: string, data: Partial<Pregnancy>): Promise<void> {
    // setDoc cu merge=true evită eroarea "document does not exist"
    // dacă profilul nu a fost creat explicit încă
    await setDoc(pregnancyRef(userId), data, { merge: true });
  },

  // --- Weight logs ---
  async addWeightLog(userId: string, log: Omit<WeightLog, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'weight_logs'), log);
    return ref.id;
  },

  async getWeightLogs(userId: string): Promise<WeightLog[]> {
    const q = query(subCollRef(userId, 'weight_logs'), orderBy('week', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WeightLog));
  },

  // --- Symptoms ---
  async addSymptom(userId: string, symptom: Omit<Symptom, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'symptoms'), symptom);
    return ref.id;
  },

  async getSymptoms(userId: string, limitN = 50): Promise<Symptom[]> {
    const q = query(subCollRef(userId, 'symptoms'), orderBy('date', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Symptom));
  },

  // --- Mișcări fetale ---
  async getMovements(userId: string, limitN = 100): Promise<FetalMovement[]> {
    const q = query(subCollRef(userId, 'movements'), orderBy('date', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FetalMovement));
  },

  // --- Contracții ---
  async addContraction(userId: string, contraction: Omit<Contraction, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'contractions'), contraction);
    return ref.id;
  },

  async updateContraction(userId: string, id: string, data: Partial<Contraction>): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'pregnancy', 'current', 'contractions', id), data);
  },

  async getTodayContractions(userId: string): Promise<Contraction[]> {
    const q = query(subCollRef(userId, 'contractions'), orderBy('startTime', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contraction));
  },

  // --- Mișcări fetale ---
  async addMovement(userId: string, movement: Omit<FetalMovement, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'movements'), movement);
    return ref.id;
  },

  async getTodayMovements(userId: string): Promise<FetalMovement[]> {
    const q = query(subCollRef(userId, 'movements'), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FetalMovement));
  },

  // --- Programări ---
  async addAppointment(userId: string, apt: Omit<PregnancyAppointment, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'appointments'), apt);
    return ref.id;
  },

  async getAppointments(userId: string): Promise<PregnancyAppointment[]> {
    const q = query(subCollRef(userId, 'appointments'), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PregnancyAppointment));
  },

  async updateAppointment(userId: string, id: string, data: Partial<PregnancyAppointment>): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'pregnancy', 'current', 'appointments', id), data);
  },

  // --- Vitale ---
  async addVital(userId: string, vital: Omit<Vital, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'vitals'), vital);
    return ref.id;
  },

  async getVitals(userId: string, type?: Vital['type']): Promise<Vital[]> {
    const q = query(subCollRef(userId, 'vitals'), orderBy('date', 'desc'), limit(100));
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vital));
    return type ? all.filter((v) => v.type === type) : all;
  },

  // --- Jurnal ---
  async addJournalEntry(userId: string, entry: Omit<JournalEntry, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'journal'), entry);
    return ref.id;
  },

  async getJournalEntries(userId: string): Promise<JournalEntry[]> {
    const q = query(subCollRef(userId, 'journal'), orderBy('date', 'desc'), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as JournalEntry));
  },

  // --- Întrebări doctor ---
  async addQuestion(userId: string, question: Omit<DoctorQuestion, 'id'>): Promise<string> {
    await ensurePregnancyDoc(userId);
    const ref = await addDoc(subCollRef(userId, 'questions'), question);
    return ref.id;
  },

  async getQuestions(userId: string): Promise<DoctorQuestion[]> {
    const q = query(subCollRef(userId, 'questions'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DoctorQuestion));
  },

  async updateQuestion(userId: string, id: string, data: Partial<DoctorQuestion>): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'pregnancy', 'current', 'questions', id), data);
  },
};
