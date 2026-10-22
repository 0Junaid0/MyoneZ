import uuid

from django.conf import settings
from django.db import models

from apps.contacts.models import Contact
from apps.schedules.models import Touchpoint


class Message(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    class Purpose(models.TextChoices):
        CHECK_IN = "check_in", "Check-in"
        BIRTHDAY = "birthday", "Birthday"
        CONGRATULATIONS = "congratulations", "Congratulations"
        GRATITUDE = "gratitude", "Gratitude"
        RECONNECT = "reconnect", "Reconnect"
        CUSTOM = "custom", "Custom"

    class Tone(models.TextChoices):
        CASUAL = "casual", "Casual"
        FRIENDLY = "friendly", "Friendly"
        WARM = "warm", "Warm"
        PROFESSIONAL = "professional", "Professional"
        CUSTOM = "custom", "Custom"

    class Length(models.TextChoices):
        SHORT = "short", "Short"
        MEDIUM = "medium", "Medium"
        LONG = "long", "Long"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="messages")
    touchpoint = models.ForeignKey(
        Touchpoint, on_delete=models.SET_NULL, null=True, blank=True, related_name="messages"
    )
    purpose = models.CharField(max_length=24, choices=Purpose.choices)
    tone = models.CharField(max_length=20, choices=Tone.choices)
    length = models.CharField(max_length=10, choices=Length.choices)
    custom_instruction = models.TextField(max_length=1000, blank=True)
    body = models.TextField(max_length=10000)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    context_snapshot = models.JSONField(default=dict)
    generator = models.CharField(max_length=50, default="template")
    channel = models.CharField(max_length=20, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["contact", "status"]),
            models.Index(fields=["status", "scheduled_for"], name="messaging_m_status_sched_idx"),
        ]


class DeliveryAttempt(models.Model):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        HANDED_OFF = "handed_off", "Handed off"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="delivery_attempts")
    provider = models.CharField(max_length=30)
    status = models.CharField(max_length=20, choices=Status.choices)
    idempotency_key = models.CharField(max_length=100)
    handoff_url = models.TextField(blank=True)
    error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["message", "idempotency_key"],
                name="unique_delivery_idempotency_per_message",
            )
        ]


class SendNotification(models.Model):
    """A due message or touchpoint the person should open inside the app.

    ``route`` is the in-app path a phone notification should open. Android and
    iOS clients receive the same path through the notification payload.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="send_notifications"
    )
    message = models.OneToOneField(
        Message, on_delete=models.CASCADE, null=True, blank=True, related_name="notification"
    )
    touchpoint = models.OneToOneField(
        Touchpoint, on_delete=models.CASCADE, null=True, blank=True, related_name="notification"
    )
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=240)
    route = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(message__isnull=False, touchpoint__isnull=True)
                    | models.Q(message__isnull=True, touchpoint__isnull=False)
                ),
                name="notification_has_one_subject",
            )
        ]
