/**
 * ===============================================================
 *  FILE: pages/ForgotPassword.tsx
 *  OWNER: Member 1  |  PHASE: 3 (Pages)
 *  WHAT: "Forgot password?" screen, in three steps:
 *    Step 1: lock icon, short text, Email box, "Send code".
 *    Step 2: the 6-digit code from the email + new password
 *            (the app has no web page, so there is no reset link).
 *    Step 3: green check + "Password changed" + Back to log in.
 *  SECURITY: Step 1 always moves on with the same message, even if
 *            the email is not registered (so nobody can test emails).
 *            Only a network error is shown as an error there.
 *  BACKEND: POST /api/v1/auth/password-reset/ { email }
 *           POST /api/v1/auth/password-reset/confirm/
 *                { challenge_id, code, new_password }
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
import { ChevronLeft, Lock, MailCheck } from 'lucide-react-native';
import { Button } from '../components/Button';
import { InputField, TextInputRef } from '../components/InputField';
import { PasswordField } from '../components/PasswordField';
import { authApi } from '../api/authApi';
import { getErrorMessage, isNetworkError } from '../api/client';
import { isValidEmail } from '../utils/validation';
import type { AuthStackParamList } from '../types/navigation';
import type { OtpChallenge } from '../types/api';
import { colors, fonts, fontSize, radius, sizes, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
type Step = 'email' | 'code' | 'done';

interface CodeErrors {
  code?: string;
  password?: string;
  confirm?: string;
}

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<CodeErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const passwordRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);

  const sendCode = async (): Promise<boolean> => {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setEmailError('Enter your email.');
      return false;
    }
    if (!isValidEmail(clean)) {
      setEmailError('This email does not look right.');
      return false;
    }
    setEmailError(undefined);
    setSubmitting(true);
    try {
      setChallenge(await authApi.requestPasswordReset(clean));
      setEmail(clean);
      setStep('code');
      return true;
    } catch (err) {
      // only "can't reach the server" (or the server's own sentence, e.g. mail is down) is shown
      setEmailError(getErrorMessage(err));
      if (!isNetworkError(err)) setStep('email');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setFormError(undefined);
    setCode('');
    if (await sendCode()) setInfo('We sent a new code.');
  };

  const resetPassword = async () => {
    const found: CodeErrors = {};
    if (!/^\d{6}$/.test(code)) found.code = 'Enter the 6-digit code from the email.';
    if (password.length < 10) found.password = 'Use at least 10 characters.';
    if (confirm !== password) found.confirm = 'Passwords do not match.';
    setErrors(found);
    setFormError(undefined);
    setInfo(undefined);
    if (Object.values(found).some(Boolean) || !challenge) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword(challenge.challenge_id, code, password);
      setStep('done');
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => (step === 'code' ? setStep('email') : navigation.goBack())}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>

          {step === 'email' ? (
            /* ---------- Step 1: ask for email ---------- */
            <View style={styles.body}>
              <View style={styles.iconTile}>
                <Lock size={26} color={colors.primary} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                Forgot your password?
              </Text>
              <Text style={styles.text}>
                Enter the email you signed up with. We'll send you a 6-digit code to set a new password.
              </Text>

              <View style={styles.form}>
                <InputField
                  label="Email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError(undefined);
                  }}
                  error={emailError}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                  autoFocus
                />
                <Button title="Send code" onPress={sendCode} loading={submitting} />
                <Button title="Back to log in" variant="ghost" onPress={() => navigation.navigate('Login')} />
              </View>
            </View>
          ) : step === 'code' ? (
            /* ---------- Step 2: code + new password ---------- */
            <View style={styles.body}>
              <View style={styles.iconTile}>
                <MailCheck size={26} color={colors.primary} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                Check your email
              </Text>
              <Text style={styles.text} accessibilityLiveRegion="polite">
                If an account exists for <Text style={styles.bold}>{email}</Text>, we sent a 6-digit code to it. It
                expires in 10 minutes. Check your spam folder too.
              </Text>

              {challenge?.debug_code ? (
                <View style={styles.debug}>
                  <Text style={styles.debugText}>Dev code: {challenge.debug_code}</Text>
                </View>
              ) : null}
              {formError ? (
                <View style={styles.error} accessibilityRole="alert">
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}
              {info ? <Text style={styles.infoText}>{info}</Text> : null}

              <View style={styles.form}>
                <InputField
                  label="6-digit code"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  error={errors.code}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  textContentType="oneTimeCode"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <PasswordField
                  ref={passwordRef}
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  error={errors.password}
                  placeholder="At least 10 characters"
                  showStrength
                  isNewPassword
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
                <PasswordField
                  ref={confirmRef}
                  label="Confirm new password"
                  value={confirm}
                  onChangeText={setConfirm}
                  error={errors.confirm}
                  placeholder="Type it again"
                  isNewPassword
                  returnKeyType="done"
                  onSubmitEditing={resetPassword}
                />
                <Button title="Set new password" onPress={resetPassword} loading={submitting} />
                <Button title="Send a new code" variant="ghost" onPress={resend} disabled={submitting} />
              </View>
            </View>
          ) : (
            /* ---------- Step 3: done ---------- */
            <View style={styles.body}>
              <View style={[styles.iconTile, styles.iconTileSuccess]}>
                <MailCheck size={26} color={colors.healthy} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                Password changed
              </Text>
              <Text style={styles.text} accessibilityLiveRegion="polite">
                You can now log in with your new password. Other phones signed in to this account were signed out.
              </Text>
              <View style={styles.form}>
                <Button title="Back to log in" onPress={() => navigation.navigate('Login')} />
              </View>
            </View>
          )}
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
  body: {
    marginTop: spacing.xxl,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconTileSuccess: {
    backgroundColor: colors.healthySoft,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSize.title,
    color: colors.text,
  },
  text: {
    marginTop: spacing.sm + 2,
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    lineHeight: 23,
    color: colors.textMuted,
  },
  bold: {
    fontFamily: fonts.bold,
    color: colors.text,
  },
  form: {
    marginTop: spacing.xxl + spacing.xs,
    gap: spacing.lg,
  },
  debug: {
    marginTop: spacing.lg,
    backgroundColor: colors.fairSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  debugText: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.fairText },
  error: {
    marginTop: spacing.lg,
    backgroundColor: colors.lowSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.low },
  infoText: { marginTop: spacing.md, fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.healthy },
});
