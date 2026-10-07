import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri'];

interface ScheduleEntry {
  id: string;
  day: string;
  time: string;
  subject: string;
  teacher?: string;
  room?: string;
}

interface Homework {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
}

const INITIAL_SCHEDULE: ScheduleEntry[] = [
  { id: '1', day: 'Luni', time: '08:00', subject: 'Matematică', teacher: 'Dna. Ionescu' },
  { id: '2', day: 'Luni', time: '09:00', subject: 'Română', teacher: 'Dl. Popescu' },
  { id: '3', day: 'Marți', time: '08:00', subject: 'Engleză', teacher: 'Dna. Smith' },
  { id: '4', day: 'Miercuri', time: '08:00', subject: 'Științe', teacher: 'Dl. Georgescu' },
];

const INITIAL_HOMEWORK: Homework[] = [
  { id: '1', subject: 'Matematică', description: 'Pagina 45, ex. 1-5', dueDate: '2025-06-16', done: false },
  { id: '2', subject: 'Română', description: 'Compunere despre vară (1 pagină)', dueDate: '2025-06-18', done: false },
];

export default function SchoolScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const [activeTab, setActiveTab] = useState<'schedule' | 'homework'>('schedule');
  const [selectedDay, setSelectedDay] = useState('Luni');
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(INITIAL_SCHEDULE);
  const [homework, setHomework] = useState<Homework[]>(INITIAL_HOMEWORK);
  const [showAddHomework, setShowAddHomework] = useState(false);
  const [newHW, setNewHW] = useState({ subject: '', description: '', dueDate: '' });

  const daySchedule = schedule.filter((s) => s.day === selectedDay).sort((a, b) => a.time.localeCompare(b.time));
  const pendingHW = homework.filter((h) => !h.done);
  const doneHW = homework.filter((h) => h.done);

  // Load persisted school data from Firestore
  useEffect(() => {
    if (!user?.uid || !activeChild?.id) return;
    const ref = doc(db, 'users', user.uid, 'children', activeChild.id, 'school', 'data');
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.schedule?.length) setSchedule(data.schedule);
        if (data.homework?.length) setHomework(data.homework);
      }
    }).catch(() => {});
  }, [user?.uid, activeChild?.id]);

  // Persist school data to Firestore whenever it changes
  const persist = useCallback((newSchedule: ScheduleEntry[], newHomework: Homework[]) => {
    if (!user?.uid || !activeChild?.id) return;
    const ref = doc(db, 'users', user.uid, 'children', activeChild.id, 'school', 'data');
    setDoc(ref, { schedule: newSchedule, homework: newHomework }, { merge: true }).catch(() => {});
  }, [user?.uid, activeChild?.id]);

  const toggleHomework = (id: string) => {
    setHomework((prev) => {
      const updated = prev.map((h) => h.id === id ? { ...h, done: !h.done } : h);
      persist(schedule, updated);
      return updated;
    });
  };

  const addHomework = () => {
    if (!newHW.subject || !newHW.description) return;
    const hw: Homework = {
      id: Date.now().toString(),
      ...newHW,
      done: false,
    };
    setHomework((prev) => {
      const updated = [hw, ...prev];
      persist(schedule, updated);
      return updated;
    });
    setNewHW({ subject: '', description: '', dueDate: '' });
    setShowAddHomework(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Grădiniță / Școală 🎒
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {activeChild && (
        <View style={styles.childBanner}>
          <Text style={styles.childBannerText}>📚 {activeChild.name}</Text>
        </View>
      )}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>Orar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'homework' && styles.tabActive]}
          onPress={() => setActiveTab('homework')}
        >
          <Text style={[styles.tabText, activeTab === 'homework' && styles.tabTextActive]}>
            Teme {pendingHW.length > 0 && `(${pendingHW.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'schedule' && (
          <>
            {/* Day selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dayChipText, selectedDay === day && styles.dayChipTextActive]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.scheduleList}>
              {daySchedule.length === 0 ? (
                <Text style={styles.emptyText}>Nicio oră programată</Text>
              ) : (
                daySchedule.map((entry) => (
                  <View key={entry.id} style={styles.scheduleCard}>
                    <View style={styles.scheduleTime}>
                      <Text style={styles.scheduleTimeText}>{entry.time}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleSubject}>{entry.subject}</Text>
                      {entry.teacher && <Text style={styles.scheduleTeacher}>👤 {entry.teacher}</Text>}
                      {entry.room && <Text style={styles.scheduleRoom}>🚪 {entry.room}</Text>}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === 'homework' && (
          <View style={styles.hwSection}>
            {/* Add homework */}
            <TouchableOpacity style={styles.addHWBtn} onPress={() => setShowAddHomework(!showAddHomework)}>
              <Text style={styles.addHWBtnText}>+ Adaugă temă</Text>
            </TouchableOpacity>

            {showAddHomework && (
              <View style={styles.addHWCard}>
                <TextInput
                  style={styles.input}
                  value={newHW.subject}
                  onChangeText={(v) => setNewHW((f) => ({ ...f, subject: v }))}
                  placeholder="Materie (ex. Matematică)"
                  placeholderTextColor={Colors.textTertiary}
                />
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={newHW.description}
                  onChangeText={(v) => setNewHW((f) => ({ ...f, description: v }))}
                  placeholder="Descriere temă"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={2}
                />
                <TextInput
                  style={styles.input}
                  value={newHW.dueDate}
                  onChangeText={(v) => setNewHW((f) => ({ ...f, dueDate: v }))}
                  placeholder="Termen (YYYY-MM-DD)"
                  placeholderTextColor={Colors.textTertiary}
                />
                <TouchableOpacity style={styles.saveHWBtn} onPress={addHomework}>
                  <Text style={styles.saveHWBtnText}>Salvează</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Pending */}
            {pendingHW.length > 0 && (
              <>
                <Text style={styles.hwGroupTitle}>De făcut ({pendingHW.length})</Text>
                {pendingHW.map((hw) => (
                  <TouchableOpacity key={hw.id} style={styles.hwCard} onPress={() => toggleHomework(hw.id)}>
                    <View style={styles.hwCheckbox}>
                      <Text style={styles.hwCheckboxText}>○</Text>
                    </View>
                    <View style={styles.hwInfo}>
                      <Text style={styles.hwSubject}>{hw.subject}</Text>
                      <Text style={styles.hwDesc}>{hw.description}</Text>
                      {hw.dueDate && <Text style={styles.hwDue}>📅 Termen: {hw.dueDate}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Done */}
            {doneHW.length > 0 && (
              <>
                <Text style={styles.hwGroupTitle}>Finalizate ({doneHW.length})</Text>
                {doneHW.map((hw) => (
                  <TouchableOpacity key={hw.id} style={[styles.hwCard, styles.hwCardDone]} onPress={() => toggleHomework(hw.id)}>
                    <View style={[styles.hwCheckbox, styles.hwCheckboxDone]}>
                      <Text style={styles.hwCheckmarkText}>✓</Text>
                    </View>
                    <View style={styles.hwInfo}>
                      <Text style={[styles.hwSubject, styles.hwSubjectDone]}>{hw.subject}</Text>
                      <Text style={[styles.hwDesc, styles.hwDescDone]}>{hw.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {pendingHW.length === 0 && doneHW.length === 0 && (
              <Text style={styles.emptyText}>Nicio temă adăugată</Text>
            )}
          </View>
        )}
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
  childBanner: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
    backgroundColor: Colors.child.primaryLight,
  },
  childBannerText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.child.primary },
  tabs: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1, height: 36, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  tabActive: { backgroundColor: Colors.child.primary, borderColor: Colors.child.primary },
  tabText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  dayScroll: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  dayChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  dayChipActive: { backgroundColor: Colors.child.primary, borderColor: Colors.child.primary },
  dayChipText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  scheduleList: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'], gap: Spacing.sm },
  scheduleCard: {
    flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    overflow: 'hidden', ...Shadow.sm,
  },
  scheduleTime: {
    width: 72, backgroundColor: Colors.child.primary + '20',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.md,
  },
  scheduleTimeText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.child.primary },
  scheduleInfo: { flex: 1, padding: Spacing.md },
  scheduleSubject: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: 2 },
  scheduleTeacher: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  scheduleRoom: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  hwSection: { padding: Spacing.xl, paddingBottom: Spacing['2xl'], gap: Spacing.md },
  addHWBtn: {
    height: 44, borderRadius: BorderRadius.xl, backgroundColor: Colors.child.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  addHWBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
  addHWCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm,
  },
  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary,
  },
  inputMulti: { height: 60, textAlignVertical: 'top' },
  saveHWBtn: {
    height: 40, borderRadius: BorderRadius.lg, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  saveHWBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
  hwGroupTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  hwCard: {
    flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm,
  },
  hwCardDone: { opacity: 0.6 },
  hwCheckbox: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  hwCheckboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  hwCheckboxText: { fontSize: 16, color: Colors.textTertiary },
  hwCheckmarkText: { fontSize: 14, color: Colors.white, fontFamily: 'Geist-SemiBold' },
  hwInfo: { flex: 1 },
  hwSubject: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: 2 },
  hwSubjectDone: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  hwDesc: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  hwDescDone: { textDecorationLine: 'line-through' },
  hwDue: { fontSize: 12, fontFamily: 'Geist', color: Colors.warning, marginTop: 2 },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
});
