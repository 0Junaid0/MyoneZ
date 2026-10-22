// STEP: PHASE 2 · Page-step 3 · channel switch on M08 / M09b
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Channel } from '../types/draft';

export type { Channel }; // ContactForm (Member 2) imports the type from here

export interface ChannelOption<T extends string = Channel> {
  value: T;
  label: string;
}

export const DEFAULT_CHANNEL_OPTIONS: ChannelOption[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'telegram', label: 'Telegram' },
];

export interface ChannelSelectorProps<T extends string = Channel> {
  value: T;
  onChange: (channel: T) => void;
  options?: ChannelOption<T>[];
  /** Channels shown but not selectable */
  disabledValues?: T[];
}

/**
 * Generic so the contact form can also offer "Not set".
 * With more than 3 options the pills wrap onto a second row (same look as before for 3).
 */
export default function ChannelSelector<T extends string = Channel>({
  value,
  onChange,
  options = DEFAULT_CHANNEL_OPTIONS as unknown as ChannelOption<T>[],
  disabledValues = [],
}: ChannelSelectorProps<T>): React.JSX.Element {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        const disabled = disabledValues.includes(option.value);
        return (
          <Pressable
            key={option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            style={[styles.item, selected && styles.itemSelected, disabled && styles.disabled]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
  disabled: { opacity: 0.4 },
  label: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.text },
  labelSelected: { fontFamily: fonts.bold, color: colors.primary },
});
