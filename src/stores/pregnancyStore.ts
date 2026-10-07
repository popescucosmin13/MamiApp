import { create } from 'zustand';
import { Pregnancy, WeightLog, Symptom, Contraction, PregnancyAppointment, FetalMovement } from '../types/pregnancy';

interface PregnancyState {
  pregnancy: Pregnancy | null;
  weightLogs: WeightLog[];
  symptoms: Symptom[];
  contractions: Contraction[];
  movements: FetalMovement[];
  appointments: PregnancyAppointment[];
  activeContractionId: string | null;
  isLoading: boolean;
  /** True după ce prima încărcare s-a terminat (chiar dacă nu există sarcină).
   *  Previne flash-ul ecranului "adaugă sarcină" înainte de a ști dacă există date. */
  hasLoaded: boolean;
  setPregnancy: (pregnancy: Pregnancy | null) => void;
  setWeightLogs: (logs: WeightLog[]) => void;
  setSymptoms: (symptoms: Symptom[]) => void;
  setContractions: (contractions: Contraction[]) => void;
  setMovements: (movements: FetalMovement[]) => void;
  setAppointments: (appointments: PregnancyAppointment[]) => void;
  addSymptom: (symptom: Symptom) => void;
  addWeightLog: (log: WeightLog) => void;
  addContraction: (contraction: Contraction) => void;
  addMovement: (movement: FetalMovement) => void;
  setActiveContractionId: (id: string | null) => void;
  updatePregnancy: (data: Partial<Pregnancy>) => void;
  setLoading: (loading: boolean) => void;
  setHasLoaded: (hasLoaded: boolean) => void;
  reset: () => void;
}

export const usePregnancyStore = create<PregnancyState>((set) => ({
  pregnancy: null,
  weightLogs: [],
  symptoms: [],
  contractions: [],
  movements: [],
  appointments: [],
  activeContractionId: null,
  // Pornim în stare de încărcare: până la primul fetch nu știm dacă există sarcină,
  // altfel ecranul gol ("adaugă sarcină") apare pentru o fracțiune de secundă.
  isLoading: true,
  hasLoaded: false,
  setPregnancy: (pregnancy) => set({ pregnancy }),
  setWeightLogs: (weightLogs) => set({ weightLogs }),
  setSymptoms: (symptoms) => set({ symptoms }),
  setContractions: (contractions) => set({ contractions }),
  setMovements: (movements) => set({ movements }),
  setAppointments: (appointments) => set({ appointments }),
  addSymptom: (symptom) =>
    set((state) => ({ symptoms: [symptom, ...state.symptoms] })),
  addWeightLog: (log) =>
    set((state) => ({ weightLogs: [...state.weightLogs, log] })),
  addContraction: (contraction) =>
    set((state) => ({ contractions: [contraction, ...state.contractions] })),
  addMovement: (movement) =>
    set((state) => ({ movements: [movement, ...state.movements] })),
  setActiveContractionId: (activeContractionId) => set({ activeContractionId }),
  updatePregnancy: (data) =>
    set((state) => ({
      pregnancy: state.pregnancy ? { ...state.pregnancy, ...data } : null,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setHasLoaded: (hasLoaded) => set({ hasLoaded }),
  reset: () =>
    set({
      pregnancy: null,
      weightLogs: [],
      symptoms: [],
      contractions: [],
      movements: [],
      appointments: [],
      activeContractionId: null,
      isLoading: true,
      hasLoaded: false,
    }),
}));
