// components/ProfileCard.tsx  (Owner: Member 4)
// Usage: <ProfileCard name="Nusrat Jahan" email="nusrat@example.com" onPress={openProfile} />
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type ProfileCardProps = {
  name: string;
  email: string;
  imageUri?: string | null;
  /** If omitted the card is not tappable and the chevron is hidden. */
  onPress?: () => void;
};

export default function ProfileCard({ name, email, imageUri, onPress }: ProfileCardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}, ${email}`}
    >
      <Avatar name={name} size={60} imageUri={imageUri} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  info: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  email: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
});
