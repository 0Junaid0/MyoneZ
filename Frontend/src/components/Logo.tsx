// components/Logo.tsx
// MyOneZ mark: a "Z" drawn as a line joining two people (dots), on a blue to navy tile.
// Usage: <Logo size={40} />  or  <Logo size={40} showName nameColor={colors.onDark} />
// The app icon PNGs in /assets are drawn from the same shapes.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';

export type LogoProps = {
  size?: number;
  /** Shows "MyOneZ" next to the mark */
  showName?: boolean;
  nameColor?: string;
};

export function LogoMark({ size = 40 }: { size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="myonezTile" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.brandBright} />
          <Stop offset="1" stopColor={colors.primaryDark} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="64" height="64" rx="18" fill="url(#myonezTile)" />
      <Path
        d="M19 21 H44 L20 43 H45"
        stroke={colors.onDark}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="19" cy="21" r="6.5" fill={colors.brandGlow} stroke={colors.onDark} strokeWidth={3} />
      <Circle cx="45" cy="43" r="6.5" fill={colors.brandGlow} stroke={colors.onDark} strokeWidth={3} />
    </Svg>
  );
}

export default function Logo({ size = 40, showName = false, nameColor = colors.text }: LogoProps): React.JSX.Element {
  if (!showName) return <LogoMark size={size} />;
  return (
    <View style={styles.row} accessible accessibilityLabel="MyOneZ">
      <LogoMark size={size} />
      <Text style={[styles.name, { color: nameColor, fontSize: Math.round(size * 0.55) }]}>
        MyOne<Text style={styles.z}>Z</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.extrabold, letterSpacing: 0.3 },
  z: { color: colors.brandGlow },
});
