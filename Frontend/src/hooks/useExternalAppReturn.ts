// STEP: Page-step 8 · AppState listener (return from WhatsApp / SMS -> M09)
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Detects the user coming back to MyOneZ after leaving for WhatsApp/SMS.
 * Call arm() right before opening the external app. When the app goes to
 * background and then becomes active again, onReturn fires once.
 */
export function useExternalAppReturn(onReturn: () => void): { arm: () => void; disarm: () => void } {
  const armed = useRef(false);
  const leftApp = useRef(false);
  const callback = useRef(onReturn);
  callback.current = onReturn;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (!armed.current) return;
      if (next === 'background' || next === 'inactive') {
        leftApp.current = true;
      } else if (next === 'active' && leftApp.current) {
        armed.current = false;
        leftApp.current = false;
        callback.current();
      }
    });
    return () => subscription.remove();
  }, []);

  const arm = useCallback(() => {
    armed.current = true;
    leftApp.current = false;
  }, []);

  const disarm = useCallback(() => {
    armed.current = false;
    leftApp.current = false;
  }, []);

  return { arm, disarm };
}
