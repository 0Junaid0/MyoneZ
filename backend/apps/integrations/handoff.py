import re
from urllib.parse import quote

import phonenumbers

from .whatsapp import build_handoff_url

SEND_CHANNELS = ("whatsapp", "email", "telegram", "messenger", "phone")
CHANNEL_LABELS = {
    "whatsapp": "WhatsApp",
    "email": "Gmail",
    "telegram": "Telegram",
    "messenger": "Messenger",
    "phone": "SMS",
}
_MESSENGER_NAME = re.compile(r"^[A-Za-z0-9.]{3,50}$")


def build_message_handoff(channel, contact, body, subject="Catching up!"):
    sheet = build_send_sheet(channel, contact, body, subject)
    return sheet["provider"], sheet["deep_link"]


def build_send_sheet(channel, contact, body, subject="Catching up!"):
    if channel == "whatsapp":
        if not contact.whatsapp:
            raise ValueError("Add a WhatsApp number before sending by WhatsApp.")
        return _sheet(
            channel,
            contact,
            body,
            recipient=contact.whatsapp,
            deep_link=build_handoff_url(contact.whatsapp, body),
            provider="whatsapp_handoff",
            link_prefilled=True,
            hint="Opens WhatsApp with this message filled in. You only need to tap Send.",
        )
    if channel == "telegram":
        if not contact.telegram:
            raise ValueError("Add a Telegram phone number before sending by Telegram.")
        return _sheet(
            channel,
            contact,
            body,
            recipient=contact.telegram,
            deep_link=_telegram_link(contact.telegram, body),
            provider="telegram_handoff",
            link_prefilled=True,
            hint="Opens Telegram with this message filled in. You only need to tap Send.",
        )
    if channel == "email":
        if not contact.email:
            raise ValueError("Add an email address before sending by email.")
        return _sheet(
            channel,
            contact,
            body,
            recipient=contact.email,
            subject=subject,
            deep_link=f"mailto:{contact.email}?subject={quote(subject)}&body={quote(body)}",
            provider="email_handoff",
            link_prefilled=True,
            hint="Opens your mail with the recipient and message filled in. You tap Send.",
        )
    if channel == "phone":
        if not contact.phone:
            raise ValueError("Add a phone number before sending by SMS.")
        number = _sms_number(contact.phone)
        return _sheet(
            channel,
            contact,
            body,
            recipient=number,
            deep_link=f"sms:{number}?body={quote(body)}",
            provider="sms_handoff",
            link_prefilled=True,
            hint="Opens your SMS app with this message filled in. You only need to tap Send.",
        )
    if channel == "messenger":
        username = _messenger_username(contact.messenger)
        return _sheet(
            channel,
            contact,
            body,
            recipient=username,
            deep_link=f"https://m.me/{username}",
            provider="messenger_handoff",
            link_prefilled=False,
            hint=(
                "Copy the message, open the chat, then paste and send. "
                "Messenger cannot carry the text in the link."
            ),
        )
    raise ValueError("Choose WhatsApp, Telegram, Gmail, Messenger, or SMS.")


def _sheet(
    channel, contact, body, recipient, deep_link, provider, link_prefilled, hint, subject=""
):
    return {
        "channel": channel,
        "channel_label": CHANNEL_LABELS[channel],
        "contact_name": contact.name,
        "recipient": recipient,
        "subject": subject,
        "body": body,
        "deep_link": deep_link,
        "link_prefilled": link_prefilled,
        "copy_text": body,
        "hint": hint,
        "provider": provider,
    }


def _sms_number(phone):
    try:
        parsed = phonenumbers.parse(phone, None)
    except phonenumbers.NumberParseException as exc:
        raise ValueError("SMS number must include a valid country code.") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid SMS number.")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


_TELEGRAM_USERNAME = re.compile(r"^@?[A-Za-z][A-Za-z0-9_]{4,31}$")


def _telegram_link(phone, body):
    handle = (phone or "").strip()
    if _TELEGRAM_USERNAME.fullmatch(handle):
        return f"https://t.me/{handle.lstrip('@')}?text={quote(body)}"
    try:
        parsed = phonenumbers.parse(phone, None)
    except phonenumbers.NumberParseException as exc:
        raise ValueError("Telegram number must include a valid country code.") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid Telegram number.")
    digits = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164).lstrip("+")
    return f"https://t.me/+{digits}?text={quote(body)}"


_PROFILE_ID = re.compile(r"profile\.php\?(?:.*&)?id=(\d{5,20})", re.IGNORECASE)
_MESSENGER_PREFIX = re.compile(
    r"^(?:https?://)?(?:www\.|m\.|web\.|mobile\.)?"
    r"(?:m\.me|messenger\.com/t|messenger\.com|facebook\.com/messages/t|facebook\.com|fb\.com|fb\.me)/",
    re.IGNORECASE,
)


def _messenger_username(value):
    """Username or number id from "rafiq.10", "@rafiq.10", m.me / messenger.com / facebook.com links
    and facebook.com/profile.php?id=123 (same rules as Frontend/src/utils/messaging.ts)."""
    handle = (value or "").strip()
    match = _PROFILE_ID.search(handle)
    if match:
        return match.group(1)
    handle = _MESSENGER_PREFIX.sub("", handle)
    handle = re.split(r"[?#]", handle)[0].strip("/").lstrip("@")
    if not _MESSENGER_NAME.fullmatch(handle) or handle.lower() == "profile.php":
        raise ValueError("Add the Messenger username, like rafiq.ahmed.10.")
    return handle
