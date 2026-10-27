import os
from pathlib import Path

import dj_database_url


def _load_dotenv():
    path = Path(__file__).resolve().parents[3] / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


_load_dotenv()

from .base import *  # noqa: E402, F403

# VS Code loads .env into some terminals only. Those processes signed cookies
# with DJANGO_SECRET_KEY while others used the default, so a valid login was
# rejected on the next request. Local development always uses this one key.
SECRET_KEY = "dev-only-pocket-crm-local-signing-key"

DEBUG = True
ALLOWED_HOSTS = ["*"]
# The project database is PostgreSQL in Docker, published on 5433 because
# the Windows PostgreSQL service already listens on 5432.
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv(
            "DATABASE_URL",
            "postgresql://pocketcrm:pocketcrm@127.0.0.1:5433/pocketcrm",
        )
    )
}
JWT_COOKIE_SECURE = False
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}

# Expo web (browser) calls the API from another origin (e.g. http://localhost:8081).
# Phones do not need CORS. Development only.

CORS_ALLOW_ALL_ORIGINS = True
