import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface SkeletonItemProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonItem({ width = '100%', height = 16, radius = BorderRadius.sm, style }: SkeletonItemProps) {
  return (
    <MotiSkeleton
      colorMode="light"
      colors={[Colors.backgroundSoft, Colors.background, Colors.backgroundSoft]}
      width={width as number}
      height={height}
      radius={radius}
    >
      <View style={[{ width: width as any, height, borderRadius: radius }, style]} />
    </MotiSkeleton>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonItem width={120} height={12} />
      <View style={styles.gap} />
      <SkeletonItem width="80%" height={24} />
      <View style={styles.gap} />
      <SkeletonItem width="60%" height={12} />
    </View>
  );
}

export function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <SkeletonItem width={40} height={40} radius={BorderRadius.md} />
      <View style={styles.listContent}>
        <SkeletonItem width="70%" height={14} />
        <View style={{ height: 4 }} />
        <SkeletonItem width="50%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  gap: {
    height: Spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  listContent: {
    flex: 1,
  },
});
