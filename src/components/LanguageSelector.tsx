import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';
import { BorderRadius, Spacing } from '../theme/spacing';

type Variant = 'light' | 'outline' | 'flags';

interface LanguageSelectorProps {
  variant?: Variant;
  compact?: boolean;
  onChange?: (language: SupportedLanguage) => void | Promise<void>;
}

export function LanguageSelector({ variant = 'outline', compact = false, onChange }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const currentLanguage = getCurrentLanguage();

  const handleSelect = async (language: SupportedLanguage) => {
    if (language === currentLanguage) return;
    await changeLanguage(language);
    await onChange?.(language);
  };

  return (
    <View style={[styles.wrap, variant === 'light' && styles.wrapLight, variant === 'flags' && styles.wrapFlags, compact && styles.wrapCompact]}>
      {SUPPORTED_LANGUAGES.map((language) => {
        const active = currentLanguage === language.code || i18n.language === language.code;
        return (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.option,
              variant === 'light' && styles.optionLight,
              variant === 'flags' && styles.optionFlag,
              variant === 'flags' && compact && styles.optionFlagCompact,
              active && styles.optionActive,
              active && variant === 'light' && styles.optionActiveLight,
              active && variant === 'flags' && styles.optionFlagActive,
            ]}
            onPress={() => handleSelect(language.code)}
            activeOpacity={0.75}
          >
            {variant === 'flags' ? (
              <FlagIcon code={language.code} compact={compact} />
            ) : (
              <Text style={[styles.flag, active && styles.flagActive]}>{language.flag}</Text>
            )}
            {!(variant === 'flags' && compact) && (
              <Text style={[styles.label, variant === 'light' && styles.labelLight, variant === 'flags' && styles.labelFlag, active && styles.labelActive]}>
                {variant === 'flags' ? language.shortLabel : language.nativeLabel}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FlagIcon({ code, compact = false }: { code: SupportedLanguage; compact?: boolean }) {
  if (code === 'ro') {
    return (
      <View style={[styles.flagFrame, compact && styles.flagFrameCompact]}>
        <View style={[styles.roStripe, { backgroundColor: '#002B7F' }]} />
        <View style={[styles.roStripe, { backgroundColor: '#FCD116' }]} />
        <View style={[styles.roStripe, { backgroundColor: '#CE1126' }]} />
      </View>
    );
  }

  return (
    <View style={[styles.flagFrame, compact && styles.flagFrameCompact, styles.ukFlag]}>
      <View style={[styles.ukDiagonal, styles.ukDiagonalWhite, { transform: [{ rotate: '29deg' }] }]} />
      <View style={[styles.ukDiagonal, styles.ukDiagonalWhite, { transform: [{ rotate: '-29deg' }] }]} />
      <View style={[styles.ukDiagonal, styles.ukDiagonalRed, { transform: [{ rotate: '29deg' }] }]} />
      <View style={[styles.ukDiagonal, styles.ukDiagonalRed, { transform: [{ rotate: '-29deg' }] }]} />
      <View style={styles.ukWhiteHorizontal} />
      <View style={styles.ukWhiteVertical} />
      <View style={styles.ukRedHorizontal} />
      <View style={styles.ukRedVertical} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E8DF',
  },
  wrapLight: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  wrapFlags: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: '#F3DED2',
    padding: 3,
  },
  wrapCompact: {
    padding: 2,
    gap: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  optionLight: {
    paddingHorizontal: 9,
  },
  optionFlag: {
    flexDirection: 'column',
    minWidth: 58,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  optionFlagCompact: {
    minWidth: 30,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  optionActive: {
    backgroundColor: '#EAB090',
  },
  optionActiveLight: {
    backgroundColor: '#1C130D',
  },
  optionFlagActive: {
    backgroundColor: '#EAB090',
    shadowColor: '#D4906C',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  flag: {
    fontSize: 15,
    color: '#9A7A60',
    fontFamily: 'Geist-SemiBold',
  },
  flagActive: {
    color: '#FFFFFF',
  },
  flagFrame: {
    width: 30,
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(28,19,13,0.12)',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  flagFrameCompact: {
    width: 20,
    height: 14,
    borderRadius: 3,
  },
  roStripe: {
    flex: 1,
  },
  ukFlag: {
    position: 'relative',
    backgroundColor: '#012169',
    flexDirection: 'column',
  },
  ukDiagonal: {
    position: 'absolute',
    left: -5,
    top: 8,
    width: 40,
  },
  ukDiagonalWhite: {
    height: 5,
    backgroundColor: '#FFFFFF',
  },
  ukDiagonalRed: {
    height: 2.5,
    top: 9.25,
    backgroundColor: '#C8102E',
  },
  ukWhiteHorizontal: {
    position: 'absolute',
    left: 0,
    top: 7,
    width: 30,
    height: 6,
    backgroundColor: '#FFFFFF',
  },
  ukWhiteVertical: {
    position: 'absolute',
    left: 12,
    top: 0,
    width: 6,
    height: 20,
    backgroundColor: '#FFFFFF',
  },
  ukRedHorizontal: {
    position: 'absolute',
    left: 0,
    top: 8.5,
    width: 30,
    height: 3,
    backgroundColor: '#C8102E',
  },
  ukRedVertical: {
    position: 'absolute',
    left: 13.5,
    top: 0,
    width: 3,
    height: 20,
    backgroundColor: '#C8102E',
  },
  label: {
    fontSize: 12,
    color: '#6D5542',
    fontFamily: 'Geist-SemiBold',
  },
  labelFlag: {
    fontSize: 10,
    lineHeight: 12,
  },
  labelLight: {
    color: '#5A4030',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
