import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, getDocs, getDoc, query, orderBy, Timestamp,
  doc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuthStore } from '../../../stores/authStore';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

export interface Article {
  id: string;
  title: string;
  category: string;
  body?: string;
  /** 'html' = body e HTML brut (randat prin react-native-render-html); implicit 'markdown'. */
  contentType?: 'markdown' | 'html';
  coverImage?: string;
  videoUrl?: string;
  isPremium: boolean;
  published?: boolean;
  week?: number;
  ageMin?: number;
  ageMax?: number;
  createdAt?: Timestamp;
}

export const ARTICLE_CATEGORIES: Record<string, { emoji: string; labelKey: string; color: string; gradient: [string, string] }> = {
  pregnancy: { emoji: '🌸', labelKey: 'articles_screen.cat_pregnancy', color: Colors.pregnancy.primary, gradient: ['#E8A8BF', '#C4708F'] },
  child: { emoji: '👶', labelKey: 'articles_screen.cat_child', color: Colors.child.primary, gradient: ['#F0B294', '#D07B55'] },
  nutrition: { emoji: '🥗', labelKey: 'articles_screen.cat_nutrition', color: '#7A9E8C', gradient: ['#96BCA9', '#5E8272'] },
  wellbeing: { emoji: '💜', labelKey: 'articles_screen.cat_wellbeing', color: '#9B7AA8', gradient: ['#B698C2', '#7E5C8C'] },
};

/** Estimare timp de citire: ~200 cuvinte/min, minim 1 min. */
export function readingMinutes(body?: string): number {
  if (!body) return 1;
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function excerpt(body?: string, maxLen = 100, contentType?: 'markdown' | 'html'): string {
  if (!body) return '';
  let plain = body;
  if (contentType === 'html') {
    plain = plain.replace(/<[^>]*>/g, ' ');
  } else {
    plain = plain
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // scoate imaginile markdown
      .replace(/!video\([^)]*\)/g, '')            // scoate video-urile inline
      .replace(/[#*_>`]/g, '');
  }
  plain = plain.replace(/\s+/g, ' ').trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

/** Copertă articol: imagine sau gradient pe culoarea categoriei. */
function CardCover({
  article, height, radiusTopOnly, children,
}: {
  article: Article; height: number; radiusTopOnly?: boolean; children?: React.ReactNode;
}) {
  const meta = ARTICLE_CATEGORIES[article.category] || ARTICLE_CATEGORIES.child;
  const radiusStyle = radiusTopOnly
    ? { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl }
    : { borderRadius: BorderRadius.xl };

  return (
    <View style={[{ height, overflow: 'hidden' }, radiusStyle]}>
      {article.coverImage ? (
        <Image source={{ uri: article.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={meta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <Text style={styles.coverEmojiBg}>{meta.emoji}</Text>
        </LinearGradient>
      )}
      {children}
    </View>
  );
}

export default function ArticlesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profileMode, user } = useAuthStore();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  // Filtrul implicit urmează modul profilului (sarcină/copil)
  const [category, setCategory] = useState<string>(profileMode === 'pregnancy' ? 'pregnancy' : 'child');

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'articles'), orderBy('createdAt', 'desc')));
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Article))
          .filter((a) => a.published !== false && a.title);
        setArticles(items);
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => setFavorites((snap.data()?.favoriteArticleIds as string[]) || []))
      .catch(() => {});
  }, [user?.uid]);

  const toggleFavorite = useCallback((articleId: string) => {
    if (!user?.uid) return;
    const isFav = favorites.includes(articleId);
    // Optimistic update + sync Firestore în background
    setFavorites((prev) => (isFav ? prev.filter((x) => x !== articleId) : [...prev, articleId]));
    updateDoc(doc(db, 'users', user.uid), {
      favoriteArticleIds: isFav ? arrayRemove(articleId) : arrayUnion(articleId),
    }).catch(() => {});
  }, [user?.uid, favorites]);

  const filtered = useMemo(() => {
    let list = articles;
    if (category === 'favorites') list = list.filter((a) => favorites.includes(a.id));
    else if (category !== 'all') list = list.filter((a) => a.category === category);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.body || '').toLowerCase().includes(q));
    return list;
  }, [articles, category, favorites, search]);

  const showFeatured = !search.trim() && category !== 'favorites' && filtered.length > 0;
  const featured = showFeatured ? filtered[0] : null;
  const rest = showFeatured ? filtered.slice(1) : filtered;

  const chips = [
    { key: 'all', emoji: '📚', label: t('articles_screen.cat_all'), color: Colors.textPrimary },
    ...Object.entries(ARTICLE_CATEGORIES).map(([key, meta]) => ({
      key, emoji: meta.emoji, label: t(meta.labelKey), color: meta.color,
    })),
    { key: 'favorites', emoji: '❤️', label: t('articles_screen.cat_favorites'), color: '#D9534F' },
  ];

  const formatDate = (ts?: Timestamp) =>
    ts ? ts.toDate().toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) : '';

  const FavButton = ({ articleId, small }: { articleId: string; small?: boolean }) => (
    <TouchableOpacity
      style={[styles.favButton, small && styles.favButtonSmall]}
      onPress={() => toggleFavorite(articleId)}
      hitSlop={8}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: small ? 14 : 16 }}>
        {favorites.includes(articleId) ? '❤️' : '🤍'}
      </Text>
    </TouchableOpacity>
  );

  const MetaRow = ({ article, light }: { article: Article; light?: boolean }) => {
    return (
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, light && styles.metaTextLight]}>
          ⏱ {t('articles_screen.read_time', { min: readingMinutes(article.body) })}
        </Text>
        {!!article.createdAt && (
          <Text style={[styles.metaText, light && styles.metaTextLight]}>· {formatDate(article.createdAt)}</Text>
        )}
        {article.week ? (
          <Text style={[styles.metaText, light && styles.metaTextLight]}>· {t('articles_screen.week')} {article.week}</Text>
        ) : article.ageMin != null ? (
          <Text style={[styles.metaText, light && styles.metaTextLight]}>
            · {article.ageMin}–{article.ageMax ?? article.ageMin} {t('articles_screen.months')}
          </Text>
        ) : null}
        {!!article.videoUrl && (
          <Text style={[styles.metaText, light && styles.metaTextLight]}>· ▶ {t('articles_screen.video_badge')}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backCircle} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('articles_screen.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('articles_screen.subtitle')}</Text>
        </View>
      </View>

      {/* Căutare */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('articles_screen.search_placeholder')}
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categorii */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={styles.chipsContent}
      >
        {chips.map((chip) => {
          const active = category === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, active && { backgroundColor: chip.color, borderColor: chip.color }]}
              onPress={() => setCategory(chip.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.emoji} {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.child.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{category === 'favorites' ? '🤍' : '📰'}</Text>
          <Text style={styles.emptyText}>
            {category === 'favorites' ? t('articles_screen.favorites_empty') : t('articles_screen.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {/* Card recomandat — cel mai recent */}
          {featured && (
            <TouchableOpacity
              style={[styles.featuredCard, Shadow.md]}
              onPress={() => router.push(`/modules/articles/${featured.id}` as any)}
              activeOpacity={0.9}
            >
              <CardCover article={featured} height={210}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.88)']}
                  locations={[0, 0.4, 1]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>✨ {t('articles_screen.featured')}</Text>
                </View>
                {featured.isPremium && (
                  <View style={styles.premiumPill}>
                    <Text style={styles.premiumPillText}>💎 Premium</Text>
                  </View>
                )}
                <View style={styles.featuredFavWrap}>
                  <FavButton articleId={featured.id} />
                </View>
                <View style={styles.featuredContent}>
                  <Text style={styles.featuredTitle} numberOfLines={2}>{featured.title}</Text>
                  <MetaRow article={featured} light />
                </View>
              </CardCover>
            </TouchableOpacity>
          )}

          {/* Restul articolelor */}
          {rest.map((article) => {
            const meta = ARTICLE_CATEGORIES[article.category] || ARTICLE_CATEGORIES.child;
            return (
              <TouchableOpacity
                key={article.id}
                style={[styles.card, Shadow.sm]}
                onPress={() => router.push(`/modules/articles/${article.id}` as any)}
                activeOpacity={0.9}
              >
                <CardCover article={article} height={140} radiusTopOnly>
                  {article.isPremium && (
                    <View style={styles.premiumPill}>
                      <Text style={styles.premiumPillText}>💎 Premium</Text>
                    </View>
                  )}
                  {!!article.videoUrl && (
                    <View style={styles.playCircle}>
                      <Text style={{ fontSize: 16, color: Colors.white, marginLeft: 2 }}>▶</Text>
                    </View>
                  )}
                  <View style={styles.cardFavWrap}>
                    <FavButton articleId={article.id} small />
                  </View>
                </CardCover>
                <View style={styles.cardBody}>
                  <View style={[styles.categoryPill, { backgroundColor: `${meta.color}1C` }]}>
                    <Text style={[styles.categoryPillText, { color: meta.color }]}>
                      {meta.emoji} {t(meta.labelKey)}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
                  {!!article.body && (
                    <Text style={styles.cardExcerpt} numberOfLines={2}>{excerpt(article.body, 100, article.contentType)}</Text>
                  )}
                  <MetaRow article={article} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  backCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
  },
  backArrow: { fontSize: 18, color: Colors.textPrimary },
  headerTitle: { fontSize: 26, fontFamily: 'Fraunces', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.xl, marginTop: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg, height: 44, ...Shadow.sm,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, paddingVertical: 0 },
  searchClear: { fontSize: 14, color: Colors.textTertiary, padding: 2 },

  chipsRow: { flexGrow: 0, marginTop: Spacing.md },
  chipsContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: 20, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyEmoji: { fontSize: 40 },
  emptyText: {
    fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary,
    textAlign: 'center', paddingHorizontal: Spacing['2xl'], lineHeight: 21,
  },

  list: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['3xl'] },

  coverEmojiBg: {
    position: 'absolute', right: -8, bottom: -18, fontSize: 110, opacity: 0.28,
  },

  // Card recomandat
  featuredCard: { borderRadius: BorderRadius.xl, backgroundColor: Colors.white, overflow: 'hidden' },
  featuredBadge: {
    position: 'absolute', top: Spacing.md, left: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
  },
  featuredBadgeText: { fontSize: 11, fontFamily: 'Geist-Bold', color: Colors.textPrimary },
  featuredFavWrap: { position: 'absolute', top: Spacing.md, right: Spacing.md },
  featuredContent: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.lg, gap: 4 },
  featuredTitle: { fontSize: 20, fontFamily: 'Fraunces', color: Colors.white, lineHeight: 26 },

  // Card normal
  card: { borderRadius: BorderRadius.xl, backgroundColor: Colors.white, overflow: 'hidden' },
  cardFavWrap: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
  cardBody: { padding: Spacing.lg, gap: 6 },
  categoryPill: {
    alignSelf: 'flex-start', paddingHorizontal: Spacing.sm + 2, paddingVertical: 3, borderRadius: 12,
  },
  categoryPillText: { fontSize: 11, fontFamily: 'Geist-SemiBold' },
  cardTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, lineHeight: 22 },
  cardExcerpt: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },

  premiumPill: {
    position: 'absolute', top: Spacing.sm, left: Spacing.sm,
    backgroundColor: 'rgba(30,25,20,0.65)', borderRadius: 12,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: 3,
  },
  premiumPillText: { fontSize: 10, fontFamily: 'Geist-Bold', color: '#FFD98A' },

  playCircle: {
    position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
  },

  favButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
  },
  favButtonSmall: { width: 30, height: 30, borderRadius: 15 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  metaTextLight: { color: 'rgba(255,255,255,0.85)' },
});
