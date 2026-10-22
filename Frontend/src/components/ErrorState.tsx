/**
 * ===============================================================
 *  FILE: components/ErrorState.tsx
 *  OWNER: Member 1  |  PHASE: 2 (Shared Components)
 *  WHAT: What a page shows when loading failed, with a Try again button.
 *  PROPS: message, onRetry, title
 *  USED BY: Home, Contacts, Drafts, Schedule, Notifications (all members)
 *  EXAMPLE:
 *    if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;
 * ===============================================================
 */
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { Button } from './Button';
import { colors, fonts, fontSize, spacing } from '../theme/tokens';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ message, onRetry, title = "Couldn't load" }: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <AlertCircle size={28} color={colors.lowText} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.lowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize.section,
    color: colors.text,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});

// Default export too, so Member 2 / 3 / 4 code can write: import ErrorState from './ErrorState'
export default ErrorState;
