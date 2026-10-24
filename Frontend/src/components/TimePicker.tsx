// components/TimePicker.tsx  (Owner: Member 4)
// Same shape as DatePicker (Member 2) so ScheduleSheet can use both the same way.
// Usage: <TimePicker label="Send at" value={time} onChange={setTime} />
// Phone: native picker (@react-native-community/datetimepicker).
// Web:   the browser's own <input type="time">.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

// Load the native picker on iOS/Android only, so the web build never runs it.
const NativeDateTimePicker: typeof import('@react-native-community/datetimepicker').default | null =
  Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

/** "8:00 AM", "6:30 PM" */
export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Today's date at hour:minute (handy for mock data and for storing "08:00" style values). */
export function timeOfDay(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date -> "08:00" (value format of <input type="time">) */
function toInputValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "08:00" -> Date today at that time */
function fromInputValue(s: string): Date {
  const [h, m] = s.split(':').map(Number);
  return timeOfDay(h, m);
}

export type TimePickerProps = {
  label: string;
  value: Date | null;
  onChange: (time: Date | null) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Android only: 1, 5, 10, 15, 20, 30. */
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
  /** Show a clear (x) button when a value is set. Default false (a time is usually required). */
  clearable?: boolean;
};

export default function TimePicker({
  label,
  value,
  onChange,
  placeholder = 'Select a time',
  hint,
  error,
  minuteInterval,
  clearable = false,
}: TimePickerProps): React.JSX.Element {
  const [open, setOpen] = useState<boolean>(false);

  const footer = error ? (
    <Text style={styles.error}>{error}</Text>
  ) : hint ? (
    <Text style={styles.hint}>{hint}</Text>
  ) : null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: 'time',
          value: value ? toInputValue(value) : '',
          step: minuteInterval ? minuteInterval * 60 : undefined,
          'aria-label': label,
          onChange: (e: { target: { value: string } }) =>
            onChange(e.target.value ? fromInputValue(e.target.value) : null),
          style: {
            height: 48,
            padding: '0 12px',
            border: `1px solid ${error ? colors.danger : colors.border}`,
            borderRadius: radius.input,
            fontSize: fontSize.md,
            color: colors.text,
            backgroundColor: colors.surface,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          },
        })}
        {footer}
      </View>
    );
  }

  const handleChange = (event: DateTimePickerEvent, selected?: Date): void => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, !!error && styles.fieldError]}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatTime(value) : placeholder}</Text>
        {clearable && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
        )}
      </Pressable>
      {open && NativeDateTimePicker ? (
        <NativeDateTimePicker
          value={value ?? new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minuteInterval={minuteInterval}
          onChange={handleChange}
        />
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.danger },
  value: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text },
  placeholder: { color: colors.textMuted },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  error: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.danger },
});