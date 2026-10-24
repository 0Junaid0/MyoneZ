// pages/Contacts.tsx  (Owner: Member 2)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { contactsApi } from '../api/contactsApi';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import ContactCard from '../components/ContactCard';
import TopicSheet from '../components/TopicSheet';
import type { ContactSummary, Relationship } from '../components/ContactCard';
import SearchBar from '../components/SearchBar';
import FilterChip from '../components/FilterChip';
// Member 1's components. Check their props and adjust the 3 usages below if different.
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

const fetchContacts = (): Promise<ContactSummary[]> => contactsApi.list();

type Filter = 'All' | Relationship;
type SortKey = 'health-asc' | 'health-desc' | 'name';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Mentor', label: 'Mentors' },
  { key: 'Friend', label: 'Friends' },
  { key: 'Family', label: 'Family' },
  { key: 'Professional', label: 'Professional' },
  { key: 'Collaborator', label: 'Collaborators' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'health-asc', label: 'Lowest health first' },
  { key: 'health-desc', label: 'Highest health first' },
  { key: 'name', label: 'Name A–Z' },
];

export default function Contacts(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<SortKey>('health-asc');
  // Tap on a card (not the avatar) opens the Message sheet for that contact
  const [messageTarget, setMessageTarget] = useState<ContactSummary | null>(null);
  const [messageOpen, setMessageOpen] = useState<boolean>(false);

  // silent: refresh in the background without the full-screen spinner (coming back to the tab)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setContacts(await fetchContacts());
    } catch {
      if (!silent) setError('Could not load contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A contact added, edited or deleted on another screen shows up when you come back
  useRefreshOnFocus(() => load(true));

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      All: contacts.length,
      Mentor: 0,
      Friend: 0,
      Family: 0,
      Professional: 0,
      Collaborator: 0,
    };
    contacts.forEach((c) => {
      map[c.relationship] += 1;
    });
    return map;
  }, [contacts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // "01712 000000" should also find "+8801712000000"
    const qDigits = q.replace(/\D/g, '').replace(/^0+/, '');
    const list = contacts.filter((c) => {
      if (filter !== 'All' && c.relationship !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.relationship.toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (c.searchExtra ?? '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (c.searchExtra ?? '').replace(/\D/g, '').includes(qDigits))
      );
    });
    return [...list].sort((a, b) => {
      if (sort === 'health-asc') return a.healthScore - b.healthScore;
      if (sort === 'health-desc') return b.healthScore - a.healthScore;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, query, filter, sort]);

  const cycleSort = (): void => {
    const idx = SORTS.findIndex((s) => s.key === sort);
    setSort(SORTS[(idx + 1) % SORTS.length].key);
  };

  // Avatar -> profile
  const openContact = (c: ContactSummary): void => {
    navigation.navigate('ContactDetails', { id: c.id });
  };

  // Rest of the card -> message
  const openMessage = (c: ContactSummary): void => {
    setMessageTarget(c);
    setMessageOpen(true);
  };

  const renderList = (): React.JSX.Element => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={() => load()} />;
    if (visible.length === 0) {
      return (
        <EmptyState
          title={contacts.length === 0 ? 'No contacts yet' : 'No matches'}
          message={
            contacts.length === 0
              ? 'Add your first contact to get started.'
              : 'Try a different search or filter.'
          }
        />
      );
    }
    return (
      <View style={styles.card}>
        {visible.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <View style={styles.divider} />}
            <ContactCard contact={c} onPress={openMessage} onAvatarPress={openContact} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Contacts</Text>
            <Text style={styles.subtitle}>{contacts.length} people</Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddContact')}
            accessibilityRole="button"
            accessibilityLabel="Add contact"
          >
            <Ionicons name="add" size={28} color={colors.primaryText} />
          </Pressable>
        </View>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, email, number or tag" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              count={counts[f.key]}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>{SORTS.find((s) => s.key === sort)?.label}</Text>
          <Pressable onPress={cycleSort} hitSlop={8} accessibilityRole="button">
            <Text style={styles.sortBtn}>Sort</Text>
          </Pressable>
        </View>

        {renderList()}
      </ScrollView>

      {messageTarget ? (
        <TopicSheet
          visible={messageOpen}
          contactId={messageTarget.id}
          contactName={messageTarget.name}
          onClose={() => setMessageOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: fontSize.title, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sortLabel: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textMuted },
  sortBtn: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
