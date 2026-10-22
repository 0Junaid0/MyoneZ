from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets

from apps.contacts.models import Contact

from .models import Memory


class MemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Memory
        fields = [
            "id",
            "contact",
            "content",
            "category",
            "sensitivity",
            "allow_drafting",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "contact", "created_at", "updated_at"]


class MemoryViewSet(viewsets.ModelViewSet):
    serializer_class = MemorySerializer
    queryset = Memory.objects.none()
    search_fields = ["content", "category"]
    filterset_fields = ["category", "allow_drafting"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return Memory.objects.filter(
            contact_id=self.kwargs["contact_pk"], contact__user=self.request.user
        )

    def perform_create(self, serializer):
        contact = get_object_or_404(Contact, pk=self.kwargs["contact_pk"], user=self.request.user)
        serializer.save(contact=contact)
