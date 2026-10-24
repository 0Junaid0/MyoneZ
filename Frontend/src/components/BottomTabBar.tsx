// components/BottomTabBar.tsx  (Owner: Member 4)
// Custom tab bar for @react-navigation/bottom-tabs.
// Usage in App.tsx:  <Tab.Navigator tabBar={(props) => <BottomTabBar {...props} />}> ... </Tab.Navigator>
// Route names must be: Home, Contacts, Drafts, Schedule, Settings.
// Drafts badge: <Tab.Screen name="Drafts" options={{ tabBarBadge: draftCount }} />
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts, fontSize } from '../theme/tokens';

// Same line icons as the design (22px, 2px stroke)
function TabIcon({ name, color }: { name: string; color: string }): React.JSX.Element {
  const stroke = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'Home' ? <Path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" {...stroke} /> : null}
      {name === 'Contacts' ? (
        <>
          <Circle cx={9} cy={8} r={3.5} {...stroke} />
          <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" {...stroke} />
          <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" {...stroke} />
          <Path d="M18 14.2c2.1.7 3.5 2.8 3.5 5.8" {...stroke} />
        </>
      ) : null}
      {name === 'Drafts' ? (
        <>
          <Path d="M4 5h16v11H9l-5 4z" {...stroke} />
          <Path d="M8 9h8M8 12h5" {...stroke} />
        </>
      ) : null}
      {name === 'Schedule' ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} {...stroke} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...stroke} />
        </>
      ) : null}
      {name === 'Settings' ? (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...stroke} />
          <Circle cx={15} cy={7} r={2} {...stroke} />
          <Circle cx={9} cy={17} r={2} {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

export default function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
        const badge = options.tabBarBadge;
        const color = focused ? colors.primary : colors.textFaint;

        const onPress = (): void => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const onLongPress = (): void => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <View>
              <TabIcon name={route.name} color={color} />
              {badge !== undefined && badge !== 0 && badge !== '' ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }, focused && styles.labelFocused]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 54 },
  label: { fontFamily: fonts.medium, fontSize: fontSize.tab },
  labelFocused: { fontFamily: fonts.bold },
  badge: {
    position: 'absolute',
    top: -6,
    right: -11,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, color: colors.primaryText, fontSize: 10 },
});
