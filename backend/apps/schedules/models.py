import uuid

from django.db import models
from django.db.models import Q

from apps.contacts.models import Contact


class Schedule(models.Model):
    class Mode(models.TextChoices):
        FIXED = "fixed", "Fixed"
        RANDOMIZED = "randomized", "Randomized"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.OneToOneField(Contact, on_delete=models.CASCADE, related_name="schedule")
    mode = models.CharField(max_length=16, choices=Mode.choices)
    interval_min_days = models.PositiveSmallIntegerField()
    interval_max_days = models.PositiveSmallIntegerField()
    next_due_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Touchpoint(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        OVERDUE = "overdue", "Overdue"
        SNOOZED = "snoozed", "Snoozed"
        COMPLETED = "completed", "Completed"
        SKIPPED = "skipped", "Skipped"
        CANCELLED = "cancelled", "Cancelled"

    ACTIVE_STATUSES = [Status.UPCOMING, Status.OVERDUE, Status.SNOOZED]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name="touchpoints")
    due_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPCOMING)
    selected_interval_days = models.PositiveSmallIntegerField()
    idempotency_key = models.CharField(max_length=100, null=True, blank=True, unique=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_at"]
        indexes = [models.Index(fields=["status", "due_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["schedule"],
                condition=Q(status__in=["upcoming", "overdue", "snoozed"]),
                name="one_active_touchpoint_per_schedule",
            )
        ]
