import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

interface AccessDeniedProps {
  title?: string;
  message?: string;
}

export function AccessDenied({ title, message }: AccessDeniedProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const displayTitle = title ?? t('access_denied.default_title');
  const displayMessage = message ?? t('access_denied.message');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>{displayTitle}</Text>
        <Text style={styles.message}>{displayMessage}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon: {
    fontSize: 44,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: 'Fraunces',
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: 'Geist',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  button: {
    backgroundColor: Colors.child.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  buttonText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    color: Colors.white,
  },
});
