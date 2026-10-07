import { useEffect } from 'react';
import { usePregnancyStore } from '../stores/pregnancyStore';
import { useAuthStore } from '../stores/authStore';
import { pregnancyService } from '../services/pregnancyService';
import { calculateCurrentWeek, getTrimester } from '../types/pregnancy';

export function usePregnancy() {
  const { pregnancy, weightLogs, symptoms, contractions, movements, appointments, isLoading } = usePregnancyStore();

  const currentWeek = pregnancy?.lmpDate
    ? calculateCurrentWeek(pregnancy.lmpDate.toDate())
    : null;
  const trimester = currentWeek ? getTrimester(currentWeek.week) : null;
  const weeksLeft = currentWeek ? 40 - currentWeek.week : null;
  const daysLeft = currentWeek && weeksLeft !== null
    ? weeksLeft * 7 - currentWeek.day
    : null;
  const progress = currentWeek ? Math.min((currentWeek.week / 40) * 100, 100) : 0;

  return {
    pregnancy,
    weightLogs,
    symptoms,
    contractions,
    movements,
    appointments,
    currentWeek,
    trimester,
    weeksLeft,
    daysLeft,
    progress,
    isLoading,
  };
}

export function useLoadPregnancyData() {
  const { user } = useAuthStore();
  const { setPregnancy, setWeightLogs, setSymptoms, setContractions, setMovements, setAppointments, setLoading, setHasLoaded } = usePregnancyStore();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // Loading vizibil doar la prima încărcare; la remount facem refresh
      // silențios ca să nu apară spinner peste datele deja afișate
      const showLoading = !usePregnancyStore.getState().hasLoaded;
      if (showLoading) setLoading(true);
      try {
        const [pregnancy, weightLogs, symptoms, contractions, movements, appointments] = await Promise.all([
          pregnancyService.getPregnancy(user.uid),
          pregnancyService.getWeightLogs(user.uid),
          pregnancyService.getSymptoms(user.uid),
          pregnancyService.getTodayContractions(user.uid),
          pregnancyService.getMovements(user.uid),
          pregnancyService.getAppointments(user.uid),
        ]);
        setPregnancy(pregnancy);
        setWeightLogs(weightLogs);
        setSymptoms(symptoms);
        setContractions(contractions);
        setMovements(movements);
        setAppointments(appointments);
        setHasLoaded(true);
      } finally {
        if (showLoading) setLoading(false);
      }
    };

    loadData();
  }, [user]);
}
