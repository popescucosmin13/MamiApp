import { useColorScheme } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../theme/colors';

export type ThemeOption = 'auto' | 'light' | 'dark';
export type AccentOption = 'coral' | 'sage' | 'plum' | 'slate';
export type TextSize = 'small' | 'medium' | 'large';

const ACCENT_COLORS: Record<AccentOption, { color: string; light: string; dark: string }> = {
  coral: { color: '#C4704A', light: '#F4E4D6', dark: '#9A4828' },
  sage: { color: '#5BAA90', light: '#DDF2E9', dark: '#3A8A70' },
  plum: { color: '#9B7AA8', light: '#EDE3F1', dark: '#7A5A88' },
  slate: { color: '#5A78A0', light: '#E3ECF6', dark: '#3A5880' },
};

const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.94,
  medium: 1,
  large: 1.08,
};

export function getAppearanceFromPreferences(preferences: any, systemScheme?: 'light' | 'dark' | null) {
  const theme = (preferences?.theme ?? 'auto') as ThemeOption;
  const appearance = preferences?.appearance ?? {};
  const accent = (appearance.accent ?? 'coral') as AccentOption;
  const textSize = (appearance.textSize ?? 'medium') as TextSize;
  const compact = Boolean(appearance.compact);
  const resolvedTheme = 'light';
  const accentPalette = ACCENT_COLORS[accent] ?? ACCENT_COLORS.coral;
  const isDark = false;

  return {
    theme,
    resolvedTheme,
    isDark,
    accent,
    accentColor: accentPalette.color,
    accentLight: accentPalette.light,
    accentDark: accentPalette.dark,
    textSize,
    textScale: TEXT_SCALE[textSize] ?? 1,
    compact,
    colors: {
      background: isDark ? '#17131C' : Colors.background,
      backgroundSoft: isDark ? '#241C2A' : Colors.backgroundSoft,
      surface: isDark ? '#211927' : Colors.white,
      surfaceStrong: isDark ? '#2B2132' : Colors.surfaceStrong,
      textPrimary: isDark ? '#F8F2FA' : Colors.textPrimary,
      textSecondary: isDark ? '#D9C8DE' : Colors.textSecondary,
      textTertiary: isDark ? '#A997B0' : Colors.textTertiary,
      border: isDark ? 'rgba(255,255,255,0.10)' : Colors.border,
    },
  };
}

export function useAppearance() {
  const systemScheme = useColorScheme();
  const preferences = useAuthStore((state) => state.profile?.preferences);
  return getAppearanceFromPreferences(preferences, systemScheme);
}
