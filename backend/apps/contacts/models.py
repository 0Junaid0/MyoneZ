import uuid

from django.conf import settings
from django.db import models

from apps.photos import contact_photo_path


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=50)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_tag_name_per_user")
        ]
        ordering = ["name"]


class Contact(models.Model):
    class Relationship(models.TextChoices):
        FRIEND = "friend", "Friend"
        FAMILY = "family", "Family"
        COLLEAGUE = "colleague", "Colleague"
        MENTOR = "mentor", "Mentor"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        ARCHIVED = "archived", "Archived"

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        PHONE = "phone", "Phone"
        WHATSAPP = "whatsapp", "WhatsApp"
        TELEGRAM = "telegram", "Telegram"
        MESSENGER = "messenger", "Messenger"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="contacts"
    )
    name = models.CharField(max_length=150)
    photo = models.FileField(upload_to=contact_photo_path, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    whatsapp = models.CharField(max_length=32, blank=True)
    telegram = models.CharField(max_length=64, blank=True)
    messenger = models.CharField(max_length=64, blank=True)
    relationship = models.CharField(max_length=20, choices=Relationship.choices)
    tags = models.ManyToManyField(Tag, blank=True, related_name="contacts")
    birthday = models.DateField(null=True, blank=True)
    timezone = models.CharField(max_length=64, blank=True)
    preferred_channel = models.CharField(max_length=20, choices=Channel.choices, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    last_contacted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "last_contacted_at"]),
        ]

    def __str__(self):
        return self.name
