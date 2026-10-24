import re
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from apps.accounts.models import EmailAccount, User
from apps.contacts.models import Contact
from apps.interactions.models import Interaction
from apps.memories.models import Memory
from apps.messaging.models import Message, SendNotification
from apps.schedules.models import Schedule, Touchpoint
from apps.schedules.services import create_next_touchpoint, transition_touchpoint
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

pytestmark = pytest.mark.django_db


def test_user_can_save_sending_email(client, user):
    empty = client.get("/api/v1/users/me/email/")
    assert empty.status_code == 200
    assert empty.data["from_email"] == user.email
    assert empty.data["password_set"] is False
    saved = client.patch(
        "/api/v1/users/me/email/",
        {
            "from_email": "me@example.com",
            "host": "smtp.example.com",
            "port": 587,
            "username": "me@example.com",
            "password": "secret-value",
            "security": "tls",
        },
        format="json",
    )
    assert saved.status_code == 200
    assert saved.data["password_set"] is True
    assert "password" not in saved.data
    kept = client.patch(
        "/api/v1/users/me/email/",
        {"host": "smtp.example.com", "password": ""},
        format="json",
    )
    assert kept.status_code == 200
    assert EmailAccount.objects.get(user=user).password == "secret-value"


def test_web_app_is_available():
    response = APIClient().get("/")
    assert response.status_code == 200
    assert b"MyoneZ" in response.content
    assert b"/static/app.js" in response.content
    assert b"Drafts and scheduled" in response.content
    assert b'data-view="drafts"' in response.content


@pytest.fixture
def user():
    return User.objects.create_user(
        email="owner@example.com", password="strong-pass-123", name="Owner"
    )


@pytest.fixture
def client(user):
    api = APIClient()
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return api


@pytest.fixture
def contact(user):
    return Contact.objects.create(
        user=user,
        name="Maya",
        email="maya@example.com",
        whatsapp="+14155552671",
        relationship=Contact.Relationship.FRIEND,
    )


def complete_otp(client, response):
    assert response.status_code == 200
    assert response.data["otp_required"] is True
    assert "pocketcrm_access" not in response.cookies
    code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
    headers = {}
    if "csrftoken" in client.cookies:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.post(
        "/api/v1/auth/verify-otp/",
        {"challenge_id": response.data["challenge_id"], "code": code},
        format="json",
        **headers,
    )


def test_register_sets_http_only_tokens():
    client = APIClient()
    started = client.post(
        "/api/v1/auth/register/",
        {
            "email": "new@example.com",
            "name": "New User",
            "password": "a-strong-password-123",
            "timezone": "Asia/Dhaka",
        },
    )
    response = complete_otp(client, started)
    assert response.status_code == 201
    assert response.data["email"] == "new@example.com"
    assert response.cookies["pocketcrm_access"]["httponly"]
    assert response.cookies["pocketcrm_refresh"]["httponly"]
    reused = client.post(
        "/api/v1/auth/verify-otp/",
        {"challenge_id": started.data["challenge_id"], "code": "000000"},
        format="json",
    )
    assert reused.status_code == 400


def test_login_requires_a_fresh_email_code(user):
    client = APIClient()
    started = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": "strong-pass-123"},
        format="json",
    )
    wrong = client.post(
        "/api/v1/auth/verify-otp/",
        {"challenge_id": started.data["challenge_id"], "code": "000000"},
        format="json",
    )
    assert wrong.status_code == 400
    assert "pocketcrm_access" not in wrong.cookies
    verified = complete_otp(client, started)
    assert verified.status_code == 200
    assert verified.data["email"] == user.email


def test_refresh_cookie_requires_csrf_token():
    api = APIClient(enforce_csrf_checks=True)
    started = api.post(
        "/api/v1/auth/register/",
        {
            "email": "csrf@example.com",
            "name": "CSRF User",
            "password": "a-strong-password-123",
            "timezone": "UTC",
        },
    )
    registered = complete_otp(api, started)
    assert registered.status_code == 201
    assert api.post("/api/v1/auth/refresh/").status_code == 403
    token = api.cookies["csrftoken"].value
    assert api.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=token).status_code == 204


def test_contacts_are_isolated(client, contact):
    other = User.objects.create_user(email="other@example.com", password="pass", name="Other")
    Contact.objects.create(
        user=other, name="Hidden", email="hidden@example.com", relationship="other"
    )
    response = client.get("/api/v1/contacts/")
    assert response.status_code == 200
    assert [item["name"] for item in response.data["results"]] == ["Maya"]


def test_nested_resources_reject_another_users_contact(client):
    other = User.objects.create_user(email="other@example.com", password="pass", name="Other")
    hidden = Contact.objects.create(
        user=other, name="Hidden", email="hidden@example.com", relationship="other"
    )
    response = client.post(
        f"/api/v1/contacts/{hidden.id}/memories/",
        {"content": "Private", "allow_drafting": True},
    )
    assert response.status_code == 404


def test_interaction_updates_and_recomputes_last_contacted(client, contact):
    occurred_at = timezone.now() - timedelta(days=2)
    response = client.post(
        f"/api/v1/contacts/{contact.id}/interactions/",
        {"kind": "call", "occurred_at": occurred_at.isoformat()},
    )
    assert response.status_code == 201
    contact.refresh_from_db()
    assert contact.last_contacted_at == occurred_at
    delete = client.delete(f"/api/v1/contacts/{contact.id}/interactions/{response.data['id']}/")
    assert delete.status_code == 204
    contact.refresh_from_db()
    assert contact.last_contacted_at is None


def test_outreach_rhythm_can_be_changed(client, contact):
    created = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 20, "interval_max_days": 20},
    )
    updated = client.patch(
        f"/api/v1/contacts/{contact.id}/schedules/{created.data['id']}/",
        {"mode": "fixed", "interval_min_days": 7, "interval_max_days": 7},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["interval_min_days"] == 7
    assert updated.data["interval_max_days"] == 7
    assert updated.data["next_due_at"] == created.data["next_due_at"]


def test_touchpoint_lists_the_memories_it_is_based_on(client, contact):
    client.post(
        f"/api/v1/contacts/{contact.id}/memories/",
        {"content": "birthday next week", "allow_drafting": True},
        format="json",
    )
    client.post(
        f"/api/v1/contacts/{contact.id}/memories/",
        {"content": "new job", "allow_drafting": True},
        format="json",
    )
    client.post(
        f"/api/v1/contacts/{contact.id}/memories/",
        {"content": "secret detail", "allow_drafting": False},
        format="json",
    )
    created = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 30, "interval_max_days": 30},
    )
    assert created.status_code == 201
    upcoming = client.get("/api/v1/touchpoints/upcoming/")
    assert upcoming.status_code == 200
    assert upcoming.data["results"][0]["reasons"] == ["birthday next week", "new job"]


def test_touchpoint_can_be_deleted(client, contact):
    created = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 30, "interval_max_days": 30},
    )
    assert created.status_code == 201
    point = Touchpoint.objects.get(schedule_id=created.data["id"])
    response = client.delete(f"/api/v1/touchpoints/{point.id}/")
    assert response.status_code == 204
    assert not Touchpoint.objects.filter(pk=point.id).exists()
    assert not Schedule.objects.filter(contact=contact).exists()
    upcoming = client.get("/api/v1/touchpoints/upcoming/")
    assert upcoming.data["results"] == []


def test_fixed_schedule_has_one_active_touchpoint(contact):
    schedule = Schedule.objects.create(
        contact=contact, mode="fixed", interval_min_days=30, interval_max_days=30
    )
    first = create_next_touchpoint(schedule.id, idempotency_key="initial")
    second = create_next_touchpoint(schedule.id, idempotency_key="retry")
    assert first.id == second.id
    assert first.selected_interval_days == 30
    assert schedule.touchpoints.filter(status__in=Touchpoint.ACTIVE_STATUSES).count() == 1


def test_random_schedule_interval_is_persisted(contact):
    schedule = Schedule.objects.create(
        contact=contact, mode="randomized", interval_min_days=20, interval_max_days=35
    )
    point = create_next_touchpoint(schedule.id)
    assert 20 <= point.selected_interval_days <= 35
    same = create_next_touchpoint(schedule.id)
    assert same.id == point.id
    assert same.selected_interval_days == point.selected_interval_days


def test_upcoming_check_in_time_can_be_changed(client, contact):
    created = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 30, "interval_max_days": 30},
    )
    assert created.status_code == 201
    point = Touchpoint.objects.get(schedule_id=created.data["id"])
    new_due = (timezone.now() + timedelta(days=4)).replace(microsecond=0)
    response = client.patch(
        f"/api/v1/touchpoints/{point.id}/reschedule/",
        {"due_at": new_due.isoformat()},
        format="json",
    )
    assert response.status_code == 200
    point.refresh_from_db()
    assert abs(point.due_at - new_due) < timedelta(seconds=1)
    assert point.status == Touchpoint.Status.UPCOMING
    point.schedule.refresh_from_db()
    assert point.schedule.next_due_at == point.due_at
    rejected = client.patch(
        f"/api/v1/touchpoints/{point.id}/reschedule/",
        {"due_at": (timezone.now() - timedelta(minutes=5)).isoformat()},
        format="json",
    )
    assert rejected.status_code == 400


def test_completion_schedules_from_actual_completion(contact):
    schedule = Schedule.objects.create(
        contact=contact, mode="fixed", interval_min_days=10, interval_max_days=10
    )
    point = create_next_touchpoint(schedule.id)
    before = timezone.now()
    transition_touchpoint(point.id, Touchpoint.Status.COMPLETED)
    next_point = schedule.touchpoints.get(status=Touchpoint.Status.UPCOMING)
    assert before + timedelta(days=10) <= next_point.due_at


def test_schedule_preserves_local_hour_across_dst(contact):
    contact.timezone = "America/New_York"
    contact.save(update_fields=["timezone"])
    schedule = Schedule.objects.create(
        contact=contact, mode="fixed", interval_min_days=2, interval_max_days=2
    )
    base = datetime(2026, 3, 7, 14, 0, tzinfo=UTC)
    point = create_next_touchpoint(schedule.id, base_at=base)
    local_due = point.due_at.astimezone(ZoneInfo("America/New_York"))
    assert local_due.hour == 9


def test_draft_uses_only_opted_in_context(client, contact):
    Memory.objects.create(contact=contact, content="likes hiking", allow_drafting=True)
    Memory.objects.create(contact=contact, content="new job", allow_drafting=True)
    Memory.objects.create(contact=contact, content="secret detail", allow_drafting=False)
    response = client.post(
        "/api/v1/messages/generate/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
        },
    )
    assert response.status_code == 201
    snapshot = response.data["context_snapshot"]
    assert [item["content"] for item in snapshot["memories"]] == ["likes hiking", "new job"]
    assert "likes hiking" in response.data["body"]
    assert "new job" in response.data["body"]
    assert "secret detail" not in response.data["body"]


def test_whatsapp_handoff_requires_approval_and_is_idempotent(client, contact):
    message = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Hi Maya!",
        status=Message.Status.APPROVED,
    )
    headers = {"HTTP_IDEMPOTENCY_KEY": "send-1"}
    first = client.post(f"/api/v1/messages/{message.id}/send/", {}, **headers)
    second = client.post(f"/api/v1/messages/{message.id}/send/", {}, **headers)
    assert first.status_code == second.status_code == 200
    assert first.data["handoff_url"].startswith("https://wa.me/14155552671")
    assert message.delivery_attempts.count() == 1


def test_message_cannot_be_created_preapproved(client, contact):
    response = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello",
            "status": "approved",
        },
    )
    assert response.status_code == 400


def test_contact_can_be_updated_and_emailed(client, contact):
    updated = client.patch(
        f"/api/v1/contacts/{contact.id}/",
        {"name": "Maya Updated", "email": "maya.updated@example.com", "preferred_channel": "email"},
        format="json",
    )
    assert updated.status_code == 200
    message = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Hello Maya",
        status=Message.Status.APPROVED,
    )
    response = client.post(
        f"/api/v1/messages/{message.id}/send/",
        {"channel": "email"},
        format="json",
        HTTP_IDEMPOTENCY_KEY="email-1",
    )
    assert response.status_code == 200
    assert response.data["handoff_url"].startswith("mailto:maya.updated@example.com?subject=")
    assert "body=Hello%20Maya" in response.data["handoff_url"]


def test_telegram_and_messenger_links_are_ready_to_open(client, contact):
    contact.telegram = "+8801711123456"
    contact.messenger = "https://m.me/rafiq.ahmed.10"
    contact.save(update_fields=["telegram", "messenger"])
    message = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Hey Rafiq",
        status=Message.Status.APPROVED,
        channel="telegram",
    )
    telegram = client.get(f"/api/v1/messages/{message.id}/send-sheet/")
    assert telegram.status_code == 200
    assert telegram.data["deep_link"].startswith("https://t.me/+8801711123456?text=")
    assert telegram.data["copy_text"] == "Hey Rafiq"
    message.channel = "messenger"
    message.save(update_fields=["channel"])
    messenger = client.get(f"/api/v1/messages/{message.id}/send-sheet/")
    assert messenger.status_code == 200
    assert messenger.data["deep_link"] == "https://m.me/rafiq.ahmed.10"
    assert messenger.data["link_prefilled"] is False
    assert messenger.data["copy_text"] == "Hey Rafiq"


def test_failed_handoff_is_recorded(client, contact):
    contact.whatsapp = "invalid"
    contact.save(update_fields=["whatsapp"])
    message = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Hi",
        status=Message.Status.APPROVED,
    )
    response = client.post(
        f"/api/v1/messages/{message.id}/send/",
        {},
        HTTP_IDEMPOTENCY_KEY="failed-1",
    )
    assert response.status_code == 400
    assert message.delivery_attempts.get().status == "failed"


def test_overview_contains_actionable_metrics(client, contact):
    Interaction.objects.create(contact=contact, kind="message", occurred_at=timezone.now())
    response = client.get("/api/v1/analytics/overview/")
    assert response.status_code == 200
    assert response.data["active_contacts"] == 1
    assert response.data["contacted_last_30_days"] in {0, 1}


def test_approved_message_waits_for_the_schedule_then_sends(client, contact):
    schedule = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 14, "interval_max_days": 14},
    )
    assert schedule.status_code == 201
    draft = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello Maya",
        },
    )
    assert draft.status_code == 201
    approved = client.patch(
        f"/api/v1/messages/{draft.data['id']}/",
        {"status": "approved", "channel": "whatsapp"},
        format="json",
    )
    assert approved.status_code == 200
    assert approved.data["status"] == "approved"
    assert approved.data["handoff_url"] == ""
    message = Message.objects.get(pk=draft.data["id"])
    assert message.scheduled_for == Touchpoint.objects.get().due_at
    message.scheduled_for = timezone.now() - timedelta(minutes=1)
    message.save(update_fields=["scheduled_for"])
    released = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert released.status_code == 200
    notice = released.data["results"][0]
    assert notice["message_id"] == str(message.id)
    # the app opens Review draft when this push is tapped (useNotificationNavigation.ts)
    assert notice["push"]["type"] == "reminder"
    assert notice["push"]["draft_id"] == str(message.id)
    message.refresh_from_db()
    assert message.status == "queued"
    assert message.delivery_attempts.count() == 1
    sheet = client.get(f"/api/v1/messages/{message.id}/send-sheet/")
    assert sheet.status_code == 200
    assert sheet.data["deep_link"].startswith("https://wa.me/14155552671?text=")
    assert sheet.data["link_prefilled"] is True
    again = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert again.data["results"][0]["id"] == notice["id"]
    assert message.delivery_attempts.count() == 1


def test_due_touchpoint_sends_a_notification(client, contact):
    schedule = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 7, "interval_max_days": 7},
    )
    point = Touchpoint.objects.get(schedule_id=schedule.data["id"])
    point.due_at = timezone.now() - timedelta(minutes=1)
    point.save(update_fields=["due_at"])
    released = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert released.status_code == 200
    notice = released.data["results"][0]
    assert notice["kind"] == "touchpoint"
    assert notice["touchpoint_id"] == str(point.id)
    assert notice["contact_name"] == "Maya"
    assert notice["message_id"] is None
    point.refresh_from_db()
    assert point.status == "overdue"
    again = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert [item["id"] for item in again.data["results"]] == [notice["id"]]
    opened = client.post(f"/api/v1/notifications/{notice['id']}/open/", {}, format="json")
    assert opened.status_code == 200
    cleared = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert cleared.data["results"] == []


def test_opening_a_send_link_marks_the_message_sent(client, contact):
    message = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Hello Maya",
        status=Message.Status.QUEUED,
        channel="whatsapp",
    )
    marked = client.post(f"/api/v1/messages/{message.id}/mark-sent/", {}, format="json")
    assert marked.status_code == 200
    assert marked.data["status"] == "sent"
    again = client.post(f"/api/v1/messages/{message.id}/mark-sent/", {}, format="json")
    assert again.status_code == 200
    assert again.data["status"] == "sent"
    draft = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Still a draft",
        status=Message.Status.DRAFT,
    )
    denied = client.post(f"/api/v1/messages/{draft.id}/mark-sent/", {}, format="json")
    assert denied.status_code == 400


def test_unsent_message_is_reminded_after_one_day(client, contact):
    late = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Still waiting",
        status=Message.Status.QUEUED,
        channel="whatsapp",
        scheduled_for=timezone.now() - timedelta(days=1, minutes=5),
    )
    SendNotification.objects.create(
        user=contact.user,
        message=late,
        title=f"Message for {contact.name}",
        body="Your WhatsApp is ready to send.",
        route=f"/send/{late.id}",
        opened_at=timezone.now() - timedelta(hours=2),
    )
    recent = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Still on time",
        status=Message.Status.QUEUED,
        channel="whatsapp",
        scheduled_for=timezone.now() - timedelta(hours=2),
    )
    SendNotification.objects.create(
        user=contact.user,
        message=recent,
        title=f"Message for {contact.name}",
        body="Your WhatsApp is ready to send.",
        route=f"/send/{recent.id}",
        opened_at=timezone.now(),
    )
    released = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert released.status_code == 200
    notice = next(item for item in released.data["results"] if item["message_id"] == str(late.id))
    assert notice["title"] == "Message to Maya was not sent"
    assert "A day has passed" in notice["body"]
    recent.notification.refresh_from_db()
    assert recent.notification.title == f"Message for {contact.name}"
    opened = client.post(f"/api/v1/notifications/{notice['id']}/open/", {}, format="json")
    assert opened.status_code == 200
    again = client.post("/api/v1/messages/dispatch-due/", {}, format="json")
    assert all(item["message_id"] != str(late.id) for item in again.data["results"])


def test_draft_schedule_accepts_one_minute_through_any_day(client, contact):
    draft = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello Maya",
        },
    )
    soon = client.patch(
        f"/api/v1/messages/{draft.data['id']}/",
        {"status": "approved", "channel": "whatsapp", "send_in": 1, "send_unit": "minutes"},
        format="json",
    )
    assert soon.status_code == 200
    message = Message.objects.get(pk=draft.data["id"])
    wait = message.scheduled_for - timezone.now()
    assert timedelta(seconds=50) < wait < timedelta(seconds=70)

    later = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "See you then",
        },
    )
    far = client.patch(
        f"/api/v1/messages/{later.data['id']}/",
        {"status": "approved", "channel": "email", "send_in": 400, "send_unit": "days"},
        format="json",
    )
    assert far.status_code == 200
    scheduled = Message.objects.get(pk=later.data["id"])
    assert timedelta(days=399) < scheduled.scheduled_for - timezone.now() < timedelta(days=401)
    invalid = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Too soon",
        },
    )
    too_small = client.patch(
        f"/api/v1/messages/{invalid.data['id']}/",
        {"status": "approved", "channel": "whatsapp", "send_in": 0, "send_unit": "minutes"},
        format="json",
    )
    assert too_small.status_code == 400


def test_scheduled_and_old_messages_can_be_edited_or_deleted(client, contact):
    created = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello Maya",
            "channel": "whatsapp",
        },
    )
    approved = client.patch(
        f"/api/v1/messages/{created.data['id']}/",
        {"status": "approved", "channel": "whatsapp", "send_in": 2, "send_unit": "days"},
        format="json",
    )
    assert approved.status_code == 200
    edited = client.patch(
        f"/api/v1/messages/{created.data['id']}/",
        {"body": "Updated hello"},
        format="json",
    )
    assert edited.status_code == 200
    assert edited.data["status"] == "approved"
    assert edited.data["body"] == "Updated hello"
    assert edited.data["scheduled_for"] == approved.data["scheduled_for"]
    deleted = client.delete(f"/api/v1/messages/{created.data['id']}/")
    assert deleted.status_code == 204

    released = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Ready to send",
        status=Message.Status.QUEUED,
        channel="whatsapp",
    )
    locked_ready = client.patch(
        f"/api/v1/messages/{released.id}/",
        {"body": "Change a sent message"},
        format="json",
    )
    assert locked_ready.status_code == 400
    assert client.delete(f"/api/v1/messages/{released.id}/").status_code == 204

    finished = Message.objects.create(
        contact=contact,
        purpose="check_in",
        tone="friendly",
        length="short",
        body="Already sent",
        status=Message.Status.SENT,
        channel="whatsapp",
    )
    locked = client.patch(
        f"/api/v1/messages/{finished.id}/",
        {"body": "Change the past"},
        format="json",
    )
    assert locked.status_code == 400
    removed = client.delete(f"/api/v1/messages/{finished.id}/")
    assert removed.status_code == 204
    assert not Message.objects.filter(pk=finished.id).exists()


def test_draft_can_be_edited_and_deleted(client, contact):
    created = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello Maya",
        },
    )
    updated = client.patch(
        f"/api/v1/messages/{created.data['id']}/",
        {"body": "Updated hello", "purpose": "gratitude"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["status"] == "draft"
    assert updated.data["body"] == "Updated hello"
    assert updated.data["purpose"] == "gratitude"
    deleted = client.delete(f"/api/v1/messages/{created.data['id']}/")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/messages/{created.data['id']}/").status_code == 404


def test_approval_requires_a_schedule(client, contact):
    draft = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello Maya",
        },
    )
    response = client.patch(
        f"/api/v1/messages/{draft.data['id']}/",
        {"status": "approved", "channel": "email"},
        format="json",
    )
    assert response.status_code == 400


def test_overdue_message_is_released_on_approval(client, contact):
    schedule = client.post(
        f"/api/v1/contacts/{contact.id}/schedules/",
        {"mode": "fixed", "interval_min_days": 7, "interval_max_days": 7},
    )
    point = Touchpoint.objects.get(schedule_id=schedule.data["id"])
    point.due_at = timezone.now() - timedelta(minutes=5)
    point.save(update_fields=["due_at"])
    draft = client.post(
        "/api/v1/messages/",
        {
            "contact": str(contact.id),
            "purpose": "check_in",
            "tone": "friendly",
            "length": "short",
            "body": "Hello Maya",
            "channel": "email",
        },
    )
    approved = client.patch(
        f"/api/v1/messages/{draft.data['id']}/",
        {"status": "approved", "channel": "email"},
        format="json",
    )
    assert approved.status_code == 200
    assert approved.data["status"] == "queued"
    sheet = client.get(f"/api/v1/messages/{draft.data['id']}/send-sheet/")
    assert sheet.data["deep_link"].startswith("mailto:maya@example.com?subject=")
    assert "Hello%20Maya" in sheet.data["deep_link"]
    assert sheet.data["recipient"] == "maya@example.com"
    assert sheet.data["body"] == "Hello Maya"
    assert mail.outbox == []
    point.refresh_from_db()
    assert point.status == "upcoming"


def test_end_to_end_relationship_workflow(client):
    contact_response = client.post(
        "/api/v1/contacts/",
        {
            "name": "Jordan",
            "email": "jordan@example.com",
            "whatsapp": "+14155552671",
            "relationship": "colleague",
            "preferred_channel": "whatsapp",
        },
    )
    assert contact_response.status_code == 201
    contact_id = contact_response.data["id"]
    assert (
        client.post(
            f"/api/v1/contacts/{contact_id}/memories/",
            {"content": "Recently started a new role", "allow_drafting": True},
        ).status_code
        == 201
    )
    schedule_response = client.post(
        f"/api/v1/contacts/{contact_id}/schedules/",
        {
            "mode": "fixed",
            "interval_min_days": 30,
            "interval_max_days": 30,
        },
    )
    assert schedule_response.status_code == 201
    point = Touchpoint.objects.get(schedule_id=schedule_response.data["id"])
    draft = client.post(
        "/api/v1/messages/generate/",
        {
            "contact": contact_id,
            "touchpoint": str(point.id),
            "purpose": "congratulations",
            "tone": "professional",
            "length": "short",
        },
    )
    assert draft.status_code == 201
    approved = client.patch(
        f"/api/v1/messages/{draft.data['id']}/",
        {"body": f"{draft.data['body']} Congratulations!", "status": "approved"},
    )
    assert approved.status_code == 200
    handoff = client.post(
        f"/api/v1/messages/{draft.data['id']}/send/",
        {},
        HTTP_IDEMPOTENCY_KEY="e2e-handoff",
    )
    assert handoff.status_code == 200
    assert (
        client.post(
            f"/api/v1/contacts/{contact_id}/interactions/",
            {
                "kind": "message",
                "channel": "whatsapp",
                "touchpoint": str(point.id),
                "occurred_at": timezone.now().isoformat(),
            },
        ).status_code
        == 201
    )
    point.refresh_from_db()
    assert point.status == "completed"
    assert (
        Touchpoint.objects.filter(
            schedule_id=schedule_response.data["id"], status="upcoming"
        ).count()
        == 1
    )


def test_contact_accepts_own_tag_ids_and_rejects_other_users_tags(client, contact, user):
    from apps.contacts.models import Tag

    mine = Tag.objects.create(user=user, name="college")
    other_user = User.objects.create_user(email="other@example.com", password="x-pass-12345")
    theirs = Tag.objects.create(user=other_user, name="secret")

    ok = client.patch(f"/api/v1/contacts/{contact.id}/", {"tag_ids": [str(mine.id)]}, format="json")
    assert ok.status_code == 200, ok.data
    assert [t["name"] for t in ok.data["tags"]] == ["college"]

    bad = client.patch(
        f"/api/v1/contacts/{contact.id}/", {"tag_ids": [str(theirs.id)]}, format="json"
    )
    assert bad.status_code == 400
