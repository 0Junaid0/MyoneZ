import os
import sys

from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.messaging"

    def ready(self):
        if os.environ.get("RUN_MAIN") != "true" or "runserver" not in sys.argv:
            return
        from .scheduler import start_scheduler

        start_scheduler()
