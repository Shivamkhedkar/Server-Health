"""Unit tests for the actual outbound notification dispatch (email +
Telegram), using monkeypatched smtplib/httpx so the test suite never makes
a real network call. Covers success and failure for each channel -
previously untested (test_new_features.py only exercised the threshold/
alert-creation logic, never whether a notification is actually sent)."""
import pytest

from app.services import notification_service, settings_service
from app.core.config import settings


def _enable_email(db, recipient="ops@example.com"):
    settings_service.update_settings(db, {
        "email_alerts_enabled": "true",
        "alert_recipient_email": recipient,
    })


def _enable_telegram(db):
    settings_service.update_settings(db, {"telegram_alerts_enabled": "true"})


@pytest.mark.unit
def test_email_alert_skipped_when_disabled(test_db):
    settings_service.update_settings(test_db, {"email_alerts_enabled": "false"})
    ok, msg = notification_service.send_email_alert(test_db, "Test", "body")
    assert ok is False
    assert "disabled" in msg.lower()


@pytest.mark.unit
def test_email_alert_success(test_db, monkeypatch):
    _enable_email(test_db)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USER", "alerts@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "fake-password")

    class FakeSMTP:
        def __init__(self, *a, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            pass

        def login(self, *a, **kw):
            pass

        def send_message(self, *a, **kw):
            pass

    monkeypatch.setattr(notification_service.smtplib, "SMTP", FakeSMTP)

    ok, msg = notification_service.send_email_alert(test_db, "Test", "body")
    assert ok is True
    assert "sent" in msg.lower()


@pytest.mark.unit
def test_email_alert_failure_is_reported_not_raised(test_db, monkeypatch):
    _enable_email(test_db)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USER", "alerts@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "fake-password")

    class ExplodingSMTP:
        def __init__(self, *a, **kw):
            raise ConnectionRefusedError("SMTP server unreachable")

    monkeypatch.setattr(notification_service.smtplib, "SMTP", ExplodingSMTP)

    ok, msg = notification_service.send_email_alert(test_db, "Test", "body")
    assert ok is False
    assert "failed" in msg.lower()


@pytest.mark.unit
def test_telegram_alert_skipped_when_disabled(test_db):
    settings_service.update_settings(test_db, {"telegram_alerts_enabled": "false"})
    ok, msg = notification_service.send_telegram_alert(test_db, "body")
    assert ok is False
    assert "disabled" in msg.lower()


@pytest.mark.unit
def test_telegram_alert_success(test_db, monkeypatch):
    _enable_telegram(test_db)
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "fake-token")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "12345")

    class FakeResponse:
        status_code = 200
        text = "ok"

    monkeypatch.setattr(notification_service.httpx, "post", lambda *a, **kw: FakeResponse())

    ok, msg = notification_service.send_telegram_alert(test_db, "body")
    assert ok is True


@pytest.mark.unit
def test_telegram_alert_failure_from_api_error(test_db, monkeypatch):
    _enable_telegram(test_db)
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "fake-token")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "12345")

    class FakeResponse:
        status_code = 400
        text = "Bad Request: chat not found"

    monkeypatch.setattr(notification_service.httpx, "post", lambda *a, **kw: FakeResponse())

    ok, msg = notification_service.send_telegram_alert(test_db, "body")
    assert ok is False
    assert "error" in msg.lower()


@pytest.mark.unit
def test_telegram_alert_failure_from_network_exception(test_db, monkeypatch):
    _enable_telegram(test_db)
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "fake-token")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "12345")

    def _raise(*a, **kw):
        raise ConnectionError("network unreachable")

    monkeypatch.setattr(notification_service.httpx, "post", _raise)

    ok, msg = notification_service.send_telegram_alert(test_db, "body")
    assert ok is False
    assert "failed" in msg.lower()
