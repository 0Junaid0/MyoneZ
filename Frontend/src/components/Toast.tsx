// STEP: PHASE 2 · Shared component · toasts (Marked as sent, Scheduled for…, Schedule cancelled)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSize, radius, spacing } from '../theme/tokens';

export type ToastType = 'success' | 'warning' | 'error';

export interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide?: () => void;
  /** milliseconds before onHide is called */
  duration?: number;
}

const BG: Record<ToastType, string> = {
  success: colors.healthy,
  warning: colors.fair,
  error: colors.low,
};

export default function Toast({ message, type = 'success', visible, onHide, duration = 2600 }: ToastProps): React.JSX.Element | null {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
    if (!visible) return undefined;
    const timer = setTimeout(() => onHide?.(), duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onHide, opacity]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top: insets.top + spacing.md, opacity, backgroundColor: BG[type] }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

/** Usage: const { toastProps, showToast } = useToast();  ...  <Toast {...toastProps} /> */
export function useToast(): {
  toastProps: ToastProps;
  showToast: (message: string, type?: ToastType) => void;
} {
  const [state, setState] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setState({ message, type, visible: true });
  }, []);
  const onHide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);
  return { toastProps: { ...state, onHide }, showToast };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.input,
    zIndex: 100,
    elevation: 6,
  },
  text: { fontFamily: fonts.semibold, color: colors.surface, fontSize: fontSize.md },
});
