import uuid

from django.db import models

from apps.contacts.models import Contact


class Memory(models.Model):
    class Category(models.TextChoices):
        INTEREST = "interest", "Interest"
        LIFE_EVENT = "life_event", "Life event"
        SHARED_EXPERIENCE = "shared_experience", "Shared experience"
        DISCUSSION = "discussion", "Discussion"
        PLAN = "plan", "Plan"
        PREFERENCE = "preference", "Preference"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="memories")
    content = models.TextField(max_length=4000)
    category = models.CharField(max_length=24, choices=Category.choices, default=Category.OTHER)
    sensitivity = models.CharField(max_length=30, blank=True)
    allow_drafting = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["contact", "allow_drafting"])]
