import { DraftEditable } from '../types/draft';

/**
 * Keeps edits that are not saved on the server yet (typed while offline, or leaving
 * the screen before autosave ran). PRD: "edits are kept if the user leaves and comes back".
 * Memory only: it lives as long as the app process.
 */
const pendingEdits = new Map<string, DraftEditable>();
const ownDrafts = new Map<string, string>();

export const draftEditsCache = {
  get: (draftId: string): DraftEditable | undefined => pendingEdits.get(draftId),
  set: (draftId: string, edits: DraftEditable): void => {
    pendingEdits.set(draftId, edits);
  },
  clear: (draftId: string): void => {
    pendingEdits.delete(draftId);
  },
};

/** Text typed in "Write my own" (M17): "a message typed in M17 is saved and kept" */
export const writeOwnCache = {
  get: (contactId: string): string => ownDrafts.get(contactId) ?? '',
  set: (contactId: string, text: string): void => {
    if (text) ownDrafts.set(contactId, text);
    else ownDrafts.delete(contactId);
  },
};
