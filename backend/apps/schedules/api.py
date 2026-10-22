from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.response import Response

from apps.contacts.models import Contact
from apps.memories.models import Memory

from .models import Schedule, Touchpoint
from .services import (
    create_next_touchpoint,
    reschedule_touchpoint,
    set_schedule_status,
    transition_touchpoint,
)


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = [
            "id",
            "contact",
            "mode",
            "interval_min_days",
            "interval_max_days",
            "next_due_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "contact", "next_due_at", "created_at", "updated_at"]

    def validate(self, attrs):
        mode = attrs.get("mode", getattr(self.instance, "mode", None))
        minimum = attrs.get("interval_min_days", getattr(self.instance, "interval_min_days", None))
        maximum = attrs.get("interval_max_days", getattr(self.instance, "interval_max_days", None))
        if minimum is not None and (minimum < 1 or maximum < minimum):
            raise serializers.ValidationError("Intervals must be positive and max >= min.")
        if mode == Schedule.Mode.FIXED and minimum != maximum:
            raise serializers.ValidationError("Fixed schedules require equal min/max intervals.")
        status_value = attrs.get("status", getattr(self.instance, "status", None))
        if (
            self.instance
            and status_value == Schedule.Status.ACTIVE
            and self.instance.contact.status != Contact.Status.ACTIVE
        ):
            raise serializers.ValidationError("Activate the contact before resuming its schedule.")
        return attrs


class ScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduleSerializer
    queryset = Schedule.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return Schedule.objects.filter(
            contact_id=self.kwargs["contact_pk"], contact__user=self.request.user
        )

    def perform_create(self, serializer):
        contact = get_object_or_404(Contact, pk=self.kwargs["contact_pk"], user=self.request.user)
        if contact.status != Contact.Status.ACTIVE:
            raise serializers.ValidationError("Schedules require an active contact.")
        schedule = serializer.save(contact=contact)
        # The first check-in counts from the last time you talked (PRD M12: if that date has
        # already passed, the check-in is due today), not from the moment the contact was saved.
        create_next_touchpoint(
            schedule.id,
            base_at=contact.last_contacted_at,
            idempotency_key=f"initial:{schedule.id}",
        )
        schedule.refresh_from_db()

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        schedule = serializer.save()
        if schedule.status != old_status:
            set_schedule_status(schedule.id, schedule.status)


class TouchpointSerializer(serializers.ModelSerializer):
    contact_id = serializers.UUIDField(source="schedule.contact_id", read_only=True)
    reasons = serializers.SerializerMethodField()

    class Meta:
        model = Touchpoint
        fields = [
            "id",
            "schedule",
            "contact_id",
            "due_at",
            "status",
            "reasons",
            "selected_interval_days",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "schedule",
            "selected_interval_days",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_reasons(self, obj):
        contact = obj.schedule.contact
        memories = getattr(contact, "draft_memories", None)
        if memories is None:
            memories = contact.memories.filter(allow_drafting=True).order_by("created_at")
        return [memory.content for memory in memories]


class TouchpointViewSet(
    mixins.DestroyModelMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet
):
    serializer_class = TouchpointSerializer
    queryset = Touchpoint.objects.none()
    filterset_fields = ["status", "schedule", "schedule__contact"]
    ordering_fields = ["due_at", "created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return (
            Touchpoint.objects.filter(schedule__contact__user=self.request.user)
            .select_related("schedule", "schedule__contact")
            .prefetch_related(
                Prefetch(
                    "schedule__contact__memories",
                    queryset=Memory.objects.filter(allow_drafting=True).order_by("created_at"),
                    to_attr="draft_memories",
                )
            )
        )

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        queryset = self.filter_queryset(
            self.get_queryset().filter(status__in=Touchpoint.ACTIVE_STATUSES)
        )
        return self.get_paginated_response(
            TouchpointSerializer(
                self.paginate_queryset(queryset), many=True, context={"request": request}
            ).data
        )

    @action(detail=True, methods=["patch"])
    def reschedule(self, request, pk=None):
        point = self.get_object()
        due_at = serializers.DateTimeField().run_validation(request.data.get("due_at"))
        try:
            point = reschedule_touchpoint(point.id, due_at)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return Response(TouchpointSerializer(point).data)

    @action(detail=True, methods=["patch"])
    def transition(self, request, pk=None):
        point = self.get_object()
        status_value = request.data.get("status")
        due_at = None
        if request.data.get("due_at"):
            field = serializers.DateTimeField()
            due_at = field.run_validation(request.data["due_at"])
        try:
            point = transition_touchpoint(point.id, status_value, due_at)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return Response(TouchpointSerializer(point).data)

    def partial_update(self, request, pk=None):
        return self.transition(request, pk)

    def update(self, request, pk=None):
        raise MethodNotAllowed("PUT")

    def perform_destroy(self, instance):
        if instance.status in Touchpoint.ACTIVE_STATUSES:
            instance.schedule.delete()
            return
        instance.delete()

    @action(detail=False, methods=["get"])
    def overdue(self, request):
        queryset = self.get_queryset().filter(
            due_at__lt=timezone.now(), status__in=Touchpoint.ACTIVE_STATUSES
        )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(TouchpointSerializer(page, many=True).data)
