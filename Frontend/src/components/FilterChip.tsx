// components/FilterChip.tsx  (Owner: Member 2)
// Usage: <FilterChip label="Mentors" count={8} selected={f === 'Mentor'} onPress={() => setF('Mentor')} />
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type FilterChipProps = {
  label: string;
  count?: number;
  selected?: boolean;
  onPress: () => void;
};

export default function FilterChip({
  label,
  count,
  selected = false,
  onPress,
}: FilterChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {count === undefined ? label : `${label} ${count}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  text: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.text },
  textSelected: { color: colors.primaryText },
});
