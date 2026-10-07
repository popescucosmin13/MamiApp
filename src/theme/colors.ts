export const Colors = {
  // === MODUL COPIL (default după naștere) ===
  child: {
    primary: '#E8997A',
    primaryDark: '#C46B4F',
    primaryLight: '#F4E4D6',
  },

  // === MODUL SARCINĂ ===
  pregnancy: {
    primary: '#D88FA8',
    primaryDark: '#B96F87',
    primaryLight: '#F4DEE6',
  },

  // === CULORI SEMANTICE (comune ambelor moduri) ===
  success: '#5C8A7A',
  warning: '#D4A574',
  error: '#DC2626',
  info: '#4A5D8C',

  // === NEUTRE ===
  textPrimary: '#3D2E2A',
  textSecondary: '#8B6F65',
  textTertiary: '#B89A7E',

  // === BACKGROUNDS ===
  background: '#FDF6F0',
  backgroundSoft: '#F9EDE3',
  surface: 'rgba(255, 255, 255, 0.7)',
  surfaceStrong: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(232, 153, 122, 0.15)',

  // === ALTELE ===
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // === ACCENT COLORS (pentru module) ===
  sage: '#5C8A7A',
  amber: '#D4A574',
  plum: '#9B7AA8',
  coral: '#C46B4F',
  slate: '#4A5D8C',
  taupe: '#B89A7E',
  espresso: '#3D2E2A',
  caramel: '#B89A7E',
  cream: '#FDF6F0',
  peach: '#F4E4D6',
  rose: '#F4DEE6',

  // === MODULE SPECIFICE ===
  feeding: '#E8997A',
  sleep: '#7A9E8C',
  diaper: '#9B7AA8',
  growth: '#B89A7E',
  vaccine: '#5C8A7A',
  milestone: '#D4A574',
  food: '#C46B4F',
  emotions: '#D88060',
  activities: '#7A5C8A',
  documents: '#5C8A7A',
  wellbeing: '#C46B4F',
  community: '#4A5D8C',
  family: '#7A9E8C',
  emergency: '#DC2626',
  ai: '#9B7AA8',
} as const;

export type ColorKey = keyof typeof Colors;
