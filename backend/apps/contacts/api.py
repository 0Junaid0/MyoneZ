from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Contact, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        if (
            Tag.objects.filter(user=self.context["request"].user, name__iexact=value.strip())
            .exclude(pk=self.instance.pk if self.instance else None)
            .exists()
        ):
            raise serializers.ValidationError("A tag with this name already exists.")
        return value.strip()


class ContactSerializer(serializers.ModelSerializer):
    tag_ids = serializers.PrimaryKeyRelatedField(
        source="tags", many=True, queryset=Tag.objects.none(), required=False
    )
    tags = TagSerializer(many=True, read_only=True)
    schedule = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "whatsapp",
            "telegram",
            "messenger",
            "relationship",
            "tag_ids",
            "tags",
            "birthday",
            "timezone",
            "preferred_channel",
            "status",
            "last_contacted_at",
            "schedule",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "last_contacted_at", "created_at", "updated_at"]

    def get_schedule(self, obj):
        schedule = getattr(obj, "schedule", None)
        if schedule is None:
            return None
        return {
            "id": str(schedule.id),
            "mode": schedule.mode,
            "interval_min_days": schedule.interval_min_days,
            "interval_max_days": schedule.interval_max_days,
            "next_due_at": schedule.next_due_at,
            "status": schedule.status,
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            # tag_ids is many=True: the real queryset lives on the child relation,
            # setting it on the ManyRelatedField itself is ignored (every pk "does not exist")
            self.fields["tag_ids"].child_relation.queryset = Tag.objects.filter(user=request.user)

    def validate_timezone(self, value):
        if value:
            try:
                ZoneInfo(value)
            except ZoneInfoNotFoundError as exc:
                raise serializers.ValidationError("Unknown IANA timezone.") from exc
        return value

    def validate(self, attrs):
        if not any(
            [
                attrs.get("email", getattr(self.instance, "email", "")),
                attrs.get("phone", getattr(self.instance, "phone", "")),
                attrs.get("whatsapp", getattr(self.instance, "whatsapp", "")),
                attrs.get("telegram", getattr(self.instance, "telegram", "")),
                attrs.get("messenger", getattr(self.instance, "messenger", "")),
            ]
        ):
            raise serializers.ValidationError("Provide at least one contact method.")
        return attrs


class OwnedViewSet(viewsets.ModelViewSet):
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TagViewSet(OwnedViewSet):
    serializer_class = TagSerializer
    queryset = Tag.objects.none()
    search_fields = ["name"]
    ordering_fields = ["name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return Tag.objects.filter(user=self.request.user)


class ContactViewSet(OwnedViewSet):
    serializer_class = ContactSerializer
    queryset = Contact.objects.none()
    filterset_fields = ["relationship", "status", "tags"]
    search_fields = ["name", "email", "phone", "whatsapp", "telegram", "messenger"]
    ordering_fields = ["name", "created_at", "updated_at", "last_contacted_at", "birthday"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        queryset = (
            Contact.objects.filter(user=self.request.user)
            .select_related("schedule")
            .prefetch_related("tags")
        )
        activity = self.request.query_params.get("activity")
        if activity == "contacted":
            queryset = queryset.filter(last_contacted_at__isnull=False)
        elif activity == "never":
            queryset = queryset.filter(last_contacted_at__isnull=True)
        query = self.request.query_params.get("q")
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(email__icontains=query))
        return queryset.distinct()

    def perform_destroy(self, instance):
        permanent = self.request.query_params.get("permanent") == "true"
        if permanent:
            instance.delete()
        else:
            instance.status = Contact.Status.ARCHIVED
            instance.save(update_fields=["status", "updated_at"])
            self._pause_schedule(instance)

    def perform_update(self, serializer):
        contact = serializer.save()
        if contact.status != Contact.Status.ACTIVE:
            self._pause_schedule(contact)

    @staticmethod
    def _pause_schedule(contact):
        if hasattr(contact, "schedule"):
            from apps.schedules.models import Schedule
            from apps.schedules.services import set_schedule_status

            set_schedule_status(contact.schedule.id, Schedule.Status.PAUSED)

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        contact = self.get_object()
        items = []
        items += [
            {"kind": "memory", "id": str(x.id), "at": x.created_at, "summary": x.content}
            for x in contact.memories.all()
        ]
        items += [
            {"kind": "interaction", "id": str(x.id), "at": x.occurred_at, "summary": x.notes}
            for x in contact.interactions.all()
        ]
        schedules = [contact.schedule] if hasattr(contact, "schedule") else []
        for schedule in schedules:
            items += [
                {
                    "kind": "touchpoint",
                    "id": str(x.id),
                    "at": x.due_at,
                    "summary": x.status,
                }
                for x in schedule.touchpoints.all()
            ]
        items.sort(key=lambda item: item["at"], reverse=True)
        return Response(items)
