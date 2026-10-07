import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useAuthStore } from '../../stores/authStore';
import { useAppearance } from '../../hooks/useAppearance';
import { useTranslation } from 'react-i18next';

function TabBarIcon({ emoji, focused, activeColor }: { emoji: string; focused: boolean; activeColor: string }) {
  return (
    <View style={[styles.iconWrapper, focused && { backgroundColor: activeColor }]}>
      <Text style={styles.iconEmoji}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { profileMode } = useAuthStore();
  const appearance = useAppearance();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const accent = appearance.accentColor || (profileMode === 'pregnancy' ? Colors.pregnancy.primary : Colors.child.primary);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: appearance.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: appearance.colors.surfaceStrong,
          borderTopColor: appearance.colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: Spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: 10 * appearance.textScale,
          fontFamily: 'Geist',
        },
        sceneStyle: {
          backgroundColor: appearance.colors.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: profileMode === 'pregnancy' ? t('tabs.pregnancy_home') : t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="🏠" focused={focused} activeColor={appearance.accentLight} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: t('tabs.assistant'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="✨" focused={focused} activeColor={appearance.accentLight} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.addButton, { backgroundColor: accent }]}>
              <Text style={styles.addButtonText}>+</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t('tabs.community'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="👥" focused={focused} activeColor={appearance.accentLight} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="👤" focused={focused} activeColor={appearance.accentLight} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#C46B4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    fontSize: 28,
    color: Colors.white,
    lineHeight: 32,
    fontFamily: 'Geist',
  },
});
