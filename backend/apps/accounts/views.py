import hmac

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from apps.integrations.email import mail_connection_for

from .authentication import enforce_csrf
from .models import EmailAccount, EmailOTP, User
from .otp import OTP_ATTEMPTS, hash_code, issue_otp, otp_payload
from .serializers import (
    EmailAccountSerializer,
    EmptySerializer,
    LoginSerializer,
    OtpVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)


def hmac_matches(stored_hash, code):
    return hmac.compare_digest(hash_code(code), stored_hash)


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


def _set_tokens(response, user):
    refresh = RefreshToken.for_user(user)
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
            challenge = (
                EmailOTP.objects.select_for_update()
                .filter(pk=serializer.validated_data["challenge_id"])
                .first()
            )
            if challenge is None or challenge.used_at is not None:
                return Response({"detail": "Request a new code."}, status=400)
            if challenge.expires_at <= timezone.now() or challenge.attempts >= OTP_ATTEMPTS:
                challenge.used_at = timezone.now()
                challenge.save(update_fields=["used_at"])
                return Response({"detail": "That code expired. Request a new one."}, status=400)
            if not hmac_matches(challenge.code_hash, serializer.validated_data["code"]):
                challenge.attempts += 1
                if challenge.attempts >= OTP_ATTEMPTS:
                    challenge.used_at = timezone.now()
                challenge.save(update_fields=["attempts", "used_at"])
                return Response({"detail": "That code is incorrect."}, status=400)
            challenge.used_at = timezone.now()
            challenge.save(update_fields=["used_at"])
            user = _user_for_challenge(challenge)
        if isinstance(user, Response):
            return user
        get_token(request)
        created = challenge.purpose == EmailOTP.Purpose.REGISTER
        return _set_tokens(
            Response(UserSerializer(user).data, status=201 if created else 200),
            user,
        )


class RefreshView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []
    serializer_class = EmptySerializer

    def post(self, request):
        enforce_csrf(request)
        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not raw:
            return Response({"detail": "Refresh cookie required."}, status=401)
        try:
            old = RefreshToken(raw)
            user = User.objects.get(id=old["user_id"], is_active=True)
            old.blacklist()
        except (TokenError, User.DoesNotExist):
            return Response({"detail": "Invalid refresh token."}, status=401)
        return _set_tokens(Response(status=204), user)


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = EmptySerializer

    def post(self, request):
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
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"]).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            send_mail(
                "MyoneZ password reset",
                f"Use uid={uid} and token={token} to reset your password.",
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
            )
        return Response(status=204)


class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "auth"
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(
                pk=force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            )
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Invalid reset link."}, status=400)
        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "Invalid reset link."}, status=400)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response(status=204)
