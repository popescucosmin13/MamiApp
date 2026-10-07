import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

export default function GratitudeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('wellbeing_simple.gratitude_header')}</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('wellbeing_simple.gratitude_title')}</Text>
          <Text style={styles.text}>{t('wellbeing_simple.gratitude_text')}</Text>
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>{t('wellbeing_simple.soon')}</Text>
          </View>
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
  content: { padding: Spacing.xl },
  card: { backgroundColor: Colors.white, padding: Spacing.xl, borderRadius: BorderRadius.xl, ...Shadow.sm },
  title: { fontSize: 18, fontFamily: 'Geist-SemiBold', marginBottom: Spacing.md, color: Colors.textPrimary },
  text: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  placeholderBox: { backgroundColor: Colors.backgroundSoft, padding: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center' },
  placeholderText: { fontFamily: 'Geist', color: Colors.textTertiary },
});
