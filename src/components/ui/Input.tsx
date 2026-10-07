import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Pressable,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Typography, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  containerStyle?: ViewStyle;
  hint?: string;
}

export function Input({
  label,
  error,
  prefix,
  suffix,
  containerStyle,
  hint,
  value,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = !!(value && value.length > 0);
  const labelProgress = useSharedValue(hasValue ? 1 : 0);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    labelProgress.value = withTiming(1, { duration: 150 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!hasValue) {
      labelProgress.value = withTiming(0, { duration: 150 });
    }
    onBlur?.(e);
  };

  const labelStyle = useAnimatedStyle(() => ({
    top: interpolate(labelProgress.value, [0, 1], [14, 4]),
    fontSize: interpolate(labelProgress.value, [0, 1], [FontSize.body, FontSize.bodySmall]),
    color: isFocused
      ? Colors.child.primary
      : Colors.textSecondary,
  }));

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          error ? styles.errorBorder : null,
        ]}
      >
        {prefix && <View style={styles.prefix}>{prefix}</View>}
        <View style={styles.innerWrapper}>
          <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
          <TextInput
            value={value}
            style={[styles.input, suffix ? styles.inputWithSuffix : null, prefix ? styles.inputWithPrefix : null]}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={Colors.textTertiary}
            selectionColor={Colors.child.primary}
            {...rest}
          />
        </View>
        {suffix && <View style={styles.suffix}>{suffix}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  focused: {
    borderColor: Colors.child.primary,
    backgroundColor: Colors.white,
  },
  errorBorder: {
    borderColor: Colors.error,
  },
  prefix: {
    paddingLeft: Spacing.md,
    color: Colors.textSecondary,
  },
  suffix: {
    paddingRight: Spacing.md,
  },
  innerWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    justifyContent: 'center',
    minHeight: 56,
  },
  label: {
    ...Typography.bodySmall,
    position: 'absolute',
    left: Spacing.md,
  },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
    minHeight: 40,
  },
  inputWithPrefix: {
    paddingLeft: Spacing.xs,
  },
  inputWithSuffix: {
    paddingRight: Spacing.xs,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});
