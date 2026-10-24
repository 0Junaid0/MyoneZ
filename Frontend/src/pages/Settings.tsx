// pages/Settings.tsx  (Owner: Member 4)
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import AppHeader from '../components/AppHeader';
import ProfileCard from '../components/ProfileCard';
import ToggleSwitch from '../components/ToggleSwitch';
import TimePicker, { formatTime, timeOfDay } from '../components/TimePicker';
import FrequencySelector, { DEFAULT_FREQUENCY, validateFrequency } from '../components/FrequencySelector';
import type { FrequencyValue } from '../components/FrequencySelector';
// Member 3's components. Assumed props: BottomSheet { visible, onClose, children }.
import BottomSheet from '../components/BottomSheet';
import ToneSelector from '../components/ToneSelector';
import type { Tone, Channel } from '../types/draft';
import ChannelSelector from '../components/ChannelSelector';
import ConfirmDialog from '../components/ConfirmDialog';
// Member 1's store
import { useAuthStore } from '../store/auth';
import { clearQueryCache } from '../api/queryClient';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

type SheetKind = 'channel' | 'tone' | 'rhythm' | null;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type SettingsState = {
  defaultChannel: Channel;
  tone: Tone;
  frequency: FrequencyValue;
  notifyDraftReady: boolean;
  notifyDaily: boolean;
  dailyTime: Date | null;
};

// ---------------------------------------------------------------------------
// The backend has no settings endpoint, so these preferences are kept on this phone.
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'prm.settings.v1';
const INITIAL: SettingsState = {
  defaultChannel: 'whatsapp',
  tone: 'warm',
  frequency: DEFAULT_FREQUENCY,
  notifyDraftReady: true,
  notifyDaily: true,
  dailyTime: timeOfDay(8, 0),
};

async function loadSettings(): Promise<SettingsState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as Partial<Omit<SettingsState, 'dailyTime'>> & { dailyTime?: string | null };
    return { ...INITIAL, ...saved, dailyTime: saved.dailyTime ? new Date(saved.dailyTime) : null };
  } catch {
    return INITIAL;
  }
}

function saveSettings(settings: SettingsState): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => undefined);
}
// ---------------------------------------------------------------------------

const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  sms: 'SMS',
  email: 'Gmail',
  messenger: 'Messenger',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function frequencyText(f: FrequencyValue): string {
  return f.mode === 'randomized' ? `${f.days} ± ${f.jitter} days` : `Every ${f.days} days`;
}

type RowProps = {
  title: string;
  subtitle?: React.ReactNode;
  value?: string;
  tile?: { icon: IconName; bg: string; fg: string };
  badge?: string;
  onPress: () => void;
};

function SettingsRow({ title, subtitle, value, tile, badge, onPress }: RowProps): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {tile ? (
        <View style={[styles.tile, { backgroundColor: tile.bg }]}>
          <Ionicons name={tile.icon} size={20} color={tile.fg} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={tile ? styles.rowTitle : styles.rowTitleLarge}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function Settings(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fullName = user ? `${user.first_name} ${user.last_name}`.trim() : '';

  const [settings, setSettings] = useState<SettingsState>(INITIAL);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [logoutOpen, setLogoutOpen] = useState<boolean>(false);
  const [rhythmDraft, setRhythmDraft] = useState<FrequencyValue>(settings.frequency);
  const [rhythmError, setRhythmError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const update = (patch: Partial<SettingsState>): void =>
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });

  const openRhythm = (): void => {
    setRhythmDraft(settings.frequency);
    setRhythmError(undefined);
    setSheet('rhythm');
  };

  const saveRhythm = (): void => {
    const err = validateFrequency(rhythmDraft);
    if (err) {
      setRhythmError(err);
      return;
    }
    update({ frequency: rhythmDraft });
    setSheet(null);
  };

  const confirmLogout = async (): Promise<void> => {
    setLogoutOpen(false);
    await clearQueryCache(); // never leave one user's cached data for the next login
    await logout();
  };

  const telegramSub = 'Opens Telegram with your message ready';

  const channelBadge = (c: Channel): string | undefined => (settings.defaultChannel === c ? 'Default' : undefined);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="Settings" flush />

        <ProfileCard name={fullName || 'Your name'} email={user?.email ?? ''} />

        <Text style={styles.sectionLabel}>How messages are sent</Text>
        <View style={styles.card}>
          <SettingsRow
            title="WhatsApp"
            subtitle="Opens your WhatsApp"
            tile={{ icon: 'logo-whatsapp', bg: '#DCFCE7', fg: '#15803D' }}
            badge={channelBadge('whatsapp')}
            onPress={() => setSheet('channel')}
          />
          <View style={styles.divider} />
          <SettingsRow
            title="Telegram"
            subtitle={telegramSub}
            tile={{ icon: 'paper-plane-outline', bg: '#DBEAFE', fg: '#1D4ED8' }}
            badge={channelBadge('telegram')}
            onPress={() => setSheet('channel')}
          />
          <View style={styles.divider} />
          <SettingsRow
            title="SMS"
            subtitle="Opens your phone's SMS app"
            tile={{ icon: 'chatbox-outline', bg: '#E2E8F0', fg: '#475569' }}
            badge={channelBadge('sms')}
            onPress={() => setSheet('channel')}
          />
          <View style={styles.divider} />
          <SettingsRow
            title="Gmail"
            subtitle="Opens your mail app with the message ready"
            tile={{ icon: 'mail-outline', bg: '#FEE2E2', fg: '#B91C1C' }}
            badge={channelBadge('email')}
            onPress={() => setSheet('channel')}
          />
          <View style={styles.divider} />
          <SettingsRow
            title="Messenger"
            subtitle="Copies the message, then opens the chat"
            tile={{ icon: 'chatbubble-ellipses-outline', bg: '#E0E7FF', fg: '#4338CA' }}
            badge={channelBadge('messenger')}
            onPress={() => setSheet('channel')}
          />
        </View>

        <Text style={styles.sectionLabel}>Email</Text>
        <View style={styles.card}>
          <SettingsRow
            title="Email"
            subtitle="Sending address and mail server for Gmail"
            tile={{ icon: 'at-outline', bg: '#FEF3C7', fg: '#92400E' }}
            onPress={() => navigation.navigate('EmailSettings')}
          />
        </View>

        <Text style={styles.sectionLabel}>Defaults for new contacts</Text>
        <View style={styles.card}>
          <SettingsRow title="Tone" value={capitalize(settings.tone)} onPress={() => setSheet('tone')} />
          <View style={styles.divider} />
          <SettingsRow title="Check-in rhythm" value={frequencyText(settings.frequency)} onPress={openRhythm} />
        </View>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={[styles.card, styles.toggles]}>
          <ToggleSwitch
            label="When a draft is ready"
            value={settings.notifyDraftReady}
            onValueChange={(v) => update({ notifyDraftReady: v })}
          />
          <View style={styles.divider} />
          <ToggleSwitch
            label={`Daily summary at ${settings.dailyTime ? formatTime(settings.dailyTime) : '8:00 AM'}`}
            value={settings.notifyDaily}
            onValueChange={(v) => update({ notifyDaily: v })}
          />
          {settings.notifyDaily && (
            <TimePicker
              label="Summary time"
              value={settings.dailyTime}
              onChange={(t) => update({ dailyTime: t ?? timeOfDay(8, 0) })}
              minuteInterval={5}
            />
          )}
        </View>

        <Pressable
          style={styles.logout}
          onPress={() => setLogoutOpen(true)}
          accessibilityRole="button"
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>

      <BottomSheet visible={sheet === 'channel'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>Default channel</Text>
        <Text style={styles.sheetSub}>Used for new contacts. You can still change it per contact.</Text>
        <ChannelSelector
          value={settings.defaultChannel}
          options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Gmail' },
            { value: 'telegram', label: 'Telegram' },
            { value: 'messenger', label: 'Messenger' },
            { value: 'sms', label: 'SMS' },
          ]}
          onChange={(c) => {
            update({ defaultChannel: c });
            setSheet(null);
          }}
        />
        <Text style={styles.sheetHint}>Currently: {CHANNEL_LABEL[settings.defaultChannel]}</Text>
      </BottomSheet>

      <BottomSheet visible={sheet === 'tone'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>Default tone</Text>
        <ToneSelector
          value={settings.tone}
          onChange={(t) => {
            update({ tone: t });
            setSheet(null);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'rhythm'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>Check-in rhythm</Text>
        <FrequencySelector value={rhythmDraft} onChange={setRhythmDraft} error={rhythmError} />
        <Pressable style={styles.sheetBtn} onPress={saveRhythm} accessibilityRole="button">
          <Text style={styles.sheetBtnText}>Done</Text>
        </Pressable>
      </BottomSheet>

      <ConfirmDialog
        visible={logoutOpen}
        title="Log out?"
        message="You'll need to sign in again to use MyOneZ."
        confirmLabel="Log out"
        destructive
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  sectionLabel: {
    fontFamily: fonts.bold,
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    color: '#475569',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggles: { padding: spacing.lg, gap: spacing.lg },
  divider: { height: 1, backgroundColor: colors.border },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.6 },
  tile: { width: 44, height: 44, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.text },
  rowTitleLarge: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.text, paddingVertical: spacing.sm },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  badge: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: colors.primary },
  connected: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.healthGood },

  logout: {
    marginTop: spacing.sm,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: '#B91C1C' },

  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  sheetSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  sheetHint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  sheetBtn: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnText: { fontFamily: fonts.semibold, color: colors.primaryText, fontSize: fontSize.md },
});
