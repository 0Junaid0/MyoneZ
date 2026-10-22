import { Channel, DraftReason } from '../types/draft';

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  telegram: 'Telegram',
  email: 'Gmail',
  messenger: 'Messenger',
};

export const REASON_LABEL: Record<DraftReason, string> = {
  check_in: 'Check-in',
  reconnect: 'Reconnect',
  birthday: 'Birthday',
  thanks: 'Gratitude',
  congrats: 'Congratulations',
  other: 'Message',
};

/** Lower-case noun used inside sentences: "A thank-you to Nadia is already scheduled" */
export const REASON_NOUN: Record<DraftReason, string> = {
  check_in: 'check-in',
  reconnect: 'reconnect message',
  birthday: 'birthday message',
  thanks: 'thank-you',
  congrats: 'congratulations message',
  other: 'message',
};

/** Line shown under every Send / Schedule button: where the message will come from (PRD rule) */
export function whereFromLine(channel: Channel): string {
  switch (channel) {
    case 'whatsapp':
      return 'Opens your WhatsApp · sends from your own number';
    case 'sms':
      return 'Opens your SMS app · sends from your own number';
    case 'telegram':
      return 'Opens your Telegram · sends from your own account';
    case 'email':
      return 'Opens your mail app · sends from your own email';
    case 'messenger':
      return 'Copy the message, then paste it in your own Messenger chat';
  }
}

/** Short "sends from" text for scheduled items */
export function sendsFromLabel(channel: Channel): string {
  if (channel === 'telegram') return 'Your own Telegram';
  if (channel === 'sms') return 'Your own number';
  if (channel === 'email') return 'Your own email';
  if (channel === 'messenger') return 'Your own Messenger';
  return 'Your own WhatsApp';
}
