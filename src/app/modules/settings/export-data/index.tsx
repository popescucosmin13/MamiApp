import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { useAuthStore } from '../../../../stores/authStore';
import { useChildStore } from '../../../../stores/childStore';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

const DATA_CATEGORIES = [
  { id: 'feeds',     emoji: '🍼', label: 'Hrănire',               desc: 'Sesiuni de alăptare și biberon' },
  { id: 'sleeps',    emoji: '😴', label: 'Somn',                  desc: 'Sesiuni de somn cu durate' },
  { id: 'diapers',   emoji: '🧷', label: 'Scutece',               desc: 'Istoricul schimbărilor' },
  { id: 'measurements', emoji: '📏', label: 'Creștere',           desc: 'Greutate, înălțime, circumferință' },
  { id: 'vaccines',  emoji: '💉', label: 'Vaccinuri',             desc: 'Calendar vaccinuri' },
  { id: 'milestones',emoji: '🏆', label: 'Achiziții',             desc: 'Etapele de dezvoltare' },
  { id: 'teeth',     emoji: '🦷', label: 'Dințișori',             desc: 'Harta dințișorilor' },
  { id: 'documents', emoji: '📄', label: 'Documente (metadate)',  desc: 'Lista documentelor' },
];

async function fetchCollection(path: string[]): Promise<any[]> {
  try {
    const ref = collection(db, ...path as [string, ...string[]]);
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

function toCSV(data: any[]): string {
  if (!data.length) return '';
  const keys = Object.keys(data[0]);
  const rows = data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','));
  return [keys.join(','), ...rows].join('\n');
}

export default function ExportDataScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeChild } = useChildStore();

  const [selected, setSelected] = useState<Set<string>>(new Set(DATA_CATEGORIES.map(c => c.id)));
  const [format,   setFormat]   = useState<'json' | 'csv'>('json');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [exportedSize, setExportedSize] = useState('');

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleExport = async () => {
    if (!user || !activeChild) {
      Toast.show({ type: 'error', text1: 'Nu există un copil activ' });
      return;
    }
    if (!selected.size) {
      Toast.show({ type: 'info', text1: 'Selectează cel puțin o categorie' });
      return;
    }
    setLoading(true);
    try {
      const childBase = ['users', user.uid, 'children', activeChild.id];
      const result: Record<string, any[]> = {
        exportedAt: [new Date().toISOString()],
        user: [{ email: user.email, displayName: profile?.displayName, uid: user.uid }],
        child: [{ id: activeChild.id, name: (activeChild as any).name, birthDate: (activeChild as any).birthDate?.toDate?.()?.toISOString() }],
      };

      for (const cat of DATA_CATEGORIES) {
        if (!selected.has(cat.id)) continue;
        result[cat.id] = await fetchCollection([...childBase, cat.id]);
      }

      let content: string;
      let filename: string;
      if (format === 'json') {
        content = JSON.stringify(result, null, 2);
        filename = `mamiapp_export_${activeChild.id}_${Date.now()}.json`;
      } else {
        const parts: string[] = [];
        for (const [key, rows] of Object.entries(result)) {
          if (Array.isArray(rows) && rows.length) {
            parts.push(`\n=== ${key.toUpperCase()} ===\n${toCSV(rows)}`);
          }
        }
        content = parts.join('\n');
        filename = `mamiapp_export_${activeChild.id}_${Date.now()}.csv`;
      }

      const kb = (new TextEncoder().encode(content).length / 1024).toFixed(1);
      setExportedSize(`${kb} KB`);

      if (Platform.OS === 'web') {
        // Pe web: descarcă fișierul direct via Blob URL
        const mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Pe mobil: Share sheet nativ
        await Share.share({ message: content, title: filename });
      }

      setDone(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Eroare la export', text2: e?.message ?? 'Încearcă din nou.' });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Export date</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.successWrap}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>✅</Text>
          <Text style={s.successTitle}>Export complet!</Text>
          <Text style={s.successDesc}>
            Datele au fost exportate ({exportedSize}).{'\n'}
            Fișierul a fost deschis în aplicația de partajare.
          </Text>
          <View style={s.successInfo}>
            <Text style={s.successInfoTitle}>🔒 Conform GDPR</Text>
            <Text style={s.successInfoText}>
              Ai dreptul de a accesa toate datele personale stocate de MamiApp (Art. 20 GDPR).
              Exportul conține datele copilului {(activeChild as any)?.name}.
            </Text>
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={() => { setDone(false); }}>
            <Text style={s.doneBtnText}>🔄 Export nou</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.doneBtn, { borderColor: '#EDE3D6' }]} onPress={() => router.back()}>
            <Text style={[s.doneBtnText, { color: '#9A8070' }]}>Înapoi la profil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>📥 Export date personale</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* GDPR note */}
        <View style={s.gdprCard}>
          <Text style={s.gdprTitle}>🔒 Dreptul tău la portabilitatea datelor</Text>
          <Text style={s.gdprText}>
            Conform GDPR (Art. 20), ai dreptul să primești toate datele personale
            într-un format structurat. Exportul se face direct din aplicație, instant.
          </Text>
        </View>

        {/* Child info */}
        {activeChild && (
          <View style={s.childCard}>
            <Text style={s.childCardEmoji}>👶</Text>
            <View>
              <Text style={s.childCardName}>{(activeChild as any)?.name}</Text>
              <Text style={s.childCardSub}>Datele acestui profil vor fi exportate</Text>
            </View>
          </View>
        )}

        {/* Format */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Format export</Text>
          <View style={s.formatRow}>
            {([
              { id: 'json', icon: '{ }', label: 'JSON',  desc: 'Structurat, ideal pentru import în alte app-uri' },
              { id: 'csv',  icon: '⊟',   label: 'CSV',   desc: 'Compatibil Excel / Google Sheets' },
            ] as { id: 'json'|'csv'; icon: string; label: string; desc: string }[]).map(f => (
              <TouchableOpacity
                key={f.id}
                style={[s.formatCard, format === f.id && s.formatCardActive]}
                onPress={() => setFormat(f.id)}
                activeOpacity={0.8}
              >
                <Text style={s.formatIcon}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.formatLabel, format === f.id && s.formatLabelActive]}>{f.label}</Text>
                  <Text style={s.formatDesc}>{f.desc}</Text>
                </View>
                <View style={[s.radio, format === f.id && s.radioActive]}>
                  {format === f.id && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Categories */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Date de exportat</Text>
            <TouchableOpacity onPress={() =>
              setSelected(selected.size === DATA_CATEGORIES.length
                ? new Set()
                : new Set(DATA_CATEGORIES.map(c => c.id)))
            }>
              <Text style={s.selectAll}>
                {selected.size === DATA_CATEGORIES.length ? 'Deselectează tot' : 'Selectează tot'}
              </Text>
            </TouchableOpacity>
          </View>

          {DATA_CATEGORIES.map(cat => (
            <TouchableOpacity key={cat.id} style={s.catRow} onPress={() => toggle(cat.id)} activeOpacity={0.8}>
              <View style={[s.checkbox, selected.has(cat.id) && s.checkboxOn]}>
                {selected.has(cat.id) && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
              </View>
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.catLabel}>{cat.label}</Text>
                <Text style={s.catDesc}>{cat.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[s.exportBtn, loading && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.exportBtnText}>📤 Exportă {selected.size} categori{selected.size === 1 ? 'e' : 'i'}</Text>
          }
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Exportul se generează local din datele salvate în contul tău Firebase.{'\n'}
          Nicio dată nu este trimisă către servere terțe.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const TERRA = '#C4704A';
const CREAM = '#FBF5EE';

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: CREAM },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#EDE3D6', backgroundColor: CREAM },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0E8E0', alignItems: 'center', justifyContent: 'center' },
  backText:     { fontSize: 22, color: TERRA, lineHeight: 28 },
  headerTitle:  { flex: 1, fontSize: 17, fontFamily: 'Fraunces', color: '#1C130D' },
  scroll:       { paddingBottom: 48 },

  gdprCard:     { margin: 16, backgroundColor: '#E8F4FD', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#BDD8F0' },
  gdprTitle:    { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#2A6090', marginBottom: 6 },
  gdprText:     { fontFamily: 'Geist', fontSize: 12, color: '#2A6090', lineHeight: 18 },

  childCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#EDE3D6', ...Shadow.sm },
  childCardEmoji: { fontSize: 28 },
  childCardName:  { fontFamily: 'Fraunces', fontSize: 15, color: '#1C130D' },
  childCardSub:   { fontFamily: 'Geist', fontSize: 11, color: '#9A8070', marginTop: 1 },

  section:      { paddingHorizontal: 16, marginTop: 16 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: 'Fraunces', fontSize: 16, color: '#1C130D' },
  selectAll:    { fontFamily: 'Geist-SemiBold', fontSize: 12, color: TERRA },

  formatRow:    { gap: 8, marginBottom: 4 },
  formatCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#EDE3D6', ...Shadow.sm },
  formatCardActive: { borderColor: TERRA },
  formatIcon:   { fontSize: 22, width: 30, textAlign: 'center' },
  formatLabel:  { fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#5A4030' },
  formatLabelActive: { color: TERRA },
  formatDesc:   { fontFamily: 'Geist', fontSize: 11, color: '#9A8070', marginTop: 1 },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D9CCBC', alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: TERRA },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: TERRA },

  catRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0E8E0' },
  checkbox:     { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D9CCBC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn:   { backgroundColor: TERRA, borderColor: TERRA },
  catEmoji:     { fontSize: 20, width: 28, textAlign: 'center' },
  catLabel:     { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#1C130D' },
  catDesc:      { fontFamily: 'Geist', fontSize: 11, color: '#9A8070', marginTop: 1 },

  exportBtn:    { marginHorizontal: 16, marginTop: 24, height: 54, borderRadius: 22, backgroundColor: TERRA, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  exportBtnText:{ fontFamily: 'Geist-SemiBold', fontSize: 15, color: '#FFFFFF' },
  disclaimer:   { fontFamily: 'Geist', fontSize: 11, color: '#9A8070', textAlign: 'center', lineHeight: 17, marginTop: 12, paddingHorizontal: 24 },

  // Success screen
  successWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successTitle: { fontFamily: 'Fraunces', fontSize: 24, color: '#1C130D', marginBottom: 10 },
  successDesc:  { fontFamily: 'Geist', fontSize: 14, color: '#5A4030', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successInfo:  { backgroundColor: '#E8F4FD', borderRadius: 18, padding: 16, marginBottom: 24, width: '100%' },
  successInfoTitle: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#2A6090', marginBottom: 6 },
  successInfoText:  { fontFamily: 'Geist', fontSize: 12, color: '#2A6090', lineHeight: 18 },
  doneBtn:      { width: '100%', paddingVertical: 14, borderRadius: 18, borderWidth: 1.5, borderColor: TERRA, alignItems: 'center', marginBottom: 10 },
  doneBtnText:  { fontFamily: 'Geist-SemiBold', fontSize: 14, color: TERRA },
});
