from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contacts.models import Contact
from apps.interactions.models import Interaction
from apps.messaging.models import DeliveryAttempt
from apps.schedules.models import Touchpoint


class OverviewView(APIView):
    @extend_schema(
        responses=inline_serializer(
            name="AnalyticsOverview",
            fields={
                "active_contacts": serializers.IntegerField(),
                "upcoming_touchpoints": serializers.IntegerField(),
                "overdue_touchpoints": serializers.IntegerField(),
                "contacted_last_30_days": serializers.IntegerField(),
                "activity_trend": serializers.ListField(child=serializers.DictField()),
                "delivery_status": serializers.DictField(),
                "recent_interactions": serializers.ListField(child=serializers.DictField()),
            },
        )
    )
    def get(self, request):
        now = timezone.now()
        since = now - timedelta(days=30)
        contacts = Contact.objects.filter(user=request.user)
        touchpoints = Touchpoint.objects.filter(schedule__contact__user=request.user)
        interactions = Interaction.objects.filter(contact__user=request.user)
        trend = (
            interactions.filter(occurred_at__gte=since)
            .annotate(day=TruncDate("occurred_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        delivery = (
            DeliveryAttempt.objects.filter(message__contact__user=request.user)
            .values("status")
            .annotate(count=Count("id"))
        )
        recent = interactions.select_related("contact")[:10]
        return Response(
            {
                "active_contacts": contacts.filter(status=Contact.Status.ACTIVE).count(),
                "upcoming_touchpoints": touchpoints.filter(
                    due_at__gte=now, status__in=Touchpoint.ACTIVE_STATUSES
                ).count(),
                "overdue_touchpoints": touchpoints.filter(
                    due_at__lt=now, status__in=Touchpoint.ACTIVE_STATUSES
                ).count(),
                "contacted_last_30_days": contacts.filter(last_contacted_at__gte=since).count(),
                "activity_trend": [{"date": item["day"], "count": item["count"]} for item in trend],
                "delivery_status": {item["status"]: item["count"] for item in delivery},
                "recent_interactions": [
                    {
                        "id": item.id,
                        "contact_id": item.contact_id,
                        "contact_name": item.contact.name,
                        "kind": item.kind,
                        "occurred_at": item.occurred_at,
                    }
                    for item in recent
                ],
            }
        )


class IntegrationsView(APIView):
    @extend_schema(
        responses=inline_serializer(
            name="Integration",
            many=True,
            fields={
                "id": serializers.CharField(),
                "name": serializers.CharField(),
                "mode": serializers.CharField(),
                "connected": serializers.BooleanField(),
                "supports_delivery_receipts": serializers.BooleanField(),
            },
        )
    )
    def get(self, request):
        return Response(
            [
                {
                    "id": item_id,
                    "name": name,
                    "mode": "user_notification",
                    "connected": True,
                    "supports_delivery_receipts": False,
                }
                for item_id, name in (
                    ("whatsapp_handoff", "WhatsApp"),
                    ("telegram_handoff", "Telegram"),
                    ("email_handoff", "Gmail"),
                    ("messenger_handoff", "Messenger"),
                )
            ]
        )
