// components/HealthRing.tsx  (Owner: Member 2)
// Usage: <HealthRing score={64} size={56} />
// Needs: npx expo install react-native-svg
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';

export type HealthRingProps = {
  /** 0-100. Values outside the range are clamped. */
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  /** Text after the number, e.g. "%" for the big ring on ContactDetails. */
  suffix?: string;
  /** Number colour. Use colors.onDark when the ring sits on a dark card (Home hero). */
  labelColor?: string;
};

export type HealthLevel = 'good' | 'fair' | 'poor';

export function getHealthLevel(score: number): HealthLevel {
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function getHealthColor(score: number): string {
  const level = getHealthLevel(score);
  if (level === 'good') return colors.healthGood;
  if (level === 'fair') return colors.healthFair;
  return colors.healthPoor;
}

/** Smaller text for longer labels so "100%" stays inside the ring */
function labelScale(label: string): number {
  if (label.length >= 4) return 0.22;
  if (label.length === 3) return 0.27;
  return 0.3;
}

export default function HealthRing({
  score,
  size = 40,
  strokeWidth = 4,
  showLabel = true,
  suffix = '',
  labelColor,
}: HealthRingProps): React.JSX.Element {
  const safe = Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Relationship health ${safe} percent`}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.healthTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getHealthColor(safe)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelWrap} pointerEvents="none">
          <Text
            style={[styles.label, { fontSize: size * labelScale(`${safe}${suffix}`) }, labelColor ? { color: labelColor } : null]}
            numberOfLines={1}
          >
            {safe}
            {suffix}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.bold, color: colors.text },
});

// Named export too, so Member 1 code can write: import { HealthRing } from './HealthRing'
export { HealthRing };
