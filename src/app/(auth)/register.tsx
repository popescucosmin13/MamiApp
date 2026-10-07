import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { authService } from '../../services/authService';
import { Validators } from '../../lib/validation';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { Input } from '../../components/ui/Input';
import { GradientButton } from '../../components/ui/GradientButton';
import { AuthBackground } from '../../components/auth/AuthBackground';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { useTranslation } from 'react-i18next';

type PasswordStrength = 0 | 1 | 2 | 3;

const STRENGTH_COLORS: Record<Exclude<PasswordStrength, 0>, string> = {
  1: Colors.error,
  2: Colors.warning,
  3: Colors.success,
};

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  return Math.max(1, score) as PasswordStrength;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showExistingAccountActions, setShowExistingAccountActions] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [gdprError, setGdprError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = getPasswordStrength(password);
  const strengthColor = strength !== 0 ? STRENGTH_COLORS[strength] : Colors.textTertiary;
  const strengthLabel =
    strength === 1
      ? t('auth.password_strength_weak')
      : strength === 2
      ? t('auth.password_strength_medium')
      : strength === 3
      ? t('auth.password_strength_strong')
      : '';

  const validate = (): boolean => {
    const nErr = Validators.name(name);
    const eErr = Validators.email(email);
    const pErr = Validators.password(password);
    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (!gdprConsent) {
      setGdprError(true);
      Toast.show({ type: 'error', text1: t('auth.consent_required'), text2: t('auth.must_accept_policy') });
      return false;
    }
    setGdprError(false);
    return !nErr && !eErr && !pErr;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setShowExistingAccountActions(false);
    try {
      const result = await authService.registerWithEmail(email.trim(), password, name.trim());
      Toast.show({
        type: result.verificationEmailQueued ? 'success' : 'info',
        text1: t('auth.account_created'),
        text2: result.verificationEmailQueued
          ? t('auth.verification_email_sent')
          : t('auth.verification_email_error', { error: result.verificationEmailError ?? t('auth.unknown_error') }),
      });
      router.replace('/(auth)/login');
    } catch (err: any) {
      console.warn('Register failed', err?.code, err?.message);
      if (err.code === 'auth/email-already-in-use') {
        setShowExistingAccountActions(true);
      }
      const msg =
        err.code === 'auth/email-already-in-use'
          ? t('auth.error_email_in_use')
          : err.code === 'auth/invalid-email'
          ? t('auth.error_invalid_email')
          : err.code === 'auth/operation-not-allowed'
          ? t('auth.error_operation_not_allowed')
          : err.code === 'auth/admin-restricted-operation'
          ? t('auth.error_admin_restricted')
          : err.code === 'auth/configuration-not-found'
          ? t('auth.error_config_not_found')
          : err.code === 'auth/network-request-failed'
          ? t('auth.error_network')
          : err.code === 'auth/unauthorized-continue-uri'
          ? t('auth.error_unauthorized_domain')
          : err.code === 'auth/invalid-continue-uri'
          ? t('auth.error_invalid_uri')
          : err.code === 'auth/weak-password'
          ? t('auth.error_weak_password')
          : t('auth.error_register_generic');
      Toast.show({ type: 'error', text1: t('auth.register_failed'), text2: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const eErr = Validators.email(email);
    const pErr = Validators.password(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setIsResending(true);
    try {
      await authService.resendVerificationEmail(email.trim(), password);
      Toast.show({
        type: 'success',
        text1: t('auth.email_sent'),
        text2: t('auth.check_inbox_spam'),
      });
      router.replace('/(auth)/login');
    } catch (err: any) {
      console.warn('Register resend verification failed', err?.code, err?.message);
      const msg =
        err.code === 'auth/email-already-verified'
          ? t('auth.error_already_verified')
          : err.code === 'auth/too-many-requests'
          ? t('auth.error_too_many_requests')
          : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? t('auth.error_wrong_credentials')
          : err.code === 'auth/unauthorized-continue-uri'
          ? t('auth.error_unauthorized_domain')
          : t('auth.error_resend_verification');
      Toast.show({ type: 'error', text1: t('auth.resend_failed'), text2: msg });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthBackground variant="warm">
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
              >
                <ArrowLeft size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.title}>{t('auth.create_account')}</Text>
              <Text style={styles.subtitle}>{t('auth.register_subtitle')}</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.card}>
              <Input
                label={t('auth.your_name')}
                value={name}
                onChangeText={(v) => { setName(v); setNameError(null); }}
                autoComplete="name"
                error={nameError ?? undefined}
              />

              <Input
                label={t('auth.email')}
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(null); setShowExistingAccountActions(false); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={emailError ?? undefined}
              />

              <View>
                <Input
                  label={t('auth.password_min')}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPasswordError(null); setShowExistingAccountActions(false); }}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  error={passwordError ?? undefined}
                  containerStyle={styles.passwordInput}
                  suffix={
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
                  }
                />
                {strength > 0 && (
                  <Animated.View entering={FadeIn.duration(250)} style={styles.strengthRow}>
                    <View style={styles.strengthTrack}>
                      {([1, 2, 3] as const).map((segment) => (
                        <View
                          key={segment}
                          style={[
                            styles.strengthSegment,
                            segment <= strength && { backgroundColor: strengthColor },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                      {strengthLabel}
                    </Text>
                  </Animated.View>
                )}
              </View>

              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => { setGdprConsent(!gdprConsent); setGdprError(false); }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, gdprConsent && styles.checkboxChecked, gdprError && !gdprConsent && styles.checkboxError]}>
                  {gdprConsent && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentText}>
                  {t('auth.accept')}{' '}
                  <Text style={styles.consentLink}>{t('auth.privacy_policy')}</Text>
                  {' '}{t('auth.and')}{' '}
                  <Text style={styles.consentLink}>{t('auth.terms_conditions')}</Text>
                  <Text style={styles.consentRequired}> *</Text>
                </Text>
              </TouchableOpacity>
              {gdprError && !gdprConsent && (
                <Text style={styles.consentErrorText}>{t('auth.must_accept_terms')}</Text>
              )}

              <GradientButton
                title={t('auth.create_account')}
                onPress={handleRegister}
                loading={isLoading}
                style={styles.registerButton}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <GoogleSignInButton disabled={isLoading || isResending} />

              {showExistingAccountActions && (
                <View style={styles.existingAccountBox}>
                  <Text style={styles.existingAccountText}>
                    {t('auth.email_exists_resend')}
                  </Text>
                  <TouchableOpacity
                    onPress={handleResendVerification}
                    style={styles.resendButton}
                    disabled={isResending}
                  >
                    <Text style={styles.resendText}>
                      {isResending ? t('common.sending') : t('auth.resend_verification')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeIn.delay(320).duration(500)} style={styles.footer}>
              <View style={styles.loginRow}>
                <Text style={styles.loginText}>{t('auth.have_account')} </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.loginLink}>{t('auth.login_link')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.secureRow}>
                <ShieldCheck size={14} color={Colors.textTertiary} />
                <Text style={styles.secureText}>{t('auth.secure_note')}</Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  header: {
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surfaceStrong,
    borderRadius: BorderRadius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.md,
  },
  passwordInput: {
    marginBottom: 0,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  strengthTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232,153,122,0.15)',
  },
  strengthLabel: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.child.primary,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.child.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: 'Geist-Bold',
  },
  checkboxError: {
    borderColor: Colors.error,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  consentLink: {
    color: Colors.child.primaryDark,
    fontFamily: 'Geist-SemiBold',
  },
  consentRequired: {
    color: Colors.error,
    fontFamily: 'Geist-SemiBold',
  },
  consentErrorText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.error,
    marginTop: -Spacing.sm,
    marginLeft: 30,
  },
  registerButton: {
    marginTop: Spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  existingAccountBox: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.child.primaryLight,
  },
  existingAccountText: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primary,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secureText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
});
