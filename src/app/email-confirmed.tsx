import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Colors } from '../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../theme/spacing';

export default function EmailConfirmedScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>✓</Text>
          </View>

          <Text style={styles.title}>{t('email_confirmed.title')}</Text>
          <Text style={styles.subtitle}>
            {t('email_confirmed.subtitle')}
          </Text>

          <Button
            title={t('email_confirmed.login_btn')}
            onPress={() => router.replace('/(auth)/login')}
            style={styles.button}
          />
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
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
  },
});
