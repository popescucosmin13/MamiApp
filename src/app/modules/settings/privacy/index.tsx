import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius } from '../../../../theme/spacing';

interface PrivacySection {
  emoji: string;
  title: string;
  body: string;
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const sections = t('privacy_page.sections', { returnObjects: true }) as PrivacySection[];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('privacy_page.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroBanner}>
          <Text style={styles.heroEmoji}>🛡️</Text>
          <Text style={styles.heroTitle}>{t('privacy_page.hero_title')}</Text>
          <Text style={styles.heroSubtitle}>{t('privacy_page.hero_subtitle')}</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t('privacy_page.badge')}</Text>
          </View>
        </View>

        {sections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.paragraph}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.linksCard}>
          <Text style={styles.linksTitle}>{t('privacy_page.links_title')}</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://example.com/privacy')}>
            <Text style={styles.linkText}>{t('privacy_page.online_policy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://example.com/terms')}>
            <Text style={styles.linkText}>{t('privacy_page.terms')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('mailto:contact@example.com')}>
            <Text style={styles.linkText}>{t('privacy_page.dpo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://www.dataprotection.ro')}>
            <Text style={styles.linkText}>{t('privacy_page.authority')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLine}>{t('privacy_page.footer_operator')}</Text>
          <Text style={styles.footerLine}>{t('privacy_page.footer_dpo')}</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.footerLine}>{t('legal_common.effective')}</Text>
          <Text style={styles.footerLine}>{t('legal_common.updated')}</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.footerSmall}>{t('privacy_page.footer_note')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 16, fontFamily: 'Fraunces', color: Colors.textPrimary, textAlign: 'center', flex: 1 },
  scrollContent: { paddingBottom: Spacing['2xl'] },
  heroBanner: {
    margin: Spacing.xl,
    backgroundColor: Colors.info + '12',
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 52, marginBottom: Spacing.sm },
  heroTitle: { fontSize: 20, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' },
  heroSubtitle: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.md },
  heroBadge: {
    backgroundColor: Colors.info + '20',
    borderRadius: BorderRadius.full ?? 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.info + '40',
  },
  heroBadgeText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.info },
  sectionCard: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md, gap: Spacing.sm },
  sectionEmoji: { fontSize: 20, lineHeight: 24, marginTop: 1 },
  sectionTitle: { flex: 1, fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, lineHeight: 22 },
  paragraph: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20 },
  linksCard: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  linksTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  linkRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  linkText: { fontSize: 14, fontFamily: 'Geist', color: Colors.child?.primary ?? Colors.info },
  footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing['2xl'], alignItems: 'center', gap: 4 },
  footerLine: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center' },
  footerDivider: { height: 1, width: 60, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  footerSmall: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', lineHeight: 17, paddingHorizontal: Spacing.md },
});
