from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import Schedule, Touchpoint
from .services import create_next_touchpoint


@shared_task
def materialize_due_touchpoints():
    now = timezone.now()
    Touchpoint.objects.filter(
        status__in=[Touchpoint.Status.UPCOMING, Touchpoint.Status.SNOOZED],
        due_at__lt=now,
    ).update(status=Touchpoint.Status.OVERDUE)
    schedule_ids = Schedule.objects.filter(
        status=Schedule.Status.ACTIVE,
        next_due_at__isnull=True,
    ).values_list("id", flat=True)
    created = 0
    for schedule_id in schedule_ids.iterator():
        with transaction.atomic():
            point = create_next_touchpoint(
                schedule_id,
                idempotency_key=f"repair:{schedule_id}:{now.date()}",
            )
            created += int(point is not None)
    return created
