import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

export default function SafetyScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const forbiddenRules = isEnglish
    ? [
        {
          title: 'Honey',
          desc: 'Risk of infant botulism. Do not offer honey at all, even if it has been cooked.',
        },
        {
          title: 'Added salt',
          desc: 'A baby\'s kidneys cannot process excess salt. Natural foods and milk already provide enough sodium.',
        },
        {
          title: 'Added sugar',
          desc: 'It has no nutritional benefit and increases the risk of obesity and early tooth decay.',
        },
        {
          title: 'Cow\'s milk as the main drink',
          desc: 'It does not provide enough iron and can overload the kidneys. It can be used only in cooked foods, yogurt or cheese, not as a replacement for breast milk or formula.',
        },
      ]
    : [
        {
          title: 'Mierea',
          desc: 'Risc fatal de botulism infantil. Nu oferi niciodată miere, nici măcar preparată termic.',
        },
        {
          title: 'Sare adăugată',
          desc: 'Rinichii bebelușului nu pot procesa sarea în exces. Alimentele naturale și laptele aduc deja suficient sodiu.',
        },
        {
          title: 'Zahăr adăugat',
          desc: 'Nu aduce niciun beneficiu nutrițional și crește riscul de obezitate și carii precoce.',
        },
        {
          title: 'Lapte de vacă drept băutură principală',
          desc: 'Nu are fierul necesar și poate suprasolicita rinichii. Poate fi folosit doar în preparate gătite, iaurt sau brânză, nu ca înlocuitor pentru laptele matern sau formulă.',
        },
      ];

  const chokingRules = isEnglish
    ? [
        { title: 'Grapes, cherry tomatoes', desc: 'Always cut lengthwise into quarters.' },
        { title: 'Nuts and peanuts', desc: 'Never offer whole. Serve finely ground or as a thin nut butter.' },
        { title: 'Hard fruit or vegetables', desc: 'Grate finely or cook until soft enough to squash between your fingers.' },
        { title: 'Round pieces', desc: 'Cut lengthwise. Processed meats are not recommended anyway.' },
      ]
    : [
        { title: 'Struguri, roșii cherry', desc: 'Taie-le obligatoriu pe lungime, în patru.' },
        { title: 'Nuci și alune', desc: 'Nu le oferi niciodată întregi. Servește-le râșnite fin sau ca unt subțiat.' },
        { title: 'Fructe sau legume tari', desc: 'Răzuiește-le fin sau gătește-le până devin moi.' },
        { title: 'Bucăți rotunde', desc: 'Taie-le pe lungime. Mezelurile oricum nu sunt recomandate.' },
      ];

  const generalRules = isEnglish
    ? [
        'Baby should always eat seated upright, at about 90 degrees.',
        'Never leave baby unattended while eating.',
        'Learn the difference between gagging, which is common, and choking, which is silent and requires urgent action.',
      ]
    : [
        'Bebelușul trebuie să mănânce mereu în șezut, la aproximativ 90 de grade.',
        'Nu îl lăsa niciodată nesupravegheat când mănâncă.',
        'Învață diferența dintre gagging, care este frecvent, și înecul real, care este silențios și cere intervenție urgentă.',
      ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Food safety' : 'Siguranță alimentară'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        <View style={styles.introBox}>
          <Text style={styles.introEmoji}>🛡️</Text>
          <Text style={styles.introTitle}>{isEnglish ? 'Golden rules' : 'Reguli de aur'}</Text>
          <Text style={styles.introText}>
            {isEnglish
              ? 'Until 1 year of age, baby\'s digestive and immune systems are still developing. Some foods should be avoided completely.'
              : 'Până la vârsta de 1 an, sistemul digestiv și imunitar al bebelușului este în dezvoltare. Anumite alimente trebuie evitate complet.'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{isEnglish ? 'Avoid under 1 year' : 'Interzis sub 1 an'} 🚫</Text>
        {forbiddenRules.map(rule => (
          <View key={rule.title} style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>{rule.title}</Text>
            <Text style={styles.ruleDesc}>{rule.desc}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>{isEnglish ? 'Choking hazard' : 'Risc de înec'} ⚠️</Text>
        <View style={styles.chokingCard}>
          <Text style={styles.chokingText}>
            {isEnglish
              ? 'Food shape matters. Offer soft foods or cut them appropriately.'
              : 'Forma alimentelor este foarte importantă. Oferă alimente moi sau tăiate corespunzător.'}
          </Text>
          <View style={styles.chokingList}>
            {chokingRules.map(rule => (
              <Text key={rule.title} style={styles.chokingListItem}>
                • <Text style={{ fontFamily: 'Geist-Bold' }}>{rule.title}:</Text> {rule.desc}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{isEnglish ? 'General rules' : 'Reguli generale'}</Text>
        <View style={styles.generalCard}>
          {generalRules.map(rule => (
            <Text key={rule} style={styles.generalItem}>✓ {rule}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  content: { flex: 1, padding: Spacing.xl },

  introBox: { backgroundColor: Colors.backgroundSoft, padding: Spacing.xl, borderRadius: BorderRadius['2xl'], alignItems: 'center', marginBottom: Spacing['2xl'] },
  introEmoji: { fontSize: 48, marginBottom: Spacing.md },
  introTitle: { fontSize: 20, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.sm },
  introText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  sectionTitle: { fontSize: 18, fontFamily: 'Geist-Bold', color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.md },
  
  ruleCard: { backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.error + '20', ...Shadow.sm },
  ruleTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.error, marginBottom: 4 },
  ruleDesc: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20 },

  chokingCard: { backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.warning + '40', ...Shadow.sm },
  chokingText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, marginBottom: Spacing.md, lineHeight: 20 },
  chokingList: { gap: Spacing.sm },
  chokingListItem: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20 },

  generalCard: { backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  generalItem: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20 },
});
