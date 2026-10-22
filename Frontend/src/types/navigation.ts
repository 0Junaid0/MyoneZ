/**
 * ===============================================================
 *  FILE: types/navigation.ts
 *  OWNER: Member 1 + Member 3 (shared contract with Member 4)
 *  WHAT: Screen names and the params each one needs.
 *        - DraftsNavParams: Member 3's routes (drafts flow)
 *        - AuthStackParamList / MainTabParamList / AppStackParamList:
 *          Member 1's names. They are now just other names for the
 *          real navigators in navigation/types.ts (Member 4), so
 *          there is only ONE list of routes in the app.
 * ===============================================================
 */
import type { RootStackParamList, TabParamList } from '../navigation/types';
import type { SentResult } from './draft';

/** Which tab of the Drafts page to open */
export type DraftTab = 'review' | 'scheduled' | 'sent' | 'failed';

/**
 * Routes Member 3 screens use (merged into RootStackParamList in navigation/types.ts).
 */
export type DraftsNavParams = {
  ReviewDraft: {
    draftId: string;
    /** 'new' = opened from "Message" on a contact (M16): title "New message", same layout as review */
    mode?: 'review' | 'new';
    /** Used by "Write my own": start the send flow as soon as the draft loads */
    startSend?: boolean;
    /** Used by "Write my own": open the schedule sheet as soon as the draft loads */
    openSchedule?: boolean;
  };
  WriteOwn: { contactId: string; contactName: string };
  Sent: SentResult;
  /** Owned by Member 2 */
  ContactDetails: { contactId: string };
  /** Owned by Member 4: the 5-tab navigator */
  Tabs: { screen?: 'Home' | 'Contacts' | 'Drafts' | 'Schedule' | 'Settings' } | undefined;
};

/** Screens shown before log in (Member 1) */
export type AuthStackParamList = Pick<RootStackParamList, 'Login' | 'Signup' | 'ForgotPassword'>;

/** The 5 bottom tabs (Member 1 name) */
export type MainTabParamList = TabParamList;

/** Screens shown after log in (Member 1 name) */
export type AppStackParamList = RootStackParamList;
