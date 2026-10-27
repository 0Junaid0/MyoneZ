"""Backend pieces the mobile app needs: logout, password reset by code, push devices, push data."""

import json
import re
from unittest import mock

import pytest
from apps.accounts.models import Device, User
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

PASSWORD = "Str0ng-pass-123!"
NEW_PASSWORD = "An0ther-strong-pass!"
MOBILE = {"HTTP_X_CLIENT": "mobile"}
TOKEN = "ExponentPushToken[abc123]"


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()


def last_code():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


def sign_in(client, email="phone@example.com"):
    if not User.objects.filter(email=email).exists():
        User.objects.create_user(email=email, password=PASSWORD, name="Phone User")
    challenge = client.post(
        "/api/v1/auth/login/", {"email": email, "password": PASSWORD}, format="json", **MOBILE
    ).json()
    tokens = client.post(
        "/api/v1/auth/verify-otp/",
        {"challenge_id": challenge["challenge_id"], "code": last_code()},
        format="json",
        **MOBILE,
    ).json()
    return tokens


@pytest.mark.django_db
def test_wrong_login_says_email_or_password_is_wrong():
    User.objects.create_user(email="a@example.com", password=PASSWORD, name="A")
    response = APIClient().post(
        "/api/v1/auth/login/",
        {"email": "a@example.com", "password": "nope-nope-nope"},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["error"]["detail"]["non_field_errors"] == ["Email or password is wrong."]


@pytest.mark.django_db
def test_mobile_logout_revokes_refresh_token_and_forgets_the_phone():
    client = APIClient()
    tokens = sign_in(client)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert (
        client.post(
            "/api/v1/devices/", {"token": TOKEN, "platform": "ios"}, format="json"
        ).status_code
        == 204
    )

    out = APIClient().post(
        "/api/v1/auth/logout/",
        {"refresh": tokens["refresh"], "device_token": TOKEN},
        format="json",
        **MOBILE,
    )
    assert out.status_code == 204
    assert not Device.objects.filter(token=TOKEN).exists()
    again = APIClient().post(
        "/api/v1/auth/refresh/", {"refresh": tokens["refresh"]}, format="json", **MOBILE
    )
    assert again.status_code == 401


@pytest.mark.django_db
def test_password_reset_with_emailed_code():
    user = User.objects.create_user(email="r@example.com", password=PASSWORD, name="R")
    client = APIClient()
    old_tokens = sign_in(client, "r@example.com")

    start = client.post("/api/v1/auth/password-reset/", {"email": "r@example.com"}, format="json")
    assert start.status_code == 200
    body = start.json()
    assert body["otp_required"] is True and body["challenge_id"]
    code = last_code()

    weak = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"challenge_id": body["challenge_id"], "code": code, "new_password": "1234567890"},
        format="json",
    )
    assert weak.status_code == 400  # the code stays usable for a better password

    done = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"challenge_id": body["challenge_id"], "code": code, "new_password": NEW_PASSWORD},
        format="json",
    )
    assert done.status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    # old sessions are signed out
    stale = APIClient().post(
        "/api/v1/auth/refresh/", {"refresh": old_tokens["refresh"]}, format="json", **MOBILE
    )
    assert stale.status_code == 401
    # the code works only once
    reuse = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"challenge_id": body["challenge_id"], "code": code, "new_password": NEW_PASSWORD},
        format="json",
    )
    assert reuse.status_code == 400


@pytest.mark.django_db
def test_password_reset_code_cannot_log_in_and_unknown_email_looks_the_same():
    User.objects.create_user(email="s@example.com", password=PASSWORD, name="S")
    client = APIClient()
    start = client.post("/api/v1/auth/password-reset/", {"email": "s@example.com"}, format="json")
    login_with_reset_code = client.post(
        "/api/v1/auth/verify-otp/",
        {"challenge_id": start.json()["challenge_id"], "code": last_code()},
        format="json",
        **MOBILE,
    )
    assert login_with_reset_code.status_code == 400

    sent = len(mail.outbox)
    unknown = client.post(
        "/api/v1/auth/password-reset/", {"email": "nobody@example.com"}, format="json"
    )
    assert unknown.status_code == 200
    assert set(unknown.json()) >= {"otp_required", "challenge_id", "detail"}
    assert len(mail.outbox) == sent


@pytest.mark.django_db
def test_device_register_is_idempotent_and_validates_token():
    client = APIClient()
    tokens = sign_in(client)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    for platform in ("ios", "android"):
        assert (
            client.post(
                "/api/v1/devices/", {"token": TOKEN, "platform": platform}, format="json"
            ).status_code
            == 204
        )
    assert Device.objects.get(token=TOKEN).platform == "android"
    bad = client.post("/api/v1/devices/", {"token": "abc", "platform": "ios"}, format="json")
    assert bad.status_code == 400
    assert (
        APIClient()
        .post("/api/v1/devices/", {"token": TOKEN, "platform": "ios"}, format="json")
        .status_code
        == 401
    )
    gone = client.delete("/api/v1/devices/", {"token": TOKEN}, format="json")
    assert gone.status_code == 204 and not Device.objects.exists()


@pytest.mark.django_db(transaction=True)
@override_settings(EXPO_PUSH_ENABLED=True, EXPO_PUSH_URL="https://push.test/send")
def test_new_notification_is_pushed_in_the_format_the_app_reads():
    from datetime import timedelta

    from apps.contacts.models import Contact
    from apps.messaging.delivery import dispatch_due_messages
    from apps.messaging.models import Message
    from django.utils import timezone

    user = User.objects.create_user(email="p@example.com", password=PASSWORD, name="P")
    Device.objects.create(user=user, token=TOKEN, platform="android")
    Device.objects.create(user=user, token="ExponentPushToken[gone]", platform="ios")
    contact = Contact.objects.create(
        user=user, name="Arif", whatsapp="+8801712000000", relationship="friend"
    )
    message = Message.objects.create(
        contact=contact,
        body="Hi Arif",
        status=Message.Status.APPROVED,
        channel="whatsapp",
        scheduled_for=timezone.now() - timedelta(minutes=1),
    )

    sent = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(
                {
                    "data": [
                        {"status": "ok"},
                        {"status": "error", "details": {"error": "DeviceNotRegistered"}},
                    ]
                }
            ).encode()

    def fake_urlopen(request, timeout):
        sent["url"] = request.full_url
        sent["body"] = json.loads(request.data.decode())
        return FakeResponse()

    with mock.patch("apps.messaging.push.urllib.request.urlopen", fake_urlopen):
        dispatch_due_messages(user)

    assert sent["url"] == "https://push.test/send"
    first = sent["body"][0]
    assert first["to"] == TOKEN
    assert first["data"]["type"] == "reminder"
    assert first["data"]["draft_id"] == str(message.id)
    assert first["channelId"] == "default"
    assert not Device.objects.filter(token="ExponentPushToken[gone]").exists()


@pytest.mark.django_db
def test_first_check_in_counts_from_last_talk_and_log_a_talk_moves_it():
    from datetime import timedelta

    from apps.schedules.models import Touchpoint
    from django.utils import timezone

    user = User.objects.create_user(email="t@example.com", password=PASSWORD, name="T")
    client = APIClient()
    client.force_authenticate(user)
    contact = client.post(
        "/api/v1/contacts/",
        {"name": "Nadia", "relationship": "friend", "whatsapp": "+8801712345678"},
        format="json",
    ).json()
    talked = timezone.now() - timedelta(days=20)
    client.post(
        f"/api/v1/contacts/{contact['id']}/interactions/",
        {"kind": "call", "occurred_at": talked.isoformat()},
        format="json",
    )
    client.post(
        f"/api/v1/contacts/{contact['id']}/schedules/",
        {"mode": "fixed", "interval_min_days": 7, "interval_max_days": 7, "status": "active"},
        format="json",
    )
    point = Touchpoint.objects.get(schedule__contact_id=contact["id"])
    # 20 days ago + 7 days: already due, so the check-in shows as overdue today
    assert point.due_at < timezone.now()

    client.post(
        f"/api/v1/contacts/{contact['id']}/interactions/",
        {
            "kind": "custom",
            "notes": "Logged a conversation",
            "occurred_at": timezone.now().isoformat(),
        },
        format="json",
    )
    point.refresh_from_db()
    assert point.status == "completed"
    nxt = Touchpoint.objects.get(schedule__contact_id=contact["id"], status="upcoming")
    assert timedelta(days=6) < nxt.due_at - timezone.now() <= timedelta(days=7)
