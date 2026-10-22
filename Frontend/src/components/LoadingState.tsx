/**
 * ===============================================================
 *  FILE: components/LoadingState.tsx
 *  OWNER: Member 1  |  PHASE: 2 (Shared Components)
 *  WHAT: What a page shows while its data is loading.
 *    variant="spinner"  → a spinner and a short message
 *    variant="skeleton" → grey pulsing blocks shaped like cards
 *                         (the design uses these on Home and lists)
 *  PROPS: message, variant, rows
 *  USED BY: every page that loads data (all members)
 *  EXAMPLE:  if (isLoading) return <LoadingState variant="skeleton" rows={4} />;
 * ===============================================================
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton';
  /** Number of small skeleton rows under the big block */
  rows?: number;
}

export function LoadingState({ message = 'Loading…', variant = 'spinner', rows = 3 }: LoadingStateProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (variant !== 'skeleton') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, variant]);

  if (variant === 'skeleton') {
    return (
      <Animated.View
        style={[styles.skeletonWrap, { opacity: pulse }]}
        accessibilityRole="progressbar"
        accessibilityLabel={message}
      >
        <View style={[styles.block, styles.blockLarge]} />
        <View style={styles.row}>
          <View style={[styles.block, styles.blockStat]} />
          <View style={[styles.block, styles.blockStat]} />
          <View style={[styles.block, styles.blockStat]} />
        </View>
        {Array.from({ length: rows }).map((_, index) => (
          <View key={index} style={[styles.block, styles.blockRow]} />
        ))}
      </Animated.View>
    );
  }

  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  skeletonWrap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  block: {
    backgroundColor: colors.skeleton,
    borderRadius: radius.card,
  },
  blockLarge: {
    height: 150,
    borderRadius: radius.hero,
  },
  blockStat: {
    flex: 1,
    height: 76,
  },
  blockRow: {
    height: 64,
  },
});

// Default export too, so Member 2 / 3 / 4 code can write: import LoadingState from './LoadingState'
export default LoadingState;
