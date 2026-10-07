import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../../i18n';
import {
  collection,
  query,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  getDocs,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AccessDenied } from '../../components/AccessDenied';
import { useAccessControl } from '../../hooks/useAccessControl';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  isVerifiedSpecialist: boolean;
  category: string;
  title: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  likes: string[];
  reactions?: Record<string, string[]>;
  createdAt: Timestamp;
  isPinned: boolean;
}

function getCategories(t: (k: string) => string) {
  return [
    { key: 'Toate',     label: t('community.cat_all'),       emoji: '✨' },
    { key: 'intrebari', label: t('community.cat_questions'),  emoji: '❓' },
    { key: 'sfaturi',   label: t('community.cat_tips'),       emoji: '💡' },
    { key: 'povesti',   label: t('community.cat_stories'),    emoji: '📖' },
    { key: 'general',   label: t('community.cat_general'),    emoji: '💬' },
    { key: 'nutritie',  label: t('community.cat_nutrition'),  emoji: '🥗' },
    { key: 'somn',      label: t('community.cat_sleep'),      emoji: '😴' },
    { key: 'sanatate',  label: t('community.cat_health'),     emoji: '❤️‍🩹' },
    { key: 'produse',   label: t('community.cat_products'),   emoji: '🛒' },
  ];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Toate:     { bg: '#EEF2FF', text: '#4F46E5', accent: '#6366F1' },
  intrebari: { bg: '#FFF7ED', text: '#C2410C', accent: '#F97316' },
  sfaturi:   { bg: '#FEFCE8', text: '#A16207', accent: '#EAB308' },
  povesti:   { bg: '#F0FDF4', text: '#15803D', accent: '#22C55E' },
  general:   { bg: '#F0F9FF', text: '#0369A1', accent: '#38BDF8' },
  nutritie:  { bg: '#F0FDF4', text: '#166534', accent: '#4ADE80' },
  somn:      { bg: '#EEF2FF', text: '#3730A3', accent: '#818CF8' },
  sanatate:  { bg: '#FFF1F2', text: '#BE123C', accent: '#FB7185' },
  produse:   { bg: '#FAF5FF', text: '#7E22CE', accent: '#A855F7' },
};

const POSTS_PAGE_SIZE = 20;

// Curated avatar colors based on first letter
const AVATAR_PALETTES = [
  ['#FF6B9D', '#FF8FB1'], ['#4FACFE', '#00F2FE'], ['#43E97B', '#38F9D7'],
  ['#FA709A', '#FEE140'], ['#A18CD1', '#FBC2EB'], ['#F6D365', '#FDA085'],
  ['#96FECF', '#96FBC4'], ['#FCC5E4', '#FDA34B'],
];

function getAvatarColors(name: string): [string, string] {
  const idx = (name?.charCodeAt(0) || 65) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] as [string, string];
}

function formatRelative(ts: Timestamp, t: (k: string, opts?: any) => string): string {
  const diffMin = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (diffMin < 1) return t('common.just_now');
  if (diffMin < 60) return t('common.minutes_ago', { count: diffMin });
  const h = Math.floor(diffMin / 60);
  if (h < 24) return t('common.hours_ago', { count: h });
  const d = Math.floor(h / 24);
  if (d === 1) return t('common.yesterday');
  if (d < 7) return t('common.days_ago', { count: d });
  const locale = getCurrentLanguage() === 'en' ? 'en-GB' : 'ro-RO';
  return ts.toDate().toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function getAuthorLabel(item: Post, t: (k: string) => string): string {
  if (item.isAnonymous) return t('community.anonymous_author');
  return item.authorName || t('community.default_author');
}

function PostCard({ item, onPress }: { item: Post; onPress: () => void }) {
  const { t } = useTranslation();
  const CATEGORIES = getCategories(t);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['general'];
  const [c1, c2] = getAvatarColors(item.isAnonymous ? '?' : item.authorName);
  const cat = CATEGORIES.find(c => c.key === item.category);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, item.isPinned && { zIndex: 1 }]}>
      <TouchableOpacity
        style={[styles.postCard, item.isPinned && styles.postCardPinned]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {item.isPinned && (
          <View style={styles.pinnedBar}>
            <Text style={styles.pinnedIcon}>📌</Text>
            <Text style={styles.pinnedLabel}>{t('community.pinned')}</Text>
          </View>
        )}

        {/* Author row */}
        <View style={styles.authorRow}>
          <View style={[styles.avatar, { backgroundColor: c1 + '30' }]}>
            <Text style={[styles.avatarText, { color: c1 }]}>
              {item.isAnonymous ? '?' : (item.authorName?.[0]?.toUpperCase() || 'M')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.authorMeta}>
              <Text style={styles.authorName}>{getAuthorLabel(item, t)}</Text>
              {item.isVerifiedSpecialist && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>{t('community.specialist_badge')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.postTime}>{formatRelative(item.createdAt, t)}</Text>
          </View>
          {cat && (
            <View style={[styles.catBadge, { backgroundColor: catColor.bg }]}>
              <Text style={styles.catBadgeEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catBadgeText, { color: catColor.text }]}>{cat.label}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.postSnippet} numberOfLines={2}>{item.content}</Text>

        {/* Footer */}
        <View style={styles.postFooter}>
          <View style={styles.footerLeft}>
            <View style={styles.reactionBtn}>
              <Text style={styles.reactionEmoji}>❤️</Text>
              <Text style={styles.reactionCount}>{item.likesCount ?? 0}</Text>
            </View>
            <View style={styles.reactionBtn}>
              <Text style={styles.reactionEmoji}>💬</Text>
              <Text style={styles.reactionCount}>{item.commentsCount ?? 0}</Text>
            </View>
            {item.reactions && (() => {
              const EMOJI_MAP: Record<string, string> = { strong: '💪', idea: '💡', hug: '🤗', sad: '😢' };
              const extras = Object.entries(item.reactions)
                .filter(([k, v]) => k !== 'heart' && v?.length > 0)
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 2);
              return extras.map(([k, v]) => (
                <View key={k} style={styles.reactionBtn}>
                  <Text style={styles.reactionEmoji}>{EMOJI_MAP[k] ?? '✨'}</Text>
                  <Text style={styles.reactionCount}>{v.length}</Text>
                </View>
              ));
            })()}
          </View>
          <Text style={styles.readMore}>{t('community.read_more')}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CommunityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { canUseModule } = useAccessControl();
  const CATEGORIES = getCategories(t);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Toate');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const lastPostRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const buildPostsQuery = useCallback((cursor?: QueryDocumentSnapshot<DocumentData> | null) => {
    const constraints = selectedCategory === 'Toate'
      ? [orderBy('createdAt', 'desc')]
      : [where('category', '==', selectedCategory), orderBy('createdAt', 'desc')];

    if (cursor) {
      return query(
        collection(db, 'community_posts'),
        ...constraints,
        startAfter(cursor),
        limit(POSTS_PAGE_SIZE),
      );
    }

    return query(
      collection(db, 'community_posts'),
      ...constraints,
      limit(POSTS_PAGE_SIZE),
    );
  }, [selectedCategory]);

  useEffect(() => {
    setIsLoading(true);
    setPosts([]);
    setHasMorePosts(true);
    lastPostRef.current = null;

    const q = buildPostsQuery();
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      lastPostRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMorePosts(snap.docs.length === POSTS_PAGE_SIZE);
      setPosts((prev) => {
        const liveIds = new Set(data.map((post) => post.id));
        return [...data, ...prev.filter((post) => !liveIds.has(post.id))];
      });
      setIsLoading(false);
      setRefreshing(false);
    }, () => {
      setIsLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, [buildPostsQuery, refreshKey]);

  const loadMorePosts = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMorePosts || !lastPostRef.current) return;
    setIsLoadingMore(true);
    try {
      const snap = await getDocs(buildPostsQuery(lastPostRef.current));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      lastPostRef.current = snap.docs[snap.docs.length - 1] ?? lastPostRef.current;
      setHasMorePosts(snap.docs.length === POSTS_PAGE_SIZE);
      setPosts((prev) => {
        const existing = new Set(prev.map((post) => post.id));
        return [...prev, ...data.filter((post) => !existing.has(post.id))];
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildPostsQuery, hasMorePosts, isLoading, isLoadingMore]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPosts([]);
    setHasMorePosts(true);
    lastPostRef.current = null;
    setRefreshKey((value) => value + 1);
  }, []);

  if (!canUseModule('community')) {
    return <AccessDenied title={t('community.access_denied')} />;
  }

  const filtered = posts.filter((p) => {
    const matchSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // Quick stats
  const totalPosts = posts.length;
  const totalLikes = posts.reduce((s, p) => s + (p.likesCount ?? 0), 0);
  const specialists = posts.filter(p => p.isVerifiedSpecialist).length;

  const ListHeader = (
    <>
      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalPosts}</Text>
          <Text style={styles.statLbl}>{t('community.posts_label')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalLikes}</Text>
          <Text style={styles.statLbl}>{t('community.likes_label')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{specialists}</Text>
          <Text style={styles.statLbl}>{t('community.specialists_label')}</Text>
        </View>
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catScroll}
      >
        {CATEGORIES.map(cat => {
          const active = selectedCategory === cat.key;
          const colors = CATEGORY_COLORS[cat.key];
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.catPill,
                active && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.catPillEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catPillLabel, active && { color: Colors.white, fontFamily: 'Geist-SemiBold' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === 'Toate' ? t('community.recent_posts') : `${CATEGORIES.find(c => c.key === selectedCategory)?.emoji} ${CATEGORIES.find(c => c.key === selectedCategory)?.label}`}
        </Text>
        <Text style={styles.sectionCount}>{t('community.posts_count', { count: sorted.length })}</Text>
      </View>

      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.community} size="large" />
          <Text style={styles.loadingText}>{t('community.loading_posts')}</Text>
        </View>
      )}
      {!isLoading && sorted.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🌸</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery || selectedCategory !== 'Toate'
              ? t('community.empty_title_filtered')
              : t('community.empty_title')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || selectedCategory !== 'Toate'
              ? t('community.empty_subtitle_filtered')
              : t('community.empty_subtitle')}
          </Text>
          {!searchQuery && selectedCategory === 'Toate' && (
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/modules/community/create' as any)}
            >
              <Text style={styles.emptyBtnText}>{t('community.post_now')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {!isLoading && sorted.length > 0 && searchQuery.length > 0 && hasMorePosts && (
        <Text style={styles.searchHint}>{t('community.search_hint')}</Text>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('community.title')}</Text>
            <Text style={styles.headerSub}>{t('community.subtitle')}</Text>
          </View>
          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => router.push('/modules/community/create' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.newPostBtnText}>{t('community.new_post')}</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t('community.search_placeholder')}
            placeholderTextColor={Colors.textTertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Feed ─── */}
      <FlatList
        data={isLoading ? [] : sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            onPress={() => router.push(`/modules/community/post/${item.id}` as any)}
          />
        )}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.community}
            colors={[Colors.community]}
          />
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={Colors.community} />
            </View>
          ) : hasMorePosts && !isLoading ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMorePosts}>
              <Text style={styles.loadMoreText}>{t('community.load_more')}</Text>
            </TouchableOpacity>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
      />
    </SafeAreaView>
  );
}

const C = Colors.community; // '#4A5D8C'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },

  // ─── Header ───
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74,93,140,0.10)',
    ...Shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Fraunces',
    color: '#1E2A4A',
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: 1,
  },
  newPostBtn: {
    backgroundColor: C,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  newPostBtnText: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6FB',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1.5,
    borderColor: 'rgba(74,93,140,0.12)',
    gap: Spacing.sm,
  },
  searchWrapFocused: {
    borderColor: C,
    backgroundColor: Colors.white,
  },
  searchIcon: { fontSize: 15 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  clearBtn: {
    fontSize: 14,
    color: Colors.textTertiary,
    paddingHorizontal: 4,
  },

  // ─── Feed layout ───
  feedContent: {
    paddingBottom: 100,
  },

  // ─── Stats strip ───
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    ...Shadow.sm,
    overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontFamily: 'Geist-Bold', color: '#1E2A4A' },
  statLbl: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(74,93,140,0.10)', marginVertical: 4 },

  // ─── Category pills ───
  catScroll: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(74,93,140,0.15)',
    ...Shadow.sm,
  },
  catPillEmoji: { fontSize: 13 },
  catPillLabel: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },

  // ─── Section header ───
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: '#1E2A4A',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    backgroundColor: 'rgba(74,93,140,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  // ─── Post card ───
  postCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: 20,
    padding: Spacing.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: 'rgba(74,93,140,0.06)',
  },
  postCardPinned: {
    borderColor: C + '40',
    borderWidth: 1.5,
    backgroundColor: '#F8F9FF',
  },

  // Pinned banner
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
    backgroundColor: C + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pinnedIcon: { fontSize: 11 },
  pinnedLabel: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: C,
  },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Geist-Bold',
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: '#1E2A4A',
  },
  verifiedBadge: {
    backgroundColor: Colors.sage + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 10,
    fontFamily: 'Geist-SemiBold',
    color: Colors.sage,
  },
  postTime: {
    fontSize: 11,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: 1,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  catBadgeEmoji: { fontSize: 11 },
  catBadgeText: {
    fontSize: 10,
    fontFamily: 'Geist-SemiBold',
  },

  // Content
  postTitle: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: '#1E2A4A',
    marginBottom: 5,
    lineHeight: 21,
  },
  postSnippet: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },

  // Footer
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(74,93,140,0.07)',
  },
  footerLeft: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(74,93,140,0.05)',
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
  },
  readMore: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: C,
  },

  // ─── Loading / Empty ───
  loadingBox: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
  },
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    color: '#1E2A4A',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    backgroundColor: C,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(74,93,140,0.18)',
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: C,
  },
  searchHint: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
});
