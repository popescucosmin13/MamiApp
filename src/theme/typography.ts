import { TextStyle } from 'react-native';

export const FontFamily = {
  display: 'Fraunces',
  displayItalic: 'Fraunces-Italic',
  body: 'Geist',
} as const;

export const FontSize = {
  displayLarge: 32,
  displayMedium: 24,
  heading1: 20,
  heading2: 18,
  bodyLarge: 16,
  body: 14,
  bodySmall: 12,
  caption: 10,
} as const;

export const FontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1.0,
  widest: 1.5,
} as const;

export const Typography = {
  displayLarge: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.displayLarge,
    fontWeight: FontWeight.light,
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize.displayLarge * LineHeight.tight,
  } as TextStyle,
  displayMedium: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.displayMedium,
    fontWeight: FontWeight.regular,
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize.displayMedium * LineHeight.normal,
  } as TextStyle,
  heading1: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.heading1,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.heading1 * LineHeight.normal,
  } as TextStyle,
  heading2: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.heading2,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.heading2 * LineHeight.normal,
  } as TextStyle,
  bodyLarge: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodyLarge,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.bodyLarge * LineHeight.relaxed,
  } as TextStyle,
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.body * LineHeight.relaxed,
  } as TextStyle,
  bodySmall: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.bodySmall * LineHeight.normal,
  } as TextStyle,
  caption: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  } as TextStyle,
  bodyMedium: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.body * LineHeight.normal,
  } as TextStyle,
  bodySemibold: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.body * LineHeight.normal,
  } as TextStyle,
} as const;
