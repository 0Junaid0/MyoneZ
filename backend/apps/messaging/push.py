"""Phone push notifications through Expo's push service.

Every in-app notification (SendNotification) is also pushed to the user's phones.
The ``data`` block matches what the mobile app reads when a push is tapped
(Frontend/src/notifications/useNotificationNavigation.ts):

    {"type": "reminder", "draft_id": "<message id>", "contact_id": "..."}  -> Review draft
    {"type": "check_in", "contact_id": "..."}                              -> Contact detail
"""

import json
import logging
import threading
import urllib.request

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def push_data(note):
    """What the app needs to open the right screen when the push is tapped."""
    if note.message_id:
        return {
            "type": "reminder",
            "draft_id": str(note.message_id),
            "contact_id": str(note.message.contact_id),
            "notification_id": str(note.id),
        }
    return {
        "type": "check_in",
        "contact_id": str(note.touchpoint.schedule.contact_id),
        "notification_id": str(note.id),
    }


def queue_push(note):
    """Sends the push after the database commit, on a background thread (never blocks a request)."""
    if not getattr(settings, "EXPO_PUSH_ENABLED", False):
        return
    note_id = note.pk
    transaction.on_commit(
        lambda: threading.Thread(target=deliver_push, args=(note_id,), daemon=True).start()
    )


def deliver_push(note_id):
    from apps.accounts.models import Device

    from .models import SendNotification

    try:
        note = SendNotification.objects.select_related("message", "touchpoint__schedule").get(
            pk=note_id
        )
    except SendNotification.DoesNotExist:
        return
    tokens = list(Device.objects.filter(user_id=note.user_id).values_list("token", flat=True))
    if not tokens:
        return
    data = push_data(note)
    messages = [
        {
            "to": token,
            "title": note.title,
            "body": note.body,
            "data": data,
            "sound": "default",
            "channelId": "default",  # the Android channel the app creates (notifications/push.ts)
        }
        for token in tokens
    ]
    request = urllib.request.Request(
        settings.EXPO_PUSH_URL,
        data=json.dumps(messages).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310 (fixed https URL)
            tickets = json.loads(response.read().decode()).get("data", [])
    except Exception:
        logger.exception("Push to Expo failed for notification %s", note_id)
        return
    # Expo answers one ticket per message, in order. Forget phones that uninstalled the app.
    for token, ticket in zip(tokens, tickets, strict=False):
        if ticket.get("status") == "error":
            if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                Device.objects.filter(token=token).delete()
            else:
                logger.warning("Expo push error for %s: %s", token[:30], ticket.get("message"))
