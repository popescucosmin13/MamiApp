import { create } from 'zustand';
import { DiversificationProfile, IntroducedFood, MealEntry, FoodReaction } from '../types/food';

export interface WeeklySlot {
  day: number; // 0=Mon … 6=Sun
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: string[]; // food names
}

export interface WeeklyMenu {
  weekStart: string; // YYYY-MM-DD local (Monday)
  slots: WeeklySlot[];
}

interface FoodState {
  profile: DiversificationProfile | null;
  introducedFoods: IntroducedFood[];
  meals: MealEntry[];
  reactions: FoodReaction[];
  // weeklyMenus is keyed by YYYY-MM-DD (local Monday) so multiple weeks can coexist
  weeklyMenus: Record<string, WeeklyMenu>;
  isLoading: boolean;

  setProfile: (profile: DiversificationProfile | null) => void;
  setIntroducedFoods: (foods: IntroducedFood[]) => void;
  setMeals: (meals: MealEntry[]) => void;
  setReactions: (reactions: FoodReaction[]) => void;
  setLoading: (loading: boolean) => void;

  addIntroducedFood: (food: IntroducedFood) => void;
  addMeal: (meal: MealEntry) => void;
  addReaction: (reaction: FoodReaction) => void;
  updateIntroducedFood: (id: string, updates: Partial<IntroducedFood>) => void;
  updateMeal: (id: string, updates: Partial<MealEntry>) => void;
  // weekStart must be the local YYYY-MM-DD string for Monday of the target week
  updateWeeklySlot: (weekStart: string, day: number, mealType: WeeklySlot['mealType'], foods: string[]) => void;
  getWeeklyMenu: (weekStart: string) => WeeklyMenu | null;

  reset: () => void;
}

export const useFoodStore = create<FoodState>((set, get) => ({
  profile: null,
  introducedFoods: [],
  meals: [],
  reactions: [],
  weeklyMenus: {},
  isLoading: false,

  setProfile: (profile) => set({ profile }),
  setIntroducedFoods: (introducedFoods) => set({ introducedFoods }),
  setMeals: (meals) => set({ meals }),
  setReactions: (reactions) => set({ reactions }),
  setLoading: (isLoading) => set({ isLoading }),

  addIntroducedFood: (food) => set((state) => ({ introducedFoods: [food, ...state.introducedFoods] })),
  addMeal: (meal) => set((state) => ({ meals: [meal, ...state.meals] })),
  addReaction: (reaction) => set((state) => ({ reactions: [reaction, ...state.reactions] })),

  updateIntroducedFood: (id, updates) => set((state) => ({
    introducedFoods: state.introducedFoods.map(f => f.id === id ? { ...f, ...updates } : f),
  })),
  updateMeal: (id, updates) => set((state) => ({
    meals: state.meals.map(m => m.id === id ? { ...m, ...updates } : m),
  })),

  updateWeeklySlot: (weekStart, day, mealType, foods) => set((state) => {
    const existing = state.weeklyMenus[weekStart] ?? { weekStart, slots: [] };
    const otherSlots = existing.slots.filter(
      s => !(s.day === day && s.mealType === mealType),
    );
    const newSlots = foods.length > 0
      ? [...otherSlots, { day, mealType, foods }]
      : otherSlots;
    return {
      weeklyMenus: {
        ...state.weeklyMenus,
        [weekStart]: { weekStart, slots: newSlots },
      },
    };
  }),

  getWeeklyMenu: (weekStart) => get().weeklyMenus[weekStart] ?? null,

  reset: () => set({ profile: null, introducedFoods: [], meals: [], reactions: [], weeklyMenus: {} }),
}));
