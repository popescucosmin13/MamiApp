import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { documentService } from '../../../services/documentService';
import { useAuthStore } from '../../../stores/authStore';
import { DocumentRecord, DocumentType } from '../../../types/documents';
import { formatDate, formatBytes } from '../../../lib/format';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const DOC_TYPE_CONFIG: Record<DocumentType, { emoji: string; label: string; color: string }> = {
  ultrasound: { emoji: '🔊', label: 'Ecografie', color: Colors.pregnancy.primary },
  birth_certificate: { emoji: '📜', label: 'Certificat naștere', color: Colors.sage },
  vaccine_card: { emoji: '💉', label: 'Card vaccin', color: Colors.vaccine },
  prescription: { emoji: '💊', label: 'Rețetă', color: Colors.slate },
  analysis: { emoji: '🧪', label: 'Analiză', color: Colors.amber },
  discharge_letter: { emoji: '🏥', label: 'Scrisoare externare', color: Colors.plum },
  other: { emoji: '📄', label: 'Altele', color: Colors.taupe },
};

export default function DocumentsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    documentService.getDocuments(user.uid)
      .then(setDocuments)
      .finally(() => setIsLoading(false));
  }, [user]);

  const pickAndUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setIsUploading(true);
      setUploadProgress(0);

      const doc = await documentService.uploadDocument(
        user!.uid,
        { uri: asset.uri, name: asset.fileName || 'document', mimeType: asset.mimeType || 'image/jpeg', size: asset.fileSize || 0 },
        undefined,
        (progress: number) => setUploadProgress(Math.round(progress))
      );
      setDocuments((prev) => [doc, ...prev]);
      Toast.show({ type: 'success', text1: 'Document încărcat' });
    } catch {
      Toast.show({ type: 'error', text1: 'Eroare la încărcare' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const filtered = filterType === 'all' ? documents : documents.filter((d) => d.type === filterType);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documente 📄</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickAndUpload}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.uploadButtonText}>+</Text>
          )}
        </TouchableOpacity>
      </View>

      {isUploading && (
        <View style={styles.uploadProgress}>
          <View style={[styles.uploadProgressBar, { width: `${uploadProgress}%` }]} />
          <Text style={styles.uploadProgressText}>{uploadProgress}% încărcat</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
              📁 Toate ({documents.length})
            </Text>
          </TouchableOpacity>
          {(Object.entries(DOC_TYPE_CONFIG) as [DocumentType, typeof DOC_TYPE_CONFIG[DocumentType]][]).map(([type, cfg]) => {
            const count = documents.filter(d => d.type === type).length;
            if (count === 0) return null;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filterType === type && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                onPress={() => setFilterType(type)}
              >
                <Text style={[styles.filterChipText, filterType === type && { color: Colors.white }]}>
                  {cfg.emoji} {cfg.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={Colors.documents} style={{ marginTop: Spacing['2xl'] }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📁</Text>
            <Text style={styles.emptyTitle}>Niciun document</Text>
            <Text style={styles.emptySubtitle}>
              Adaugă ecografii, analize, rețete și alte documente medicale
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={pickAndUpload}
            >
              <Text style={styles.emptyButtonText}>+ Adaugă document</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.docList}>
            {filtered.map((doc) => {
              const typeConfig = DOC_TYPE_CONFIG[doc.type];
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.docCard}
                  onPress={() => { if (doc.fileUrl) window.open(doc.fileUrl, '_blank'); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.docTypeIcon, { backgroundColor: typeConfig.color + '20' }]}>
                    <Text style={styles.docTypeEmoji}>{typeConfig.emoji}</Text>
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                    <Text style={styles.docMeta}>
                      {typeConfig.label} • {formatDate(doc.uploadedAt)}
                    </Text>
                    {doc.size && (
                      <Text style={styles.docSize}>{formatBytes(doc.size)}</Text>
                    )}
                  </View>
                  <Text style={styles.docChevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
  uploadButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.documents,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadButtonText: { fontSize: 22, color: Colors.white, fontFamily: 'Geist' },
  uploadProgress: {
    height: 4, backgroundColor: Colors.border,
    position: 'relative', overflow: 'hidden',
  },
  uploadProgressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.documents },
  uploadProgressText: {
    position: 'absolute', right: Spacing.sm, top: -Spacing.xl, fontSize: 11,
    fontFamily: 'Geist', color: Colors.documents,
  },
  filterScroll: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.documents, borderColor: Colors.documents },
  filterChipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  docList: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'], gap: Spacing.sm },
  docCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.sm,
  },
  docTypeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  docTypeEmoji: { fontSize: 22 },
  docInfo: { flex: 1 },
  docName: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  docMeta: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, marginTop: 2 },
  docSize: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  docChevron: { fontSize: 20, color: Colors.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['3xl'], paddingHorizontal: Spacing['2xl'] },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: { fontSize: 20, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  emptyButton: {
    backgroundColor: Colors.documents, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  emptyButtonText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },
});
