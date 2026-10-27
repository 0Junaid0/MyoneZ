import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.contacts.models import Contact
from apps.integrations.handoff import CHANNEL_LABELS, SEND_CHANNELS, build_message_handoff
from apps.schedules.models import Schedule, Touchpoint

from .models import DeliveryAttempt, Message, SendNotification
from .push import push_data, queue_push

logger = logging.getLogger(__name__)


def schedule_approval(message, channel, send_in=None, send_unit=None):
    channel = channel or message.channel or message.contact.preferred_channel
    if channel not in SEND_CHANNELS:
        raise ValueError("Choose WhatsApp, Telegram, Gmail, Messenger, or SMS.")
    touchpoint = message.touchpoint
    if touchpoint is None or touchpoint.status not in Touchpoint.ACTIVE_STATUSES:
        touchpoint = (
            Touchpoint.objects.filter(
                schedule__contact=message.contact,
                status__in=Touchpoint.ACTIVE_STATUSES,
            )
            .order_by("due_at")
            .first()
        )
    if send_in is None:
        if touchpoint is None:
            raise ValueError("Choose a schedule from 1 minute to any number of days.")
        scheduled_for = touchpoint.due_at
    else:
        scheduled_for = timezone.now() + _send_delay(send_in, send_unit)
    try:
        build_message_handoff(channel, message.contact, message.body, message.get_purpose_display())
    except ValueError as exc:
        raise ValueError(str(exc)) from exc
    message.channel = channel
    message.touchpoint = touchpoint
    message.scheduled_for = scheduled_for
    message.approved_at = timezone.now()


def _send_delay(amount, unit):
    if unit == "minutes":
        return timedelta(minutes=amount)
    if unit == "hours":
        return timedelta(hours=amount)
    if unit == "days":
        return timedelta(days=amount)
    raise ValueError("Choose minutes, hours, or days.")


def release_due_messages(user):
    dispatch_due_messages(user)
    notes = SendNotification.objects.filter(user=user, opened_at__isnull=True).select_related(
        "message__contact", "touchpoint__schedule__contact"
    )
    return [notification_payload(note) for note in notes]


def dispatch_due_messages(user=None):
    now = timezone.now()
    queryset = Message.objects.filter(
        status=Message.Status.APPROVED,
        scheduled_for__lte=now,
    )
    if user is not None:
        queryset = queryset.filter(contact__user=user)
    notify_due_touchpoints(user)
    outcomes = []
    for message_id in queryset.order_by("scheduled_for").values_list("id", flat=True):
        try:
            outcome = dispatch_message(message_id)
        except Exception:
            logger.exception("Could not send scheduled message %s", message_id)
            continue
        if outcome:
            outcomes.append(outcome)
    remind_unsent_messages(user)
    return outcomes


@transaction.atomic
def dispatch_message(message_id):
    message = (
        Message.objects.select_for_update(of=("self",))
        .select_related("contact__user__email_account", "touchpoint")
        .get(pk=message_id)
    )
    if message.status != Message.Status.APPROVED:
        return None
    if message.scheduled_for and message.scheduled_for > timezone.now():
        return None
    if message.contact.status != Contact.Status.ACTIVE:
        message.status = Message.Status.CANCELLED
        message.save(update_fields=["status", "updated_at"])
        return None
    if message.touchpoint_id and message.touchpoint.status not in Touchpoint.ACTIVE_STATUSES:
        message.status = Message.Status.CANCELLED
        message.save(update_fields=["status", "updated_at"])
        return None
    channel = message.channel or message.contact.preferred_channel
    key = f"schedule:{message.id}"
    try:
        provider, url = build_message_handoff(
            channel, message.contact, message.body, message.get_purpose_display()
        )
    except ValueError as exc:
        DeliveryAttempt.objects.update_or_create(
            message=message,
            idempotency_key=key,
            defaults={
                "provider": "invalid_handoff",
                "status": DeliveryAttempt.Status.FAILED,
                "error": str(exc)[:500],
                "handoff_url": "",
            },
        )
        message.status = Message.Status.FAILED
        message.save(update_fields=["status", "updated_at"])
        return None
    DeliveryAttempt.objects.update_or_create(
        message=message,
        idempotency_key=key,
        defaults={
            "provider": provider,
            "status": DeliveryAttempt.Status.HANDED_OFF,
            "error": "",
            "handoff_url": url,
        },
    )
    message.status = Message.Status.QUEUED
    message.save(update_fields=["status", "updated_at"])
    note, _created = SendNotification.objects.get_or_create(
        message=message,
        defaults={
            "user": message.contact.user,
            "title": f"Message for {message.contact.name}",
            "body": f"Your {CHANNEL_LABELS.get(channel, 'message')} is ready to send.",
            "route": f"/send/{message.id}",
        },
    )
    if _created:
        queue_push(note)
    return notification_payload(note)


def remind_unsent_messages(user=None):
    cutoff = timezone.now() - timedelta(days=1)
    messages = Message.objects.filter(
        status=Message.Status.QUEUED,
        scheduled_for__lte=cutoff,
        contact__status=Contact.Status.ACTIVE,
    ).select_related("contact__user")
    if user is not None:
        messages = messages.filter(contact__user=user)
    for message in messages:
        contact = message.contact
        title = f"Message to {contact.name} was not sent"
        body = "A day has passed since it was due. Open it when you are ready to send."
        note = SendNotification.objects.filter(message=message).first()
        if note is None:
            note = SendNotification.objects.create(
                user=contact.user,
                message=message,
                title=title,
                body=body,
                route=f"/send/{message.id}",
            )
            queue_push(note)
            continue
        if note.title == title:
            continue
        note.title = title
        note.body = body
        note.opened_at = None
        note.route = f"/send/{message.id}"
        note.save(update_fields=["title", "body", "opened_at", "route"])
        queue_push(note)


def notify_due_touchpoints(user=None):
    now = timezone.now()
    due = Touchpoint.objects.filter(
        status__in=[Touchpoint.Status.UPCOMING, Touchpoint.Status.SNOOZED],
        due_at__lte=now,
        schedule__status=Schedule.Status.ACTIVE,
        schedule__contact__status=Contact.Status.ACTIVE,
    )
    if user is not None:
        due = due.filter(schedule__contact__user=user)
    due.update(status=Touchpoint.Status.OVERDUE)
    pending = Touchpoint.objects.filter(
        status=Touchpoint.Status.OVERDUE,
        due_at__lte=now,
        schedule__status=Schedule.Status.ACTIVE,
        schedule__contact__status=Contact.Status.ACTIVE,
        notification__isnull=True,
    ).select_related("schedule__contact__user")
    if user is not None:
        pending = pending.filter(schedule__contact__user=user)
    for point in pending:
        contact = point.schedule.contact
        note, _created = SendNotification.objects.get_or_create(
            touchpoint=point,
            defaults={
                "user": contact.user,
                "title": f"Check in with {contact.name}",
                "body": "This check-in is due. Open it when you are ready to reach out.",
                "route": f"/touchpoints/{point.id}",
            },
        )
        if _created:
            queue_push(note)


def notification_payload(note):
    if note.message_id:
        contact = note.message.contact
        channel = note.message.channel
        message_id = str(note.message_id)
        kind = "message"
    else:
        contact = note.touchpoint.schedule.contact
        channel = ""
        message_id = None
        kind = "touchpoint"
    return {
        "id": str(note.id),
        "kind": kind,
        "message_id": message_id,
        "touchpoint_id": str(note.touchpoint_id) if note.touchpoint_id else None,
        "contact_id": str(contact.id),
        "title": note.title,
        "body": note.body,
        "channel": channel,
        "contact_name": contact.name,
        "created_at": note.created_at.isoformat(),
        "opened_at": note.opened_at.isoformat() if note.opened_at else None,
        # exactly what the phone push carries (see push.py)
        "push": push_data(note),
    }