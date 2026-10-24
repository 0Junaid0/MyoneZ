// components/ContactCard.tsx  (Owner: Member 2)
// Usage: <ContactCard contact={c} onPress={openMessage} onAvatarPress={openProfile} />
// Tap the avatar -> profile. Tap anywhere else on the card (name included) -> message.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from './Avatar';
import HealthRing from './HealthRing';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';

export type Relationship = 'Mentor' | 'Friend' | 'Family' | 'Professional' | 'Collaborator';

export type ContactSummary = {
  id: string;
  name: string;
  relationship: Relationship;
  /** Days since the last conversation. */
  daysSinceContact: number;
  /** 0-100 */
  healthScore: number;
  tags?: string[];
  imageUri?: string | null;
  /** Email and numbers joined together, so the search box can find them */
  searchExtra?: string;
};

export type ContactCardProps = {
  contact: ContactSummary;
  /** Tap anywhere on the card except the avatar (opens Message) */
  onPress: (contact: ContactSummary) => void;
  /** Tap on the profile picture only (opens the profile) */
  onAvatarPress: (contact: ContactSummary) => void;
};

export default function ContactCard({ contact, onPress, onAvatarPress }: ContactCardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={() => onPress(contact)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Message ${contact.name}, ${contact.relationship}`}
    >
      <Pressable
        onPress={() => onAvatarPress(contact)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${contact.name}'s profile`}
      >
        <Avatar name={contact.name} size={48} imageUri={contact.imageUri} />
      </Pressable>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {contact.relationship} · {contact.daysSinceContact} days ago
        </Text>
      </View>
      <HealthRing score={contact.healthScore} size={40} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pressed: { opacity: 0.6 },
  info: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
});
