import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import { AppDatePicker } from '../../../components/ui/AppDatePicker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { usePregnancyStore } from '../../../stores/pregnancyStore';
import { pregnancyService } from '../../../services/pregnancyService';
import { PregnancyAppointment } from '../../../types/pregnancy';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const APPOINTMENT_TYPES = [
  'monthly', 'ultrasound', 'blood', 'glucose',
  'specialist', 'birth_class', 'anesthesia', 'other',
];

const typeKeyMap: Record<string, string> = {
  'Control lunar': 'monthly',
  'Ecografie': 'ultrasound',
  'Analize sânge': 'blood',
  'Test glucoză': 'glucose',
  'Consult specialist': 'specialist',
  'Curs naștere': 'birth_class',
  'Consultație anestezie': 'anesthesia',
  'Altele': 'other'
};

const STATUS_CONFIG: Record<string, { labelKey: string; color: string }> = {
  scheduled: { labelKey: 'scheduled', color: Colors.info },
  completed: { labelKey: 'completed', color: Colors.success },
  missed: { labelKey: 'missed', color: Colors.error },
};

function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(ts: Timestamp): string {
  const d = ts.toDate();
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { appointments, setAppointments } = usePregnancyStore();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: APPOINTMENT_TYPES[0],
    doctor: '',
    location: '',
    notes: '',
    date: new Date(new Date().setHours(10, 0, 0, 0)),
  });

  const now = new Date();

  const filtered = appointments.filter((a) => {
    const d = a.date.toDate();
    if (filter === 'upcoming') return d >= now && a.status === 'scheduled';
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  const nextAppt = appointments
    .filter((a) => a.date.toDate() >= now && a.status === 'scheduled')
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())[0];

  const handleSave = async () => {
    if (!user || !form.date) {
      Alert.alert(t('appointments_module.error_title'), t('appointments_module.error_date'));
      return;
    }
    setSaving(true);
    try {
      const apt: any = {
        type: form.type,
        date: Timestamp.fromDate(form.date),
        status: 'scheduled',
      };
      if (form.doctor) apt.doctor = form.doctor;
      if (form.location) apt.location = form.location;
      if (form.notes) apt.notes = form.notes;
      const id = await pregnancyService.addAppointment(user.uid, apt);
      setAppointments([...appointments, { ...apt, id }].sort((a, b) => a.date.toMillis() - b.date.toMillis()));
      setShowAdd(false);
      setForm({ type: APPOINTMENT_TYPES[0], doctor: '', location: '', notes: '', date: new Date(new Date().setHours(10, 0, 0, 0)) });
    } catch {
      Alert.alert(t('appointments_module.error_title'), t('appointments_module.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const markCompleted = async (apt: PregnancyAppointment) => {
    if (!user || !apt.id) return;
    await pregnancyService.updateAppointment(user.uid, apt.id, { status: 'completed' });
    setAppointments(appointments.map((a) => a.id === apt.id ? { ...a, status: 'completed' } : a));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('appointments_module.title')}</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Next appointment banner */}
        {nextAppt && (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>{t('appointments_module.next_appointment')}</Text>
            <Text style={styles.nextType}>{t(`appointments_module.types.${typeKeyMap[nextAppt.type] || nextAppt.type}`, { defaultValue: nextAppt.type })}</Text>
            <Text style={styles.nextDate}>{formatDate(nextAppt.date)} la {formatTime(nextAppt.date)}</Text>
            {nextAppt.doctor && <Text style={styles.nextDoctor}>👨‍⚕️ {nextAppt.doctor}</Text>}
            {nextAppt.location && <Text style={styles.nextLocation}>📍 {nextAppt.location}</Text>}
          </View>
        )}

        {/* Add form */}
        {showAdd && (
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>{t('appointments_module.new_appointment')}</Text>

            <Text style={styles.fieldLabel}>{t('appointments_module.consultation_type')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {APPOINTMENT_TYPES.map((typeKey) => (
                <TouchableOpacity
                  key={typeKey}
                  style={[styles.typeChip, form.type === typeKey && styles.typeChipActive]}
                  onPress={() => setForm((f) => ({ ...f, type: typeKey }))}
                >
                  <Text style={[styles.typeChipText, form.type === typeKey && styles.typeChipTextActive]}>{t(`appointments_module.types.${typeKey}`)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>{t('appointments_module.date')}</Text>
            <AppDatePicker
              value={form.date}
              mode="date"
              onChange={(date) => setForm(f => ({ ...f, date }))}
            />

            <Text style={styles.fieldLabel}>{t('appointments_module.time')}</Text>
            <AppDatePicker
              value={form.date}
              mode="time"
              onChange={(date) => setForm(f => ({ ...f, date }))}
            />

            <Text style={styles.fieldLabel}>{t('appointments_module.doctor')}</Text>
            <TextInput
              style={styles.input}
              value={form.doctor}
              onChangeText={(v) => setForm((f) => ({ ...f, doctor: v }))}
              placeholder="Dr. Ionescu"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>{t('appointments_module.location')}</Text>
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
              placeholder="Spital, clinică..."
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>{t('appointments_module.notes')}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
              placeholder="Întrebări pentru doctor..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.addActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtnText}>{t('appointments_module.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? t('appointments_module.saving') : t('appointments_module.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(['upcoming', 'completed', 'all'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === 'upcoming' ? t('appointments_module.filter_upcoming') : f === 'completed' ? t('appointments_module.filter_completed') : t('appointments_module.filter_all')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Appointments list */}
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>{t('appointments_module.empty_category')}</Text>
          ) : (
            filtered.map((apt) => {
              const cfg = STATUS_CONFIG[apt.status];
              return (
                <View key={apt.id} style={styles.aptCard}>
                  <View style={styles.aptTop}>
                    <View style={styles.aptMain}>
                      <Text style={styles.aptType}>{t(`appointments_module.types.${typeKeyMap[apt.type] || apt.type}`, { defaultValue: apt.type })}</Text>
                      <Text style={styles.aptDate}>{formatDate(apt.date)} · {formatTime(apt.date)}</Text>
                      {apt.doctor && <Text style={styles.aptDetail}>👨‍⚕️ {apt.doctor}</Text>}
                      {apt.location && <Text style={styles.aptDetail}>📍 {apt.location}</Text>}
                      {apt.notes && <Text style={styles.aptNotes}>{apt.notes}</Text>}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                      <Text style={[styles.statusText, { color: cfg.color }]}>{t(`appointments_module.status.${cfg.labelKey}`)}</Text>
                    </View>
                  </View>
                  {apt.status === 'scheduled' && (
                    <TouchableOpacity style={styles.completeBtn} onPress={() => markCompleted(apt)}>
                      <Text style={styles.completeBtnText}>{t('appointments_module.mark_completed')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  addBtn: { fontSize: 26, color: Colors.pregnancy.primary, fontWeight: '300' },
  nextCard: {
    margin: Spacing.xl, backgroundColor: Colors.pregnancy.primary + '15',
    borderRadius: BorderRadius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.pregnancy.primary + '30',
  },
  nextLabel: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextType: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.xs },
  nextDate: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  nextDoctor: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  nextLocation: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  addCard: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing.lg,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  addCardTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.lg },
  fieldLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  typeScroll: { marginBottom: Spacing.lg },
  typeChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  typeChipActive: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  typeChipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.white },
  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  inputMulti: { height: 72, textAlignVertical: 'top' },
  addActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: BorderRadius.xl, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  saveBtn: {
    flex: 1, height: 44, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.pregnancy.primary, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  filterTab: {
    flex: 1, height: 36, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  filterTabActive: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  filterTabText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  filterTabTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'], gap: Spacing.sm },
  aptCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm,
  },
  aptTop: { flexDirection: 'row', gap: Spacing.md },
  aptMain: { flex: 1 },
  aptType: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  aptDate: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary, marginBottom: Spacing.xs },
  aptDetail: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  aptNotes: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: Spacing.xs },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontFamily: 'Geist-SemiBold' },
  completeBtn: {
    marginTop: Spacing.sm, height: 36, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.success + '15', alignItems: 'center', justifyContent: 'center',
  },
  completeBtnText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.success },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
});
