from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers

from apps.photos import PhotoSerializerMixin

from .models import Device, EmailAccount, User


def validate_timezone(value):
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise serializers.ValidationError("Unknown IANA timezone.") from exc
    return value


class UserSerializer(PhotoSerializerMixin, serializers.ModelSerializer):
    timezone = serializers.CharField(validators=[validate_timezone], required=False)
    photo = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["id", "email", "name", "photo", "timezone", "date_joined"]
        read_only_fields = ["id", "email", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=10)
    timezone = serializers.CharField(default="UTC", validators=[validate_timezone])

    class Meta:
        model = User
        fields = ["id", "email", "name", "password", "timezone"]
        read_only_fields = ["id"]

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"],
            password=attrs["password"],
        )
        if not user or not user.is_active:
            raise serializers.ValidationError("Email or password is wrong.")
        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Step 2 of reset: the 6-digit code from the email plus the new password (no web link)."""

    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$")
    new_password = serializers.CharField(min_length=10)


class LogoutSerializer(serializers.Serializer):
    """Mobile sends its refresh token (and push token) in the body; browsers use the cookie."""

    refresh = serializers.CharField(required=False, allow_blank=True)
    device_token = serializers.CharField(required=False, allow_blank=True)


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ["token", "platform"]
        extra_kwargs = {"token": {"validators": []}}  # re-registering the same token updates it

    def validate_token(self, value):
        value = value.strip()
        if not (value.startswith("ExponentPushToken[") or value.startswith("ExpoPushToken[")):
            raise serializers.ValidationError("Not an Expo push token.")
        return value


class DeviceDeleteSerializer(serializers.Serializer):
    token = serializers.CharField()


class OtpVerifySerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$")


class EmptySerializer(serializers.Serializer):
    pass


class EmailAccountSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_set = serializers.SerializerMethodField()

    class Meta:
        model = EmailAccount
        fields = [
            "from_email",
            "host",
            "port",
            "username",
            "password",
            "password_set",
            "security",
        ]
        read_only_fields = ["password_set"]

    def get_password_set(self, obj):
        return bool(obj.password)

    def validate(self, attrs):
        host = attrs.get("host", getattr(self.instance, "host", ""))
        from_email = attrs.get("from_email", getattr(self.instance, "from_email", ""))
        if not host or not from_email:
            raise serializers.ValidationError("Enter the sending address and mail server.")
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if password:
            instance.password = password
        return super().update(instance, validated_data)
