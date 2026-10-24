/**
 * ===============================================================
 *  FILE: theme/tokens.ts
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: All design values in one place — colors, fonts, sizes,
 *        spacing and corner radius — taken from the MyOneZ mobile design.
 *  USED BY: every page and every component (all 4 members).
 *  RULE: never type a hex color or a font name inside a page.
 *        Import it from here instead.
 * ===============================================================
 */

export const colors = {
  // Brand
  navy: '#0E2240', // log-in header, Home card, selected chips
  navyLight: '#1E3A66',
  primary: '#1D4ED8', // main buttons, links, active tab
  primaryDark: '#1E3A8A',
  primarySoft: '#DBEAFE',
  primaryTint: '#EFF6FF',
  brandBright: '#2563EB', // logo tile gradient start
  brandGlow: '#60A5FA', // logo dots and the "Z" in MyOneZ

  // Surfaces
  background: '#F4F6FA', // screen background
  surface: '#FFFFFF', // cards, lists, sheets
  border: '#E2E8F0', // card borders, dividers
  inputBorder: '#CBD5E1', // inputs, secondary buttons
  divider: '#F1F5F9',
  skeleton: '#E2E8F0',

  // Text
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#475569',
  textFaint: '#64748B',
  onDark: '#FFFFFF',
  onDarkMuted: '#C7D2E3',

  // Health and status
  healthy: '#15803D', // health 70% and above
  healthySoft: '#DCFCE7',
  fair: '#D97706', // health 40–69%
  fairText: '#92400E',
  fairSoft: '#FEF3C7',
  low: '#DC2626', // health under 40%, errors, overdue
  lowText: '#B91C1C',
  lowSoft: '#FEE2E2',
  lowBorder: '#FECACA',
  pinkText: '#9D174D',
  pinkSoft: '#FCE7F3',
  neutralSoft: '#F1F5F9',

  // Names used by Member 2 / 3 / 4 code (same palette, kept so their files work unchanged)
  primaryText: '#FFFFFF', // text on primary buttons
  danger: '#DC2626',
  healthGood: '#15803D',
  healthFair: '#D97706',
  healthPoor: '#DC2626',
  healthTrack: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.4)', // behind bottom sheets and dialogs
} as const;

// Avatar tint pairs (background / initials color) — Member 2
export const avatarTints = [
  { bg: '#DCFCE7', fg: '#166534' }, // green
  { bg: '#FFEDD5', fg: '#9A3412' }, // orange
  { bg: '#EDE9FE', fg: '#5B21B6' }, // purple
  { bg: '#FEF3C7', fg: '#92400E' }, // yellow
  { bg: '#FCE7F3', fg: '#9D174D' }, // pink
  { bg: '#CFFAFE', fg: '#155E75' }, // cyan
  { bg: '#F1F5F9', fg: '#475569' }, // gray
] as const;

/**
 * Plus Jakarta Sans. With @expo-google-fonts every weight is its own
 * font family, so use `fontFamily: fonts.bold` — NOT `fontWeight: '700'`.
 * The fonts are loaded once in App.tsx (Member 4) with useFonts().
 */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSize = {
  display: 30, // log-in headline
  title: 28, // screen title
  heading: 22, // card / form heading
  section: 17, // section title
  body: 15,
  input: 16, // always 16 so iPhone does not zoom into inputs
  small: 13,
  caption: 12,
  tab: 11,
  // short names used by Member 2 / 3 / 4 code
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
} as const;

/**
 * Member 2 / 3 / 4 code uses fontWeight (system font). New code should use
 * `fontFamily: fonts.bold` etc. so the text uses Plus Jakarta Sans.
 */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Spacing in steps of 4 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  input: 12,
  button: 12,
  card: 16,
  hero: 20,
  lg: 16,
  sheet: 26,
  pill: 999,
} as const;

export const sizes = {
  button: 52,
  input: 50,
  minTap: 44, // every tap target must be at least 44 x 44
  avatar: 40,
  tabBar: 78,
} as const;

/** Health score helpers — same rule everywhere in the app */
export type HealthLevel = 'healthy' | 'fair' | 'low';

export function healthLevel(score: number): HealthLevel {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'fair';
  return 'low';
}

export function healthColor(score: number): string {
  const level = healthLevel(score);
  if (level === 'healthy') return colors.healthy;
  if (level === 'fair') return colors.fair;
  return colors.low;
}

export function healthLabel(score: number): string {
  const level = healthLevel(score);
  if (level === 'healthy') return 'Healthy';
  if (level === 'fair') return 'Fair';
  return 'Low';
}
