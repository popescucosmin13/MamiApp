import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { diaperService } from '../../../services/diaperService';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { DiaperRecord } from '../../../types/diapers';
import { formatRelativeTime } from '../../../lib/format';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

type DiaperType = 'wet' | 'dirty' | 'both' | 'dry';

const DIAPER_TYPES: { type: DiaperType; emoji: string; labelKey: string; color: string }[] = [
  { type: 'wet',   emoji: '💧', labelKey: 'diapers.type_wet',   color: Colors.info },
  { type: 'dirty', emoji: '💩', labelKey: 'diapers.type_dirty', color: Colors.amber },
  { type: 'both',  emoji: '🌊', labelKey: 'diapers.type_both', color: Colors.diaper },
  { type: 'dry',   emoji: '✨', labelKey: 'diapers.type_dry',  color: Colors.success },
];

export default function DiapersScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeChild, diapers, addDiaper, removeDiaper } = useChildStore();
  const [selectedType, setSelectedType] = useState<DiaperType>('wet');
  const [rash, setRash] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const todayDiapers = diapers.filter((d) => {
    const t = d.timestamp as Timestamp;
    const dt = t.toDate();
    const today = new Date();
    return dt.getDate() === today.getDate() && dt.getMonth() === today.getMonth();
  });

  const saveDiaper = async () => {
    if (!user || !activeChild?.id) return;
    setIsSaving(true);
    try {
      const noteText = [
        rash ? t('diapers.rash_note') : '',
        notes.trim(),
      ].filter(Boolean).join(' · ') || undefined;

      const record: Omit<DiaperRecord, 'id'> = {
        timestamp: Timestamp.now(),
        type: selectedType,
        createdBy: user.uid,
      };
      if (noteText) record.notes = noteText;
      const childOwnerId = activeChild.ownerId || user.uid;
      if (editingId) {
        await diaperService.updateDiaper(childOwnerId, activeChild.id, editingId, {
          type: selectedType,
          notes: noteText,
        });
        useChildStore.getState().updateDiaper(editingId, { type: selectedType, notes: noteText });
        setEditingId(null);
        setNotes('');
        setRash(false);
        Toast.show({ type: 'success', text1: t('diapers.updated') });
        return;
      }
      const id = await diaperService.addDiaper(childOwnerId, activeChild.id, record);
      addDiaper({ ...record, id });
      // Reset form
      setNotes('');
      setRash(false);
      Toast.show({
        type: 'success',
        text1: t('diapers.saved'),
        text2: t(DIAPER_TYPES.find((dt) => dt.type === selectedType)?.labelKey ?? 'diapers.type_wet'),
      });
    } catch {
      Toast.show({ type: 'error', text1: t('diapers.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (diaper: DiaperRecord) => {
    if (!diaper.id) return;
    const rawNotes = diaper.notes ?? '';
    const rashText = t('diapers.rash_note');
    setEditingId(diaper.id);
    setSelectedType(diaper.type);
    setRash(rawNotes.includes(rashText));
    setNotes(rawNotes.replace(rashText, '').replace(/^ · | · $/g, '').trim());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSelectedType('wet');
    setRash(false);
    setNotes('');
  };

  const confirmDelete = (diaper: DiaperRecord) => {
    const diaperType = t(DIAPER_TYPES.find(dt => dt.type === diaper.type)?.labelKey ?? 'diapers.type_wet');
    if (Platform.OS === 'web') {
      if (window.confirm(t('diapers.delete_confirm_web'))) deleteDiaper(diaper);
    } else {
      Alert.alert(
        t('diapers.delete_title'),
        t('diapers.delete_msg', { type: diaperType }),
        [
          { text: t('diapers.cancel'), style: 'cancel' },
          { text: t('diapers.delete_action'), style: 'destructive', onPress: () => deleteDiaper(diaper) },
        ]
      );
    }
  };

  const deleteDiaper = async (diaper: DiaperRecord) => {
    if (!user || !activeChild?.id || !diaper.id) return;
    setDeletingId(diaper.id);
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      await diaperService.deleteDiaper(childOwnerId, activeChild.id, diaper.id);
      removeDiaper(diaper.id);
      Toast.show({ type: 'success', text1: t('diapers.deleted') });
    } catch {
      Toast.show({ type: 'error', text1: t('diapers.delete_error') });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('diapers.title')} 🧷</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* KeyboardAvoidingView previne ca tastatura să acopere inputul */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Today Summary */}
          <View style={[styles.summaryCard, { backgroundColor: Colors.diaper + '15' }]}>
            <Text style={styles.summaryTitle}>{t('diapers.today')}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: Colors.diaper }]}>{todayDiapers.length}</Text>
                <Text style={styles.summaryLabel}>{t('diapers.total')}</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: Colors.info }]}>
                  {todayDiapers.filter(d => d.type === 'wet' || d.type === 'both').length}
                </Text>
                <Text style={styles.summaryLabel}>{t('diapers.wet_plural')}</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: Colors.amber }]}>
                  {todayDiapers.filter(d => d.type === 'dirty' || d.type === 'both').length}
                </Text>
                <Text style={styles.summaryLabel}>{t('diapers.dirty_plural')}</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: Colors.error }]}>
                  {todayDiapers.filter(d => d.notes?.includes(t('diapers.rash_note'))).length}
                </Text>
                <Text style={styles.summaryLabel}>{t('diapers.rash_plural')}</Text>
              </View>
            </View>
          </View>

          {/* Quick Add Card */}
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>{t('diapers.add_title')}</Text>
            {editingId && (
              <View style={styles.editBanner}>
                <Text style={styles.editBannerText}>{t('diapers.edit_banner')}</Text>
                <TouchableOpacity onPress={cancelEdit}>
                  <Text style={styles.editCancelText}>{t('diapers.cancel')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Type selector */}
            <View style={styles.typeGrid}>
              {DIAPER_TYPES.map((dt) => (
                <TouchableOpacity
                  key={dt.type}
                  style={[
                    styles.typeCard,
                    selectedType === dt.type && { borderColor: dt.color, backgroundColor: dt.color + '15' },
                  ]}
                  onPress={() => setSelectedType(dt.type)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeEmoji}>{dt.emoji}</Text>
                  <Text style={[styles.typeLabel, selectedType === dt.type && { color: dt.color, fontFamily: 'Geist-SemiBold' }]}>
                    {t(dt.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Rash toggle */}
            <TouchableOpacity
              style={[styles.rashToggle, rash && styles.rashToggleActive]}
              onPress={() => setRash(!rash)}
              activeOpacity={0.8}
            >
              <Text style={[styles.rashToggleText, rash && { color: Colors.error }]}>
                {rash ? t('diapers.rash_present') : t('diapers.rash_none')}
              </Text>
            </TouchableOpacity>

            {/* Notes input — editabil de oricine */}
            <View style={styles.notesRow}>
              <TextInput
                style={[styles.notesInput, { fontSize: 16 }]}
                placeholder={t('diapers.notes_placeholder')}
                placeholderTextColor={Colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline={false}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: Colors.diaper }, isSaving && { opacity: 0.5 }]}
              onPress={saveDiaper}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? t('diapers.saving') : t('diapers.save')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* History */}
          <View style={styles.history}>
            <Text style={styles.historyTitle}>{t('diapers.history_count', { count: diapers.length })}</Text>
            {diapers.slice(0, 30).map((d) => {
              const config = DIAPER_TYPES.find((t) => t.type === d.type)!;
              const isDeleting = deletingId === d.id;
              return (
                <View key={d.id} style={[styles.historyItem, isDeleting && { opacity: 0.4 }]}>
                  <View style={[styles.historyDot, { backgroundColor: config?.color + '25' }]}>
                    <Text style={styles.historyEmoji}>{config?.emoji}</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyType}>{t(config?.labelKey ?? 'diapers.type_wet')}</Text>
                    {d.notes && (
                      <Text style={styles.historyNotes} numberOfLines={1}>{d.notes}</Text>
                    )}
                    <Text style={styles.historyTime}>{formatRelativeTime(d.timestamp, i18n.language)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => startEdit(d)}
                    disabled={isDeleting}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                  >
                    <Text style={styles.editBtnText}>{t('diapers.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(d)}
                    disabled={isDeleting}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {diapers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🧷</Text>
                <Text style={styles.emptyText}>{t('diapers.empty_title')}</Text>
                <Text style={styles.emptySubText}>{t('diapers.empty_subtitle')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

  summaryCard: {
    margin: Spacing.xl, borderRadius: BorderRadius.xl, padding: Spacing.xl,
  },
  summaryTitle: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: 28, fontFamily: 'Geist-Bold' },
  summaryLabel: { fontSize: 11, fontFamily: 'Geist', color: Colors.textSecondary },

  addCard: {
    marginHorizontal: Spacing.xl, backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm, marginBottom: Spacing.xl,
  },
  addCardTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.lg },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.diaper + '12',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  editBannerText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  editCancelText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.error },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  typeCard: {
    width: '47%', paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, gap: Spacing.xs,
  },
  typeEmoji: { fontSize: 28 },
  typeLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },

  rashToggle: {
    paddingVertical: Spacing.md, borderRadius: BorderRadius.xl,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  rashToggleActive: { borderColor: Colors.error, backgroundColor: Colors.error + '10' },
  rashToggleText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },

  notesRow: { marginBottom: Spacing.lg },
  notesInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 16, // IMPORTANT: >= 16px previne zoom-ul pe iOS
    fontFamily: 'Geist', color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSoft,
    height: 44,
  },

  saveButton: {
    height: 52, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.white },

  history: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  historyTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  historyDot: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  historyEmoji: { fontSize: 20 },
  historyInfo: { flex: 1 },
  historyType: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  historyNotes: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, marginTop: 1 },
  historyTime: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 1 },
  editBtn: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.diaper + '14',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  editBtnText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.diaper },

  deleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.error + '12',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  deleteBtnText: { fontSize: 15 },

  emptyState: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  emptySubText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 4 },
});
