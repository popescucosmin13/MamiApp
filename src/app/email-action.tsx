import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { Button } from '../components/ui/Button';
import { auth } from '../services/firebase';
import { Colors } from '../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../theme/spacing';

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function EmailActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificăm adresa de email...');

  const verifyEmail = useCallback(async () => {
    const mode = getParam(params.mode);
    const oobCode = getParam(params.oobCode);

    if (mode !== 'verifyEmail' || !oobCode) {
      setStatus('error');
      setMessage('Linkul de verificare este invalid.');
      return;
    }

    try {
      await checkActionCode(auth, oobCode);
      await applyActionCode(auth, oobCode);
      await auth.currentUser?.reload().catch(() => {});
      setStatus('success');
      setMessage('Emailul tău a fost confirmat. Te poți autentifica în MamiApp.');
    } catch (err: any) {
      setStatus('error');
      const code = err?.code;
      setMessage(
        code === 'auth/expired-action-code'
          ? 'Linkul de verificare a expirat. Cere retrimiterea emailului din pagina de autentificare.'
          : code === 'auth/invalid-action-code'
            ? 'Linkul de verificare este invalid sau a fost deja folosit.'
            : 'Nu am putut confirma emailul. Încearcă din nou sau cere retrimiterea linkului.'
      );
    }
  }, [params.mode, params.oobCode]);

  useEffect(() => {
    verifyEmail();
  }, [verifyEmail]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {status === 'loading' ? (
              <ActivityIndicator color={Colors.child.primary} />
            ) : (
              <Text style={styles.icon}>{status === 'success' ? '✓' : '!'}</Text>
            )}
          </View>

          <Text style={styles.title}>
            {status === 'success'
              ? 'Email confirmat'
              : status === 'error'
                ? 'Verificare eșuată'
                : 'Confirmăm emailul'}
          </Text>
          <Text style={styles.subtitle}>{message}</Text>

          {status !== 'loading' && (
            <Button
              title={status === 'success' ? 'Intră în cont' : 'Mergi la autentificare'}
              onPress={() => router.replace('/(auth)/login')}
              style={styles.button}
              fullWidth
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    alignItems: 'center',
    padding: Spacing['2xl'],
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.child.primaryLight,
    marginBottom: Spacing.lg,
  },
  icon: {
    fontSize: 34,
    lineHeight: 38,
    color: Colors.child.primaryDark,
    fontFamily: 'Geist-Bold',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.xl,
  },
});
