import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailOTP, User

OTP_TTL = timedelta(minutes=10)
OTP_ATTEMPTS = 5


def hash_code(code):
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


def issue_otp(*, email, purpose, user=None, name="", password="", timezone_name="UTC"):
    email = User.objects.normalize_email(email)
    now = timezone.now()
    EmailOTP.objects.filter(email__iexact=email, purpose=purpose, used_at__isnull=True).update(
        used_at=now
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = EmailOTP.objects.create(
        email=email,
        purpose=purpose,
        code_hash=hash_code(code),
        expires_at=now + OTP_TTL,
        user=user,
        name=name,
        password_hash=make_password(password) if password else "",
        timezone=timezone_name or "UTC",
    )
    try:
        send_mail(
            "Your MyoneZ code",
            f"Your MyoneZ verification code is {code}. It expires in 10 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
    except Exception as exc:
        challenge.delete()
        text = str(exc).lower()
        if "535" in text or "authentication" in text or "username" in text:
            raise ValueError(
                "Gmail rejected the sending account. Check the app password."
            ) from exc
        raise ValueError("Could not send the verification email.") from exc
    return challenge, code


def otp_payload(challenge, code):
    payload = {
        "otp_required": True,
        "challenge_id": str(challenge.id),
        "detail": f"We sent a 6-digit code to {challenge.email}. It expires in 10 minutes.",
    }
    if settings.EMAIL_BACKEND.endswith("console.EmailBackend"):
        payload["debug_code"] = code
    return payload
