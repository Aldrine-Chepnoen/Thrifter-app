"""
Send vendor phone-verification SMS via the Pahappa "Comms" API (EgoSMS's
current platform, at comms.egosms.co — not the older egosms.co/api/v1/plain/
GET-based API documented in various third-party blog posts, which appears to
be a legacy/deprecated endpoint with a separate user database).

Verified directly against https://developers.pahappa.com/docs/sending-sms/
and https://developers.pahappa.com/docs/balance-inquiry/ on 2026-08-26.

Deliberately standalone (like generate_verification_links.py): does not
import config.py, since that would pull in whatever's sitting in the local
.env instead of the real EgoSMS credentials passed in for this run. Reads
EGOSMS_USERNAME, EGOSMS_PASSWORD, and EGOSMS_SENDER directly from the
environment.

Dry-run by default — prints what would be sent without calling the API.
Pass --send to actually send.

Usage:
    # Dry run (default) - prints a sample of what would be sent, no network calls
    python send_sms_verification.py vendor_sms_verification_export.csv

    # Send one test message to a known number first
    EGOSMS_USERNAME=... EGOSMS_PASSWORD=... EGOSMS_SENDER=Thrifter \\
        python send_sms_verification.py --test-number 256700000000 --send

    # Real send to everyone in the CSV
    EGOSMS_USERNAME=... EGOSMS_PASSWORD=... EGOSMS_SENDER=Thrifter \\
        python send_sms_verification.py vendor_sms_verification_export.csv --send

Input CSV must have "vendor_name", "whatsapp", and "short_link" columns —
the output of GET /admin/vendors/sms-verification-export. Rows with no
short_link (no phone on file) are skipped.
"""
import argparse
import csv
import os
import re
import sys
import time

import requests

COMMS_URL = "https://comms.egosms.co/api/v1/json/"


def normalize_phone(raw: str) -> str:
    return re.sub(r"[^0-9]", "", raw)


def build_message(name: str, short_link: str) -> str:
    return f"Thrifter: Hi {name}, confirm your vendor account is active: {short_link}"


def _post(username: str, password: str, payload: dict) -> dict:
    body = {"userdata": {"username": username, "password": password}, **payload}
    resp = requests.post(COMMS_URL, json=body, headers={"Content-Type": "application/json"}, timeout=15)
    try:
        return resp.json()
    except ValueError:
        return {"Status": "Failed", "Message": f"Non-JSON response (HTTP {resp.status_code}): {resp.text[:200]}"}


def get_balance(username: str, password: str) -> dict:
    try:
        return _post(username, password, {"method": "Balance"})
    except requests.RequestException as e:
        return {"Status": "Failed", "Message": f"could not check balance: {e}"}


def send_sms(username: str, password: str, sender: str, number: str, message: str) -> dict:
    return _post(username, password, {
        "method": "SendSms",
        "msgdata": [{"number": number, "message": message, "senderid": sender, "priority": "0"}],
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", nargs="?", help="Path to the SMS verification export CSV")
    parser.add_argument("--send", action="store_true", help="Actually send via EgoSMS (default is dry-run)")
    parser.add_argument("--test-number", help="Send a single test message to this number and exit (ignores csv_path)")
    parser.add_argument("--cost-per-sms", type=float, default=35.0, help="UGX cost per SMS segment, for the balance sanity check")
    args = parser.parse_args()

    username = os.environ.get("EGOSMS_USERNAME")
    password = os.environ.get("EGOSMS_PASSWORD")
    sender = os.environ.get("EGOSMS_SENDER")
    if not username or not password or not sender:
        print("Set EGOSMS_USERNAME, EGOSMS_PASSWORD, and EGOSMS_SENDER environment variables before running.", file=sys.stderr)
        sys.exit(1)

    if args.test_number:
        number = normalize_phone(args.test_number)
        message = "Thrifter: this is a test message to confirm number formatting and delivery."
        if not args.send:
            print(f"[DRY RUN] Would send to {number}: {message}")
            print("Pass --send to actually send this test message.")
            return
        print(f"Balance before: {get_balance(username, password)}")
        result = send_sms(username, password, sender, number, message)
        print(f"EgoSMS response: {result}")
        return

    if not args.csv_path:
        print("Provide a CSV path (or use --test-number for a single test message).", file=sys.stderr)
        sys.exit(1)

    with open(args.csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [r for r in reader if r.get("short_link")]

    print(f"{len(rows)} vendors with a phone number and short link to message.")

    if not args.send:
        print("\n[DRY RUN] Showing first 3 messages as a sample:\n")
        for row in rows[:3]:
            number = normalize_phone(row["whatsapp"])
            message = build_message(row["vendor_name"], row["short_link"])
            print(f"  To: {row['whatsapp']} (normalized: {number})")
            print(f"  Message ({len(message)} chars): {message}\n")
        print("Pass --send to actually send to all of the above (and the rest of the CSV).")
        return

    balance = get_balance(username, password)
    print(f"EgoSMS balance before sending: {balance}")
    estimated_cost = len(rows) * args.cost_per_sms
    print(
        f"Sending to {len(rows)} vendors, estimated cost at {args.cost_per_sms} UGX/segment: "
        f"{estimated_cost:.0f} UGX (actual may be higher if any message needs more than one segment)"
    )

    for row in rows:
        number = normalize_phone(row["whatsapp"])
        message = build_message(row["vendor_name"], row["short_link"])
        try:
            result = send_sms(username, password, sender, number, message)
            print(f"  {row['vendor_name']:<30} {number:<15} -> {result}")
        except requests.RequestException as e:
            print(f"  {row['vendor_name']:<30} {number:<15} -> FAILED: {e}")
        time.sleep(0.2)

    print(f"\nDone. EgoSMS balance after: {get_balance(username, password)}")


if __name__ == "__main__":
    main()
