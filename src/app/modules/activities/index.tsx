import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useChildStore } from '../../../stores/childStore';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { translateHardcodedText } from '../../../i18n/runtimeText';

const ACTIVITY_CATEGORIES = [
  { key: 'sensory', emoji: '🖐️', label: 'Senzorial', color: '#E8997A' },
  { key: 'motor', emoji: '🏃', label: 'Motor', color: '#7A9E8C' },
  { key: 'language', emoji: '💬', label: 'Limbaj', color: '#4A5D8C' },
  { key: 'creative', emoji: '🎨', label: 'Creativ', color: '#9B7AA8' },
  { key: 'music', emoji: '🎵', label: 'Muzică', color: '#D4A574' },
  { key: 'outdoor', emoji: '🌿', label: 'Exterior', color: '#5C8A7A' },
  { key: 'cognitive', emoji: '🧩', label: 'Cognitiv', color: '#B89A7E' },
  { key: 'social', emoji: '👫', label: 'Social', color: '#D88FA8' },
];

const ACTIVITIES_BY_AGE: Record<string, { title: string; description: string; materials: string; duration: string; category: string }[]> = {
  '0-3': [
    { title: 'Tummy time ghidat', description: 'Puneți bebelușul pe burtă pe o suprafață fermă și sigură. Așezați-vă la nivelul lui și vorbiți-i, atrăgându-i privirea în sus pentru a-și întări gâtul.', materials: 'Saltea, jucărie colorată, oglindă sigură', duration: '5-10 min', category: 'motor' },
    { title: 'Oglinda socială', description: 'Vorbiți și zâmbiți bebelușului stând în fața unei oglinzi mari. Bebelușilor le place să privească chipuri umane, ajutând la recunoașterea feței.', materials: 'Oglindă sigură', duration: '5 min', category: 'social' },
    { title: 'Masaj de relaxare', description: 'Masaj blând cu mișcări circulare pe picioare, burtică și spate. Reduce colicii, îmbunătățește somnul și stimulează legătura emoțională profundă.', materials: 'Ulei de masaj specific bebelușilor', duration: '10-15 min', category: 'sensory' },
    { title: 'Cântece de leagăn', description: 'Cântați-i bebelușului cu o voce calmă și liniștită. Ritmul muzicii îl liniștește și dezvoltă auzul.', materials: 'Vocea părintelui', duration: '10 min', category: 'music' },
    { title: 'Gimnastică pentru picioare', description: 'Mișcați picioarele bebelușului imitând mersul pe bicicletă. Aceasta mișcare previne acumularea gazelor.', materials: 'Saltea', duration: '5 min', category: 'motor' },
    { title: 'Urmărirea vizuală', description: 'Mișcați încet o jucărie cu contrast ridicat (alb-negru sau roșu) dintr-o parte în alta pentru ca bebelușul să o urmărească cu privirea.', materials: 'Jucărie cu contrast ridicat', duration: '5 min', category: 'cognitive' },
  ],
  '4-6': [
    { title: 'Joc cu sunete (Zornăitoarea)', description: 'Produceți sunete diferite cu zornăitori din mai multe direcții și urmăriți cum copilul își întoarce capul. Stimulează auzul și localizarea sunetului.', materials: 'Zornăitori, chei', duration: '10 min', category: 'music' },
    { title: 'Săculeți senzoriali', description: 'Umpleți pungi ziplock sigure (dublate) cu apă colorată, gel de duș sau orez. Lăsați copilul să le atingă pentru experiențe tactile diverse.', materials: 'Pungi ziplock, apă, orez, gel', duration: '15 min', category: 'sensory' },
    { title: 'Citit cu voce tare', description: 'Arătați-i cărți cu poze contrastante sau din materiale moi. Citește-i, chiar dacă încă nu înțelege cuvintele, pentru a se obișnui cu ritmul limbajului.', materials: 'Cărți din material textil/cartonate', duration: '10 min', category: 'language' },
    { title: 'Avionul', description: 'Așezați bebelușul cu burtica pe gambele voastre și mișcați picioarele imitând zborul. Stimulează echilibrul și îi oferă o nouă perspectivă.', materials: 'Pătură', duration: '5-10 min', category: 'motor' },
    { title: 'Cutia cu surprize', description: 'Așezați câteva obiecte de texturi diferite (un fular de mătase, un cub de lemn) într-o cutie și lăsați-l să le scoată pe rând.', materials: 'Cutie, obiecte cu texturi diferite', duration: '15 min', category: 'cognitive' },
    { title: 'Zborul baloanelor', description: 'Suflați baloane de săpun în jurul bebelușului, lăsându-l să le urmărească cu privirea și să încerce să le prindă.', materials: 'Soluție de baloane de săpun', duration: '10 min', category: 'visual' },
  ],
  '7-12': [
    { title: 'Peek-a-boo (Cucu-bau)', description: 'Ascundeți-vă fața cu mâinile sau cu o păturică, apoi apăreți zicând "Cucu-bau!". Dezvoltă permanența obiectului.', materials: 'Păturică subțire', duration: '5-10 min', category: 'cognitive' },
    { title: 'Tobogan din perne', description: 'Construiți un mic tobogan din perne de la canapea pentru ca bebelușul să se cațăre și să treacă peste ele. Excelent pentru motricitatea grosieră.', materials: 'Perne', duration: '20 min', category: 'motor' },
    { title: 'Toba improvizată', description: 'Oferiți-i oale întoarse și linguri de lemn. Această activitate dezvoltă relația cauză-efect și motricitatea fină.', materials: 'Oale sigure de plastic/metal, linguri', duration: '15 min', category: 'music' },
    { title: 'Unde este jucăria?', description: 'Ascundeți parțial o jucărie preferată sub o pătură, în timp ce copilul privește, și încurajați-l să o găsească.', materials: 'Jucărie, pătură', duration: '10 min', category: 'cognitive' },
    { title: 'Plimbare și explorare natură', description: 'Ieșiți în parc, lăsați copilul să atingă iarba, frunzele, coaja copacilor (sub supraveghere strictă). Denumiți-i culorile și texturile.', materials: 'Natură, haine adecvate', duration: '30+ min', category: 'outdoor' },
    { title: 'Transferul obiectelor', description: 'Dați-i două boluri, unul gol și unul plin cu jucării mari sau mingi. Lăsați-l să le mute dintr-un bol în altul.', materials: 'Boluri, mingi/cuburi mari', duration: '15 min', category: 'motor' },
    { title: 'Cântece cu gesturi', description: 'Cântați cântecele clasice (ex: "Bate vântul frunzele") și faceți gesturile cu mâinile copilului, pentru a stimula imitarea.', materials: 'Vocea părintelui', duration: '10 min', category: 'language' },
  ],
  '12-24': [
    { title: 'Sortatorul cu forme DIY', description: 'Tăiați o gaură rotundă în capacul unei cutii de carton și dați-i copilului mingi sau capace de borcan mari să le introducă.', materials: 'Cutie carton, mingi/capace sigure', duration: '15 min', category: 'cognitive' },
    { title: 'Pictură cu degetele (comestibilă)', description: 'Amestecați iaurt simplu cu colorant alimentar și lăsați copilul să picteze cu degetele pe o hârtie sau tava scaunului de masă.', materials: 'Iaurt, colorant alimentar, hârtie', duration: '20 min', category: 'creative' },
    { title: 'Cursa cu obstacole', description: 'Așezați perne, tuneluri din pături și scaune prin cameră și rugați-l să treacă pe sub sau peste ele.', materials: 'Perne, pături, scaune', duration: '20 min', category: 'motor' },
    { title: 'Vorbim la "telefon"', description: 'Folosiți telefoane de jucărie sau obiecte (o banană) și purtați conversații imaginare. "Alo, tati? Da, bebe este aici!"', materials: 'Telefoane de jucărie', duration: '10 min', category: 'social' },
    { title: 'Băița cu spumă', description: 'La ora băiței, introduceți pahare de plastic, bureți și rațe de cauciuc. Arătați-i cum apa ia forma recipientului.', materials: 'Jucării de baie, spumă', duration: '20 min', category: 'sensory' },
    { title: 'Sortarea după culori', description: 'Puneți două boluri colorate diferit (ex. roșu și albastru) și cuburi de aceleași culori. Ajutați-l să sorteze cuburile în bolul potrivit.', materials: 'Boluri și cuburi colorate', duration: '15 min', category: 'cognitive' },
    { title: 'Ajutor la bucătărie', description: 'Lăsați-l să mestece (cu o lingură de lemn) ingrediente uscate, nepericuloase, într-un bol separat, imitându-vă în timp ce gătiți.', materials: 'Bol plastic, lingură lemn, făină/mălai', duration: '15 min', category: 'social' },
  ],
  '24-36': [
    { title: 'Vânătoarea de comori', description: 'Ascundeți câteva obiecte prin casă și oferiți-i "indicii" simple ("Caută sub ceva moale", "Caută lângă ușă").', materials: 'Jucării mici', duration: '20 min', category: 'cognitive' },
    { title: 'Construcții turnuri înalte', description: 'Folosiți cuburi de construcție sau pahare de plastic pentru a face cel mai înalt turn, iar apoi lăsați-l să-l dărâme (favoritul copiilor).', materials: 'Cuburi sau pahare de plastic', duration: '15 min', category: 'motor' },
    { title: 'Bucătarul șef (Plastilină)', description: 'Faceți "fursecuri" sau "pizza" din plastilină (Play-Doh), tăind forme și povestind ce ați gătit.', materials: 'Plastilină', duration: '30 min', category: 'creative' },
    { title: 'Gheața colorată', description: 'Congelați cuburi de gheață colorate (cu colorant alimentar). Lăsați-l să deseneze cu ele pe o hârtie albă sau să le amestece într-un bol cu apă.', materials: 'Cuburi gheață, colorant, hârtie groasă', duration: '20 min', category: 'sensory' },
    { title: 'Povestea din imagini', description: 'Deschideți o carte cu multe imagini dar fără text. Cereți-i să inventeze el povestea, ajutându-l cu întrebări "Ce face pisica?".', materials: 'Cărți ilustrate', duration: '15 min', category: 'language' },
    { title: 'De-a doctorul', description: 'Folosiți un kit de doctor de jucărie pe plusuri sau pe voi. Numiți părțile corpului, simulați empatia.', materials: 'Trusă doctor jucărie', duration: '20 min', category: 'social' },
  ],
  '36+': [
    { title: 'Laboratorul de Știință (Bicarbonat și Oțet)', description: 'Experiment clasic: puneți bicarbonat de sodiu și picurați oțet amestecat cu colorant alimentar pentru "erupții vulcanice".', materials: 'Bicarbonat, oțet, colorant, pipetă', duration: '30 min', category: 'cognitive' },
    { title: 'Traseu pe ață (Echilibru)', description: 'Lipiți cu bandă de hârtie linii drepte sau în zigzag pe podea. Cereți-i să meargă exact pe linie ca un acrobat.', materials: 'Bandă adezivă de hârtie', duration: '15 min', category: 'motor' },
    { title: 'Colaj din natură', description: 'Adunați frunze, flori uscate și crenguțe de afară. Lipiți-le pe o foaie mare de hârtie formând un colaj de toamnă/primăvară.', materials: 'Adeziv sigur, elemente din natură, hârtie', duration: '30 min', category: 'creative' },
    { title: 'Cine a dispărut?', description: 'Puneți 5 obiecte pe o tavă. Rugați copilul să închidă ochii, ascundeți un obiect, și întrebați "Ce a dispărut?".', materials: '5 jucării/obiecte mici', duration: '15 min', category: 'cognitive' },
    { title: 'Cărți și litere', description: 'Începeți să introduceți litere decupate din spumă la baie, formând cuvinte simple ca numele lui sau MAMA/TATA.', materials: 'Litere din spumă/magnetice', duration: '20 min', category: 'language' },
  ]
};

export default function ActivitiesScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const tx = (text: string) => isEnglish ? translateHardcodedText(text) : text;
  const { activeChild } = useChildStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const ageMonths = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  const ageKey = ageMonths < 4 ? '0-3' 
    : ageMonths < 7 ? '4-6' 
    : ageMonths < 13 ? '7-12' 
    : ageMonths < 25 ? '12-24'
    : ageMonths < 37 ? '24-36'
    : '36+';
  const activities = ACTIVITIES_BY_AGE[ageKey] || ACTIVITIES_BY_AGE['12-24'];

  const filtered = selectedCategory
    ? activities.filter((a) => a.category === selectedCategory)
    : activities;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Activities' : 'Activități'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Age Banner */}
        <View style={[styles.ageBanner, { backgroundColor: Colors.activities + '15' }]}>
          <Text style={styles.ageBannerText}>
            {isEnglish
              ? `Recommended activities for ${ageMonths} months (${ageKey} months)`
              : `Activități recomandate pentru ${ageMonths} luni (${ageKey} luni)`}
          </Text>
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipAllActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryChipText, !selectedCategory && { color: Colors.white }]}> 
              {isEnglish ? 'All' : 'Toate'}
            </Text>
          </TouchableOpacity>
          {ACTIVITY_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, selectedCategory === cat.key && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat.key && { color: Colors.white }]}>
                {cat.emoji} {tx(cat.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Activities */}
        <View style={styles.activitiesList}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>{isEnglish ? 'No activity in this category' : 'Nicio activitate în această categorie'}</Text>
          ) : (
            filtered.map((activity, i) => {
              const cat = ACTIVITY_CATEGORIES.find((c) => c.key === activity.category);
              return (
                <View key={i} style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityEmoji}>{cat?.emoji || '🎯'}</Text>
                    <View style={styles.activityMeta}>
                      <Text style={styles.activityTitle}>{tx(activity.title)}</Text>
                      <View style={styles.activityBadges}>
                        <View style={[styles.badge, { backgroundColor: (cat?.color || Colors.activities) + '20' }]}>
                          <Text style={[styles.badgeText, { color: cat?.color || Colors.activities }]}>
                            {cat ? tx(cat.label) : ''}
                          </Text>
                        </View>
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>⏱ {activity.duration}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.activityDesc}>{tx(activity.description)}</Text>
                  <View style={styles.materialsRow}>
                    <Text style={styles.materialsLabel}>🛒 </Text>
                    <Text style={styles.materialsText}>{tx(activity.materials)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* AI Generator CTA */}
        <TouchableOpacity
          style={styles.aiGeneratorCard}
          onPress={() => router.push('/(tabs)/assistant' as any)}
        >
          <Text style={styles.aiGeneratorEmoji}>✨</Text>
          <View style={styles.aiGeneratorInfo}>
            <Text style={styles.aiGeneratorTitle}>{isEnglish ? 'AI activity generator' : 'Generator activități AI'}</Text>
            <Text style={styles.aiGeneratorSubtitle}>
              {isEnglish
                ? `Personalized activities for ${activeChild?.name || 'your baby'}`
                : `Activități personalizate pentru ${activeChild?.name || 'bebelușul'} tău`}
            </Text>
          </View>
          <Text style={styles.aiGeneratorBadge}>Premium</Text>
        </TouchableOpacity>
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
  ageBanner: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  ageBannerText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  categoryScroll: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.sm },
  categoryChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipAllActive: { backgroundColor: Colors.activities, borderColor: Colors.activities },
  categoryChipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  activitiesList: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
  activityCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  activityHeader: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  activityEmoji: { fontSize: 32 },
  activityMeta: { flex: 1 },
  activityTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  activityBadges: { flexDirection: 'row', gap: Spacing.sm },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  badgeText: { fontSize: 11, fontFamily: 'Geist-SemiBold' },
  durationBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft,
  },
  durationText: { fontSize: 11, fontFamily: 'Geist', color: Colors.textSecondary },
  activityDesc: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  materialsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  materialsLabel: { fontSize: 13 },
  materialsText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, flex: 1 },
  aiGeneratorCard: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing['2xl'],
    backgroundColor: Colors.plum + '15', borderRadius: BorderRadius.xl, padding: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.plum + '30',
  },
  aiGeneratorEmoji: { fontSize: 28 },
  aiGeneratorInfo: { flex: 1 },
  aiGeneratorTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.plum },
  aiGeneratorSubtitle: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  aiGeneratorBadge: {
    backgroundColor: Colors.plum, color: Colors.white, fontSize: 11,
    fontFamily: 'Geist-SemiBold', paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
});
