// STEP: Page-step 7 · WhatsApp (wa.me) and SMS (sms:) via Linking
import { Linking, Platform } from 'react-native';

export type OpenFailureReason = 'whatsapp_unavailable' | 'no_phone' | 'no_email' | 'no_messenger' | 'open_failed';
export type OpenResult = { ok: true } | { ok: false; reason: OpenFailureReason };

/** Keeps digits only and removes a leading 00. wa.me needs the full international number, no "+". */
export function toInternationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

/**
 * Checks that the WhatsApp app is installed.
 * Needs config (see README): iOS LSApplicationQueriesSchemes "whatsapp", Android <queries> for whatsapp.
 */
export async function isWhatsAppAvailable(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('whatsapp://send');
  } catch {
    return false;
  }
}

/** Opens WhatsApp with the message prefilled. This does NOT send it; the user must tap send. */
export async function openWhatsApp(phone: string | undefined, text: string): Promise<OpenResult> {
  if (!phone) return { ok: false, reason: 'no_phone' };
  if (!(await isWhatsAppAvailable())) return { ok: false, reason: 'whatsapp_unavailable' };
  const url = `https://wa.me/${toInternationalDigits(phone)}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'open_failed' };
  }
}

/** Opens the default SMS app with the message prefilled. The user must tap send. */
export async function openSms(phone: string | undefined, text: string): Promise<OpenResult> {
  if (!phone) return { ok: false, reason: 'no_phone' };
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phone.replace(/\s/g, '')}${separator}body=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'open_failed' };
  }
}

/** Opens Telegram with the message prefilled (@username or a phone number with country code). */
export async function openTelegram(handle: string | undefined, text: string): Promise<OpenResult> {
  if (!handle) return { ok: false, reason: 'no_phone' };
  const clean = handle.trim();
  const isUsername = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(clean);
  const target = isUsername ? clean.replace(/^@/, '') : `+${toInternationalDigits(clean)}`;
  const url = `https://t.me/${target}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'open_failed' };
  }
}

/** Opens the mail app with the recipient, subject and message filled in. The user taps send. */
export async function openEmail(address: string | undefined, subject: string, text: string): Promise<OpenResult> {
  if (!address) return { ok: false, reason: 'no_email' };
  const url = `mailto:${address.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'open_failed' };
  }
}

/**
 * Turns what the user saved into a Messenger id, or null when it is not one. Accepts:
 * "rafiq.10", "@rafiq.10", "https://m.me/rafiq.10", "messenger.com/t/rafiq.10",
 * "facebook.com/rafiq.10" (also m. / web. / fb.com), "facebook.com/messages/t/rafiq.10"
 * and "facebook.com/profile.php?id=100012345678" (number id).
 */
export function messengerUsername(raw: string | undefined): string | null {
  let handle = (raw ?? '').trim();
  if (!handle) return null;
  // profile.php?id=123 keeps only the number
  const idMatch = handle.match(/profile\.php\?(?:.*&)?id=(\d{5,20})/i);
  if (idMatch) return idMatch[1];
  handle = handle
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.|m\.|web\.|mobile\.)/i, '')
    .replace(/^(m\.me|messenger\.com\/t|messenger\.com|facebook\.com\/messages\/t|facebook\.com|fb\.com|fb\.me)\//i, '');
  handle = handle.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').replace(/^@/, '');
  if (/^\d{5,20}$/.test(handle)) return handle;
  return /^[A-Za-z0-9.]{3,50}$/.test(handle) && handle.toLowerCase() !== 'profile.php' ? handle : null;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Opens the Messenger chat. Messenger cannot carry the text in the link,
 * so the caller copies the message first and the user pastes it.
 *  1. Number id: the Messenger app link (fb-messenger://user-thread/<id>) opens the chat in the app.
 *  2. Otherwise https://m.me/<name>, which the Messenger app takes over when installed.
 *  3. If that fails, the Messenger website chat (messenger.com/t/<name>).
 */
export async function openMessenger(username: string | undefined): Promise<OpenResult> {
  const name = messengerUsername(username);
  if (!name) return { ok: false, reason: 'no_messenger' };
  // A bottom sheet may still be closing: iOS ignores openURL while a modal is animating away
  await wait(350);
  const urls = [
    ...(/^\d+$/.test(name) ? [`fb-messenger://user-thread/${name}`] : []),
    `https://m.me/${name}`,
    `https://www.messenger.com/t/${name}`,
  ];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return { ok: true };
    } catch {
      // try the next link
    }
  }
  return { ok: false, reason: 'open_failed' };
}
