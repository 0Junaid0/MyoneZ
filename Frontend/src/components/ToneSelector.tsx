// STEP: PHASE 2 · Page-step 3 · tone chips on M08 / M16 (Warm, Casual, Formal, Advisory)
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Tone } from '../types/draft';

export type { Tone }; // ContactForm (Member 2) imports the type from here

export interface ToneOption {
  value: Tone;
  label: string;
}

export const DEFAULT_TONE_OPTIONS: ToneOption[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'casual', label: 'Casual' },
  { value: 'formal', label: 'Formal' },
  { value: 'advisory', label: 'Advisory' },
];

/** Review draft / New message: the four tones the AI writer supports */
export const DRAFT_TONE_OPTIONS: ToneOption[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'warm', label: 'Warm' },
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
];

export interface ToneSelectorProps {
  value: Tone;
  onChange: (tone: Tone) => void;
  options?: ToneOption[];
  disabled?: boolean;
}

export default function ToneSelector({ value, onChange, options = DEFAULT_TONE_OPTIONS, disabled = false }: ToneSelectorProps): React.JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
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
