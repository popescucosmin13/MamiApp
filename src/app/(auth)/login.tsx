import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
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

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = (): boolean => {
    const eErr = Validators.email(email);
    const pErr = Validators.password(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    return !eErr && !pErr;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setShowResendVerification(false);
    try {
      await authService.loginWithEmail(email.trim(), password);
    } catch (err: any) {
      console.warn('Login failed', err?.code, err?.message);
      if (err.code === 'auth/email-not-verified') {
        setShowResendVerification(true);
      }
      const msg =
        err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? t('auth.error_wrong_credentials')
          : err.code === 'auth/email-not-verified'
          ? t('auth.error_email_not_verified')
          : err.code === 'auth/too-many-requests'
          ? t('auth.error_too_many_requests')
          : t('auth.error_login_generic');
      Toast.show({ type: 'error', text1: t('auth.login_failed'), text2: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const eErr = Validators.email(email);
    if (eErr) {
      setEmailError(eErr);
      Toast.show({ type: 'error', text1: t('auth.enter_email_first') });
      return;
    }
    try {
      await authService.resetPassword(email.trim());
      Toast.show({
        type: 'success',
        text1: t('auth.email_sent'),
        text2: t('auth.check_email_reset'),
      });
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('auth.error_send_email') });
    }
  };

  const handleResendVerification = async () => {
    if (!validate()) return;
    setIsResending(true);
    try {
      await authService.resendVerificationEmail(email.trim(), password);
      Toast.show({
        type: 'success',
        text1: t('auth.email_sent'),
        text2: t('auth.check_inbox_spam'),
      });
    } catch (err: any) {
      console.warn('Resend verification failed', err?.code, err?.message);
      const msg =
        err.code === 'auth/email-already-verified'
          ? t('auth.error_already_verified')
          : err.code === 'auth/unauthorized-continue-uri'
          ? t('auth.error_unauthorized_domain')
          : err.code === 'auth/invalid-continue-uri'
          ? t('auth.error_invalid_uri')
          : err.code === 'auth/too-many-requests'
          ? t('auth.error_too_many_requests')
          : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? t('auth.error_wrong_credentials')
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
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.title}>{t('auth.welcome_back')}</Text>
              <Text style={styles.subtitle}>{t('auth.login_subtitle')}</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.card}>
              <Input
                label={t('auth.email')}
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={emailError ?? undefined}
              />

              <Input
                label={t('auth.password')}
                value={password}
                onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                error={passwordError ?? undefined}
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

              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
              </TouchableOpacity>

              <GradientButton
                title={t('auth.login_button')}
                onPress={handleLogin}
                loading={isLoading}
                style={styles.loginButton}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <GoogleSignInButton disabled={isLoading || isResending} />

              {showResendVerification && (
                <TouchableOpacity
                  onPress={handleResendVerification}
                  style={styles.resendButton}
                  disabled={isResending}
                >
                  <Text style={styles.resendText}>
                    {isResending ? t('common.sending') : t('auth.resend_verification')}
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            <Animated.View entering={FadeIn.delay(320).duration(500)} style={styles.footer}>
              <View style={styles.registerRow}>
                <Text style={styles.registerText}>{t('auth.no_account')} </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                  <Text style={styles.registerLink}>{t('auth.register_link')}</Text>
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
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  title: {
    fontSize: 32,
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
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.xs,
  },
  forgotText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
  },
  loginButton: {
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
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  registerLink: {
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
