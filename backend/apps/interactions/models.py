import uuid

from django.db import models

from apps.contacts.models import Contact
from apps.schedules.models import Touchpoint


class Interaction(models.Model):
    class Kind(models.TextChoices):
        CALL = "call", "Phone call"
        MESSAGE = "message", "Text/message"
        IN_PERSON = "in_person", "In-person meeting"
        VIDEO = "video", "Video call"
        OCCASION = "occasion", "Special occasion"
        CUSTOM = "custom", "Custom"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="interactions")
    touchpoint = models.OneToOneField(
        Touchpoint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_interaction",
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    channel = models.CharField(max_length=30, blank=True)
    notes = models.TextField(max_length=4000, blank=True)
    use_for_drafting = models.BooleanField(default=False)
    occurred_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [models.Index(fields=["contact", "occurred_at"])]
