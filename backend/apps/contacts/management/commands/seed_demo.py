from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.contacts.models import Contact, Tag
from apps.interactions.models import Interaction
from apps.interactions.services import recompute_last_contacted
from apps.memories.models import Memory
from apps.schedules.models import Schedule
from apps.schedules.services import create_next_touchpoint


class Command(BaseCommand):
    help = "Create idempotent MyoneZ demo data."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email="demo@example.com",
            defaults={"name": "Demo User", "timezone": "UTC"},
        )
        if created:
            user.set_password("Demo-password-123")
            user.save(update_fields=["password"])
        tag, _ = Tag.objects.get_or_create(user=user, name="Close friends")
        contact, _ = Contact.objects.get_or_create(
            user=user,
            name="Maya Chen",
            defaults={
                "email": "maya@example.com",
                "whatsapp": "+14155552671",
                "relationship": Contact.Relationship.FRIEND,
            },
        )
        contact.tags.add(tag)
        Memory.objects.get_or_create(
            contact=contact,
            content="Maya enjoys weekend hiking.",
            defaults={"category": "interest", "allow_drafting": True},
        )
        Interaction.objects.get_or_create(
            contact=contact,
            kind="message",
            notes="Caught up about work.",
            defaults={"occurred_at": timezone.now(), "use_for_drafting": True},
        )
        recompute_last_contacted(contact.id)
        schedule, _ = Schedule.objects.get_or_create(
            contact=contact,
            defaults={
                "mode": Schedule.Mode.FIXED,
                "interval_min_days": 30,
                "interval_max_days": 30,
            },
        )
        create_next_touchpoint(schedule.id, idempotency_key=f"seed:{schedule.id}")
        self.stdout.write(self.style.SUCCESS("Demo data is ready."))
