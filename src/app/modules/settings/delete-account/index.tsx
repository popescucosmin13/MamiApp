import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { auth, getFirebaseFunctions } from '../../../../services/firebase';
import { useAuthStore } from '../../../../stores/authStore';
import { authService } from '../../../../services/authService';
import { purchasesService } from '../../../../services/purchasesService';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, reset } = useAuthStore();
  const { t } = useTranslation();
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const CONFIRM_TEXT = t('delete_account.confirm_text');

  const CONSEQUENCES = [
    t('delete_account.c1'),
    t('delete_account.c2'),
    t('delete_account.c3'),
    t('delete_account.c4'),
    t('delete_account.c5'),
    t('delete_account.c6'),
  ];

  const handleDeleteRequest = async () => {
    if (confirmation !== CONFIRM_TEXT) {
      Alert.alert(t('delete_account.confirm_wrong_title'), t('delete_account.confirm_wrong_msg', { text: CONFIRM_TEXT }));
      return;
    }
    setStep(2);
  };

  const handleFinalDelete = async () => {
    if (!password.trim()) {
      Alert.alert(t('delete_account.need_password_title'), t('delete_account.need_password_msg'));
      return;
    }
    if (!user?.email) {
      Alert.alert(t('delete_account.account_error_title'), t('delete_account.account_error_msg'));
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('no-user');
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(currentUser, credential);

      const functions = await getFirebaseFunctions('europe-west1');
      const deleteAccountFn = httpsCallable<void, { success: boolean }>(functions, 'deleteAccount');
      await deleteAccountFn();

      purchasesService.logOut().catch(() => {});
      reset();

      Alert.alert(
        t('delete_account.deleted_title'),
        t('delete_account.deleted_msg'),
        [{ text: 'OK', onPress: () => router.replace('/(auth)/welcome' as any) }]
      );
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        Alert.alert(t('delete_account.wrong_password_title'), t('delete_account.wrong_password_msg'));
      } else {
        Alert.alert(t('delete_account.error_title'), t('delete_account.error_msg'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('delete_account.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.warningBanner}>
          <Text style={styles.warningEmoji}>⚠️</Text>
          <Text style={styles.warningTitle}>{t('delete_account.irreversible_title')}</Text>
          <Text style={styles.warningText}>{t('delete_account.irreversible_text')}</Text>
        </View>

        <View style={styles.consequencesCard}>
          <Text style={styles.consequencesTitle}>{t('delete_account.what_happens')}</Text>
          {CONSEQUENCES.map((c, i) => (
            <View key={i} style={styles.consequenceRow}>
              <Text style={styles.consequenceDot}>✕</Text>
              <Text style={styles.consequenceText}>{c}</Text>
            </View>
          ))}
        </View>

        {step === 1 ? (
          <View style={styles.confirmSection}>
            <Text style={styles.confirmLabel}>
              {t('delete_account.confirm_label')}<Text style={styles.confirmRequired}>{CONFIRM_TEXT}</Text>
            </Text>
            <TextInput
              style={[styles.input, confirmation === CONFIRM_TEXT && styles.inputValid]}
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder={CONFIRM_TEXT}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.nextBtn, confirmation !== CONFIRM_TEXT && styles.nextBtnDisabled]}
              onPress={handleDeleteRequest}
              disabled={confirmation !== CONFIRM_TEXT}
            >
              <Text style={styles.nextBtnText}>{t('delete_account.continue_btn')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.confirmSection}>
            <Text style={styles.confirmLabel}>
              {t('delete_account.enter_password', { email: user?.email })}
            </Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={t('delete_account.password_placeholder')}
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.textSecondary} />
                ) : (
                  <Eye size={20} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.finalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep(1)}>
                <Text style={styles.cancelBtnText}>{t('delete_account.back_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, loading && styles.deleteBtnDisabled]}
                onPress={handleFinalDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.deleteBtnText}>{t('delete_account.delete_btn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.alternativeCard}>
          <Text style={styles.alternativeTitle}>{t('delete_account.alt_title')}</Text>
          <Text style={styles.alternativeText}>{t('delete_account.alt_text')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)' as any)}>
            <Text style={styles.alternativeLink}>{t('delete_account.alt_link')}</Text>
          </TouchableOpacity>
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
  warningBanner: {
    margin: Spacing.xl, backgroundColor: Colors.error + '10', borderRadius: BorderRadius.xl,
    padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.error + '30',
  },
  warningEmoji: { fontSize: 40, marginBottom: Spacing.sm },
  warningTitle: { fontSize: 18, fontFamily: 'Geist-SemiBold', color: Colors.error, marginBottom: Spacing.xs },
  warningText: { fontSize: 13, fontFamily: 'Geist', color: Colors.error, textAlign: 'center', lineHeight: 19 },
  consequencesCard: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing.xl,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  consequencesTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  consequenceRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  consequenceDot: { fontSize: 13, color: Colors.error, fontFamily: 'Geist-SemiBold', lineHeight: 20 },
  consequenceText: { flex: 1, fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  confirmSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  confirmLabel: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.md },
  confirmRequired: { fontFamily: 'Geist-SemiBold', color: Colors.error },
  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  inputValid: { borderColor: Colors.success },
  passwordInputWrap: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary,
  },
  nextBtn: {
    height: 52, borderRadius: BorderRadius.xl, backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnDisabled: { backgroundColor: Colors.border },
  nextBtnText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },
  finalActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: BorderRadius.xl, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  deleteBtn: {
    flex: 2, height: 52, borderRadius: BorderRadius.xl, backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
  alternativeCard: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing['2xl'],
    backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  alternativeTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  alternativeText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19, marginBottom: Spacing.sm },
  alternativeLink: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.child.primary },
});
