from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contacts.models import Contact
from apps.integrations.handoff import build_message_handoff, build_send_sheet
from apps.schedules.models import Touchpoint

from .delivery import (
    dispatch_message,
    notification_payload,
    release_due_messages,
    schedule_approval,
)
from .models import DeliveryAttempt, Message, SendNotification
from .services import generate_draft


class DeliveryAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryAttempt
        fields = ["id", "provider", "status", "error", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    delivery_attempts = DeliveryAttemptSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "contact",
            "touchpoint",
            "purpose",
            "tone",
            "length",
            "custom_instruction",
            "body",
            "status",
            "channel",
            "scheduled_for",
            "context_snapshot",
            "generator",
            "approved_at",
            "handoff_url",
            "delivery_attempts",
            "contact_info",
            "touchpoint_due_at",
            "created_at",
            "updated_at",
            "send_in",
            "send_unit",
        ]
        read_only_fields = [
            "id",
            "scheduled_for",
            "context_snapshot",
            "generator",
            "approved_at",
            "handoff_url",
            "delivery_attempts",
            "created_at",
            "updated_at",
        ]

    handoff_url = serializers.SerializerMethodField()
    contact_info = serializers.SerializerMethodField()
    touchpoint_due_at = serializers.SerializerMethodField()
    send_in = serializers.IntegerField(
        min_value=1, max_value=36500, required=False, write_only=True
    )
    send_unit = serializers.ChoiceField(
        choices=["minutes", "hours", "days"], required=False, write_only=True
    )

    def get_contact_info(self, obj):
        contact = obj.contact
        schedule = getattr(contact, "schedule", None)
        interval = None
        if schedule is not None:
            interval = (schedule.interval_min_days + schedule.interval_max_days) / 2
        channels = [
            name
            for name, value in (
                ("whatsapp", contact.whatsapp),
                ("telegram", contact.telegram),
                ("phone", contact.phone),
                ("email", contact.email),
                ("messenger", contact.messenger),
            )
            if value
        ]
        return {
            "id": str(contact.id),
            "name": contact.name,
            "phone": contact.phone,
            "whatsapp": contact.whatsapp,
            "telegram": contact.telegram,
            "timezone": contact.timezone,
            "preferred_channel": contact.preferred_channel,
            "channels": channels,
            "last_contacted_at": contact.last_contacted_at,
            "created_at": contact.created_at,
            "interval_days": interval,
        }

    def get_touchpoint_due_at(self, obj):
        return obj.touchpoint.due_at if obj.touchpoint_id else None

    def get_handoff_url(self, obj):
        attempts = list(obj.delivery_attempts.all())
        if not attempts:
            return ""
        latest = max(attempts, key=lambda item: item.created_at)
        return latest.handoff_url

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["contact"].queryset = Contact.objects.filter(user=request.user)
            self.fields["touchpoint"].queryset = Touchpoint.objects.filter(
                schedule__contact__user=request.user
            )

    def validate(self, attrs):
        instance = self.instance
        contact = attrs.get("contact", getattr(instance, "contact", None))
        touchpoint = attrs.get("touchpoint", getattr(instance, "touchpoint", None))
        if touchpoint and touchpoint.schedule.contact_id != contact.id:
            raise serializers.ValidationError("Touchpoint does not belong to the contact.")
        if instance and instance.status not in {
            Message.Status.DRAFT,
            Message.Status.APPROVED,
            Message.Status.FAILED,
        }:
            changed = set(attrs) - {"status"}
            if changed:
                raise serializers.ValidationError("This message can only be deleted.")
        requested_status = attrs.get("status")
        if not instance and requested_status not in {None, Message.Status.DRAFT}:
            raise serializers.ValidationError("New messages must start as drafts.")
        if requested_status and requested_status not in {
            Message.Status.DRAFT,
            Message.Status.APPROVED,
            Message.Status.CANCELLED,
        }:
            raise serializers.ValidationError("Status cannot be set directly.")
        if instance and requested_status == Message.Status.APPROVED:
            if instance.status not in {
                Message.Status.DRAFT,
                Message.Status.APPROVED,
                Message.Status.FAILED,
            }:
                raise serializers.ValidationError("Only drafts can be approved.")
        if ("send_in" in attrs) != ("send_unit" in attrs):
            raise serializers.ValidationError(
                "Choose how long to wait and whether that is minutes, hours, or days."
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("send_in", None)
        validated_data.pop("send_unit", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        approving = validated_data.get("status") == Message.Status.APPROVED
        send_in = validated_data.pop("send_in", None)
        send_unit = validated_data.pop("send_unit", None)
        if approving:
            if "body" in validated_data:
                instance.body = validated_data["body"]
            if "touchpoint" in validated_data:
                instance.touchpoint = validated_data["touchpoint"]
            try:
                schedule_approval(instance, validated_data.get("channel"), send_in, send_unit)
            except ValueError as exc:
                raise serializers.ValidationError(str(exc)) from exc
            validated_data["channel"] = instance.channel
            validated_data["touchpoint"] = instance.touchpoint
            if instance.scheduled_for and instance.scheduled_for > timezone.now():
                SendNotification.objects.filter(message=instance).delete()
        message = super().update(instance, validated_data)
        if approving:
            dispatch_message(message.id)
            message.refresh_from_db()
            cache = getattr(message, "_prefetched_objects_cache", None)
            if cache is not None:
                cache.pop("delivery_attempts", None)
        return message


class GenerateSerializer(serializers.Serializer):
    contact = serializers.PrimaryKeyRelatedField(queryset=Contact.objects.none())
    touchpoint = serializers.PrimaryKeyRelatedField(
        queryset=Touchpoint.objects.none(), required=False, allow_null=True
    )
    purpose = serializers.ChoiceField(choices=Message.Purpose.choices)
    tone = serializers.ChoiceField(choices=Message.Tone.choices)
    length = serializers.ChoiceField(choices=Message.Length.choices)
    custom_instruction = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    include_history = serializers.BooleanField(default=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.context["request"].user
        self.fields["contact"].queryset = Contact.objects.filter(user=user)
        self.fields["touchpoint"].queryset = Touchpoint.objects.filter(schedule__contact__user=user)

    def validate(self, attrs):
        point = attrs.get("touchpoint")
        if point and point.schedule.contact_id != attrs["contact"].id:
            raise serializers.ValidationError("Touchpoint does not belong to the contact.")
        return attrs


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    queryset = Message.objects.none()
    throttle_scope = None
    filterset_fields = ["status", "contact", "purpose"]
    search_fields = ["body"]
    ordering_fields = ["created_at", "updated_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return (
            Message.objects.filter(contact__user=self.request.user)
            .select_related("contact", "contact__schedule", "touchpoint")
            .prefetch_related("delivery_attempts")
        )

    @action(detail=False, methods=["post"], throttle_scope="generation")
    def generate(self, request):
        serializer = GenerateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        draft = generate_draft(
            data["contact"],
            data["purpose"],
            data["tone"],
            data["length"],
            data.get("custom_instruction", ""),
            data["include_history"],
        )
        message = Message.objects.create(
            contact=data["contact"],
            touchpoint=data.get("touchpoint"),
            purpose=data["purpose"],
            tone=data["tone"],
            length=data["length"],
            custom_instruction=data.get("custom_instruction", ""),
            body=draft.body,
            generator=draft.provider,
            context_snapshot=draft.context,
        )
        return Response(
            MessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], throttle_scope="generation")
    def regenerate(self, request, pk=None):
        message = self.get_object()
        if message.status not in {
            Message.Status.DRAFT,
            Message.Status.APPROVED,
            Message.Status.FAILED,
        }:
            raise serializers.ValidationError("This message can only be deleted.")
        draft = generate_draft(
            message.contact,
            message.purpose,
            message.tone,
            message.length,
            message.custom_instruction,
            request.data.get("include_history", True),
        )
        message.body = draft.body
        message.generator = draft.provider
        message.context_snapshot = draft.context
        message.save(update_fields=["body", "generator", "context_snapshot", "updated_at"])
        return Response(MessageSerializer(message, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def send(self, request, pk=None):
        message = Message.objects.select_for_update().get(
            pk=self.get_object().pk, contact__user=request.user
        )
        if message.status not in {Message.Status.APPROVED, Message.Status.QUEUED}:
            raise serializers.ValidationError("Approve the message before handoff.")
        key = request.headers.get("Idempotency-Key")
        if not key:
            raise serializers.ValidationError("Idempotency-Key header is required.")
        channel = request.data.get("channel") or message.contact.preferred_channel or "whatsapp"
        error = ""
        try:
            provider, url = build_message_handoff(
                channel, message.contact, message.body, message.get_purpose_display()
            )
        except ValueError as exc:
            provider, url, error = "invalid_handoff", None, str(exc)
        attempt, _ = DeliveryAttempt.objects.get_or_create(
            message=message,
            idempotency_key=key,
            defaults={
                "provider": provider,
                "status": DeliveryAttempt.Status.CREATED,
            },
        )
        attempt.provider = provider
        attempt.handoff_url = url or ""
        if url is None:
            attempt.status = DeliveryAttempt.Status.FAILED
            attempt.error = error
            attempt.save(update_fields=["provider", "status", "error", "handoff_url"])
            return Response(
                {
                    "error": {
                        "code": "invalid_destination",
                        "detail": error,
                        "status": status.HTTP_400_BAD_REQUEST,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        attempt.status = DeliveryAttempt.Status.HANDED_OFF
        attempt.error = ""
        attempt.save(update_fields=["provider", "status", "error", "handoff_url"])
        message.status = Message.Status.QUEUED
        message.save(update_fields=["status", "updated_at"])
        return Response({"handoff_url": url, "attempt": DeliveryAttemptSerializer(attempt).data})

    @action(detail=False, methods=["post"], url_path="dispatch-due")
    def dispatch_due(self, request):
        return Response({"results": release_due_messages(request.user)})

    @action(detail=True, methods=["get"], url_path="send-sheet")
    def send_sheet(self, request, pk=None):
        message = self.get_object()
        if message.status not in {Message.Status.APPROVED, Message.Status.QUEUED}:
            raise serializers.ValidationError("Approve the message before opening it.")
        channel = message.channel or message.contact.preferred_channel
        try:
            sheet = build_send_sheet(
                channel, message.contact, message.body, message.get_purpose_display()
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        sheet.pop("provider", None)
        sheet["message_id"] = str(message.id)
        return Response(sheet)

    @action(detail=True, methods=["post"], url_path="mark-sent")
    @transaction.atomic
    def mark_sent(self, request, pk=None):
        message = Message.objects.select_for_update().get(
            pk=self.get_object().pk, contact__user=request.user
        )
        if message.status == Message.Status.SENT:
            return Response(MessageSerializer(message, context={"request": request}).data)
        if message.status not in {Message.Status.APPROVED, Message.Status.QUEUED}:
            raise serializers.ValidationError("Open the send link for a message that is ready.")
        message.status = Message.Status.SENT
        message.save(update_fields=["status", "updated_at"])
        attempt = message.delivery_attempts.order_by("-created_at").first()
        if attempt and attempt.status != DeliveryAttempt.Status.SENT:
            attempt.status = DeliveryAttempt.Status.SENT
            attempt.save(update_fields=["status"])
        SendNotification.objects.filter(message=message, opened_at__isnull=True).update(
            opened_at=timezone.now()
        )
        return Response(MessageSerializer(message, context={"request": request}).data)


class NotificationListView(APIView):
    def get(self, request):
        notes = SendNotification.objects.filter(
            user=request.user, opened_at__isnull=True
        ).select_related("message__contact", "touchpoint__schedule__contact")
        return Response({"results": [notification_payload(note) for note in notes]})


class NotificationOpenView(APIView):
    def post(self, request, pk):
        note = get_object_or_404(
            SendNotification.objects.select_related(
                "message__contact", "touchpoint__schedule__contact"
            ),
            pk=pk,
            user=request.user,
        )
        if note.opened_at is None:
            note.opened_at = timezone.now()
            note.save(update_fields=["opened_at"])
        return Response(notification_payload(note))
