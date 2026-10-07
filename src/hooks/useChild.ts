import { useEffect, useRef } from 'react';
import { useChildStore } from '../stores/childStore';
import { useAuthStore } from '../stores/authStore';
import { childService } from '../services/childService';
import { feedingService } from '../services/feedingService';
import { sleepService } from '../services/sleepService';
import { diaperService } from '../services/diaperService';
import { growthService } from '../services/growthService';
import { foodService } from '../services/foodService';

export function useChild() {
  const { activeChild, feeds, sleeps, diapers, measurements, testedFoods, isLoading } = useChildStore();
  return { activeChild, feeds, sleeps, diapers, measurements, testedFoods, isLoading };
}

export function useLoadChildData() {
  const { user } = useAuthStore();
  const { activeChild, setActiveChild, setFeeds, setSleeps, setDiapers, setMeasurements, setTestedFoods, setLoading, markLoaded } = useChildStore();
  const loadedChildId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadData = async () => {
      let child = activeChild;

      // Dacă nu știm încă ce bebeluș e activ, îl aducem din DB
      if (!child && loadedChildId.current === null) {
        // Dacă o încărcare anterioară a stabilit deja că nu există copil,
        // nu mai pornim un loading nou (evită spinner la fiecare remount)
        if (useChildStore.getState().hasLoaded) return;
        setLoading(true);
        try {
          child = await childService.getActiveChild(user.uid);
        } catch {
          child = null;
        }
        if (!isMounted) return;
        setActiveChild(child);
        // Efectul va rula din nou automat când activeChild se schimbă
        if (!child) {
          markLoaded(null);
          setLoading(false);
        }
        return;
      }

      // Dacă s-a schimbat copilul, încărcăm datele lui specifice
      if (child && loadedChildId.current !== child.id) {
        // Loading vizibil doar dacă datele din store nu sunt ale acestui copil;
        // la remount pentru același copil facem refresh silențios (fără flash de spinner)
        const showLoading = useChildStore.getState().loadedDataChildId !== child.id;
        if (showLoading) setLoading(true);
        try {
          const childOwnerId = child.ownerId || user.uid;
          const [feeds, sleeps, diapers, measurements, testedFoods] = await Promise.all([
            feedingService.getRecentFeeds(childOwnerId, child.id),
            sleepService.getRecentSleeps(childOwnerId, child.id),
            diaperService.getRecentDiapers(childOwnerId, child.id),
            growthService.getMeasurements(childOwnerId, child.id),
            foodService.getTestedFoods(childOwnerId, child.id),
          ]);
          if (!isMounted) return;
          setFeeds(feeds);
          setSleeps(sleeps);
          setDiapers(diapers);
          setMeasurements(measurements);
          setTestedFoods(testedFoods);
          markLoaded(child.id);
          loadedChildId.current = child.id;
        } finally {
          if (isMounted && showLoading) setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [user, activeChild?.id]);
}
