// components/SearchBar.tsx  (Owner: Member 2)
// Usage: <SearchBar value={q} onChangeText={setQ} placeholder="Search name, tag or note" />
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
}: SearchBarProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    height: 48,
    gap: spacing.md,
  },
  input: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: 0,
  },
});
