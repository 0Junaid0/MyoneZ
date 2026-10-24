/**
 * ===============================================================
 *  FILE: components/Button.tsx
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: The one button used everywhere in the app.
 *  PROPS: title, onPress, variant, disabled, loading, icon, style
 *  VARIANTS:
 *    primary   → blue, white text  (Log in, Send now, Save)
 *    secondary → white with grey border (Continue with Google, Later)
 *    ghost     → text only, blue (Forgot password?, Mark all read)
 *    danger    → red text (Cancel schedule, Log out)
 *    light     → white on the dark Home card (Review drafts)
 *  EXAMPLE:
 *    <Button title="Log in" onPress={handleLogin} loading={busy} />
 * ===============================================================
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fonts, fontSize, radius, sizes, spacing } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Optional icon shown before the title */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const VARIANT_COLORS: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: colors.primary, border: colors.primary, text: colors.onDark },
  secondary: { background: colors.surface, border: colors.inputBorder, text: colors.text },
  ghost: { background: 'transparent', border: 'transparent', text: colors.primary },
  danger: { background: colors.surface, border: colors.lowBorder, text: colors.lowText },
  light: { background: colors.surface, border: colors.surface, text: colors.navy },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityHint,
}: ButtonProps) {
  const palette = VARIANT_COLORS[variant];
  const isBlocked = disabled || loading;
  // A disabled primary button turns grey (design: "Write something to send")
  const greyedOut = disabled && !loading && variant === 'primary';

  const background = greyedOut ? colors.inputBorder : palette.background;
  const border = greyedOut ? colors.inputBorder : palette.border;
  const textColor = greyedOut ? colors.textSecondary : palette.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' && styles.ghost,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: disabled && !greyedOut ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.button,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    height: sizes.minTap,
    paddingHorizontal: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSize.input,
  },
});

// Default export too, so Member 2 / 3 / 4 code can write: import Button from './Button'
export default Button;
