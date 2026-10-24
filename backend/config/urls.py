from apps.accounts.views import (
    DeviceView,
    EmailAccountView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
    VerifyOTPView,
)
from apps.analytics.views import IntegrationsView, OverviewView
from apps.contacts.api import ContactViewSet, TagViewSet
from apps.interactions.api import InteractionViewSet
from apps.memories.api import MemoryViewSet
from apps.messaging.api import MessageViewSet, NotificationListView, NotificationOpenView
from apps.schedules.api import ScheduleViewSet, TouchpointViewSet
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("contacts", ContactViewSet, basename="contact")
router.register("tags", TagViewSet, basename="tag")
router.register("touchpoints", TouchpointViewSet, basename="touchpoint")
router.register("messages", MessageViewSet, basename="message")

memory_list = MemoryViewSet.as_view({"get": "list", "post": "create"})
memory_detail = MemoryViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
interaction_list = InteractionViewSet.as_view({"get": "list", "post": "create"})
interaction_detail = InteractionViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
schedule_list = ScheduleViewSet.as_view({"get": "list", "post": "create"})
schedule_detail = ScheduleViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

api_patterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("users/me/", MeView.as_view(), name="me"),
    path("users/me/email/", EmailAccountView.as_view(), name="email-account"),
    path("devices/", DeviceView.as_view(), name="devices"),
    path("contacts/<uuid:contact_pk>/memories/", memory_list),
    path("contacts/<uuid:contact_pk>/memories/<uuid:pk>/", memory_detail),
    path("contacts/<uuid:contact_pk>/interactions/", interaction_list),
    path("contacts/<uuid:contact_pk>/interactions/<uuid:pk>/", interaction_detail),
    path("contacts/<uuid:contact_pk>/schedules/", schedule_list),
    path("contacts/<uuid:contact_pk>/schedules/<uuid:pk>/", schedule_detail),
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/<uuid:pk>/open/", NotificationOpenView.as_view(), name="notification-open"),
    path("analytics/overview/", OverviewView.as_view(), name="analytics-overview"),
    path("integrations/", IntegrationsView.as_view(), name="integrations"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("", TemplateView.as_view(template_name="app.html"), name="web-app"),
    path("admin/", admin.site.urls),
    path("health/", lambda request: JsonResponse({"status": "ok"})),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/v1/", include(api_patterns)),
]
