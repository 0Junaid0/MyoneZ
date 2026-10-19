# MyoneZ

API-first personal relationship manager built with Django, PostgreSQL, Redis, and Celery.

## Run locally with Docker

```bash
cp .env.example .env
docker compose up --build
```

- API: `http://localhost:8000/api/v1/`
- Web app: `http://localhost:8000/`
- Swagger: `http://localhost:8000/api/docs/`
- OpenAPI schema: `http://localhost:8000/api/schema/`
- Health check: `http://localhost:8000/health/`

Create demo data:

```bash
docker compose exec api python manage.py seed_demo
```

The demo login is `demo@example.com` / `Demo-password-123`.

## Authentication

Registration and login set short-lived access and rotating refresh JWTs in HttpOnly cookies.
Cookie-authenticated unsafe requests require Django's `X-CSRFToken` header. API clients may
instead send an access JWT as `Authorization: Bearer <token>`. Production cookies are Secure;
set `JWT_COOKIE_SECURE=false` only for local HTTP development.

## Core workflow

1. Register and create a contact.
2. Add memories, explicitly opting individual memories into drafting.
3. Record interactions and configure a fixed or randomized schedule.
4. Review `/touchpoints/upcoming/`.
5. Generate, edit, and approve a message.
6. POST to `/messages/{id}/send/` with a unique `Idempotency-Key` header.
7. Open the returned WhatsApp URL. The system records a handoff, not a delivery receipt.
8. Record the interaction with its `touchpoint`; this completes it and schedules the next one.

When `OPENAI_API_KEY` is absent or the configured OpenAI-compatible provider is unavailable,
drafting falls back to a deterministic local template.

## Quality checks

```bash
docker compose run --rm api ruff check .
docker compose run --rm api pytest --cov
docker compose run --rm api python manage.py spectacular --validate --file openapi.yml
```

## Production operations

- Terminate TLS at a trusted reverse proxy and enable `SECURE_SSL_REDIRECT=true`.
- Store secrets in the deployment platform, never in `.env` committed to source control.
- Scale `api` and `worker` independently. Run exactly one Beat scheduler.
- Monitor HTTP errors, Celery failures/latency, queue depth, PostgreSQL, Redis, and disk usage.
- Do not log message bodies, prompts, memories, authorization headers, or cookies.

### Backup and restore

Schedule encrypted PostgreSQL backups and routinely verify restoration:

```bash
docker compose exec -T db pg_dump -U pocketcrm -Fc pocketcrm > pocketcrm.dump
docker compose exec -T db pg_restore -U pocketcrm -d pocketcrm --clean --if-exists < pocketcrm.dump
```

Before restoring production data, stop API/workers, restore into a clean database, run
`python manage.py migrate`, verify counts and representative records, then restart services.
Retention and encryption policies must match the deployment's privacy requirements.
