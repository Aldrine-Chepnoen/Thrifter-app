"""Expo push notifications for the mobile app — mirrors sms.py's shape:
every send here is best-effort and non-blocking (a daemon thread, not
FastAPI's BackgroundTasks, since the vendor-follow digest sweep isn't always
running inside a request handler) and never raises to its caller.

Unlike sms.py there's no "not configured" dry-run branch: Expo's push API
needs no API key for a basic send, and in dev there simply won't be any real
device tokens registered unless a live Expo app actually logs in, so there's
no risk of an accidental real send from a dev box.
"""
import logging
import threading

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _send_now(expo_token: str, title: str, body: str) -> None:
    try:
        resp = requests.post(
            EXPO_PUSH_URL,
            json={"to": expo_token, "title": title, "body": body},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=15,
        )
        logger.info(f"Push sent to {expo_token}: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Push send to {expo_token} failed: {e}", exc_info=True)


def send_push(expo_token: str, title: str, body: str) -> None:
    if not expo_token:
        return
    threading.Thread(target=_send_now, args=(expo_token, title, body), daemon=True).start()
