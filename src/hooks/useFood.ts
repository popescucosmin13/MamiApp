import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { useFoodStore } from '../stores/foodStore';
import { foodService } from '../services/foodService';

export function useFood() {
  const store = useFoodStore();
  return store;
}

export function useLoadFoodData() {
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const { setProfile, setIntroducedFoods, setMeals, setReactions, setLoading } = useFoodStore();
  
  const loadedChildId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !activeChild) return;

    const loadData = async () => {
      if (loadedChildId.current !== activeChild.id) {
        setLoading(true);
        try {
          const childOwnerId = activeChild.ownerId || user.uid;
          const [profile, foods, meals, reactions] = await Promise.all([
            foodService.getProfile(childOwnerId, activeChild.id),
            foodService.getIntroducedFoods(childOwnerId, activeChild.id),
            foodService.getMeals(childOwnerId, activeChild.id),
            foodService.getReactions(childOwnerId, activeChild.id),
          ]);
          setProfile(profile);
          setIntroducedFoods(foods);
          setMeals(meals);
          setReactions(reactions);
          loadedChildId.current = activeChild.id;
        } catch (e) {
          console.warn('Eroare la încărcarea datelor de diversificare:', e);
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [user, activeChild?.id]);
}
