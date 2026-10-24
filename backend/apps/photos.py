from pathlib import Path

from rest_framework import serializers

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024


def _stored_name(folder, instance, filename):
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        suffix = ".jpg"
    return f"{folder}/{instance.pk}{suffix}"


def profile_photo_path(instance, filename):
    return _stored_name("profiles", instance, filename)


def contact_photo_path(instance, filename):
    return _stored_name("contacts", instance, filename)


def validate_photo(value):
    if not value:
        return value
    if value.size > MAX_PHOTO_BYTES:
        raise serializers.ValidationError("Photo must be 5 MB or smaller.")
    suffix = Path(getattr(value, "name", "") or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise serializers.ValidationError("Use a JPEG, PNG, or WebP image.")
    content_type = getattr(value, "content_type", "") or ""
    if content_type and content_type not in ALLOWED_TYPES:
        raise serializers.ValidationError("Use a JPEG, PNG, or WebP image.")
    return value


class PhotoSerializerMixin:
    """Accepts a photo upload and returns an absolute URL the phone can load."""

    def validate_photo(self, value):
        return validate_photo(value)

    def update(self, instance, validated_data):
        new_photo = validated_data.get("photo")
        if new_photo and getattr(instance, "photo", None):
            instance.photo.delete(save=False)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        photo = data.get("photo")
        request = self.context.get("request")
        if photo and request and not str(photo).startswith(("http://", "https://")):
            data["photo"] = request.build_absolute_uri(photo)
        elif not photo:
            data["photo"] = None
        return data
