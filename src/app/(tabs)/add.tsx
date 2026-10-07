import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useChild, useLoadChildData } from '../../hooks/useChild';
import { usePregnancy, useLoadPregnancyData } from '../../hooks/usePregnancy';
import { useAccessControl } from '../../hooks/useAccessControl';
import { useChildStore } from '../../stores/childStore';
import { usePregnancyStore } from '../../stores/pregnancyStore';
import { useQuickTimerStore, type TimerKey } from '../../stores/quickTimerStore';
import { feedingService } from '../../services/feedingService';
import { sleepService } from '../../services/sleepService';
import { diaperService } from '../../services/diaperService';
import { growthService } from '../../services/growthService';
import { pregnancyService } from '../../services/pregnancyService';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickAction =
  | 'breastfeeding' | 'bottle' | 'solid'
  | 'diaper' | 'sleep' | 'growth'
  | 'movement' | 'blood_pressure' | 'pregnancy_weight'
  | 'glucose' | 'symptom' | 'appointment' | 'journal';

interface ActionCard {
  key: QuickAction;
  moduleId: string;
  label: string;
  hint: string;
  emoji: string;
  color: string;
  colorDark: string;
}

// ─── Action Definitions ───────────────────────────────────────────────────────

function getChildActions(t: (k: string) => string): ActionCard[] {
  return [
    { key: 'breastfeeding', moduleId: 'feeding',  label: t('add.breastfeeding_label'), hint: t('add.breastfeeding_hint'), emoji: '🤱', color: Colors.feeding,          colorDark: Colors.feeding },
    { key: 'bottle',        moduleId: 'feeding',  label: t('add.bottle_label'),        hint: t('add.bottle_hint'),        emoji: '🍼', color: Colors.feeding,          colorDark: Colors.feeding },
    { key: 'solid',         moduleId: 'food',     label: t('add.solid_label'),         hint: t('add.solid_hint'),         emoji: '🥣', color: Colors.food,             colorDark: Colors.food },
    { key: 'diaper',        moduleId: 'diapers',  label: t('add.diaper_label'),        hint: t('add.diaper_hint'),        emoji: '🧷', color: Colors.diaper,           colorDark: Colors.diaper },
    { key: 'sleep',         moduleId: 'sleep',    label: t('add.sleep_label'),         hint: t('add.sleep_hint'),         emoji: '😴', color: Colors.sleep,            colorDark: Colors.sleep },
    { key: 'growth',        moduleId: 'growth',   label: t('add.growth_label'),        hint: t('add.growth_hint'),        emoji: '📏', color: Colors.growth,           colorDark: Colors.growth },
  ];
}

function getPregnancyActions(t: (k: string) => string): ActionCard[] {
  return [
    { key: 'movement',         moduleId: 'fetal_movements', label: t('add.movement_label'),       hint: t('add.movement_hint'),        emoji: '👶', color: Colors.pregnancy.primary,    colorDark: Colors.pregnancy.primaryDark },
    { key: 'blood_pressure',   moduleId: 'pregnancy',       label: t('add.blood_pressure_label'), hint: t('add.blood_pressure_hint'),  emoji: '❤️', color: '#64748B',                    colorDark: '#475569' },
    { key: 'pregnancy_weight', moduleId: 'pregnancy',       label: t('add.preg_weight_label'),    hint: t('add.preg_weight_hint'),     emoji: '⚖️', color: Colors.pregnancy.primaryDark, colorDark: Colors.pregnancy.primaryDark },
    { key: 'glucose',          moduleId: 'pregnancy',       label: t('add.glucose_label'),        hint: t('add.glucose_hint'),         emoji: '🍬', color: Colors.error,                 colorDark: '#B91C1C' },
    { key: 'symptom',          moduleId: 'pregnancy',       label: t('add.symptom_label'),        hint: t('add.symptom_hint'),         emoji: '🤢', color: Colors.warning,               colorDark: '#B45309' },
    { key: 'journal',          moduleId: 'pregnancy',       label: t('add.journal_label'),        hint: t('add.journal_hint'),         emoji: '📓', color: Colors.taupe,                 colorDark: Colors.taupe },
    { key: 'appointment',      moduleId: 'appointments',    label: t('add.appointment_label'),    hint: t('add.appointment_hint'),     emoji: '📅', color: '#64748B',                    colorDark: '#475569' },
  ];
}

function getDiaperOptions(t: (k: string) => string) {
  return [
    { value: 'wet',   label: t('add.diaper_wet') },
    { value: 'dirty', label: t('add.diaper_dirty') },
    { value: 'both',  label: t('add.diaper_both') },
    { value: 'dry',   label: t('add.diaper_dry') },
  ] as const;
}

function getSleepTypeOptions(t: (k: string) => string) {
  return [
    { value: 'nap',   label: t('add.sleep_day') },
    { value: 'night', label: t('add.sleep_night') },
  ] as const;
}

function getSymptoms(t: (k: string) => string): string[] {
  return [
    t('add.symptoms_nausea'),
    t('add.symptoms_fatigue'),
    t('add.symptoms_back_pain'),
    t('add.symptoms_mild_contractions'),
    t('add.symptoms_heartburn'),
    t('add.symptoms_other'),
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numberOrUndefined(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function addHours(hours: number) {
  return Timestamp.fromDate(new Date(Date.now() + hours * 60 * 60 * 1000));
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ─── Shared Field Components ──────────────────────────────────────────────────

function Chips<T extends string>({
  value, options, onChange, color,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  color: string;
}) {
  return (
    <View style={fStyles.chips}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[fStyles.chip, active && { backgroundColor: color, borderColor: color }]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[fStyles.chipText, active && fStyles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'number-pad' | 'decimal-pad'; multiline?: boolean;
}) {
  return (
    <View style={fStyles.fieldWrap}>
      <Text style={fStyles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[fStyles.input, multiline && fStyles.inputMultiline]}
      />
    </View>
  );
}

function BigNumField({ label, value, onChange, keyboardType = 'number-pad' }: {
  label: string; value: string; onChange: (v: string) => void; keyboardType?: 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={[fStyles.fieldWrap, { flex: 1 }]}>
      <Text style={fStyles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        style={mStyles.bigInput}
        textAlign="center"
      />
    </View>
  );
}

function SaveBtn({ color, saving, onPress, label }: { color: string; saving: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      style={[mStyles.saveBtn, { backgroundColor: color }, saving && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={saving}
      activeOpacity={0.85}
    >
      {saving
        ? <ActivityIndicator color={Colors.white} />
        : <Text style={mStyles.saveBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

// ─── Persistent Timer Component ───────────────────────────────────────────────

function PersistentTimer({
  timerKey,
  color,
  showSideChips,
  notes,
  onNotesChange,
  onSave,
}: {
  timerKey: TimerKey;
  color: string;
  showSideChips?: boolean;
  notes: string;
  onNotesChange: (v: string) => void;
  onSave: (elapsed: number) => void;
}) {
  const { t } = useTranslation();
  const { timers, startTimer, pauseTimer, resumeTimer, resetTimer, setSide, getElapsed } = useQuickTimerStore();
  const timer = timers[timerKey];
  const running = timer?.running ?? false;
  const hasTimer = timer !== undefined;
  const side = timer?.side ?? 'left';

  const [display, setDisplay] = useState(() => getElapsed(timerKey));
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      rafRef.current = setInterval(() => setDisplay(getElapsed(timerKey)), 500);
    } else {
      if (rafRef.current) { clearInterval(rafRef.current); rafRef.current = null; }
      setDisplay(getElapsed(timerKey));
    }
    return () => { if (rafRef.current) clearInterval(rafRef.current); };
  }, [running, timerKey]);

  const handleStart = () => {
    if (!hasTimer) startTimer(timerKey, { side, sleepType: 'nap' });
    else resumeTimer(timerKey);
  };

  const handlePause = () => pauseTimer(timerKey);

  const handleReset = () => {
    resetTimer(timerKey);
    setDisplay(0);
  };

  const handleSave = () => {
    const elapsed = getElapsed(timerKey);
    if (elapsed === 0) return;
    onSave(elapsed);
  };

  const sideOptions = [
    { value: 'left' as const,  label: t('add.side_left') },
    { value: 'right' as const, label: t('add.side_right') },
  ];

  return (
    <View style={timerStyles.wrap}>
      {showSideChips && (
        <Chips
          value={side}
          options={sideOptions}
          onChange={(v) => setSide(timerKey, v)}
          color={color}
        />
      )}

      <View style={[timerStyles.circle, { borderColor: running ? color : color + '40' }]}>
        <Text style={[timerStyles.timeText, { color }]}>{formatElapsed(display)}</Text>
        <Text style={timerStyles.timeLabel}>
          {running ? t('add.recording') : hasTimer && display > 0 ? t('add.paused_label') : t('add.ready')}
        </Text>
        {running && (
          <View style={[timerStyles.pulseDot, { backgroundColor: color }]} />
        )}
      </View>

      <View style={timerStyles.btnRow}>
        {!running ? (
          <TouchableOpacity style={[timerStyles.btnPrimary, { backgroundColor: color }]} onPress={handleStart}>
            <Text style={timerStyles.btnPrimaryText}>{hasTimer && display > 0 ? t('add.continue_btn') : t('add.start_btn')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[timerStyles.btnPrimary, { backgroundColor: color }]} onPress={handlePause}>
            <Text style={timerStyles.btnPrimaryText}>{t('add.pause_btn')}</Text>
          </TouchableOpacity>
        )}
        {hasTimer && (
          <TouchableOpacity style={timerStyles.btnSecondary} onPress={handleReset}>
            <Text style={timerStyles.btnSecondaryText}>{t('add.reset_btn')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Field label={t('add.notes_optional')} value={notes} onChange={onNotesChange} placeholder={t('add.observations_placeholder')} />

      <TouchableOpacity
        style={[timerStyles.saveBtn, { backgroundColor: color }, display === 0 && timerStyles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={display === 0}
        activeOpacity={0.85}
      >
        <Text style={timerStyles.saveBtnText}>
          {display > 0 ? t('add.save_with_time', { time: formatElapsed(display) }) : t('add.save_btn')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  wrap: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  circle: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  timeText: { fontFamily: 'Fraunces', fontSize: 46 },
  timeLabel: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  btnRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
  btnPrimary: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md + 2, borderRadius: BorderRadius.full },
  btnPrimaryText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
  btnSecondary: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2, borderRadius: BorderRadius.full, backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border },
  btnSecondaryText: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: Colors.textSecondary },
  saveBtn: { height: 60, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  saveBtnDisabled: { opacity: 0.3 },
  saveBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 15, color: Colors.white },
});

// ─── Action Modal ─────────────────────────────────────────────────────────────

function ActionModal({
  card,
  onClose,
  onSaved,
  user,
  activeChild,
  currentWeek,
  childStore,
  pregnancyStore,
}: {
  card: ActionCard;
  onClose: () => void;
  onSaved: () => void;
  user: { uid: string } | null;
  activeChild: { id: string; birthDate?: any; name?: string } | null;
  currentWeek: { week: number } | null;
  childStore: any;
  pregnancyStore: any;
}) {
  const { t } = useTranslation();
  const { getElapsed, resetTimer, timers } = useQuickTimerStore();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [sleepType, setSleepType] = useState<'nap' | 'night'>(timers.sleep?.sleepType ?? 'nap');
  const [amountMl, setAmountMl] = useState('120');
  const [foodName, setFoodName] = useState('');
  const [diaperType, setDiaperType] = useState<'wet' | 'dirty' | 'both' | 'dry'>('wet');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [pregnancyWeight, setPregnancyWeight] = useState('');
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [glucose, setGlucose] = useState('');
  const symptoms = getSymptoms(t);
  const [symptom, setSymptom] = useState(symptoms[0]);
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [journal, setJournal] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  const [movementSaved, setMovementSaved] = useState(false);

  const { setSleepType: storeSetSleepType } = useQuickTimerStore();

  const save = async (opts?: { timerSeconds?: number; timerSide?: 'left' | 'right' | 'both' }) => {
    if (!user) return;
    setSaving(true);
    const n = notes.trim();

    try {
      const action = card.key;

      if (action === 'breastfeeding' && opts?.timerSeconds !== undefined) {
        const feed = withoutUndefined({
          timestamp: Timestamp.now(),
          type: 'breastfeeding' as const,
          side: opts.timerSide,
          duration: opts.timerSeconds,
          notes: n || undefined,
          createdBy: user.uid,
        });
        const id = await feedingService.addFeed(user.uid, activeChild!.id, feed);
        childStore.addFeed({ ...feed, id });
        resetTimer('breastfeeding');
        onSaved();
        return;
      }

      if (action === 'sleep' && opts?.timerSeconds !== undefined) {
        const endTime = Timestamp.now();
        const startTime = Timestamp.fromDate(new Date(Date.now() - opts.timerSeconds * 1000));
        const sleep = withoutUndefined({
          startTime, endTime,
          duration: opts.timerSeconds,
          quality: 'good' as const,
          type: sleepType,
          notes: n || undefined,
          createdBy: user.uid,
        });
        const id = await sleepService.addSleep(user.uid, activeChild!.id, sleep);
        childStore.addSleep({ ...sleep, id });
        resetTimer('sleep');
        onSaved();
        return;
      }

      if (action === 'bottle') {
        const feed = withoutUndefined({
          timestamp: Timestamp.now(), type: 'bottle' as const,
          amount: numberOrUndefined(amountMl), milkType: 'formula' as const,
          notes: n || undefined, createdBy: user.uid,
        });
        const id = await feedingService.addFeed(user.uid, activeChild!.id, feed);
        childStore.addFeed({ ...feed, id });
      }

      if (action === 'solid') {
        const feed = withoutUndefined({
          timestamp: Timestamp.now(), type: 'solid' as const,
          foods: foodName.trim() ? [foodName.trim()] : undefined,
          notes: n || undefined, createdBy: user.uid,
        });
        const id = await feedingService.addFeed(user.uid, activeChild!.id, feed);
        childStore.addFeed({ ...feed, id });
      }

      if (action === 'diaper') {
        const diaper = withoutUndefined({
          timestamp: Timestamp.now(), type: diaperType,
          notes: n || undefined, createdBy: user.uid,
        });
        const id = await diaperService.addDiaper(user.uid, activeChild!.id, diaper);
        childStore.addDiaper({ ...diaper, id });
      }

      if (action === 'growth') {
        const measurement = withoutUndefined({
          date: Timestamp.now(),
          weight: numberOrUndefined(weight),
          height: numberOrUndefined(height),
          headCircumference: numberOrUndefined(head),
          ageMonths: activeChild?.birthDate
            ? Math.max(0, Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / 2629800000))
            : 0,
          notes: n || undefined,
        });
        if (!measurement.weight && !measurement.height && !measurement.headCircumference) {
          Alert.alert(t('add.missing_data'), t('add.missing_measurement')); setSaving(false); return;
        }
        const validation = growthService.validateMeasurement(measurement);
        if (validation) { Alert.alert(t('common.error'), validation); setSaving(false); return; }
        const id = await growthService.addMeasurement(user.uid, activeChild!.id, measurement);
        childStore.setMeasurements([...childStore.measurements, { ...measurement, id }]);
      }

      if (action === 'movement') {
        const movement = withoutUndefined({ date: Timestamp.now(), count: 1, durationMinutes: 0, notes: n || undefined });
        const id = await pregnancyService.addMovement(user.uid, movement);
        pregnancyStore.addMovement({ ...movement, id });
        setMovementSaved(true);
        setSaving(false);
        return;
      }

      if (action === 'pregnancy_weight') {
        const kg = numberOrUndefined(pregnancyWeight);
        if (!kg) { Alert.alert(t('add.missing_weight'), t('add.missing_weight_msg')); setSaving(false); return; }
        const log = { week: currentWeek?.week ?? 0, weight: kg, date: Timestamp.now() };
        const id = await pregnancyService.addWeightLog(user.uid, log);
        pregnancyStore.addWeightLog({ ...log, id });
      }

      if (action === 'blood_pressure') {
        const sys = numberOrUndefined(systolic);
        const dia = numberOrUndefined(diastolic);
        if (!sys || !dia) { Alert.alert(t('add.missing_bp'), t('add.missing_bp_msg')); setSaving(false); return; }
        await pregnancyService.addVital(user.uid, withoutUndefined({
          date: Timestamp.now(), type: 'blood_pressure',
          values: { systolic: sys, diastolic: dia }, notes: n || undefined,
        }));
      }

      if (action === 'glucose') {
        const value = numberOrUndefined(glucose);
        if (!value) { Alert.alert(t('add.missing_glucose'), t('add.missing_glucose_msg')); setSaving(false); return; }
        await pregnancyService.addVital(user.uid, withoutUndefined({
          date: Timestamp.now(), type: 'glucose',
          values: { glucose: value }, notes: n || undefined,
        }));
      }

      if (action === 'symptom') {
        const item = withoutUndefined({ date: Timestamp.now(), symptom, severity, notes: n || undefined });
        const id = await pregnancyService.addSymptom(user.uid, item);
        pregnancyStore.addSymptom({ ...item, id });
      }

      if (action === 'journal') {
        if (!journal.trim()) { Alert.alert(t('add.empty_journal'), t('add.empty_journal_msg')); setSaving(false); return; }
        await pregnancyService.addJournalEntry(user.uid, { date: Timestamp.now(), content: journal.trim(), mood: 'neutral' });
      }

      if (action === 'appointment') {
        const appt = withoutUndefined({
          date: addHours(24), type: appointmentType.trim() || 'Control',
          status: 'scheduled' as const, notes: n || undefined,
        });
        const id = await pregnancyService.addAppointment(user.uid, appt);
        pregnancyStore.setAppointments([...pregnancyStore.appointments, { ...appt, id }]);
      }

      onSaved();
    } catch (err: any) {
      Alert.alert(t('add.save_error'), err?.message || t('add.save_error_msg'));
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    if (card.key === 'breastfeeding') {
      return (
        <PersistentTimer
          timerKey="breastfeeding"
          color={card.color}
          showSideChips
          notes={notes}
          onNotesChange={setNotes}
          onSave={(elapsed) => save({ timerSeconds: elapsed, timerSide: timers.breastfeeding?.side ?? 'left' })}
        />
      );
    }

    if (card.key === 'sleep') {
      return (
        <View style={mStyles.content}>
          <Chips
            value={sleepType}
            options={getSleepTypeOptions(t)}
            onChange={(v) => { setSleepType(v); storeSetSleepType('sleep', v); }}
            color={card.color}
          />
          <PersistentTimer
            timerKey="sleep"
            color={card.color}
            notes={notes}
            onNotesChange={setNotes}
            onSave={(elapsed) => save({ timerSeconds: elapsed })}
          />
        </View>
      );
    }

    if (card.key === 'movement') {
      if (movementSaved) {
        return (
          <View style={mStyles.doneWrap}>
            <Text style={mStyles.doneEmoji}>✅</Text>
            <Text style={mStyles.doneTitle}>{t('add.movement_saved')}</Text>
            <Text style={mStyles.doneSub}>{t('add.movement_saved_desc')}</Text>
            <TouchableOpacity style={[mStyles.doneBtn, { backgroundColor: card.color }]} onPress={onClose}>
              <Text style={mStyles.doneBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={mStyles.movementWrap}>
          <TouchableOpacity
            style={[mStyles.movementCircle, { borderColor: card.color + '40' }]}
            onPress={() => save()}
            activeOpacity={0.75}
          >
            <Text style={mStyles.movementEmoji}>👶</Text>
            <Text style={[mStyles.movementLabel, { color: card.color }]}>{t('add.tap_btn')}</Text>
            <Text style={mStyles.movementSub}>{t('add.tap_sub')}</Text>
          </TouchableOpacity>
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} placeholder={t('add.observations_placeholder')} />
        </View>
      );
    }

    if (card.key === 'diaper') {
      return (
        <View style={mStyles.content}>
          <Chips value={diaperType} options={getDiaperOptions(t)} onChange={setDiaperType} color={card.color} />
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} placeholder={t('add.observations_placeholder')} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'bottle') {
      return (
        <View style={mStyles.content}>
          <BigNumField label={t('add.bottle_amount')} value={amountMl} onChange={setAmountMl} />
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} placeholder={t('add.observations_placeholder')} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'solid') {
      return (
        <View style={mStyles.content}>
          <Field label={t('add.food_name')} value={foodName} onChange={setFoodName} placeholder={t('add.food_placeholder')} />
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} placeholder={t('add.food_notes_placeholder')} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'growth') {
      return (
        <View style={mStyles.content}>
          <View style={mStyles.twoCol}>
            <BigNumField label={t('add.weight_kg')} value={weight} onChange={setWeight} keyboardType="decimal-pad" />
            <BigNumField label={t('add.height_cm')} value={height} onChange={setHeight} keyboardType="decimal-pad" />
          </View>
          <BigNumField label={t('add.head_cm')} value={head} onChange={setHead} keyboardType="decimal-pad" />
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'pregnancy_weight') {
      return (
        <View style={mStyles.content}>
          <BigNumField label={t('add.preg_weight_kg')} value={pregnancyWeight} onChange={setPregnancyWeight} keyboardType="decimal-pad" />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'blood_pressure') {
      return (
        <View style={mStyles.content}>
          <View style={mStyles.twoCol}>
            <BigNumField label={t('add.systolic')} value={systolic} onChange={setSystolic} />
            <BigNumField label={t('add.diastolic')} value={diastolic} onChange={setDiastolic} />
          </View>
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} placeholder={t('add.bp_notes_placeholder')} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'glucose') {
      return (
        <View style={mStyles.content}>
          <BigNumField label={t('add.glucose_value')} value={glucose} onChange={setGlucose} />
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} placeholder={t('add.glucose_notes_placeholder')} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'symptom') {
      return (
        <View style={mStyles.content}>
          <Chips
            value={symptom}
            options={symptoms.map((s) => ({ value: s, label: s }))}
            onChange={setSymptom}
            color={card.color}
          />
          <Text style={fStyles.fieldLabel}>{t('add.symptom_intensity')}</Text>
          <View style={mStyles.severityRow}>
            {([1, 2, 3, 4, 5] as const).map((v) => {
              const emoji = v <= 2 ? '😌' : v === 3 ? '😐' : v <= 4 ? '😣' : '😫';
              const active = severity === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[mStyles.severityBtn, active && { backgroundColor: card.color, borderColor: card.color }]}
                  onPress={() => setSeverity(v)}
                >
                  <Text style={mStyles.severityEmoji}>{emoji}</Text>
                  <Text style={[mStyles.severityNum, active && { color: Colors.white }]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    if (card.key === 'appointment') {
      return (
        <View style={mStyles.content}>
          <Field label={t('add.appointment_type')} value={appointmentType} onChange={setAppointmentType} placeholder={t('add.appointment_type_placeholder')} />
          <View style={[mStyles.helperCard, { borderLeftColor: card.color }]}>
            <Text style={mStyles.helperText}>{t('add.appointment_helper')}</Text>
          </View>
          <Field label={t('add.notes_optional')} value={notes} onChange={setNotes} />
          <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
        </View>
      );
    }

    return (
      <View style={mStyles.content}>
        <Field label={t('add.journal_note')} value={journal} onChange={setJournal} placeholder={t('add.journal_placeholder')} multiline />
        <SaveBtn color={card.color} saving={saving} onPress={() => save()} label={t('add.save_btn')} />
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={mStyles.container}>
          <LinearGradient colors={[card.color, card.colorDark]} style={mStyles.header}>
            <SafeAreaView edges={['top']}>
              <View style={mStyles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.headerEmoji}>{card.emoji}</Text>
                  <Text style={mStyles.headerTitle}>{card.label}</Text>
                  <Text style={mStyles.headerHint}>{card.hint}</Text>
                </View>
                <TouchableOpacity style={mStyles.closeBtn} onPress={onClose}>
                  <Text style={mStyles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </LinearGradient>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={mStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: Spacing.md },
  headerEmoji: { fontSize: 40, marginBottom: Spacing.xs },
  headerTitle: { fontFamily: 'Fraunces', fontSize: 26, color: Colors.white, marginBottom: 2 },
  headerHint: { fontFamily: 'Geist', fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
  scrollContent: { padding: Spacing.xl, paddingBottom: 60 },
  content: { gap: Spacing.lg },
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  severityRow: { flexDirection: 'row', gap: Spacing.sm },
  severityBtn: { flex: 1, height: 68, borderRadius: BorderRadius.lg, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', gap: 3 },
  severityEmoji: { fontSize: 20 },
  severityNum: { fontFamily: 'Geist-Bold', fontSize: 13, color: Colors.textSecondary },
  saveBtn: { height: 60, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  saveBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 17, color: Colors.white },
  bigInput: { height: 72, borderRadius: BorderRadius.xl, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, fontSize: 32, fontFamily: 'Geist-Bold', color: Colors.textPrimary },
  movementWrap: { gap: Spacing.xl, alignItems: 'stretch' },
  movementCircle: { alignSelf: 'center', width: 200, height: 200, borderRadius: 100, borderWidth: 4, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  movementEmoji: { fontSize: 52 },
  movementLabel: { fontFamily: 'Fraunces', fontSize: 22, marginTop: Spacing.xs },
  movementSub: { fontFamily: 'Geist', fontSize: 13, color: Colors.textTertiary },
  doneWrap: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.lg },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontFamily: 'Fraunces', fontSize: 28, color: Colors.textPrimary },
  doneSub: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  doneBtn: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.md },
  doneBtnText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
  helperCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, borderLeftWidth: 4, padding: Spacing.md },
  helperText: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});

const fStyles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { flex: 1, minHeight: 52, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.xl, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  chipTextActive: { color: Colors.white },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { height: 52, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, paddingHorizontal: Spacing.md, fontSize: 16, fontFamily: 'Geist', color: Colors.textPrimary },
  inputMultiline: { height: 110, paddingTop: Spacing.md, textAlignVertical: 'top' },
});

// ─── Action Grid Card ─────────────────────────────────────────────────────────

function ActionGridCard({ card, onPress, locked }: { card: ActionCard; onPress: () => void; locked?: boolean }) {
  const { t } = useTranslation();
  const { getElapsed, timers } = useQuickTimerStore();
  const timerKey = card.key === 'breastfeeding' ? 'breastfeeding' : card.key === 'sleep' ? 'sleep' : null;
  const hasTimer = timerKey !== null;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!timerKey) return;
    const t = timers[timerKey];
    if (!t) { setDisplay(0); return; }
    if (t.running) {
      const id = setInterval(() => setDisplay(getElapsed(timerKey)), 500);
      return () => clearInterval(id);
    } else {
      setDisplay(getElapsed(timerKey));
    }
  }, [timerKey, timers[timerKey as TimerKey]?.running]);

  const isActive = hasTimer && timers[timerKey as TimerKey] !== undefined;
  const isRunning = hasTimer && timers[timerKey as TimerKey]?.running === true;

  return (
    <TouchableOpacity
      style={[cardStyles.card, isRunning && { borderWidth: 2, borderColor: card.color }, locked && cardStyles.cardLocked]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {locked && (
        <View style={cardStyles.lockBadge}>
          <Text style={cardStyles.lockBadgeText}>{t('add.locked_premium')}</Text>
        </View>
      )}
      <Text style={cardStyles.emoji}>{card.emoji}</Text>
      {isActive && display > 0 ? (
        <>
          <Text style={[cardStyles.timerDisplay, { color: card.color }]}>{formatElapsed(display)}</Text>
          <Text style={cardStyles.timerStatus}>{isRunning ? t('add.running') : t('add.paused_status')}</Text>
        </>
      ) : (
        <>
          <Text style={cardStyles.label}>{card.label}</Text>
          <Text style={cardStyles.hint}>{card.hint}</Text>
        </>
      )}
      <View style={[cardStyles.badge, { backgroundColor: isRunning ? card.color + '20' : card.color + '14' }]}>
        <View style={[cardStyles.badgeDot, { backgroundColor: card.color }]} />
        <Text style={[cardStyles.badgeText, { color: card.color }]}>{isRunning ? t('add.active_badge') : t('add.quick_badge')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, margin: Spacing.xs, ...Shadow.sm, alignItems: 'center', minHeight: 155, borderWidth: 1.5, borderColor: 'transparent' },
  cardLocked: { opacity: 0.62 },
  lockBadge: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: Colors.amber, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  lockBadgeText: { fontFamily: 'Geist-SemiBold', fontSize: 10, color: Colors.white },
  emoji: { fontSize: 40, marginBottom: Spacing.sm },
  label: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary, textAlign: 'center', marginBottom: 3 },
  hint: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginBottom: Spacing.sm },
  timerDisplay: { fontFamily: 'Fraunces', fontSize: 22, marginBottom: 2 },
  timerStatus: { fontFamily: 'Geist', fontSize: 11, color: Colors.textTertiary, marginBottom: Spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: 'Geist-SemiBold', fontSize: 11 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profileMode } = useAuthStore();
  const { activeChild, isLoading: isChildLoading } = useChild();
  const { currentWeek } = usePregnancy();
  const { canUseModule } = useAccessControl();
  const childStore = useChildStore() as any;
  const pregnancyStore = usePregnancyStore() as any;
  const [openCard, setOpenCard] = useState<ActionCard | null>(null);

  useLoadChildData();
  useLoadPregnancyData();

  const actions = useMemo(
    () => (profileMode === 'pregnancy' ? getPregnancyActions(t) : getChildActions(t)),
    [profileMode, t],
  );

  const gradientColors: [string, string] = profileMode === 'pregnancy'
    ? [Colors.pregnancy.primary, Colors.pregnancy.primaryDark]
    : [Colors.child.primary, Colors.child.primaryDark];

  const rows: ActionCard[][] = [];
  for (let i = 0; i < actions.length; i += 2) {
    rows.push(actions.slice(i, i + 2));
  }

  const handleSaved = () => {
    setOpenCard(null);
    Alert.alert(t('add.saved_title'), t('add.saved_msg'));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <Text style={styles.headerTitle}>{t('add.title')}</Text>
        <Text style={styles.headerSub}>
          {profileMode === 'pregnancy' ? t('add.subtitle_pregnancy') : ((activeChild as any)?.name ?? t('add.subtitle_child'))}{t('add.subtitle_suffix')}
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {profileMode === 'child' && !activeChild && isChildLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={Colors.child.primary} size="large" />
          </View>
        ) : profileMode === 'child' && !activeChild ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 48 }}>👶</Text>
            <Text style={styles.emptyTitle}>{t('add.no_active_child')}</Text>
            <Text style={styles.emptyText}>{t('add.no_active_child_desc')}</Text>
          </View>
        ) : (
          rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((card) => (
                <ActionGridCard
                  key={card.key}
                  card={card}
                  locked={!canUseModule(card.moduleId)}
                  onPress={() => canUseModule(card.moduleId)
                    ? setOpenCard(card)
                    : router.push('/modules/settings/subscription' as any)}
                />
              ))}
              {row.length === 1 && <View style={{ flex: 1, margin: Spacing.xs }} />}
            </View>
          ))
        )}
      </ScrollView>

      {openCard && (
        <ActionModal
          card={openCard}
          onClose={() => setOpenCard(null)}
          onSaved={handleSaved}
          user={user}
          activeChild={activeChild}
          currentWeek={currentWeek}
          childStore={childStore}
          pregnancyStore={pregnancyStore}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  headerTitle: { fontFamily: 'Fraunces', fontSize: 26, color: Colors.white, marginBottom: 2 },
  headerSub: { fontFamily: 'Geist', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  scroll: { flex: 1 },
  grid: { padding: Spacing.md, paddingBottom: 40 },
  row: { flexDirection: 'row', marginHorizontal: -Spacing.xs },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyTitle: { fontFamily: 'Geist-SemiBold', fontSize: 18, color: Colors.textPrimary },
  emptyText: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
