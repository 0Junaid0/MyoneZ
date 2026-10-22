// hooks/useRefreshOnFocus.ts
// Tabs and stack screens stay mounted, so a screen that loads only once shows old data
// after you come back to it (e.g. Contact page after Edit, Contacts list after Add).
// This calls `refresh` every time the screen comes back into view, but not on the first
// view (the screen's own first load already ran).
import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useRefreshOnFocus(refresh: () => unknown): void {
  const firstFocus = useRef(true);
  const latest = useRef(refresh);
  latest.current = refresh;

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void latest.current();
    }, []),
  );
}
