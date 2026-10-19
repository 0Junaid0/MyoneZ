from celery import shared_task

from .delivery import dispatch_due_messages


@shared_task
def dispatch_scheduled_messages():
    return len(dispatch_due_messages())
