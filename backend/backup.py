"""Local JSON backups of the Domus configuration (rooms, entities, scenes, groups, climate, energy, views, settings)."""
import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("domus.backup")

COLLECTIONS = ["rooms", "entities", "groups", "scenes", "thermostats", "zones", "meters", "charts", "views"]
# Secrets and security state never leave (or re-enter) the app through a backup file.
SETTINGS_EXCLUDE = {"ha_token", "seed_version", "backup_last", "id", "pin_hash", "pin_failed", "pin_locked_until",
                    "pin_enabled", "pin_protect_disarm", "pin_protect_sensitive", "pin_set",
                    "alarm_ha_code", "alarm_code_set", "alarm_armed", "alarm_ha_state"}
NOID = {"_id": 0}
DEFAULT_DIR = os.environ.get("BACKUP_DIR", "/var/lib/domus/backups")
NAME_RE = re.compile(r"^domus-(\d{8}-\d{6})(?:-(.+))?\.json$")
AUTO_PERIOD = {"daily": 86400, "weekly": 7 * 86400, "hourly": 3600}


def resolve_dir(settings: Dict[str, Any]) -> Path:
    return Path(os.path.expanduser(settings.get("backup_dir") or DEFAULT_DIR))


def check_dir(path: Path) -> Dict[str, Any]:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".domus-write-test"
        probe.write_text("ok")
        probe.unlink()
        return {"path": str(path), "writable": True, "error": None}
    except Exception as exc:  # noqa: BLE001
        return {"path": str(path), "writable": False, "error": f"{type(exc).__name__}: {exc}"}


def safe_name(name: str) -> str:
    if not NAME_RE.match(name or ""):
        raise ValueError("Nome backup non valido")
    return name


async def snapshot(db) -> Dict[str, Any]:
    data = {c: await db[c].find({}, NOID).to_list(20000) for c in COLLECTIONS}
    settings = await db.settings.find_one({"id": "singleton"}, NOID) or {}
    return {"app": "Domus", "format": 1, "created_at": datetime.now(timezone.utc).isoformat(),
            "counts": {c: len(v) for c, v in data.items()}, "collections": data,
            "settings": {k: v for k, v in settings.items() if k not in SETTINGS_EXCLUDE}}


def describe(path: Path) -> Dict[str, Any]:
    m = NAME_RE.match(path.name)
    st = path.stat()
    info: Dict[str, Any] = {"name": path.name, "size": st.st_size, "created_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
                            "label": (m.group(2) if m else None), "counts": {}, "valid": False}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        info["counts"] = data.get("counts") or {c: len(v) for c, v in (data.get("collections") or {}).items()}
        info["created_at"] = data.get("created_at") or info["created_at"]
        info["valid"] = data.get("app") == "Domus" and isinstance(data.get("collections"), dict)
    except Exception as exc:  # noqa: BLE001
        info["error"] = str(exc)[:120]
    return info


def list_backups(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    files = sorted((p for p in path.glob("domus-*.json") if NAME_RE.match(p.name)), key=lambda p: p.stat().st_mtime, reverse=True)
    return [describe(p) for p in files]


async def create(db, settings: Dict[str, Any], label: Optional[str] = None, auto: bool = False) -> Dict[str, Any]:
    path = resolve_dir(settings)
    chk = check_dir(path)
    if not chk["writable"]:
        raise PermissionError(chk["error"])
    data = await snapshot(db)
    data["auto"] = auto
    tag = re.sub(r"[^A-Za-z0-9_]+", "_", label or ("auto" if auto else "")).strip("_")[:40]
    name = f"domus-{datetime.now().strftime('%Y%m%d-%H%M%S')}{('-' + tag) if tag else ''}.json"
    target = path / name
    tmp = path / (name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, target)
    await db.settings.update_one({"id": "singleton"}, {"$set": {"backup_last": data["created_at"]}}, upsert=True)
    return describe(target)


def prune(path: Path, keep: int) -> int:
    if keep <= 0:
        return 0
    autos = [p for p in sorted(path.glob("domus-*-auto.json"), key=lambda p: p.stat().st_mtime, reverse=True)]
    removed = 0
    for p in autos[keep:]:
        p.unlink(missing_ok=True)
        removed += 1
    return removed


def validate(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict) or data.get("app") != "Domus" or not isinstance(data.get("collections"), dict):
        raise ValueError("File non riconosciuto come backup Domus")
    return data


async def restore(db, data: Dict[str, Any], include_settings: bool = True) -> Dict[str, int]:
    data = validate(data)
    counts: Dict[str, int] = {}
    for coll in COLLECTIONS:
        docs = data["collections"].get(coll)
        if docs is None:
            continue
        await db[coll].delete_many({})
        if docs:
            await db[coll].insert_many([dict(d) for d in docs])
        counts[coll] = len(docs)
    if include_settings and isinstance(data.get("settings"), dict):
        upd = {k: v for k, v in data["settings"].items() if k not in SETTINGS_EXCLUDE}
        if upd:
            await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
        counts["settings"] = len(upd)
    return counts


def load_file(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return validate(json.load(f))


async def scheduler_loop(db, get_settings, interval: int = 600):
    await asyncio.sleep(20)
    while True:
        try:
            settings = await get_settings()
            mode = settings.get("backup_auto", "daily")
            period = AUTO_PERIOD.get(mode)
            if period:
                path = resolve_dir(settings)
                autos = list(path.glob("domus-*-auto.json")) if path.exists() else []
                last = max((p.stat().st_mtime for p in autos), default=0)
                if time.time() - last >= period:
                    info = await create(db, settings, auto=True)
                    prune(path, int(settings.get("backup_retention", 10) or 10))
                    logger.info("automatic backup written: %s", info["name"])
        except Exception as exc:  # noqa: BLE001
            logger.warning("backup scheduler error: %s", exc)
        await asyncio.sleep(interval)
