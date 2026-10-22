from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import SendNotification
from .push import queue_push


@receiver(post_save, sender=SendNotification, dispatch_uid="messaging_push_on_notification")
def push_new_notification(sender, instance, created, update_fields=None, **kwargs):
    # New notification, or an old one raised again ("was not sent" reminder): push it.
    raised_again = update_fields is not None and "title" in update_fields
    if (created or raised_again) and instance.opened_at is None:
        queue_push(instance)
