import { create } from 'zustand';
import { Child } from '../types/child';
import { FeedRecord } from '../types/feeding';
import { SleepRecord } from '../types/sleep';
import { DiaperRecord } from '../types/diapers';
import { MeasurementRecord } from '../types/growth';
import { FoodRecord } from '../types/food';

interface ChildState {
  activeChild: Child | null;
  children: Child[];
  feeds: FeedRecord[];
  sleeps: SleepRecord[];
  diapers: DiaperRecord[];
  measurements: MeasurementRecord[];
  testedFoods: FoodRecord[];
  isLoading: boolean;
  /** True după ce prima încărcare s-a terminat (chiar dacă nu există copil).
   *  Previne flash-ul ecranului "adaugă bebeluș" înainte de a ști dacă există date. */
  hasLoaded: boolean;
  /** ID-ul copilului pentru care datele (feeds/sleeps/...) sunt deja în store.
   *  Remount-urile pentru același copil fac refresh silențios, fără spinner. */
  loadedDataChildId: string | null;
  activeFeedId: string | null; // timer-ul curent
  activeSleepId: string | null;
  setActiveChild: (child: Child | null) => void;
  setChildren: (children: Child[]) => void;
  setFeeds: (feeds: FeedRecord[]) => void;
  setSleeps: (sleeps: SleepRecord[]) => void;
  setDiapers: (diapers: DiaperRecord[]) => void;
  setMeasurements: (measurements: MeasurementRecord[]) => void;
  setTestedFoods: (testedFoods: FoodRecord[]) => void;
  addFeed: (feed: FeedRecord) => void;
  addSleep: (sleep: SleepRecord) => void;
  addDiaper: (diaper: DiaperRecord) => void;
  addTestedFood: (food: FoodRecord) => void;
  updateFeed: (id: string, updates: Partial<FeedRecord>) => void;
  updateSleep: (id: string, updates: Partial<SleepRecord>) => void;
  updateDiaper: (id: string, updates: Partial<DiaperRecord>) => void;
  removeFeed: (id: string) => void;
  removeSleep: (id: string) => void;
  removeDiaper: (id: string) => void;
  setActiveFeedId: (id: string | null) => void;
  setActiveSleepId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  /** Marchează finalizarea unei încărcări: childId al datelor din store sau null dacă nu există copil. */
  markLoaded: (childId: string | null) => void;
  reset: () => void;

}

export const useChildStore = create<ChildState>((set) => ({
  activeChild: null,
  children: [],
  feeds: [],
  sleeps: [],
  diapers: [],
  measurements: [],
  testedFoods: [],
  // Pornim în stare de încărcare: până la primul fetch nu știm dacă există copil,
  // altfel ecranul gol ("adaugă bebeluș") apare pentru o fracțiune de secundă.
  isLoading: true,
  hasLoaded: false,
  loadedDataChildId: null,
  activeFeedId: null,
  activeSleepId: null,
  setActiveChild: (activeChild) => set({ activeChild }),
  setChildren: (children) => set({ children }),
  setFeeds: (feeds) => set({ feeds }),
  setSleeps: (sleeps) => set({ sleeps }),
  setDiapers: (diapers) => set({ diapers }),
  setMeasurements: (measurements) => set({ measurements }),
  setTestedFoods: (testedFoods) => set({ testedFoods }),
  // Optimistic update — adaugă imediat în state local
  addFeed: (feed) => set((state) => ({ feeds: [feed, ...state.feeds] })),
  addSleep: (sleep) => set((state) => ({ sleeps: [sleep, ...state.sleeps] })),
  addDiaper: (diaper) => set((state) => ({ diapers: [diaper, ...state.diapers] })),
  addTestedFood: (food) => set((state) => ({ testedFoods: [food, ...state.testedFoods] })),
  updateFeed: (id, updates) => set((state) => ({
    feeds: state.feeds.map((feed) => (feed.id === id ? { ...feed, ...updates } : feed)),
  })),
  updateSleep: (id, updates) => set((state) => ({
    sleeps: state.sleeps.map((sleep) => (sleep.id === id ? { ...sleep, ...updates } : sleep)),
  })),
  updateDiaper: (id, updates) => set((state) => ({
    diapers: state.diapers.map((diaper) => (diaper.id === id ? { ...diaper, ...updates } : diaper)),
  })),
  // Ștergere optimistă din state local
  removeFeed: (id) => set((state) => ({ feeds: state.feeds.filter(f => f.id !== id) })),
  removeSleep: (id) => set((state) => ({ sleeps: state.sleeps.filter(s => s.id !== id) })),
  removeDiaper: (id) => set((state) => ({ diapers: state.diapers.filter(d => d.id !== id) })),
  setActiveFeedId: (activeFeedId) => set({ activeFeedId }),
  setActiveSleepId: (activeSleepId) => set({ activeSleepId }),
  setLoading: (isLoading) => set({ isLoading }),
  markLoaded: (childId) => set({ hasLoaded: true, loadedDataChildId: childId }),
  reset: () =>
    set({
      activeChild: null,
      children: [],
      feeds: [],
      sleeps: [],
      diapers: [],
      measurements: [],
      testedFoods: [],
      isLoading: true,
      hasLoaded: false,
      loadedDataChildId: null,
      activeFeedId: null,
      activeSleepId: null,
    }),
}));
