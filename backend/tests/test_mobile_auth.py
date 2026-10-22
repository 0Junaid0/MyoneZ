"""Mobile app auth: tokens in the JSON body when the X-Client: mobile header is sent."""

import re

import pytest
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

PASSWORD = "Str0ng-pass-123!"
MOBILE = {"HTTP_X_CLIENT": "mobile"}


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()


def last_code():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


def post(client, path, data, **extra):
    return client.post(f"/api/v1/auth/{path}/", data, format="json", **extra)


def verify(client, challenge, **extra):
    payload = {"challenge_id": challenge.json()["challenge_id"], "code": last_code()}
    return post(client, "verify-otp", payload, **extra)


@pytest.mark.django_db
def test_mobile_register_login_refresh():
    register = post(
        APIClient(),
        "register",
        {
            "email": "m@example.com",
            "password": PASSWORD,
            "name": "Nusrat Ahmmed Ekra",
            "timezone": "Asia/Dhaka",
        },
        **MOBILE,
    )
    assert register.status_code == 200
    verified = verify(APIClient(), register, **MOBILE)
    assert verified.status_code == 201
    body = verified.json()
    assert body["access"] and body["refresh"]
    assert body["name"] == "Nusrat Ahmmed Ekra"

    me = APIClient().get("/api/v1/users/me/", HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert me.status_code == 200
    assert me.json()["email"] == "m@example.com"

    refreshed = post(APIClient(), "refresh", {"refresh": body["refresh"]}, **MOBILE)
    assert refreshed.status_code == 200
    assert refreshed.json()["access"] and refreshed.json()["refresh"]

    reused = post(APIClient(), "refresh", {"refresh": body["refresh"]}, **MOBILE)
    assert reused.status_code == 401

    login = post(APIClient(), "login", {"email": "m@example.com", "password": PASSWORD}, **MOBILE)
    assert login.status_code == 200
    assert login.json()["otp_required"] is True
    assert verify(APIClient(), login, **MOBILE).json()["access"]


@pytest.mark.django_db
def test_web_clients_still_get_cookies_only():
    client = APIClient()
    register = post(
        client, "register", {"email": "w@example.com", "password": PASSWORD, "name": "Web User"}
    )
    verified = verify(client, register)
    assert verified.status_code == 201
    assert "access" not in verified.json()
    assert "pocketcrm_access" in verified.cookies
