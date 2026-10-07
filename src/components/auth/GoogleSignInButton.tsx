import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { authService } from '../../services/authService';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

type GoogleSignInButtonProps = {
  disabled?: boolean;
};

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityLabel="Google">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.16.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.6-2.6C13.46.86 11.42 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </Svg>
  );
}

function getClientIdForPlatform() {
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

function getRedirectUriForPlatform() {
  if (Platform.OS !== 'web') return undefined;
  return globalThis.location?.origin;
}

export default function GoogleSignInButton({ disabled }: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const hasClientId = Boolean(getClientIdForPlatform());

  if (!hasClientId) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.buttonDisabled]}
        onPress={() => {
          Toast.show({ type: 'error', text1: t('auth.google_unconfigured'), text2: t('auth.google_unconfigured_msg') });
        }}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={t('auth.continue_with_google')}
      >
        <View style={styles.googleMark}>
          <GoogleLogo />
        </View>
        <Text style={styles.buttonText}>{t('auth.continue_with_google')}</Text>
      </TouchableOpacity>
    );
  }

  return <ConfiguredGoogleSignInButton disabled={disabled} />;
}

function ConfiguredGoogleSignInButton({ disabled }: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const googleConfig = useMemo(() => ({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: getRedirectUriForPlatform(),
    scopes: ['openid', 'profile', 'email'],
  }), []);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig);

  useEffect(() => {
    const complete = async () => {
      if (response?.type !== 'success') return;
      const idToken = response.params?.id_token;
      if (!idToken) {
        Toast.show({ type: 'error', text1: t('auth.google_failed'), text2: t('auth.google_missing_token') });
        return;
      }

      setLoading(true);
      try {
        await authService.loginWithGoogleIdToken(idToken);
      } catch (err: any) {
        const message =
          err?.code === 'auth/account-exists-with-different-credential'
            ? t('auth.google_account_exists')
            : t('auth.google_generic_error');
        Toast.show({ type: 'error', text1: t('auth.google_failed'), text2: message });
      } finally {
        setLoading(false);
      }
    };

    complete();
  }, [response, t]);

  const handlePress = async () => {
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') setLoading(false);
    } catch {
      setLoading(false);
      Toast.show({ type: 'error', text1: t('auth.google_failed'), text2: t('auth.google_generic_error') });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading || !request) && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={disabled || loading || !request}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={t('auth.continue_with_google')}
    >
      {loading ? (
        <ActivityIndicator color={Colors.textPrimary} size="small" />
      ) : (
        <>
          <View style={styles.googleMark}>
            <GoogleLogo />
          </View>
          <Text style={styles.buttonText}>{t('auth.continue_with_google')}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  googleMark: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: '#3C4043',
  },
});
