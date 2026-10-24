// pages/EmailSettings.tsx
// "Email" page: the user's own SMTP account, used for sending by Gmail.
// Fields: Sending address, Mail server, Port, Username, Security, Password. Buttons: Send test, Save email.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { emailApi } from '../api/emailApi';
import type { EmailSecurity } from '../api/emailApi';
import { getErrorMessage } from '../api/client';
import AppHeader from '../components/AppHeader';
import Button from '../components/Button';
import ErrorState from '../components/ErrorState';
import FilterChip from '../components/FilterChip';
import InputField from '../components/InputField';
import LoadingState from '../components/LoadingState';
import { PasswordField } from '../components/PasswordField';
import Toast, { useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailSettings'>;

const SECURITY: { value: EmailSecurity; label: string }[] = [
  { value: 'tls', label: 'TLS' },
  { value: 'ssl', label: 'SSL' },
  { value: 'none', label: 'None' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<'fromEmail' | 'host' | 'port', string>>;

export default function EmailSettings({ navigation }: Props): React.JSX.Element {
  const { toastProps, showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState<string>('');
  const [host, setHost] = useState<string>('');
  const [port, setPort] = useState<string>('587');
  const [username, setUsername] = useState<string>('');
  const [security, setSecurity] = useState<EmailSecurity>('tls');
  const [password, setPassword] = useState<string>('');
  const [passwordSet, setPasswordSet] = useState<boolean>(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  const load = async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await emailApi.get();
      setFromEmail(data.from_email ?? '');
      setHost(data.host ?? '');
      setPort(String(data.port ?? 587));
      setUsername(data.username ?? '');
      setSecurity(data.security ?? 'tls');
      setPasswordSet(Boolean(data.password_set));
    } catch (e) {
      setLoadError(getErrorMessage(e, "Couldn't load your email settings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const validate = (): Errors => {
    const found: Errors = {};
    if (!EMAIL_RE.test(fromEmail.trim())) found.fromEmail = 'Enter a valid sending address.';
    if (!host.trim()) found.host = 'Enter the mail server, like smtp.gmail.com.';
    const n = Number(port);
    if (!Number.isInteger(n) || n < 1 || n > 65535) found.port = 'Enter a port from 1 to 65535.';
    return found;
  };

  /** Saves the form. Returns true when it worked. */
  const save = async (): Promise<boolean> => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return false;
    try {
      const saved = await emailApi.save({
        from_email: fromEmail.trim(),
        host: host.trim(),
        port: Number(port),
        username: username.trim(),
        security,
        ...(password ? { password } : {}),
      });
      setPasswordSet(Boolean(saved.password_set));
      setPassword('');
      return true;
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
      return false;
    }
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (ok) showToast('Email saved');
  };

  // The test uses the saved settings, so the form is saved first
  const handleTest = async (): Promise<void> => {
    setTesting(true);
    try {
      if (!(await save())) return;
      await emailApi.sendTest();
      showToast(`Test email sent to ${fromEmail.trim()}`);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  const header = <AppHeader title="Email" onBack={() => navigation.goBack()} />;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <LoadingState message="Loading your email settings" />
      </SafeAreaView>
    );
  }
  if (loadError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <ErrorState message={loadError} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Messages you send by Gmail go out from your own email account. For Gmail use smtp.gmail.com, port 587, TLS and an app password.
          </Text>

          <View style={styles.card}>
            <InputField
              label="Sending address"
              value={fromEmail}
              onChangeText={setFromEmail}
              error={errors.fromEmail}
              placeholder="you@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <InputField
              label="Mail server"
              value={host}
              onChangeText={setHost}
              error={errors.host}
              placeholder="smtp.gmail.com"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <InputField
              label="Port"
              value={port}
              onChangeText={(t) => setPort(t.replace(/\D/g, '').slice(0, 5))}
              error={errors.port}
              keyboardType="number-pad"
            />
            <InputField
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="you@gmail.com"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.group}>
              <Text style={styles.label}>Security</Text>
              <View style={styles.chips}>
                {SECURITY.map((o) => (
                  <FilterChip key={o.value} label={o.label} selected={security === o.value} onPress={() => setSecurity(o.value)} />
                ))}
              </View>
            </View>

            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={passwordSet ? 'Saved. Type to change it' : 'App password'}
            />
          </View>

          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="Send test" onPress={handleTest} loading={testing} disabled={saving} variant="secondary" />
            </View>
            <View style={styles.flex}>
              <Button title="Save email" onPress={handleSave} loading={saving} disabled={testing} variant="primary" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast {...toastProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  group: { gap: spacing.sm },
  label: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
});
