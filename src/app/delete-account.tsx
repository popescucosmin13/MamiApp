import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../theme/spacing';

const SUPPORT_EMAIL = 'contact@example.com';

export default function DeleteAccountRequestPage() {
  const { t } = useTranslation();
  const deletedData = t('delete_account_page.deleted_items', { returnObjects: true }) as string[];
  const retainedData = t('delete_account_page.retained_items', { returnObjects: true }) as string[];

  const openEmail = () => {
    const subject = encodeURIComponent(t('delete_account_page.email_subject'));
    const body = encodeURIComponent(t('delete_account_page.email_body'));
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>MamiApp</Text>
          <Text style={styles.title}>{t('delete_account_page.title')}</Text>
          <Text style={styles.subtitle}>
            {t('delete_account_page.subtitle')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('delete_account_page.in_app_title')}</Text>
          <Text style={styles.paragraph}>
            {t('delete_account_page.in_app_body')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('delete_account_page.email_title')}</Text>
          <Text style={styles.paragraph}>
            {t('delete_account_page.email_help', { email: SUPPORT_EMAIL })}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openEmail} accessibilityRole="link">
            <Text style={styles.primaryButtonText}>{t('delete_account_page.email_button')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('delete_account_page.deleted_title')}</Text>
          {deletedData.map((item) => (
            <View key={item} style={styles.row}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('delete_account_page.retained_title')}</Text>
          {retainedData.map((item) => (
            <View key={item} style={styles.row}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.paragraph}>
            {t('delete_account_page.retention_note')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('delete_account_page.footer_operator')}</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://example.com/privacy')} accessibilityRole="link">
            <Text style={styles.footerLink}>{t('delete_account_page.privacy_link')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://example.com/terms')} accessibilityRole="link">
            <Text style={styles.footerLink}>{t('delete_account_page.terms_link')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
  },
  header: { marginBottom: Spacing.xl },
  kicker: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    lineHeight: 42,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 24,
    maxWidth: 680,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  paragraph: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  primaryButton: {
    marginTop: Spacing.lg,
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.child.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  bullet: {
    width: 14,
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
    lineHeight: 23,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  footer: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  footerText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center' },
  footerLink: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.child.primaryDark },
});
