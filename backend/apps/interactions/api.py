from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets

from apps.contacts.models import Contact
from apps.schedules.models import Touchpoint
from apps.schedules.services import transition_touchpoint

from .models import Interaction
from .services import recompute_last_contacted


class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = [
            "id",
            "contact",
            "touchpoint",
            "kind",
            "channel",
            "notes",
            "use_for_drafting",
            "occurred_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "contact", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["touchpoint"].queryset = Touchpoint.objects.filter(
                schedule__contact__user=request.user,
                status__in=Touchpoint.ACTIVE_STATUSES,
            )

    def validate_touchpoint(self, value):
        if value and str(value.schedule.contact_id) != str(
            self.context["view"].kwargs["contact_pk"]
        ):
            raise serializers.ValidationError("Touchpoint does not belong to the contact.")
        if self.instance and value != self.instance.touchpoint:
            raise serializers.ValidationError("The linked touchpoint cannot be changed.")
        return value


class InteractionViewSet(viewsets.ModelViewSet):
    serializer_class = InteractionSerializer
    queryset = Interaction.objects.none()
    filterset_fields = ["kind", "channel", "use_for_drafting"]
    ordering_fields = ["occurred_at", "created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return Interaction.objects.filter(
            contact_id=self.kwargs["contact_pk"], contact__user=self.request.user
        )

    @transaction.atomic
    def perform_create(self, serializer):
        contact = get_object_or_404(Contact, pk=self.kwargs["contact_pk"], user=self.request.user)
        interaction = serializer.save(contact=contact)
        recompute_last_contacted(contact.id)
        if interaction.touchpoint_id:
            transition_touchpoint(interaction.touchpoint_id, Touchpoint.Status.COMPLETED)

    def perform_update(self, serializer):
        interaction = serializer.save()
        recompute_last_contacted(interaction.contact_id)

    def perform_destroy(self, instance):
        contact_id = instance.contact_id
        instance.delete()
        recompute_last_contacted(contact_id)
