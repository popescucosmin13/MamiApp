import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';
import { useAccessControl } from '../../hooks/useAccessControl';
import { useChild, useLoadChildData } from '../../hooks/useChild';
import { getFirebaseFunctions } from '../../services/firebase';
import { aiService, type SavedAIConversation } from '../../services/aiService';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AskAIUsage {
  requests: number;
  limit: number;
  plan?: string;
  resetAt?: string;
}

function formatLimitReset(resetAt?: string, t?: (k: string) => string): string {
  if (!resetAt) return t ? t('assistant.limit_later') : 'later';
  const resetDate = new Date(resetAt);
  if (Number.isNaN(resetDate.getTime())) return t ? t('assistant.limit_later') : 'later';
  const locale = getCurrentLanguage() === 'en' ? 'en-GB' : 'ro-RO';
  return resetDate.toLocaleString(locale, { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function getAskAIErrorMessage(error: unknown, t: (k: string, opts?: any) => string): string {
  const err = error as {
    code?: string;
    message?: string;
    details?: Partial<AskAIUsage> & { reason?: string };
  };
  const isLimitError =
    err?.code === 'resource-exhausted' ||
    err?.code === 'functions/resource-exhausted' ||
    err?.details?.reason === 'AI_DAILY_LIMIT_REACHED';

  if (!isLimitError) {
    return t('assistant.generic_error');
  }

  const limit = Number(err.details?.limit || 0);
  const used = Number(err.details?.requests || limit);
  const resetText = formatLimitReset(err.details?.resetAt, t);
  const limitText = limit > 0 ? `${limit}` : '?';
  const usedText = used > 0 ? t('assistant.limit_used', { used, limit }) : '';

  return t('assistant.limit_error', { limit: limitText, used: usedText, reset: resetText });
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/^---+$/gm, '')
    .trim();
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const isBold = part.startsWith('**') && part.endsWith('**');
    return (
      <Text key={`${part}-${index}`} style={[styles.markdownParagraph, isBold && styles.markdownBold]}>
        {isBold ? part.slice(2, -2) : part}
      </Text>
    );
  });
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <View style={styles.markdownRoot}>
      {lines.map((line, index) => {
        if (/^---+$/.test(line)) {
          return <View key={index} style={styles.markdownDivider} />;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          return (
            <Text
              key={index}
              style={[
                styles.markdownHeading,
                level === 1 && styles.markdownHeadingLarge,
                level === 3 && styles.markdownHeadingSmall,
              ]}
            >
              {stripMarkdown(heading[2])}
            </Text>
          );
        }

        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <View key={index} style={styles.markdownBulletRow}>
              <Text style={styles.markdownBulletDot}>-</Text>
              <Text style={styles.markdownParagraph}>{renderInlineMarkdown(bullet[1])}</Text>
            </View>
          );
        }

        return (
          <Text key={index} style={styles.markdownParagraph}>
            {renderInlineMarkdown(line)}
          </Text>
        );
      })}
    </View>
  );
}

function buildChildContext(
  activeChild: ReturnType<typeof useChild>['activeChild'],
  feeds: ReturnType<typeof useChild>['feeds'],
  sleeps: ReturnType<typeof useChild>['sleeps'],
  diapers: ReturnType<typeof useChild>['diapers'],
  measurements: ReturnType<typeof useChild>['measurements'],
): string | undefined {
  if (!activeChild) return undefined;

  const now = Date.now();
  const DAY_MS = 86_400_000;

  const tsMs = (ts: any): number =>
    ts?.toDate?.()?.getTime?.() ?? (ts instanceof Date ? ts.getTime() : 0);

  // Vârstă copil
  const birthMs = (activeChild.birthDate as any)?.toDate?.()?.getTime?.() ?? null;
  let ageStr = '';
  if (birthMs) {
    const days = Math.floor((now - birthMs) / 86400000);
    if (days < 30) ageStr = `${days} zile`;
    else if (days < 365) {
      const m = Math.floor(days / 30);
      const w = Math.floor((days % 30) / 7);
      ageStr = w > 0 ? `${m} luni ${w} săpt.` : `${m} luni`;
    } else {
      const y = Math.floor(days / 365);
      const m = Math.floor((days % 365) / 30);
      ageStr = m > 0 ? `${y} ani ${m} luni` : `${y} ani`;
    }
  }

  // Ultimele 24h
  const in24h = (ts: any) => now - tsMs(ts) < DAY_MS;
  const feeds24 = feeds.filter(f => in24h(f.timestamp));
  const sleeps24 = sleeps.filter(s => in24h(s.startTime));
  const diapers24 = diapers.filter(d => in24h(d.timestamp));
  const sleepH24 = (sleeps24.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600).toFixed(1);

  let lastFeedStr = '';
  const lf = feeds[0];
  if (lf) {
    const minAgo = Math.round((now - tsMs(lf.timestamp)) / 60000);
    lastFeedStr = minAgo < 60
      ? `, ul.masă ${minAgo}min`
      : `, ul.masă ${(minAgo / 60).toFixed(1)}h`;
  }

  // Sumar 7 zile (mese și somn pe zi)
  const dayLabel = (daysAgo: number) => {
    if (daysAgo === 0) return 'azi';
    if (daysAgo === 1) return 'ieri';
    return `-${daysAgo}z`;
  };

  const feedsByDay: number[] = [];
  const sleepByDay: number[] = [];
  for (let d = 0; d < 7; d++) {
    const start = now - (d + 1) * DAY_MS;
    const end = now - d * DAY_MS;
    feedsByDay[d] = feeds.filter(f => { const t = tsMs(f.timestamp); return t >= start && t < end; }).length;
    sleepByDay[d] = sleeps
      .filter(s => { const t = tsMs(s.startTime); return t >= start && t < end; })
      .reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;
  }

  const feedWeek = feedsByDay
    .map((n, i) => `${dayLabel(i)}:${n}`)
    .join(' ');
  const sleepWeek = sleepByDay
    .map((h, i) => `${dayLabel(i)}:${h.toFixed(1)}h`)
    .join(' ');

  // Ultimele 3 măsurători cu date
  const sortedMeasurements = [...measurements].sort((a, b) => tsMs(b.date) - tsMs(a.date));
  const last3 = sortedMeasurements.slice(0, 3);
  const measureStr = last3
    .map(m => {
      const d = new Date(tsMs(m.date));
      const label = `${d.getDate()}.${d.getMonth() + 1}`;
      return [label, m.weight ? `${m.weight}kg` : '', m.height ? `${m.height}cm` : ''].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join('; ');

  const lines = [
    `Copil: ${activeChild.name}${ageStr ? `, ${ageStr}` : ''}`,
    `Azi: ${feeds24.length} mese${lastFeedStr}, somn ${sleepH24}h, ${diapers24.length} scutece`,
    `Mese/zi (7z): ${feedWeek}`,
    `Somn/zi (7z): ${sleepWeek}`,
    measureStr ? `Măsurători: ${measureStr}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function chatTitleFrom(text: string) {
  const clean = stripMarkdown(text).replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}...` : clean;
}

function chatPreviewFrom(text: string) {
  const clean = stripMarkdown(text).replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? `${clean.slice(0, 90)}...` : clean;
}

export default function AssistantScreen() {
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const { canUseModule } = useAccessControl();
  const canUseAssistant = canUseModule('assistant');
  const router = useRouter();
  const { activeChild, feeds, sleeps, diapers, measurements } = useChild();
  useLoadChildData();

  const INITIAL_MESSAGE: Message = {
    id: '0',
    role: 'assistant',
    content: t('assistant.initial_message'),
    timestamp: new Date(),
  };

  const QUICK_QUESTIONS = [
    t('assistant.q1'),
    t('assistant.q2'),
    t('assistant.q3'),
    t('assistant.q4'),
  ];

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [conversations, setConversations] = useState<SavedAIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const activeMessages = messages.filter((message) => message.id !== INITIAL_MESSAGE.id);

  const loadConversations = async () => {
    if (!user?.uid) return;
    setIsLoadingHistory(true);
    try {
      setConversations(await aiService.listConversations(user.uid));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadConversations().catch(() => {});
  }, [user?.uid]);

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([INITIAL_MESSAGE]);
    setHistoryVisible(false);
  };

  const openConversation = (conversation: SavedAIConversation) => {
    setCurrentConversationId(conversation.id);
    setMessages(conversation.messages.length ? conversation.messages : [INITIAL_MESSAGE]);
    setHistoryVisible(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
  };

  const removeConversation = async (conversationId: string) => {
    if (!user?.uid) return;
    await aiService.deleteConversation(user.uid, conversationId);
    setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId));
    if (currentConversationId === conversationId) startNewChat();
  };

  const saveConversation = async (nextMessages: Message[]) => {
    if (!user?.uid || nextMessages.length === 0) return;
    const conversationPayload = {
      title: chatTitleFrom(nextMessages.find((message) => message.role === 'user')?.content || nextMessages[0].content),
      preview: chatPreviewFrom(nextMessages[nextMessages.length - 1]?.content || ''),
      context: (profile?.profileMode || 'child') as 'pregnancy' | 'child',
      messages: nextMessages,
      messageCount: nextMessages.length,
      lastMessageAt: nextMessages[nextMessages.length - 1]?.timestamp || new Date(),
    };

    if (currentConversationId) {
      await aiService.updateConversation(user.uid, currentConversationId, conversationPayload);
    } else {
      const id = await aiService.createConversation(user.uid, conversationPayload);
      setCurrentConversationId(id);
    }
    await loadConversations();
  };

  const sendMessage = async (text: string) => {
    if (!canUseAssistant || !text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const functions = await getFirebaseFunctions();
      const askAI = httpsCallable<
        {
          messages: { role: 'user' | 'assistant'; content: string }[];
          childContext?: string;
          mode: 'pregnancy' | 'child';
          conversationId?: string;
        },
        { message: string; usage?: AskAIUsage; model?: string }
      >(functions, 'askAI');

      const nextUserMessages = [...activeMessages, userMsg];
      const isChildMode = (profile?.profileMode || 'child') === 'child';
      const childContext = isChildMode
        ? buildChildContext(activeChild, feeds, sleeps, diapers, measurements)
        : undefined;
      const result = await askAI({
        messages: nextUserMessages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        mode: profile?.profileMode || 'child',
        conversationId: currentConversationId || undefined,
        childContext,
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.data.message,
        timestamp: new Date(),
      };
      const nextMessages = [...nextUserMessages, assistantMsg];
      setMessages(nextMessages);
      saveConversation(nextMessages).catch(() => {});
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAskAIErrorMessage(error, t),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && <Text style={styles.assistantEmoji}>✨</Text>}
        <View style={[styles.bubbleContent, isUser ? styles.userBubbleContent : styles.assistantBubbleContent]}>
          {isUser ? (
            <Text style={[styles.messageText, styles.userMessageText]}>
              {stripMarkdown(item.content)}
            </Text>
          ) : (
            <MarkdownMessage content={item.content} />
          )}
        </View>
      </View>
    );
  };

  if (!canUseAssistant) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>{t('assistant.title')}</Text>
              <Text style={styles.headerSubtitle}>{t('assistant.premium_title')}</Text>
            </View>
          </View>
        </View>
        <View style={styles.lockedState}>
          <Text style={styles.lockedIcon}>✨</Text>
          <Text style={styles.lockedTitle}>{t('assistant.locked_title')}</Text>
          <Text style={styles.lockedText}>{t('assistant.locked_text')}</Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/modules/settings/subscription')}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeButtonText}>{t('assistant.activate_premium')}</Text>
          </TouchableOpacity>
          <Text style={styles.lockedNote}>{t('assistant.locked_note')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>{t('assistant.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('assistant.subtitle')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton} onPress={() => setHistoryVisible(true)}>
              <Text style={styles.headerActionText}>{t('assistant.history_btn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton} onPress={startNewChat}>
              <Text style={styles.headerActionText}>{t('assistant.new_btn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            messages.length === 1 ? (
              <View style={styles.quickQuestions}>
                <Text style={styles.quickQuestionsTitle}>{t('assistant.quick_questions_title')}</Text>
                {QUICK_QUESTIONS.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickQuestionButton}
                    onPress={() => sendMessage(q)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : isLoading ? (
              <View style={styles.typingIndicator}>
                <Text style={styles.assistantEmoji}>✨</Text>
                <ActivityIndicator size="small" color={Colors.plum} style={{ marginLeft: Spacing.sm }} />
              </View>
            ) : null
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={historyVisible} transparent animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>{t('assistant.history_title')}</Text>
                <Text style={styles.historySubtitle}>{t('assistant.history_subtitle')}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeButtonText}>x</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newChatButton} onPress={startNewChat}>
              <Text style={styles.newChatButtonText}>{t('assistant.new_chat')}</Text>
            </TouchableOpacity>

            {isLoadingHistory ? (
              <View style={styles.historyLoading}>
                <ActivityIndicator size="small" color={Colors.plum} />
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryTitle}>{t('assistant.no_history_title')}</Text>
                <Text style={styles.emptyHistoryText}>{t('assistant.no_history_text')}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
                {conversations.map((conversation) => (
                  <View key={conversation.id} style={styles.historyItem}>
                    <TouchableOpacity style={styles.historyItemMain} onPress={() => openConversation(conversation)}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>{conversation.title}</Text>
                      <Text style={styles.historyItemPreview} numberOfLines={2}>{conversation.preview || t('assistant.no_preview')}</Text>
                      <Text style={styles.historyItemMeta}>{t('assistant.messages_count', { count: conversation.messageCount })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteChatButton} onPress={() => removeConversation(conversation.id)}>
                      <Text style={styles.deleteChatText}>{t('assistant.delete_chat')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerActionButton: {
    minHeight: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  lockedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  lockedIcon: {
    fontSize: 34,
    marginBottom: Spacing.md,
  },
  lockedTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  lockedText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: Spacing.xl,
  },
  upgradeButton: {
    backgroundColor: Colors.child.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: Spacing.md,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
    textAlign: 'center',
  },
  lockedNote: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-end',
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  assistantEmoji: {
    fontSize: 20,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  bubbleContent: {
    maxWidth: '80%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  userBubbleContent: {
    backgroundColor: Colors.child.primary,
  },
  assistantBubbleContent: {
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Geist',
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.white,
  },
  assistantMessageText: {
    color: Colors.textPrimary,
  },
  markdownRoot: {
    gap: 6,
  },
  markdownHeading: {
    fontSize: 16,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    lineHeight: 22,
    marginTop: 4,
  },
  markdownHeadingLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  markdownHeadingSmall: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
  },
  markdownParagraph: {
    fontSize: 14,
    fontFamily: 'Geist',
    lineHeight: 21,
    color: Colors.textPrimary,
  },
  markdownBold: {
    fontFamily: 'Geist-Bold',
    color: Colors.textPrimary,
  },
  markdownBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  markdownBulletDot: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.child.primary,
  },
  markdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  quickQuestions: {
    marginTop: Spacing.xl,
  },
  quickQuestionsTitle: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickQuestionButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickQuestionText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: 18,
    color: Colors.white,
    fontFamily: 'Geist-Bold',
  },
  historyOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(43, 31, 35, 0.35)',
  },
  historySheet: {
    maxHeight: '82%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  historyTitle: {
    fontSize: 20,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
  },
  historySubtitle: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Bold',
    color: Colors.textPrimary,
  },
  newChatButton: {
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  newChatButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Bold',
    color: Colors.white,
  },
  historyLoading: {
    paddingVertical: Spacing['2xl'],
  },
  emptyHistory: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  emptyHistoryText: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  historyList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  historyItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  historyItemMain: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 14,
    fontFamily: 'Geist-Bold',
    color: Colors.textPrimary,
  },
  historyItemPreview: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: 3,
    lineHeight: 17,
  },
  historyItemMeta: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
    marginTop: Spacing.xs,
  },
  deleteChatButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  deleteChatText: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.error,
  },
});
