// Home draft button: pick a person, then the usual "What's it about?" sheet (TopicSheet) writes the draft
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '../api/contactsApi';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';
import { getErrorMessage } from '../utils/errors';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';
import Button from './Button';
import type { ContactSummary } from './ContactCard';
import SearchBar from './SearchBar';
import TopicSheet from './TopicSheet';

export interface QuickDraftSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function QuickDraftSheet({ visible, onClose }: QuickDraftSheetProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ContactSummary | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contacts', 'quickDraft'],
    queryFn: contactsApi.list,
    enabled: visible,
  });

  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((c) => `${c.name} ${c.relationship} ${c.tags?.join(' ') ?? ''} ${c.searchExtra ?? ''}`.toLowerCase().includes(q));
  }, [data, query]);

  const pick = (contact: ContactSummary) => {
    setPicked(contact);
    onClose();
    setQuery('');
    // Let the picker finish closing first (iOS skips a modal opened while another is closing)
    openTimer.current = setTimeout(() => setTopicOpen(true), 350);
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title="Write a message">
        <Text style={styles.subtitle}>Choose a person. We'll write a draft for them.</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, tag or number" />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.error}>{getErrorMessage(error, "Couldn't load contacts.")}</Text>
            <Button title="Try again" onPress={() => refetch()} variant="secondary" />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={contacts}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>{data?.length ? 'No one matches your search.' : 'Add a contact first.'}</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                accessibilityRole="button"
                accessibilityLabel={`Write to ${item.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Avatar name={item.name} imageUri={item.imageUri} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.relationship}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </BottomSheet>

      {picked ? (
        <TopicSheet
          visible={topicOpen}
          contactId={picked.id}
          contactName={picked.name}
          onClose={() => setTopicOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, marginBottom: spacing.md },
  center: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md },
  list: { maxHeight: Dimensions.get('window').height * 0.5, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: colors.divider },
  rowText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  empty: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  error: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.low },
});
