# ফোনে Expo Go দিয়ে চালানো

PC আর ফোন **একই Wi-Fi**-তে থাকতে হবে।

## ১. Backend (PC-তে)

```bash
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1    macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env          # Windows: Copy-Item .env.example .env
```

`.env`-এ email সেট না করলে এই লাইনটা দাও, তাহলে OTP code অ্যাপের screen-এই দেখাবে:

```text
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

তারপর:

```bash
cd backend
python manage.py migrate
python manage.py seed_demo            # ঐচ্ছিক: demo@example.com / Demo-password-123
python manage.py runserver 0.0.0.0:8000
```

`0.0.0.0` জরুরি, নাহলে ফোন PC-র server খুঁজে পাবে না। Windows Firewall জিজ্ঞেস করলে **Allow** দাও।

## ২. PC-র Wi-Fi IP বের করা

- Windows: `ipconfig` → "IPv4 Address" (যেমন `192.168.0.105`)
- macOS: `ipconfig getifaddr en0`

ফোনের browser-এ `http://<IP>:8000/health/` খুললে `{"status": "ok"}` দেখালে সংযোগ ঠিক আছে।

## ৩. App (PC-তে, আরেকটা terminal)

```bash
cd Frontend
cp .env.example .env          # তারপর .env-এ: EXPO_PUBLIC_API_URL=http://<IP>:8000
npm install
npx expo start -c
```

## ৪. ফোনে

1. **Expo Go (SDK 58)** install করো। Play Store-এর Expo Go এখনো পুরনো SDK-তে থাকলে "Project is incompatible" দেখাবে। তখন Play Store-এরটা uninstall করে ফোনের browser-এ এই অফিসিয়াল APK নামিয়ে install করো (প্রায় 216 MB, "Install unknown apps"-এ Allow দিতে হবে):
   https://github.com/expo/expo-go-releases/releases/download/Expo-Go-58.0.5/Expo-Go-58.0.5.apk
2. Expo Go-তে Expo account দিয়ে login করো (এখন এটা লাগে)।
3. Android: Expo Go দিয়ে QR scan করো। iPhone: Camera দিয়ে QR scan করো।

## জেনে রাখো

- **Push notification Expo Go-তে আসবে না।** এর জন্য development build লাগে (`npx eas-cli@latest init`, তারপর `eas build --profile development`)। অ্যাপের ভেতরের Notifications list ঠিকমতো কাজ করে।
- `.env` বদলালে `npx expo start -c` দিয়ে আবার চালাও (`-c` cache মুছে দেয়)।
- "Can't reach the server" দেখালে IP, একই Wi-Fi, আর firewall চেক করো।
