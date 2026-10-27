import os
from pathlib import Path

import dj_database_url

from .base import *  # noqa: F403

# Vercel can boot without a secret so the first deploy is visible. Docker and
# any other production host must set DJANGO_SECRET_KEY.
SECRET_KEY = (
    os.environ.get("DJANGO_SECRET_KEY", "fallback-prod-secret-change-in-vercel")
    if os.getenv("VERCEL")
    else os.environ["DJANGO_SECRET_KEY"]
)

# Allow all *.vercel.app domains plus any custom domains in DJANGO_ALLOWED_HOSTS
ALLOWED_HOSTS = [
    ".vercel.app",
    *[h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost").split(",") if h.strip()],
]

CSRF_TRUSTED_ORIGINS = [
    "https://*.vercel.app",
    *[o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()],
]

# Use Cloud PostgreSQL (DATABASE_URL) on Vercel, or fallback to SQLite if not set.
# Local Docker Postgres has no TLS, so compose sets DATABASE_SSL_REQUIRE=false.
if os.getenv("DATABASE_URL"):
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ["DATABASE_URL"],
            conn_max_age=600,
            ssl_require=os.getenv("DATABASE_SSL_REQUIRE", "true").lower() == "true",
        )
    }
else:
    _sqlite_path = os.getenv("SQLITE_PATH", "").strip()
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": Path(_sqlite_path) if _sqlite_path else BASE_DIR / "db.sqlite3",  # noqa: F405
            "OPTIONS": {"timeout": 20},
        }
    }
    # Docker keeps photos beside the database file. Vercel has no durable disk.
    MEDIA_ROOT = Path(_sqlite_path).parent / "media" if _sqlite_path else Path("/tmp/media")

# Serve static files directly via WhiteNoise without requiring a separate manifest build step
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}
WHITENOISE_USE_FINDERS = True

# Run Celery tasks synchronously inside the request if no external Redis server is provided
if not os.getenv("REDIS_URL"):
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True

if os.getenv("DATABASE_URL"):
    # Cloud Postgres on Vercel has no durable disk for uploads.
    MEDIA_ROOT = (
        Path("/tmp/media") if os.getenv("VERCEL") else Path(os.getenv("MEDIA_ROOT", "/data/media"))
    )

SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "true").lower() == "true"
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SESSION_COOKIE_SECURE = JWT_COOKIE_SECURE  # noqa: F405
CSRF_COOKIE_SECURE = JWT_COOKIE_SECURE  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
