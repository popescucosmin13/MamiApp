import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../../../../services/firebase';
import { authService } from '../../../../services/authService';
import { useAuthStore } from '../../../../stores/authStore';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius } from '../../../../theme/spacing';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibleFields, setVisibleFields] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleChange = async () => {
    if (!user || !user.email) return;

    if (newPassword.length < 6) {
      Alert.alert(t('change_password.too_short_title'), t('change_password.too_short_msg'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('change_password.mismatch_title'), t('change_password.mismatch_msg'));
      return;
    }
    if (!currentPassword) {
      Alert.alert(t('change_password.need_current_title'), t('change_password.need_current_msg'));
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert(t('change_password.success_title'), t('change_password.success_msg'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        Alert.alert(t('change_password.wrong_password_title'), t('change_password.wrong_password_msg'));
      } else {
        Alert.alert(t('change_password.error_title'), t('change_password.error_msg'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email || resetLoading) return;
    setResetLoading(true);
    try {
      await authService.resetPassword(user.email);
      Alert.alert(t('change_password.reset_sent_title'), t('change_password.reset_sent_msg', { email: user.email }));
    } catch {
      Alert.alert(t('change_password.error_title'), t('change_password.reset_error'));
    } finally {
      setResetLoading(false);
    }
  };

  const renderPasswordField = (
    key: keyof typeof visibleFields,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    hasError = false
  ) => (
    <View style={[styles.passwordInputWrap, hasError && styles.inputError]}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        secureTextEntry={!visibleFields[key]}
      />
      <TouchableOpacity
        onPress={() => setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }))}
        accessibilityRole="button"
        accessibilityLabel={visibleFields[key] ? t('auth.hide_password') : t('auth.show_password')}
        hitSlop={8}
      >
        {visibleFields[key] ? (
          <EyeOff size={20} color={Colors.textSecondary} />
        ) : (
          <Eye size={20} color={Colors.textSecondary} />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('change_password.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('change_password.current_label')}</Text>
            {renderPasswordField('current', currentPassword, setCurrentPassword, t('change_password.current_label'))}
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('change_password.new_label')}</Text>
            {renderPasswordField('next', newPassword, setNewPassword, t('change_password.min_placeholder'))}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('change_password.confirm_label')}</Text>
            {renderPasswordField(
              'confirm',
              confirmPassword,
              setConfirmPassword,
              t('change_password.repeat_placeholder'),
              Boolean(confirmPassword && newPassword !== confirmPassword)
            )}
            {confirmPassword && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>{t('change_password.no_match')}</Text>
            )}
          </View>

          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>{t('change_password.requirements_title')}</Text>
            {[
              { label: t('change_password.req_min'), met: newPassword.length >= 6 },
              { label: t('change_password.req_match'), met: newPassword === confirmPassword && newPassword.length > 0 },
            ].map((req, i) => (
              <Text key={i} style={[styles.requirementItem, req.met && styles.requirementMet]}>
                {req.met ? '✓' : '○'} {req.label}
              </Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.changeBtn, loading && styles.changeBtnDisabled]}
            onPress={handleChange}
            disabled={loading}
          >
            <Text style={styles.changeBtnText}>
              {loading ? t('change_password.processing') : t('change_password.submit')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleResetPassword}
            disabled={resetLoading}
          >
            <Text style={[styles.forgotBtnText, resetLoading && { opacity: 0.5 }]}>
              {resetLoading ? t('change_password.sending_email') : t('change_password.forgot')}
            </Text>
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
  form: { padding: Spacing.xl, gap: Spacing.lg },
  fieldGroup: {},
  fieldLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  passwordInputWrap: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.error },
  errorText: { fontSize: 12, fontFamily: 'Geist', color: Colors.error, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border },
  requirements: {
    backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  requirementsTitle: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  requirementItem: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 22 },
  requirementMet: { color: Colors.success, fontFamily: 'Geist-SemiBold' },
  changeBtn: {
    height: 52, borderRadius: BorderRadius.xl, backgroundColor: Colors.child.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  changeBtnDisabled: { opacity: 0.5 },
  changeBtnText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },
  forgotBtn: { alignItems: 'center' },
  forgotBtnText: { fontSize: 13, fontFamily: 'Geist', color: Colors.child.primary },
});
