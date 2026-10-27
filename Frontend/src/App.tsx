// App.tsx  (Owner: Member 4, merged with Member 1's auth / fonts / push)
// Providers + navigation:
//   signed out -> Login / Signup / ForgotPassword
//   signed in  -> Tabs (Home, Contacts, Drafts, Schedule, Settings) + full-screen pages
import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { PERSIST_MAX_AGE, queryClient, queryPersister } from './api/queryClient';
import { notificationsApi } from './api/notificationsApi';
import { navigationRef } from './navigation/navigationRef';
import type { ContactsStackParamList, RootStackParamList, TabParamList } from './navigation/types';
import { useAuthStore } from './store/auth'; // Member 1: status = 'loading' | 'signedOut' | 'signedIn'
import { navigateToTarget as openPushTarget, useNotificationNavigation } from './notifications/useNotificationNavigation';
import { requestPushPermission } from './notifications/push';
import { colors } from './theme/tokens';

import BottomTabBar from './components/BottomTabBar';
import OfflineBar, { useIsOnline } from './components/OfflineBar';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import Home from './pages/Home';
import Contacts from './pages/Contacts';
import ContactDetails from './pages/ContactDetails';
import AddContact from './pages/AddContact';
import EditContact from './pages/EditContact';
import Drafts from './pages/Drafts';
import ReviewDraft from './pages/ReviewDraft';
import WriteOwn from './pages/WriteOwn';
import Sent from './pages/Sent';
import { useDraftsWaiting } from './hooks/useDraftsWaiting';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import EmailSettings from './pages/EmailSettings';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const ContactsStack = createNativeStackNavigator<ContactsStackParamList>();

// Contacts tab has its own stack so the tab bar stays visible on ContactDetails.
function ContactsNavigator(): React.JSX.Element {
  return (
    <ContactsStack.Navigator screenOptions={{ headerShown: false }}>
      <ContactsStack.Screen name="ContactsList" component={Contacts} />
      <ContactsStack.Screen name="ContactDetails" component={ContactDetails} />
    </ContactsStack.Navigator>
  );
}

function Tabs(): React.JSX.Element {
  const draftCount = useDraftsWaiting(); // Member 3 hook: drafts waiting for review
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Contacts" component={ContactsNavigator} />
      <Tab.Screen
        name="Drafts"
        component={Drafts}
        options={{ tabBarBadge: draftCount > 0 ? draftCount : undefined }}
      />
      <Tab.Screen name="Schedule" component={Schedule} />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

function RootNavigator(): React.JSX.Element {
  const status = useAuthStore((s) => s.status);
  const waitingForCode = useAuthStore((s) => s.pending !== null);

  // Check the saved login once when the app opens
  useEffect(() => {
    void useAuthStore.getState().restoreSession();
  }, []);

  // Poll for due notifications & trigger Android system tray banners while signed in
  useEffect(() => {
    if (status !== 'signedIn') return;

    void requestPushPermission();

    const checkDueNotifications = () => {
      void notificationsApi.list().catch(() => undefined);
    };

    checkDueNotifications();
    const timer = setInterval(checkDueNotifications, 20000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDueNotifications();
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status]);

  // Tapping a push notification opens the right screen (waits until logged in)
  useNotificationNavigation((target) => {
    if (navigationRef.isReady()) openPushTarget(navigationRef, target);
  }, status === 'signedIn');

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {status === 'signedIn' ? (
        <>
          <Root.Screen name="Tabs" component={Tabs} />
          <Root.Screen name="ContactDetails" component={ContactDetails} />
          <Root.Screen name="AddContact" component={AddContact} options={{ animation: 'slide_from_bottom' }} />
          <Root.Screen name="EditContact" component={EditContact} options={{ animation: 'slide_from_bottom' }} />
          <Root.Screen name="ReviewDraft" component={ReviewDraft} />
          <Root.Screen name="WriteOwn" component={WriteOwn} />
          <Root.Screen name="Sent" component={Sent} />
          <Root.Screen name="Notifications" component={Notifications} />
          <Root.Screen name="EmailSettings" component={EmailSettings} />
        </>
      ) : (
        waitingForCode ? (
          // log in / sign up sent a code by email: ask for it
          <Root.Screen name="VerifyOtp" component={VerifyOtp} />
        ) : (
          <>
            <Root.Screen name="Login" component={Login} />
            <Root.Screen name="Signup" component={Signup} />
            <Root.Screen name="ForgotPassword" component={ForgotPassword} />
          </>
        )
      )}
    </Root.Navigator>
  );
}

// Yellow bar above everything while offline (it respects the status bar / notch).
function OfflineBanner(): React.JSX.Element | null {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.fairSoft }}>
      <OfflineBar />
    </View>
  );
}

export default function App(): React.JSX.Element | null {
  // Member 1's screens use these font families (theme/tokens.ts -> fonts)
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE }}
        onSuccess={() => {
          void queryClient.resumePausedMutations();
        }}
      >
        <NavigationContainer ref={navigationRef}>
          <View style={styles.flex}>
            <OfflineBanner />
            <RootNavigator />
          </View>
        </NavigationContainer>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});