/**
 * ===============================================================
 *  FILE: components/InputField.tsx
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: A text box with a label on top and a red error below.
 *        Border turns blue when focused and red when there is an error.
 *  PROPS: label, value, onChangeText, placeholder, error, hint,
 *         rightElement (e.g. the eye button), + any TextInput prop
 *         such as keyboardType, autoCapitalize, returnKeyType.
 *  USED BY: Login, Signup, ForgotPassword (Member 1), ContactForm (Member 2)
 *  EXAMPLE:
 *    <InputField label="Email" value={email} onChangeText={setEmail}
 *                keyboardType="email-address" error={errors.email} />
 * ===============================================================
 */
import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, fontSize, radius, sizes, spacing } from '../theme/tokens';

/** The type to use for useRef on any input: useRef<TextInputRef>(null) */
export type TextInputRef = React.ComponentRef<typeof TextInput>;

export interface InputFieldProps
  extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  /** Small grey help text, shown only when there is no error */
  hint?: string;
  /** Something inside the box on the right, e.g. a show/hide button */
  rightElement?: React.ReactNode;
}

export const InputField = forwardRef<TextInputRef, InputFieldProps>(function InputField(
  { label, value, onChangeText, error, hint, rightElement, onFocus, onBlur, multiline, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.low : focused ? colors.primary : colors.inputBorder;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, multiline && styles.boxMultiline, { borderColor }]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={label}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs + 2,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  box: {
    height: sizes.input,
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md + 2,
  },
  boxMultiline: {
    height: undefined,
    minHeight: 96,
    alignItems: 'flex-start',
  },
  inputMultiline: {
    height: undefined,
    minHeight: 96,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: fontSize.input,
    color: colors.text,
    paddingRight: spacing.md,
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: fontSize.caption,
    color: colors.lowText,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});

// Default export too, so Member 2 / 3 / 4 code can write: import InputField from './InputField'
export default InputField;
