from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers

from .models import EmailAccount, User


def validate_timezone(value):
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise serializers.ValidationError("Unknown IANA timezone.") from exc
    return value


class UserSerializer(serializers.ModelSerializer):
    timezone = serializers.CharField(validators=[validate_timezone])

    class Meta:
        model = User
        fields = ["id", "email", "name", "timezone", "date_joined"]
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
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=10)


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
