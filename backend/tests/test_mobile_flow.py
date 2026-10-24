"""The calls the mobile app makes after login: contacts, rhythm, drafts, send, history."""

import re
from datetime import timedelta

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

PASSWORD = "Str0ng-pass-123!"
MOBILE = {"HTTP_X_CLIENT": "mobile"}


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()


@pytest.fixture
def app():
    client = APIClient()
    register = client.post(
        "/api/v1/auth/register/",
        {"email": "app@example.com", "password": PASSWORD, "name": "App User"},
        format="json",
        **MOBILE,
    )
    code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
    verified = client.post(
        "/api/v1/auth/verify-otp/",
        {"challenge_id": register.json()["challenge_id"], "code": code},
        format="json",
        **MOBILE,
    )
    authed = APIClient()
    authed.credentials(HTTP_AUTHORIZATION=f"Bearer {verified.json()['access']}", **MOBILE)
    return authed


def make_contact(app, **extra):
    body = {
        "name": "Nadia Rahman",
        "relationship": "mentor",
        "phone": "+8801712345678",
        "whatsapp": "+8801712345678",
        "telegram": "@nadia_r",
        "preferred_channel": "whatsapp",
        "timezone": "Asia/Dhaka",
        **extra,
    }
    response = app.post("/api/v1/contacts/", body, format="json")
    assert response.status_code == 201, response.content
    return response.json()


@pytest.mark.django_db
def test_contact_lists_its_rhythm(app):
    contact = make_contact(app)
    schedule = app.post(
        f"/api/v1/contacts/{contact['id']}/schedules/",
        {"mode": "randomized", "interval_min_days": 25, "interval_max_days": 35},
        format="json",
    )
    assert schedule.status_code == 201
    listed = app.get("/api/v1/contacts/").json()["results"][0]
    assert listed["schedule"]["interval_min_days"] == 25
    assert listed["schedule"]["next_due_at"]


@pytest.mark.django_db
def test_draft_to_sent_flow_like_the_app(app):
    contact = make_contact(app)
    app.post(
        f"/api/v1/contacts/{contact['id']}/schedules/",
        {"mode": "fixed", "interval_min_days": 30, "interval_max_days": 30},
        format="json",
    )
    app.post(
        f"/api/v1/contacts/{contact['id']}/memories/",
        {"content": "Loves Satyajit Ray films", "category": "interest", "allow_drafting": True},
        format="json",
    )
    generated = app.post(
        "/api/v1/messages/generate/",
        {"contact": contact["id"], "purpose": "check_in", "tone": "warm", "length": "medium"},
        format="json",
    )
    assert generated.status_code == 201
    message = generated.json()
    assert message["contact_info"]["name"] == "Nadia Rahman"
    assert "phone" in message["contact_info"]["channels"]
    assert message["context_snapshot"]["memories"][0]["content"] == "Loves Satyajit Ray films"

    approved = app.patch(
        f"/api/v1/messages/{message['id']}/",
        {"status": "approved", "channel": "telegram", "send_in": 1, "send_unit": "minutes"},
        format="json",
    )
    assert approved.status_code == 200, approved.content
    assert approved.json()["status"] == "approved"
    assert approved.json()["touchpoint"]

    sent = app.post(f"/api/v1/messages/{message['id']}/mark-sent/")
    assert sent.json()["status"] == "sent"
    interaction = app.post(
        f"/api/v1/contacts/{contact['id']}/interactions/",
        {
            "kind": "message",
            "channel": "telegram",
            "notes": "Hello",
            "occurred_at": timezone.now().isoformat(),
            "touchpoint": approved.json()["touchpoint"],
        },
        format="json",
    )
    assert interaction.status_code == 201, interaction.content
    refreshed = app.get(f"/api/v1/contacts/{contact['id']}/").json()
    assert refreshed["last_contacted_at"]


@pytest.mark.django_db
def test_sms_and_telegram_username_handoffs(app):
    contact = make_contact(app)
    cases = (("phone", "sms:+8801712345678?body="), ("telegram", "https://t.me/nadia_r?text="))
    for channel, expected in cases:
        message = app.post(
            "/api/v1/messages/",
            {
                "contact": contact["id"],
                "purpose": "custom",
                "tone": "casual",
                "length": "medium",
                "body": "Hi there",
                "channel": channel,
            },
            format="json",
        ).json()
        app.patch(
            f"/api/v1/messages/{message['id']}/",
            {"status": "approved", "channel": channel, "send_in": 1, "send_unit": "minutes"},
            format="json",
        )
        sheet = app.get(f"/api/v1/messages/{message['id']}/send-sheet/").json()
        assert sheet["deep_link"].startswith(expected)


@pytest.mark.django_db
def test_validation_errors_are_wrapped_for_the_app(app):
    response = app.post(
        "/api/v1/contacts/", {"name": "No way", "relationship": "friend"}, format="json"
    )
    assert response.status_code == 400
    assert "error" in response.json()
    assert response.json()["error"]["detail"]


@pytest.mark.django_db
def test_notifications_after_overdue_release(app):
    contact = make_contact(app)
    app.post(
        f"/api/v1/contacts/{contact['id']}/schedules/",
        {"mode": "fixed", "interval_min_days": 1, "interval_max_days": 1},
        format="json",
    )
    from apps.schedules.models import Touchpoint

    Touchpoint.objects.update(due_at=timezone.now() - timedelta(hours=2))
    released = app.post("/api/v1/messages/dispatch-due/").json()["results"]
    assert released and released[0]["kind"] == "touchpoint"
    assert app.get("/api/v1/notifications/").json()["results"]
    app.post(f"/api/v1/notifications/{released[0]['id']}/open/")
    assert app.get("/api/v1/notifications/").json()["results"] == []
