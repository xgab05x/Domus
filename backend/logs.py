"""Registro attività Domus: armo/disarmo, accensioni, modifiche editor, eventi sicurezza.

Ogni voce ricorda da quale interfaccia (tablet/browser) è arrivato il comando.
"""
import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

MAX_LOGS = 5000
KINDS = ("alarm", "entity", "editor", "security", "automation", "cast", "media", "system")
LABELS = {"alarm": "Antintrusione", "entity": "Dispositivi", "editor": "Modifiche", "security": "Sicurezza",
          "automation": "Automazioni", "cast": "Trasmissioni", "media": "Media", "system": "Sistema"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def add(db, kind: str, message: str, *, device: Optional[Dict[str, Any]] = None, entity_id: str = "",
              entity_name: str = "", before: Any = None, after: Any = None, level: str = "info",
              detail: str = "", pin_used: bool = False) -> Dict[str, Any]:
    doc = {"id": str(uuid.uuid4()), "ts": now_iso(), "kind": kind if kind in KINDS else "system", "message": message,
           "entity_id": entity_id, "entity_name": entity_name, "before": before, "after": after, "level": level,
           "detail": detail, "pin_used": pin_used,
           "device_id": (device or {}).get("id") or "", "device_name": (device or {}).get("name") or "Sconosciuto"}
    await db.logs.insert_one(dict(doc))
    if await db.logs.estimated_document_count() > MAX_LOGS + 200:
        old = await db.logs.find({}, {"_id": 1, "ts": 1}).sort("ts", 1).limit(250).to_list(250)
        if old:
            await db.logs.delete_many({"_id": {"$in": [o["_id"] for o in old]}})
    return doc


async def query(db, kind: str = "", entity_id: str = "", device_id: str = "", search: str = "",
                since: str = "", limit: int = 200) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if kind and kind != "all":
        q["kind"] = kind
    if entity_id:
        q["entity_id"] = entity_id
    if device_id:
        q["device_id"] = device_id
    if since:
        q["ts"] = {"$gte": since}
    if search:
        q["$or"] = [{"message": {"$regex": search, "$options": "i"}}, {"entity_name": {"$regex": search, "$options": "i"}},
                    {"device_name": {"$regex": search, "$options": "i"}}]
    return await db.logs.find(q, {"_id": 0}).sort("ts", -1).limit(max(1, min(limit, 1000))).to_list(1000)


def to_csv(rows: List[Dict[str, Any]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Data/ora", "Tipo", "Messaggio", "Dispositivo Domus", "Entità", "Prima", "Dopo", "PIN", "Livello"])
    for r in rows:
        w.writerow([r.get("ts", ""), LABELS.get(r.get("kind", ""), r.get("kind", "")), r.get("message", ""), r.get("device_name", ""),
                    r.get("entity_name", ""), _flat(r.get("before")), _flat(r.get("after")), "sì" if r.get("pin_used") else "", r.get("level", "")])
    return buf.getvalue()


def _flat(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return ", ".join(f"{k}={_flat(v)}" for k, v in value.items())
    if isinstance(value, bool):
        return "acceso" if value else "spento"
    if isinstance(value, list):
        return ", ".join(_flat(v) for v in value)
    return str(value)


def describe(patch: Dict[str, Any]) -> str:
    """Testo leggibile per un cambio di stato (usato nei messaggi di log)."""
    parts = []
    for k, v in (patch or {}).items():
        if k == "on":
            parts.append("acceso" if v else "spento")
        elif k == "brightness":
            parts.append(f"luminosità {v}%")
        elif k == "rgb":
            parts.append("colore aggiornato")
        elif k == "color_temp":
            parts.append(f"temperatura colore {v}K")
        elif k == "effect":
            parts.append(f"effetto LED «{v}»")
        elif k == "target_temp":
            parts.append(f"target {v}°")
        elif k == "privacy":
            parts.append("privacy attiva" if v else "privacy disattiva")
        elif k == "siren":
            parts.append("sirena attiva" if v else "sirena spenta")
        elif k == "locked":
            parts.append("porta chiusa" if v else "porta aperta")
        else:
            parts.append(f"{k}: {_flat(v)}")
    return ", ".join(parts) or "aggiornato"
