import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

import { usePregnancy, useLoadPregnancyData } from '../../../hooks/usePregnancy';
import { usePregnancyStore } from '../../../stores/pregnancyStore';
import { useAuthStore } from '../../../stores/authStore';
import { pregnancyService } from '../../../services/pregnancyService';
import type { DoctorQuestion, JournalEntry, Vital } from '../../../types/pregnancy';
import { formatDate, formatDateShort } from '../../../lib/format';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { Typography } from '../../../theme/typography';
import {
  useTimerStore,
  getElapsedSeconds,
  isTimerPaused,
} from '../../../stores/timerStore';
import { getPregnancyData, getPregnancyWeekData } from '../../../data/pregnancy';
import type { WeekEntry, PregnancyData } from '../../../data/pregnancy';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const P = Colors.pregnancy;

const INTEN_COLORS: Record<number, string> = {
  1: Colors.success,
  2: '#A0C878',
  3: Colors.warning,
  4: '#E87050',
  5: Colors.error,
};

function formatContDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// ─── MOOD / SYMPTOMS ──────────────────────────────────────────────────────────
const MOODS = [
  { emoji: '😢', labelKey: 'pregnancy_screen.mood.sad', value: 'sad', color: '#6B7280' },
  { emoji: '😟', labelKey: 'pregnancy_screen.mood.worried', value: 'worried', color: '#8B5CF6' },
  { emoji: '😐', labelKey: 'pregnancy_screen.mood.neutral', value: 'neutral', color: '#9CA3AF' },
  { emoji: '🙂', labelKey: 'pregnancy_screen.mood.ok', value: 'ok', color: '#10B981' },
  { emoji: '😊', labelKey: 'pregnancy_screen.mood.happy', value: 'happy', color: '#F59E0B' },
  { emoji: '🤩', labelKey: 'pregnancy_screen.mood.amazing', value: 'amazing', color: '#EF4444' },
];

const SYMPTOM_OPTIONS = [
  'pregnancy_screen.symptoms.nausea', 'pregnancy_screen.symptoms.vomiting', 'pregnancy_screen.symptoms.fatigue', 'pregnancy_screen.symptoms.headache', 'pregnancy_screen.symptoms.back_pain',
  'pregnancy_screen.symptoms.cramps', 'pregnancy_screen.symptoms.bloating', 'pregnancy_screen.symptoms.heartburn', 'pregnancy_screen.symptoms.insomnia', 'pregnancy_screen.symptoms.dizziness',
  'pregnancy_screen.symptoms.edema', 'pregnancy_screen.symptoms.contractions', 'pregnancy_screen.symptoms.reduced_movements', 'pregnancy_screen.symptoms.bleeding',
];

function trimesterLabel(t: 1 | 2 | 3 | null, translate: (key: string) => string): string {
  if (t === 1) return translate('pregnancy_screen.trimester_1');
  if (t === 2) return translate('pregnancy_screen.trimester_2');
  if (t === 3) return translate('pregnancy_screen.trimester_3');
  return translate('pregnancy_screen.pregnancy');
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'week' | 'journal' | 'checklist' | 'doctor';

export default function PregnancyScreen() {
  const { t, i18n } = useTranslation();
  const pregData = getPregnancyData(i18n.language);
  useLoadPregnancyData();
  const router = useRouter();
  const { user } = useAuthStore();
  const { pregnancy, weightLogs, symptoms, appointments, currentWeek, trimester, daysLeft, isLoading } = usePregnancy();
  const { addWeightLog, addSymptom } = usePregnancyStore();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Journal state
  const [journalWeight, setJournalWeight] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [nauseaLevel, setNauseaLevel] = useState(0);
  const [journalNotes, setJournalNotes] = useState('');
  const [contractionsCount, setContractionsCount] = useState('');
  const [movementsCount, setMovementsCount] = useState('');
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [latestBloodPressure, setLatestBloodPressure] = useState<Vital | null>(null);

  // Checklist state
  const [t1Done, setT1Done] = useState<boolean[]>(pregData.CHECKLIST_T1.map(() => false));
  const [t2Done, setT2Done] = useState<boolean[]>(pregData.CHECKLIST_T2.map(() => false));
  const [t3Done, setT3Done] = useState<boolean[]>(pregData.CHECKLIST_T3.map(() => false));

  // Doctor state
  const [questions, setQuestions] = useState<DoctorQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loadingQ, setLoadingQ] = useState(false);

  // Week selector
  const [selectedWeek, setSelectedWeek] = useState(currentWeek?.week ?? 20);
  useEffect(() => {
    if (currentWeek) setSelectedWeek(currentWeek.week);
  }, [currentWeek?.week]);

  const loadJournal = useCallback(async () => {
    if (!user) return;
    setLoadingJournal(true);
    try {
      const entries = await pregnancyService.getJournalEntries(user.uid);
      setJournalEntries(entries);
    } finally {
      setLoadingJournal(false);
    }
  }, [user]);

  const loadQuestions = useCallback(async () => {
    if (!user) return;
    setLoadingQ(true);
    try {
      const q = await pregnancyService.getQuestions(user.uid);
      setQuestions(q);
    } finally {
      setLoadingQ(false);
    }
  }, [user]);

  const loadLatestBloodPressure = useCallback(async () => {
    if (!user) return;
    const vitals = await pregnancyService.getVitals(user.uid, 'blood_pressure');
    setLatestBloodPressure(vitals[0] ?? null);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'journal') loadJournal();
    if (activeTab === 'doctor') loadQuestions();
  }, [activeTab]);

  useEffect(() => {
    loadLatestBloodPressure();
  }, [loadLatestBloodPressure]);

  const saveJournal = async () => {
    if (!user) return;
    const hasAnyData = journalWeight || systolic || glucose || journalNotes ||
      selectedSymptoms.length > 0 || selectedMood || heartRate || sleepHours || nauseaLevel > 0;
    if (!hasAnyData) {
      Toast.show({ type: 'error', text1: t('pregnancy_screen.complete_one_field') });
      return;
    }
    setIsSavingJournal(true);
    try {
      const now = Timestamp.now();
      const week = currentWeek?.week ?? 0;

      if (journalWeight) {
        const wt = parseFloat(journalWeight.replace(',', '.'));
        if (!isNaN(wt)) {
          const log = { week, weight: wt, date: now };
          const id = await pregnancyService.addWeightLog(user.uid, log);
          addWeightLog({ ...log, id } as any);
        }
      }

      if (systolic && diastolic) {
        const bloodPressure: Omit<Vital, 'id'> = {
          date: now,
          type: 'blood_pressure',
          values: { systolic: parseInt(systolic, 10), diastolic: parseInt(diastolic, 10) },
        };
        const id = await pregnancyService.addVital(user.uid, bloodPressure);
        setLatestBloodPressure({ ...bloodPressure, id });
      }

      if (glucose) {
        await pregnancyService.addVital(user.uid, {
          date: now,
          type: 'glucose',
          values: { glucose: parseFloat(glucose) },
        });
      }

      for (const symptom of selectedSymptoms) {
        const s = { date: now, symptom, severity: 2 as const };
        const id = await pregnancyService.addSymptom(user.uid, s);
        addSymptom({ ...s, id } as any);
      }

      if (nauseaLevel > 0) {
        const s = { date: now, symptom: t('pregnancy_screen.symptoms.nausea'), severity: nauseaLevel as 1|2|3|4|5 };
        const id = await pregnancyService.addSymptom(user.uid, s);
        addSymptom({ ...s, id } as any);
      }

      if (heartRate) {
        const hr = parseInt(heartRate, 10);
        if (!isNaN(hr)) {
          await pregnancyService.addVital(user.uid, {
            date: now,
            type: 'heart_rate',
            values: { heartRate: hr },
          });
        }
      }

      if (sleepHours) {
        const sleep = parseFloat(sleepHours.replace(',', '.'));
        if (!isNaN(sleep)) {
          await pregnancyService.addVital(user.uid, {
            date: now,
            type: 'sleep',
            values: { sleepHours: sleep },
          });
        }
      }

      const contentParts: string[] = [];
      if (journalNotes) contentParts.push(journalNotes);
      if (journalWeight) contentParts.push(t('pregnancy_screen.content_weight', { value: journalWeight }));
      if (systolic && diastolic) contentParts.push(t('pregnancy_screen.content_bp', { systolic, diastolic }));
      if (glucose) contentParts.push(t('pregnancy_screen.content_glucose', { value: glucose }));
      if (nauseaLevel > 0) contentParts.push(t('pregnancy_screen.content_nausea', { value: nauseaLevel }));
      if (sleepHours) contentParts.push(t('pregnancy_screen.content_sleep', { value: sleepHours }));
      if (heartRate) contentParts.push(t('pregnancy_screen.content_pulse', { value: heartRate }));
      if (contractionsCount) contentParts.push(t('pregnancy_screen.content_contractions', { value: contractionsCount }));
      if (movementsCount) contentParts.push(t('pregnancy_screen.content_movements', { value: movementsCount }));
      if (selectedSymptoms.length > 0) contentParts.push(t('pregnancy_screen.content_symptoms', { value: selectedSymptoms.map((s) => t(s)).join(', ') }));
      
      const journalContent = contentParts.join('\n') || t('pregnancy_screen.default_journal');
      if (contentParts.length > 0 || selectedMood) {
        const payload: any = {
          date: now,
          content: journalContent,
        };
        if (selectedMood) {
          payload.mood = selectedMood;
        }
        await pregnancyService.addJournalEntry(user.uid, payload);
      }

      // Salvează mișcări fetale direct dacă este completat (pentru log dedicat)
      if (movementsCount) {
        const num = parseInt(movementsCount, 10);
        if (!isNaN(num) && num > 0) {
          await pregnancyService.addMovement(user.uid, {
            date: now,
            count: num,
            durationMinutes: 0
          });
        }
      }

      // Salvează contracții generice dacă este completat (durată 0, intensitate 3 default)
      if (contractionsCount) {
        const num = parseInt(contractionsCount, 10);
        if (!isNaN(num) && num > 0) {
          // Putem salva o intrare reprezentativă de contracție sau o ignorăm dacă e doar în jurnal
          // Am salvat-o deja ca notiță în jurnal, ceea ce este mai clar vizual pentru un număr agregat.
        }
      }

      Toast.show({ type: 'success', text1: t('pregnancy_screen.saved_success') });
      setJournalWeight(''); setSystolic(''); setDiastolic(''); setGlucose('');
      setHeartRate(''); setSleepHours(''); setSelectedMood(''); setSelectedSymptoms([]);
      setNauseaLevel(0); setJournalNotes(''); setContractionsCount(''); setMovementsCount('');
      loadJournal();
    } catch {
      Toast.show({ type: 'error', text1: t('pregnancy_screen.save_error'), text2: t('pregnancy_screen.check_connection') });
    } finally {
      setIsSavingJournal(false);
    }
  };

  const saveQuestion = async () => {
    if (!user || !newQuestion.trim()) return;
    try {
      const q: Omit<DoctorQuestion, 'id'> = {
        question: newQuestion.trim(),
        asked: false,
        createdAt: Timestamp.now(),
      };
      const id = await pregnancyService.addQuestion(user.uid, q);
      setQuestions(prev => [{ ...q, id }, ...prev]);
      setNewQuestion('');
      Toast.show({ type: 'success', text1: t('pregnancy_screen.question_added') });
    } catch {
      Toast.show({ type: 'error', text1: t('pregnancy_screen.save_error') });
    }
  };

  const markQuestionAsked = async (q: DoctorQuestion) => {
    if (!user || !q.id) return;
    await pregnancyService.updateQuestion(user.uid, q.id, { asked: true, askedAt: Timestamp.now() });
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, asked: true } : x));
  };

  const toggleChecklist = useCallback((t: 1 | 2 | 3, idx: number) => {
    if (t === 1) setT1Done(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; });
    if (t === 2) setT2Done(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; });
    if (t === 3) setT3Done(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; });
  }, []);

  const week = currentWeek?.week ?? 20;
  const day = currentWeek?.day ?? 0;
  // Calculate progress directly from displayed week (progress from hook is 0 when no Firestore data yet)
  const displayProgress = Math.min((week / 40) * 100, 100);
  const weekData = getPregnancyWeekData(week, i18n.language);
  const lastWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const nextAppointment = appointments.find(a => a.status === 'scheduled') ?? null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={P.primary} />
        <Text style={styles.loadingText}>{t('pregnancy_screen.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[P.primary, P.primaryDark]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('pregnancy_screen.title')}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {([ ['dashboard', '🏠', t('pregnancy_screen.tabs.dashboard')], ['week', '📅', t('pregnancy_screen.tabs.week')], ['journal', '📓', t('pregnancy_screen.tabs.journal')], ['checklist', '✅', t('pregnancy_screen.tabs.checklist')], ['doctor', '👩‍⚕️', t('pregnancy_screen.tabs.doctor')] ] as [Tab, string, string][]).map(([key, icon, label]) => (
            <TouchableOpacity key={key} onPress={() => setActiveTab(key)} style={[styles.tab, activeTab === key && styles.tabActive]}>
              <Text style={styles.tabIcon}>{icon}</Text>
              <Text style={[styles.tabLabel, activeTab === key && styles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' ? (
          <DashboardTab week={week} day={day} trimester={trimester} daysLeft={daysLeft} progress={displayProgress} weekData={weekData} lastWeight={lastWeight?.weight ?? null} latestBloodPressure={latestBloodPressure} nextAppointment={nextAppointment} router={router} user={user} />
        ) : null}
        {activeTab === 'week' ? (
          <WeekTab selectedWeek={selectedWeek} currentWeek={week} onSelectWeek={setSelectedWeek} />
        ) : null}
        {activeTab === 'journal' ? (
          <JournalTab
            journalWeight={journalWeight} setJournalWeight={setJournalWeight}
            systolic={systolic} setSystolic={setSystolic}
            diastolic={diastolic} setDiastolic={setDiastolic}
            glucose={glucose} setGlucose={setGlucose}
            heartRate={heartRate} setHeartRate={setHeartRate}
            sleepHours={sleepHours} setSleepHours={setSleepHours}
            selectedMood={selectedMood} setSelectedMood={setSelectedMood}
            selectedSymptoms={selectedSymptoms} setSelectedSymptoms={setSelectedSymptoms}
            nauseaLevel={nauseaLevel} setNauseaLevel={setNauseaLevel}
            contractionsCount={contractionsCount} setContractionsCount={setContractionsCount}
            movementsCount={movementsCount} setMovementsCount={setMovementsCount}
            journalNotes={journalNotes} setJournalNotes={setJournalNotes}
            onSave={saveJournal} isSaving={isSavingJournal}
            entries={journalEntries} loading={loadingJournal}
          />
        ) : null}
        {activeTab === 'checklist' ? (
          <ChecklistTab t1Done={t1Done} t2Done={t2Done} t3Done={t3Done} onToggle={toggleChecklist} />
        ) : null}
        {activeTab === 'doctor' ? (
          <DoctorTab
            questions={questions} newQuestion={newQuestion} setNewQuestion={setNewQuestion}
            onSave={saveQuestion} onMarkAsked={markQuestionAsked}
            loading={loadingQ} currentWeek={week} nextAppointment={nextAppointment}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ week, day, trimester, daysLeft, progress, weekData, lastWeight, latestBloodPressure, nextAppointment, router, user }: {
  week: number; day: number; trimester: 1 | 2 | 3 | null; daysLeft: number | null;
  progress: number; weekData: WeekEntry; lastWeight: number | null;
  latestBloodPressure: Vital | null; nextAppointment: any | null; router: any; user: any;
}) {
  const { t, i18n } = useTranslation();
  // ── Contracții inline ────────────────────────────────────────────────────
  const { contractions, movements, addContraction, addMovement: addMovementToStore } = usePregnancyStore();
  const { startTimer, stopTimer, pauseTimer, resumeTimer, getTimer } = useTimerStore();
  const [contractionIntensity, setContractionIntensity] = useState<1|2|3|4|5>(3);
  const [contrElapsed, setContrElapsed] = useState(0);
  const timer = getTimer('contraction');
  const paused = !!timer && isTimerPaused(timer);
  const isTracking = !!timer;

  useEffect(() => {
    if (!timer) { setContrElapsed(0); return; }
    const tick = () => {
      const t = useTimerStore.getState().getTimer('contraction');
      if (t) setContrElapsed(getElapsedSeconds(t));
    };
    tick();
    if (paused) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer?.id, paused, timer?.totalPausedMs]);

  const stopAndSaveContraction = async () => {
    if (!user || !timer) return;
    const startTs = Timestamp.fromMillis(timer.startTime);
    const endTs = Timestamp.now();
    const duration = contrElapsed;
    stopTimer(timer.id);
    try {
      const c = { startTime: startTs, endTime: endTs, duration, intensity: contractionIntensity };
      const id = await pregnancyService.addContraction(user.uid, c);
      addContraction({ ...c, id });
      Toast.show({ type: 'success', text1: t('pregnancy_screen.contraction_saved') });
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva contracția. Verificați conexiunea.');
    }
  };

  // ── Mișcări fetale inline ─────────────────────────────────────────────────
  const [savingMovement, setSavingMovement] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayStartMs = todayStart.getTime();
  const todayMovementsCount = movements
    .filter(m => m.date.toMillis() >= todayStartMs)
    .reduce((acc, m) => acc + m.count, 0);
  const bloodPressureValue = latestBloodPressure?.values.systolic && latestBloodPressure?.values.diastolic
    ? `${latestBloodPressure.values.systolic}/${latestBloodPressure.values.diastolic}`
    : '—';

  const addMovement = async () => {
    if (!user || savingMovement) return;
    setSavingMovement(true);
    try {
      const m = {
        date: Timestamp.now(),
        count: 1,
        durationMinutes: 0,
      };
      const id = await pregnancyService.addMovement(user.uid, m);
      addMovementToStore({ ...m, id });
      Toast.show({ type: 'success', text1: t('pregnancy_screen.movement_saved') });
    } catch {
      Toast.show({ type: 'error', text1: t('pregnancy_screen.save_error') });
    } finally {
      setSavingMovement(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  const QUICK_ACTIONS = [
    { icon: '📅', label: 'Programări', route: '/modules/appointments' },
    { icon: '🏥', label: 'Bagaj', route: '/modules/pregnancy/hospital-bag' },
    { icon: '📝', label: 'Plan naștere', route: '/modules/pregnancy/birth-plan' },
    { icon: '⏱️', label: 'Contracții', route: '/modules/pregnancy/contractions' },
    { icon: '🤱', label: 'Nutriție', route: '/modules/nutrition' },
    { icon: '🚨', label: 'Urgențe', route: '/modules/emergency' },
  ];

  const WATCH_SYMPTOMS = [
    'Sângerare vaginală abundentă',
    'Dureri abdominale intense și continue',
    'Contracții regulate înainte de 37 săpt.',
    'Febră peste 38°C',
    'Mișcări fetale reduse semnificativ',
    'Vedere încețoșată + durere de cap intensă',
    'Umflare bruscă a feței sau mâinilor',
    'Durere sau arsură intensă la urinare',
  ];

  const nextTasks: string[] = [];
  for (let w = week + 1; w < week + 3 && w <= 40; w++) {
    getPregnancyWeekData(w, i18n.language).checklist.slice(0, 2).forEach(t => nextTasks.push(t));
  }

  return (
    <View>
      {/* Hero */}
      <LinearGradient colors={[P.primary, P.primaryDark]} style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{trimesterLabel(trimester, t)}</Text>
        </View>
        <Text style={styles.heroWeek}>{t('pregnancy_screen.dashboard.week', { week })}</Text>
        <Text style={styles.heroDay}>{t('pregnancy_screen.dashboard.day', { day })}</Text>
        {daysLeft !== null && <Text style={styles.heroDays}>{t('pregnancy_screen.dashboard.days_left', { count: daysLeft })}</Text>}
        <ProgressBar progress={progress} color={Colors.white} trackColor="rgba(255,255,255,0.3)" height={6} showLabel style={styles.progressBar} />
      </LinearGradient>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>{t('pregnancy_screen.dashboard.quick_actions')}</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a, i) => (
          <TouchableOpacity key={i} style={styles.quickAction} onPress={() => router.push(a.route as any)}>
            <Text style={styles.quickIcon}>{a.icon}</Text>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⚖️</Text>
          <Text style={styles.statValue}>{lastWeight != null ? `${lastWeight} kg` : '—'}</Text>
          <Text style={styles.statLabel}>{t('pregnancy_screen.dashboard.weight')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💓</Text>
          <Text style={styles.statValue}>{bloodPressureValue}</Text>
          <Text style={styles.statLabel}>{t('pregnancy_screen.dashboard.bp')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statValue}>{nextAppointment ? formatDateShort(nextAppointment.date) : '—'}</Text>
          <Text style={styles.statLabel}>{t('pregnancy_screen.dashboard.next_appointment')}</Text>
        </View>
      </View>

      {/* Baby Card */}
      <View style={[styles.card, styles.babyCard]}>
        <Text style={styles.babyEmoji}>{weekData.babyEmoji}</Text>
        <View style={styles.babyInfo}>
          <Text style={styles.cardTitle}>{t('pregnancy_screen.dashboard.baby_title')}</Text>
          <Text style={styles.babySize}>{t('pregnancy_screen.week.fruit', { fruit: weekData.babyFruit })}</Text>
          <Text style={styles.babyDimensions}>{weekData.babyLength} · {weekData.babyWeight}</Text>
        </View>
      </View>

      {/* Baby development */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👶 {t('pregnancy_screen.week.baby_dev')}</Text>
        <Text style={styles.cardBody}>{weekData.baby}</Text>
      </View>

      {/* Mother */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤰 {t('pregnancy_screen.week.mother_changes')}</Text>
        <Text style={styles.cardBody}>{weekData.mother}</Text>
        <View style={styles.symptomList}>
          {weekData.symptoms.map((s: string, i: number) => (
            <Text key={i} style={styles.bulletItem}>• {s}</Text>
          ))}
        </View>
      </View>

      {/* Next 2 weeks */}
      {nextTasks.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 {t('pregnancy_screen.dashboard.next_tasks')}</Text>
          {nextTasks.map((t, i) => (
            <View key={i} style={styles.taskRow}>
              <Text style={styles.taskArrow}>→</Text>
              <Text style={styles.taskText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Contracții Card */}
      <View style={[styles.card, { borderWidth: isTracking ? 2 : 0, borderColor: isTracking ? Colors.error : 'transparent' }]}>
        <Text style={styles.cardTitle}>⏱️ Contracții</Text>
        <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
          <Text style={{ fontSize: 48, fontFamily: 'Geist-Bold',
            color: isTracking && !paused ? Colors.error : Colors.textPrimary }}>
            {formatContDuration(contrElapsed)}
          </Text>
          {paused && <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 2 }}>⏸ În pauză</Text>}
        </View>

        {!isTracking && (
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[styles.inputLabel, { textAlign: 'center' }]}>{t('pregnancy_screen.dashboard.intensity')}:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
              {([1,2,3,4,5] as const).map(lvl => (
                <TouchableOpacity key={lvl}
                  style={{ width: 36, height: 36, borderRadius: 18,
                    backgroundColor: contractionIntensity === lvl ? INTEN_COLORS[lvl] : Colors.backgroundSoft,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: contractionIntensity === lvl ? INTEN_COLORS[lvl] : Colors.border }}
                  onPress={() => setContractionIntensity(lvl)}>
                  <Text style={{ fontSize: 13, fontFamily: 'Geist-SemiBold',
                    color: contractionIntensity === lvl ? Colors.white : Colors.textSecondary }}>{lvl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!isTracking ? (
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.error }]}
            onPress={() => startTimer({ type: 'contraction', label: 'Contracție', startTime: Date.now() })}>
            <Text style={styles.saveBtnText}>▶ Start contracție</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1,
              backgroundColor: paused ? P.primary : Colors.warning }]}
              onPress={paused ? () => resumeTimer(timer!.id) : () => pauseTimer(timer!.id)}>
              <Text style={styles.saveBtnText}>{paused ? `▶ ${t('pregnancy_screen.dashboard.continue')}` : `⏸ ${t('pregnancy_screen.dashboard.pause')}`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: Colors.error }]}
              onPress={stopAndSaveContraction}>
              <Text style={styles.saveBtnText}>■ {t('pregnancy_screen.dashboard.stop_save')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {contractions.length > 0 && (
          <View style={{ marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <Text style={{ fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm }}>Ultimele contracții</Text>
            {contractions.slice(0, 3).map((c, i) => (
              <View key={c.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                <Text style={{ fontSize: 13, fontFamily: 'Geist', color: Colors.textPrimary }}>{formatDateShort(c.startTime)}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary }}>
                  {c.duration ? formatContDuration(c.duration) : '—'} • Int. {c.intensity}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={{ marginTop: Spacing.md, alignSelf: 'center' }}
          onPress={() => router.push('/modules/pregnancy/contractions' as any)}>
          <Text style={{ fontSize: 12, color: P.primary, fontFamily: 'Geist-SemiBold' }}>Deschide istoric complet →</Text>
        </TouchableOpacity>
      </View>

      {/* Mișcări fetale Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👶 {t('pregnancy_screen.dashboard.fetal_movements')}</Text>
        <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
          <Text style={{ fontSize: 52, fontFamily: 'Geist-Bold', color: P.primary }}>{todayMovementsCount}</Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, fontFamily: 'Geist' }}>kicks înregistrate azi</Text>
          {todayMovementsCount >= 10 && (
            <Text style={{ fontSize: 12, color: Colors.success, fontFamily: 'Geist-SemiBold', marginTop: 4 }}>
              ✅ Grozav! Bebelușul este activ.
            </Text>
          )}
          {todayMovementsCount > 0 && todayMovementsCount < 10 && (
            <Text style={{ fontSize: 12, color: Colors.warning, fontFamily: 'Geist', marginTop: 4 }}>
              {t('pregnancy_screen.dashboard.target')}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: savingMovement ? Colors.textTertiary : P.primary }]}
          onPress={addMovement}
          disabled={savingMovement}>
          {savingMovement
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.saveBtnText}>+ {t('pregnancy_screen.dashboard.add_movement')}</Text>}
        </TouchableOpacity>

        {movements.length > 0 && (
          <TouchableOpacity
            style={styles.historyLinkBtn}
            onPress={() => router.push('/modules/pregnancy/fetal-movements' as any)}
          >
            <Text style={styles.historyLinkText}>Deschide istoric complet →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Warning Card */}
      <View style={[styles.card, styles.warningCard]}>
        <Text style={[styles.cardTitle, { color: Colors.error }]}>⚠️ {t('pregnancy_screen.dashboard.call_doctor')}</Text>
        {WATCH_SYMPTOMS.map((s, i) => (
          <Text key={i} style={styles.warningItem}>• {s}</Text>
        ))}
      </View>

    </View>
  );
}

// ─── WEEK TAB ─────────────────────────────────────────────────────────────────
function WeekTab({ selectedWeek, currentWeek, onSelectWeek }: {
  selectedWeek: number; currentWeek: number; onSelectWeek: (w: number) => void;
}) {
  const { i18n } = useTranslation();
  const allWeeks = Object.keys(getPregnancyData(i18n.language).WEEKS).map(Number).sort((a, b) => a - b);
  const unlockedWeeks = allWeeks.filter((w) => w <= currentWeek).sort((a, b) => b - a);
  const lockedPreviewWeeks = allWeeks.filter((w) => w > currentWeek).slice(0, 4);
  const safeSelectedWeek = Math.max(4, Math.min(40, selectedWeek));
  const wd = getPregnancyWeekData(safeSelectedWeek, i18n.language);

  return (
    <View>
      <View style={styles.weekCurrentCard}>
        <Text style={styles.weekCurrentLabel}>Săptămâna activă</Text>
        <Text style={styles.weekCurrentValue}>Săptămâna {currentWeek}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={styles.weekScrollContent}>
        {unlockedWeeks.map(w => (
          <TouchableOpacity
            key={w}
            onPress={() => onSelectWeek(w)}
            style={[styles.weekPill, safeSelectedWeek === w && styles.weekPillActive, w === currentWeek && styles.weekPillCurrent]}
          >
            <Text style={[styles.weekPillText, safeSelectedWeek === w && styles.weekPillTextActive]}>{w}</Text>
          </TouchableOpacity>
        ))}
        {lockedPreviewWeeks.map(w => (
          <View key={`locked-${w}`} style={[styles.weekPill, styles.weekPillLocked]}>
            <Text style={styles.weekPillLockedText}>🔒</Text>
          </View>
        ))}
      </ScrollView>
      {lockedPreviewWeeks.length > 0 && (
        <Text style={styles.weekLockedHint}>Saptamanile urmatoare se deblocheaza pe parcurs.</Text>
      )}

      <LinearGradient colors={[P.primaryLight, Colors.white]} style={styles.weekHero}>
        <Text style={styles.weekHeroEmoji}>{wd.babyEmoji}</Text>
        <Text style={styles.weekHeroTitle}>Săptămâna {safeSelectedWeek}</Text>
        <Text style={styles.weekHeroFruit}>Cât un {wd.babyFruit}</Text>
        <View style={styles.weekDimRow}>
          <Text style={styles.weekDim}>{wd.babyLength}</Text>
          <Text style={styles.weekDimSep}> · </Text>
          <Text style={styles.weekDim}>{wd.babyWeight}</Text>
        </View>
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>👶 Dezvoltarea bebelușului</Text>
        <Text style={styles.cardBody}>{wd.baby}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤰 Schimbări la mamă</Text>
        <Text style={styles.cardBody}>{wd.mother}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💡 Sfaturi săptămâna aceasta</Text>
        {wd.tips.map((t, i) => (
          <Text key={i} style={styles.tipItem}>✓ {t}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>❓ Întrebări pentru medic</Text>
        {wd.doctorQuestions.map((q, i) => (
          <Text key={i} style={styles.tipItem}>? {q}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── JOURNAL TAB ──────────────────────────────────────────────────────────────
interface JournalTabProps {
  journalWeight: string; setJournalWeight: (v: string) => void;
  systolic: string; setSystolic: (v: string) => void;
  diastolic: string; setDiastolic: (v: string) => void;
  glucose: string; setGlucose: (v: string) => void;
  heartRate: string; setHeartRate: (v: string) => void;
  sleepHours: string; setSleepHours: (v: string) => void;
  selectedMood: string; setSelectedMood: (v: string) => void;
  selectedSymptoms: string[]; setSelectedSymptoms: (v: string[]) => void;
  nauseaLevel: number; setNauseaLevel: (v: number) => void;
  contractionsCount: string; setContractionsCount: (v: string) => void;
  movementsCount: string; setMovementsCount: (v: string) => void;
  journalNotes: string; setJournalNotes: (v: string) => void;
  onSave: () => void; isSaving: boolean;
  entries: JournalEntry[]; loading: boolean;
}

function JournalTab(props: JournalTabProps) {
  const { t } = useTranslation();
  const toggleSymptom = (s: string) => {
    if (props.selectedSymptoms.includes(s)) {
      props.setSelectedSymptoms(props.selectedSymptoms.filter(x => x !== s));
    } else {
      props.setSelectedSymptoms([...props.selectedSymptoms, s]);
    }
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 Adaugă intrare nouă</Text>

        <Text style={styles.inputLabel}>Greutate (kg)</Text>
        <TextInput style={styles.textInput} value={props.journalWeight} onChangeText={props.setJournalWeight} keyboardType="decimal-pad" placeholder="Ex: 68.5" placeholderTextColor={Colors.textTertiary} />

        <Text style={styles.inputLabel}>Tensiune arterială (mmHg)</Text>
        <View style={styles.inputRow}>
          <TextInput style={[styles.textInput, styles.inputHalf, { marginRight: Spacing.sm }]} value={props.systolic} onChangeText={props.setSystolic} keyboardType="number-pad" placeholder="Sistolică" placeholderTextColor={Colors.textTertiary} />
          <TextInput style={[styles.textInput, styles.inputHalf]} value={props.diastolic} onChangeText={props.setDiastolic} keyboardType="number-pad" placeholder="Diastolică" placeholderTextColor={Colors.textTertiary} />
        </View>

        <Text style={styles.inputLabel}>Glicemie (mg/dL)</Text>
        <TextInput style={styles.textInput} value={props.glucose} onChangeText={props.setGlucose} keyboardType="decimal-pad" placeholder="Ex: 90" placeholderTextColor={Colors.textTertiary} />

        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <Text style={styles.inputLabel}>Puls (bpm)</Text>
            <TextInput style={[styles.textInput, { marginRight: Spacing.sm }]} value={props.heartRate} onChangeText={props.setHeartRate} keyboardType="number-pad" placeholder="Ex: 80" placeholderTextColor={Colors.textTertiary} />
          </View>
          <View style={styles.inputHalf}>
            <Text style={styles.inputLabel}>Somn (ore)</Text>
            <TextInput style={styles.textInput} value={props.sleepHours} onChangeText={props.setSleepHours} keyboardType="decimal-pad" placeholder="Ex: 7.5" placeholderTextColor={Colors.textTertiary} />
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <Text style={styles.inputLabel}>Contracții (nr)</Text>
            <TextInput style={[styles.textInput, { marginRight: Spacing.sm }]} value={props.contractionsCount} onChangeText={props.setContractionsCount} keyboardType="number-pad" placeholder="Azi" placeholderTextColor={Colors.textTertiary} />
          </View>
          <View style={styles.inputHalf}>
            <Text style={styles.inputLabel}>Mișcări fetale (nr)</Text>
            <TextInput style={styles.textInput} value={props.movementsCount} onChangeText={props.setMovementsCount} keyboardType="number-pad" placeholder="Kicks" placeholderTextColor={Colors.textTertiary} />
          </View>
        </View>

        <Text style={styles.inputLabel}>Dispoziție</Text>
        <View style={styles.moodRow}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.value} onPress={() => props.setSelectedMood(m.value)} style={[styles.moodBtn, props.selectedMood === m.value && { backgroundColor: m.color + '22', borderColor: m.color }]}>
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={styles.moodLabel}>{t(m.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Simptome</Text>
        <View style={styles.chipGrid}>
          {SYMPTOM_OPTIONS.map(s => (
            <TouchableOpacity key={s} onPress={() => toggleSymptom(s)} style={[styles.chip, props.selectedSymptoms.includes(s) && styles.chipSelected]}>
              <Text style={[styles.chipText, props.selectedSymptoms.includes(s) && styles.chipTextSelected]}>{t(s)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Nivel greață (1-5)</Text>
        <View style={styles.nauseaRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => props.setNauseaLevel(props.nauseaLevel === n ? 0 : n)} style={[styles.nauseaBtn, props.nauseaLevel === n && styles.nauseaBtnSelected]}>
              <Text style={[styles.nauseaText, props.nauseaLevel === n && styles.nauseaTextSelected]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Note / Jurnal</Text>
        <TextInput style={[styles.textInput, styles.textarea]} value={props.journalNotes} onChangeText={props.setJournalNotes} placeholder="Cum te-ai simțit azi?" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />

        <TouchableOpacity style={[styles.saveBtn, props.isSaving && { opacity: 0.6 }]} onPress={props.onSave} disabled={props.isSaving}>
          {props.isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Salvează intrarea</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Istoricul intrărilor</Text>
      {props.loading ? (
        <ActivityIndicator color={P.primary} style={{ marginVertical: Spacing.xl }} />
      ) : props.entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📓</Text>
          <Text style={styles.emptyText}>Nicio intrare încă</Text>
        </View>
      ) : (
        props.entries.map((entry, i) => (
          <View key={entry.id ?? i} style={styles.timelineItem}>
            <View style={styles.timelineLine} />
            <View style={styles.timelineContent}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineDate}>{formatDate(entry.date)}</Text>
                {entry.mood && <Text style={styles.timelineMood}>{MOODS.find(m => m.value === entry.mood)?.emoji ?? ''}</Text>}
              </View>
              <Text style={styles.timelineBody}>{entry.content}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── CHECKLIST TAB ────────────────────────────────────────────────────────────
function ChecklistTab({ t1Done, t2Done, t3Done, onToggle }: {
  t1Done: boolean[]; t2Done: boolean[]; t3Done: boolean[];
  onToggle: (t: 1 | 2 | 3, idx: number) => void;
}) {
  const pct = (done: boolean[]) => Math.round((done.filter(Boolean).length / done.length) * 100);

  const renderSection = (items: string[], done: boolean[], t: 1 | 2 | 3) => (
    <View style={styles.card} key={t}>
      <Text style={styles.cardTitle}>Trimestrul {t}</Text>
      <ProgressBar progress={pct(done)} color={P.primary} trackColor={P.primaryLight} height={6} showLabel style={{ marginBottom: Spacing.md }} />
      {items.map((item, i) => (
        <TouchableOpacity key={i} onPress={() => onToggle(t, i)} style={styles.checkRow} activeOpacity={0.7}>
          <View style={[styles.checkbox, done[i] && styles.checkboxDone]}>
            {done[i] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.checkItem, done[i] && styles.checkItemDone]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const { i18n } = useTranslation();
  const pregData = getPregnancyData(i18n.language);

  return (
    <View>
      {renderSection(pregData.CHECKLIST_T1, t1Done, 1)}
      {renderSection(pregData.CHECKLIST_T2, t2Done, 2)}
      {renderSection(pregData.CHECKLIST_T3, t3Done, 3)}
    </View>
  );
}

// ─── DOCTOR TAB ───────────────────────────────────────────────────────────────
function DoctorTab({ questions, newQuestion, setNewQuestion, onSave, onMarkAsked, loading, currentWeek, nextAppointment }: {
  questions: DoctorQuestion[]; newQuestion: string; setNewQuestion: (v: string) => void;
  onSave: () => void; onMarkAsked: (q: DoctorQuestion) => void;
  loading: boolean; currentWeek: number; nextAppointment: any | null;
}) {
  const { i18n } = useTranslation();
  const suggested = getPregnancyWeekData(currentWeek, i18n.language).doctorQuestions;

  return (
    <View>
      {nextAppointment && (
        <View style={[styles.card, styles.appointmentCard]}>
          <Text style={styles.cardTitle}>📅 Următoarea programare</Text>
          <Text style={styles.appointmentDate}>{formatDate(nextAppointment.date)}</Text>
          <Text style={styles.appointmentType}>{nextAppointment.type}</Text>
          {nextAppointment.doctor && <Text style={styles.appointmentDoctor}>Dr. {nextAppointment.doctor}</Text>}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>➕ Adaugă întrebare</Text>
        <TextInput style={[styles.textInput, { marginBottom: Spacing.md }]} value={newQuestion} onChangeText={setNewQuestion} placeholder="Ce doriți să întrebați medicul?" placeholderTextColor={Colors.textTertiary} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveBtnText}>Adaugă</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💡 Întrebări sugerate (săpt. {currentWeek})</Text>
        {suggested.map((q, i) => (
          <Text key={i} style={styles.suggestedQ}>? {q}</Text>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Întrebările mele</Text>
      {loading ? (
        <ActivityIndicator color={P.primary} style={{ marginVertical: Spacing.xl }} />
      ) : questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>❓</Text>
          <Text style={styles.emptyText}>Nicio întrebare adăugată</Text>
        </View>
      ) : (
        questions.map((q, i) => (
          <View key={q.id ?? i} style={[styles.card, styles.questionCard, q.asked && styles.questionCardAsked]}>
            <Text style={[styles.questionText, q.asked && styles.questionTextAsked]}>{q.question}</Text>
            <View style={styles.questionFooter}>
              <Text style={styles.questionDate}>{formatDate(q.createdAt)}</Text>
              {!q.asked ? (
                <TouchableOpacity onPress={() => onMarkAsked(q)} style={styles.askedBtn}>
                  <Text style={styles.askedBtnText}>Marcat întrebat</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.askedBadge}>✓ Întrebat</Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.md },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 22, color: Colors.white },
  headerTitle: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.white, fontWeight: '600' },

  // Tab Bar
  tabBar: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadow.sm },
  tabScroll: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundSoft },
  tabActive: { backgroundColor: P.primary },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.white, fontWeight: '600' },

  // Content
  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg, paddingBottom: 48 },

  // Hero
  heroCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.md, ...Shadow.md },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
  heroBadgeText: { fontFamily: 'Geist', fontSize: 11, color: Colors.white, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' },
  heroWeek: { fontFamily: 'Fraunces', fontSize: 42, color: Colors.white, lineHeight: 50 },
  heroDay: { fontFamily: 'Geist', fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: Spacing.xs },
  heroDays: { fontFamily: 'Geist', fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: Spacing.lg },
  progressBar: { marginTop: Spacing.xs },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontFamily: 'Geist', fontSize: 13, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontFamily: 'Geist', fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Cards
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.sm },
  cardTitle: { fontFamily: 'Geist', fontSize: 15, color: Colors.textPrimary, fontWeight: '600', marginBottom: Spacing.sm },
  cardBody: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  // Baby card
  babyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  babyEmoji: { fontSize: 52 },
  babyInfo: { flex: 1 },
  babySize: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  babyDimensions: { fontFamily: 'Geist', fontSize: 13, color: P.primary, fontWeight: '600' },

  // Lists
  symptomList: { marginTop: Spacing.sm },
  bulletItem: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, marginBottom: 4, lineHeight: 20 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.xs },
  taskArrow: { fontFamily: 'Geist', fontSize: 14, color: P.primary, marginTop: 1 },
  taskText: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  // Warning
  warningCard: { borderLeftWidth: 3, borderLeftColor: Colors.error },
  warningItem: { fontFamily: 'Geist', fontSize: 13, color: Colors.textPrimary, marginBottom: 5, lineHeight: 20 },

  // Section
  sectionTitle: { fontFamily: 'Fraunces', fontSize: 18, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.sm },

  // Quick actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.sm, marginBottom: Spacing['2xl'] },
  quickAction: { width: '31%', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  quickIcon: { fontSize: 24, marginBottom: Spacing.xs },
  quickLabel: { fontFamily: 'Geist', fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  // Week tab
  weekCurrentCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderLeftWidth: 3, borderLeftColor: P.primary, ...Shadow.sm },
  weekCurrentLabel: { fontFamily: 'Geist', fontSize: 11, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  weekCurrentValue: { fontFamily: 'Fraunces', fontSize: 22, color: Colors.textPrimary, marginTop: 2 },
  weekScroll: { marginBottom: Spacing.md },
  weekScrollContent: { paddingVertical: Spacing.sm, gap: Spacing.xs },
  weekPill: { width: 44, height: 44, borderRadius: BorderRadius.full, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  weekPillActive: { backgroundColor: P.primary, borderColor: P.primary },
  weekPillCurrent: { borderColor: P.primaryDark, borderWidth: 2 },
  weekPillLocked: { backgroundColor: Colors.backgroundSoft, opacity: 0.65 },
  weekPillLockedText: { fontSize: 14, color: Colors.textTertiary },
  weekPillText: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary },
  weekPillTextActive: { color: Colors.white, fontWeight: '700' },
  weekLockedHint: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary, marginTop: -Spacing.xs, marginBottom: Spacing.md },
  weekHero: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md },
  weekHeroEmoji: { fontSize: 64, marginBottom: Spacing.sm },
  weekHeroTitle: { fontFamily: 'Fraunces', fontSize: 28, color: Colors.textPrimary, marginBottom: Spacing.xs },
  weekHeroFruit: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  weekDimRow: { flexDirection: 'row', alignItems: 'center' },
  weekDim: { fontFamily: 'Geist', fontSize: 15, color: P.primary, fontWeight: '600' },
  weekDimSep: { fontFamily: 'Geist', fontSize: 15, color: Colors.textTertiary },
  tipItem: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, marginBottom: 6, lineHeight: 20 },

  // Journal inputs
  inputLabel: { fontFamily: 'Geist', fontSize: 13, color: Colors.textPrimary, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.md },
  textInput: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.md, padding: Spacing.md, fontFamily: 'Geist', fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  inputRow: { flexDirection: 'row' },
  inputHalf: { flex: 1 },
  textarea: { minHeight: 88 },

  // Mood
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  moodBtn: { alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, minWidth: 50 },
  moodEmoji: { fontSize: 22 },
  moodLabel: { fontFamily: 'Geist', fontSize: 9, color: Colors.textSecondary, marginTop: 2 },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundSoft, borderWidth: 1, borderColor: Colors.border },
  chipSelected: { backgroundColor: P.primaryLight, borderColor: P.primary },
  chipText: { fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary },
  chipTextSelected: { color: P.primaryDark, fontWeight: '600' },

  // Nausea
  nauseaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  nauseaBtn: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  nauseaBtnSelected: { backgroundColor: P.primary, borderColor: P.primary },
  nauseaText: { fontFamily: 'Geist', fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  nauseaTextSelected: { color: Colors.white },

  // Save button
  saveBtn: { backgroundColor: P.primary, borderRadius: BorderRadius.full, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  saveBtnText: { fontFamily: 'Geist', fontSize: 15, color: Colors.white, fontWeight: '600' },
  historyLinkBtn: { marginTop: Spacing.md, alignSelf: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  historyLinkText: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: P.primary },
  movementDayGroup: { marginBottom: Spacing.sm },
  movementDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  movementDayLabel: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: Colors.textPrimary, textTransform: 'capitalize' },
  movementDayTotal: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: P.primary },
  movementHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  movementHistoryTime: { fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary },
  movementHistoryCount: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: Colors.textPrimary },

  // Timeline
  timelineItem: { flexDirection: 'row', marginBottom: Spacing.md },
  timelineLine: { width: 3, borderRadius: 2, backgroundColor: P.primaryLight, marginRight: Spacing.md },
  timelineContent: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.md, ...Shadow.sm },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  timelineDate: { fontFamily: 'Geist', fontSize: 12, color: P.primary, fontWeight: '600' },
  timelineMood: { fontSize: 18 },
  timelineBody: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  // Checklist
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: P.primary, justifyContent: 'center', alignItems: 'center', marginTop: 1, flexShrink: 0 },
  checkboxDone: { backgroundColor: P.primary },
  checkmark: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  checkItem: { fontFamily: 'Geist', fontSize: 13, color: Colors.textPrimary, flex: 1, lineHeight: 22 },
  checkItemDone: { color: Colors.textTertiary, textDecorationLine: 'line-through' },

  // Doctor
  appointmentCard: { borderLeftWidth: 3, borderLeftColor: P.primary },
  appointmentDate: { fontFamily: 'Fraunces', fontSize: 22, color: P.primary, marginBottom: 2 },
  appointmentType: { fontFamily: 'Geist', fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  appointmentDoctor: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary },
  suggestedQ: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: Spacing.xs, lineHeight: 20 },
  questionCard: { borderLeftWidth: 3, borderLeftColor: P.primary },
  questionCardAsked: { borderLeftColor: Colors.success, opacity: 0.75 },
  questionText: { fontFamily: 'Geist', fontSize: 14, color: Colors.textPrimary, marginBottom: Spacing.sm, lineHeight: 22 },
  questionTextAsked: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  questionFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionDate: { fontFamily: 'Geist', fontSize: 11, color: Colors.textTertiary },
  askedBtn: { backgroundColor: P.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  askedBtnText: { fontFamily: 'Geist', fontSize: 11, color: P.primaryDark, fontWeight: '600' },
  askedBadge: { fontFamily: 'Geist', fontSize: 11, color: Colors.success, fontWeight: '600' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyText: { fontFamily: 'Geist', fontSize: 15, color: Colors.textSecondary },
});
