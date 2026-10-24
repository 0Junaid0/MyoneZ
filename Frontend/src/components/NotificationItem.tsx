// components/NotificationItem.tsx  (Owner: Member 4)
// One notification row. Also exports the notification types so Member 1's push-tap handler
// can navigate with the same `target` shape: navigation.navigate(n.target.route, n.target.params)
// Usage: <NotificationItem notification={n} onPress={handlePress} />
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type NotificationType = 'birthday' | 'checkin' | 'failed' | 'overdue' | 'upcoming' | 'sent';

export type NotificationTarget = {
  route: 'ReviewDraft' | 'ContactDetails' | 'Drafts';
  params?: Record<string, string>;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  target: NotificationTarget;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const LOOK: Record<NotificationType, { icon: IconName; bg: string; fg: string }> = {
  birthday: { icon: 'calendar-outline', bg: '#FCE7F3', fg: '#9D174D' },
  checkin: { icon: 'chatbox-outline', bg: '#DBEAFE', fg: '#1D4ED8' },
  failed: { icon: 'alert-circle-outline', bg: '#FEE2E2', fg: '#B91C1C' },
  overdue: { icon: 'time-outline', bg: '#FEF3C7', fg: '#92400E' },
  upcoming: { icon: 'browsers-outline', bg: '#E0E7FF', fg: '#3730A3' },
  sent: { icon: 'checkmark', bg: '#DCFCE7', fg: '#15803D' },
};

export type NotificationItemProps = {
  notification: AppNotification;
  /** Already-formatted time text, e.g. "now", "9:00 AM", "Yesterday", "Fri". */
  timeLabel: string;
  onPress: (notification: AppNotification) => void;
};

export default function NotificationItem({
  notification,
  timeLabel,
  onPress,
}: NotificationItemProps): React.JSX.Element {
  const look = LOOK[notification.type];

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={({ pressed }) => [styles.row, !notification.read && styles.unread, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.body}. ${timeLabel}.${notification.read ? '' : ' Unread.'}`}
    >
      <View style={[styles.tile, { backgroundColor: look.bg }]}>
        <Ionicons name={look.icon} size={22} color={look.fg} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.time}>{timeLabel}</Text>
      </View>
      {!notification.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  unread: { backgroundColor: '#F8FAFF' },
  pressed: { opacity: 0.6 },
  tile: { width: 48, height: 48, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  time: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
