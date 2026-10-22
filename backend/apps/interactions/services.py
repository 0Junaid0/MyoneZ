from django.db import transaction
from django.db.models import Max

from apps.contacts.models import Contact


@transaction.atomic
def recompute_last_contacted(contact_id):
    contact = Contact.objects.select_for_update().get(pk=contact_id)
    latest = contact.interactions.aggregate(latest=Max("occurred_at"))["latest"]
    contact.last_contacted_at = latest
    contact.save(update_fields=["last_contacted_at", "updated_at"])
    return latest
