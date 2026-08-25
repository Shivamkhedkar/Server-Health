import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services import settings_service

logger = logging.getLogger("devops_monitor.notifications")


def send_email_alert(db: Session, subject: str, message: str) -> tuple[bool, str]:
    cfg = settings_service.get_all_settings(db)
    if cfg.get("email_alerts_enabled", "false").lower() != "true":
        return False, "Email alerts are disabled."

    recipient = cfg.get("alert_recipient_email", "").strip()
    if not recipient:
        return False, "No alert recipient email configured."

    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD]):
        return False, "SMTP is not configured on the server (check SMTP_* env vars)."

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SMTP_USER
        msg["To"] = recipient
        msg["Subject"] = f"[Server Health Monitor] {subject}"
        msg.attach(MIMEText(message, "plain"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info("Email alert sent to %s: %s", recipient, subject)
        return True, f"Email sent to {recipient}."
    except Exception as exc:
        logger.error("Failed to send email alert: %s", exc)
        return False, f"Failed to send email alert: {exc}"


def send_telegram_alert(db: Session, message: str) -> tuple[bool, str]:
    cfg = settings_service.get_all_settings(db)
    if cfg.get("telegram_alerts_enabled", "false").lower() != "true":
        return False, "Telegram alerts are disabled."

    bot_token = settings.TELEGRAM_BOT_TOKEN
    chat_id = cfg.get("telegram_chat_id_override", "").strip() or settings.TELEGRAM_CHAT_ID

    if not bot_token or not chat_id:
        return False, "Telegram bot token or chat ID is not configured."

    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": f"\U0001f6a8 Server Health Alert\n\n{message}",
        }
        resp = httpx.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            logger.info("Telegram alert sent.")
            return True, "Telegram message sent."
        logger.error("Telegram API error: %s", resp.text)
        return False, f"Telegram API error: {resp.text}"
    except Exception as exc:
        logger.error("Failed to send Telegram alert: %s", exc)
        return False, f"Failed to send Telegram alert: {exc}"


def dispatch_alert_notifications(db: Session, alert_type: str, severity: str, message: str) -> None:
    """Fire-and-log notification dispatch for a newly created alert.
    Failures are logged but never raised - a broken SMTP/Telegram config
    should not prevent the alert from being recorded or the app from working."""
    subject = f"{severity}: {alert_type}"
    ok_email, msg_email = send_email_alert(db, subject, message)
    ok_tg, msg_tg = send_telegram_alert(db, message)
    if not ok_email:
        logger.debug("Email notification skipped/failed: %s", msg_email)
    if not ok_tg:
        logger.debug("Telegram notification skipped/failed: %s", msg_tg)
