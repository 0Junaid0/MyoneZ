import { colors } from '../theme/tokens';

export type HealthWord = 'Healthy' | 'Fair' | 'Low';

/** Health is never shown by color alone: always pair the color with the number and this word */
export function healthWord(score: number): HealthWord {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Fair';
  return 'Low';
}

export function healthColor(score: number): string {
  if (score >= 70) return colors.healthy;
  if (score >= 40) return colors.fair;
  return colors.low;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between an ISO date and now (never negative) */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/**
 * Relationship health 0-100 (the backend has no score): 100 right after contact,
 * 50 when the check-in is due, 0 when it is twice as late as the rhythm.
 */
export function computeHealth(days: number | null, intervalDays: number | null | undefined): number {
  if (days === null) return 0;
  const interval = intervalDays && intervalDays > 0 ? intervalDays : 30;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - days / (interval * 2)))));
}
