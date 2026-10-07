import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '../../../../i18n';
import { authService } from '../../../../services/authService';
import { useAuthStore } from '../../../../stores/authStore';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

const LANGUAGES = [
  { code: 'ro', label: 'Română', nativeLabel: 'Română', flag: '🇷🇴', available: true },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧', available: true },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, profile, setProfile } = useAuthStore();
  const currentLang = getCurrentLanguage();

  const handleSelectLanguage = async (lang: typeof LANGUAGES[0]) => {
    if (lang.code === currentLang) return;
    await changeLanguage(lang.code as 'ro' | 'en');
    if (user) {
      await authService.updateUserProfile(user.uid, { locale: lang.code as 'ro' | 'en' });
      if (profile) setProfile({ ...profile, locale: lang.code as 'ro' | 'en' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('language.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{t('language.info')}</Text>
        </View>

        <View style={styles.list}>
          {LANGUAGES.map((lang) => {
            const isActive = currentLang === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langRow, isActive && styles.langRowActive]}
                onPress={() => handleSelectLanguage(lang)}
                activeOpacity={0.7}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={styles.langInfo}>
                  <Text style={styles.langLabel}>{lang.nativeLabel}</Text>
                </View>
                {isActive && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedCheck}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  infoCard: {
    margin: Spacing.xl, backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  infoText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  list: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm,
  },
  langRowActive: { borderColor: Colors.child.primary },
  langFlag: { fontSize: 28 },
  langInfo: { flex: 1 },
  langLabel: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  selectedBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.child.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedCheck: { fontSize: 14, color: Colors.white, fontFamily: 'Geist-SemiBold' },
});
