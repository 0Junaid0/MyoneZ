// components/ToggleSwitch.tsx  (Owner: Member 4)
// Replaces the temporary stub. Props are unchanged, so ContactForm keeps working.
// Usage: <ToggleSwitch label="When a draft is ready" value={on} onValueChange={setOn} />
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';

export type ToggleSwitchProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

const TRACK_W = 52;
const TRACK_H = 32;
const KNOB = 26;
const PAD = 3;

export default function ToggleSwitch({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: ToggleSwitchProps): React.JSX.Element {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  const knobX = anim.interpolate({ inputRange: [0, 1], outputRange: [PAD, TRACK_W - KNOB - PAD] });

  return (
    <Pressable
      style={[styles.row, disabled && styles.disabled]}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  disabled: { opacity: 0.5 },
  text: { flex: 1 },
  label: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.text },
  desc: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, justifyContent: 'center' },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
