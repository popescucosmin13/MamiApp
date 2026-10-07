import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AccessDenied } from '../components/AccessDenied';
import { Button } from '../components/ui/Button';
import { useAccessControl } from '../hooks/useAccessControl';
import { Colors } from '../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../theme/spacing';

const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';
const SUPPORT_EMAIL = 'support@example.com';

async function openSubscriptionSettings() {
  if (Platform.OS === 'ios') {
    await Linking.openURL(APP_STORE_SUBSCRIPTIONS_URL);
    return;
  }
  if (Platform.OS === 'android') {
    await Linking.openURL(PLAY_STORE_SUBSCRIPTIONS_URL);
    return;
  }
  await Linking.openURL(PLAY_STORE_SUBSCRIPTIONS_URL);
}

export default function ManageSubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { canUseFeature } = useAccessControl();

  if (!canUseFeature('premiumPlans')) {
    return <AccessDenied title={t('manage_subscription.access_denied')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>★</Text>
          </View>

          <Text style={styles.title}>{t('manage_subscription.title')}</Text>
          <Text style={styles.subtitle}>
            {t('manage_subscription.subtitle')}
          </Text>

          <View style={styles.actions}>
            <Button title={t('manage_subscription.open_store')} onPress={openSubscriptionSettings} fullWidth />
            <Button
              title={t('manage_subscription.contact_support')}
              variant="secondary"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Abonament MamiApp`)}
              fullWidth
            />
            <Button title={t('manage_subscription.back_app')} variant="ghost" onPress={() => router.replace('/(tabs)/profile')} fullWidth />
          </View>

          <View style={styles.note}>
            <Text style={styles.noteTitle}>{t('manage_subscription.desktop_title')}</Text>
            <Text style={styles.noteText}>
              {t('manage_subscription.desktop_note')}
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.replace('/modules/settings/subscription' as any)}>
            <Text style={styles.link}>{t('manage_subscription.premium_details')}</Text>
          </TouchableOpacity>
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
    backgroundColor: Colors.pregnancy.primaryLight,
    marginBottom: Spacing.lg,
  },
  icon: {
    fontSize: 32,
    lineHeight: 36,
    color: Colors.pregnancy.primaryDark,
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
  note: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.backgroundSoft,
  },
  noteTitle: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  noteText: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  link: {
    marginTop: Spacing.lg,
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primary,
  },
});
