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
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../../stores/authStore';
import { usePregnancyStore } from '../../../../stores/pregnancyStore';
import { pregnancyService } from '../../../../services/pregnancyService';
import { BirthPlan } from '../../../../types/pregnancy';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

type BirthType = 'natural' | 'cesarean' | 'no_preference';
type EpiduralOption = 'yes' | 'no' | 'on_request';
type CordCutting = 'partner' | 'doctor' | 'no_preference';
type EmergencyPref = 'immediate_medical' | 'discuss_first';

const LABOR_POSITIONS = [
  { key: 'standing', label: 'În picioare' },
  { key: 'walking', label: 'Mers' },
  { key: 'all_fours', label: 'În patru labe' },
  { key: 'squatting', label: 'Ghemuit' },
  { key: 'lying', label: 'Culcat' },
  { key: 'birth_ball', label: 'Minge naștere' },
];

function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {desc ? <Text style={styles.toggleDesc}>{desc}</Text> : null}
      </View>
      <TouchableOpacity
        style={[styles.toggle, value && styles.toggleOn]}
        onPress={() => onChange(!value)}
        activeOpacity={0.8}
      >
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </TouchableOpacity>
    </View>
  );
}

export default function BirthPlanScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { pregnancy, updatePregnancy } = usePregnancyStore();

  const existing = pregnancy?.birthPlan;
  const [birthType, setBirthType] = useState<BirthType>(existing?.preferredBirthType || 'no_preference');
  const [epidural, setEpidural] = useState<EpiduralOption>(existing?.epidural || 'on_request');
  const [waterBirth, setWaterBirth] = useState(existing?.waterBirth ?? false);
  const [laborPositions, setLaborPositions] = useState<string[]>(existing?.laborPositions ?? []);
  const [companion, setCompanion] = useState(existing?.companion || '');
  const [photography, setPhotography] = useState(existing?.photography ?? false);
  const [music, setMusic] = useState(existing?.musicDuringLabor || '');
  const [skinToSkin, setSkinToSkin] = useState(existing?.skinToSkin ?? true);
  const [delayedCord, setDelayedCord] = useState(existing?.delayedCordClamping ?? true);
  const [cordCutting, setCordCutting] = useState<CordCutting>(existing?.cordCutting || 'no_preference');
  const [breastfeedFirst, setBreastfeedFirst] = useState(existing?.breastfeedingFirstHour ?? true);
  const [emergencyPref, setEmergencyPref] = useState<EmergencyPref>(existing?.emergencyPreference || 'immediate_medical');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [saving, setSaving] = useState(false);

  const savedAt = existing?.savedAt;

  const togglePosition = (key: string) => {
    setLaborPositions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date().toISOString();
    const plan: BirthPlan = {
      preferredBirthType: birthType,
      epidural,
      waterBirth,
      laborPositions,
      skinToSkin,
      delayedCordClamping: delayedCord,
      cordCutting,
      breastfeedingFirstHour: breastfeedFirst,
      emergencyPreference: emergencyPref,
      photography,
      savedAt: now,
      ...(companion ? { companion } : {}),
      ...(music ? { musicDuringLabor: music } : {}),
      ...(notes ? { notes } : {}),
    };
    try {
      await pregnancyService.updatePregnancy(user.uid, { birthPlan: plan });
      updatePregnancy({ birthPlan: plan });
      Toast.show({ type: 'success', text1: '✓ Plan salvat' });
    } catch {
      Toast.show({ type: 'error', text1: 'Eroare la salvare', text2: 'Verifică conexiunea la internet' });
    } finally {
      setSaving(false);
    }
  };

  const formatSavedAt = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('ro-RO')} ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Plan naștere</Text>
          {savedAt ? (
            <Text style={styles.headerSaved}>Salvat {formatSavedAt(savedAt)}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Planul de naștere îți exprimă preferințele pentru travaliu și naștere. Discutați-l cu medicul și echipa medicală.
          </Text>
        </View>

        {/* 1. Tip naștere */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipul de naștere preferat</Text>
          <View style={styles.optionGroup}>
            {([
              { key: 'natural', label: 'Naștere naturală', emoji: '🌿' },
              { key: 'cesarean', label: 'Cezariană', emoji: '🏥' },
              { key: 'no_preference', label: 'Fără preferință', emoji: '🤷' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionCard, birthType === opt.key && styles.optionCardActive]}
                onPress={() => setBirthType(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, birthType === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 2. Epidurală */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analgezie (epidurală)</Text>
          <View style={styles.pillRow}>
            {([
              { key: 'yes', label: 'Da, doresc' },
              { key: 'no', label: 'Nu doresc' },
              { key: 'on_request', label: 'La cerere' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.pillOption, epidural === opt.key && styles.pillOptionActive]}
                onPress={() => setEpidural(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillOptionText, epidural === opt.key && styles.pillOptionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. Naștere în apă */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travaliu și naștere</Text>
          <ToggleRow
            label="Naștere în apă"
            desc="Travaliu sau naștere în cadă / piscină specială"
            value={waterBirth}
            onChange={setWaterBirth}
          />
        </View>

        {/* 4. Poziții travaliu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Poziții preferate în travaliu</Text>
          <Text style={styles.sectionHint}>Selectează una sau mai multe</Text>
          <View style={styles.chipGrid}>
            {LABOR_POSITIONS.map(pos => {
              const selected = laborPositions.includes(pos.key);
              return (
                <TouchableOpacity
                  key={pos.key}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => togglePosition(pos.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {pos.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. Suport & atmosferă */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Persoana de suport</Text>
          <TextInput
            style={styles.input}
            value={companion}
            onChangeText={setCompanion}
            placeholder="Partener, mamă, doulă..."
            placeholderTextColor={Colors.textTertiary}
          />
          <View style={styles.sectionGap} />
          <Text style={styles.subLabel}>🎵 Muzică în travaliu</Text>
          <TextInput
            style={styles.input}
            value={music}
            onChangeText={setMusic}
            placeholder="Playlist, stil preferat..."
            placeholderTextColor={Colors.textTertiary}
          />
          <View style={styles.sectionGap} />
          <ToggleRow
            label="📷 Fotografiere / filmare"
            desc="Permiteți fotografierea nașterii"
            value={photography}
            onChange={setPhotography}
          />
        </View>

        {/* 6. Imediat după naștere */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imediat după naștere</Text>
          <ToggleRow
            label="Piele la piele imediat"
            desc="Contact piele la piele în primele minute"
            value={skinToSkin}
            onChange={setSkinToSkin}
          />
          <ToggleRow
            label="Clamparea întârziată a cordonului"
            desc="Așteptarea opririi pulsației înainte de tăiere"
            value={delayedCord}
            onChange={setDelayedCord}
          />
          <ToggleRow
            label="Alăptat în prima oră"
            desc="Inițierea alăptării în prima oră postpartum"
            value={breastfeedFirst}
            onChange={setBreastfeedFirst}
          />
        </View>

        {/* 7. Tăierea cordonului */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tăierea cordonului ombilical</Text>
          <View style={styles.pillRow}>
            {([
              { key: 'partner', label: 'Partenerul taie' },
              { key: 'doctor', label: 'Medicul taie' },
              { key: 'no_preference', label: 'Fără preferință' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.pillOption, cordCutting === opt.key && styles.pillOptionActive]}
                onPress={() => setCordCutting(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillOptionText, cordCutting === opt.key && styles.pillOptionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 8. Preferință urgență */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>În caz de urgență medicală</Text>
          <View style={styles.optionGroup}>
            {([
              { key: 'immediate_medical', label: 'Intervenție medicală imediată', emoji: '🏥', desc: 'Prioritate siguranța mamei și bebelușului' },
              { key: 'discuss_first', label: 'Discutați cu mine mai întâi', emoji: '💬', desc: 'Dacă timpul permite' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionCard, emergencyPref === opt.key && styles.optionCardActive]}
                onPress={() => setEmergencyPref(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, emergencyPref === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 9. Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note / Alte preferințe</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Orice altceva important pentru voi..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            💡 Planul de naștere este un ghid, nu un contract. Situațiile medicale pot necesita ajustarea preferințelor pentru siguranța mamei și bebelușului.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing['3xl'] ?? 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Fraunces', color: Colors.textPrimary },
  headerSaved: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 2 },
  saveBtn: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  intro: {
    margin: Spacing.xl, backgroundColor: Colors.pregnancy.primaryLight,
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  introText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  sectionHint: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginBottom: Spacing.sm, marginTop: -4 },
  subLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  sectionGap: { height: Spacing.md },
  optionGroup: { flexDirection: 'row', gap: Spacing.sm },
  optionCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md,
    alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm,
  },
  optionCardActive: { borderColor: Colors.pregnancy.primary, backgroundColor: Colors.pregnancy.primaryLight },
  optionEmoji: { fontSize: 24 },
  optionLabel: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center' },
  optionLabelActive: { fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  optionDesc: { fontSize: 10, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', lineHeight: 14 },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  pillOption: {
    flex: 1, minWidth: 90, height: 40, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  pillOptionActive: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  pillOptionText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  pillOptionTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  chipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary,
  },
  inputMulti: { height: 96, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 16 },
  toggle: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: Colors.pregnancy.primary },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  disclaimer: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing.xl,
    backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  disclaimerText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 18 },
});
