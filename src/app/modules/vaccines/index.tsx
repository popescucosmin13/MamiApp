import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { calculateAgeMonths } from '../../../types/child';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

// ─── Tipuri ─────────────────────────────────────────────────────────────────

interface VaccineDose {
  doseIndex: number;       // 0-based
  ageMonths: number;       // vârsta recomandată în luni
  ageLabel: string;        // ex: "2 luni", "naștere"
}

interface VaccineScheduleItem {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  doses: VaccineDose[];
}

interface CompletedDoseRecord {
  firestoreId: string;
  vaccineId: string;
  doseIndex: number;
  administeredAt: Timestamp;
  notes: string;
}

// ─── Calendar național de vaccinare România (INSP) ──────────────────────────

const VACCINE_SCHEDULE: VaccineScheduleItem[] = [
  {
    id: 'bcg',
    name: 'BCG',
    description: 'Bacil Calmette-Guérin — tuberculoză',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 0, ageLabel: 'naștere' },
    ],
  },
  {
    id: 'hepb',
    name: 'Hepatita B (HepB)',
    description: 'Vaccin hepatită B',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 0, ageLabel: 'naștere' },
      { doseIndex: 1, ageMonths: 2, ageLabel: '2 luni' },
      { doseIndex: 2, ageMonths: 6, ageLabel: '6 luni' },
    ],
  },
  {
    id: 'hexavalent',
    name: 'Hexavalent DTPa+VPI+Hib+HepB',
    description: 'Infanrix Hexa / Hexacima — difterie, tetanos, tuse convulsivă, polio, Hib, hepatită B',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 2, ageLabel: '2 luni' },
      { doseIndex: 1, ageMonths: 4, ageLabel: '4 luni' },
      { doseIndex: 2, ageMonths: 11, ageLabel: '11 luni' },
    ],
  },
  {
    id: 'vpc13',
    name: 'VPC13 — Pneumococ conjugat',
    description: 'Vaccin pneumococcic conjugat 13-valent',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 2, ageLabel: '2 luni' },
      { doseIndex: 1, ageMonths: 4, ageLabel: '4 luni' },
      { doseIndex: 2, ageMonths: 11, ageLabel: '11 luni' },
    ],
  },
  {
    id: 'vpo',
    name: 'VPO — Polio oral',
    description: 'Vaccin poliomielită oral',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 9, ageLabel: '9 luni' },
    ],
  },
  {
    id: 'ror',
    name: 'ROR — Rujeolă-Oreion-Rubeolă',
    description: 'Vaccin trivaccin rujeolă, oreion, rubeolă',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 12, ageLabel: '12 luni' },
      { doseIndex: 1, ageMonths: 60, ageLabel: '5 ani' },
    ],
  },
  {
    id: 'menc',
    name: 'Meningococ C',
    description: 'Vaccin meningococcic C conjugat',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 12, ageLabel: '12 luni' },
    ],
  },
  {
    id: 'dt',
    name: 'dT — Difterie-Tetanos adult',
    description: 'Rapel difterie-tetanos pentru copii mari',
    mandatory: true,
    doses: [
      { doseIndex: 0, ageMonths: 72, ageLabel: '6 ani' },
      { doseIndex: 1, ageMonths: 168, ageLabel: '14 ani' },
    ],
  },
  {
    id: 'varicela',
    name: 'Varicelă (VVZ)',
    description: 'Vaccin varicelă-zoster — opțional',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 12, ageLabel: '12 luni' },
      { doseIndex: 1, ageMonths: 15, ageLabel: '15 luni' },
    ],
  },
  {
    id: 'rotavirus',
    name: 'Rotavirus',
    description: 'Vaccin rotavirus oral — opțional',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 2, ageLabel: '2 luni' },
      { doseIndex: 1, ageMonths: 3, ageLabel: '3 luni' },
      { doseIndex: 2, ageMonths: 4, ageLabel: '4 luni' },
    ],
  },
  {
    id: 'hepa',
    name: 'Hepatita A',
    description: 'Vaccin hepatită A — opțional',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 12, ageLabel: '12 luni' },
      { doseIndex: 1, ageMonths: 18, ageLabel: '18 luni' },
    ],
  },
  {
    id: 'hpv',
    name: 'HPV',
    description: 'Vaccin papilomavirus uman — opțional, 11 ani',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 132, ageLabel: '11 ani' },
    ],
  },
  {
    id: 'gripa',
    name: 'Gripă (Influenza)',
    description: 'Vaccin gripal — anual, din 6 luni — opțional',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 6, ageLabel: 'de la 6 luni, anual' },
    ],
  },
  {
    id: 'menacwy',
    name: 'Meningococ ACWY',
    description: 'Vaccin meningococcic tetravalent — opțional',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 12, ageLabel: '12 luni' },
    ],
  },
  {
    id: 'ppv23',
    name: 'Pneumococ 23v (PPV23)',
    description: 'Vaccin pneumococcic polizaharidic 23-valent — opțional',
    mandatory: false,
    doses: [
      { doseIndex: 0, ageMonths: 24, ageLabel: '24 luni' },
    ],
  },
];

type TabKey = 'Obligatorii' | 'Opționale' | 'Toate';

function normalizeMasterVaccines(raw: any[]): VaccineScheduleItem[] {
  if (!raw.length) return VACCINE_SCHEDULE;

  const grouped = new Map<string, VaccineScheduleItem>();

  raw.forEach((item, index) => {
    const key = String(item.key || item.vaccineId || item.id || item.name || `vaccine_${index}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const type = item.type === 'recommended' || item.type === 'optional' ? 'recommended' : 'mandatory';
    const mandatory = item.mandatory ?? type === 'mandatory';
    const sourceDoses = Array.isArray(item.doses) && item.doses.length > 0
      ? item.doses
      : [{
          doseIndex: Number(item.doseIndex ?? 0),
          ageMonths: Number(item.ageMonths ?? 0),
          ageLabel: item.ageGroup || (Number(item.ageMonths ?? 0) === 0 ? 'naștere' : `${Number(item.ageMonths ?? 0)} luni`),
        }];
    const doses: VaccineDose[] = sourceDoses.map((dose: any, doseIndex: number) => ({
      doseIndex: Number(dose.doseIndex ?? doseIndex),
      ageMonths: Number(dose.ageMonths ?? item.ageMonths ?? 0),
      ageLabel: dose.ageLabel || item.ageGroup || `${Number(dose.ageMonths ?? item.ageMonths ?? 0)} luni`,
    }));

    const existing = grouped.get(key);
    if (existing) {
      doses.forEach((dose) => {
        if (!existing.doses.some((d) => d.doseIndex === dose.doseIndex)) {
          existing.doses.push(dose);
        }
      });
      existing.doses.sort((a, b) => a.ageMonths - b.ageMonths || a.doseIndex - b.doseIndex);
      return;
    }

    grouped.set(key, {
      id: key,
      name: item.name || 'Vaccin',
      description: item.description || '',
      mandatory,
      doses: doses.sort((a, b) => a.ageMonths - b.ageMonths || a.doseIndex - b.doseIndex),
    });
  });

  return Array.from(grouped.values()).sort((a, b) => a.doses[0].ageMonths - b.doses[0].ageMonths);
}

// ─── Component principal ─────────────────────────────────────────────────────

export default function VaccinesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();

  const [completedDoses, setCompletedDoses] = useState<CompletedDoseRecord[]>([]);
  const [vaccineSchedule, setVaccineSchedule] = useState<VaccineScheduleItem[]>(VACCINE_SCHEDULE);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('Toate');

  // Modal vaccin personalizat
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  const closeCustomModal = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowCustomModal(false);
  };

  // Vârsta copilului în luni
  const childAgeMonths: number = (() => {
    if (!activeChild?.birthDate) return 0;
    const bd = activeChild.birthDate instanceof Timestamp
      ? activeChild.birthDate.toDate()
      : new Date(activeChild.birthDate as any);
    return calculateAgeMonths(bd);
  })();

  // ─── Încarcă înregistrări din Firestore ───────────────────────────────────

  const loadVaccines = useCallback(async () => {
    if (!user || !activeChild?.id) {
      setIsLoading(false);
      return;
    }
    try {
      const [masterSnap, completedSnap] = await Promise.all([
        getDocs(query(collection(db, 'vaccines_master'), orderBy('ageMonths', 'asc'))),
        getDocs(
          query(
            collection(db, 'users', user.uid, 'children', activeChild.id, 'vaccines'),
            orderBy('administeredAt', 'desc')
          )
        ),
      ]);
      setVaccineSchedule(normalizeMasterVaccines(masterSnap.docs.map((d) => ({ id: d.id, ...d.data() }))));
      const records: CompletedDoseRecord[] = completedSnap.docs.map((d) => ({
        firestoreId: d.id,
        ...(d.data() as Omit<CompletedDoseRecord, 'firestoreId'>),
      }));
      setCompletedDoses(records);
    } catch {
      // Rămânem cu state gol
    } finally {
      setIsLoading(false);
    }
  }, [user, activeChild?.id]);

  useEffect(() => {
    loadVaccines();
  }, [loadVaccines]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const isDoseDone = (vaccineId: string, doseIndex: number): boolean =>
    completedDoses.some((r) => r.vaccineId === vaccineId && r.doseIndex === doseIndex);

  const getDoseRecord = (vaccineId: string, doseIndex: number): CompletedDoseRecord | undefined =>
    completedDoses.find((r) => r.vaccineId === vaccineId && r.doseIndex === doseIndex);

  const isUpcoming = (dose: VaccineDose): boolean => {
    const diff = dose.ageMonths - childAgeMonths;
    return diff >= 0 && diff <= 2; // în următoarele 60 de zile (~2 luni)
  };

  const isOverdue = (dose: VaccineDose): boolean =>
    dose.ageMonths < childAgeMonths && !isDoseDone('', dose.doseIndex);

  // ─── Marchează doză ca efectuată ──────────────────────────────────────────

  const markDose = async (vaccine: VaccineScheduleItem, dose: VaccineDose) => {
    if (!user || !activeChild?.id) return;
    if (isDoseDone(vaccine.id, dose.doseIndex)) return;

    // Optimistic update
    const optimisticRecord: CompletedDoseRecord = {
      firestoreId: `optimistic_${Date.now()}`,
      vaccineId: vaccine.id,
      doseIndex: dose.doseIndex,
      administeredAt: Timestamp.now(),
      notes: '',
    };
    setCompletedDoses((prev) => [...prev, optimisticRecord]);

    // Sync Firestore în background
    addDoc(
      collection(db, 'users', user.uid, 'children', activeChild.id, 'vaccines'),
      {
        vaccineId: vaccine.id,
        name: vaccine.name,
        type: vaccine.mandatory ? 'mandatory' : 'recommended',
        description: vaccine.description,
        ageMonths: dose.ageMonths,
        ageGroup: dose.ageLabel,
        doseIndex: dose.doseIndex,
        doseLabel: dose.ageLabel,
        administeredAt: Timestamp.now(),
        notes: '',
      }
    ).then((ref) => {
      // Înlocuim înregistrarea optimistă cu cea reală
      setCompletedDoses((prev) =>
        prev.map((r) =>
          r.firestoreId === optimisticRecord.firestoreId
            ? { ...r, firestoreId: ref.id }
            : r
        )
      );
    }).catch(() => {
      // Rollback la eroare
      setCompletedDoses((prev) =>
        prev.filter((r) => r.firestoreId !== optimisticRecord.firestoreId)
      );
      Alert.alert(t('common.error'), t('vaccines.save_dose_error'));
    });
  };

  // ─── Vaccin personalizat ──────────────────────────────────────────────────

  const saveCustomVaccine = async () => {
    if (!user || !activeChild?.id) return;
    if (!customName.trim()) {
      Alert.alert(t('vaccines.name_required_title'), t('vaccines.name_required_msg'));
      return;
    }

    setSavingCustom(true);
    const vaccineId = `custom_${Date.now()}`;

    // Parsăm data dacă e completată
    let administeredAt = Timestamp.now();
    if (customDate.trim()) {
      const parts = customDate.trim().split('.');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) {
          administeredAt = Timestamp.fromDate(parsed);
        }
      }
    }

    const optimisticRecord: CompletedDoseRecord = {
      firestoreId: `optimistic_${Date.now()}`,
      vaccineId,
      doseIndex: 0,
      administeredAt,
      notes: customNotes.trim(),
    };
    setCompletedDoses((prev) => [...prev, optimisticRecord]);

    try {
      const ref = await addDoc(
        collection(db, 'users', user.uid, 'children', activeChild.id, 'vaccines'),
        {
          vaccineId,
          name: customName.trim(),
          doseIndex: 0,
          doseLabel: 'personalizat',
          administeredAt,
          notes: customNotes.trim(),
          isCustom: true,
        }
      );
      setCompletedDoses((prev) =>
        prev.map((r) =>
          r.firestoreId === optimisticRecord.firestoreId
            ? { ...r, firestoreId: ref.id, vaccineId }
            : r
        )
      );
      closeCustomModal();
      setCustomName('');
      setCustomDate('');
      setCustomNotes('');
    } catch {
      setCompletedDoses((prev) =>
        prev.filter((r) => r.firestoreId !== optimisticRecord.firestoreId)
      );
      Alert.alert(t('common.error'), t('vaccines.custom_save_error'));
    } finally {
      setSavingCustom(false);
    }
  };

  // ─── Filtrare vaccinuri ───────────────────────────────────────────────────

  const filteredVaccines = vaccineSchedule.filter((v) => {
    if (activeTab === 'Obligatorii') return v.mandatory;
    if (activeTab === 'Opționale') return !v.mandatory;
    return true;
  });

  // ─── Statistici ───────────────────────────────────────────────────────────

  const totalDoses = vaccineSchedule.reduce((sum, v) => sum + v.doses.length, 0);
  const completedCount = vaccineSchedule.reduce(
    (sum, v) =>
      sum + v.doses.filter((d) => isDoseDone(v.id, d.doseIndex)).length,
    0
  );
  const completionPercent = totalDoses > 0 ? Math.round((completedCount / totalDoses) * 100) : 0;

  // Următorul vaccin neefectuat relevant
  const nextVaccine: { vaccine: VaccineScheduleItem; dose: VaccineDose } | null = (() => {
    const candidates: { vaccine: VaccineScheduleItem; dose: VaccineDose; diff: number }[] = [];
    for (const v of vaccineSchedule) {
      for (const d of v.doses) {
        if (!isDoseDone(v.id, d.doseIndex)) {
          candidates.push({ vaccine: v, dose: d, diff: d.ageMonths - childAgeMonths });
        }
      }
    }
    candidates.sort((a, b) => a.diff - b.diff);
    const next = candidates.find((c) => c.diff >= 0);
    return next ? { vaccine: next.vaccine, dose: next.dose } : null;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('vaccines.title')} 💉</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCustomModal(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Card progres */}
        <View style={[styles.progressCard, { backgroundColor: Colors.vaccine + '15' }]}>
          <View style={styles.progressTop}>
            <Text style={styles.progressTitle}>{t('vaccines.progress_title')}</Text>
            <Text style={[styles.progressPercent, { color: Colors.vaccine }]}>{completionPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${completionPercent}%` as any, backgroundColor: Colors.vaccine },
              ]}
            />
          </View>
          <Text style={styles.progressSub}>
            {t('vaccines.progress_sub', { completed: completedCount, total: totalDoses })}
          </Text>
        </View>

        {/* Alertă vaccin următor */}
        {nextVaccine && (
          <View style={styles.nextVaccineAlert}>
            <Text style={styles.nextVaccineEmoji}>
              {isUpcoming(nextVaccine.dose) ? '⚠️' : '📅'}
            </Text>
            <View style={styles.nextVaccineInfo}>
              <Text style={styles.nextVaccineLabel}>
                {isUpcoming(nextVaccine.dose) ? t('vaccines.soon') : t('vaccines.next')}
              </Text>
              <Text style={styles.nextVaccineName}>{nextVaccine.vaccine.name}</Text>
              <Text style={styles.nextVaccineAge}>{nextVaccine.dose.ageLabel}</Text>
            </View>
          </View>
        )}

        {/* Tab-uri filtrare */}
        <View style={styles.tabBar}>
          {(['Obligatorii', 'Opționale', 'Toate'] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'Obligatorii' ? t('vaccines.mandatory_tab') : tab === 'Opționale' ? t('vaccines.optional_tab') : t('vaccines.all_tab')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista vaccinuri */}
        {isLoading ? (
          <ActivityIndicator color={Colors.vaccine} style={{ marginTop: Spacing['2xl'] }} />
        ) : (
          <View style={styles.vaccineList}>
            {filteredVaccines.map((vaccine) => (
              <VaccineCard
                key={vaccine.id}
                vaccine={vaccine}
                childAgeMonths={childAgeMonths}
                isDoseDone={isDoseDone}
                getDoseRecord={getDoseRecord}
                isUpcoming={isUpcoming}
                onMarkDone={markDose}
                locale={i18n.language === 'en' ? 'en-US' : 'ro-RO'}
              />
            ))}

            {/* Buton vaccin personalizat */}
            <TouchableOpacity
              style={styles.customVaccineBtn}
              onPress={() => setShowCustomModal(true)}
            >
              <Text style={styles.customVaccineBtnText}>{t('vaccines.add_custom')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal vaccin personalizat */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        transparent
        onRequestClose={closeCustomModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('vaccines.custom_title')}</Text>
              <TouchableOpacity onPress={closeCustomModal}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{t('vaccines.custom_name_label')}</Text>
            <TextInput
              style={styles.input}
              value={customName}
              onChangeText={setCustomName}
              placeholder={t('vaccines.custom_name_placeholder')}
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.inputLabel}>{t('vaccines.custom_date_label')}</Text>
            <TextInput
              style={styles.input}
              value={customDate}
              onChangeText={setCustomDate}
              placeholder={t('vaccines.custom_date_placeholder')}
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{t('vaccines.custom_notes_label')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={customNotes}
              onChangeText={setCustomNotes}
              placeholder={t('vaccines.custom_notes_placeholder')}
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, savingCustom && styles.saveBtnDisabled]}
              onPress={saveCustomVaccine}
              disabled={savingCustom || !customName.trim()}
            >
              <Text style={styles.saveBtnText}>
                {savingCustom ? t('vaccines.saving') : t('vaccines.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Card vaccin ─────────────────────────────────────────────────────────────

interface VaccineCardProps {
  vaccine: VaccineScheduleItem;
  childAgeMonths: number;
  isDoseDone: (vaccineId: string, doseIndex: number) => boolean;
  getDoseRecord: (vaccineId: string, doseIndex: number) => CompletedDoseRecord | undefined;
  isUpcoming: (dose: VaccineDose) => boolean;
  onMarkDone: (vaccine: VaccineScheduleItem, dose: VaccineDose) => void;
  locale: string;
}

function VaccineCard({
  vaccine,
  childAgeMonths,
  isDoseDone,
  getDoseRecord,
  isUpcoming,
  onMarkDone,
  locale,
}: VaccineCardProps) {
  const { t } = useTranslation();
  const allDone = vaccine.doses.every((d) => isDoseDone(vaccine.id, d.doseIndex));
  const anyUpcoming = vaccine.doses.some((d) => isUpcoming(d) && !isDoseDone(vaccine.id, d.doseIndex));

  return (
    <View style={[styles.vaccineCard, allDone && styles.vaccineCardDone]}>
      <View style={styles.vaccineCardHeader}>
        <View style={styles.vaccineNameRow}>
          <Text style={styles.vaccineName}>{vaccine.name}</Text>
          {!vaccine.mandatory && (
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>{t('vaccines.optional')}</Text>
            </View>
          )}
          {anyUpcoming && (
            <View style={styles.upcomingBadge}>
              <Text style={styles.upcomingBadgeText}>{t('vaccines.soon')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.vaccineDescription}>{vaccine.description}</Text>
      </View>

      <View style={styles.doseList}>
        {vaccine.doses.map((dose) => {
          const done = isDoseDone(vaccine.id, dose.doseIndex);
          const record = getDoseRecord(vaccine.id, dose.doseIndex);
          const upcoming = isUpcoming(dose) && !done;
          const overdue = dose.ageMonths < childAgeMonths && !done;

          return (
            <View
              key={dose.doseIndex}
              style={[
                styles.doseRow,
                upcoming && styles.doseRowUpcoming,
                overdue && styles.doseRowOverdue,
              ]}
            >
              <TouchableOpacity
                style={[styles.doseCheckbox, done && styles.doseCheckboxDone]}
                onPress={() => !done && onMarkDone(vaccine, dose)}
                activeOpacity={done ? 1 : 0.7}
              >
                {done && <Text style={styles.doseCheckmark}>✓</Text>}
              </TouchableOpacity>

              <View style={styles.doseInfo}>
                <Text style={styles.doseLabel}>
                  {vaccine.doses.length > 1 ? t('vaccines.dose', { number: dose.doseIndex + 1 }) : t('vaccines.single_dose')} — {dose.ageLabel}
                </Text>
                {done && record && (
                  <Text style={styles.doseAdministered}>
                    {t('vaccines.administered', { date: record.administeredAt.toDate().toLocaleDateString(locale, {
                      day: 'numeric', month: 'long', year: 'numeric',
                    }) })}
                  </Text>
                )}
                {!done && upcoming && (
                  <Text style={styles.doseUpcomingText}>{t('vaccines.recommended_soon')}</Text>
                )}
                {!done && overdue && (
                  <Text style={styles.doseOverdueText}>{t('vaccines.overdue')}</Text>
                )}
              </View>

              {!done && (
                <TouchableOpacity
                  style={styles.markDoneBtn}
                  onPress={() => onMarkDone(vaccine, dose)}
                >
                  <Text style={styles.markDoneBtnText}>{t('vaccines.done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Stiluri ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.vaccine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 20, color: Colors.white, lineHeight: 24 },

  // Progres
  progressCard: {
    margin: Spacing.xl,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  progressPercent: { fontSize: 22, fontFamily: 'Geist-Bold' },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.white,
    borderRadius: 4,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressSub: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },

  // Next vaccine alert
  nextVaccineAlert: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.warning + '18',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  nextVaccineEmoji: { fontSize: 24 },
  nextVaccineInfo: { flex: 1 },
  nextVaccineLabel: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextVaccineName: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  nextVaccineAge: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },

  // Tab-uri
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.vaccine, borderColor: Colors.vaccine },
  tabText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },

  // Lista
  vaccineList: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },

  // Card vaccin
  vaccineCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  vaccineCardDone: {
    backgroundColor: Colors.vaccine + '08',
    borderWidth: 1,
    borderColor: Colors.vaccine + '30',
  },
  vaccineCardHeader: { marginBottom: Spacing.md },
  vaccineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  vaccineName: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  optionalBadge: {
    backgroundColor: Colors.amber + '25',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  optionalBadgeText: { fontSize: 10, fontFamily: 'Geist-SemiBold', color: Colors.amber },
  upcomingBadge: {
    backgroundColor: Colors.warning + '25',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  upcomingBadgeText: { fontSize: 10, fontFamily: 'Geist-SemiBold', color: Colors.warning },
  vaccineDescription: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 17 },

  // Doze
  doseList: { gap: Spacing.sm },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSoft,
  },
  doseRowUpcoming: {
    backgroundColor: Colors.warning + '12',
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  doseRowOverdue: {
    backgroundColor: Colors.error + '08',
    borderWidth: 1,
    borderColor: Colors.error + '20',
  },
  doseCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    flexShrink: 0,
  },
  doseCheckboxDone: {
    backgroundColor: Colors.vaccine,
    borderColor: Colors.vaccine,
  },
  doseCheckmark: { fontSize: 14, color: Colors.white, fontFamily: 'Geist-Bold' },
  doseInfo: { flex: 1 },
  doseLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  doseAdministered: { fontSize: 11, fontFamily: 'Geist', color: Colors.vaccine, marginTop: 1 },
  doseUpcomingText: { fontSize: 11, fontFamily: 'Geist', color: Colors.warning, marginTop: 1 },
  doseOverdueText: { fontSize: 11, fontFamily: 'Geist', color: Colors.error, marginTop: 1 },
  markDoneBtn: {
    backgroundColor: Colors.vaccine,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
  },
  markDoneBtnText: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.white },

  // Buton vaccin personalizat
  customVaccineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.vaccine,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  customVaccineBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.vaccine },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  modalClose: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.vaccine,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },
});
