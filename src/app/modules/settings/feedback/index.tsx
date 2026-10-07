import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react-native';
import { supportService, type SupportTicketCategory } from '../../../../services/supportService';
import { useAuthStore } from '../../../../stores/authStore';
import { Colors } from '../../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../../theme/spacing';

const CATEGORIES: Array<{ id: SupportTicketCategory; labelKey: string }> = [
  { id: 'feedback', labelKey: 'feedback.category_feedback' },
  { id: 'bug', labelKey: 'feedback.category_bug' },
  { id: 'idea', labelKey: 'feedback.category_idea' },
  { id: 'account', labelKey: 'feedback.category_account' },
  { id: 'other', labelKey: 'feedback.category_other' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const [category, setCategory] = useState<SupportTicketCategory>('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = subject.trim().length >= 4 && message.trim().length >= 10 && !sending;

  const handleSend = async () => {
    if (!user || !canSend) return;
    setSending(true);
    try {
      await supportService.createTicket({
        userId: user.uid,
        userEmail: user.email,
        userName: profile?.displayName,
        subject,
        message,
        category,
      });

      const title = t('feedback.sent_title');
      const body = t('feedback.sent_message');
      if (Platform.OS === 'web') {
        Toast.show({ type: 'success', text1: title, text2: body });
        router.back();
      } else {
        Alert.alert(title, body, [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('feedback.send_error') });
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('feedback.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{t('feedback.intro_title')}</Text>
          <Text style={styles.introText}>{t('feedback.intro_text')}</Text>
        </View>

        <Text style={styles.label}>{t('feedback.category_label')}</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => {
            const active = category === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.categoryButton, active && styles.categoryButtonActive]}
                onPress={() => setCategory(item.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('feedback.subject_label')}</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('feedback.subject_placeholder')}
            placeholderTextColor={Colors.textTertiary}
            maxLength={90}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('feedback.message_label')}</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder={t('feedback.message_placeholder')}
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlignVertical="top"
            maxLength={1200}
          />
          <Text style={styles.counter}>{message.length}/1200</Text>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Send size={18} color={Colors.white} />
              <Text style={styles.sendButtonText}>{t('feedback.send_button')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  content: { padding: Spacing.xl, paddingBottom: Spacing['3xl'], gap: Spacing.lg },
  introCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  introText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryButton: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  categoryButtonActive: {
    backgroundColor: Colors.child.primary,
    borderColor: Colors.child.primary,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
  },
  categoryTextActive: { color: Colors.white },
  fieldGroup: { gap: Spacing.sm },
  input: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  messageInput: { minHeight: 150, lineHeight: 20 },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  sendButton: {
    height: 52,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.child.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
});
