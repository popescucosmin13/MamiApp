import { collection, doc, setDoc, getDoc, getDocs, addDoc, query, orderBy, Timestamp, updateDoc, limit } from 'firebase/firestore';
import { db } from './firebase';
import { DiversificationProfile, IntroducedFood, MealEntry, FoodReaction, FoodRecord } from '../types/food';

export const foodService = {
  // --- Profile ---
  getProfile: async (userId: string, childId: string): Promise<DiversificationProfile | null> => {
    const docRef = doc(db, 'users', userId, 'diversification', childId, 'profile', 'main');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as DiversificationProfile;
  },

  upsertProfile: async (userId: string, childId: string, profile: Partial<DiversificationProfile>): Promise<void> => {
    const docRef = doc(db, 'users', userId, 'diversification', childId, 'profile', 'main');
    await setDoc(docRef, {
      ...profile,
      childId,
      userId,
      updatedAt: Timestamp.now(),
      createdAt: profile.createdAt || Timestamp.now(),
    }, { merge: true });
  },

  // --- Introduced Foods ---
  getIntroducedFoods: async (userId: string, childId: string, limitN = 100): Promise<IntroducedFood[]> => {
    const colRef = collection(db, 'users', userId, 'diversification', childId, 'foods');
    const q = query(colRef, orderBy('introducedAt', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as IntroducedFood));
  },

  addIntroducedFood: async (userId: string, childId: string, food: Omit<IntroducedFood, 'id'>): Promise<string> => {
    const colRef = collection(db, 'users', userId, 'diversification', childId, 'foods');
    const docRef = await addDoc(colRef, {
      ...food,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  updateIntroducedFood: async (userId: string, childId: string, foodId: string, updates: Partial<IntroducedFood>): Promise<void> => {
    const docRef = doc(db, 'users', userId, 'diversification', childId, 'foods', foodId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  // --- Meals ---
  getMeals: async (userId: string, childId: string, limitN = 120): Promise<MealEntry[]> => {
    const colRef = collection(db, 'users', userId, 'diversification', childId, 'meals');
    const q = query(colRef, orderBy('date', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealEntry));
  },

  addMeal: async (userId: string, childId: string, meal: Omit<MealEntry, 'id'>): Promise<string> => {
    const colRef = collection(db, 'users', userId, 'diversification', childId, 'meals');
    const docRef = await addDoc(colRef, {
      ...meal,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // --- Reactions ---
  getReactions: async (userId: string, childId: string, limitN = 50): Promise<FoodReaction[]> => {
    const colRef = collection(db, 'users', userId, 'diversification', childId, 'reactions');
    const q = query(colRef, orderBy('reactionAt', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FoodReaction));
  },

  addReaction: async (userId: string, childId: string, reaction: Omit<FoodReaction, 'id'>): Promise<string> => {
    const colRef = collection(db, 'users', userId, 'diversification', childId, 'reactions');
    const docRef = await addDoc(colRef, {
      ...reaction,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // (Legacy - keep just in case other parts of the app use it momentarily)
  addTestedFood: async (userId: string, childId: string, record: Omit<FoodRecord, 'id'>) => {
    const colRef = collection(db, 'users', userId, 'children', childId, 'foods');
    const docRef = await addDoc(colRef, {
      ...record,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  getTestedFoods: async (userId: string, childId: string, limitN = 100) => {
    const colRef = collection(db, 'users', userId, 'children', childId, 'foods');
    const q = query(colRef, orderBy('testedDate', 'desc'), limit(limitN));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FoodRecord[];
  }
};
