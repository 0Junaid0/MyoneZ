// components/Avatar.tsx  (Owner: Member 2)
// Usage: <Avatar name="Nadia Rahman" size={44} />
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarTints, fonts } from '../theme/tokens';

export type AvatarProps = {
  name: string;
  size?: number;
  /** Optional photo. Falls back to initials if missing. */
  imageUri?: string | null;
  /** Alias of imageUri (Member 3 code uses this name). */
  imageUrl?: string | null;
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Same name always gets the same color.
function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return avatarTints[hash % avatarTints.length];
}

export default function Avatar({ name, size = 44, imageUri, imageUrl }: AvatarProps): React.JSX.Element {
  const photo = imageUri ?? imageUrl;
  const tint = tintFor(name);
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (photo) {
    return <Image source={{ uri: photo }} style={box} accessibilityLabel={name} />;
  }

  return (
    <View style={[styles.base, box, { backgroundColor: tint.bg }]} accessibilityLabel={name}>
      <Text style={[styles.text, { color: tint.fg, fontSize: size * 0.36 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.bold },
});

// Named export too, so Member 1 code can write: import { Avatar } from './Avatar'
export { Avatar };
