import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const EMERGENCY_NUMBERS = {
  ro: [
    { label: 'Urgențe', number: '112', icon: '!', color: Colors.error, description: 'Ambulanță, Poliție, Pompieri' },
    { label: 'Toxicologie', number: '021 210 6282', icon: 'T', color: Colors.warning, description: 'Înghițire substanțe toxice' },
    { label: 'SMURD', number: '112', icon: 'S', color: Colors.error, description: 'Serviciu mobil de urgență' },
  ],
  en: [
    { label: 'Emergencies', number: '112', icon: '!', color: Colors.error, description: 'Ambulance, Police, Firefighters' },
    { label: 'Toxicology', number: '021 210 6282', icon: 'T', color: Colors.warning, description: 'Ingestion of toxic substances' },
    { label: 'SMURD', number: '112', icon: 'S', color: Colors.error, description: 'Mobile Emergency Service' },
  ],
};

const FIRST_AID = {
  ro: [
  {
    icon: 'C',
    title: 'Sufocare / Corpuri străine',
    steps: [
      'Dacă sugarul tușește puternic, lasă-l să tușească',
      '5 lovituri pe spate: ține sugarul cu fața în jos pe antebrațul tău',
      '5 compresii toracice: întoarce cu fața în sus, 2 degete pe stern',
      'Alternează până obiectul e expulzat sau sugarul pierde conștiența',
      'Dacă inconștient: sună 112, începe RCP',
    ],
    isRedFlag: true,
  },
  {
    icon: 'B',
    title: 'Arsuri',
    steps: [
      'Răcește arsura cu apă rece (nu rece-ghețată) timp de 10-20 minute',
      'Nu aplica ghiață, unt, pastă de dinți sau alte substanțe',
      'Acoperă cu folie alimentară sau pansament steril',
      'Sună 112 pentru arsuri mari, profunde sau la față/mâini/genitale',
    ],
    isRedFlag: false,
  },
  {
    icon: 'H',
    title: 'Lovituri la cap / Căderi',
    steps: [
      'Nu mișca copilul dacă suspectezi leziune de coloană',
      'Aplică gheață învelită în prosop pe umflătură (20 minute)',
      'Monitorizează: vărsături, pierdere cunoștință, pupile dilatate inegal',
      'Mergi imediat la urgențe dacă: pierdere cunoștință, vărsături repetate, convulsii',
    ],
    isRedFlag: false,
  },
  {
    icon: 'F',
    title: 'Febră mare',
    steps: [
      'Sub 3 luni: febra > 38°C necesită evaluare medicală imediată',
      '3-36 luni: febra > 39°C sau durată > 3 zile = consultație',
      'Administrează paracetamol/ibuprofen conform vârstei și greutății',
      'Hidratare adecvată. Nu îmbrăca prea gros.',
      'Semnale de alarmă: fontanelă bombată, rigiditate ceafă, erupție',
    ],
    isRedFlag: false,
  },
  {
    icon: 'A',
    title: 'Reacție alergică',
    steps: [
      'Ușoară (urticarie, mâncărime): antihistaminic conform vârstei',
      'Severă (anafliaxie): dificultate respiratorie, umflarea feței = 112 imediat',
      'Dacă copilul are epipen prescris: administrare imediată',
      'Poziție semi-șezut dacă are dificultate respiratorie',
    ],
    isRedFlag: true,
  },
  {
    icon: 'P',
    title: 'Intoxicație / Înghițire substanțe',
    steps: [
      'Sună imediat la 112 sau centrul de toxicologie: 021 210 6282',
      'NU provoca vărsăturile (poate agrava unele intoxicații)',
      'Spune ce a înghițit, cantitatea aproximativă și ora',
      'Păstrează ambalajul pentru medici',
    ],
    isRedFlag: true,
  },
  ],
  en: [
    {
      icon: 'C',
      title: 'Choking / Foreign bodies',
      steps: [
        'If the infant is coughing strongly, let them cough.',
        'Give 5 back blows: hold the infant face down on your forearm.',
        'Give 5 chest thrusts: turn face up, place 2 fingers on the sternum.',
        'Alternate until the object is expelled or the infant loses consciousness.',
        'If unconscious: call 112 and start CPR.',
      ],
      isRedFlag: true,
    },
    {
      icon: 'B',
      title: 'Burns',
      steps: [
        'Cool the burn with cool running water for 10-20 minutes.',
        'Do not apply ice, butter, toothpaste or other substances.',
        'Cover with cling film or a sterile dressing.',
        'Call 112 for large, deep burns or burns on the face, hands or genitals.',
      ],
      isRedFlag: false,
    },
    {
      icon: 'H',
      title: 'Head injuries / Falls',
      steps: [
        'Do not move the child if you suspect a spinal injury.',
        'Apply wrapped ice to swelling for 20 minutes.',
        'Monitor vomiting, loss of consciousness, unequal pupils.',
        'Go to emergency care immediately for loss of consciousness, repeated vomiting or seizures.',
      ],
      isRedFlag: false,
    },
    {
      icon: 'F',
      title: 'High fever',
      steps: [
        'Under 3 months: fever over 38°C requires immediate medical evaluation.',
        '3-36 months: fever over 39°C or lasting more than 3 days requires consultation.',
        'Give paracetamol/ibuprofen according to age and weight.',
        'Keep fluids up. Do not overdress the child.',
        'Warning signs: bulging fontanelle, stiff neck, rash.',
      ],
      isRedFlag: false,
    },
    {
      icon: 'A',
      title: 'Allergic reaction',
      steps: [
        'Mild symptoms (hives, itching): antihistamine according to age.',
        'Severe reaction (anaphylaxis): breathing difficulty or face swelling = call 112 immediately.',
        'If the child has a prescribed epipen: administer immediately.',
        'Use a semi-sitting position if breathing is difficult.',
      ],
      isRedFlag: true,
    },
    {
      icon: 'P',
      title: 'Poisoning / Substance ingestion',
      steps: [
        'Call 112 or the toxicology center immediately: 021 210 6282.',
        'Do NOT induce vomiting.',
        'Say what was swallowed, approximate quantity and time.',
        'Keep the package for doctors.',
      ],
      isRedFlag: true,
    },
  ],
};

const WHEN_TO_CALL_112 = {
  ro: [
    'Dificultate respiratorie severă / piele albastră (cianoză)',
    'Pierdere conștiență / nu poate fi trezit',
    'Convulsii (prima dată sau durată > 5 minute)',
    'Sufocare cu corp străin',
    'Reacție alergică severă (anafilaxie)',
    'Sângerare severă incontrolabilă',
    'Arsuri grave',
    'Suspiciune intoxicație severă',
  ],
  en: [
    'Severe breathing difficulty / blue skin (cyanosis)',
    'Loss of consciousness / cannot be woken',
    'Seizures (first time or lasting more than 5 minutes)',
    'Choking with a foreign body',
    'Severe allergic reaction (anaphylaxis)',
    'Severe uncontrolled bleeding',
    'Serious burns',
    'Suspected severe poisoning',
  ],
};

export default function EmergencyScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ro';

  const callNumber = (number: string) => {
    Linking.openURL(`tel:${number.replace(/\s/g, '')}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{lang === 'en' ? 'Emergencies' : 'Urgențe'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Emergency Numbers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{lang === 'en' ? 'Emergency numbers' : 'Numere de urgență'}</Text>
          {EMERGENCY_NUMBERS[lang].map((num) => (
            <TouchableOpacity
              key={num.number + num.label}
              style={[styles.emergencyCard, { borderLeftColor: num.color }]}
              onPress={() => callNumber(num.number)}
              activeOpacity={0.8}
            >
              <Text style={styles.emergencyEmoji}>{num.icon}</Text>
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyLabel}>{num.label}</Text>
                <Text style={styles.emergencyDescription}>{num.description}</Text>
              </View>
              <View style={[styles.callButton, { backgroundColor: num.color }]}>
                <Text style={styles.callButtonNumber}>{num.number}</Text>
                <Text style={styles.callButtonAction}>{lang === 'en' ? 'Call' : 'Sună'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* When to Call 112 */}
        <View style={styles.section}>
          <View style={styles.when112Card}>
            <Text style={styles.when112Title}>{lang === 'en' ? 'When to call 112' : 'Când suni 112?'}</Text>
            {WHEN_TO_CALL_112[lang].map((item, i) => (
              <View key={i} style={styles.when112Item}>
                <Text style={styles.when112Bullet}>!</Text>
                <Text style={styles.when112Text}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* First Aid Guides */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{lang === 'en' ? 'First aid guides' : 'Ghiduri prim ajutor'}</Text>
          {FIRST_AID[lang].map((guide, i) => (
            <View key={i} style={[styles.guideCard, guide.isRedFlag && styles.guideCardRed]}>
              <View style={styles.guideHeader}>
                <Text style={styles.guideEmoji}>{guide.icon}</Text>
                <Text style={styles.guideTitle}>{guide.title}</Text>
                {guide.isRedFlag && <Text style={styles.urgentBadge}>URGENT</Text>}
              </View>
              {guide.steps.map((step, j) => (
                <View key={j} style={styles.guideStep}>
                  <Text style={styles.guideStepNumber}>{j + 1}</Text>
                  <Text style={styles.guideStepText}>{step}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {lang === 'en'
              ? 'This information is for guidance only and does not replace medical consultation. In emergencies, call 112 immediately.'
              : 'Aceste informații sunt orientative și nu înlocuiesc consultul medical. În situații de urgență, sună imediat la 112.'}
          </Text>
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
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  emergencyCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm,
    ...Shadow.sm, borderLeftWidth: 4,
  },
  emergencyEmoji: { fontSize: 28 },
  emergencyInfo: { flex: 1 },
  emergencyLabel: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  emergencyDescription: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  callButton: { borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', minWidth: 70 },
  callButtonNumber: { fontSize: 16, fontFamily: 'Geist-Bold', color: Colors.white },
  callButtonAction: { fontSize: 11, fontFamily: 'Geist', color: Colors.white + 'CC' },
  when112Card: {
    backgroundColor: Colors.error + '10', borderRadius: BorderRadius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  when112Title: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.error, marginBottom: Spacing.md },
  when112Item: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  when112Bullet: { fontSize: 14 },
  when112Text: { flex: 1, fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, lineHeight: 20 },
  guideCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  guideCardRed: { borderWidth: 1.5, borderColor: Colors.error + '40' },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  guideEmoji: { fontSize: 24 },
  guideTitle: { flex: 1, fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  urgentBadge: {
    backgroundColor: Colors.error, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.sm, fontSize: 10, fontFamily: 'Geist-Bold', color: Colors.white,
  },
  guideStep: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  guideStepNumber: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.child.primaryLight,
    fontSize: 12, fontFamily: 'Geist-Bold', color: Colors.child.primaryDark,
    textAlign: 'center', lineHeight: 22, flexShrink: 0,
  },
  guideStepText: { flex: 1, fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  disclaimer: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing['2xl'],
    backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  disclaimerText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
});
