// STEP: PHASE 3 · Page-step 9 · M18 Sent
import dayjs from 'dayjs';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../components/Button';
import HealthRing from '../components/HealthRing';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import type { DraftsNavParams } from '../types/navigation';
import { healthColor, healthWord } from '../utils/health';
import { CHANNEL_LABEL } from '../utils/labels';
import { shortDate } from '../utils/time';

type Props = NativeStackScreenProps<DraftsNavParams, 'Sent'>;

/** M18 Sent: confirmation, health before and after, and next check-in (Back and Done at the bottom) */
export default function Sent({ route, navigation }: Props): React.JSX.Element {
  const result = route.params;
  const firstName = result.contactName.split(' ')[0];
  const backToContact = () => navigation.navigate('ContactDetails', { contactId: result.contactId });
  const done = () => navigation.navigate('Tabs', { screen: 'Home' });

  const afterColor = healthColor(result.healthAfter);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.check} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">Sent to {result.contactName}</Text>
          <Text style={styles.sub}>
            {CHANNEL_LABEL[result.channel]} · {dayjs(result.sentAt).format('h:mm A')}
          </Text>
        </View>

        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Health</Text>
            <View style={styles.healthRow}>
              <View style={styles.healthItem}>
                <HealthRing score={result.healthBefore} size={40} />
                <Text style={styles.healthWord}>{healthWord(result.healthBefore)}</Text>
              </View>
              <Text style={styles.arrow} accessibilityLabel="to">→</Text>
              <View style={styles.healthItem}>
                <HealthRing score={result.healthAfter} size={40} />
                <Text style={[styles.healthWord, { color: afterColor }]}>{healthWord(result.healthAfter)}</Text>
              </View>
            </View>
            <Text style={styles.cardNote}>
              {result.healthBefore} to {result.healthAfter}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Next check-in</Text>
            <Text style={styles.cardBig}>
              {shortDate(result.nextCheckInFrom) === shortDate(result.nextCheckInTo)
                ? shortDate(result.nextCheckInFrom)
                : `${shortDate(result.nextCheckInFrom)} – ${shortDate(result.nextCheckInTo)}`}
            </Text>
            <Text style={styles.cardNote}>Counted from today</Text>
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Button title={`Back to ${firstName}`} onPress={backToContact} variant="secondary" />
        <Button title="Done" onPress={done} variant="primary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xxl * 2 },
  hero: { alignItems: 'center', gap: spacing.sm },
  check: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.healthy, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontFamily: fonts.extrabold, fontSize: 44, color: colors.surface },
  title: { fontFamily: fonts.extrabold, fontSize: fontSize.xl, color: colors.text, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  cards: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  card: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardLabel: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.textMuted },
  cardBig: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: colors.text },
  cardNote: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  healthItem: { alignItems: 'center', gap: 4 },
  healthWord: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.textMuted },
  arrow: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.textMuted },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
