import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp, addDoc, collection } from 'firebase/firestore';
import { useAuthStore } from '../../../../stores/authStore';
import { db } from '../../../../services/firebase';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

const CATEGORIES = [
  { key: 'general', label: 'General', emoji: '💬' },
  { key: 'intrebari', label: 'Întrebări', emoji: '❓' },
  { key: 'sfaturi', label: 'Sfaturi', emoji: '💡' },
  { key: 'povesti', label: 'Povești', emoji: '📖' },
  { key: 'produse', label: 'Produse', emoji: '🛒' },
  { key: 'nutritie', label: 'Nutriție', emoji: '🥗' },
  { key: 'somn', label: 'Somn', emoji: '😴' },
  { key: 'sanatate', label: 'Sănătate', emoji: '❤️‍🩹' },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePost = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Titlu obligatoriu', 'Adăugați un titlu la postare.');
      return;
    }
    if (!content.trim() || content.trim().length < 20) {
      Alert.alert('Conținut prea scurt', 'Postarea trebuie să aibă cel puțin 20 de caractere.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'community_posts'), {
        title: title.trim(),
        content: content.trim(),
        category,
        authorId: user.uid,
        authorName: isAnonymous ? 'Anonim' : (profile?.displayName || user.displayName || 'Mamă MamiApp'),
        isAnonymous,
        likesCount: 0,
        commentsCount: 0,
        likes: [],
        createdAt: Timestamp.now(),
        isPinned: false,
        isVerifiedSpecialist: false,
      });
      router.back();
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut publica postarea. Încercați din nou.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelBtn}>Anulează</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Postare nouă</Text>
        <TouchableOpacity onPress={handlePost} disabled={saving || !title.trim() || content.length < 20}>
          <Text style={[styles.postBtn, (saving || !title.trim() || content.length < 20) && styles.postBtnDisabled]}>
            {saving ? 'Se publică...' : 'Publică'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Categorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catChip, category === cat.key && styles.catChipActive]}
                onPress={() => setCategory(cat.key)}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, category === cat.key && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Titlu</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Un titlu clar și concis..."
            placeholderTextColor={Colors.textTertiary}
            maxLength={150}
          />
          <Text style={styles.charCount}>{title.length}/150</Text>
        </View>

        {/* Content */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Conținut</Text>
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="Scrie postarea ta... Cu cât mai multe detalii, cu atât mai ușor comunitatea te poate ajuta."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, content.length < 20 && content.length > 0 && styles.charCountWarning]}>
            {content.length}/2000 {content.length > 0 && content.length < 20 && '(minim 20)'}
          </Text>
        </View>

        {/* Anonymous toggle */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.anonRow} onPress={() => setIsAnonymous(!isAnonymous)}>
            <View style={styles.anonInfo}>
              <Text style={styles.anonTitle}>Postează anonim</Text>
              <Text style={styles.anonDesc}>Numele tău nu va fi afișat. Opțional pentru subiecte sensibile.</Text>
            </View>
            <View style={[styles.toggle, isAnonymous && styles.toggleOn]}>
              <View style={[styles.toggleThumb, isAnonymous && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>📋 Reguli comunitate</Text>
          <Text style={styles.guidelinesText}>
            • Fii respectuos și empatic{'\n'}
            • Nu distribui informații medicale neconfirmate{'\n'}
            • Nu promova produse/servicii fără transparență{'\n'}
            • Respectă intimitatea celorlalți{'\n'}
            • Postările false sau spam vor fi eliminate
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
  cancelBtn: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  postBtn: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.community },
  postBtnDisabled: { opacity: 0.4 },
  section: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  fieldLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  catChipActive: { backgroundColor: Colors.community, borderColor: Colors.community },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  catLabelActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  titleInput: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary,
  },
  contentInput: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, minHeight: 180,
  },
  charCount: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },
  charCountWarning: { color: Colors.warning },
  anonRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm,
  },
  anonInfo: { flex: 1 },
  anonTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  anonDesc: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 16 },
  toggle: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: Colors.community },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  guidelinesCard: {
    margin: Spacing.xl, backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  guidelinesTitle: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  guidelinesText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 20 },
});
