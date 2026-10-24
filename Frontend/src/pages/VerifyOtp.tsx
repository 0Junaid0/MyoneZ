/**
 * ===============================================================
 *  FILE: pages/VerifyOtp.tsx
 *  WHAT: Step 2 of log in / sign up. The backend emailed a 6-digit
 *        code; the user types it here. Shown by App.tsx while
 *        store/auth.ts has `pending` set.
 *  FLOW: verifyOtp(code) → tokens saved → status 'signedIn' → Home
 *  DEV:  with the console email backend the code is printed in the
 *        Django terminal and shown on this screen (debug_code).
 * ===============================================================
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { InputField } from '../components/InputField';
import { useAuthStore } from '../store/auth';
import { getErrorMessage } from '../api/client';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export default function VerifyOtpScreen() {
  const pending = useAuthStore((s) => s.pending);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtp = useAuthStore((s) => s.resendOtp);
  const cancelOtp = useAuthStore((s) => s.cancelOtp);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleVerify = async () => {
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(code);
      // success: App.tsx switches to the Home tabs
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    try {
      await resendOtp();
      setCode('');
      setInfo('A new code was sent.');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">
            Check your email
          </Text>
          <Text style={styles.sub}>{pending?.detail ?? 'Enter the 6-digit code we emailed you.'}</Text>

          {pending?.debugCode ? (
            <View style={styles.debug}>
              <Text style={styles.debugText}>Dev code: {pending.debugCode}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}

          <InputField
            label="6-digit code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />

          <Button title="Verify" onPress={handleVerify} loading={busy} />

          <View style={styles.row}>
            <Pressable onPress={handleResend} hitSlop={12} accessibilityRole="link">
              <Text style={styles.link}>Send a new code</Text>
            </Pressable>
            <Pressable onPress={cancelOtp} hitSlop={12} accessibilityRole="link">
              <Text style={styles.link}>Back</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.xxl, gap: spacing.lg, justifyContent: 'center' },
  title: { fontFamily: fonts.extrabold, fontSize: fontSize.title, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.body, lineHeight: 22, color: colors.textMuted },
  debug: { backgroundColor: colors.fairSoft, borderRadius: radius.md, padding: spacing.md },
  debugText: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.fairText },
  error: {
    backgroundColor: colors.lowSoft,
    borderColor: colors.lowBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { fontFamily: fonts.medium, fontSize: fontSize.small, color: colors.lowText },
  infoText: { fontFamily: fonts.medium, fontSize: fontSize.small, color: colors.healthy },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.primary },
});
