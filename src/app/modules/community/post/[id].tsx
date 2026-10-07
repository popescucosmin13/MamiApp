import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, collection, addDoc, updateDoc,
  arrayUnion, arrayRemove, increment, orderBy, query, Timestamp, onSnapshot, limit,
  getDocs, startAfter, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { useAuthStore } from '../../../../stores/authStore';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  likesCount: number;
  commentsCount: number;
  likes: string[];
  reactions?: Record<string, string[]>;
  createdAt: Timestamp;
  isPinned: boolean;
  isVerifiedSpecialist: boolean;
}

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp;
  isVerifiedSpecialist?: boolean;
  replyToCommentId?: string;
  replyToAuthorName?: string;
}

const COMMENTS_PAGE_SIZE = 30;

const REACTION_EMOJIS = [
  { key: 'heart', emoji: '❤️', label: 'Apreciez' },
  { key: 'strong', emoji: '💪', label: 'Putere' },
  { key: 'idea', emoji: '💡', label: 'Util' },
  { key: 'hug', emoji: '🤗', label: 'Îmbrățișare' },
  { key: 'sad', emoji: '😢', label: 'Empatie' },
];

const QUICK_COMMENTS = [
  '🙏 Mulțumesc pentru sfat!',
  '❤️ Super util!',
  '💪 Sunt alături de tine!',
  '😊 La fel și eu!',
  '🌸 Ai grijă de tine!',
];

function formatRelative(ts: Timestamp): string {
  const diffMin = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (diffMin < 1) return 'acum';
  if (diffMin < 60) return `acum ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `acum ${h}h`;
  const d = Math.floor(h / 24);
  return `acum ${d}z`;
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const lastCommentRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const isLiked = post?.likes.includes(user?.uid || '') ?? false;
  const visibleComments = [...comments].reverse();

  const userReactionKey = post?.reactions
    ? Object.keys(post.reactions).find(k => k !== 'heart' && post.reactions![k]?.includes(user?.uid || ''))
    : undefined;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const postRef = doc(db, 'community_posts', id);
    setComments([]);
    setHasMoreComments(true);
    lastCommentRef.current = null;

    const commentsRef = query(
      collection(db, 'community_posts', id, 'comments'),
      orderBy('createdAt', 'desc'),
      limit(COMMENTS_PAGE_SIZE),
    );
    const unsubPost = onSnapshot(postRef, (postSnap) => {
      setPost(postSnap.exists() ? ({ id: postSnap.id, ...postSnap.data() } as Post) : null);
      setLoading(false);
    }, () => {
      Alert.alert('Eroare', 'Nu s-a putut încărca postarea.');
      setLoading(false);
    });
    const unsubComments = onSnapshot(commentsRef, (commentsSnap) => {
      const latest = commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
      lastCommentRef.current = commentsSnap.docs[commentsSnap.docs.length - 1] ?? null;
      setHasMoreComments(commentsSnap.docs.length === COMMENTS_PAGE_SIZE);
      setComments((prev) => {
        const liveIds = new Set(latest.map((comment) => comment.id));
        return [...latest, ...prev.filter((comment) => !liveIds.has(comment.id))];
      });
    });
    return () => {
      unsubPost();
      unsubComments();
    };
  }, [id]);

  const loadOlderComments = useCallback(async () => {
    if (!id || loadingMoreComments || !hasMoreComments || !lastCommentRef.current) return;
    setLoadingMoreComments(true);
    try {
      const commentsRef = query(
        collection(db, 'community_posts', id, 'comments'),
        orderBy('createdAt', 'desc'),
        startAfter(lastCommentRef.current),
        limit(COMMENTS_PAGE_SIZE),
      );
      const commentsSnap = await getDocs(commentsRef);
      const older = commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
      lastCommentRef.current = commentsSnap.docs[commentsSnap.docs.length - 1] ?? lastCommentRef.current;
      setHasMoreComments(commentsSnap.docs.length === COMMENTS_PAGE_SIZE);
      setComments((prev) => {
        const existing = new Set(prev.map((comment) => comment.id));
        return [...prev, ...older.filter((comment) => !existing.has(comment.id))];
      });
    } finally {
      setLoadingMoreComments(false);
    }
  }, [hasMoreComments, id, loadingMoreComments]);

  const handleLike = async () => {
    if (!user || !post || isLiking) return;
    setIsLiking(true);
    try {
      const postRef = doc(db, 'community_posts', post.id);
      if (isLiked) {
        setPost((p) => p ? { ...p, likes: p.likes.filter((l) => l !== user.uid), likesCount: p.likesCount - 1 } : p);
        await updateDoc(postRef, { likes: arrayRemove(user.uid), likesCount: increment(-1) });
      } else {
        setPost((p) => p ? { ...p, likes: [...p.likes, user.uid], likesCount: p.likesCount + 1 } : p);
        await updateDoc(postRef, { likes: arrayUnion(user.uid), likesCount: increment(1) });
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleReaction = async (key: string) => {
    if (!user || !post || isReacting) return;
    if (key === 'heart') { handleLike(); return; }
    setIsReacting(true);
    try {
      const postRef = doc(db, 'community_posts', post.id);
      const isSame = userReactionKey === key;

      setPost((p) => {
        if (!p) return p;
        const newReactions: Record<string, string[]> = { ...(p.reactions ?? {}) };
        if (userReactionKey) {
          newReactions[userReactionKey] = (newReactions[userReactionKey] ?? []).filter(uid => uid !== user.uid);
        }
        if (!isSame) {
          newReactions[key] = [...(newReactions[key] ?? []), user.uid];
        }
        return { ...p, reactions: newReactions };
      });

      const updates: Record<string, any> = {};
      if (userReactionKey) updates[`reactions.${userReactionKey}`] = arrayRemove(user.uid);
      if (!isSame) updates[`reactions.${key}`] = arrayUnion(user.uid);
      if (Object.keys(updates).length > 0) await updateDoc(postRef, updates);
    } finally {
      setIsReacting(false);
    }
  };

  const handleReplyTo = (comment: Comment) => {
    setReplyTo({ id: comment.id, authorName: comment.authorName });
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const handleComment = async () => {
    if (!user || !post || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const commentData: Record<string, any> = {
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Mamă MamiApp',
        content: commentText.trim(),
        createdAt: Timestamp.now(),
        isVerifiedSpecialist: false,
      };
      if (replyTo) {
        commentData.replyToCommentId = replyTo.id;
        commentData.replyToAuthorName = replyTo.authorName;
      }
      await addDoc(collection(db, 'community_posts', post.id, 'comments'), commentData);
      await updateDoc(doc(db, 'community_posts', post.id), { commentsCount: increment(1) });
      setCommentText('');
      setReplyTo(null);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut adăuga comentariul.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.community} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.errorText}>Postarea nu a fost găsită.</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Postare</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Post */}
        <View style={styles.postCard}>
          <View style={styles.authorRow}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitial}>
                {post.isAnonymous ? '?' : post.authorName[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{post.authorName}</Text>
                {post.isVerifiedSpecialist && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ Specialist</Text>
                  </View>
                )}
              </View>
              <Text style={styles.postDate}>{formatRelative(post.createdAt)}</Text>
            </View>
          </View>

          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postContent}>{post.content}</Text>

          {/* 5-emoji reaction strip */}
          <View style={styles.reactionsStrip}>
            {REACTION_EMOJIS.map(({ key, emoji }) => {
              const count = key === 'heart'
                ? (post.likesCount ?? 0)
                : (post.reactions?.[key]?.length ?? 0);
              const isActive = key === 'heart' ? isLiked : userReactionKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.reactionPill, isActive && styles.reactionPillActive]}
                  onPress={() => handleReaction(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reactionPillEmoji}>{emoji}</Text>
                  {count > 0 && (
                    <Text style={[styles.reactionPillCount, isActive && styles.reactionPillCountActive]}>
                      {count}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.commentsCountRow}>
            <Text style={styles.commentsCountText}>💬 {post.commentsCount} comentarii</Text>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comentarii ({visibleComments.length})</Text>

          {hasMoreComments && visibleComments.length > 0 && (
            <TouchableOpacity
              style={styles.loadOlderBtn}
              onPress={loadOlderComments}
              disabled={loadingMoreComments}
            >
              {loadingMoreComments ? (
                <ActivityIndicator color={Colors.community} size="small" />
              ) : (
                <Text style={styles.loadOlderText}>Încarcă comentarii mai vechi</Text>
              )}
            </TouchableOpacity>
          )}

          {visibleComments.length === 0 && (
            <Text style={styles.noComments}>Fii prima care comentează! 💬</Text>
          )}

          {visibleComments.map((comment) => {
            const isReply = Boolean(comment.replyToCommentId);
            return (
              <View key={comment.id} style={[styles.commentCard, isReply && styles.commentCardReply]}>
                {isReply && (
                  <View style={styles.replyThread}>
                    <View style={styles.replyLine} />
                    <Text style={styles.replyLabel}>↩ {comment.replyToAuthorName}</Text>
                  </View>
                )}
                <View style={styles.commentAuthorRow}>
                  <View style={[styles.commentAvatar, isReply && styles.commentAvatarReply]}>
                    <Text style={styles.commentInitial}>{comment.authorName[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.commentMeta}>
                    <View style={styles.commentNameRow}>
                      <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                      {comment.isVerifiedSpecialist && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.commentDate}>{formatRelative(comment.createdAt)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.replyBtn}
                    onPress={() => handleReplyTo(comment)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.replyBtnText}>↩ Răspunde</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Quick comment chips + add comment bar */}
      <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        {/* Reply banner */}
        {replyTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>↩ Răspunzi lui <Text style={styles.replyBannerName}>{replyTo.authorName}</Text></Text>
            <TouchableOpacity onPress={cancelReply} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.replyBannerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_COMMENTS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={styles.quickChip}
              onPress={() => setCommentText(chip)}
              activeOpacity={0.75}
            >
              <Text style={styles.quickChipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.addCommentBar}>
          <TextInput
            ref={inputRef}
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyTo ? `Răspunde lui ${replyTo.authorName}...` : 'Adaugă un comentariu...'}
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            onPress={handleComment}
            disabled={!commentText.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.sendBtnText}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { textAlign: 'center', padding: Spacing.xl, fontFamily: 'Geist', color: Colors.textTertiary },
  postCard: {
    margin: Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  authorRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.md },
  authorAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.community + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  authorInitial: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.community },
  authorInfo: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  authorName: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  verifiedBadge: { backgroundColor: Colors.success + '20', paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.full },
  verifiedText: { fontSize: 10, fontFamily: 'Geist-SemiBold', color: Colors.success },
  postDate: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  postTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.md },
  postContent: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.lg },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },

  // Reactions strip
  reactionsStrip: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  reactionPillActive: {
    backgroundColor: Colors.community + '15',
    borderColor: Colors.community,
  },
  reactionPillEmoji: { fontSize: 16 },
  reactionPillCount: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
  },
  reactionPillCountActive: {
    color: Colors.community,
  },
  commentsCountRow: { paddingTop: Spacing.xs },
  commentsCountText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary },

  // Comments
  commentsSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  commentsTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  loadOlderBtn: {
    alignSelf: 'center', marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: 36, justifyContent: 'center',
  },
  loadOlderText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.community },
  noComments: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.lg },

  commentCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  commentCardReply: {
    marginLeft: Spacing.xl,
    backgroundColor: Colors.backgroundSoft,
    borderLeftWidth: 3,
    borderLeftColor: Colors.community + '40',
  },
  replyThread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  replyLine: {
    width: 3,
    height: 14,
    backgroundColor: Colors.community + '60',
    borderRadius: 2,
  },
  replyLabel: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.community,
  },
  commentAuthorRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarReply: {
    width: 28, height: 28, borderRadius: 14,
  },
  commentInitial: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  commentMeta: { flex: 1 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  commentAuthor: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  commentDate: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  commentContent: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  replyBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.community + '10',
  },
  replyBtnText: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.community,
  },

  // Input area
  inputArea: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.community + '10',
    borderBottomWidth: 1,
    borderBottomColor: Colors.community + '20',
  },
  replyBannerText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  replyBannerName: {
    fontFamily: 'Geist-SemiBold',
    color: Colors.community,
  },
  replyBannerClose: {
    fontSize: 14,
    color: Colors.textTertiary,
    paddingLeft: Spacing.md,
  },
  quickChipsRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.community + '12',
    borderWidth: 1,
    borderColor: Colors.community + '30',
  },
  quickChipText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.community,
  },
  addCommentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  commentInput: {
    flex: 1, maxHeight: 100, borderRadius: BorderRadius.xl, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.community,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
  sendBtnText: { fontSize: 18, color: Colors.white, fontFamily: 'Geist-SemiBold' },
});
