# MyoneZ

API-first personal relationship manager built with Django, PostgreSQL, Redis, and Celery.

This repository has the API, the browser app, and the phone app:

- `backend/`: the Django API, plus the browser app at http://127.0.0.1:8000/
- `Frontend/`: the Expo + React Native app that uses the same API (see "Frontend (mobile app)" below)

## Run it on your computer

You need Python 3.13 or newer, Git, and Docker Desktop. Redis is not required for this path. The app keeps its data in PostgreSQL. Docker publishes that database on port 5433, because a Windows PostgreSQL install often already uses port 5432. The database name, user, and password are `pocketcrm`.

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

Open `.env` and set the mail account so registration and login codes are delivered by email:

- `EMAIL_BACKEND` stays `django.core.mail.backends.smtp.EmailBackend`.
- `EMAIL_HOST` is `smtp.gmail.com`, `EMAIL_PORT` is `587`, and `EMAIL_USE_TLS` is `true`.
- `EMAIL_HOST_USER` is the Gmail address that sends the code.
- `EMAIL_HOST_PASSWORD` is that account's Gmail app password, with the spaces removed.
- `DEFAULT_FROM_EMAIL` is the same Gmail address.

To try the app before mail is configured, set this instead:

```text
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

The 6-digit code is then shown on the sign-in screen and printed in the terminal. With the SMTP settings above, the code is emailed and the screen does not show it.

`OPENAI_API_KEY` can stay empty. Drafts then use a built-in template. To draft with Gemini, set the key from [Google AI Studio](https://aistudio.google.com/apikey) and:

```text
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-3.8-flash
```

The server reads `.env` only when it starts. Restart it after changing these values.

### 4. Start PostgreSQL and create the tables

Docker Desktop must be running. From the project folder:

```bash
docker compose up -d db
cd backend
python manage.py migrate
```

This uses `postgresql://pocketcrm:pocketcrm@127.0.0.1:5433/pocketcrm`. Stop the database later with `docker compose stop db`. That does not delete the data.

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

Stop the server with Ctrl+C. Start it again later with the virtual environment activated and `python manage.py runserver 127.0.0.1:8000` from `backend`. Start PostgreSQL first with `docker compose up -d db` if it is not already running. Your people and messages stay in that database.

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

Docker stores PostgreSQL in the `postgres_data` volume and photos in `media_data`. Redis runs in Compose for the background worker. The local `runserver` path above does not need Redis. Do not run `docker compose down -v`; that deletes the database volume.

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

When `OPENAI_API_KEY` is absent, or Gemini does not answer within 30 seconds, drafting falls back to a deterministic local template. The draft call uses Chat Completions, which is the endpoint Gemini's compatible API accepts.

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

Dump the database and routinely verify that the copy restores:

```bash
docker compose exec db pg_dump -U pocketcrm -d pocketcrm > myonez.sql
```

Before restoring, stop the API and workers, restore into `pocketcrm`, run `python manage.py migrate`, verify counts and representative records, then restart services.
Retention and encryption policies must match the deployment's privacy requirements.

## Hosted API

The preview phone build calls `https://myonez.vercel.app`. That host does not read the `.env` file on your computer. Set the same `EMAIL_*`, `DEFAULT_FROM_EMAIL`, `OPENAI_*`, and `DJANGO_SECRET_KEY` values in the Vercel project, then redeploy. Until the mail variables are set there, the phone shows the 6-digit code on screen instead of emailing it.

Vercel has no durable disk. With `DATABASE_URL` set there, uploads live in temporary storage. Docker keeps photos in the `media_data` volume.

`backend/requirements.txt` is the dependency list the Vercel Python build installs. `pyproject.toml` stays in the repository because local tests and Ruff read it.

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

Push notifications need a real phone and the Expo project already named in `Frontend/app.json`. A member of that Expo project signs in from `Frontend/` with `npx eas-cli@latest login` (a GitHub login opens the browser; it has no Expo password), then builds a preview APK with:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

The preview profile bakes `EXPO_PUBLIC_API_URL=https://myonez.vercel.app/` into the app. While developing against this computer, run `npx expo start` instead and keep `Frontend/.env` pointed at `http://<your-PC-Wi-Fi-IP>:8000`.

Due check-ins can raise an Android tray notification, including one scheduled to fire after the app is closed. The app asks for notification permission once, when you sign in. The backend sends remote pushes through Expo when `EXPO_PUSH_ENABLED` is `true`.
