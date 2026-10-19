import secrets
from datetime import UTC, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from .models import Schedule, Touchpoint


def _choose_interval(schedule):
    if schedule.mode == Schedule.Mode.FIXED:
        return schedule.interval_min_days
    return secrets.SystemRandom().randint(schedule.interval_min_days, schedule.interval_max_days)


@transaction.atomic
def create_next_touchpoint(schedule_id, base_at=None, idempotency_key=None):
    schedule = (
        Schedule.objects.select_for_update().select_related("contact__user").get(pk=schedule_id)
    )
    if schedule.status != Schedule.Status.ACTIVE:
        return None
    active = schedule.touchpoints.filter(status__in=Touchpoint.ACTIVE_STATUSES).first()
    if active:
        return active
    if idempotency_key:
        existing = Touchpoint.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing
    interval = _choose_interval(schedule)
    base = base_at or timezone.now()
    zone = ZoneInfo(schedule.contact.timezone or schedule.contact.user.timezone)
    due_at = (base.astimezone(zone) + timedelta(days=interval)).astimezone(UTC)
    point = Touchpoint.objects.create(
        schedule=schedule,
        due_at=due_at,
        selected_interval_days=interval,
        idempotency_key=idempotency_key,
    )
    schedule.next_due_at = due_at
    schedule.save(update_fields=["next_due_at", "updated_at"])
    return point


@transaction.atomic
def reschedule_touchpoint(touchpoint_id, due_at):
    point = Touchpoint.objects.select_for_update().select_related("schedule").get(pk=touchpoint_id)
    if point.status not in Touchpoint.ACTIVE_STATUSES:
        raise ValueError("Only an upcoming check-in can be moved.")
    if due_at <= timezone.now():
        raise ValueError("Choose a future time.")
    point.due_at = due_at
    point.status = Touchpoint.Status.UPCOMING
    point.save(update_fields=["due_at", "status", "updated_at"])
    point.schedule.next_due_at = due_at
    point.schedule.save(update_fields=["next_due_at", "updated_at"])
    _clear_touchpoint_notification(point.id)
    return point


@transaction.atomic
def transition_touchpoint(touchpoint_id, new_status, due_at=None):
    point = Touchpoint.objects.select_for_update().select_related("schedule").get(pk=touchpoint_id)
    if point.status not in Touchpoint.ACTIVE_STATUSES:
        raise ValueError("Only active touchpoints can transition.")
    now = timezone.now()
    if new_status == Touchpoint.Status.SNOOZED:
        if not due_at or due_at <= now:
            raise ValueError("A future due_at is required when snoozing.")
        point.due_at = due_at
        point.status = new_status
        point.save(update_fields=["due_at", "status", "updated_at"])
        point.schedule.next_due_at = due_at
        point.schedule.save(update_fields=["next_due_at", "updated_at"])
        _clear_touchpoint_notification(point.id)
        return point
    if new_status not in {Touchpoint.Status.COMPLETED, Touchpoint.Status.SKIPPED}:
        raise ValueError("Unsupported transition.")
    point.status = new_status
    point.completed_at = now
    point.save(update_fields=["status", "completed_at", "updated_at"])
    point.schedule.next_due_at = None
    point.schedule.save(update_fields=["next_due_at", "updated_at"])
    _clear_touchpoint_notification(point.id)
    create_next_touchpoint(
        point.schedule_id,
        base_at=now,
        idempotency_key=f"after:{point.id}",
    )
    return point


@transaction.atomic
def set_schedule_status(schedule_id, status):
    schedule = Schedule.objects.select_for_update().get(pk=schedule_id)
    schedule.status = status
    schedule.save(update_fields=["status", "updated_at"])
    if status == Schedule.Status.PAUSED:
        active_ids = list(
            schedule.touchpoints.filter(status__in=Touchpoint.ACTIVE_STATUSES).values_list(
                "id", flat=True
            )
        )
        schedule.touchpoints.filter(status__in=Touchpoint.ACTIVE_STATUSES).update(
            status=Touchpoint.Status.CANCELLED
        )
        for point_id in active_ids:
            _clear_touchpoint_notification(point_id)
        schedule.next_due_at = None
        schedule.save(update_fields=["next_due_at", "updated_at"])
    else:
        create_next_touchpoint(
            schedule.id,
            idempotency_key=f"resume:{schedule.id}:{schedule.updated_at.isoformat()}",
        )
    return schedule


def _clear_touchpoint_notification(touchpoint_id):
    from apps.messaging.models import SendNotification

    SendNotification.objects.filter(touchpoint_id=touchpoint_id).delete()
