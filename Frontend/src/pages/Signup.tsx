/**
 * ===============================================================
 *  FILE: pages/Signup.tsx
 *  OWNER: Member 1  |  PHASE: 3 (Pages)
 *  WHAT: The Create account screen.
 *    Back button, First name + Last name (side by side), Email,
 *    Password with strength bar, Confirm password,
 *    "I agree to the Terms and Privacy Policy" checkbox, Create account.
 *  FLOW: Create account
 *        → register()  (POST /api/v1/auth/register/)
 *        → ask notification permission (the PDF says: after sign up)
 *        → verify code (pages/VerifyOtp.tsx) → signed in
 *        → App.tsx shows Home by itself.
 *  NOTE: If the email is already used, the server error is shown
 *        under the Email box.
 * ===============================================================
 */
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Button } from '../components/Button';
import { InputField, TextInputRef } from '../components/InputField';
import { PasswordField } from '../components/PasswordField';
import { useAuthStore } from '../store/auth';
import { getErrorMessage } from '../api/client';
import { requestPushPermission } from '../notifications/push';
import { hasErrors, SignupErrors, SignupForm, validateSignup } from '../utils/validation';
import type { AuthStackParamList } from '../types/navigation';
import { colors, fonts, fontSize, radius, sizes, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const EMPTY_FORM: SignupForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

/** Reads a field error like { "email": ["already exists"] } from Django */
function serverFieldError(error: unknown, field: string): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = error.response?.data as Record<string, unknown> | undefined;
  // Django wraps field errors: { error: { detail: { password: ["..."] } } }
  const wrapped = (data?.error as { detail?: Record<string, unknown> } | undefined)?.detail;
  const value = (wrapped && typeof wrapped === 'object' ? wrapped[field] : undefined) ?? data?.[field];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export default function SignupScreen({ navigation }: Props) {
  const register = useAuthStore((state) => state.register);

  const lastNameRef = useRef<TextInputRef>(null);
  const emailRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);

  const [form, setForm] = useState<SignupForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const found = validateSignup(form);
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) return;

    setSubmitting(true);

    // 1. Create the account
    try {
      await register({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
      });
    } catch (error) {
      const emailError = serverFieldError(error, 'email');
      const passwordError = serverFieldError(error, 'password');
      if (emailError || passwordError) {
        setErrors({ email: emailError, password: passwordError });
      } else {
        setFormError(getErrorMessage(error));
      }
      setSubmitting(false);
      return;
    }

    // 2. Ask for notification permission (a "No" is fine — Home shows a reminder card)
    try {
      await requestPushPermission();
    } catch {
      // never block sign up because of notifications
    }

    // 3. The store now waits for the emailed code: App.tsx shows the Verify screen.
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.title} accessibilityRole="header">
            Create your account
          </Text>
          <Text style={styles.subtitle}>It takes less than a minute.</Text>

          {formError ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={styles.flex}>
                <InputField
                  label="First name"
                  value={form.firstName}
                  onChangeText={(text) => update('firstName', text)}
                  error={errors.firstName}
                  placeholder="Ayesha"
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={styles.flex}>
                <InputField
                  ref={lastNameRef}
                  label="Last name"
                  value={form.lastName}
                  onChangeText={(text) => update('lastName', text)}
                  error={errors.lastName}
                  placeholder="Rahman"
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <InputField
              ref={emailRef}
              label="Email"
              value={form.email}
              onChangeText={(text) => update('email', text)}
              error={errors.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <PasswordField
              ref={passwordRef}
              value={form.password}
              onChangeText={(text) => update('password', text)}
              error={errors.password}
              placeholder="At least 10 characters"
              showStrength
              isNewPassword
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />

            <PasswordField
              ref={confirmRef}
              label="Confirm password"
              value={form.confirmPassword}
              onChangeText={(text) => update('confirmPassword', text)}
              error={errors.confirmPassword}
              placeholder="Type it again"
              isNewPassword
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {/* Terms checkbox */}
            <Pressable
              onPress={() => update('acceptedTerms', !form.acceptedTerms)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.acceptedTerms }}
              style={styles.termsRow}
            >
              <View style={[styles.checkbox, form.acceptedTerms && styles.checkboxOn, errors.acceptedTerms ? styles.checkboxError : null]}>
                {form.acceptedTerms ? <Check size={16} color={colors.onDark} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </Pressable>
            {errors.acceptedTerms ? <Text style={styles.fieldError}>{errors.acceptedTerms}</Text> : null}

            <Button title="Create account" onPress={handleSubmit} loading={submitting} />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="link" hitSlop={12}>
                <Text style={styles.loginLink}>Log in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  backButton: {
    width: sizes.minTap,
    height: sizes.minTap,
    marginLeft: -spacing.md,
    marginTop: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.md,
    fontFamily: fonts.extrabold,
    fontSize: fontSize.title,
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs + 2,
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  formError: {
    marginTop: spacing.lg,
    backgroundColor: colors.lowSoft,
    borderColor: colors.lowBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  formErrorText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.small,
    color: colors.lowText,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.minTap,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxError: {
    borderColor: colors.low,
  },
  termsText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.textMuted,
  },
  termsLink: {
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  fieldError: {
    marginTop: -spacing.md,
    fontFamily: fonts.medium,
    fontSize: fontSize.caption,
    color: colors.lowText,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: sizes.minTap,
  },
  loginText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  loginLink: {
    fontFamily: fonts.bold,
    fontSize: fontSize.body,
    color: colors.primary,
  },
});
