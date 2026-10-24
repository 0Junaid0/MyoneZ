// navigation/types.ts  (Owner: Member 4)
// Route names and params for the whole app. Use these types with useNavigation / useRoute if you want type safety.
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DraftTab, DraftsNavParams } from '../types/navigation'; // Member 3's routes

// Stack inside the Contacts tab. The tab bar stays visible on these screens.
export type ContactsStackParamList = {
  ContactsList: undefined;
  /** `id` is ours, `contactId` is Member 3's name for the same thing. */
  ContactDetails: { id?: string; contactId?: string };
};

export type TabParamList = {
  Home: undefined;
  Contacts: NavigatorScreenParams<ContactsStackParamList> | undefined;
  /** tab: a DraftTab ('review' | 'scheduled' | 'sent' | 'failed') or a DraftStatus ('pending_review' ...) */
  Drafts: { tab?: DraftTab | string } | undefined;
  Schedule: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  // signed out
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  VerifyOtp: undefined;
  // signed in
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  /** Also lives inside the Contacts tab; this copy opens it from other tabs (Schedule, Notifications...). */
  ContactDetails: { id?: string; contactId?: string };
  AddContact: undefined;
  EditContact: { id: string };
  ReviewDraft: DraftsNavParams['ReviewDraft'];
  WriteOwn: DraftsNavParams['WriteOwn'];
  Sent: DraftsNavParams['Sent'];
  Notifications: undefined;
  /** "Email" page: SMTP account used to send by Gmail (opened from Settings) */
  EmailSettings: undefined;
};
