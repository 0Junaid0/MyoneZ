// STEP: PHASE 2 + Page-step 5 · M09b Schedule message (sheet)
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { Channel, ScheduleSelection } from '../types/draft';
import { CHANNEL_LABEL } from '../utils/labels';
import { buildInstant, describeWhen, inZone, nowIn, zoneLabel } from '../utils/time';
import BottomSheet from './BottomSheet';
import Button from './Button';
import ChannelSelector, { ChannelOption } from './ChannelSelector';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

export interface ScheduleSheetProps {
  visible: boolean;
  draftId: string;
  /** Contact timezone (IANA). Day and time are picked in this zone. */
  timezone: string;
  /** Only the channels this contact has */
  channels: Channel[];
  initialChannel: Channel;
  /** ISO string of an existing schedule (used by "Change time") */
  initialScheduledAt?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (selection: ScheduleSelection) => void;
}

type DayChoice = 'today' | 'tomorrow' | 'custom';
type TimeChoice = 'morning' | 'evening' | 'custom';

const QUICK_TIMES: Record<'morning' | 'evening', { hour: number; label: string }> = {
  morning: { hour: 9, label: '9:00 AM' },
  evening: { hour: 18, label: '6:00 PM' },
};

function Option({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[styles.option, selected && styles.optionSelected, disabled && styles.optionDisabled]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function ScheduleSheet({
  visible,
  draftId,
  timezone,
  channels,
  initialChannel,
  initialScheduledAt,
  loading = false,
  onClose,
  onConfirm,
}: ScheduleSheetProps): React.JSX.Element {
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [dayChoice, setDayChoice] = useState<DayChoice>('tomorrow');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [timeChoice, setTimeChoice] = useState<TimeChoice>('morning');
  const [customTime, setCustomTime] = useState<Date>(() => new Date(2000, 0, 1, 9, 0));

  // Reset every time the sheet opens for a draft
  useEffect(() => {
    if (!visible) return;
    setChannel(initialChannel);
    if (initialScheduledAt) {
      const existing = inZone(initialScheduledAt, timezone);
      setDayChoice('custom');
      setCustomDate(new Date(existing.year(), existing.month(), existing.date()));
      setTimeChoice('custom');
      setCustomTime(new Date(2000, 0, 1, existing.hour(), existing.minute()));
    } else {
      setDayChoice('tomorrow');
      setTimeChoice('morning');
      setCustomDate(new Date());
      setCustomTime(new Date(2000, 0, 1, 9, 0));
    }
  }, [visible, draftId, initialChannel, initialScheduledAt, timezone]);

  const today = nowIn(timezone);

  const ymd = useMemo(() => {
    if (dayChoice === 'today') return today.format('YYYY-MM-DD');
    if (dayChoice === 'tomorrow') return today.add(1, 'day').format('YYYY-MM-DD');
    return dayjs(customDate).format('YYYY-MM-DD');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayChoice, customDate, timezone, visible]);

  const [hour, minute] =
    timeChoice === 'custom' ? [customTime.getHours(), customTime.getMinutes()] : [QUICK_TIMES[timeChoice].hour, 0];
  const instant = buildInstant(timezone, ymd, hour, minute);
  const isPast = instant.valueOf() <= Date.now();

  const quickIsPast = (h: number) => dayChoice === 'today' && buildInstant(timezone, ymd, h, 0).valueOf() <= Date.now();

  const options: ChannelOption[] = channels.map((value) => ({ value, label: CHANNEL_LABEL[value] }));

  // Version 1 is reminder-only on every channel (no auto-send yet)
  const confirmLabel = `Set reminder · ${describeWhen(instant, timezone)}`;

  const confirm = () => {
    if (isPast) return;
    onConfirm({ channel, scheduledAt: instant.toISOString(), timezone, sendMode: 'remind' });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Schedule message">
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Channel</Text>
        <ChannelSelector value={channel} onChange={setChannel} options={options} />

        <Text style={styles.label}>Day</Text>
        <View style={styles.row}>
          <Option label="Today" selected={dayChoice === 'today'} onPress={() => setDayChoice('today')} />
          <Option label="Tomorrow" selected={dayChoice === 'tomorrow'} onPress={() => setDayChoice('tomorrow')} />
          <Option label="Pick date" selected={dayChoice === 'custom'} onPress={() => setDayChoice('custom')} />
        </View>
        {dayChoice === 'custom' ? (
          <View style={styles.picker}>
            <DatePicker label="Date" value={customDate} onChange={(d) => d && setCustomDate(d)} minimumDate={new Date()} clearable={false} />
          </View>
        ) : null}

        <Text style={styles.label}>Time</Text>
        <View style={styles.row}>
          <Option label={QUICK_TIMES.morning.label} selected={timeChoice === 'morning'} disabled={quickIsPast(9)} onPress={() => setTimeChoice('morning')} />
          <Option label={QUICK_TIMES.evening.label} selected={timeChoice === 'evening'} disabled={quickIsPast(18)} onPress={() => setTimeChoice('evening')} />
          <Option label="Custom" selected={timeChoice === 'custom'} onPress={() => setTimeChoice('custom')} />
        </View>
        {timeChoice === 'custom' ? (
          <View style={styles.picker}>
            <TimePicker label="Time" value={customTime} onChange={(t) => t && setCustomTime(t)} />
          </View>
        ) : null}
        <Text style={styles.hint}>
          Times are in the contact's timezone: {timezone} ({zoneLabel(timezone, instant)})
        </Text>
        {isPast ? <Text style={styles.error}>That time has passed. Pick a time in the future.</Text> : null}

        <Text style={styles.label}>At that time</Text>
        <View style={styles.reasonCard}>
          <Text style={styles.reasonText}>
            We'll remind you. One tap opens your {CHANNEL_LABEL[channel]} with the message filled in, and you tap Send there.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={confirmLabel} onPress={confirm} disabled={isPast} loading={loading} variant="primary" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 440 },
  label: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  picker: { marginTop: spacing.sm },
  option: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  optionSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  optionDisabled: { opacity: 0.4 },
  optionText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text, textAlign: 'center' },
  optionTextSelected: { fontFamily: fonts.bold, color: colors.surface },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
  error: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.low, marginTop: spacing.xs },
  reasonCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.input,
    backgroundColor: `${colors.fair}14`,
    borderWidth: 1,
    borderColor: `${colors.fair}55`,
  },
  reasonText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text, lineHeight: 19 },
  footer: { marginTop: spacing.lg },
});
