import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });

export default function OAuthRedirectScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.child.primary} size="large" />
      <Text style={styles.title}>Finalizam autentificarea...</Text>
      <Text style={styles.subtitle}>Te intoarcem imediat in MamiApp.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
    backgroundColor: Colors.background,
  },
  title: {
    marginTop: Spacing.lg,
    fontFamily: 'Geist-SemiBold',
    fontSize: 17,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontFamily: 'Geist',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
