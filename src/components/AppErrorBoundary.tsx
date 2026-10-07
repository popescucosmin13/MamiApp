import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import i18n from 'i18next';
import { Colors } from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

interface State { hasError: boolean; error: Error | null; }

async function clearAndReload() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys().catch(() => [] as string[]);
      await Promise.all(keys.map(k => window.caches.delete(k)));
    }
    if ('serviceWorker' in navigator && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
    }
    const firebaseDbs = [
      'firebaseLocalStorageDb',
      'firebase-installations-database',
      'firebase-messaging-database',
    ];
    firebaseDbs.forEach(name => {
      try { indexedDB.deleteDatabase(name); } catch { /* ignore */ }
    });
  } catch { /* ignore cleanup errors */ }
  window.location.reload();
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] crash:', error.message, info.componentStack?.slice(0, 200));
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🌸</Text>
        <Text style={styles.title}>{i18n.t('error_boundary.title')}</Text>
        <Text style={styles.message}>{i18n.t('error_boundary.subtitle')}</Text>
        <TouchableOpacity style={styles.btn} onPress={clearAndReload} activeOpacity={0.85}>
          <Text style={styles.btnText}>🔄 {i18n.t('error_boundary.retry')}</Text>
        </TouchableOpacity>
        {__DEV__ && this.state.error && (
          <Text style={styles.devError}>{this.state.error.toString()}</Text>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  emoji: { fontSize: 56, marginBottom: Spacing.xl },
  title: {
    fontSize: 22,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['2xl'],
    maxWidth: 320,
  },
  btn: {
    backgroundColor: Colors.child.primary,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  devError: {
    marginTop: Spacing.xl,
    fontSize: 11,
    fontFamily: 'Geist',
    color: Colors.error,
    textAlign: 'center',
    maxWidth: 360,
  },
});
