import { useEffect, useState, useMemo, createElement } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Share,
  Image,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import RenderHtml, { CustomBlockRenderer } from 'react-native-render-html';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuthStore } from '../../../stores/authStore';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { ARTICLE_CATEGORIES, readingMinutes, excerpt, type Article } from './index';

const ARTICLE_BASE_URL = 'https://example.com/modules/articles';

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?\S*?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Player video: YouTube (iframe pe web, thumbnail + link pe nativ) sau fișier direct (mp4). */
function VideoBlock({ url, label }: { url: string; label: string }) {
  const ytId = getYouTubeId(url);

  if (ytId) {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.videoWrap}>
          {createElement('iframe' as any, {
            src: `https://www.youtube.com/embed/${ytId}`,
            style: { width: '100%', height: '100%', border: 0, borderRadius: 16 },
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowFullScreen: true,
          })}
        </View>
      );
    }
    // Nativ: thumbnail YouTube cu buton play → deschide aplicația YouTube/browser
    return (
      <TouchableOpacity
        style={styles.videoWrap}
        onPress={() => Linking.openURL(url).catch(() => {})}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.videoOverlay}>
          <View style={styles.videoPlayCircle}>
            <Text style={{ fontSize: 24, color: Colors.white, marginLeft: 3 }}>▶</Text>
          </View>
          <Text style={styles.videoLabel}>{label}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Fișier video direct (mp4/webm — de ex. din Firebase Storage)
  if (Platform.OS === 'web') {
    // expo-av are probleme de randare pe web (rămâne ecran negru fără controale) —
    // pe web folosim tag-ul <video> nativ al browserului, care e mereu fiabil.
    return (
      <View style={styles.videoWrap}>
        {createElement('video', {
          src: url,
          controls: true,
          playsInline: true,
          preload: 'metadata',
          style: { width: '100%', height: '100%', display: 'block', backgroundColor: '#000' },
        })}
      </View>
    );
  }

  return (
    <Video
      source={{ uri: url }}
      style={styles.videoWrap}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
    />
  );
}

type ArticleBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string; lead: boolean }
  | { type: 'bullet'; items: string[] }
  | { type: 'ordered'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'video'; url: string };

/** Grupează liniile în blocuri (liste/citate consecutive devin un singur bloc vizual). */
function parseArticleBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let leadUsed = false;

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push({ type: 'image', url: imageMatch[2], caption: imageMatch[1] || undefined });
      continue;
    }

    const videoMatch = line.match(/^!video\(([^)]+)\)$/);
    if (videoMatch) { blocks.push({ type: 'video', url: videoMatch[1] }); continue; }

    if (/^-{3,}$|^\*{3,}$/.test(line)) { blocks.push({ type: 'hr' }); continue; }

    if (line.startsWith('## ')) { blocks.push({ type: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# ')) { blocks.push({ type: 'h1', text: line.slice(2) }); continue; }

    if (line.startsWith('> ')) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'quote') last.lines.push(line.slice(2));
      else blocks.push({ type: 'quote', lines: [line.slice(2)] });
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ordered') last.items.push(orderedMatch[1]);
      else blocks.push({ type: 'ordered', items: [orderedMatch[1]] });
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('• ')) {
      const text = line.slice(2);
      const last = blocks[blocks.length - 1];
      if (last?.type === 'bullet') last.items.push(text);
      else blocks.push({ type: 'bullet', items: [text] });
      continue;
    }

    blocks.push({ type: 'p', text: line, lead: !leadUsed });
    leadUsed = true;
  }

  return blocks;
}

function renderInlineMd(text: string, keyPrefix: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (
    i % 2 === 1
      ? <Text key={`${keyPrefix}-${i}`} style={styles.bold}>{part}</Text>
      : <Text key={`${keyPrefix}-${i}`}>{part}</Text>
  ));
}

/**
 * Redare conținut: titluri (#, ##), liste (- și 1.), citate (>), separator (---),
 * bold (**text**), imagini cu legendă (![legendă](url)) și video inline (!video(url)).
 */
function ArticleBody({ body, accentColor, videoLabel }: { body: string; accentColor: string; videoLabel: string }) {
  const blocks = useMemo(() => parseArticleBlocks(body), [body]);

  return (
    <View style={{ gap: Spacing.lg }}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'image':
            return (
              <View key={index} style={{ gap: Spacing.xs }}>
                <Image source={{ uri: block.url }} style={styles.bodyImage} resizeMode="cover" />
                {!!block.caption && <Text style={styles.imageCaption}>{block.caption}</Text>}
              </View>
            );
          case 'video':
            return <VideoBlock key={index} url={block.url} label={videoLabel} />;
          case 'hr':
            return <View key={index} style={styles.hr} />;
          case 'h1':
            return <Text key={index} style={styles.h1}>{block.text}</Text>;
          case 'h2':
            return (
              <View key={index} style={styles.h2Row}>
                <View style={[styles.h2Accent, { backgroundColor: accentColor }]} />
                <Text style={styles.h2}>{block.text}</Text>
              </View>
            );
          case 'quote':
            return (
              <View key={index} style={[styles.quoteCard, { borderLeftColor: accentColor, backgroundColor: `${accentColor}12` }]}>
                <Text style={[styles.quoteMark, { color: accentColor }]}>”</Text>
                <View style={{ gap: 4, flex: 1 }}>
                  {block.lines.map((l, i) => (
                    <Text key={i} style={styles.quoteText}>{renderInlineMd(l, `q${index}-${i}`)}</Text>
                  ))}
                </View>
              </View>
            );
          case 'ordered':
            return (
              <View key={index} style={{ gap: Spacing.sm }}>
                {block.items.map((item, i) => (
                  <View key={i} style={styles.orderedRow}>
                    <View style={[styles.orderedBadge, { backgroundColor: accentColor }]}>
                      <Text style={styles.orderedBadgeText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.paragraph}>{renderInlineMd(item, `o${index}-${i}`)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'bullet':
            return (
              <View key={index} style={{ gap: Spacing.sm }}>
                {block.items.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: accentColor }]} />
                    <Text style={styles.paragraph}>{renderInlineMd(item, `b${index}-${i}`)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'p':
            return (
              <Text key={index} style={block.lead ? styles.leadParagraph : styles.paragraph}>
                {renderInlineMd(block.text, `p${index}`)}
              </Text>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

/**
 * react-native-render-html nu are randare vizuală pentru <video>/<iframe> (doar le
 * cunoaște structural) — fără aceste randere custom, tag-urile video dispar complet
 * din articol și rămâne doar textul din jur. Refolosim VideoBlock (YouTube + fișier).
 */
const HtmlVideoRenderer: CustomBlockRenderer = ({ tnode }) => {
  const { t } = useTranslation();
  const src = (tnode as any).attributes?.src as string | undefined;
  if (!src) return null;
  return (
    <View style={{ marginVertical: Spacing.sm }}>
      <VideoBlock url={src} label={t('articles_screen.watch_video')} />
    </View>
  );
};

const htmlEmbedRenderers = { video: HtmlVideoRenderer, iframe: HtmlVideoRenderer };

/** Redare articole scrise direct în HTML (din admin), cu stiluri consistente cu restul articolului. */
function ArticleHtmlBody({ html, accentColor }: { html: string; accentColor: string }) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 560) - Spacing.xl * 2;

  return (
    <RenderHtml
      contentWidth={contentWidth}
      source={{ html }}
      renderers={htmlEmbedRenderers}
      baseStyle={{ fontFamily: 'Geist', fontSize: 15.5, lineHeight: 26, color: Colors.textSecondary }}
      tagsStyles={{
        h1: { fontFamily: 'Fraunces', fontSize: 21, color: Colors.textPrimary, lineHeight: 28, marginTop: Spacing.lg, marginBottom: Spacing.xs },
        h2: { fontFamily: 'Geist-SemiBold', fontSize: 17, color: Colors.textPrimary, lineHeight: 23, marginTop: Spacing.lg, marginBottom: Spacing.xs, paddingLeft: Spacing.sm, borderLeftWidth: 4, borderLeftColor: accentColor },
        h3: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.xs },
        p: { marginTop: 0, marginBottom: Spacing.md },
        strong: { fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
        b: { fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
        em: { fontStyle: 'italic' },
        a: { color: accentColor, textDecorationLine: 'underline' },
        ul: { marginVertical: Spacing.sm },
        ol: { marginVertical: Spacing.sm },
        li: { marginBottom: Spacing.sm },
        hr: { borderBottomWidth: 1, borderBottomColor: Colors.border, marginVertical: Spacing.md },
        img: { borderRadius: BorderRadius.xl, marginVertical: Spacing.sm },
        figure: { marginVertical: Spacing.sm },
        figcaption: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.xs },
        blockquote: {
          borderLeftWidth: 3, borderLeftColor: accentColor,
          backgroundColor: `${accentColor}12`, borderRadius: BorderRadius.md,
          paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
          marginVertical: Spacing.sm, marginLeft: 0,
          fontStyle: 'italic', color: Colors.textPrimary,
        },
      }}
    />
  );
}

export default function ArticleDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isPremium, user } = useAuthStore();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Web: redirect to register dacă utilizatorul nu-i autentificat (deep link from share)
  useEffect(() => {
    if (Platform.OS === 'web' && !user && id) {
      // Redirecționează la register cu redirect param
      const redirectUrl = `/modules/articles/${id}`;
      router.replace(`/(auth)/register?redirect=${encodeURIComponent(redirectUrl)}` as any);
    }
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'articles', String(id)))
      .then((snap) => {
        setArticle(snap.exists() ? ({ id: snap.id, ...snap.data() } as Article) : null);
      })
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!user?.uid || !id) return;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        const favs = (snap.data()?.favoriteArticleIds as string[]) || [];
        setIsFavorite(favs.includes(String(id)));
      })
      .catch(() => {});
  }, [user?.uid, id]);

  // Marchează articolul ca citit (un document per cititor → admin poate număra cititori unici).
  // Nu contorizăm dacă articolul e blocat de Premium — utilizatorul n-a citit efectiv conținutul.
  useEffect(() => {
    if (!user?.uid || !article?.id) return;
    if (article.isPremium && !isPremium) return;
    setDoc(
      doc(db, 'articles', article.id, 'reads', user.uid),
      { lastReadAt: serverTimestamp(), readCount: increment(1) },
      { merge: true }
    ).catch(() => {});
  }, [user?.uid, article?.id, article?.isPremium, isPremium]);

  const toggleFavorite = () => {
    if (!user?.uid || !id) return;
    const next = !isFavorite;
    setIsFavorite(next);
    updateDoc(doc(db, 'users', user.uid), {
      favoriteArticleIds: next ? arrayUnion(String(id)) : arrayRemove(String(id)),
    }).catch(() => {});
    if (next) {
      Toast.show({ type: 'success', text1: t('articles_screen.fav_added'), visibilityTime: 1600 });
    }
  };

  const shareArticle = async () => {
    if (!article) return;
    const url = `${ARTICLE_BASE_URL}/${article.id}`;
    const message = `${article.title}\n\n${t('articles_screen.share_text')}\n${url}`;

    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
      if (nav?.share) {
        nav.share({ title: article.title, text: message, url }).catch(() => {});
        return;
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(message).catch(() => {});
        Toast.show({ type: 'success', text1: t('articles_screen.link_copied') });
      }
      return;
    }

    Share.share({ message }).catch(() => {});
  };

  const locked = Boolean(article?.isPremium && !isPremium);
  const isHtml = article?.contentType === 'html';
  const meta = article ? (ARTICLE_CATEGORIES[article.category] || ARTICLE_CATEGORIES.child) : null;
  const accent = meta?.color || Colors.child.primary;
  // Pentru HTML tăiem la un fragment de text simplu (nu markup brut) ca să nu rupem tag-uri la mijloc.
  const previewBody = isHtml
    ? excerpt(article?.body, 500, 'html')
    : article?.body
      ? article.body.slice(0, 300) + (article.body.length > 300 ? '…' : '')
      : '';

  const formattedDate = article?.createdAt
    ? article.createdAt.toDate().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={styles.container}>
      {loading ? (
        <SafeAreaView style={styles.center} edges={['top']}>
          <ActivityIndicator size="large" color={Colors.child.primary} />
        </SafeAreaView>
      ) : !article ? (
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.floatingRow}>
            <TouchableOpacity style={styles.floatBtn} onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.floatGlyph}>←</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={styles.emptyText}>{t('articles_screen.not_found')}</Text>
          </View>
        </SafeAreaView>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
            {/* Hero — titlul peste imagine, stil revistă */}
            <View style={styles.hero}>
              {article.coverImage ? (
                <Image source={{ uri: article.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : meta ? (
                <LinearGradient
                  colors={meta.gradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                >
                  <Text style={styles.heroEmoji}>{meta.emoji}</Text>
                </LinearGradient>
              ) : null}
              {/* Scrim uniform pentru lizibilitatea titlului indiferent de fotografie */}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.24)' }]} />
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.92)']}
                locations={[0, 0.32, 0.58, 1]}
                style={StyleSheet.absoluteFill}
              />
              <SafeAreaView edges={['top']} style={styles.heroContent}>
                <View style={{ flex: 1 }} />
                {meta && (
                  <View style={styles.heroCategoryPill}>
                    <Text style={styles.heroCategoryText}>{meta.emoji}  {t(meta.labelKey).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.heroTitle}>{article.title}</Text>
                <View style={styles.heroMetaRow}>
                  {!!formattedDate && <Text style={styles.heroMeta}>{formattedDate}</Text>}
                  {!!formattedDate && <View style={styles.heroMetaDot} />}
                  <Text style={styles.heroMeta}>{t('articles_screen.read_time', { min: readingMinutes(article.body) })}</Text>
                  {article.isPremium && (
                    <>
                      <View style={styles.heroMetaDot} />
                      <Text style={[styles.heroMeta, { color: '#FFD98A' }]}>💎 Premium</Text>
                    </>
                  )}
                </View>
              </SafeAreaView>
            </View>

            {/* Foaia de conținut, suprapusă peste hero */}
            <View style={styles.sheet}>
              {/* Rând autor + salvare */}
              <View style={styles.authorRow}>
                <LinearGradient
                  colors={meta?.gradient || ['#F0B294', '#D07B55']}
                  style={styles.authorAvatar}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={{ fontSize: 16 }}>🌸</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName}>{t('articles_screen.author_name')}</Text>
                  <Text style={styles.authorRole}>{t('articles_screen.author_role')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveChip, isFavorite && { backgroundColor: `${accent}18`, borderColor: accent }]}
                  onPress={toggleFavorite}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.saveChipHeart, { color: isFavorite ? accent : Colors.textTertiary }]}>
                    {isFavorite ? '♥' : '♡'}
                  </Text>
                  <Text style={[styles.saveChipText, isFavorite && { color: accent }]}>
                    {isFavorite ? t('articles_screen.saved') : t('articles_screen.save')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Video principal al articolului */}
              {!!article.videoUrl && !locked && (
                <View style={{ marginBottom: Spacing.lg }}>
                  <VideoBlock url={article.videoUrl} label={t('articles_screen.watch_video')} />
                </View>
              )}

              {locked ? (
                <>
                  {isHtml ? (
                    <Text style={styles.paragraph}>{previewBody}</Text>
                  ) : (
                    <ArticleBody body={previewBody} accentColor={accent} videoLabel={t('articles_screen.watch_video')} />
                  )}
                  <View style={styles.lockCard}>
                    <Text style={{ fontSize: 32 }}>💎</Text>
                    <Text style={styles.lockTitle}>{t('articles_screen.premium_title')}</Text>
                    <Text style={styles.lockSub}>{t('articles_screen.premium_sub')}</Text>
                    <TouchableOpacity
                      style={styles.lockButton}
                      onPress={() => router.push('/modules/settings/subscription' as any)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.lockButtonText}>{t('articles_screen.premium_btn')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : isHtml ? (
                <ArticleHtmlBody html={article.body || ''} accentColor={accent} />
              ) : (
                <ArticleBody body={article.body || ''} accentColor={accent} videoLabel={t('articles_screen.watch_video')} />
              )}

              {/* Acțiuni de final */}
              {!locked && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnGhost]}
                    onPress={toggleFavorite}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.actionGhostHeart, { color: isFavorite ? accent : Colors.textSecondary }]}>
                      {isFavorite ? '♥' : '♡'}
                    </Text>
                    <Text style={styles.actionGhostText}>
                      {isFavorite ? t('articles_screen.saved') : t('articles_screen.save')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: accent }]}
                    onPress={shareArticle}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionPrimaryText}>{t('articles_screen.share')}  ↗</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Butoane plutitoare peste hero */}
          <SafeAreaView edges={['top']} style={styles.floatingWrap} pointerEvents="box-none">
            <View style={styles.floatingRowInner} pointerEvents="box-none">
              <TouchableOpacity style={styles.floatBtn} onPress={() => router.back()} hitSlop={8}>
                <Text style={styles.floatGlyph}>←</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.floatBtn} onPress={toggleFavorite} hitSlop={8}>
                <Text style={[styles.floatHeart, { color: isFavorite ? '#E0426B' : Colors.textPrimary }]}>
                  {isFavorite ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.floatBtn} onPress={shareArticle} hitSlop={8}>
                <Text style={styles.floatGlyph}>↗</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary },

  // Hero
  hero: { height: 340, overflow: 'hidden' },
  heroEmoji: { position: 'absolute', right: -6, bottom: -22, fontSize: 170, opacity: 0.28 },
  heroContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    // Spațiu suplimentar jos: foaia de conținut se suprapune 28px peste hero
    paddingBottom: Spacing.xl + 28,
  },
  heroCategoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14, paddingHorizontal: Spacing.md, paddingVertical: 4,
    marginBottom: Spacing.md,
  },
  heroCategoryText: { fontSize: 10, fontFamily: 'Geist-Bold', color: Colors.white, letterSpacing: 1.5 },
  heroTitle: { fontSize: 28, fontFamily: 'Fraunces', color: Colors.white, lineHeight: 35 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  heroMeta: { fontSize: 12.5, fontFamily: 'Geist', color: 'rgba(255,255,255,0.88)' },
  heroMetaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' },

  // Foaia de conținut
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  authorAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  authorName: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  authorRole: { fontSize: 11.5, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 1 },
  saveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
    borderRadius: 18, paddingHorizontal: Spacing.md, paddingVertical: 7,
  },
  saveChipHeart: { fontSize: 15, lineHeight: 17 },
  saveChipText: { fontSize: 12.5, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  h1: { fontSize: 21, fontFamily: 'Fraunces', color: Colors.textPrimary, marginTop: Spacing.md, lineHeight: 28 },
  h2Row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  h2Accent: { width: 4, height: 18, borderRadius: 2 },
  h2: { flex: 1, fontSize: 17, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, lineHeight: 23 },
  paragraph: { flex: 1, fontSize: 15.5, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 26 },
  leadParagraph: { flex: 1, fontSize: 17, fontFamily: 'Geist', color: Colors.textPrimary, lineHeight: 27 },
  bold: { fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  bulletRow: { flexDirection: 'row', gap: Spacing.md, paddingLeft: 2, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 10 },
  orderedRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  orderedBadge: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  orderedBadgeText: { fontSize: 11, fontFamily: 'Geist-Bold', color: Colors.white },

  hr: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  quoteCard: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    borderLeftWidth: 3, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
  },
  quoteMark: { fontSize: 26, fontFamily: 'Fraunces', lineHeight: 26 },
  quoteText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary, lineHeight: 23, fontStyle: 'italic' },

  bodyImage: {
    width: '100%', aspectRatio: 16 / 10, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.border, ...Shadow.sm,
  },
  imageCaption: {
    fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary,
    fontStyle: 'italic', textAlign: 'center', paddingHorizontal: Spacing.md,
  },

  videoWrap: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: BorderRadius.xl,
    overflow: 'hidden', backgroundColor: '#1A1A1A',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  videoPlayCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },
  videoLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.white },

  // Butoane plutitoare
  floatingWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  floatingRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  floatingRowInner: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  floatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  floatGlyph: { fontSize: 18, color: Colors.textPrimary, lineHeight: 20 },
  floatHeart: { fontSize: 19, lineHeight: 21 },

  lockCard: {
    alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, marginTop: Spacing.lg, ...Shadow.sm,
  },
  lockTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, textAlign: 'center' },
  lockSub: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  lockButton: {
    backgroundColor: Colors.child.primary, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, marginTop: Spacing.sm,
  },
  lockButtonText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },

  // Acțiuni de final
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing['2xl'] },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: BorderRadius.lg, paddingVertical: Spacing.md + 2,
  },
  actionBtnGhost: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  actionGhostHeart: { fontSize: 17, lineHeight: 19 },
  actionGhostText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  actionPrimaryText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
});
