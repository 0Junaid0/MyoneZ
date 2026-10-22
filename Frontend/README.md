# MyoneZ app (Expo + React Native + TypeScript)

The mobile app for the MyoneZ backend. It lives in its own folder and only talks to the backend over HTTP (`backend/` in this repository). The backend serves no web pages.

## Requirements

- Node.js 20 or 22 LTS and Git
- **Expo Go** on your phone (phone and PC on the same Wi-Fi)

## Run

1. Start the backend (from the repository root):
   ```powershell
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```
2. In `Frontend/`, copy `.env.example` to `.env` and set your PC's Wi-Fi IPv4 address (`ipconfig`):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.0.104:8000
   ```
3. Install and start:
   ```powershell
   cd Frontend
   npm install
   npx expo start -c
   ```
4. Scan the QR code with Expo Go (or press `w` for the browser; browser tokens live only in memory, so a reload logs you out).

## Log in / sign up

Both are two steps: email + password, then a 6-digit code from email. With the console email backend (`EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in the root `.env`) the code is printed in the backend terminal and shown on the code screen. Passwords need 10+ characters.

## How the app connects (backend rules)

| Backend rule | Where in the app |
|---|---|
| Base path `/api/v1/` | `src/api/client.ts` |
| Bearer token; header `X-Client: mobile` makes the API return `access` and `refresh` in the JSON body | `src/api/client.ts`, `src/api/authApi.ts` |
| Two-step sign in | `src/store/auth.ts`, `src/pages/VerifyOtp.tsx` |
| Paginated lists (25 per page) | `fetchAll()` in `src/api/client.ts` |
| Errors are `{ "error": { "detail": ... } }` | `getErrorMessage()` in `src/api/client.ts` |
| Contacts, memories, history, rhythm | `src/api/contactsApi.ts` |
| Drafts and sending (`approve`, `mark-sent`, check-in log) | `src/api/draftsReal.ts`, `src/api/messagesApi.ts` |
| Home, Schedule, Notifications | `src/api/homeApi.ts`, `scheduleApi.ts`, `notificationsApi.ts` |

Settings (default channel, tone, notifications) are stored on the phone: the backend has no settings endpoint.

To use sample data without a backend, set a flag to `true`: `USE_MOCK_AUTH` (`src/api/authApi.ts`), `USE_MOCK_HOME` (`src/api/homeApi.ts`), `USE_MOCK_DRAFTS` (`src/api/drafts.ts`).

## Common problems

| Problem | Fix |
|---|---|
| `Unable to resolve "<package>"` | `npx expo install <package>`, then `npx expo start -c` |
| `Can't reach the server` | check the IP in `.env`, run the backend with `runserver 0.0.0.0:8000`, same Wi-Fi, allow port 8000 in the firewall |
| Changed `.env` but nothing changed | `npx expo start -c` |
| CORS error in the browser | restart the backend (development allows all origins) |
| QR scan keeps loading | allow Node in Windows Firewall, or `npx expo start --tunnel` |
| No push notifications | not supported yet by the backend; in-app notifications work |
