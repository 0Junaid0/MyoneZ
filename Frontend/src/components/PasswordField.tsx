/**
 * ===============================================================
 *  FILE: components/PasswordField.tsx
 *  OWNER: Member 1  |  PHASE: 2 (Shared Components)
 *  WHAT: A password box with a show/hide eye button.
 *        With showStrength, it also shows the 4-part strength bar
 *        from the Sign up design ("Good password").
 *  PROPS: value, onChangeText, error, label, placeholder,
 *         showStrength, returnKeyType, onSubmitEditing, isNewPassword
 *  USED BY: Login, Signup
 * ===============================================================
 */
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { InputField, TextInputRef } from './InputField';
import { passwordStrength } from '../utils/validation';
import { colors, fonts, fontSize, sizes, spacing } from '../theme/tokens';

export interface PasswordFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  /** Show the strength bar under the box (Sign up only) */
  showStrength?: boolean;
  /** true on Sign up, so the phone can suggest a strong password */
  isNewPassword?: boolean;
  returnKeyType?: 'done' | 'next' | 'go';
  onSubmitEditing?: () => void;
}

const STRENGTH_TEXT = ['Use at least 8 characters', 'Weak password', 'Okay password', 'Good password', 'Strong password'];

function strengthColor(level: number): string {
  if (level <= 1) return colors.low;
  if (level === 2) return colors.fair;
  return colors.healthy;
}

export const PasswordField = forwardRef<TextInputRef, PasswordFieldProps>(function PasswordField(
  {
    value,
    onChangeText,
    error,
    label = 'Password',
    placeholder,
    showStrength = false,
    isNewPassword = false,
    returnKeyType,
    onSubmitEditing,
  },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const level = passwordStrength(value);
  const Icon = visible ? EyeOff : Eye;

  return (
    <View style={styles.wrapper}>
      <InputField
        ref={ref}
        label={label}
        value={value}
        onChangeText={onChangeText}
        error={error}
        placeholder={placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={isNewPassword ? 'newPassword' : 'password'}
        autoComplete={isNewPassword ? 'new-password' : 'current-password'}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        rightElement={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={4}
            style={styles.eye}
          >
            <Icon size={20} color={colors.textFaint} />
          </Pressable>
        }
      />

      {showStrength && value.length > 0 && !error ? (
        <View style={styles.strength} accessibilityLabel={STRENGTH_TEXT[level]}>
          <View style={styles.bars}>
            {[1, 2, 3, 4].map((step) => (
              <View
                key={step}
                style={[
                  styles.bar,
                  { backgroundColor: step <= level ? strengthColor(level) : colors.border },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthText, { color: strengthColor(level) }]}>
            {STRENGTH_TEXT[level]}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  eye: {
    width: sizes.minTap + 4,
    height: sizes.minTap + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strength: {
    gap: spacing.xs + 2,
  },
  bars: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 4,
  },
  strengthText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.caption,
  },
});
