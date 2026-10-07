import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Variant = 'warm' | 'child' | 'pregnancy';

const PALETTES: Record<Variant, [string, string, string]> = {
  warm: ['#FDF6F0', '#F6E7DA', '#F4DEE6'],
  child: ['#FDF6F0', '#F7E9DC', '#F4E4D6'],
  pregnancy: ['#FDF6F0', '#F8E7EC', '#F4DEE6'],
};

const BLOBS: Record<Variant, [string, string]> = {
  warm: ['rgba(232,153,122,0.10)', 'rgba(216,143,168,0.10)'],
  child: ['rgba(232,153,122,0.12)', 'rgba(212,165,116,0.09)'],
  pregnancy: ['rgba(216,143,168,0.12)', 'rgba(155,122,168,0.08)'],
};

interface AuthBackgroundProps {
  variant?: Variant;
  children: React.ReactNode;
}

export function AuthBackground({ variant = 'warm', children }: AuthBackgroundProps) {
  const [topBlob, bottomBlob] = BLOBS[variant];
  return (
    <LinearGradient
      colors={PALETTES[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <View style={[styles.blob, styles.blobTop, { backgroundColor: topBlob }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: bottomBlob }]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobTop: {
    width: 320,
    height: 320,
    top: -120,
    right: -110,
  },
  blobBottom: {
    width: 400,
    height: 400,
    bottom: -180,
    left: -150,
  },
});
