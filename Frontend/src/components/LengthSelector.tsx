// Length chips on M08 / M16 (Short, Medium, Long). Same look as ToneSelector.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { DraftLength } from '../types/draft';

const OPTIONS: { value: DraftLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export interface LengthSelectorProps {
  value: DraftLength;
  onChange: (length: DraftLength) => void;
  disabled?: boolean;
}

export default function LengthSelector({ value, onChange, disabled = false }: LengthSelectorProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.text },
  labelSelected: { fontFamily: fonts.bold, color: colors.surface },
});
