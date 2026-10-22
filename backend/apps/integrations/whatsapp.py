from urllib.parse import quote

import phonenumbers


def build_handoff_url(phone, body):
    try:
        parsed = phonenumbers.parse(phone, None)
    except phonenumbers.NumberParseException as exc:
        raise ValueError("WhatsApp number must include a valid country code.") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid WhatsApp number.")
    international = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164).lstrip(
        "+"
    )
    return f"https://wa.me/{international}?text={quote(body)}"
