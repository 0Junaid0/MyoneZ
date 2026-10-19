import re
from urllib.parse import quote

import phonenumbers

from .whatsapp import build_handoff_url

SEND_CHANNELS = ("whatsapp", "email", "telegram", "messenger")
CHANNEL_LABELS = {
    "whatsapp": "WhatsApp",
    "email": "Gmail",
    "telegram": "Telegram",
    "messenger": "Messenger",
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
    raise ValueError("Choose WhatsApp, Telegram, Gmail, or Messenger.")


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


def _telegram_link(phone, body):
    try:
        parsed = phonenumbers.parse(phone, None)
    except phonenumbers.NumberParseException as exc:
        raise ValueError("Telegram number must include a valid country code.") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid Telegram number.")
    digits = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164).lstrip("+")
    return f"https://t.me/+{digits}?text={quote(body)}"


def _messenger_username(value):
    handle = (value or "").strip()
    for prefix in (
        "https://m.me/",
        "http://m.me/",
        "https://www.messenger.com/t/",
        "https://www.facebook.com/",
        "https://facebook.com/",
    ):
        if handle.lower().startswith(prefix):
            handle = handle[len(prefix) :]
    handle = handle.strip("/").split("?")[0].lstrip("@")
    if not _MESSENGER_NAME.fullmatch(handle):
        raise ValueError("Add the Messenger username, like rafiq.ahmed.10.")
    return handle
