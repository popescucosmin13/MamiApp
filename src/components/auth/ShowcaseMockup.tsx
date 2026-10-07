import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Moon, Syringe, Sparkles, Calendar, Scale, Briefcase, Check } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius } from '../../theme/spacing';

export type MockupKind =
  | 'feeding'
  | 'sleep'
  | 'growth'
  | 'vaccine'
  | 'ai'
  | 'pregnancyWeek'
  | 'appointments'
  | 'weight'
  | 'hospitalBag';

interface ShowcaseMockupProps {
  kind: MockupKind;
  accentColor: string;
  aiQuestion?: string;
  aiAnswer?: string;
}

export function ShowcaseMockup({ kind, accentColor, aiQuestion, aiAnswer }: ShowcaseMockupProps) {
  switch (kind) {
    case 'feeding':
      return (
        <MockupFrame>
          <View style={styles.row}>
            <View style={[styles.iconDot, { backgroundColor: accentColor + '20' }]}>
              <Text style={styles.iconDotEmoji}>🍼</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Alăptare · stânga</Text>
              <Text style={styles.rowSub}>acum 22 min · 14 minute</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: accentColor + '18' }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>3 azi</Text>
            </View>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: '64%', backgroundColor: accentColor }]} />
          </View>
        </MockupFrame>
      );

    case 'sleep':
      return (
        <MockupFrame>
          <View style={styles.row}>
            <View style={[styles.iconDot, { backgroundColor: accentColor + '20' }]}>
              <Moon size={16} color={accentColor} fill={accentColor} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Somn total azi</Text>
              <Text style={styles.rowSub}>6h 40min · 3 somnuri</Text>
            </View>
          </View>
          <View style={styles.dayTrack}>
            {[
              { w: 22, sleep: true },
              { w: 10, sleep: false },
              { w: 14, sleep: true },
              { w: 30, sleep: false },
              { w: 18, sleep: true },
              { w: 6, sleep: false },
            ].map((seg, i) => (
              <View
                key={i}
                style={[
                  styles.daySegment,
                  {
                    flex: seg.w,
                    backgroundColor: seg.sleep ? accentColor : 'rgba(0,0,0,0.06)',
                  },
                ]}
              />
            ))}
          </View>
        </MockupFrame>
      );

    case 'growth':
      return (
        <MockupFrame>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Percentila 65</Text>
              <Text style={styles.rowSub}>Greutate · 4 luni</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: accentColor + '18' }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>Normal</Text>
            </View>
          </View>
          <View style={styles.chartRow}>
            {[30, 45, 40, 58, 52, 68, 74].map((h, i) => (
              <View key={i} style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${h}%`,
                      backgroundColor: i === 6 ? accentColor : accentColor + '30',
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        </MockupFrame>
      );

    case 'vaccine':
      return (
        <MockupFrame>
          <ChecklistRow icon="check" label="Hexavalent · 2 luni" done accentColor={accentColor} />
          <ChecklistRow icon="clock" label="Pneumococică · 4 luni" accentColor={accentColor} highlight />
          <ChecklistRow icon="dot" label="Rotavirus · 6 luni" accentColor={accentColor} />
        </MockupFrame>
      );

    case 'ai':
      return (
        <MockupFrame>
          <View style={styles.chatBubbleUser}>
            <Text style={styles.chatBubbleUserText}>
              {aiQuestion ?? 'De câte ori pe zi să alăptez?'}
            </Text>
          </View>
          <View style={styles.chatRowAi}>
            <View style={[styles.aiAvatar, { backgroundColor: accentColor }]}>
              <Sparkles size={12} color={Colors.white} />
            </View>
            <View style={[styles.chatBubbleAi, { backgroundColor: accentColor + '14' }]}>
              <Text style={styles.chatBubbleAiText} numberOfLines={2}>
                {aiAnswer ?? 'În medie 8-12 alăptări pe zi în prima lună, apoi scade treptat...'}
              </Text>
            </View>
          </View>
        </MockupFrame>
      );

    case 'pregnancyWeek':
      return (
        <MockupFrame>
          <View style={styles.row}>
            <View style={[styles.weekBadge, { borderColor: accentColor }]}>
              <Text style={[styles.weekBadgeNumber, { color: accentColor }]}>24</Text>
              <Text style={styles.weekBadgeLabel}>săpt.</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Bebe are mărimea unei</Text>
              <Text style={styles.rowSub}>vinete 🍆 · ~30 cm, 600 g</Text>
            </View>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: '60%', backgroundColor: accentColor }]} />
          </View>
        </MockupFrame>
      );

    case 'appointments':
      return (
        <MockupFrame>
          <View style={styles.row}>
            <View style={[styles.iconDot, { backgroundColor: accentColor + '20' }]}>
              <Calendar size={16} color={accentColor} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Control ecografie morfologică</Text>
              <Text style={styles.rowSub}>14 Martie · 10:30 · Dr. Popescu</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.iconDot, { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
              <Calendar size={16} color={Colors.textTertiary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: Colors.textTertiary }]}>Analize de sânge</Text>
              <Text style={styles.rowSub}>28 Martie · 09:00</Text>
            </View>
          </View>
        </MockupFrame>
      );

    case 'weight':
      return (
        <MockupFrame>
          <View style={styles.row}>
            <View style={[styles.iconDot, { backgroundColor: accentColor + '20' }]}>
              <Scale size={16} color={accentColor} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>+8.2 kg până acum</Text>
              <Text style={styles.rowSub}>Săptămâna 24 · în limite normale</Text>
            </View>
          </View>
          <View style={styles.chartRow}>
            {[20, 28, 34, 40, 48, 55, 64].map((h, i) => (
              <View key={i} style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    { height: `${h}%`, backgroundColor: i === 6 ? accentColor : accentColor + '30' },
                  ]}
                />
              </View>
            ))}
          </View>
        </MockupFrame>
      );

    case 'hospitalBag':
      return (
        <MockupFrame>
          <ChecklistRow icon="check" label="Acte și documente" done accentColor={accentColor} />
          <ChecklistRow icon="check" label="Trusă bebeluș" done accentColor={accentColor} />
          <ChecklistRow icon="dot" label="Halat și papuci" accentColor={accentColor} />
        </MockupFrame>
      );

    default:
      return null;
  }
}

function MockupFrame({ children }: { children: React.ReactNode }) {
  return <View style={styles.frame}>{children}</View>;
}

function ChecklistRow({
  icon,
  label,
  done,
  highlight,
  accentColor,
}: {
  icon: 'check' | 'clock' | 'dot';
  label: string;
  done?: boolean;
  highlight?: boolean;
  accentColor: string;
}) {
  return (
    <View style={styles.checklistRow}>
      <View
        style={[
          styles.checklistDot,
          done && { backgroundColor: accentColor, borderColor: accentColor },
          highlight && { borderColor: accentColor },
        ]}
      >
        {done && <Check size={11} color={Colors.white} strokeWidth={3} />}
      </View>
      <Text
        style={[
          styles.checklistLabel,
          done && styles.checklistLabelDone,
          highlight && { color: accentColor, fontFamily: 'Geist-SemiBold' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  rowSub: {
    fontSize: 11,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: 1,
  },
  iconDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDotEmoji: {
    fontSize: 15,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Geist-Bold',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  dayTrack: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
  },
  daySegment: {
    height: '100%',
    borderRadius: 3,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
    gap: 6,
  },
  chartBarTrack: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checklistDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistLabel: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  checklistLabelDone: {
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chatBubbleUserText: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  chatRowAi: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  chatBubbleAi: {
    flex: 1,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chatBubbleAiText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  weekBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBadgeNumber: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    lineHeight: 20,
  },
  weekBadgeLabel: {
    fontSize: 9,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
});
