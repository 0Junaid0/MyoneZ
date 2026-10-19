import os
from pathlib import Path


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
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}
JWT_COOKIE_SECURE = False
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}
