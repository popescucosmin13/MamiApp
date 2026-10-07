import { useEffect, useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
  Switch, ActivityIndicator, Appearance, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../../stores/authStore';
import { authService } from '../../../../services/authService';
import { Colors } from '../../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../../theme/spacing';
import { getAppearanceFromPreferences, ThemeOption, AccentOption, TextSize } from '../../../../hooks/useAppearance';



const ACCENT_MAP: Record<AccentOption, { label: string; color: string; grad: [string, string] }> = {
  coral: { label: 'Coral',  color: '#C4704A', grad: ['#C87850', '#9A4828'] },
  sage:  { label: 'Sage',   color: '#5BAA90', grad: ['#5BAA90', '#3A8A70'] },
  plum:  { label: 'Plum',   color: '#9B7AA8', grad: ['#9B7AA8', '#7A5A88'] },
  slate: { label: 'Slate',  color: '#5A78A0', grad: ['#5A88C0', '#3A5880'] },
};

const STORAGE_KEY = 'mamiapp_appearance';

export default function AppearanceScreen() {
  const router  = useRouter();
  const { user, profile } = useAuthStore();

  const [theme,    setTheme]    = useState<ThemeOption>('auto');
  const [accent,   setAccent]   = useState<AccentOption>('coral');
  const [textSize, setTextSize] = useState<TextSize>('medium');
  const [compact,  setCompact]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  // Load persisted prefs
  useEffect(() => {
    let mounted = true;
    const loadPrefs = async () => {
      const remotePrefs = profile?.preferences as any;
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      const localPrefs = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
      const p = remotePrefs
        ? {
            theme: remotePrefs.theme,
            accent: remotePrefs.appearance?.accent,
            textSize: remotePrefs.appearance?.textSize,
            compact: remotePrefs.appearance?.compact,
          }
        : localPrefs;

      if (!mounted) return;
      if (p?.theme) setTheme(p.theme);
      if (p?.accent) setAccent(p.accent);
      if (p?.textSize) setTextSize(p.textSize);
      if (p?.compact != null) setCompact(Boolean(p.compact));
      setLoaded(true);
    };

    loadPrefs().catch(() => setLoaded(true));
    return () => { mounted = false; };
  }, [profile?.preferences]);

  const accentColor = ACCENT_MAP[accent].color;
  const [accentGrad1, accentGrad2] = ACCENT_MAP[accent].grad;

  const handleSave = async () => {
    setSaving(true);
    const prefs = { theme, accent, textSize, compact };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      if (user) {
        const preferences = {
          ...(profile?.preferences ?? {}),
          theme,
          appearance: { accent, textSize, compact },
        };
        await authService.updateUserProfile(user.uid, { preferences } as any);
        if (profile) useAuthStore.getState().setProfile({ ...profile, preferences } as any);
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const systemScheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          const resolved = getAppearanceFromPreferences(preferences, systemScheme);
          document.documentElement.dataset.mamiTheme = resolved.resolvedTheme;
          document.documentElement.style.setProperty('--mami-accent', resolved.accentColor);
          document.documentElement.style.setProperty('--mami-text-scale', String(resolved.textScale));
        }
      }
      Toast.show({ type: 'success', text1: '✅ Aspect salvat cu succes!', text2: 'Setările sunt active acum.' });
      setTimeout(() => router.back(), 800);
    } catch {
      Toast.show({ type: 'error', text1: 'Eroare la salvare', text2: 'Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color="#C4704A" style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎨 Aspect</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Salvează</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Preview live */}
        <LinearGradient colors={[accentGrad1, accentGrad2]} style={styles.preview}>
          <View style={styles.previewOrb} />
          <Text style={styles.previewLabel}>PREVIZUALIZARE</Text>
          <Text style={styles.previewTitle}>MamiApp</Text>
          <Text style={[styles.previewBody, { fontSize: textSize === 'small' ? 12 : textSize === 'large' ? 16 : 14 }]}>
            Bine ai venit! Acesta este aspectul aplicației tale.
          </Text>
          <View style={styles.previewPills}>
            {['Hrănire', 'Somn', 'Dezvoltare'].map(l => (
              <View key={l} style={styles.previewPill}>
                <Text style={styles.previewPillText}>{l}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temă</Text>
          <View style={styles.themeRow}>
            {([
              { key: 'auto',  emoji: '🌗', label: 'Automat',    desc: 'Urmează sistemul' },
              { key: 'light', emoji: '☀️', label: 'Luminos',    desc: 'Mereu deschis' },
              { key: 'dark',  emoji: '🌙', label: 'Întunecat',  desc: 'Mereu închis' },
            ] as { key: ThemeOption; emoji: string; label: string; desc: string }[]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.themeCard, theme === opt.key && { borderColor: accentColor, borderWidth: 2.5 }]}
                onPress={() => setTheme(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.themeEmoji}>{opt.emoji}</Text>
                <Text style={[styles.themeLabel, theme === opt.key && { color: accentColor }]}>{opt.label}</Text>
                <Text style={styles.themeDesc}>{opt.desc}</Text>
                {theme === opt.key && (
                  <View style={[styles.themeCheckmark, { backgroundColor: accentColor }]}>
                    <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Accent color */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Culoare accent</Text>
          <Text style={styles.sectionHint}>Afectează butoane, carduri și elemente active</Text>
          <View style={styles.accentRow}>
            {(Object.entries(ACCENT_MAP) as [AccentOption, typeof ACCENT_MAP[AccentOption]][]).map(([key, val]) => (
              <TouchableOpacity key={key} style={styles.accentOption} onPress={() => setAccent(key)} activeOpacity={0.85}>
                <LinearGradient
                  colors={val.grad}
                  style={[styles.accentCircle, accent === key && styles.accentCircleActive]}
                >
                  {accent === key && <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✓</Text>}
                </LinearGradient>
                <Text style={[styles.accentLabel, accent === key && { color: val.color, fontFamily: 'Geist-SemiBold' }]}>
                  {val.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Text size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mărimea textului</Text>
          <View style={styles.sizeRow}>
            {([
              { key: 'small',  label: 'Mic',    sample: 12 },
              { key: 'medium', label: 'Normal', sample: 15 },
              { key: 'large',  label: 'Mare',   sample: 19 },
            ] as { key: TextSize; label: string; sample: number }[]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sizeCard, textSize === opt.key && { borderColor: accentColor, borderWidth: 2.5 }]}
                onPress={() => setTextSize(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sizeSample, { fontSize: opt.sample }, textSize === opt.key && { color: accentColor }]}>Aa</Text>
                <Text style={[styles.sizeLabel, textSize === opt.key && { color: accentColor }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Compact mode */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Mod compact</Text>
              <Text style={styles.switchDesc}>Reduce spațierea elementelor pentru mai mult conținut vizibil</Text>
            </View>
            <Switch
              value={compact}
              onValueChange={setCompact}
              trackColor={{ false: '#EDE3D6', true: accentColor + '88' }}
              thumbColor={compact ? accentColor : '#F5EAEE'}
              ios_backgroundColor="#EDE3D6"
            />
          </View>
        </View>

        {/* Save button big */}
        <TouchableOpacity
          style={[styles.bigSaveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.bigSaveBtnText}>💾 Salvează aspectul</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#FBF5EE' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: '#FBF5EE', borderBottomWidth: 1, borderBottomColor: '#EDE3D6' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0E8E0', alignItems: 'center', justifyContent: 'center' },
  backText:     { fontSize: 22, color: '#C4704A', lineHeight: 28 },
  headerTitle:  { flex: 1, fontSize: 18, fontFamily: 'Fraunces', color: '#1C130D' },
  saveBtn:      { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minWidth: 80, alignItems: 'center' },
  saveBtnText:  { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#FFFFFF' },

  scroll:       { paddingBottom: 48 },

  preview:      { margin: 16, borderRadius: 24, padding: 22, overflow: 'hidden' },
  previewOrb:   { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.1)', top: -40, right: -30 },
  previewLabel: { fontFamily: 'Geist-SemiBold', fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  previewTitle: { fontFamily: 'Fraunces', fontSize: 24, color: '#FFFFFF', marginBottom: 6 },
  previewBody:  { fontFamily: 'Geist', color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: 14 },
  previewPills: { flexDirection: 'row', gap: 8 },
  previewPill:  { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  previewPillText: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: '#FFFFFF' },

  section:      { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontFamily: 'Fraunces', fontSize: 16, color: '#1C130D', marginBottom: 4 },
  sectionHint:  { fontFamily: 'Geist', fontSize: 11, color: '#9A8070', marginBottom: 12 },

  themeRow:     { flexDirection: 'row', gap: 8 },
  themeCard:    { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#EDE3D6', ...Shadow.sm, position: 'relative' },
  themeEmoji:   { fontSize: 26 },
  themeLabel:   { fontFamily: 'Geist-SemiBold', fontSize: 12, color: '#5A4030' },
  themeDesc:    { fontFamily: 'Geist', fontSize: 9, color: '#9A8070', textAlign: 'center' },
  themeCheckmark:{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  accentRow:    { flexDirection: 'row', gap: 16, marginTop: 8 },
  accentOption: { alignItems: 'center', gap: 6, flex: 1 },
  accentCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  accentCircleActive: { borderWidth: 3, borderColor: '#1C130D' },
  accentLabel:  { fontFamily: 'Geist', fontSize: 11, color: '#9A8070' },

  sizeRow:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  sizeCard:     { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#EDE3D6', ...Shadow.sm },
  sizeSample:   { fontFamily: 'Fraunces', color: '#1C130D' },
  sizeLabel:    { fontFamily: 'Geist-SemiBold', fontSize: 12, color: '#9A8070' },

  switchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: '#EDE3D6', ...Shadow.sm },
  switchLabel:  { fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#1C130D', marginBottom: 2 },
  switchDesc:   { fontFamily: 'Geist', fontSize: 11, color: '#9A8070', lineHeight: 16 },

  bigSaveBtn:   { marginHorizontal: 16, marginTop: 28, height: 54, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  bigSaveBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: '#FFFFFF' },
});
