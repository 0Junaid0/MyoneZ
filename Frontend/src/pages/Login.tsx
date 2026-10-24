/**
 * ===============================================================
 *  FILE: pages/Login.tsx
 *  OWNER: Member 1  |  PHASE: 3 (Pages)
 *  WHAT: The Log in screen (first screen of the app).
 *    Top:    dark navy area with the logo and "Stay connected. Intentionally."
 *    Bottom: white card with Email, Password, "Forgot password?",
 *            Log in button, "or", Continue with Google, "Sign up" link.
 *  FLOW: Log in → store/auth.ts login() → status becomes 'signedIn'
 *        → Member 4's App.tsx shows the Home tabs by itself.
 *        (This page never calls navigate('Home').)
 *  BACKEND: POST /api/auth/token/ then GET /api/me/
 * ===============================================================
 */
import { showAlert } from '../utils/alert';
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
import Logo from '../components/Logo';
import { Button } from '../components/Button';
import { InputField, TextInputRef } from '../components/InputField';
import { PasswordField } from '../components/PasswordField';
import { useAuthStore } from '../store/auth';
import { getErrorMessage } from '../api/client';
import { hasErrors, LoginErrors, validateLogin } from '../utils/validation';
import type { AuthStackParamList } from '../types/navigation';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((state) => state.login);
  const passwordRef = useRef<TextInputRef>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) return;

    setSubmitting(true);
    try {
      await login(email, password);
      // success: a code was emailed; App.tsx shows the Verify screen (pages/VerifyOtp.tsx)
    } catch (error) {
      // The API answers a wrong email/password with 400 ("non_field_errors"), never with a field error
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const data = axios.isAxiosError(error) ? (error.response?.data as { error?: { detail?: Record<string, unknown> } }) : undefined;
      const wrongCredentials = status === 401 || (status === 400 && !!data?.error?.detail?.non_field_errors);
      if (wrongCredentials) {
        setFormError('Email or password is wrong.');
      } else {
        setFormError(getErrorMessage(error));
      }
      setSubmitting(false);
    }
  };

  const handleGoogle = () => {
    // TODO (later): Google sign-in with expo-auth-session
    showAlert('Coming soon', 'Google sign-in will be added later. Please use email for now.');
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ---------- Navy hero ---------- */}
          <SafeAreaView edges={['top']} style={styles.hero}>
            <View style={styles.logoRow}>
              <Logo size={40} showName nameColor={colors.onDark} />
            </View>

            {/* simple "network" dots, like the design */}
            <View style={styles.network} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.dot, styles.dotBig, { left: 40, top: 18 }]} />
              <View style={[styles.dot, { left: 150, top: 4 }]} />
              <View style={[styles.dot, styles.dotBlue, { left: 230, top: 40 }]} />
              <View style={[styles.dot, { left: 110, top: 64 }]} />
              <View style={[styles.dot, styles.dotBig, styles.dotBlue, { left: 290, top: 0 }]} />
            </View>

            <Text style={styles.headline} accessibilityRole="header">
              Stay connected.{'\n'}Intentionally.
            </Text>
            <Text style={styles.subhead}>
              Reminders and ready-to-send messages for the people who matter.
            </Text>
          </SafeAreaView>

          {/* ---------- White form card ---------- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log in</Text>

            {formError ? (
              <View style={styles.formError} accessibilityRole="alert">
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
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
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              placeholder="Your password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />

            <View style={styles.forgotRow}>
              <Button
                title="Forgot password?"
                variant="ghost"
                onPress={() => navigation.navigate('ForgotPassword')}
              />
            </View>

            <Button title="Log in" onPress={handleLogin} loading={submitting} />

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Button
              title="Continue with Google"
              variant="secondary"
              onPress={handleGoogle}
              icon={<Text style={styles.googleG}>G</Text>}
            />

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>New here?</Text>
              <Pressable
                onPress={() => navigation.navigate('Signup')}
                accessibilityRole="link"
                hitSlop={12}
              >
                <Text style={styles.signupLink}>Sign up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  network: {
    height: 90,
    marginVertical: spacing.xl,
  },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.navyLight,
    borderWidth: 2,
    borderColor: colors.onDarkMuted,
  },
  dotBig: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  dotBlue: {
    backgroundColor: colors.primary,
    borderColor: colors.primarySoft,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: fontSize.display,
    lineHeight: 38,
    color: colors.onDark,
  },
  subhead: {
    marginTop: spacing.sm + 2,
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.onDarkMuted,
  },
  card: {
    flex: 1,
    marginTop: -spacing.xxl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl + spacing.xs,
    paddingBottom: spacing.xxxl + spacing.lg,
    gap: spacing.lg,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: fontSize.heading,
    color: colors.text,
  },
  formError: {
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
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: -spacing.xs,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.small,
    color: colors.textFaint,
  },
  googleG: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    color: colors.primary,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
  },
  signupText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  signupLink: {
    fontFamily: fonts.bold,
    fontSize: fontSize.body,
    color: colors.primary,
  },
});
