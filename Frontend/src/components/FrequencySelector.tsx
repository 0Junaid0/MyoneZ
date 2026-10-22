// components/FrequencySelector.tsx  (Owner: Member 2)
// Usage: <FrequencySelector value={freq} onChange={setFreq} error={err} />
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type FrequencyMode = 'fixed' | 'randomized';

export type FrequencyValue = {
  mode: FrequencyMode;
  /** Base number of days between check-ins. */
  days: number;
  /** +/- days of randomness (only used when mode is "randomized"). */
  jitter: number;
};

export const DEFAULT_FREQUENCY: FrequencyValue = { mode: 'randomized', days: 30, jitter: 5 };

/** Returns an error message, or null if valid. */
export function validateFrequency(v: FrequencyValue): string | null {
  if (!Number.isInteger(v.days) || v.days < 1 || v.days > 365) {
    return 'Enter a number of days between 1 and 365.';
  }
  if (v.mode === 'randomized' && (v.jitter < 0 || v.jitter >= v.days)) {
    return 'The ± days must be smaller than the number of days.';
  }
  return null;
}

export type FrequencySelectorProps = {
  value: FrequencyValue;
  onChange: (value: FrequencyValue) => void;
  error?: string;
};

function toNumber(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

export default function FrequencySelector({
  value,
  onChange,
  error,
}: FrequencySelectorProps): React.JSX.Element {
  const randomized = value.mode === 'randomized';
  const min = Math.max(1, value.days - value.jitter);
  const max = value.days + value.jitter;

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {(['fixed', 'randomized'] as FrequencyMode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.segBtn, value.mode === m && styles.segBtnActive]}
            onPress={() => onChange({ ...value, mode: m })}
            accessibilityRole="button"
            accessibilityState={{ selected: value.mode === m }}
          >
            <Text style={[styles.segText, value.mode === m && styles.segTextActive]}>
              {m === 'fixed' ? 'Fixed' : 'Randomized'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputs}>
        <View style={styles.inputCol}>
          <Text style={styles.label}>{randomized ? 'About every' : 'Every'}</Text>
          <View style={[styles.inputBox, !!error && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={value.days ? String(value.days) : ''}
              onChangeText={(t) => onChange({ ...value, days: toNumber(t) })}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Days between check-ins"
            />
            <Text style={styles.unit}>days</Text>
          </View>
        </View>

        {randomized && (
          <View style={styles.inputCol}>
            <Text style={styles.label}>Give or take</Text>
            <View style={[styles.inputBox, !!error && styles.inputError]}>
              <Text style={styles.unit}>±</Text>
              <TextInput
                style={styles.input}
                value={String(value.jitter)}
                onChangeText={(t) => onChange({ ...value, jitter: toNumber(t) })}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="Days of randomness"
              />
              <Text style={styles.unit}>days</Text>
            </View>
          </View>
        )}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.hint}>
          {randomized
            ? `Each check-in lands ${min}–${max} days after the last one, so it never looks automated.`
            : `A check-in is prepared exactly ${value.days || 0} days after the last one.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: radius.input, padding: 4 },
  segBtn: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { backgroundColor: colors.surface },
  segText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  segTextActive: { fontFamily: fonts.semibold, color: colors.primary },
  inputs: { flexDirection: 'row', gap: spacing.md },
  inputCol: { flex: 1, gap: 6 },
  label: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  input: { fontFamily: fonts.regular, flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: 0 },
  unit: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  error: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.danger },
});
