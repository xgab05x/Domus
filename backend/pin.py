"""Household PIN: PBKDF2 hashing, verification and brute-force lockout (state lives in the settings doc)."""
import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

ITERATIONS = 200_000
MAX_FAILURES = 5
LOCK_SECONDS = 60
PIN_RE = re.compile(r"^\d{4,6}$")
DEFAULT_PIN = "1234"
SENSITIVE_STATE_KEYS = ("privacy", "siren", "locked")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def valid_format(pin: str) -> bool:
    return bool(pin and PIN_RE.match(pin))


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, ITERATIONS, dklen=32)
    return f"pbkdf2_sha256${ITERATIONS}${_b64(salt)}${_b64(digest)}"


def verify_hash(pin: str, encoded: str) -> bool:
    try:
        algo, iterations, salt, expected = encoded.split("$")
        if algo != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", (pin or "").encode(), _unb64(salt), int(iterations), dklen=32)
        return hmac.compare_digest(actual, _unb64(expected))
    except (ValueError, TypeError, AttributeError):
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def lock_remaining(doc: Dict[str, Any]) -> int:
    until = doc.get("pin_locked_until")
    if not until:
        return 0
    try:
        left = (datetime.fromisoformat(until) - _now()).total_seconds()
    except (ValueError, TypeError):
        return 0
    return max(0, int(left + 0.999))


async def check(db, doc: Dict[str, Any], pin: str) -> Tuple[bool, int]:
    """Verify a PIN against the stored hash. Returns (ok, lock_seconds_remaining)."""
    left = lock_remaining(doc)
    if left:
        return False, left
    if verify_hash(pin, doc.get("pin_hash") or ""):
        await db.settings.update_one({"id": "singleton"}, {"$set": {"pin_failed": 0, "pin_locked_until": None}})
        return True, 0
    failed = int(doc.get("pin_failed") or 0) + 1
    upd: Dict[str, Any] = {"pin_failed": failed, "pin_locked_until": None}
    if failed >= MAX_FAILURES:
        upd = {"pin_failed": 0, "pin_locked_until": (_now() + timedelta(seconds=LOCK_SECONDS)).isoformat()}
    await db.settings.update_one({"id": "singleton"}, {"$set": upd})
    return False, LOCK_SECONDS if upd["pin_locked_until"] else 0


async def change(db, doc: Dict[str, Any], current: Optional[str], new: str) -> None:
    """Set a new PIN. When a PIN already exists the current one must match."""
    from fastapi import HTTPException
    if not valid_format(new):
        raise HTTPException(400, "Il PIN deve avere 4-6 cifre")
    if doc.get("pin_hash"):
        ok, left = await check(db, doc, current or "")
        if left:
            raise HTTPException(429, f"Troppi tentativi errati: riprova tra {left} secondi")
        if not ok:
            raise HTTPException(401, "PIN attuale errato")
    await db.settings.update_one({"id": "singleton"}, {"$set": {"pin_hash": hash_pin(new), "pin_failed": 0, "pin_locked_until": None}})


def status(doc: Dict[str, Any]) -> Dict[str, Any]:
    left = lock_remaining(doc)
    return {"enabled": bool(doc.get("pin_enabled", True)), "pin_set": bool(doc.get("pin_hash")),
            "protect_disarm": bool(doc.get("pin_protect_disarm", True)), "protect_sensitive": bool(doc.get("pin_protect_sensitive", True)),
            "locked": left > 0, "lock_seconds": left, "attempts_left": max(0, MAX_FAILURES - int(doc.get("pin_failed") or 0)), "max_attempts": MAX_FAILURES}


def required_for(doc: Dict[str, Any], scope: str) -> bool:
    if not doc.get("pin_enabled", True) or not doc.get("pin_hash"):
        return False
    if scope == "disarm":
        return bool(doc.get("pin_protect_disarm", True))
    return bool(doc.get("pin_protect_sensitive", True))
