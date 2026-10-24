// STEP: PHASE 2 · Page-step 3 · character count on M08 / M17
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts, fontSize } from '../theme/tokens';

export interface CharacterCounterProps {
  text: string;
  maxLength: number;
}

export default function CharacterCounter({ text, maxLength }: CharacterCounterProps): React.JSX.Element {
  const count = text.length;
  const over = count > maxLength;
  const near = !over && count >= maxLength * 0.9;
  const color = over ? colors.low : near ? colors.fair : colors.textMuted;
  return (
    <Text style={[styles.text, { color }]} accessibilityLiveRegion="polite">
      {count}/{maxLength}
      {over ? ` · ${count - maxLength} over the limit` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.regular, fontSize: fontSize.sm, textAlign: 'right', color: colors.textMuted },
});
