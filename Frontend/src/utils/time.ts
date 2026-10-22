import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';

// NOTE: we deliberately do NOT use dayjs/plugin/timezone.
// Its `.tz()` does `new Date(date.toLocaleString('en-US', { timeZone }))`, and Hermes
// (the JS engine in Expo Go) cannot parse that string -> "Invalid Date" on a phone.
// The helpers below only use numbers (and Intl.formatToParts when available).
dayjs.extend(utc);

const pad = (n: number) => String(n).padStart(2, '0');
const MIN = 60_000;

// ---- Offset lookup: Intl first, built-in table as fallback ------------------------------

const dtfCache: Record<string, Intl.DateTimeFormat> = {};

function offsetViaIntl(tz: string, ts: number): number | null {
  try {
    let dtf = dtfCache[tz];
    if (!dtf) {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
      dtfCache[tz] = dtf;
    }
    const parts: Record<string, number> = {};
    for (const p of dtf.formatToParts(new Date(ts))) {
      if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10);
    }
    if (!parts.year || !parts.month || !parts.day) return null;
    const hour = parts.hour === 24 ? 0 : parts.hour;
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second);
    const base = Math.floor(ts / 1000) * 1000;
    const diff = (asUtc - base) / MIN;
    return Number.isFinite(diff) ? diff : null;
  } catch {
    return null;
  }
}

type Dst = 'none' | 'eu' | 'us' | 'au';
const ZONES: Record<string, { std: number; dst: Dst }> = {
  'Asia/Dhaka': { std: 360, dst: 'none' },
  'Asia/Kolkata': { std: 330, dst: 'none' },
  'Asia/Dubai': { std: 240, dst: 'none' },
  'Europe/London': { std: 0, dst: 'eu' },
  'Europe/Berlin': { std: 60, dst: 'eu' },
  'America/New_York': { std: -300, dst: 'us' },
  'America/Los_Angeles': { std: -480, dst: 'us' },
  'Australia/Sydney': { std: 600, dst: 'au' },
  UTC: { std: 0, dst: 'none' },
};

/** UTC ms of the n-th (1-based) Sunday of a month, or the last one when n = -1, at the given UTC time */
function sunday(year: number, month: number, n: number, utcHour: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const day = 1 + ((7 - first) % 7) + (n - 1) * 7;
    return Date.UTC(year, month, day, utcHour);
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), utcHour);
}

function offsetViaTable(tz: string, ts: number): number {
  const zone = ZONES[tz];
  if (!zone) return -new Date(ts).getTimezoneOffset(); // unknown zone: use the phone's own zone
  const y = new Date(ts).getUTCFullYear();
  let isDst = false;
  if (zone.dst === 'eu') isDst = ts >= sunday(y, 2, -1, 1) && ts < sunday(y, 9, -1, 1);
  if (zone.dst === 'us') isDst = ts >= sunday(y, 2, 2, 2) - zone.std * MIN && ts < sunday(y, 10, 1, 2) - (zone.std + 60) * MIN;
  if (zone.dst === 'au') isDst = ts >= sunday(y, 9, 1, 2) - zone.std * MIN || ts < sunday(y, 3, 1, 2) - zone.std * MIN;
  return zone.std + (isDst ? 60 : 0);
}

/** Minutes the zone is ahead of UTC at that moment (Dhaka = 360) */
export function tzOffsetMinutes(tz: string, at: number | Date | Dayjs = Date.now()): number {
  const ts = typeof at === 'number' ? at : at.valueOf();
  return offsetViaIntl(tz, ts) ?? offsetViaTable(tz, ts);
}

/** A Dayjs in UTC mode whose clock fields (hour(), date(), format()) show the wall-clock time in `tz` */
function wallClock(tz: string, at: number | Date | Dayjs | string): Dayjs {
  const ts = dayjs(at).valueOf();
  return dayjs.utc(ts + tzOffsetMinutes(tz, ts) * MIN);
}

/** "GMT+6", "GMT+5:30": the zone name MyOneZ must show next to scheduled times */
export function zoneLabel(tz: string, at: Date | Dayjs | string = new Date()): string {
  const offsetMinutes = tzOffsetMinutes(tz, dayjs(at).valueOf());
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}${minutes ? `:${pad(minutes)}` : ''}`;
}

/** Current wall-clock time in `tz` (use .format / .add; its valueOf() is NOT the real instant) */
export function nowIn(tz: string): Dayjs {
  return wallClock(tz, Date.now());
}

/** Wall-clock view of any moment in `tz` */
export function inZone(value: string | Date | Dayjs, tz: string): Dayjs {
  return wallClock(tz, value);
}

/** Builds the exact moment for a calendar day + clock time picked in the contact's timezone */
export function buildInstant(tz: string, ymd: string, hour: number, minute: number): Dayjs {
  const [y, mo, d] = ymd.split('-').map(Number);
  const localTs = Date.UTC(y, mo - 1, d, hour, minute);
  const o1 = tzOffsetMinutes(tz, localTs);
  let ts = localTs - o1 * MIN;
  const o2 = tzOffsetMinutes(tz, ts);
  if (o2 !== o1) ts = localTs - o2 * MIN;
  return dayjs(ts);
}

/** "Today, 6:00 PM" | "Tomorrow, 9:00 AM" | "Thu 8 Oct, 6:00 PM" (in the given timezone) */
export function describeWhen(value: string | Date | Dayjs, tz: string): string {
  const moment = wallClock(tz, value);
  const today = nowIn(tz);
  const time = moment.format('h:mm A');
  if (moment.format('YYYY-MM-DD') === today.format('YYYY-MM-DD')) return `Today, ${time}`;
  if (moment.format('YYYY-MM-DD') === today.add(1, 'day').format('YYYY-MM-DD')) return `Tomorrow, ${time}`;
  return `${moment.format('ddd D MMM')}, ${time}`;
}

/** Same as describeWhen, with the zone named: "Today, 6:00 PM (GMT+6)" */
export function describeWhenWithZone(value: string | Date | Dayjs, tz: string): string {
  return `${describeWhen(value, tz)} (${zoneLabel(tz, value)})`;
}

/** "8 Oct" */
export function shortDate(value: string | Date | Dayjs): string {
  return dayjs(value).format('D MMM');
}

/**
 * True when a scheduled message is less than a minute away: PRD says it can no longer be changed.
 * A time that has already passed is not "about to send": the server hands it over on the next
 * refresh, and until then the buttons must keep working instead of staying greyed out forever.
 */
export function isLockedSchedule(scheduledAt?: string): boolean {
  if (!scheduledAt) return false;
  const left = dayjs(scheduledAt).valueOf() - Date.now();
  return left >= 0 && left < 60_000;
}

/** "Thu 8 Oct" (in the given timezone) */
export function describeDay(value: string | Date | Dayjs, tz: string): string {
  return wallClock(tz, value).format('ddd D MMM');
}
