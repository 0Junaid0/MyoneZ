import logging
import threading
import time

from django.db import close_old_connections

logger = logging.getLogger(__name__)
_started = False


def start_scheduler():
    global _started
    if _started:
        return
    _started = True
    threading.Thread(target=_loop, name="message-scheduler", daemon=True).start()


def _loop():
    while True:
        close_old_connections()
        try:
            from .delivery import dispatch_due_messages

            dispatch_due_messages()
        except Exception:
            logger.exception("Scheduled message dispatch failed")
        time.sleep(10)
