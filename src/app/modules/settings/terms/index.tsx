import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius } from '../../../../theme/spacing';

interface TermsSection {
  title: string;
  content: string;
}

export default function TermsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const sections = t('terms_page.sections', { returnObjects: true }) as TermsSection[];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>{t('legal_common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('terms_page.title')}</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>{t('terms_page.meta_title')}</Text>
          <Text style={styles.metaSubtitle}>{t('terms_page.meta_subtitle')}</Text>
          <View style={styles.metaDivider} />
          <Text style={styles.metaText}>{t('legal_common.effective')}</Text>
          <Text style={styles.metaText}>{t('legal_common.updated')}</Text>
        </View>

        <View style={styles.importantBanner}>
          <Text style={styles.importantBannerText}>{t('terms_page.banner')}</Text>
        </View>

        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.links}>
          <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('mailto:contact@example.com')}>
            <Text style={styles.linkText}>{t('legal_common.contact')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('https://example.com')}>
            <Text style={styles.linkText}>{t('legal_common.site')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>{t('terms_page.footer')}</Text>
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
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  backArrow: { fontSize: 20, color: Colors.textPrimary },
  backLabel: { fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary },
  headerTitle: { fontSize: 17, fontFamily: 'Fraunces', color: Colors.textPrimary },
  scrollContent: { paddingBottom: Spacing['2xl'] },
  metaCard: { margin: Spacing.xl, backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  metaTitle: { fontSize: 16, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.xs },
  metaSubtitle: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  metaDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  metaText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 2 },
  importantBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.child.primary,
  },
  importantBannerText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm, letterSpacing: 0.1 },
  sectionContent: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 21 },
  links: { paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.lg },
  linkButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.md, alignItems: 'center' },
  linkText: { fontSize: 13, fontFamily: 'Geist', color: Colors.child.primary },
  footerNote: { textAlign: 'center', fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, lineHeight: 17 },
});
