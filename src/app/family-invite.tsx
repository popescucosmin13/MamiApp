import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { childService } from '../services/childService';
import { getFirebaseFunctions } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { Colors } from '../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../theme/spacing';

type AcceptResult = {
  success?: boolean;
  alreadyAccepted?: boolean;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function FamilyInviteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { user, isInitialized } = useAuthStore();
  const { setActiveChild } = useChildStore();
  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const token = getParam(params.token);
  const owner = getParam(params.owner);
  const invitePath = useMemo(() => {
    if (!token || !owner) return '/family-invite';
    return `/family-invite?token=${encodeURIComponent(token)}&owner=${encodeURIComponent(owner)}`;
  }, [owner, token]);

  useEffect(() => {
    if (Platform.OS === 'web' && token && owner && typeof localStorage !== 'undefined') {
      localStorage.setItem('mamiapp_pending_family_invite', invitePath);
    }
  }, [invitePath, owner, token]);

  const acceptInvite = useCallback(async () => {
    if (!token || !owner) {
      setStatus('error');
      setMessage(t('family_invite.invalid_link'));
      return;
    }
    if (!user) return;

    setStatus('accepting');
    setMessage('');
    try {
      const functions = await getFirebaseFunctions();
      const acceptFamilyInvitation = httpsCallable<{ token: string; owner: string }, AcceptResult>(
        functions,
        'acceptFamilyInvitation'
      );
      const result = await acceptFamilyInvitation({ token, owner });
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem('mamiapp_pending_family_invite');
      }
      const children = await childService.getAllChildren(user.uid).catch(() => []);
      const sharedChild = children.find((child) => child.ownerId === owner) || children.find((child) => child.isShared);
      if (sharedChild) setActiveChild(sharedChild);
      setStatus('success');
      setMessage(result.data.alreadyAccepted
        ? t('family_invite.already_accepted')
        : t('family_invite.accepted'));
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || t('family_invite.accept_error'));
    }
  }, [owner, setActiveChild, t, token, user]);

  useEffect(() => {
    if (!isInitialized || !user || status !== 'idle') return;
    acceptInvite();
  }, [acceptInvite, isInitialized, status, user]);

  const needsLogin = isInitialized && !user;
  const isBusy = !isInitialized || status === 'accepting';
  const title = status === 'success'
    ? t('family_invite.title_success')
    : status === 'error'
      ? t('family_invite.title_error')
      : needsLogin
        ? t('family_invite.title_login')
        : t('family_invite.title_accepting');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isBusy ? (
              <ActivityIndicator color={Colors.child.primary} />
            ) : (
              <Text style={styles.icon}>{status === 'success' ? '✓' : '!'}</Text>
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {needsLogin
              ? t('family_invite.login_message')
              : message || t('family_invite.checking')}
          </Text>

          {needsLogin && (
            <View style={styles.actions}>
              <Button title={t('family_invite.login_btn')} onPress={() => router.push('/(auth)/login')} fullWidth />
              <Button title={t('family_invite.register_btn')} variant="secondary" onPress={() => router.push('/(auth)/register')} fullWidth />
            </View>
          )}

          {status === 'success' && (
            <Button
              title={t('family_invite.go_app')}
              onPress={() => router.replace('/(tabs)')}
              style={styles.button}
              fullWidth
            />
          )}

          {status === 'error' && (
            <View style={styles.actions}>
              {user && <Button title={t('common.try_again')} onPress={acceptInvite} fullWidth />}
              <Button title={t('common.back')} variant="secondary" onPress={() => router.replace('/')} fullWidth />
            </View>
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
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    marginTop: Spacing.xl,
  },
});
