import os
from pathlib import Path

from .base import *  # noqa: F403

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
_sqlite_path = os.getenv("SQLITE_PATH", "").strip()
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(_sqlite_path) if _sqlite_path else BASE_DIR / "db.sqlite3",  # noqa: F405
        "OPTIONS": {"timeout": 20},
    }
}
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "true").lower() == "true"
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SESSION_COOKIE_SECURE = JWT_COOKIE_SECURE  # noqa: F405
CSRF_COOKIE_SECURE = JWT_COOKIE_SECURE  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
