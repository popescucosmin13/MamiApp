import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Timestamp } from 'firebase/firestore';
import { childService } from '../../../../services/childService';
import { authService } from '../../../../services/authService';
import { useAuthStore } from '../../../../stores/authStore';
import { useChildStore } from '../../../../stores/childStore';
import { Colors } from '../../../../theme/colors';
import { Spacing } from '../../../../theme/spacing';
import { Button } from '../../../../components/ui/Button';

import { AppDatePicker } from '../../../../components/ui/AppDatePicker';

export default function AddChildScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState<'male' | 'female' | 'other'>('other');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });

  const handleSave = async () => {
    if (isSaving) return;
    if (!user) return;
    if (!childName.trim()) {
      Toast.show({ type: 'error', text1: 'Introdu numele bebelușului' });
      return;
    }

    setIsSaving(true);
    try {
      const childData = {
        name: childName.trim(),
        gender: childGender,
        birthDate: Timestamp.fromDate(birthDate),
        birthWeight: 0,
        birthHeight: 0,
        birthHeadCircumference: 0,
        birthType: 'natural' as const,
        isActive: true,
      };
      const childId = await childService.createOrGetChild(user.uid, childData);
      useChildStore.getState().setActiveChild({ id: childId, ...childData });
      await Promise.allSettled([
        childService.initializeVaccines(user.uid, childId, birthDate),
        childService.initializeMilestones(user.uid, childId),
      ]);
      await Promise.all([
        authService.updateUserProfile(user.uid, {
          profileMode: 'child',
          onboardingCompleted: true,
        }),
      ]);
      useAuthStore.getState().setProfileMode('child');
      Toast.show({ type: 'success', text1: 'Bebeluș adăugat' });
      router.replace('/(tabs)' as any);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Eroare', text2: 'Nu am putut salva bebelușul.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Adaugă bebeluș</Text>
        <Text style={styles.subtitle}>
          Completează câteva detalii ca să personalizezi urmărirea hrănirii, somnului și creșterii.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Numele bebelușului</Text>
          <TextInput
            style={styles.textInput}
            value={childName}
            onChangeText={setChildName}
            placeholder="ex: Maria, Andrei..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Gen</Text>
          <View style={styles.genderRow}>
            {(['female', 'male', 'other'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderButton, childGender === g && styles.genderButtonActive]}
                onPress={() => setChildGender(g)}
              >
                <Text style={styles.genderEmoji}>{g === 'female' ? '👧' : g === 'male' ? '👦' : '🤍'}</Text>
                <Text style={[styles.genderLabel, childGender === g && styles.genderLabelActive]}>
                  {g === 'female' ? 'Fată' : g === 'male' ? 'Băiat' : 'Necunoscut'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Data nașterii</Text>
          <AppDatePicker
            value={birthDate}
            onChange={setBirthDate}
            mode="date"
          />
        </View>

        <Button
          title={isSaving ? 'Se salvează...' : 'Salvează bebelușul'}
          onPress={handleSave}
          loading={isSaving}
          style={styles.saveButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  backButton: {
    marginBottom: Spacing.xl,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    marginBottom: Spacing['2xl'],
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  genderButton: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
  },
  genderButtonActive: {
    borderColor: Colors.child.primary,
    backgroundColor: Colors.child.primaryLight,
  },
  genderEmoji: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  genderLabel: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  genderLabelActive: {
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
  },
  dateButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  dateButtonIcon: {
    fontSize: 20,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
});
