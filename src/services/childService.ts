import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Child } from '../types/child';
import { VACCINE_CALENDAR_RO } from '../types/vaccines';
import { MILESTONES_MASTER } from '../types/milestones';

const childrenRef = (userId: string) => collection(db, 'users', userId, 'children');
const childRef = (userId: string, childId: string) =>
  doc(db, 'users', userId, 'children', childId);

export const childService = {
  async createChild(userId: string, data: Omit<Child, 'id'>): Promise<string> {
    const ref = await addDoc(childrenRef(userId), {
      ...data,
      isActive: true,
    });
    return ref.id;
  },

  async createOrGetChild(userId: string, data: Omit<Child, 'id'>): Promise<string> {
    const existing = await childService.getAllChildren(userId);
    const birthMs = data.birthDate.toMillis();
    const match = existing.find((child) => (
      child.name.trim().toLowerCase() === data.name.trim().toLowerCase()
      && child.birthDate?.toMillis?.() === birthMs
    ));
    if (match) return match.id;
    return childService.createChild(userId, data);
  },

  async getActiveChild(userId: string): Promise<Child | null> {
    const q = query(childrenRef(userId), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ownerId: userId, ...d.data() } as Child;
    }
    const allChildren = await childService.getAllChildren(userId);
    return allChildren[0] ?? null;
  },

  async getAllChildren(userId: string): Promise<Child[]> {
    const ownSnap = await getDocs(childrenRef(userId));
    const ownChildren = ownSnap.docs
      .map((d) => ({ id: d.id, ownerId: userId, ...d.data() } as Child & { deletedAt?: unknown }))
      .filter((child) => !child.deletedAt);

    const sharedSnap = await getDocs(collection(db, 'users', userId, 'shared_children'));
    const memberships = sharedSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          ownerId: data.ownerId as string | undefined,
          childId: data.childId as string | undefined,
          status: data.status,
          inviteStatus: data.inviteStatus,
        };
      })
      .filter((item) => (
        item.ownerId
        && item.childId
        && item.ownerId !== userId
        && ['active', 'accepted'].includes(String(item.status || 'active'))
        && String(item.inviteStatus || 'accepted') === 'accepted'
      ));

    const sharedResults = await Promise.allSettled(memberships.map(async (membership, index) => {
      const snap = await getDoc(childRef(membership.ownerId!, membership.childId!));
      if (!snap.exists()) return null;
      const data = snap.data() as Child & { deletedAt?: unknown };
      if (data.deletedAt) return null;
      return {
        ownerId: membership.ownerId,
        isShared: true,
        ...data,
        id: snap.id,
        isActive: ownChildren.length === 0 && index === 0,
      } as Child;
    }));

    const sharedChildren = sharedResults
      .filter((r): r is PromiseFulfilledResult<Child | null> => r.status === 'fulfilled')
      .map((r) => r.value);

    return [
      ...ownChildren,
      ...sharedChildren.filter((child): child is Child => Boolean(child)),
    ];
  },

  async updateChild(userId: string, childId: string, data: Partial<Child>): Promise<void> {
    await updateDoc(childRef(userId, childId), data);
  },

  async archiveChild(userId: string, childId: string): Promise<void> {
    await updateDoc(childRef(userId, childId), {
      isActive: false,
      deletedAt: serverTimestamp(),
    } as any);
  },

  async setActiveChild(userId: string, childId: string): Promise<void> {
    const allChildren = await childService.getAllChildren(userId);
    const batch = writeBatch(db);
    allChildren.forEach((child) => {
      batch.update(childRef(userId, child.id), { isActive: child.id === childId });
    });
    await batch.commit();
  },

  async initializeVaccines(userId: string, childId: string, birthDate: Date): Promise<void> {
    const batch = writeBatch(db);
    const vaccinesRef = collection(db, 'users', userId, 'children', childId, 'vaccines');
    const existingVaccines = await getDocs(vaccinesRef);
    if (!existingVaccines.empty) return;
    
    let masterVaccines: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'vaccines_master'));
      if (!snap.empty) {
        masterVaccines = snap.docs.map(d => d.data());
      } else {
        masterVaccines = VACCINE_CALENDAR_RO;
      }
    } catch (e) {
      console.warn('Failed to fetch vaccines_master, using fallback', e);
      masterVaccines = VACCINE_CALENDAR_RO;
    }

    masterVaccines.forEach((vaccine) => {
      const doses = Array.isArray(vaccine.doses) && vaccine.doses.length > 0
        ? vaccine.doses
        : [{
            doseIndex: vaccine.doseIndex ?? 0,
            ageMonths: vaccine.ageMonths ?? 0,
            ageLabel: vaccine.ageGroup || `${vaccine.ageMonths ?? 0} luni`,
          }];

      doses.forEach((dose: any, index: number) => {
      const ageMonths = Number(dose.ageMonths ?? vaccine.ageMonths ?? 0);
      const scheduledDate = new Date(birthDate);
      scheduledDate.setMonth(scheduledDate.getMonth() + ageMonths);
      const vaccineRef = doc(vaccinesRef);
      batch.set(vaccineRef, {
        vaccineId: vaccine.key || vaccine.vaccineId || vaccine.name,
        name: vaccine.name,
        type: vaccine.type === 'optional' ? 'recommended' : vaccine.type,
        ageGroup: dose.ageLabel || vaccine.ageGroup || `${ageMonths} luni`,
        ageMonths,
        doseIndex: Number(dose.doseIndex ?? index),
        doseLabel: dose.ageLabel || vaccine.ageGroup || `${ageMonths} luni`,
        scheduledDate: Timestamp.fromDate(scheduledDate),
        status: 'pending',
        description: vaccine.description || '',
        sideEffects: vaccine.sideEffects || [],
      });
      });
    });
    await batch.commit();
  },

  // Auto-populează milestone-urile la crearea copilului
  async initializeMilestones(userId: string, childId: string): Promise<void> {
    const batch = writeBatch(db);
    const milestonesRef = collection(db, 'users', userId, 'children', childId, 'milestones');
    const existingMilestones = await getDocs(milestonesRef);
    const existingKeys = new Set(
      existingMilestones.docs
        .map((docSnap) => docSnap.data().key)
        .filter((key): key is string => typeof key === 'string' && key.length > 0)
    );
    let added = 0;
    MILESTONES_MASTER.forEach((ms) => {
      if (existingKeys.has(ms.key)) return;
      const msRef = doc(milestonesRef);
      batch.set(msRef, {
        key: ms.key,
        category: ms.category,
        title: ms.title_ro,
        expectedAge: ms.expectedAgeMonths,
        achievedDate: null,
        description: ms.description,
        howToStimulate: ms.howToStimulate,
        redFlag: ms.redFlag,
      });
      added += 1;
    });
    if (added > 0) {
      await batch.commit();
    }
  },

  async getMilestones(userId: string, childId: string): Promise<any[]> {
    const milestonesRef = collection(db, 'users', userId, 'children', childId, 'milestones');
    await childService.initializeMilestones(userId, childId);
    const snap = await getDocs(milestonesRef);

    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => Number(a.expectedAge ?? 0) - Number(b.expectedAge ?? 0));
  },

  async achieveMilestone(userId: string, childId: string, milestoneId: string, achievedDate: Timestamp): Promise<void> {
    const msRef = doc(db, 'users', userId, 'children', childId, 'milestones', milestoneId);
    await updateDoc(msRef, { achievedDate });
  },
};
