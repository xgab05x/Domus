"""Motore automazioni Domus (stile SE-QUESTO-ALLORA-QUELLO).

Le automazioni reagiscono a: cambi di stato/valore di qualunque entità, squillo di un citofono,
cambi dell'antintrusione e orari. Le azioni possono accendere/spegnere entità, dare un impulso a un relè,
attivare scene, chiamare servizi Home Assistant, riprodurre audio/annunci, suonare una suoneria sui tablet,
mandare notifiche e armare/disarmare l'allarme.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

TRIGGER_TYPES = ("state", "ring", "alarm", "time")
ACTION_TYPES = ("entity", "pulse", "scene", "service", "media", "sound", "notify", "alarm", "delay")
OPS = ("eq", "ne", "gt", "lt", "gte", "lte", "changed", "on", "off", "contains")

_ctx: Dict[str, Any] = {}


def setup(**callbacks: Any) -> None:
    """Il server inietta db e le funzioni che l'engine può usare (evita import circolari)."""
    _ctx.update(callbacks)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def compare(current: Any, op: str, expected: Any) -> bool:
    if op == "changed":
        return True
    if op == "on":
        return bool(current) is True or current in ("on", "playing", "open", "triggered")
    if op == "off":
        return bool(current) is False or current in ("off", "idle", "closed")
    if op == "contains":
        return str(expected).lower() in str(current or "").lower()
    a, b = _num(current), _num(expected)
    if a is not None and b is not None:
        return {"eq": a == b, "ne": a != b, "gt": a > b, "lt": a < b, "gte": a >= b, "lte": a <= b}.get(op, False)
    sa, sb = str(current).lower(), str(expected).lower()
    return {"eq": sa == sb, "ne": sa != sb}.get(op, False)


async def _entity(entity_id: str) -> Optional[Dict[str, Any]]:
    if not entity_id:
        return None
    return await _ctx["db"].entities.find_one({"id": entity_id}, {"_id": 0})


async def conditions_ok(conds: List[Dict[str, Any]]) -> bool:
    for c in conds or []:
        ent = await _entity(c.get("entity_id", ""))
        if not ent:
            return False
        if not compare((ent.get("state") or {}).get(c.get("key", "on")), c.get("op", "eq"), c.get("value")):
            return False
    return True


def trigger_matches(trig: Dict[str, Any], event: str, payload: Dict[str, Any]) -> bool:
    if trig.get("type") != event:
        return False
    if event == "state":
        if trig.get("entity_id") and trig["entity_id"] != payload.get("entity_id"):
            return False
        key = trig.get("key") or "on"
        if key not in (payload.get("patch") or {}):
            return False
        return compare((payload.get("patch") or {}).get(key), trig.get("op", "changed"), trig.get("value"))
    if event == "ring":
        return not trig.get("entity_id") or trig["entity_id"] == payload.get("entity_id")
    if event == "alarm":
        want = trig.get("value") or "any"
        return want in ("any", "", payload.get("mode"), payload.get("ha_state"))
    if event == "time":
        return (trig.get("value") or "") == payload.get("hhmm")
    return False


async def fire(event: str, payload: Dict[str, Any]) -> None:
    """Valuta tutte le automazioni attive per un evento (non blocca il chiamante)."""
    db = _ctx.get("db")
    if db is None:
        return
    try:
        items = await db.automations.find({"enabled": True}, {"_id": 0}).to_list(300)
    except Exception as exc:  # noqa: BLE001
        logger.warning("automations read failed: %s", exc)
        return
    for a in items:
        trigs = a.get("triggers") or []
        hits = [t for t in trigs if trigger_matches(t, event, payload)]
        if not hits:
            continue
        if (a.get("match") or "any") == "all" and len(hits) != len(trigs):
            continue
        if not await conditions_ok(a.get("conditions")):
            continue
        asyncio.create_task(run(a, payload))


async def run(automation: Dict[str, Any], payload: Optional[Dict[str, Any]] = None) -> List[str]:
    """Esegue le azioni di un'automazione, riportando i messaggi delle azioni eseguite."""
    done: List[str] = []
    for action in automation.get("actions") or []:
        try:
            done.append(await run_action(action, payload or {}))
        except Exception as exc:  # noqa: BLE001
            logger.warning("automation action failed (%s): %s", action.get("type"), exc)
            done.append(f"errore: {str(exc)[:80]}")
    await _ctx["db"].automations.update_one({"id": automation["id"]}, {"$set": {"last_run": now_iso(), "last_result": ", ".join(done)[:400]}})
    await _ctx["log"]("automation", f"Automazione «{automation.get('name')}»: {', '.join(done)[:180] or 'nessuna azione'}",
                      device={"id": "automation", "name": f"Automazione · {automation.get('name')}"})
    await _ctx["broadcast"]({"type": "refresh"})
    return done


async def run_action(action: Dict[str, Any], payload: Dict[str, Any]) -> str:
    t = action.get("type")
    if t == "entity":
        ent = await _entity(action.get("entity_id", ""))
        if not ent:
            return "entità non trovata"
        await _ctx["apply_state"](ent["id"], action.get("state") or {})
        return f"{ent['name']} aggiornato"
    if t == "pulse":
        ent = await _entity(action.get("entity_id", ""))
        if not ent:
            return "entità non trovata"
        secs = max(0.2, min(float(action.get("seconds") or 1.5), 60))
        await _ctx["apply_state"](ent["id"], {"on": True})
        asyncio.create_task(_pulse_off(ent["id"], secs))
        return f"impulso su {ent['name']} ({secs:g}s)"
    if t == "scene":
        await _ctx["activate_scene"](action.get("scene_id", ""))
        return "scena attivata"
    if t == "service":
        domain, _, service = (action.get("service") or "").partition(".")
        if not (domain and service):
            return "servizio non valido"
        data = dict(action.get("data") or {})
        if action.get("entity_id"):
            data["entity_id"] = action["entity_id"]
        await _ctx["ha_call"](domain, service, data)
        return f"servizio {domain}.{service}"
    if t == "media":
        return await _ctx["media_action"](action)
    if t == "sound":
        await _ctx["broadcast"]({"type": "sound", "sound": action.get("sound") or "chime",
                                 "volume": action.get("volume", 70), "duration": action.get("duration", 6),
                                 "label": action.get("label") or "Automazione Domus"})
        return f"suoneria {action.get('sound') or 'chime'}"
    if t == "notify":
        await _ctx["notify"](action.get("level") or "info", action.get("title") or "Domus", action.get("message") or "")
        return "notifica inviata"
    if t == "alarm":
        await _ctx["set_alarm"](action.get("mode") or "away", action.get("pin"))
        return f"allarme → {action.get('mode') or 'away'}"
    if t == "delay":
        await asyncio.sleep(max(0.1, min(float(action.get("seconds") or 1), 300)))
        return f"attesa {action.get('seconds')}s"
    return f"tipo azione sconosciuto: {t}"


async def _pulse_off(entity_id: str, secs: float) -> None:
    await asyncio.sleep(secs)
    try:
        await _ctx["apply_state"](entity_id, {"on": False})
    except Exception as exc:  # noqa: BLE001
        logger.warning("pulse off failed: %s", exc)


def new_doc(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": str(uuid.uuid4()), "name": payload.get("name") or "Nuova automazione", "enabled": payload.get("enabled", True),
            "icon": payload.get("icon") or "zap", "match": payload.get("match") or "any", "triggers": payload.get("triggers") or [],
            "conditions": payload.get("conditions") or [], "actions": payload.get("actions") or [],
            "owner": payload.get("owner") or "", "created": now_iso(), "last_run": None, "last_result": ""}


async def time_ticker() -> None:
    """Controlla una volta al minuto le automazioni con trigger orario."""
    while True:
        try:
            await asyncio.sleep(60 - datetime.now().second)
            await fire("time", {"hhmm": datetime.now().strftime("%H:%M")})
        except asyncio.CancelledError:
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("time ticker error: %s", exc)
