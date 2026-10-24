// components/DatePicker.tsx  (Owner: Member 2)
// Usage: <DatePicker label="Last time you talked" value={d} onChange={setD} maximumDate={new Date()} />
// Phone: native picker (@react-native-community/datetimepicker).
// Web:   the browser's own <input type="date"> (the native picker does not exist on web).
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

// Load the native picker on iOS/Android only, so the web build never runs it.
const NativeDateTimePicker: typeof import('@react-native-community/datetimepicker').default | null =
  Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "20 Sep 2026" */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14 October" (for birthdays) */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date -> "2026-09-20" (value format of <input type="date">) */
function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-09-20" -> local Date */
function fromInputValue(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export type DatePickerProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  format?: (d: Date) => string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Show a clear (x) button when a value is set. Default true. */
  clearable?: boolean;
};

export default function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  hint,
  error,
  format = formatDate,
  minimumDate,
  maximumDate,
  clearable = true,
}: DatePickerProps): React.JSX.Element {
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
          type: 'date',
          value: value ? toInputValue(value) : '',
          min: minimumDate ? toInputValue(minimumDate) : undefined,
          max: maximumDate ? toInputValue(maximumDate) : undefined,
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
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? format(value) : placeholder}
        </Text>
        {clearable && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        )}
      </Pressable>
      {open && NativeDateTimePicker ? (
        <NativeDateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
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