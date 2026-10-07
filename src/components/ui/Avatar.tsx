import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius } from '../../theme/spacing';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string;
  emoji?: string;
  imageUri?: string;
  size?: AvatarSize;
  color?: string;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 56,
  xl: 80,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 36,
};

export function Avatar({
  name,
  emoji,
  imageUri,
  size = 'md',
  color,
}: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];

  const containerStyle = {
    width: dimension,
    height: dimension,
    borderRadius: BorderRadius.full,
    backgroundColor: color || Colors.child.primaryLight,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (imageUri) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: dimension, height: dimension }}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (emoji) {
    return (
      <View style={containerStyle}>
        <Text style={{ fontSize: fontSize * 0.75 }}>{emoji}</Text>
      </View>
    );
  }

  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <View style={containerStyle}>
      <Text
        style={{
          fontSize: fontSize * 0.45,
          fontWeight: '600',
          color: Colors.child.primaryDark,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
