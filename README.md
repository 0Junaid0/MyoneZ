# MyoneZ

API-first personal relationship manager built with Django, SQLite, Redis, and Celery.

This repository has the API, the browser app, and the phone app:

- `backend/`: the Django API, plus the browser app at http://127.0.0.1:8000/
- `Frontend/`: the Expo + React Native app that uses the same API (see "Frontend (mobile app)" below)

## Run it on your computer

You need Python 3.13 or newer. Git must be installed. Redis and Docker are not required for this path. The app keeps its data in `backend/db.sqlite3`, which is created when you migrate. That file is not in Git.

### 1. Clone the repository

```bash
git clone https://github.com/0Junaid0/MyoneZ.git
cd MyoneZ
```

### 2. Create a virtual environment and install dependencies

macOS and Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Windows PowerShell:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks the activate script, run this once in that window and try again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 3. Create the environment file

Git does not contain `.env`, and starting the app does not create it. Copy the example:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set the mail account if you want registration and login codes delivered by email:

- `EMAIL_HOST_USER` is the Gmail address that sends the code.
- `EMAIL_HOST_PASSWORD` is that account's Gmail app password, with the spaces removed.
- `DEFAULT_FROM_EMAIL` is the same Gmail address.

To try the app before mail is configured, set this instead:

```text
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

The 6-digit code is then shown on the sign-in screen and printed in the terminal. `OPENAI_API_KEY` can stay empty. Drafts use a built-in template until a key is added.

### 4. Create the database

From the `backend` folder:

```bash
cd backend
python manage.py migrate
```

This creates `backend/db.sqlite3`.

### 5. Optional: load the demo person

```bash
python manage.py seed_demo
```

The demo account is `demo@example.com` / `Demo-password-123`. You can skip this and register your own account in the browser, the phone app, or the API.

### 6. Start the server

Still inside `backend`:

```bash
python manage.py runserver 127.0.0.1:8000
```

Leave that window open. Open http://127.0.0.1:8000/ in a browser.

- Web app: http://127.0.0.1:8000/
- API: http://127.0.0.1:8000/api/v1/
- Swagger: http://127.0.0.1:8000/api/docs/
- OpenAPI schema: http://127.0.0.1:8000/api/schema/
- Health check: http://127.0.0.1:8000/health/

Register or sign in. If mail is configured, enter the 6-digit code from the email. With the console email backend, the code is shown on the sign-in screen and printed in the terminal. The code expires in 10 minutes. After that, add a person, save memories, and check the ones that should be used in drafts and shown as the reason for a touchpoint.

Stop the server with Ctrl+C. Start it again later with the virtual environment activated and `python manage.py runserver 127.0.0.1:8000` from `backend`. Your people and messages stay in `backend/db.sqlite3`.

## Run it with Docker

Docker Desktop must be running. From the project folder:

```bash
cp .env.example .env
docker compose up --build
```

The web app and API are on port 8000. Create the demo account with:

```bash
docker compose exec api python manage.py seed_demo
```

Docker stores the database in a volume at `/data/db.sqlite3`. Redis runs in Compose for the background worker. The local `runserver` path above does not need Redis.

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
- Monitor HTTP errors, Celery failures/latency, queue depth, Redis, and disk usage.
- Do not log message bodies, prompts, memories, authorization headers, or cookies.

### Backup and restore

Copy the SQLite file and routinely verify that the copy opens:

```bash
docker compose cp api:/data/db.sqlite3 ./myonez.sqlite3
```

Local development stores the same data at `backend/db.sqlite3`. Before restoring, stop the
API and workers, replace the database file, run `python manage.py migrate`, verify counts
and representative records, then restart services.
Retention and encryption policies must match the deployment's privacy requirements.

## Frontend (mobile app)

`Frontend/` is an Expo + React Native app. It talks to the same API as the browser app. What the backend requires from a client:

| Backend rule | What the app does |
|---|---|
| Base path `/api/v1/` | `EXPO_PUBLIC_API_URL` + `/api/v1` (`Frontend/src/api/client.ts`) |
| Two-step sign in: password, then the 6-digit email code | `login`/`register` then `verify-otp` (`Frontend/src/pages/VerifyOtp.tsx`) |
| JWT cookies for browsers, `Authorization: Bearer <access>` for API clients | Sends the Bearer token; the header `X-Client: mobile` makes the API return `access` and `refresh` in the JSON body and accept `refresh` in the body |
| Lists are paginated (25 per page) | `fetchAll()` follows `next` |
| Errors look like `{ "error": { "detail": ... } }` | `getErrorMessage()` unwraps them |
| `POST /messages/{id}/send/` needs an `Idempotency-Key` header | The app opens WhatsApp / SMS / Telegram itself and uses `approve` + `mark-sent` instead |
| Log out revokes the session: `POST /auth/logout/` with `refresh` (and `device_token`) in the body | Settings → Log out calls it, then clears SecureStore (`Frontend/src/store/auth.ts`) |
| Forgot password is a 6-digit code: `POST /auth/password-reset/` then `/auth/password-reset/confirm/` with `challenge_id`, `code`, `new_password` | Two-step Forgot password screen (`Frontend/src/pages/ForgotPassword.tsx`) |
| Push: `POST /devices/` saves the phone's Expo push token; each new notification is pushed with `data.type` `reminder` (+ `draft_id`) or `check_in` (+ `contact_id`) | Home registers the token; tapping a push opens Review draft or the contact (`Frontend/src/notifications/`) |
| Browsers need CORS | Development allows every origin. In production set `CORS_ALLOWED_ORIGINS=https://your-frontend` |

Run both:

1. Backend: `cd backend`, then `python manage.py runserver 0.0.0.0:8000`.
2. App: `cd Frontend`, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL=http://<your-PC-Wi-Fi-IP>:8000`, then `npm install` and `npx expo start -c`.

Settings (default channel, tone, notifications) are stored on the phone because the API has no settings endpoint.

Push notifications need a real phone and an Expo project id: run `npx eas-cli@latest init` once in `Frontend/` so `app.json` gets `extra.eas.projectId`. The backend sends pushes through Expo (`EXPO_PUSH_ENABLED=true` by default; set it to `false` to turn them off).
