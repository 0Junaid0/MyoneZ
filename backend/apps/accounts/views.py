import hmac
import uuid

from django.conf import settings
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from apps.integrations.email import mail_connection_for

from .authentication import enforce_csrf
from .models import Device, EmailAccount, EmailOTP, User
from .otp import OTP_ATTEMPTS, hash_code, issue_otp, otp_payload
from .serializers import (
    DeviceDeleteSerializer,
    DeviceSerializer,
    EmailAccountSerializer,
    EmptySerializer,
    LoginSerializer,
    LogoutSerializer,
    OtpVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)


def hmac_matches(stored_hash, code):
    return hmac.compare_digest(hash_code(code), stored_hash)


def _consume_challenge(challenge_id, code, purposes):
    """Checks a 6-digit code. Returns (challenge, None) when it is right, else (None, Response).

    Must run inside transaction.atomic(): the challenge row is locked while it is checked.
    """
    challenge = (
        EmailOTP.objects.select_for_update()
        .filter(pk=challenge_id, purpose__in=purposes)
        .first()
    )
    if challenge is None or challenge.used_at is not None:
        return None, Response({"detail": "Request a new code."}, status=400)
    if challenge.expires_at <= timezone.now() or challenge.attempts >= OTP_ATTEMPTS:
        challenge.used_at = timezone.now()
        challenge.save(update_fields=["used_at"])
        return None, Response({"detail": "That code expired. Request a new one."}, status=400)
    if not hmac_matches(challenge.code_hash, code):
        challenge.attempts += 1
        if challenge.attempts >= OTP_ATTEMPTS:
            challenge.used_at = timezone.now()
        challenge.save(update_fields=["attempts", "used_at"])
        return None, Response({"detail": "That code is incorrect."}, status=400)
    challenge.used_at = timezone.now()
    challenge.save(update_fields=["used_at"])
    return challenge, None


def _user_for_challenge(challenge):
    if challenge.purpose == EmailOTP.Purpose.LOGIN:
        user = challenge.user
        if user is None or not user.is_active:
            return Response({"detail": "Request a new code."}, status=400)
        return user
    if User.objects.filter(email__iexact=challenge.email).exists():
        return Response({"detail": "An account with this email already exists."}, status=400)
    user = User(
        email=User.objects.normalize_email(challenge.email),
        name=challenge.name,
        timezone=challenge.timezone,
        password=challenge.password_hash,
    )
    user.save()
    return user


def _is_mobile(request):
    return request.headers.get("X-Client") == "mobile"


def _set_tokens(response, user, body_tokens=False):
    refresh = RefreshToken.for_user(user)
    if body_tokens:
        # Mobile app: it cannot use HttpOnly cookies, so it also gets the tokens in the body.
        data = dict(response.data) if response.data else {}
        data.update(access=str(refresh.access_token), refresh=str(refresh))
        response.data = data
    kwargs = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/",
    }
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE, str(refresh.access_token), max_age=900, **kwargs
    )
    response.set_cookie(settings.JWT_REFRESH_COOKIE, str(refresh), max_age=14 * 86400, **kwargs)
    return response


class RegisterView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"
    serializer_class = RegisterSerializer

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if User.objects.filter(email__iexact=data["email"]).exists():
            return Response({"detail": "An account with this email already exists."}, status=400)
        try:
            challenge, code = issue_otp(
                email=data["email"],
                purpose=EmailOTP.Purpose.REGISTER,
                name=data["name"],
                password=data["password"],
                timezone_name=data.get("timezone", "UTC"),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        get_token(request)
        return Response(otp_payload(challenge, code))


class LoginView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        try:
            challenge, code = issue_otp(
                email=user.email, purpose=EmailOTP.Purpose.LOGIN, user=user
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        get_token(request)
        return Response(otp_payload(challenge, code))


class VerifyOTPView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"
    serializer_class = OtpVerifySerializer

    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            # a password-reset code can never be used to log in
            challenge, error = _consume_challenge(
                serializer.validated_data["challenge_id"],
                serializer.validated_data["code"],
                [EmailOTP.Purpose.LOGIN, EmailOTP.Purpose.REGISTER],
            )
            if error:
                return error
            user = _user_for_challenge(challenge)
        if isinstance(user, Response):
            return user
        get_token(request)
        created = challenge.purpose == EmailOTP.Purpose.REGISTER
        return _set_tokens(
            Response(UserSerializer(user).data, status=201 if created else 200),
            user,
            body_tokens=_is_mobile(request),
        )


class RefreshView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []
    serializer_class = EmptySerializer

    def post(self, request):
        mobile = _is_mobile(request)
        if mobile:
            # Mobile sends the refresh token in the body (no cookies, so no CSRF risk).
            raw = request.data.get("refresh")
        else:
            enforce_csrf(request)
            raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not raw:
            return Response({"detail": "Refresh token required."}, status=401)
        try:
            old = RefreshToken(raw)
            user = User.objects.get(id=old["user_id"], is_active=True)
            old.blacklist()
        except (TokenError, User.DoesNotExist):
            return Response({"detail": "Invalid refresh token."}, status=401)
        return _set_tokens(
            Response(status=200 if mobile else 204), user, body_tokens=mobile
        )


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = LogoutSerializer

    def post(self, request):
        if _is_mobile(request):
            # Mobile keeps its tokens in SecureStore: it sends the refresh token in the body
            # (no cookies, so no CSRF risk) and the phone's push token so pushes stop.
            raw = request.data.get("refresh")
            device_token = request.data.get("device_token")
            if device_token:
                Device.objects.filter(token=device_token).delete()
        else:
            enforce_csrf(request)
            raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=204)
        response.delete_cookie(settings.JWT_ACCESS_COOKIE)
        response.delete_cookie(settings.JWT_REFRESH_COOKIE)
        return response


class MeView(generics.GenericAPIView):
    serializer_class = UserSerializer

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request):
        request.user.delete()
        response = Response(status=204)
        response.delete_cookie(settings.JWT_ACCESS_COOKIE)
        response.delete_cookie(settings.JWT_REFRESH_COOKIE)
        return response


class EmailAccountView(generics.GenericAPIView):
    serializer_class = EmailAccountSerializer

    def get_object(self):
        account, _ = EmailAccount.objects.get_or_create(
            user=self.request.user,
            defaults={"from_email": self.request.user.email},
        )
        return account

    def get(self, request):
        return Response(self.get_serializer(self.get_object()).data)

    def patch(self, request):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def post(self, request):
        account = self.get_object()
        if not account.host or not account.from_email:
            return Response(
                {"error": {"detail": "Enter the sending address and mail server first."}},
                status=400,
            )
        connection, from_email = mail_connection_for(request.user)
        try:
            send_mail(
                "MyoneZ test",
                "Your sending email is ready.",
                from_email,
                [account.from_email],
                connection=connection,
                fail_silently=False,
            )
        except Exception as exc:
            return Response({"error": {"detail": str(exc)}}, status=400)
        return Response(status=204)


class PasswordResetRequestView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        """Step 1 of reset: emails a 6-digit code (the app has no web page for a link).

        The answer looks the same whether or not the email has an account.
        """
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            try:
                challenge, code = issue_otp(
                    email=user.email, purpose=EmailOTP.Purpose.RESET_PASSWORD, user=user
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)
            payload = otp_payload(challenge, code)
        else:
            payload = {"otp_required": True, "challenge_id": str(uuid.uuid4())}
        payload["detail"] = (
            f"If {email} has an account, we sent a 6-digit code to it. It expires in 10 minutes."
        )
        return Response(payload)


class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        """Step 2 of reset: the emailed code + a new password. Signs out every other session."""
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            challenge, error = _consume_challenge(
                data["challenge_id"], data["code"], [EmailOTP.Purpose.RESET_PASSWORD]
            )
            if error:
                return error
            user = challenge.user
            if user is None or not user.is_active:
                return Response({"detail": "Request a new code."}, status=400)
            try:
                password_validation.validate_password(data["new_password"], user)
            except DjangoValidationError as exc:
                transaction.set_rollback(True)  # keep the code usable for a better password
                return Response({"new_password": list(exc.messages)}, status=400)
            user.set_password(data["new_password"])
            user.save(update_fields=["password"])
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        return Response(status=204)


class DeviceView(generics.GenericAPIView):
    """POST saves this phone's Expo push token for the signed-in user; DELETE removes it."""

    serializer_class = DeviceSerializer

    def post(self, request):
        serializer = DeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Device.objects.update_or_create(
            token=serializer.validated_data["token"],
            defaults={"user": request.user, "platform": serializer.validated_data["platform"]},
        )
        return Response(status=204)

    def delete(self, request):
        serializer = DeviceDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Device.objects.filter(user=request.user, token=serializer.validated_data["token"]).delete()
        return Response(status=204)
