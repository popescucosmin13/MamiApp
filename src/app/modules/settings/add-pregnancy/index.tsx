import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Timestamp } from 'firebase/firestore';
import { authService } from '../../../../services/authService';
import { pregnancyService } from '../../../../services/pregnancyService';
import { useAuthStore } from '../../../../stores/authStore';
import { usePregnancyStore } from '../../../../stores/pregnancyStore';
import { Validators } from '../../../../lib/validation';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius } from '../../../../theme/spacing';
import { Button } from '../../../../components/ui/Button';

import { AppDatePicker } from '../../../../components/ui/AppDatePicker';

function formatDate(date: Date) {
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function toDateInputValue(date: Date) {
  return date.toISOString().split('T')[0];
}

export default function AddPregnancyScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setPregnancy } = usePregnancyStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [lmpDate, setLmpDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 70);
    return date;
  });

  const minDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() - 42 * 7);
    return date;
  })();
  const dueDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);

  const handleSave = async () => {
    if (!user) return;
    const lmpError = Validators.lmpDate(lmpDate);
    if (lmpError) {
      Toast.show({ type: 'error', text1: 'Dată invalidă', text2: lmpError });
      return;
    }

    const pregnancy = {
      lmpDate: Timestamp.fromDate(lmpDate),
      dueDate: Timestamp.fromDate(dueDate),
      babyName: '',
      gender: 'unknown' as const,
      weekStarted: 0,
      bagChecklist: [],
      actsChecklist: [],
      nurseryChecklist: [],
      isActive: true,
    };

    setIsSaving(true);
    try {
      await pregnancyService.createPregnancy(user.uid, pregnancy);
      await authService.updateUserProfile(user.uid, { profileMode: 'pregnancy' });
      useAuthStore.getState().setProfileMode('pregnancy');
      setPregnancy(pregnancy);
      Toast.show({ type: 'success', text1: 'Sarcina a fost adăugată' });
      router.replace('/(tabs)' as any);
    } catch {
      Toast.show({ type: 'error', text1: 'Eroare', text2: 'Nu am putut salva sarcina.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adaugă sarcină</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Detalii sarcină</Text>
        <Text style={styles.subtitle}>
          Alege prima zi a ultimei menstruații, la fel ca în onboarding. Calculăm automat săptămâna curentă și data estimată a nașterii.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Prima zi a ultimei menstruații</Text>
          <AppDatePicker
            value={lmpDate}
            onChange={setLmpDate}
            mode="date"
          />
          <Text style={styles.hint}>Data nașterii estimate: {formatDate(dueDate)}</Text>
        </View>

        <Button
          title={isSaving ? 'Se salvează...' : 'Salvează sarcina'}
          onPress={handleSave}
          loading={isSaving}
          variant="pregnancy"
          style={styles.saveButton}
        />
        {isSaving && <ActivityIndicator color={Colors.pregnancy.primary} style={styles.inlineLoader} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  content: { padding: Spacing.xl, paddingBottom: Spacing['3xl'] },
  title: { fontSize: 28, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing['2xl'] },
  section: { marginBottom: Spacing.xl },
  label: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  dateButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary },
  dateButtonIcon: { fontSize: 18 },
  hint: { marginTop: Spacing.sm, fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  saveButton: { marginTop: Spacing.xl },
  inlineLoader: { marginTop: Spacing.md },
});
