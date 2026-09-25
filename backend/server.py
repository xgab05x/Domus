from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import json as _json
import ha_client as hac
import backup as bk
import pin as pinlib
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import math
import random
import re
import time
from pathlib import Path
from urllib.parse import urlparse
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Any, Dict
import uuid
from datetime import datetime, timezone
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Domus API")
api_router = APIRouter(prefix="/api")

SEED_VERSION = 4
SYNC_KEYS = ("on", "brightness", "rgb", "color_temp")
METER_TYPES = ("meter", "plug")
SECURITY_TYPES = ("camera", "doorbell", "intercom", "alarm_zone", "sensor")
RANGES = {"1h": 3600, "6h": 21600, "24h": 86400}
NOID = {"_id": 0}
ha = hac.HAClient()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
def gen_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    icon: str = "home"
    order: int = 0
    color: str = "#b08e54"


class RoomCreate(BaseModel):
    name: str
    icon: Optional[str] = "home"
    color: Optional[str] = "#b08e54"


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


EntityType = Literal[
    "light", "plug", "switch", "meter", "scene", "automation", "camera", "intercom", "alarm_zone", "sensor", "thermostat", "doorbell", "media_player"
]


class Entity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    type: EntityType
    room_id: Optional[str] = None
    integration: str = "generic"
    icon: str = "lightbulb"
    state: Dict[str, Any] = Field(default_factory=dict)
    available: bool = True
    last_seen: Optional[str] = None
    ha_entity_id: Optional[str] = None
    ha_device_id: Optional[str] = None
    controls: Dict[str, Any] = Field(default_factory=dict)


class EntityCreate(BaseModel):
    name: str
    type: EntityType
    room_id: Optional[str] = None
    integration: Optional[str] = "generic"
    icon: Optional[str] = "lightbulb"
    state: Optional[Dict[str, Any]] = None
    ha_entity_id: Optional[str] = None
    controls: Optional[Dict[str, Any]] = None


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    room_id: Optional[str] = None
    icon: Optional[str] = None
    integration: Optional[str] = None
    state: Optional[Dict[str, Any]] = None
    controls: Optional[Dict[str, Any]] = None
    pin: Optional[str] = None


class View(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    icon: str = "layout-grid"
    color: str = "#b08e54"
    members: List[str] = Field(default_factory=list)
    order: int = 0
    layout: Literal["grid", "compact"] = "grid"


class ViewCreate(BaseModel):
    name: str
    icon: Optional[str] = "layout-grid"
    color: Optional[str] = "#b08e54"
    members: List[str] = Field(default_factory=list)
    layout: Optional[Literal["grid", "compact"]] = "grid"


class ViewUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    members: Optional[List[str]] = None
    order: Optional[int] = None
    layout: Optional[Literal["grid", "compact"]] = None


class MediaCommand(BaseModel):
    command: str
    value: Optional[Any] = None


class TTSBody(BaseModel):
    message: str
    announce: bool = True
    ids: Optional[List[str]] = None


class NotifyBody(BaseModel):
    title: str = ""
    message: str
    duration: int = 8
    ids: Optional[List[str]] = None


class PTZBody(BaseModel):
    direction: Optional[str] = None
    preset: Optional[str] = None


class PinBody(BaseModel):
    pin: Optional[str] = None


class PinChange(BaseModel):
    current_pin: Optional[str] = None
    new_pin: str


class CastBody(BaseModel):
    kind: Literal["camera", "dashboard"] = "camera"
    camera_id: Optional[str] = None
    url: Optional[str] = None
    label: Optional[str] = None


class HAConfig(BaseModel):
    ha_url: Optional[str] = None
    ha_token: Optional[str] = None
    ha_enabled: Optional[bool] = None
    ha_token_clear: bool = False


class DiscoveredDevice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    type: EntityType
    integration: str = "generic"
    icon: str = "lightbulb"
    discovered_at: str = Field(default_factory=now_iso)


class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    kind: Literal["sync", "panel"] = "sync"
    members: List[str] = Field(default_factory=list)
    primary_id: Optional[str] = None
    display: Literal["group_only", "members_only", "both"] = "group_only"
    hide_members: bool = True
    room_id: Optional[str] = None
    icon: str = "link"
    color: str = "#b08e54"


class GroupCreate(BaseModel):
    name: str
    kind: Literal["sync", "panel"] = "sync"
    members: List[str] = Field(default_factory=list)
    primary_id: Optional[str] = None
    display: Literal["group_only", "members_only", "both"] = "group_only"
    hide_members: bool = True
    room_id: Optional[str] = None
    icon: Optional[str] = "link"
    color: Optional[str] = "#b08e54"


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    kind: Optional[Literal["sync", "panel"]] = None
    members: Optional[List[str]] = None
    primary_id: Optional[str] = None
    display: Optional[Literal["group_only", "members_only", "both"]] = None
    hide_members: Optional[bool] = None
    room_id: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class SceneAction(BaseModel):
    entity_id: str
    state: Dict[str, Any] = Field(default_factory=dict)


class Scene(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    icon: str = "sparkles"
    color: str = "#b08e54"
    room_id: Optional[str] = None
    actions: List[SceneAction] = Field(default_factory=list)


class SceneCreate(BaseModel):
    name: str
    icon: Optional[str] = "sparkles"
    color: Optional[str] = "#b08e54"
    room_id: Optional[str] = None
    actions: List[SceneAction] = Field(default_factory=list)


class SceneUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    room_id: Optional[str] = None
    actions: Optional[List[SceneAction]] = None


class ScheduleEntry(BaseModel):
    days: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    start: str = "07:00"
    end: str = "22:00"
    target: float = 21.0


class Thermostat(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    room_id: Optional[str] = None
    hvac_type: Literal["heat", "cool"] = "heat"
    on: bool = False
    target_temp: float = 21.0
    preset: str = "manual"
    sensor_entity_id: Optional[str] = None
    actuators: List[str] = Field(default_factory=list)
    hysteresis: float = 0.4
    schedule_enabled: bool = False
    schedule: List[ScheduleEntry] = Field(default_factory=list)
    current_temp: Optional[float] = None
    demand: bool = False
    effective_target: Optional[float] = None


class ThermostatCreate(BaseModel):
    name: str
    room_id: Optional[str] = None
    hvac_type: Literal["heat", "cool"] = "heat"
    on: bool = False
    target_temp: float = 21.0
    preset: str = "manual"
    sensor_entity_id: Optional[str] = None
    actuators: List[str] = Field(default_factory=list)
    hysteresis: float = 0.4
    schedule_enabled: bool = False
    schedule: List[ScheduleEntry] = Field(default_factory=list)


class ThermostatUpdate(BaseModel):
    name: Optional[str] = None
    room_id: Optional[str] = None
    hvac_type: Optional[Literal["heat", "cool"]] = None
    on: Optional[bool] = None
    target_temp: Optional[float] = None
    preset: Optional[str] = None
    sensor_entity_id: Optional[str] = None
    actuators: Optional[List[str]] = None
    hysteresis: Optional[float] = None
    schedule_enabled: Optional[bool] = None
    schedule: Optional[List[ScheduleEntry]] = None


class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    thermostat_ids: List[str] = Field(default_factory=list)
    color: str = "#6f8fb0"


class ZoneCreate(BaseModel):
    name: str
    thermostat_ids: List[str] = Field(default_factory=list)
    color: Optional[str] = "#6f8fb0"


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    thermostat_ids: Optional[List[str]] = None
    color: Optional[str] = None


class ZoneSet(BaseModel):
    on: Optional[bool] = None
    target_temp: Optional[float] = None
    preset: Optional[str] = None


class VirtualMeter(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    room_id: Optional[str] = None
    members: List[str] = Field(default_factory=list)
    voltage_mode: str = "avg"
    icon: str = "gauge"
    color: str = "#b08e54"


class VirtualMeterCreate(BaseModel):
    name: str
    room_id: Optional[str] = None
    members: List[str] = Field(default_factory=list)
    voltage_mode: Optional[str] = "avg"
    icon: Optional[str] = "gauge"
    color: Optional[str] = "#b08e54"


class VirtualMeterUpdate(BaseModel):
    name: Optional[str] = None
    room_id: Optional[str] = None
    members: Optional[List[str]] = None
    voltage_mode: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


ChartType = Literal["line", "donut", "radial", "bars"]


class Chart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    title: str
    source_kind: Literal["entity", "meter"] = "meter"
    source_id: str
    chart_type: ChartType = "line"
    metrics: List[str] = Field(default_factory=lambda: ["power_w"])
    range: str = "1h"
    size: str = "md"
    share_basis: Literal["power", "energy"] = "power"
    order: int = 0


class ChartCreate(BaseModel):
    title: str
    source_kind: Literal["entity", "meter"] = "meter"
    source_id: str
    chart_type: ChartType = "line"
    metrics: List[str] = Field(default_factory=lambda: ["power_w"])
    range: Optional[str] = "1h"
    size: Optional[str] = "md"
    share_basis: Optional[Literal["power", "energy"]] = "power"


class ChartUpdate(BaseModel):
    title: Optional[str] = None
    source_kind: Optional[Literal["entity", "meter"]] = None
    source_id: Optional[str] = None
    chart_type: Optional[ChartType] = None
    metrics: Optional[List[str]] = None
    range: Optional[str] = None
    size: Optional[str] = None
    share_basis: Optional[Literal["power", "energy"]] = None
    order: Optional[int] = None


class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    ts: str = Field(default_factory=now_iso)
    level: str = "info"
    title: str
    message: str = ""
    entity_id: Optional[str] = None
    read: bool = False


class SecurityEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    timestamp: str = Field(default_factory=now_iso)
    source: str
    message: str
    level: str = "info"


DEFAULT_COLOR_PRESETS = [
    {"name": "Caldo", "rgb": [255, 196, 120]},
    {"name": "Neutro", "rgb": [255, 236, 214]},
    {"name": "Freddo", "rgb": [205, 226, 255]},
    {"name": "Tramonto", "rgb": [255, 140, 90]},
    {"name": "Oceano", "rgb": [90, 170, 220]},
    {"name": "Lavanda", "rgb": [170, 140, 230]},
    {"name": "Foresta", "rgb": [110, 190, 140]},
]
DEFAULT_CLIMATE_PRESETS = {"comfort": 21.0, "eco": 18.5, "night": 17.0, "away": 15.0}
DEFAULT_ENERGY_COST = {
    "price_kwh": 0.28,
    "vat_pct": 10.0,
    "fixed_costs": [
        {"name": "Quota fissa contatore", "amount": 8.5},
        {"name": "Trasporto e gestione", "amount": 12.0},
    ],
}


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "singleton"
    address: str = "Roma, Italia"
    latitude: float = 41.9028
    longitude: float = 12.4964
    dynamic_colors: bool = True
    theme_mode: str = "auto"
    home_name: str = "Casa Domus"
    alarm_armed: str = "disarmed"
    alarm_entity_id: str = ""
    alarm_modes: List[str] = Field(default_factory=lambda: ["disarmed", "home", "away"])
    alarm_zone_ids: List[str] = Field(default_factory=list)
    alarm_use_pin_as_code: bool = True
    alarm_ha_code: str = ""
    alarm_ha_state: str = ""
    pin_enabled: bool = True
    pin_protect_disarm: bool = True
    pin_protect_sensitive: bool = True
    pin_hash: str = ""
    pin_failed: int = 0
    pin_locked_until: Optional[str] = None
    pin_set: bool = False
    alarm_code_set: bool = False
    weather_override: str = "auto"
    color_presets: List[Dict[str, Any]] = Field(default_factory=lambda: list(DEFAULT_COLOR_PRESETS))
    climate_presets: Dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_CLIMATE_PRESETS))
    energy_cost: Dict[str, Any] = Field(default_factory=lambda: dict(DEFAULT_ENERGY_COST))
    show_online_status: bool = True
    offline_simulation: bool = True
    ha_url: str = "http://localhost:8123"
    ha_token: str = ""
    ha_token_set: bool = False
    ha_enabled: bool = False
    ha_import_rooms: bool = True
    tts_entity: str = ""
    backup_dir: str = bk.DEFAULT_DIR
    backup_auto: str = "daily"
    backup_retention: int = 10
    backup_last: Optional[str] = None
    seed_version: int = SEED_VERSION


class SettingsUpdate(BaseModel):
    pin: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    dynamic_colors: Optional[bool] = None
    theme_mode: Optional[str] = None
    home_name: Optional[str] = None
    alarm_armed: Optional[str] = None
    alarm_entity_id: Optional[str] = None
    alarm_modes: Optional[List[str]] = None
    alarm_zone_ids: Optional[List[str]] = None
    alarm_use_pin_as_code: Optional[bool] = None
    alarm_ha_code: Optional[str] = None
    pin_enabled: Optional[bool] = None
    pin_protect_disarm: Optional[bool] = None
    pin_protect_sensitive: Optional[bool] = None
    weather_override: Optional[str] = None
    _pin_marker: bool = False
    color_presets: Optional[List[Dict[str, Any]]] = None
    climate_presets: Optional[Dict[str, float]] = None
    energy_cost: Optional[Dict[str, Any]] = None
    show_online_status: Optional[bool] = None
    offline_simulation: Optional[bool] = None
    ha_url: Optional[str] = None
    ha_token: Optional[str] = None
    ha_enabled: Optional[bool] = None
    ha_import_rooms: Optional[bool] = None
    tts_entity: Optional[str] = None
    backup_dir: Optional[str] = None
    backup_auto: Optional[str] = None
    backup_retention: Optional[int] = None


# ---------- Helpers ----------
async def get_settings_doc() -> Dict[str, Any]:
    doc = await db.settings.find_one({"id": "singleton"}, NOID)
    if not doc:
        s = Settings()
        await db.settings.insert_one(s.model_dump())
        return s.model_dump()
    return {**Settings().model_dump(), **doc}


def public_settings(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {**doc, "ha_token": "", "ha_token_set": bool(doc.get("ha_token")), "pin_hash": "", "alarm_ha_code": "",
            "pin_set": bool(doc.get("pin_hash")), "alarm_code_set": bool(doc.get("alarm_ha_code"))}


async def require_pin(settings: Dict[str, Any], provided: Optional[str], scope: str):
    """Enforce the household PIN for a protected action (scope: `disarm`, `sensitive` or `config`)."""
    if scope == "config":
        if not (settings.get("pin_enabled", True) and settings.get("pin_hash")):
            return
    elif not pinlib.required_for(settings, scope):
        return
    if not provided:
        raise HTTPException(401, "PIN richiesto")
    ok, left = await pinlib.check(db, settings, provided)
    if left:
        raise HTTPException(429, f"Troppi tentativi errati: riprova tra {left} secondi")
    if not ok:
        raise HTTPException(401, "PIN errato")


def sensitive_keys(patch: Dict[str, Any]) -> bool:
    return any(k in (patch or {}) for k in pinlib.SENSITIVE_STATE_KEYS)


# ---------- Realtime broadcast to browsers ----------
ws_clients: set = set()


async def broadcast(payload: Dict[str, Any]):
    dead = []
    for c in list(ws_clients):
        try:
            await c.send_text(_json.dumps(payload, default=str))
        except Exception:  # noqa: BLE001
            dead.append(c)
    for c in dead:
        ws_clients.discard(c)


async def push_to_ha(entity: Dict[str, Any], patch: Dict[str, Any]):
    """Mirror a local state patch to Home Assistant when the entity is linked and HA is live."""
    if not (ha.connected and (entity.get("ha_entity_id") or entity.get("controls"))):
        return
    calls = hac.services_for_patch(entity, patch)
    if not calls:
        return
    try:
        await ha.call_many(calls)
    except Exception as exc:  # noqa: BLE001
        logger.warning("HA call failed for %s: %s", entity.get("name"), exc)
        await push_notification("error", f"Comando non inviato a {entity.get('name')}", f"Home Assistant ha risposto: {str(exc)[:140]}", entity.get("id"))


async def apply_state(entity_id: str, patch: Dict[str, Any], propagate: bool = True) -> List[Dict[str, Any]]:
    """Merge a state patch into an entity and mirror sync keys to linked group members."""
    current = await db.entities.find_one({"id": entity_id}, NOID)
    if not current:
        raise HTTPException(404, "Entity not found")
    current["state"] = {**(current.get("state") or {}), **patch}
    await db.entities.update_one({"id": entity_id}, {"$set": {"state": current["state"]}})
    await push_to_ha(current, patch)
    affected = [current]
    if not propagate:
        return affected
    sync_patch = {k: v for k, v in patch.items() if k in SYNC_KEYS}
    if not sync_patch:
        return affected
    groups = await db.groups.find({"kind": "sync", "members": entity_id}, NOID).to_list(200)
    member_ids = {m for g in groups for m in g.get("members", [])} - {entity_id}
    for mid in member_ids:
        m = await db.entities.find_one({"id": mid}, NOID)
        if not m:
            continue
        ms = m.get("state") or {}
        m["state"] = {**ms, **{k: v for k, v in sync_patch.items() if k == "on" or k in ms}}
        await db.entities.update_one({"id": mid}, {"$set": {"state": m["state"]}})
        affected.append(m)
    return affected


def dedupe(entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Dict[str, Dict[str, Any]] = {}
    for e in entities:
        seen[e["id"]] = e
    return list(seen.values())


# ---------- Climate engine ----------
def effective_target(t: Dict[str, Any], presets: Dict[str, float]) -> float:
    if t.get("schedule_enabled"):
        now = datetime.now()
        wd, hm = now.weekday(), now.strftime("%H:%M")
        for e in t.get("schedule", []):
            if wd in e.get("days", []) and e.get("start", "00:00") <= hm < e.get("end", "24:00"):
                return float(e.get("target", t.get("target_temp", 21)))
    p = t.get("preset", "manual")
    if p in presets:
        return float(presets[p])
    return float(t.get("target_temp", 21.0))


def read_temp(state: Dict[str, Any]) -> Optional[float]:
    v = state.get("current_temp", state.get("temperature"))
    return float(v) if v is not None else None


async def evaluate_all(simulate: bool = False) -> List[Dict[str, Any]]:
    settings = await get_settings_doc()
    presets = settings.get("climate_presets", DEFAULT_CLIMATE_PRESETS)
    thermostats = await db.thermostats.find({}, NOID).to_list(300)
    entities = {e["id"]: e for e in await db.entities.find({}, NOID).to_list(3000)}
    act_on: Dict[str, bool] = {}
    act_target: Dict[str, Dict[str, Any]] = {}
    results = []
    for t in thermostats:
        target = effective_target(t, presets)
        sensor = entities.get(t.get("sensor_entity_id") or "")
        temp = read_temp(sensor.get("state") or {}) if sensor else None
        hyst = float(t.get("hysteresis", 0.4))
        demand = False
        if t.get("on") and temp is not None:
            prev = bool(t.get("demand", False))
            if t.get("hvac_type", "heat") == "heat":
                demand = temp < target - hyst / 2 or (prev and temp < target + hyst / 2)
            else:
                demand = temp > target + hyst / 2 or (prev and temp > target - hyst / 2)
        for aid in t.get("actuators", []):
            act_on[aid] = act_on.get(aid, False) or demand
            act_target[aid] = {"target_temp": target, "mode": t.get("hvac_type", "heat")}
        if simulate and sensor and temp is not None and not (ha.connected and sensor.get("ha_entity_id")):
            heat = t.get("hvac_type", "heat") == "heat"
            if demand:
                new = temp + (0.15 if heat else -0.15)
            else:
                new = temp + (-0.04 if heat else 0.04)
            new = round(max(15.0, min(30.0, new)), 2)
            key = "current_temp" if "current_temp" in (sensor.get("state") or {}) else "temperature"
            sensor["state"][key] = new
            await db.entities.update_one({"id": sensor["id"]}, {"$set": {f"state.{key}": new}})
            temp = new
        upd = {"demand": demand, "effective_target": target, "current_temp": temp}
        await db.thermostats.update_one({"id": t["id"]}, {"$set": upd})
        results.append({**t, **upd})
    for aid, on in act_on.items():
        a = entities.get(aid)
        if not a:
            continue
        patch: Dict[str, Any] = {"on": on}
        if a.get("type") == "thermostat":
            patch.update(act_target.get(aid, {}))
        await db.entities.update_one({"id": aid}, {"$set": {f"state.{k}": v for k, v in patch.items()}})
    return results


async def climate_snapshot() -> Dict[str, Any]:
    thermostats = await evaluate_all()
    entities = await db.entities.find({}, NOID).to_list(3000)
    zones = await db.zones.find({}, NOID).to_list(300)
    return {"thermostats": thermostats, "entities": entities, "zones": zones}


async def climate_loop():
    while True:
        try:
            await evaluate_all(simulate=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("climate loop error: %s", exc)
        await asyncio.sleep(30)


# ---------- Metering engine ----------
def is_metering(e: Dict[str, Any]) -> bool:
    return e.get("type") in METER_TYPES and "power_w" in (e.get("state") or {})


def compute_measures(state: Dict[str, Any], dt: float, t: float) -> Dict[str, Any]:
    nominal = float(state.get("nominal_w", 0) or 0)
    volt = 226 + 3.5 * math.sin(t / 900) + random.uniform(-0.8, 0.8)
    lf = float(state.get("load_factor", 1.0) or 1.0)
    if state.get("on") and nominal > 0:
        lf = max(0.7, min(1.3, lf + random.uniform(-0.03, 0.03)))
        p = nominal * lf * (1 + random.uniform(-0.02, 0.02))
    else:
        p = 0.0
    energy = float(state.get("energy_kwh", 0) or 0) + p * dt / 3600 / 1000
    return {"power_w": round(p, 1), "voltage_v": round(volt, 1), "current_a": round(p / volt, 2), "energy_kwh": round(energy, 4), "load_factor": round(lf, 3)}


async def metering_tick(dt: float = 10):
    now = time.time()
    ents = await db.entities.find({"type": {"$in": list(METER_TYPES)}}, NOID).to_list(1000)
    docs = []
    for e in ents:
        if not is_metering(e) or (ha.connected and e.get("ha_entity_id")):
            continue
        m = compute_measures(e.get("state") or {}, dt, now)
        await db.entities.update_one({"id": e["id"]}, {"$set": {f"state.{k}": v for k, v in m.items()}})
        docs.append({"entity_id": e["id"], "ts": now, "p": m["power_w"], "v": m["voltage_v"], "a": m["current_a"], "dt": dt})
    if docs:
        await db.readings.insert_many(docs)
    await db.readings.delete_many({"ts": {"$lt": now - 86400 - 600}})


async def push_notification(level: str, title: str, message: str = "", entity_id: Optional[str] = None):
    await db.notifications.insert_one(Notification(level=level, title=title, message=message, entity_id=entity_id).model_dump())
    count = await db.notifications.count_documents({})
    if count > 200:
        old = await db.notifications.find({}, {"_id": 0, "id": 1}).sort("ts", 1).to_list(count - 200)
        await db.notifications.delete_many({"id": {"$in": [o["id"] for o in old]}})


async def set_availability(e: Dict[str, Any], available: bool, until: Optional[float] = None):
    upd: Dict[str, Any] = {"available": available, "last_seen": now_iso()}
    if until is not None:
        upd["offline_until"] = until
    await db.entities.update_one({"id": e["id"]}, {"$set": upd})
    if available:
        await push_notification("info", f"{e['name']} è di nuovo online", "Il dispositivo ha ripreso a rispondere.", e["id"])
    else:
        await push_notification("warning", f"{e['name']} è offline", f"Nessuna risposta dall'integrazione {e.get('integration', '')}.", e["id"])


async def availability_tick():
    settings = await get_settings_doc()
    now = time.time()
    ents = await db.entities.find({"type": {"$nin": ["scene", "automation"]}}, NOID).to_list(3000)
    for e in ents:
        if e.get("available", True) is False:
            if e.get("offline_until") is not None and now >= float(e["offline_until"]):
                await set_availability(e, True)
        elif settings.get("offline_simulation", True) and not ha.connected and random.random() < 0.0015:
            await set_availability(e, False, until=now + random.uniform(40, 120))


async def metering_loop():
    while True:
        try:
            await metering_tick(10)
            await availability_tick()
        except Exception as exc:  # noqa: BLE001
            logger.warning("metering loop error: %s", exc)
        await asyncio.sleep(10)


def bucketize(rows: List[Dict[str, Any]], since: float, step: float) -> List[Dict[str, Any]]:
    buckets: Dict[int, Dict[str, float]] = {}
    for r in rows:
        b = int((r["ts"] - since) // step)
        acc = buckets.setdefault(b, {"p": 0.0, "v": 0.0, "a": 0.0, "n": 0, "e": 0.0})
        acc["p"] += r["p"]; acc["v"] += r["v"]; acc["a"] += r["a"]; acc["n"] += 1
        acc["e"] += r["p"] * float(r.get("dt", 10)) / 3600.0
    out = []
    for b in sorted(buckets):
        acc = buckets[b]; n = acc["n"]
        out.append({"t": since + b * step, "p": round(acc["p"] / n, 1), "v": round(acc["v"] / n, 1), "a": round(acc["a"] / n, 2), "e": round(acc["e"], 2)})
    return out


def sum_series(series: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    merged: Dict[float, Dict[str, Any]] = {}
    for pts in series:
        for pt in pts:
            m = merged.setdefault(pt["t"], {"t": pt["t"], "p": 0.0, "a": 0.0, "e": 0.0, "v": []})
            m["p"] += pt["p"]; m["a"] += pt["a"]; m["e"] += pt["e"]; m["v"].append(pt["v"])
    return [{"t": t, "p": round(m["p"], 1), "a": round(m["a"], 2), "e": round(m["e"], 2), "v": round(sum(m["v"]) / len(m["v"]), 1)} for t, m in sorted(merged.items())]


def meter_voltage(mode: str, members: List[Dict[str, Any]]) -> Optional[float]:
    volts = [float(m["voltage_v"]) for m in members if m.get("voltage_v") is not None]
    if mode not in ("avg", "max"):
        pick = next((m for m in members if m["id"] == mode and m.get("voltage_v") is not None), None)
        return float(pick["voltage_v"]) if pick else (round(sum(volts) / len(volts), 1) if volts else None)
    if not volts:
        return None
    return round(max(volts), 1) if mode == "max" else round(sum(volts) / len(volts), 1)


def enrich_meter(meter: Dict[str, Any], ents: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    members = []
    for mid in meter.get("members", []):
        e = ents.get(mid)
        if not e:
            continue
        s = e.get("state") or {}
        members.append({"id": mid, "name": e["name"], "icon": e.get("icon"), "type": e["type"], "on": bool(s.get("on")), "available": e.get("available", True),
                        "power_w": float(s.get("power_w", 0) or 0), "voltage_v": s.get("voltage_v"), "current_a": float(s.get("current_a", 0) or 0), "energy_kwh": float(s.get("energy_kwh", 0) or 0)})
    tp = sum(m["power_w"] for m in members)
    for m in members:
        m["share_power"] = round(m["power_w"] / tp * 100, 1) if tp else 0.0
    return {**meter, "live": {"power_w": round(tp, 1), "current_a": round(sum(m["current_a"] for m in members), 2), "voltage_v": meter_voltage(meter.get("voltage_mode", "avg"), members),
                              "energy_kwh": round(sum(m["energy_kwh"] for m in members), 3), "offline": sum(1 for m in members if not m["available"])}, "members_live": members}


async def list_meters_enriched() -> List[Dict[str, Any]]:
    meters = await db.meters.find({}, NOID).to_list(300)
    ents = {e["id"]: e for e in await db.entities.find({"type": {"$in": list(METER_TYPES)}}, NOID).to_list(1000)}
    return [enrich_meter(m, ents) for m in meters]


async def energy_summary(settings: Dict[str, Any]) -> Dict[str, Any]:
    now = time.time()
    ents = [e for e in await db.entities.find({"type": {"$in": list(METER_TYPES)}}, NOID).to_list(1000) if is_metering(e)]
    total_power = sum(float((e.get("state") or {}).get("power_w", 0) or 0) for e in ents)

    async def wh_since(since: float) -> float:
        pipeline = [{"$match": {"ts": {"$gte": since}}},
                    {"$group": {"_id": None, "wh": {"$sum": {"$multiply": ["$p", {"$divide": [{"$ifNull": ["$dt", 10]}, 3600]}]}}}}]
        res = await db.readings.aggregate(pipeline).to_list(1)
        return float(res[0]["wh"]) if res else 0.0

    wh24, wh1 = await wh_since(now - 86400), await wh_since(now - 3600)
    cost = {**DEFAULT_ENERGY_COST, **(settings.get("energy_cost") or {})}
    price = float(cost.get("price_kwh", 0) or 0)
    fixed = sum(float(c.get("amount", 0) or 0) for c in cost.get("fixed_costs", []))
    vat = float(cost.get("vat_pct", 0) or 0)
    kwh24 = wh24 / 1000
    energy_month = kwh24 * price * 30
    return {
        "total_power_w": round(total_power, 1), "energy_1h_kwh": round(wh1 / 1000, 3), "energy_24h_kwh": round(kwh24, 3),
        "price_kwh": price, "cost_per_hour_now": round(total_power / 1000 * price, 4), "cost_24h": round(kwh24 * price, 2),
        "cost_month_energy": round(energy_month, 2), "fixed_total": round(fixed, 2), "vat_pct": vat,
        "cost_month_total": round((energy_month + fixed) * (1 + vat / 100), 2), "meters_count": len(ents),
    }


# ---------- Weather ----------
_weather_cache: Dict[str, Any] = {"key": None, "ts": 0.0, "data": None}


def wmo_to_condition(code: int) -> str:
    if code in (0, 1):
        return "clear"
    if code in (2, 3):
        return "clouds"
    if code in (45, 48):
        return "fog"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "rain"
    if 71 <= code <= 77 or code in (85, 86):
        return "snow"
    if code >= 95:
        return "storm"
    return "clouds"


async def fetch_weather(lat: float, lon: float) -> Dict[str, Any]:
    key = (round(lat, 2), round(lon, 2))
    if _weather_cache["key"] == key and time.time() - _weather_cache["ts"] < 600 and _weather_cache["data"]:
        return _weather_cache["data"]
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,weather_code,is_day,relative_humidity_2m,wind_speed_10m",
            },
        )
        r.raise_for_status()
        cur = r.json()["current"]
    data = {
        "condition": wmo_to_condition(int(cur["weather_code"])),
        "code": int(cur["weather_code"]),
        "temperature": cur.get("temperature_2m"),
        "humidity": cur.get("relative_humidity_2m"),
        "wind": cur.get("wind_speed_10m"),
        "is_day": bool(cur.get("is_day", 1)),
        "source": "open-meteo",
        "updated_at": now_iso(),
    }
    _weather_cache.update({"key": key, "ts": time.time(), "data": data})
    return data


async def current_weather() -> Dict[str, Any]:
    s = await get_settings_doc()
    try:
        data = await fetch_weather(float(s["latitude"]), float(s["longitude"]))
    except Exception as exc:  # noqa: BLE001
        logger.warning("weather fetch failed: %s", exc)
        data = {"condition": "clear", "code": 0, "temperature": None, "humidity": None, "wind": None,
                "is_day": True, "source": "fallback", "updated_at": now_iso()}
    ov = s.get("weather_override", "auto")
    if ov and ov != "auto":
        data = {**data, "condition": ov, "overridden": True}
    return data


# ---------- Seed ----------
async def seed_if_needed():
    existing = await db.settings.find_one({"id": "singleton"}, NOID)
    if existing and existing.get("seed_version") == SEED_VERSION:
        return
    for coll in ("rooms", "entities", "discovered", "groups", "scenes", "thermostats", "zones", "events", "meters", "charts", "readings", "notifications", "views"):
        await db[coll].delete_many({})

    rooms = [
        {"id": gen_id(), "name": "Salotto", "icon": "sofa", "order": 0, "color": "#b08e54"},
        {"id": gen_id(), "name": "Cucina", "icon": "chef-hat", "order": 1, "color": "#b86b5a"},
        {"id": gen_id(), "name": "Camera Matrimoniale", "icon": "bed", "order": 2, "color": "#8b7bb0"},
        {"id": gen_id(), "name": "Bagno", "icon": "bath", "order": 3, "color": "#6fa3b5"},
        {"id": gen_id(), "name": "Corridoio", "icon": "door-open", "order": 4, "color": "#8a9a7b"},
        {"id": gen_id(), "name": "Giardino", "icon": "trees", "order": 5, "color": "#6f9a6a"},
        {"id": gen_id(), "name": "Garage", "icon": "car", "order": 6, "color": "#8a8f99"},
    ]
    await db.rooms.insert_many([dict(r) for r in rooms])
    salotto, cucina, camera, bagno, corridoio, giardino, garage = [r["id"] for r in rooms]

    ids = {k: gen_id() for k in (
        "plaf_salotto", "lamp_divano", "led_tv", "lampadario1", "faretti_cucina", "sottopensile", "abat", "plaf_camera",
        "specchio", "faretti_giardino", "luce_corridoio", "tasto_corr_sal", "presa_piantana", "tasto_corr_cuc", "caldaia",
        "presa_tv", "presa_frigo", "carica", "presa_garage", "vc1", "vc2", "term_camera", "clima_cucina",
        "sens_salotto", "sens_camera", "lavatrice", "asciugatrice", "forno", "lavastoviglie", "boiler", "piano_cottura",
        "cam_ingresso", "cam_giardino", "cam_retro", "cam_garage", "citofono", "doorbell",
        "z_porta", "z_finestra", "z_pir", "z_vetri", "z_fumo", "z_garage",
        "tv_salotto", "firestick", "echo_show", "nest_hub", "echo_dot",
    )}
    CAM_DEFAULTS = {"streaming": True, "recording": False, "motion": False, "privacy": False, "night_vision": "auto", "motion_detection": True,
                    "siren": False, "led": True, "flip": False, "ptz": False, "ptz_presets": [], "battery": None, "signal": None, "last_motion": None}

    def media(key, name, room, integ, device_class, power, status, app, sources, media_title=None, media_artist=None, media_duration=0, media_position=0, volume=30, screen=False):
        apps = [{"id": "com.netflix.ninja", "name": "Netflix"}, {"id": "com.google.android.youtube.tv", "name": "YouTube"}, {"id": "com.amazon.amazonvideo.livingroom", "name": "Prime Video"},
                {"id": "com.disney.disneyplus", "name": "Disney+"}, {"id": "com.spotify.tv.android", "name": "Spotify"}, {"id": "com.dazn", "name": "DAZN"}, {"id": "it.rai.raiplay", "name": "RaiPlay"}]
        return {"id": ids[key], "name": name, "type": "media_player", "room_id": room, "integration": integ, "icon": "tv" if device_class == "tv" else "speaker", "available": True,
                "state": {"power": power, "status": status, "volume": volume, "muted": False, "source": sources[0] if sources and device_class == "tv" else None, "source_list": sources,
                          "app": app, "app_list": apps if device_class == "tv" else [], "media_title": media_title, "media_artist": media_artist, "media_album": None,
                          "media_image_url": None, "media_duration": media_duration, "media_position": media_position, "device_class": device_class, "screen": screen or device_class == "tv",
                          "shuffle": False, "repeat": "off", "last_tts": None, "last_notify": None}}

    def light(key, name, room, integ, icon="lightbulb", **state):
        return {"id": ids[key], "name": name, "type": "light", "room_id": room, "integration": integ, "icon": icon, "available": True, "state": state}

    def switch(key, name, room, integ, icon="toggle-left", on=False):
        return {"id": ids[key], "name": name, "type": "switch", "room_id": room, "integration": integ, "icon": icon, "available": True, "state": {"on": on}}

    def metered(key, name, room, integ, nominal, on, icon, type_="plug", energy=0.0):
        p = float(nominal) if on else 0.0
        return {"id": ids[key], "name": name, "type": type_, "room_id": room, "integration": integ, "icon": icon, "available": True,
                "state": {"on": on, "nominal_w": nominal, "power_w": p, "voltage_v": 226.0, "current_a": round(p / 226, 2), "energy_kwh": energy, "load_factor": 1.0}}

    def plug(key, name, room, integ, on, power):
        return metered(key, name, room, integ, power, on, "plug", "plug", energy=round(power * 0.9, 2))

    def thermo(key, name, room, integ, cur, target, mode="heat", on=False, icon="fan"):
        return {"id": ids[key], "name": name, "type": "thermostat", "room_id": room, "integration": integ, "icon": icon, "available": True,
                "state": {"on": on, "current_temp": cur, "target_temp": target, "mode": mode}}

    entities = [
        light("plaf_salotto", "Plafoniera Salotto", salotto, "sonoff", on=True, brightness=78, color_temp=3200, rgb=[255, 214, 170], supports_color=True, supports_dimming=True),
        light("lamp_divano", "Lampada Divano", salotto, "tuya", "lamp", on=False, brightness=40, rgb=[200, 140, 255], supports_color=True, supports_dimming=True),
        light("led_tv", "Striscia LED TV", salotto, "tuya", "wand", on=True, brightness=60, rgb=[100, 200, 255], supports_color=True, supports_dimming=True),
        light("lampadario1", "Lampadario 1", salotto, "sonoff", on=False),
        light("faretti_cucina", "Faretti Cucina", cucina, "sonoff", on=True, brightness=90, supports_dimming=True),
        light("sottopensile", "Sottopensile", cucina, "sonoff", "wand", on=False, brightness=50, supports_dimming=True),
        light("abat", "Abat-jour Sinistra", camera, "tuya", "lamp", on=False, brightness=30, rgb=[255, 180, 100], supports_color=True, supports_dimming=True),
        light("plaf_camera", "Plafoniera Camera", camera, "sonoff", on=False, brightness=100, supports_dimming=True),
        light("specchio", "Specchio Bagno", bagno, "sonoff", on=True, brightness=100),
        light("faretti_giardino", "Faretti Giardino", giardino, "tuya", on=True, brightness=70, rgb=[255, 235, 200], supports_color=True, supports_dimming=True),
        light("luce_corridoio", "Luce Corridoio", corridoio, "sonoff", on=False),
        switch("tasto_corr_sal", "Tasto Corridoio (Placca Soggiorno)", salotto, "sonoff"),
        switch("presa_piantana", "Presa Piantana", salotto, "sonoff", "plug", on=True),
        switch("tasto_corr_cuc", "Tasto Corridoio (Placca Cucina)", cucina, "sonoff"),
        switch("caldaia", "Caldaia", garage, "sonoff", "flame"),
        plug("presa_tv", "Presa TV", salotto, "sonoff", True, 145),
        plug("presa_frigo", "Presa Frigo", cucina, "sonoff", True, 89),
        plug("carica", "Caricabatterie", camera, "tuya", False, 12),
        plug("presa_garage", "Presa Garage", garage, "tuya", False, 40),
        metered("lavatrice", "Lavatrice", bagno, "sonoff", 430, True, "washing-machine", "meter", 128.4),
        metered("asciugatrice", "Asciugatrice", bagno, "sonoff", 920, True, "wind", "meter", 96.2),
        metered("forno", "Forno", cucina, "sonoff", 2100, False, "cooking-pot", "meter", 54.7),
        metered("lavastoviglie", "Lavastoviglie", cucina, "sonoff", 1300, False, "utensils", "meter", 77.1),
        metered("boiler", "Boiler", bagno, "sonoff", 1200, True, "droplets", "meter", 210.9),
        metered("piano_cottura", "Piano cottura", cucina, "sonoff", 1800, False, "flame", "meter", 63.3),
        thermo("vc1", "Ventilconvettore Soggiorno 1", salotto, "sonoff", 20.6, 21.0),
        thermo("vc2", "Ventilconvettore Soggiorno 2", salotto, "sonoff", 20.9, 21.0),
        thermo("term_camera", "Termostato Camera", camera, "tuya", 19.4, 17.0, icon="thermometer"),
        thermo("clima_cucina", "Climatizzatore Cucina", cucina, "tuya", 23.8, 24.0, mode="cool", icon="snowflake"),
        {"id": ids["sens_salotto"], "name": "Sensore Clima Salotto", "type": "sensor", "room_id": salotto, "integration": "sonoff", "icon": "gauge",
         "state": {"temperature": 20.4, "humidity": 47}},
        {"id": ids["sens_camera"], "name": "Sensore Clima Camera", "type": "sensor", "room_id": camera, "integration": "sonoff", "icon": "gauge",
         "state": {"temperature": 19.1, "humidity": 52}},
        # Cameras
        {"id": ids["cam_ingresso"], "name": "Ingresso", "type": "camera", "room_id": None, "integration": "tapo", "icon": "cctv",
         "state": {**CAM_DEFAULTS, "recording": True, "ptz": True, "ptz_presets": ["Porta", "Vialetto", "Cancello"], "ptz_preset": "Porta", "signal": 86, "model": "Tapo C210"}},
        {"id": ids["cam_giardino"], "name": "Giardino Frontale", "type": "camera", "room_id": None, "integration": "tapo", "icon": "cctv",
         "state": {**CAM_DEFAULTS, "recording": True, "motion": True, "last_motion": now_iso(), "night_vision": "on", "ptz": True, "ptz_presets": ["Panoramica", "Cancello"], "ptz_preset": "Panoramica", "signal": 72, "model": "Tapo C500"}},
        {"id": ids["cam_retro"], "name": "Retro Casa", "type": "camera", "room_id": None, "integration": "blink", "icon": "cctv",
         "state": {**CAM_DEFAULTS, "battery": 64, "signal": 58, "model": "Blink Outdoor 4"}},
        {"id": ids["cam_garage"], "name": "Garage Interno", "type": "camera", "room_id": garage, "integration": "blink", "icon": "cctv",
         "state": {**CAM_DEFAULTS, "led": False, "battery": 91, "signal": 80, "model": "Blink Mini 2"}},
        # Intercom + video doorbell
        {"id": ids["citofono"], "name": "Citofono Ingresso", "type": "intercom", "room_id": None, "integration": "tapo", "icon": "bell",
         "state": {"ringing": False, "last_call": None, "muted": False, "has_lock": True, "locked": True}},
        {"id": ids["doorbell"], "name": "Videocitofono Blink Porta Principale", "type": "doorbell", "room_id": None, "integration": "blink", "icon": "bell-ring",
         "state": {**CAM_DEFAULTS, "ringing": False, "last_ring": None, "muted": False, "chime": True, "battery": 77, "signal": 69, "has_lock": True, "locked": True, "model": "Blink Video Doorbell"}},
        # Alarm zones
        {"id": ids["z_porta"], "name": "Porta Ingresso Principale", "type": "alarm_zone", "room_id": corridoio, "integration": "sonoff", "icon": "door-closed",
         "state": {"kind": "contact", "triggered": False, "bypass": False, "battery": 88, "signal": 90, "last_triggered": None, "tamper": False}},
        {"id": ids["z_finestra"], "name": "Finestra Salotto Lato Giardino", "type": "alarm_zone", "room_id": salotto, "integration": "sonoff", "icon": "door-open",
         "state": {"kind": "contact", "triggered": False, "bypass": False, "battery": 54, "signal": 76, "last_triggered": None, "tamper": False}},
        {"id": ids["z_pir"], "name": "PIR Corridoio Piano Terra", "type": "alarm_zone", "room_id": corridoio, "integration": "tuya", "icon": "radar",
         "state": {"kind": "motion", "triggered": False, "bypass": False, "battery": 97, "signal": 83, "last_triggered": None, "tamper": False}},
        {"id": ids["z_vetri"], "name": "Rottura Vetri Cucina", "type": "alarm_zone", "room_id": cucina, "integration": "tuya", "icon": "shield-alert",
         "state": {"kind": "glassbreak", "triggered": False, "bypass": False, "battery": 41, "signal": 65, "last_triggered": None, "tamper": False}},
        {"id": ids["z_fumo"], "name": "Rilevatore Fumo Cucina", "type": "alarm_zone", "room_id": cucina, "integration": "tuya", "icon": "siren",
         "state": {"kind": "safety", "triggered": False, "bypass": False, "battery": 100, "signal": 88, "last_triggered": None, "tamper": False}},
        {"id": ids["z_garage"], "name": "PIR Garage", "type": "alarm_zone", "room_id": garage, "integration": "sonoff", "icon": "radar",
         "state": {"kind": "motion", "triggered": False, "bypass": True, "battery": 22, "signal": 44, "last_triggered": None, "tamper": False}},
        # Media players
        media("tv_salotto", "Android TV Salotto", salotto, "androidtv", "tv", True, "playing", "Netflix", ["HDMI 1", "HDMI 2", "Chromecast"],
              media_title="Stranger Things · S4 E7", media_artist="Netflix", media_duration=4620, media_position=1180, volume=34),
        media("firestick", "Fire TV Stick Camera", camera, "amazon_fire_tv", "tv", False, "off", None, ["Home", "HDMI"], volume=20),
        media("echo_show", "Echo Show Cucina", cucina, "alexa_media", "speaker", True, "playing", "Amazon Music", [],
              media_title="Radio Deejay", media_artist="TuneIn", media_duration=0, media_position=0, volume=45, screen=True),
        media("nest_hub", "Nest Hub Camera", camera, "cast", "speaker", True, "idle", None, [], volume=25, screen=True),
        media("echo_dot", "Echo Dot Bagno", bagno, "alexa_media", "speaker", False, "off", None, [], volume=30),
        # Automations
        {"id": gen_id(), "name": "Luci al Tramonto", "type": "automation", "room_id": None, "integration": "generic", "icon": "sunset",
         "state": {"enabled": True, "trigger": "tramonto"}},
        {"id": gen_id(), "name": "Simulazione Presenza", "type": "automation", "room_id": None, "integration": "generic", "icon": "user-check",
         "state": {"enabled": False, "trigger": "vacanza"}},
    ]
    await db.entities.insert_many([dict(e) for e in entities])

    groups = [
        {"id": gen_id(), "name": "Placca Soggiorno Porta", "kind": "panel", "members": [ids["tasto_corr_sal"], ids["lampadario1"], ids["presa_piantana"]],
         "primary_id": None, "display": "group_only", "hide_members": True, "room_id": salotto, "icon": "layout-grid", "color": "#b08e54"},
        {"id": gen_id(), "name": "Placca Cucina", "kind": "panel", "members": [ids["tasto_corr_cuc"], ids["faretti_cucina"], ids["sottopensile"]],
         "primary_id": None, "display": "group_only", "hide_members": False, "room_id": cucina, "icon": "layout-grid", "color": "#b86b5a"},
        {"id": gen_id(), "name": "Corridoio", "kind": "sync", "members": [ids["luce_corridoio"], ids["tasto_corr_sal"], ids["tasto_corr_cuc"]],
         "primary_id": ids["luce_corridoio"], "display": "group_only", "hide_members": True, "room_id": corridoio, "icon": "link", "color": "#8a9a7b"},
    ]
    await db.groups.insert_many([dict(g) for g in groups])

    def act(key, **state):
        return {"entity_id": ids[key], "state": state}

    all_lights = ["plaf_salotto", "lamp_divano", "led_tv", "lampadario1", "faretti_cucina", "sottopensile", "abat", "plaf_camera", "specchio", "faretti_giardino", "luce_corridoio"]
    scenes = [
        {"id": gen_id(), "name": "Buonanotte", "icon": "moon", "color": "#7c7ba8", "room_id": None,
         "actions": [act(k, on=False) for k in all_lights if k != "abat"] + [act("abat", on=True, brightness=10, rgb=[255, 170, 90])]},
        {"id": gen_id(), "name": "Cinema", "icon": "clapperboard", "color": "#a86b8a", "room_id": None,
         "actions": [act("plaf_salotto", on=False), act("lampadario1", on=False), act("led_tv", on=True, brightness=30, rgb=[80, 120, 255]), act("lamp_divano", on=True, brightness=20, rgb=[170, 110, 255])]},
        {"id": gen_id(), "name": "Relax", "icon": "sparkles", "color": "#b08e54", "room_id": None,
         "actions": [act("plaf_salotto", on=True, brightness=40, rgb=[255, 190, 120]), act("lamp_divano", on=True, brightness=35, rgb=[255, 170, 110]), act("led_tv", on=True, brightness=25, rgb=[255, 150, 90])]},
        {"id": gen_id(), "name": "Tutto Spento", "icon": "power", "color": "#8a8f99", "room_id": None,
         "actions": [act(k, on=False) for k in all_lights]},
        {"id": gen_id(), "name": "Lettura", "icon": "book-open", "color": "#b08e54", "room_id": salotto,
         "actions": [act("plaf_salotto", on=True, brightness=100, rgb=[255, 240, 220]), act("lamp_divano", on=True, brightness=70, rgb=[255, 230, 200])]},
        {"id": gen_id(), "name": "Serata", "icon": "coffee", "color": "#b86b5a", "room_id": salotto,
         "actions": [act("plaf_salotto", on=False), act("lamp_divano", on=True, brightness=50, rgb=[255, 180, 110]), act("led_tv", on=True, brightness=40, rgb=[255, 120, 80])]},
        {"id": gen_id(), "name": "Risveglio", "icon": "sunrise", "color": "#d19a66", "room_id": camera,
         "actions": [act("abat", on=True, brightness=60, rgb=[255, 210, 150]), act("plaf_camera", on=True, brightness=40)]},
        {"id": gen_id(), "name": "Notte", "icon": "moon", "color": "#8b7bb0", "room_id": camera,
         "actions": [act("abat", on=False), act("plaf_camera", on=False)]},
    ]
    await db.scenes.insert_many([dict(s) for s in scenes])

    thermostats = [
        {"id": gen_id(), "name": "Soggiorno", "room_id": salotto, "hvac_type": "heat", "on": True, "target_temp": 21.0, "preset": "manual",
         "sensor_entity_id": ids["sens_salotto"], "actuators": [ids["caldaia"], ids["vc1"], ids["vc2"]], "hysteresis": 0.4,
         "schedule_enabled": False,
         "schedule": [{"days": [0, 1, 2, 3, 4], "start": "06:30", "end": "08:30", "target": 21.0},
                      {"days": [0, 1, 2, 3, 4], "start": "17:30", "end": "22:30", "target": 21.5},
                      {"days": [5, 6], "start": "08:00", "end": "23:00", "target": 21.0}],
         "current_temp": None, "demand": False, "effective_target": None},
        {"id": gen_id(), "name": "Camera", "room_id": camera, "hvac_type": "heat", "on": False, "target_temp": 19.0, "preset": "night",
         "sensor_entity_id": ids["term_camera"], "actuators": [ids["caldaia"], ids["term_camera"]], "hysteresis": 0.4,
         "schedule_enabled": False, "schedule": [], "current_temp": None, "demand": False, "effective_target": None},
        {"id": gen_id(), "name": "Cucina", "room_id": cucina, "hvac_type": "cool", "on": False, "target_temp": 24.0, "preset": "manual",
         "sensor_entity_id": ids["clima_cucina"], "actuators": [ids["clima_cucina"]], "hysteresis": 0.6,
         "schedule_enabled": False, "schedule": [], "current_temp": None, "demand": False, "effective_target": None},
    ]
    await db.thermostats.insert_many([dict(t) for t in thermostats])
    t_sogg, t_cam, t_cuc = [t["id"] for t in thermostats]
    zones = [
        {"id": gen_id(), "name": "Zona Giorno", "thermostat_ids": [t_sogg, t_cuc], "color": "#b08e54"},
        {"id": gen_id(), "name": "Zona Notte", "thermostat_ids": [t_cam], "color": "#8b7bb0"},
    ]
    await db.zones.insert_many([dict(z) for z in zones])

    meters = [
        {"id": gen_id(), "name": "Lavanderia", "room_id": bagno, "members": [ids["lavatrice"], ids["asciugatrice"]], "voltage_mode": "avg", "icon": "washing-machine", "color": "#6fa3b5"},
        {"id": gen_id(), "name": "Cucina", "room_id": cucina, "members": [ids["forno"], ids["lavastoviglie"], ids["piano_cottura"], ids["presa_frigo"]], "voltage_mode": "avg", "icon": "chef-hat", "color": "#b86b5a"},
        {"id": gen_id(), "name": "Casa", "room_id": None, "members": [ids[k] for k in ("lavatrice", "asciugatrice", "forno", "lavastoviglie", "boiler", "piano_cottura", "presa_tv", "presa_frigo", "carica", "presa_garage")], "voltage_mode": "avg", "icon": "home", "color": "#b08e54"},
    ]
    await db.meters.insert_many([dict(m) for m in meters])
    m_lav, m_cuc, m_casa = [m["id"] for m in meters]
    charts = [
        {"id": gen_id(), "title": "Consumo Lavanderia", "source_kind": "meter", "source_id": m_lav, "chart_type": "donut", "metrics": ["power_w", "current_a", "voltage_v"], "range": "1h", "size": "md", "share_basis": "power", "order": 0},
        {"id": gen_id(), "title": "Lavanderia nel tempo", "source_kind": "meter", "source_id": m_lav, "chart_type": "line", "metrics": ["power_w"], "range": "6h", "size": "md", "share_basis": "power", "order": 1},
        {"id": gen_id(), "title": "Casa · potenza e corrente", "source_kind": "meter", "source_id": m_casa, "chart_type": "line", "metrics": ["power_w", "current_a"], "range": "24h", "size": "lg", "share_basis": "power", "order": 2},
        {"id": gen_id(), "title": "Ripartizione energia casa (24h)", "source_kind": "meter", "source_id": m_casa, "chart_type": "radial", "metrics": ["power_w"], "range": "24h", "size": "md", "share_basis": "energy", "order": 3},
        {"id": gen_id(), "title": "Lavatrice", "source_kind": "entity", "source_id": ids["lavatrice"], "chart_type": "line", "metrics": ["power_w", "voltage_v"], "range": "1h", "size": "sm", "share_basis": "power", "order": 4},
        {"id": gen_id(), "title": "Cucina · ripartizione", "source_kind": "meter", "source_id": m_cuc, "chart_type": "bars", "metrics": ["power_w"], "range": "6h", "size": "sm", "share_basis": "energy", "order": 5},
    ]
    await db.charts.insert_many([dict(c) for c in charts])

    windows = {  # hours-ago windows in which the appliance was running
        "forno": [(5, 6)], "lavastoviglie": [(3, 4.5)], "piano_cottura": [(11, 11.75), (4.5, 5.25)],
        "lavatrice": [(14, 16), (0, 0.7)], "asciugatrice": [(12, 13.5), (0, 0.5)],
    }
    now = time.time()
    readings = []
    for e in entities:
        if not is_metering(e):
            continue
        key = next(k for k, v in ids.items() if v == e["id"])
        nominal = float(e["state"]["nominal_w"])
        on_now = bool(e["state"]["on"])
        lf = 1.0
        for i in range(1440, 0, -1):
            ago = i * 60
            h = ago / 3600
            if key in windows:
                running = any(a <= h < b for a, b in windows[key])
            elif key == "boiler":
                running = int(ago // 1800) % 3 == 0 or h < 0.3
            else:
                running = on_now
            lf = max(0.7, min(1.3, lf + random.uniform(-0.03, 0.03)))
            p = nominal * lf * (1 + random.uniform(-0.02, 0.02)) if running else 0.0
            v = 226 + 3.5 * math.sin((now - ago) / 900) + random.uniform(-0.8, 0.8)
            readings.append({"entity_id": e["id"], "ts": now - ago, "p": round(p, 1), "v": round(v, 1), "a": round(p / v, 2), "dt": 60})
    await db.readings.insert_many(readings)

    discovered = [
        {"id": gen_id(), "name": "Sonoff MINIR2 - Ripostiglio", "type": "light", "integration": "sonoff", "icon": "lightbulb", "discovered_at": now_iso()},
        {"id": gen_id(), "name": "Tuya WiFi Plug 16A", "type": "plug", "integration": "tuya", "icon": "plug", "discovered_at": now_iso()},
        {"id": gen_id(), "name": "Tapo C210 Cam", "type": "camera", "integration": "tapo", "icon": "cctv", "discovered_at": now_iso()},
    ]
    await db.discovered.insert_many([dict(d) for d in discovered])

    views = [
        {"id": gen_id(), "name": "Perimetro Esterno", "icon": "fence", "color": "#6f9a6a", "order": 0, "layout": "grid",
         "members": [ids["cam_ingresso"], ids["cam_giardino"], ids["cam_retro"], ids["doorbell"], ids["z_porta"], ids["z_finestra"]]},
        {"id": gen_id(), "name": "Interno Notte", "icon": "moon", "color": "#8b7bb0", "order": 1, "layout": "grid",
         "members": [ids["cam_garage"], ids["z_pir"], ids["z_vetri"], ids["z_fumo"], ids["z_garage"], ids["citofono"]]},
    ]
    await db.views.insert_many([dict(v) for v in views])

    events = [
        {"id": gen_id(), "timestamp": now_iso(), "source": "Giardino Frontale", "message": "Movimento rilevato", "level": "warning"},
        {"id": gen_id(), "timestamp": now_iso(), "source": "Sistema", "message": "Sistema disarmato", "level": "info"},
        {"id": gen_id(), "timestamp": now_iso(), "source": "Citofono Ingresso", "message": "Chiamata ricevuta", "level": "info"},
    ]
    await db.events.insert_many([dict(e) for e in events])

    base = Settings().model_dump()
    merged = {**base, **(existing or {}), "seed_version": SEED_VERSION}
    merged.setdefault("color_presets", base["color_presets"])
    merged.setdefault("climate_presets", base["climate_presets"])
    merged.setdefault("energy_cost", base["energy_cost"])
    await db.settings.update_one({"id": "singleton"}, {"$set": merged}, upsert=True)
    await push_notification("info", "Domus inizializzato", "Dati demo caricati: dispositivi, gruppi, scene, clima e misuratori.")
    await evaluate_all()


# ---------- Routes: aggregate ----------
@api_router.get("/app-data")
async def app_data():
    rooms, entities, discovered, events, groups, scenes, thermostats, zones, charts, notifications, views = await asyncio.gather(
        db.rooms.find({}, NOID).sort("order", 1).to_list(1000),
        db.entities.find({}, NOID).to_list(3000),
        db.discovered.find({}, NOID).to_list(1000),
        db.events.find({}, NOID).sort("timestamp", -1).to_list(30),
        db.groups.find({}, NOID).to_list(500),
        db.scenes.find({}, NOID).to_list(500),
        db.thermostats.find({}, NOID).to_list(300),
        db.zones.find({}, NOID).to_list(300),
        db.charts.find({}, NOID).sort("order", 1).to_list(300),
        db.notifications.find({}, NOID).sort("ts", -1).to_list(50),
        db.views.find({}, NOID).sort("order", 1).to_list(200),
    )
    settings = await get_settings_doc()
    weather = await current_weather()
    meters = await list_meters_enriched()
    energy = await energy_summary(settings)
    return {"rooms": rooms, "entities": entities, "discovered": discovered, "events": events, "groups": groups,
            "scenes": scenes, "thermostats": thermostats, "zones": zones, "settings": public_settings(settings), "weather": weather,
            "meters": meters, "charts": charts, "notifications": notifications, "energy": energy, "views": views, "ha": ha.status()}


@api_router.get("/weather")
async def get_weather():
    return await current_weather()


# ---------- Routes: Energy / meters / charts ----------
@api_router.get("/meters")
async def list_meters():
    return await list_meters_enriched()


@api_router.post("/meters")
async def create_meter(payload: VirtualMeterCreate):
    m = VirtualMeter(**payload.model_dump(exclude_none=True))
    await db.meters.insert_one(m.model_dump())
    return await list_meters_enriched()


@api_router.patch("/meters/{mid}")
async def update_meter(mid: str, payload: VirtualMeterUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.meters.update_one({"id": mid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Meter not found")
    return await list_meters_enriched()


@api_router.delete("/meters/{mid}")
async def delete_meter(mid: str):
    res = await db.meters.delete_one({"id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Meter not found")
    await db.charts.delete_many({"source_kind": "meter", "source_id": mid})
    return {"ok": True}


@api_router.get("/charts", response_model=List[Chart])
async def list_charts():
    return await db.charts.find({}, NOID).sort("order", 1).to_list(300)


@api_router.post("/charts", response_model=Chart)
async def create_chart(payload: ChartCreate):
    count = await db.charts.count_documents({})
    c = Chart(**payload.model_dump(exclude_none=True), order=count)
    await db.charts.insert_one(c.model_dump())
    return c


@api_router.patch("/charts/{cid}", response_model=Chart)
async def update_chart(cid: str, payload: ChartUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.charts.update_one({"id": cid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Chart not found")
    return await db.charts.find_one({"id": cid}, NOID)


@api_router.delete("/charts/{cid}")
async def delete_chart(cid: str):
    res = await db.charts.delete_one({"id": cid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Chart not found")
    return {"ok": True}


@api_router.get("/history")
async def history(kind: str, id: str, range: str = "1h"):
    seconds = RANGES.get(range, 3600)
    since = time.time() - seconds
    step = max(20, seconds // 180)
    meter = None
    if kind == "meter":
        meter = await db.meters.find_one({"id": id}, NOID)
        if not meter:
            raise HTTPException(404, "Meter not found")
        ids = list(meter.get("members", []))
    else:
        ids = [id]
    ents = {e["id"]: e for e in await db.entities.find({"id": {"$in": ids}}, NOID).to_list(500)}
    if kind == "entity" and id not in ents:
        raise HTTPException(404, "Entity not found")
    rows = await db.readings.find({"entity_id": {"$in": ids}, "ts": {"$gte": since}}, NOID).sort("ts", 1).to_list(400000)
    by: Dict[str, List[Dict[str, Any]]] = {i: [] for i in ids}
    for r in rows:
        by.setdefault(r["entity_id"], []).append(r)
    members = []
    for i in ids:
        e = ents.get(i)
        if not e:
            continue
        pts = bucketize(by.get(i, []), since, step)
        s = e.get("state") or {}
        members.append({"id": i, "name": e["name"], "icon": e.get("icon"), "available": e.get("available", True), "on": bool(s.get("on")),
                        "power_w": float(s.get("power_w", 0) or 0), "voltage_v": s.get("voltage_v"), "current_a": float(s.get("current_a", 0) or 0),
                        "energy_wh": round(sum(p["e"] for p in pts), 2), "points": pts})
    tp = sum(m["power_w"] for m in members)
    te = sum(m["energy_wh"] for m in members)
    for m in members:
        m["share_power"] = round(m["power_w"] / tp * 100, 1) if tp else 0.0
        m["share_energy"] = round(m["energy_wh"] / te * 100, 1) if te else 0.0
    points = members[0]["points"] if kind == "entity" and members else sum_series([m["points"] for m in members])
    live = {"power_w": round(tp, 1), "current_a": round(sum(m["current_a"] for m in members), 2), "energy_wh": round(te, 2),
            "voltage_v": meter_voltage(meter.get("voltage_mode", "avg") if meter else "avg", members)}
    name = meter["name"] if meter else (members[0]["name"] if members else id)
    return {"kind": kind, "id": id, "name": name, "range": range, "step": step, "points": points, "members": members if kind == "meter" else [], "live": live}


@api_router.get("/energy/summary")
async def get_energy_summary():
    return await energy_summary(await get_settings_doc())


# ---------- Routes: Notifications / availability ----------
@api_router.get("/notifications", response_model=List[Notification])
async def list_notifications(limit: int = 50, unread: bool = False):
    q = {"read": False} if unread else {}
    return await db.notifications.find(q, NOID).sort("ts", -1).to_list(limit)


@api_router.post("/notifications/read-all")
async def read_all_notifications():
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.post("/notifications/{nid}/read")
async def read_notification(nid: str):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.delete("/notifications")
async def clear_notifications():
    await db.notifications.delete_many({})
    return {"ok": True}


@api_router.post("/entities/{entity_id}/availability")
async def set_entity_availability(entity_id: str, available: bool = True):
    e = await db.entities.find_one({"id": entity_id}, NOID)
    if not e:
        raise HTTPException(404, "Entity not found")
    if bool(e.get("available", True)) != available:
        await set_availability(e, available, until=None if available else time.time() + 90)
    return await db.entities.find_one({"id": entity_id}, NOID)


# ---------- Routes: Rooms ----------
@api_router.get("/rooms", response_model=List[Room])
async def list_rooms():
    return await db.rooms.find({}, NOID).sort("order", 1).to_list(1000)


@api_router.post("/rooms", response_model=Room)
async def create_room(payload: RoomCreate):
    count = await db.rooms.count_documents({})
    room = Room(name=payload.name, icon=payload.icon or "home", color=payload.color or "#b08e54", order=count)
    await db.rooms.insert_one(room.model_dump())
    return room


@api_router.patch("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, payload: RoomUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.rooms.update_one({"id": room_id}, {"$set": upd})
    doc = await db.rooms.find_one({"id": room_id}, NOID)
    if not doc:
        raise HTTPException(404, "Room not found")
    return doc


@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str):
    await db.entities.update_many({"room_id": room_id}, {"$set": {"room_id": None}})
    await db.groups.update_many({"room_id": room_id}, {"$set": {"room_id": None}})
    await db.thermostats.update_many({"room_id": room_id}, {"$set": {"room_id": None}})
    res = await db.rooms.delete_one({"id": room_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Room not found")
    return {"ok": True}


# ---------- Routes: Entities ----------
@api_router.get("/entities", response_model=List[Entity])
async def list_entities(type: Optional[str] = None, room_id: Optional[str] = None):
    q: Dict[str, Any] = {}
    if type:
        q["type"] = type
    if room_id == "unassigned":
        q["room_id"] = None
    elif room_id:
        q["room_id"] = room_id
    return await db.entities.find(q, NOID).to_list(3000)


@api_router.post("/entities", response_model=Entity)
async def create_entity(payload: EntityCreate):
    ent = Entity(**payload.model_dump(exclude_none=True))
    await db.entities.insert_one(ent.model_dump())
    return ent


@api_router.patch("/entities/{entity_id}")
async def update_entity(entity_id: str, payload: EntityUpdate):
    raw = payload.model_dump(exclude_none=True)
    provided_pin = raw.pop("pin", None)
    meta = {k: raw[k] for k in ("name", "room_id", "icon", "integration", "controls") if k in raw}
    if not meta and "state" not in raw:
        raise HTTPException(400, "Nothing to update")
    if "state" in raw:
        target = await db.entities.find_one({"id": entity_id}, NOID)
        if target and sensitive_keys(raw["state"]):
            await require_pin(await get_settings_doc(), provided_pin, "sensitive")
    if meta:
        res = await db.entities.update_one({"id": entity_id}, {"$set": meta})
        if res.matched_count == 0:
            raise HTTPException(404, "Entity not found")
    affected: List[Dict[str, Any]] = []
    if "state" in raw:
        affected = await apply_state(entity_id, raw["state"])
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    if not doc:
        raise HTTPException(404, "Entity not found")
    return {"entity": doc, "affected": dedupe([doc] + affected)}


@api_router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str):
    res = await db.entities.delete_one({"id": entity_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Entity not found")
    await db.groups.update_many({}, {"$pull": {"members": entity_id}})
    await db.scenes.update_many({}, {"$pull": {"actions": {"entity_id": entity_id}}})
    await db.thermostats.update_many({}, {"$pull": {"actuators": entity_id}})
    await db.thermostats.update_many({"sensor_entity_id": entity_id}, {"$set": {"sensor_entity_id": None}})
    await db.meters.update_many({}, {"$pull": {"members": entity_id}})
    await db.views.update_many({}, {"$pull": {"members": entity_id}})
    await db.charts.delete_many({"source_kind": "entity", "source_id": entity_id})
    await db.readings.delete_many({"entity_id": entity_id})
    return {"ok": True}


@api_router.post("/entities/{entity_id}/move/{room_id}")
async def move_entity(entity_id: str, room_id: str):
    target = None if room_id == "unassigned" else room_id
    if target and not await db.rooms.find_one({"id": target}):
        raise HTTPException(404, "Room not found")
    await db.entities.update_one({"id": entity_id}, {"$set": {"room_id": target}})
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    if not doc:
        raise HTTPException(404, "Entity not found")
    return doc


# ---------- Routes: Groups ----------
@api_router.get("/groups", response_model=List[Group])
async def list_groups():
    return await db.groups.find({}, NOID).to_list(500)


@api_router.post("/groups", response_model=Group)
async def create_group(payload: GroupCreate):
    g = Group(**payload.model_dump(exclude_none=True))
    await db.groups.insert_one(g.model_dump())
    return g


@api_router.patch("/groups/{group_id}", response_model=Group)
async def update_group(group_id: str, payload: GroupUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.groups.update_one({"id": group_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Group not found")
    return await db.groups.find_one({"id": group_id}, NOID)


@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str):
    res = await db.groups.delete_one({"id": group_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Group not found")
    return {"ok": True}


@api_router.post("/groups/{group_id}/toggle")
async def toggle_group(group_id: str, on: Optional[bool] = None):
    g = await db.groups.find_one({"id": group_id}, NOID)
    if not g:
        raise HTTPException(404, "Group not found")
    members = await db.entities.find({"id": {"$in": g.get("members", [])}}, NOID).to_list(500)
    if on is None:
        primary = next((m for m in members if m["id"] == g.get("primary_id")), None)
        cur = bool(primary["state"].get("on")) if primary else any(m.get("state", {}).get("on") for m in members)
        on = not cur
    affected: List[Dict[str, Any]] = []
    for m in members:
        affected += await apply_state(m["id"], {"on": on})
    return {"on": on, "affected": dedupe(affected)}


# ---------- Routes: Scenes ----------
@api_router.get("/scenes", response_model=List[Scene])
async def list_scenes():
    return await db.scenes.find({}, NOID).to_list(500)


@api_router.post("/scenes", response_model=Scene)
async def create_scene(payload: SceneCreate):
    s = Scene(**payload.model_dump(exclude_none=True))
    await db.scenes.insert_one(s.model_dump())
    return s


@api_router.patch("/scenes/{scene_id}", response_model=Scene)
async def update_scene(scene_id: str, payload: SceneUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.scenes.update_one({"id": scene_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Scene not found")
    return await db.scenes.find_one({"id": scene_id}, NOID)


@api_router.delete("/scenes/{scene_id}")
async def delete_scene(scene_id: str):
    res = await db.scenes.delete_one({"id": scene_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Scene not found")
    return {"ok": True}


@api_router.post("/scenes/{scene_id}/activate")
async def activate_scene(scene_id: str, payload: PinBody | None = None):
    s = await db.scenes.find_one({"id": scene_id}, NOID)
    if not s:
        raise HTTPException(404, "Scene not found")
    if any(sensitive_keys(a.get("state") or {}) for a in s.get("actions", [])):
        await require_pin(await get_settings_doc(), (payload or PinBody()).pin, "sensitive")
    affected: List[Dict[str, Any]] = []
    for a in s.get("actions", []):
        try:
            affected += await apply_state(a["entity_id"], a.get("state", {}))
        except HTTPException:
            continue
    return {"ok": True, "affected": dedupe(affected)}


# ---------- Routes: Climate ----------
@api_router.get("/thermostats", response_model=List[Thermostat])
async def list_thermostats():
    return await db.thermostats.find({}, NOID).to_list(300)


@api_router.post("/thermostats")
async def create_thermostat(payload: ThermostatCreate):
    t = Thermostat(**payload.model_dump())
    await db.thermostats.insert_one(t.model_dump())
    return await climate_snapshot()


@api_router.patch("/thermostats/{tid}")
async def update_thermostat(tid: str, payload: ThermostatUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    if "target_temp" in upd and "preset" not in upd:
        upd["preset"] = "manual"
    res = await db.thermostats.update_one({"id": tid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Thermostat not found")
    return await climate_snapshot()


@api_router.delete("/thermostats/{tid}")
async def delete_thermostat(tid: str):
    res = await db.thermostats.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Thermostat not found")
    await db.zones.update_many({}, {"$pull": {"thermostat_ids": tid}})
    return await climate_snapshot()


@api_router.get("/zones", response_model=List[Zone])
async def list_zones():
    return await db.zones.find({}, NOID).to_list(300)


@api_router.post("/zones", response_model=Zone)
async def create_zone(payload: ZoneCreate):
    z = Zone(**payload.model_dump(exclude_none=True))
    await db.zones.insert_one(z.model_dump())
    return z


@api_router.patch("/zones/{zid}", response_model=Zone)
async def update_zone(zid: str, payload: ZoneUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.zones.update_one({"id": zid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Zone not found")
    return await db.zones.find_one({"id": zid}, NOID)


@api_router.delete("/zones/{zid}")
async def delete_zone(zid: str):
    res = await db.zones.delete_one({"id": zid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Zone not found")
    return {"ok": True}


async def _apply_zone_set(thermostat_ids: List[str], payload: ZoneSet):
    upd = payload.model_dump(exclude_unset=True)
    if "target_temp" in upd and "preset" not in upd:
        upd["preset"] = "manual"
    if upd and thermostat_ids:
        await db.thermostats.update_many({"id": {"$in": thermostat_ids}}, {"$set": upd})


@api_router.post("/zones/set-all")
async def set_all_zones(payload: ZoneSet):
    zones = await db.zones.find({}, NOID).to_list(300)
    ids = list({tid for z in zones for tid in z.get("thermostat_ids", [])})
    await _apply_zone_set(ids, payload)
    return await climate_snapshot()


@api_router.post("/zones/{zid}/set")
async def set_zone(zid: str, payload: ZoneSet):
    z = await db.zones.find_one({"id": zid}, NOID)
    if not z:
        raise HTTPException(404, "Zone not found")
    await _apply_zone_set(z.get("thermostat_ids", []), payload)
    return await climate_snapshot()


# ---------- Routes: Discovered ----------
@api_router.get("/discovered", response_model=List[DiscoveredDevice])
async def list_discovered():
    return await db.discovered.find({}, NOID).to_list(1000)


@api_router.post("/discovered/{disc_id}/assign/{room_id}", response_model=Entity)
async def assign_discovered(disc_id: str, room_id: str):
    disc = await db.discovered.find_one({"id": disc_id}, NOID)
    if not disc:
        raise HTTPException(404, "Discovered device not found")
    target_room = None if room_id == "unassigned" else room_id
    if target_room and not await db.rooms.find_one({"id": target_room}):
        raise HTTPException(404, "Room not found")
    default_state: Dict[str, Any] = {}
    if disc["type"] == "light":
        default_state = {"on": False, "brightness": 80, "supports_dimming": True, "supports_color": True, "rgb": [255, 235, 200]}
    elif disc["type"] in ("plug", "switch", "meter"):
        default_state = {"on": False, "power_w": 0.0, "voltage_v": 226.0, "current_a": 0.0, "energy_kwh": 0.0, "nominal_w": 60}
    elif disc["type"] == "camera":
        default_state = {"streaming": True, "recording": False, "motion": False}
    ent = Entity(name=disc["name"], type=disc["type"], room_id=target_room,
                 integration=disc.get("integration", "generic"), icon=disc.get("icon", "lightbulb"), state=default_state)
    await db.entities.insert_one(ent.model_dump())
    await db.discovered.delete_one({"id": disc_id})
    return ent


@api_router.post("/discovered/mock")
async def mock_new_discovery():
    d = DiscoveredDevice(name="Nuovo Sonoff Basic R3", type="light", integration="sonoff", icon="lightbulb")
    await db.discovered.insert_one(d.model_dump())
    return d


# ---------- Routes: Settings ----------
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    return public_settings(await get_settings_doc())


PROTECTED_SETTINGS = ("pin_enabled", "pin_protect_disarm", "pin_protect_sensitive", "alarm_ha_code",
                      "alarm_use_pin_as_code", "alarm_entity_id", "alarm_modes", "alarm_zone_ids", "alarm_armed")


@api_router.patch("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    provided_pin = upd.pop("pin", None)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    if "ha_token" in upd and not upd["ha_token"].strip():
        upd.pop("ha_token")
    if any(k in upd for k in PROTECTED_SETTINGS):
        await require_pin(await get_settings_doc(), provided_pin, "config")
    await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    if "climate_presets" in upd:
        await evaluate_all()
    doc = await get_settings_doc()
    if any(k in upd for k in ("ha_url", "ha_token", "ha_enabled")):
        ha.configure(doc.get("ha_url"), doc.get("ha_token"), doc.get("ha_enabled"))
        asyncio.create_task(ha_check_and_import(doc))
    return public_settings(doc)


# ---------- Routes: Events ----------
@api_router.get("/events", response_model=List[SecurityEvent])
async def list_events(limit: int = 50):
    return await db.events.find({}, NOID).sort("timestamp", -1).to_list(limit)


@api_router.post("/events", response_model=SecurityEvent)
async def create_event(evt: SecurityEvent):
    await db.events.insert_one(evt.model_dump())
    return evt


# ---------- Routes: Intercom / Alarm ----------
@api_router.post("/intercom/{entity_id}/ring")
async def intercom_ring(entity_id: str):
    e = await _get_entity(entity_id, ("intercom", "doorbell"))
    key = "last_ring" if e["type"] == "doorbell" else "last_call"
    await db.entities.update_one({"id": entity_id}, {"$set": {"state.ringing": True, f"state.{key}": now_iso()}})
    await db.events.insert_one(SecurityEvent(source=e["name"], message="Chiamata in arrivo" if e["type"] == "intercom" else "Campanello suonato", level="warning").model_dump())
    await push_notification("warning", f"{e['name']}: qualcuno sta suonando", "", entity_id)
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    await broadcast({"type": "entities", "affected": [doc]})
    return {"ok": True}


@api_router.post("/intercom/{entity_id}/answer")
async def intercom_answer(entity_id: str, action: str = "hangup", payload: PinBody | None = None):
    e = await _get_entity(entity_id, ("intercom", "doorbell"))
    upd: Dict[str, Any] = {"state.ringing": False}
    if action == "unlock":
        await require_pin(await get_settings_doc(), (payload or PinBody()).pin, "sensitive")
        upd["state.locked"] = False
        if ha.connected and (e.get("controls") or {}).get("unlock"):
            try:
                await ha.call_service("lock", "unlock", {"entity_id": e["controls"]["unlock"]})
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(502, f"Sblocco non riuscito: {exc}")
    await db.entities.update_one({"id": entity_id}, {"$set": upd})
    msg = "Porta aperta" if action == "unlock" else "Chiamata terminata"
    await db.events.insert_one(SecurityEvent(source=e["name"], message=msg, level="info").model_dump())
    if action == "unlock":
        async def relock():
            await asyncio.sleep(8)
            await db.entities.update_one({"id": entity_id}, {"$set": {"state.locked": True}})
            doc = await db.entities.find_one({"id": entity_id}, NOID)
            if doc:
                await broadcast({"type": "entities", "affected": [doc]})
        asyncio.create_task(relock())
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    await broadcast({"type": "entities", "affected": [doc]})
    return {"ok": True}


ALARM_MODE_LABEL = {"disarmed": "Sistema disarmato", "home": "Sistema armato (Home)", "away": "Sistema armato (Away)",
                    "night": "Sistema armato (Notte)", "vacation": "Sistema armato (Vacanza)", "custom": "Sistema armato (Personalizzato)"}


async def alarm_panel_snapshot(settings: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Live view of the mapped HA alarm_control_panel (None when not mapped or HA offline)."""
    eid = settings.get("alarm_entity_id") or ""
    if not (ha.connected and eid):
        return None
    try:
        st = await ha.rest("GET", f"/api/states/{eid}", timeout=8)
    except Exception as exc:  # noqa: BLE001
        return {"entity_id": eid, "error": str(exc)[:160]}
    a = (st or {}).get("attributes") or {}
    return {"entity_id": eid, "name": a.get("friendly_name") or eid, "state": st.get("state"), "mode": hac.HA_ALARM_MODE.get(st.get("state") or ""),
            "code_arm_required": a.get("code_arm_required", True), "code_format": a.get("code_format"), "changed_by": a.get("changed_by"),
            "supported_modes": hac.panel_modes(a.get("supported_features")), "last_changed": st.get("last_changed")}


@api_router.get("/alarm/panels")
async def alarm_panels():
    if not ha.connected:
        raise HTTPException(503, "Home Assistant non connesso (modalità demo)")
    states = await ha.rest("GET", "/api/states", timeout=20)
    out = []
    for s in states or []:
        if not s["entity_id"].startswith("alarm_control_panel."):
            continue
        a = s.get("attributes") or {}
        out.append({"entity_id": s["entity_id"], "name": a.get("friendly_name") or s["entity_id"], "state": s.get("state"),
                    "code_arm_required": a.get("code_arm_required", True), "supported_modes": hac.panel_modes(a.get("supported_features"))})
    return out


@api_router.get("/alarm/state")
async def alarm_state():
    settings = await get_settings_doc()
    panel = await alarm_panel_snapshot(settings)
    zone_ids = settings.get("alarm_zone_ids") or []
    q = {"type": "alarm_zone"} if not zone_ids else {"type": "alarm_zone", "id": {"$in": zone_ids}}
    zones = await db.entities.find(q, NOID).to_list(500)
    return {"mode": settings.get("alarm_armed", "disarmed"), "ha_state": settings.get("alarm_ha_state") or (panel or {}).get("state"),
            "modes": settings.get("alarm_modes") or ["disarmed", "home", "away"], "panel": panel, "zones": zones,
            "pin": pinlib.status(settings)}


@api_router.post("/alarm/set/{mode}")
async def set_alarm(mode: str, payload: PinBody | None = None):
    if mode not in hac.ALARM_SERVICE:
        raise HTTPException(400, "Invalid mode")
    settings = await get_settings_doc()
    if mode == "disarmed":
        await require_pin(settings, (payload or PinBody()).pin, "disarm")
    upd: Dict[str, Any] = {"alarm_armed": mode}
    panel_eid = settings.get("alarm_entity_id") or ""
    if ha.connected:
        try:
            if not panel_eid:
                states = await ha.rest("GET", "/api/states", timeout=10)
                panel_eid = next((s["entity_id"] for s in states or [] if s["entity_id"].startswith("alarm_control_panel.")), "")
            if panel_eid:
                data: Dict[str, Any] = {"entity_id": panel_eid}
                code = settings.get("alarm_ha_code") or ((payload or PinBody()).pin if settings.get("alarm_use_pin_as_code", True) else "")
                # HA panels always want the code to disarm; when arming it is only sent if the panel requires it.
                needs_code = True
                if mode != "disarmed":
                    snap = await alarm_panel_snapshot(settings) or {}
                    needs_code = bool(snap.get("code_arm_required", True))
                if code and needs_code:
                    data["code"] = code
                await ha.call_service("alarm_control_panel", hac.ALARM_SERVICE[mode], data)
                upd["alarm_ha_state"] = ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("HA alarm panel call failed: %s", exc)
            await push_notification("error", "Pannello allarme HA non raggiungibile", str(exc)[:140])
            raise HTTPException(502, f"Pannello allarme HA: {str(exc)[:160]}")
    await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    label = ALARM_MODE_LABEL.get(mode, mode)
    await db.events.insert_one(SecurityEvent(source="Antintrusione", message=label, level="info" if mode == "disarmed" else "warning").model_dump())
    doc = await get_settings_doc()
    await broadcast({"type": "settings", "settings": public_settings(doc)})
    return {"mode": mode, "ha": bool(panel_eid) and ha.connected}


# ---------- Routes: household PIN ----------
@api_router.get("/pin/status")
async def pin_status():
    return pinlib.status(await get_settings_doc())


@api_router.post("/pin/verify")
async def pin_verify(payload: PinBody):
    settings = await get_settings_doc()
    if not settings.get("pin_hash"):
        raise HTTPException(400, "Nessun PIN impostato")
    ok, left = await pinlib.check(db, settings, payload.pin or "")
    if left:
        raise HTTPException(429, f"Troppi tentativi errati: riprova tra {left} secondi")
    if not ok:
        raise HTTPException(401, "PIN errato")
    return {"verified": True}


@api_router.post("/pin/change")
async def pin_change(payload: PinChange):
    settings = await get_settings_doc()
    await pinlib.change(db, settings, payload.current_pin, payload.new_pin)
    await push_notification("info", "PIN aggiornato", "Il PIN di sicurezza è stato modificato")
    return pinlib.status(await get_settings_doc())


# ---------- Home Assistant bridge ----------
async def ha_import_entities() -> Dict[str, Any]:
    """Pull every HA state, map it to Domus entities and upsert them (user names/rooms/icons are preserved)."""
    settings = await get_settings_doc()
    states = await ha.rest("GET", "/api/states", timeout=20)
    regs = await ha.registries()
    notify = await ha.notify_services()
    mapped, area_names = hac.map_entities(states or [], regs, notify)
    rooms = {r["name"].lower(): r for r in await db.rooms.find({}, NOID).to_list(1000)}
    if settings.get("ha_import_rooms", True):
        for name in area_names:
            if name.lower() not in rooms:
                room = Room(name=name, icon="home", order=len(rooms))
                await db.rooms.insert_one(room.model_dump())
                rooms[name.lower()] = room.model_dump()
    created = updated = 0
    for m in mapped:
        area = m.pop("area", None)
        existing = await db.entities.find_one({"ha_entity_id": m["ha_entity_id"]}, NOID)
        if existing:
            upd = {"state": {**(existing.get("state") or {}), **m["state"]}, "available": m["available"], "controls": m["controls"], "integration": m["integration"], "ha_device_id": m.get("ha_device_id")}
            if existing.get("type") != m["type"] and existing.get("type") in ("switch", "plug", "camera", "doorbell"):
                upd["type"] = m["type"]
            await db.entities.update_one({"id": existing["id"]}, {"$set": upd})
            updated += 1
        else:
            room = rooms.get((area or "").lower())
            ent = Entity(**m, room_id=room["id"] if room else None)
            await db.entities.insert_one(ent.model_dump())
            created += 1
    await push_notification("info", "Import da Home Assistant completato", f"{created} nuove entità, {updated} aggiornate, {len(area_names)} aree.")
    await broadcast({"type": "refresh"})
    return {"created": created, "updated": updated, "areas": area_names, "total_mapped": len(mapped), "ha_states": len(states or [])}


async def ha_check_and_import(settings: Dict[str, Any]):
    st = await ha.check()
    await broadcast({"type": "ha", "ha": st})
    if st["connected"]:
        try:
            await ha_import_entities()
            await ha_autodetect_panel()
        except Exception as exc:  # noqa: BLE001
            logger.warning("HA import failed: %s", exc)


async def ha_autodetect_panel():
    """Map the first HA alarm_control_panel automatically when the user has not chosen one yet."""
    settings = await get_settings_doc()
    if settings.get("alarm_entity_id"):
        return
    states = await ha.rest("GET", "/api/states", timeout=15)
    panel = next((s for s in states or [] if s["entity_id"].startswith("alarm_control_panel.")), None)
    if not panel:
        return
    a = panel.get("attributes") or {}
    upd = {"alarm_entity_id": panel["entity_id"], "alarm_ha_state": panel.get("state") or "",
           "alarm_modes": hac.panel_modes(a.get("supported_features"))}
    mode = hac.HA_ALARM_MODE.get(panel.get("state") or "")
    if mode:
        upd["alarm_armed"] = mode
    await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    await push_notification("info", "Pannello antintrusione HA collegato", f"{a.get('friendly_name') or panel['entity_id']}")
    await broadcast({"type": "settings", "settings": public_settings(await get_settings_doc())})


async def sync_alarm_from_ha(eid: str, new: Dict[str, Any], settings: Dict[str, Any]):
    raw = new.get("state") or ""
    mode = hac.HA_ALARM_MODE.get(raw)
    upd: Dict[str, Any] = {"alarm_ha_state": raw}
    if not settings.get("alarm_entity_id"):
        upd["alarm_entity_id"] = eid
    if mode and mode != settings.get("alarm_armed"):
        upd["alarm_armed"] = mode
        await db.events.insert_one(SecurityEvent(source="Antintrusione", message=f"{ALARM_MODE_LABEL.get(mode, mode)} · da Home Assistant",
                                                 level="info" if mode == "disarmed" else "warning").model_dump())
    if raw == "triggered" and settings.get("alarm_ha_state") != "triggered":
        await db.events.insert_one(SecurityEvent(source="Antintrusione", message="ALLARME! Pannello in stato triggered", level="alert").model_dump())
        await push_notification("error", "ALLARME INTRUSIONE", "Il pannello antintrusione di Home Assistant è in allarme")
    await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    await broadcast({"type": "settings", "settings": public_settings(await get_settings_doc())})


async def _clear_flag(entity_id: str, key: str, delay: float):
    await asyncio.sleep(delay)
    await db.entities.update_one({"id": entity_id}, {"$set": {f"state.{key}": False}})
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    if doc:
        await broadcast({"type": "entities", "affected": [doc]})


async def ha_event(data: Dict[str, Any]):
    """state_changed handler: update the linked Domus entity (or the parent device that owns this control)."""
    eid, new = data.get("entity_id"), data.get("new_state")
    if not eid or not new:
        return
    if eid.startswith("alarm_control_panel."):
        settings = await get_settings_doc()
        if (settings.get("alarm_entity_id") or eid) == eid:
            await sync_alarm_from_ha(eid, new, settings)
        return
    affected: List[Dict[str, Any]] = []
    ent = await db.entities.find_one({"ha_entity_id": eid}, NOID)
    if ent:
        patch = hac.state_from_ha(ent["type"], new)
        upd = {"state": {**(ent.get("state") or {}), **patch}, "available": new.get("state") != "unavailable", "last_seen": now_iso()}
        await db.entities.update_one({"id": ent["id"]}, {"$set": upd})
        affected.append({**ent, **upd})
        if ent["type"] == "alarm_zone" and patch.get("triggered") and not (ent.get("state") or {}).get("triggered"):
            await db.events.insert_one(SecurityEvent(source=ent["name"], message="Zona attivata", level="warning").model_dump())
    parents = await db.entities.find({"$or": [{f"controls.{k}": eid} for k in ("privacy", "night_vision", "motion_detection", "siren", "led", "flip", "ptz_preset", "chime", "unlock", "ring", "motion", "battery", "signal", "power_w", "energy_kwh", "voltage_v", "current_a")]}, NOID).to_list(50)
    for p in parents:
        key = next((k for k, v in (p.get("controls") or {}).items() if v == eid), None)
        if not key:
            continue
        s, a = new.get("state"), new.get("attributes") or {}
        val: Any
        if key in ("battery", "signal", "power_w", "energy_kwh", "voltage_v", "current_a"):
            val = hac.fnum(s)
        elif key == "unlock":
            key, val = "locked", s == "locked"
        elif key == "ring":
            r = hac.state_from_ha("doorbell", new)
            key, val = "ringing", r.get("ringing", False)
            if val:
                await db.entities.update_one({"id": p["id"]}, {"$set": {"state.last_ring": now_iso()}})
                await db.events.insert_one(SecurityEvent(source=p["name"], message="Campanello suonato", level="warning").model_dump())
                await push_notification("warning", f"{p['name']}: qualcuno sta suonando", "", p["id"])
                asyncio.create_task(_clear_flag(p["id"], "ringing", 40))
        elif key == "motion":
            val = s == "on"
            if val:
                await db.entities.update_one({"id": p["id"]}, {"$set": {"state.last_motion": now_iso()}})
        elif hac.domain_of(eid) == "select":
            val = s
        else:
            val = s == "on"
        await db.entities.update_one({"id": p["id"]}, {"$set": {f"state.{key}": val}})
        doc = await db.entities.find_one({"id": p["id"]}, NOID)
        if doc:
            affected.append(doc)
    if affected:
        await broadcast({"type": "entities", "affected": dedupe(affected)})


@api_router.get("/ha/status")
async def ha_status():
    return ha.status()


@api_router.post("/ha/check")
async def ha_check():
    st = await ha.check()
    await broadcast({"type": "ha", "ha": st})
    return st


@api_router.post("/ha/config")
async def ha_config(payload: HAConfig):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None and k != "ha_token_clear"}
    if "ha_token" in upd and not upd["ha_token"].strip():
        upd.pop("ha_token")
    if payload.ha_token_clear:
        upd["ha_token"] = ""
        upd["ha_enabled"] = False
    if upd:
        await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    doc = await get_settings_doc()
    ha.configure(doc.get("ha_url"), doc.get("ha_token"), doc.get("ha_enabled"))
    st = await ha.check()
    await broadcast({"type": "ha", "ha": st})
    if st["connected"]:
        asyncio.create_task(ha_autodetect_panel())
    return {"settings": public_settings(doc), "ha": st}


@api_router.post("/ha/import")
async def ha_import():
    st = await ha.check()
    if not st["connected"]:
        raise HTTPException(503, f"Home Assistant non raggiungibile: {st.get('last_error') or 'modalità demo'}")
    res = await ha_import_entities()
    await ha_autodetect_panel()
    return res


@api_router.get("/ha/states")
async def ha_states(limit: int = 500):
    if not ha.connected:
        raise HTTPException(503, "Home Assistant non connesso (modalità demo)")
    states = await ha.rest("GET", "/api/states", timeout=20)
    linked = {e["ha_entity_id"] for e in await db.entities.find({"ha_entity_id": {"$ne": None}}, {"_id": 0, "ha_entity_id": 1}).to_list(5000)}
    return [{"entity_id": s["entity_id"], "state": s.get("state"), "name": (s.get("attributes") or {}).get("friendly_name"), "linked": s["entity_id"] in linked} for s in (states or [])[:limit]]


HA_PROXY_PREFIXES = ("/api/camera_proxy/", "/api/camera_proxy_stream/", "/api/image_proxy/", "/api/media_player_proxy/", "/api/tts_proxy/")


@api_router.get("/ha/proxy")
async def ha_proxy(path: str):
    if not ha.connected or ".." in path or "%2e%2e" in path.lower() or not path.startswith(HA_PROXY_PREFIXES):
        raise HTTPException(404, "Non disponibile")
    try:
        content, ctype = await ha.fetch_bytes(path)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"HA: {exc}")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "no-store"})


# ---------- Routes: Views (Terminus custom dashboards) ----------
@api_router.get("/views", response_model=List[View])
async def list_views():
    return await db.views.find({}, NOID).sort("order", 1).to_list(200)


@api_router.post("/views", response_model=View)
async def create_view(payload: ViewCreate):
    count = await db.views.count_documents({})
    v = View(**payload.model_dump(exclude_none=True), order=count)
    await db.views.insert_one(v.model_dump())
    return v


@api_router.patch("/views/{vid}", response_model=View)
async def update_view(vid: str, payload: ViewUpdate):
    upd = payload.model_dump(exclude_unset=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.views.update_one({"id": vid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "View not found")
    return await db.views.find_one({"id": vid}, NOID)


@api_router.delete("/views/{vid}")
async def delete_view(vid: str):
    res = await db.views.delete_one({"id": vid})
    if res.deleted_count == 0:
        raise HTTPException(404, "View not found")
    return {"ok": True}


# ---------- Routes: Cameras / doorbells ----------
async def _get_entity(entity_id: str, types: Optional[tuple] = None) -> Dict[str, Any]:
    e = await db.entities.find_one({"id": entity_id}, NOID)
    if not e or (types and e["type"] not in types):
        raise HTTPException(404, "Entity not found")
    return e


@api_router.post("/cameras/{entity_id}/ptz")
async def camera_ptz(entity_id: str, payload: PTZBody):
    cam = await _get_entity(entity_id, ("camera", "doorbell"))
    if payload.preset:
        res = await apply_state(entity_id, {"ptz_preset": payload.preset}, propagate=False)
        await db.events.insert_one(SecurityEvent(source=cam["name"], message=f"PTZ → preset {payload.preset}", level="info").model_dump())
        return {"ok": True, "entity": res[0]}
    if payload.direction:
        ctrl = (cam.get("controls") or {}).get("ptz_move")
        if ha.connected and cam.get("ha_entity_id"):
            try:
                if ctrl:
                    await ha.call_service("button", "press", {"entity_id": ctrl})
                else:
                    await ha.call_service("onvif", "ptz", {"entity_id": cam["ha_entity_id"], "pan": payload.direction.upper() if payload.direction in ("left", "right") else None,
                                                            "tilt": payload.direction.upper() if payload.direction in ("up", "down") else None, "zoom": payload.direction.upper() if payload.direction in ("zoom_in", "zoom_out") else None,
                                                            "move_mode": "ContinuousMove", "continuous_duration": 0.5})
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(502, f"PTZ non riuscito: {exc}")
        await db.entities.update_one({"id": entity_id}, {"$set": {"state.ptz_last": payload.direction}})
        return {"ok": True, "direction": payload.direction}
    raise HTTPException(400, "direction or preset required")


@api_router.post("/cameras/{entity_id}/simulate-motion")
async def camera_simulate_motion(entity_id: str):
    cam = await _get_entity(entity_id, ("camera", "doorbell", "alarm_zone"))
    key = "triggered" if cam["type"] == "alarm_zone" else "motion"
    await db.entities.update_one({"id": entity_id}, {"$set": {f"state.{key}": True, "state.last_motion" if key == "motion" else "state.last_triggered": now_iso()}})
    await db.events.insert_one(SecurityEvent(source=cam["name"], message="Movimento rilevato" if key == "motion" else "Zona attivata", level="warning").model_dump())
    await push_notification("warning", f"{cam['name']}: {'movimento rilevato' if key == 'motion' else 'zona attivata'}", "", entity_id)

    async def clear():
        await asyncio.sleep(25)
        await db.entities.update_one({"id": entity_id}, {"$set": {f"state.{key}": False}})
        doc = await db.entities.find_one({"id": entity_id}, NOID)
        if doc:
            await broadcast({"type": "entities", "affected": [doc]})
    asyncio.create_task(clear())
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    await broadcast({"type": "entities", "affected": [doc]})
    return doc


@api_router.get("/cameras/{entity_id}/snapshot")
async def camera_snapshot(entity_id: str):
    cam = await _get_entity(entity_id, ("camera", "doorbell"))
    if ha.connected and cam.get("ha_entity_id", "").startswith("camera."):
        try:
            content, ctype = await ha.fetch_bytes(f"/api/camera_proxy/{cam['ha_entity_id']}")
            return Response(content=content, media_type=ctype, headers={"Cache-Control": "no-store"})
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"Snapshot non disponibile: {exc}")
    raise HTTPException(404, "Snapshot disponibile solo con Home Assistant connesso")


@api_router.get("/cameras/{entity_id}/stream")
async def camera_stream(entity_id: str):
    cam = await _get_entity(entity_id, ("camera", "doorbell"))
    if not (ha.connected and cam.get("ha_entity_id", "").startswith("camera.")):
        raise HTTPException(404, "Stream disponibile solo con Home Assistant connesso")
    client = httpx.AsyncClient(timeout=None)
    try:
        resp = await client.send(client.build_request("GET", f"{ha.url}/api/camera_proxy_stream/{cam['ha_entity_id']}", headers=ha.headers), stream=True)
    except Exception as exc:  # noqa: BLE001
        await client.aclose()
        raise HTTPException(502, f"MJPEG non disponibile: {str(exc)[:140]}")
    if resp.status_code >= 400:
        await resp.aclose()
        await client.aclose()
        raise HTTPException(502, f"MJPEG non disponibile (HA {resp.status_code})")

    async def gen():
        try:
            async for chunk in resp.aiter_bytes():
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()
    return StreamingResponse(gen(), media_type=resp.headers.get("content-type") or "multipart/x-mixed-replace;boundary=--frameboundary")


@api_router.post("/cameras/{entity_id}/stream-url")
async def camera_stream_url(entity_id: str):
    """Ask HA for a live HLS playlist and return it proxied through Domus (frontend falls back to MJPEG/snapshot)."""
    cam = await _get_entity(entity_id, ("camera", "doorbell"))
    eid = cam.get("ha_entity_id") or ""
    if not (ha.connected and eid.startswith("camera.")):
        return {"available": False, "reason": "demo", "mjpeg": False}
    try:
        res = await ha.stream_source(eid, "hls")
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "reason": str(exc)[:200], "mjpeg": True}
    path = (res or {}).get("url") or ""
    if "/api/hls/" not in path:
        return {"available": False, "reason": "HLS non disponibile per questa telecamera", "mjpeg": True}
    return {"available": True, "format": "hls", "url": f"/api/ha/hls/{path.split('/api/hls/', 1)[1]}", "mjpeg": True}


@api_router.get("/ha/hls/{path:path}")
async def ha_hls(path: str):
    """Transparent proxy for HA HLS playlists/segments (relative URLs inside the playlist keep working)."""
    if not ha.connected or ".." in path or "%2e%2e" in path.lower() or not re.fullmatch(r"[A-Za-z0-9_\-./]+", path or ""):
        raise HTTPException(404, "Stream non disponibile")
    try:
        content, ctype = await ha.fetch_bytes(f"/api/hls/{path}", timeout=25)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"HLS: {str(exc)[:160]}")
    if path.endswith(".m3u8"):
        ctype = "application/vnd.apple.mpegurl"
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "no-store"})


# ---------- Routes: Cast (camera / dashboard su schermi) ----------
@api_router.post("/cast/{entity_id}")
async def cast_to_screen(entity_id: str, payload: CastBody):
    target = await _get_entity(entity_id, ("media_player",))
    label = payload.label or ""
    cast: Dict[str, Any] = {"kind": payload.kind, "ts": now_iso()}
    if payload.kind == "camera":
        if not payload.camera_id:
            raise HTTPException(400, "camera_id richiesto")
        cam = await _get_entity(payload.camera_id, ("camera", "doorbell"))
        label = label or cam["name"]
        cast.update({"camera_id": cam["id"], "label": label})
        if ha.connected and target.get("ha_entity_id") and (cam.get("ha_entity_id") or "").startswith("camera."):
            try:
                await ha.call_service("camera", "play_stream", {"entity_id": cam["ha_entity_id"], "media_player": target["ha_entity_id"], "format": "hls"})
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(502, f"Cast non riuscito: {str(exc)[:160]}")
        else:
            cast["demo"] = True
    else:
        if not payload.url:
            raise HTTPException(400, "url richiesto")
        parsed = urlparse(payload.url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or "@" in (parsed.netloc or ""):
            raise HTTPException(400, "URL non valido: ammessi solo http(s) senza credenziali")
        label = label or "Dashboard Domus"
        cast.update({"url": payload.url, "label": label})
        if ha.connected and target.get("ha_entity_id"):
            try:
                await ha.call_service("media_player", "play_media", {"entity_id": target["ha_entity_id"], "media_content_type": "url",
                                                                     "media_content_id": payload.url, "extra": {"title": label}})
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(502, f"Cast non riuscito: {str(exc)[:160]}")
        else:
            cast["demo"] = True
    state = {**(target.get("state") or {}), "cast": cast, "power": True, "status": "playing", "media_title": label,
             "media_artist": "Domus Cast", "media_duration": 0, "media_position": 0}
    await db.entities.update_one({"id": entity_id}, {"$set": {"state": state}})
    await db.events.insert_one(SecurityEvent(source=target["name"], message=f"Cast avviato: {label}", level="info").model_dump())
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    await broadcast({"type": "entities", "affected": [doc]})
    return {"entity": doc, "demo": bool(cast.get("demo"))}


@api_router.post("/cast/{entity_id}/stop")
async def cast_stop(entity_id: str):
    target = await _get_entity(entity_id, ("media_player",))
    if ha.connected and target.get("ha_entity_id"):
        try:
            await ha.call_service("media_player", "media_stop", {"entity_id": target["ha_entity_id"]})
        except Exception as exc:  # noqa: BLE001
            logger.warning("cast stop failed: %s", exc)
    state = {**(target.get("state") or {}), "cast": None, "status": "idle", "media_title": None, "media_artist": None}
    await db.entities.update_one({"id": entity_id}, {"$set": {"state": state}})
    doc = await db.entities.find_one({"id": entity_id}, NOID)
    await broadcast({"type": "entities", "affected": [doc]})
    return {"entity": doc}


# ---------- Routes: Media players ----------
DEMO_TRACKS = [("Stranger Things · S4 E7", "Netflix", 4620), ("The Bear · S3 E1", "Disney+", 1800), ("Radio Deejay", "TuneIn", 0), ("Discover Weekly", "Spotify", 214), ("Serie A · Highlights", "DAZN", 900)]


def media_apply(state: Dict[str, Any], command: str, value: Any) -> Dict[str, Any]:
    p: Dict[str, Any] = {}
    if command == "turn_on":
        p = {"power": True, "status": "idle" if state.get("status") in ("off", None) else state.get("status")}
    elif command == "turn_off":
        p = {"power": False, "status": "off", "media_title": None, "media_artist": None, "app": None}
    elif command in ("play", "pause", "play_pause", "stop"):
        cur = state.get("status")
        nxt = {"play": "playing", "pause": "paused", "stop": "idle", "play_pause": "paused" if cur == "playing" else "playing"}[command]
        p = {"status": nxt, "power": True}
        if nxt == "playing" and not state.get("media_title"):
            t = random.choice(DEMO_TRACKS)
            p.update({"media_title": t[0], "media_artist": t[1], "media_duration": t[2], "media_position": 0})
    elif command in ("next", "previous"):
        t = random.choice(DEMO_TRACKS)
        p = {"media_title": t[0], "media_artist": t[1], "media_duration": t[2], "media_position": 0, "status": "playing", "power": True}
    elif command == "volume_set":
        p = {"volume": max(0, min(100, int(value))), "muted": False}
    elif command == "volume_up":
        p = {"volume": min(100, int(state.get("volume", 30)) + 5)}
    elif command == "volume_down":
        p = {"volume": max(0, int(state.get("volume", 30)) - 5)}
    elif command == "mute":
        p = {"muted": bool(value)}
    elif command == "select_source":
        p = {"source": value, "power": True}
    elif command == "launch_app":
        app = next((a for a in state.get("app_list", []) if a.get("id") == value or a.get("name") == value), None)
        p = {"app": app["name"] if app else value, "power": True, "status": "playing", "media_title": f"{(app or {}).get('name', value)} · Home", "media_artist": (app or {}).get("name", value), "media_position": 0, "media_duration": 0}
    elif command == "seek":
        p = {"media_position": max(0, min(int(state.get("media_duration") or 0), int(value)))}
    elif command == "shuffle":
        p = {"shuffle": bool(value)}
    elif command == "repeat":
        p = {"repeat": value or "off"}
    else:
        raise HTTPException(400, f"Comando sconosciuto: {command}")
    return p


@api_router.post("/media/{entity_id}/command")
async def media_command(entity_id: str, payload: MediaCommand):
    e = await _get_entity(entity_id, ("media_player",))
    patch = media_apply(e.get("state") or {}, payload.command, payload.value)
    e["state"] = {**(e.get("state") or {}), **patch}
    await db.entities.update_one({"id": entity_id}, {"$set": {"state": e["state"]}})
    if ha.connected and e.get("ha_entity_id"):
        svc = hac.media_service(e, payload.command, payload.value)
        if svc:
            try:
                await ha.call_service(*svc)
            except Exception as exc:  # noqa: BLE001
                await push_notification("error", f"Comando media non inviato a {e['name']}", str(exc)[:140], entity_id)
    return e


@api_router.post("/media/tts")
async def media_tts(payload: TTSBody):
    if not payload.message.strip():
        raise HTTPException(400, "Messaggio vuoto")
    settings = await get_settings_doc()
    q: Dict[str, Any] = {"type": "media_player"}
    if payload.ids:
        q["id"] = {"$in": payload.ids}
    targets = await db.entities.find(q, NOID).to_list(200)
    sent, errors = [], []
    for e in targets:
        await db.entities.update_one({"id": e["id"]}, {"$set": {"state.last_tts": {"message": payload.message, "ts": now_iso()}}})
        if ha.connected and e.get("ha_entity_id"):
            svc = hac.tts_service(e, payload.message, payload.announce, settings.get("tts_entity", ""))
            try:
                if svc:
                    await ha.call_service(*svc)
            except Exception as exc:  # noqa: BLE001
                errors.append({"id": e["id"], "error": str(exc)[:140]})
                continue
        sent.append(e["id"])
    await push_notification("info", "Annuncio vocale inviato", f"«{payload.message[:60]}» → {len(sent)} dispositivi" + (" (demo)" if not ha.connected else ""))
    return {"sent": sent, "errors": errors, "demo": not ha.connected}


@api_router.post("/media/notify")
async def media_notify(payload: NotifyBody):
    if not payload.message.strip():
        raise HTTPException(400, "Messaggio vuoto")
    q: Dict[str, Any] = {"type": "media_player", "$or": [{"state.screen": True}, {"state.device_class": "tv"}]}
    if payload.ids:
        q = {"type": "media_player", "id": {"$in": payload.ids}}
    targets = await db.entities.find(q, NOID).to_list(200)
    sent, errors = [], []
    for e in targets:
        await db.entities.update_one({"id": e["id"]}, {"$set": {"state.last_notify": {"title": payload.title, "message": payload.message, "ts": now_iso()}}})
        if ha.connected and e.get("ha_entity_id"):
            svc = hac.notify_service(e, payload.title, payload.message, payload.duration)
            try:
                if svc:
                    await ha.call_service(*svc)
            except Exception as exc:  # noqa: BLE001
                errors.append({"id": e["id"], "error": str(exc)[:140]})
                continue
        sent.append(e["id"])
    await push_notification("info", "Notifica inviata agli schermi", f"«{payload.message[:60]}» → {len(sent)} schermi" + (" (demo)" if not ha.connected else ""))
    return {"sent": sent, "errors": errors, "demo": not ha.connected}


async def media_loop():
    while True:
        try:
            if not ha.connected:
                players = await db.entities.find({"type": "media_player", "state.status": "playing"}, NOID).to_list(100)
                for p in players:
                    s = p.get("state") or {}
                    dur, pos = int(s.get("media_duration") or 0), int(s.get("media_position") or 0)
                    if dur:
                        await db.entities.update_one({"id": p["id"]}, {"$set": {"state.media_position": (pos + 10) % dur}})
        except Exception as exc:  # noqa: BLE001
            logger.warning("media loop error: %s", exc)
        await asyncio.sleep(10)


# ---------- Routes: Backups ----------
@api_router.get("/backups")
async def list_backups():
    settings = await get_settings_doc()
    path = bk.resolve_dir(settings)
    chk = bk.check_dir(path)
    return {"dir": chk, "auto": settings.get("backup_auto", "daily"), "retention": settings.get("backup_retention", 10), "last": settings.get("backup_last"), "items": bk.list_backups(path)}


@api_router.post("/backups")
async def create_backup(label: Optional[str] = None):
    settings = await get_settings_doc()
    try:
        info = await bk.create(db, settings, label=label)
    except PermissionError as exc:
        raise HTTPException(400, f"Cartella backup non scrivibile: {exc}")
    await push_notification("info", "Backup creato", info["name"])
    return info


@api_router.post("/backups/{name}/restore")
async def restore_backup(name: str, include_settings: bool = True, payload: PinBody | None = None):
    settings = await get_settings_doc()
    await require_pin(settings, (payload or PinBody()).pin, "config")
    try:
        path = bk.resolve_dir(settings) / bk.safe_name(name)
        data = bk.load_file(path)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(404, str(exc))
    counts = await bk.restore(db, data, include_settings=include_settings)
    await evaluate_all()
    await push_notification("warning", "Backup ripristinato", f"{name} · " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    await broadcast({"type": "refresh"})
    return {"ok": True, "counts": counts}


@api_router.delete("/backups/{name}")
async def delete_backup(name: str):
    settings = await get_settings_doc()
    try:
        path = bk.resolve_dir(settings) / bk.safe_name(name)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if not path.exists():
        raise HTTPException(404, "Backup non trovato")
    path.unlink()
    return {"ok": True}


@api_router.get("/backups/{name}/download")
async def download_backup(name: str):
    settings = await get_settings_doc()
    try:
        path = bk.resolve_dir(settings) / bk.safe_name(name)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if not path.exists():
        raise HTTPException(404, "Backup non trovato")
    return FileResponse(path, media_type="application/json", filename=name)


@api_router.post("/backups/import")
async def import_backup(file: UploadFile = File(...), restore: bool = False, pin: Optional[str] = None):
    raw = await file.read()
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(413, "File troppo grande")
    try:
        data = bk.validate(_json.loads(raw.decode("utf-8")))
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(400, f"Backup non valido: {exc}")
    settings = await get_settings_doc()
    path = bk.resolve_dir(settings)
    chk = bk.check_dir(path)
    if not chk["writable"]:
        raise HTTPException(400, f"Cartella backup non scrivibile: {chk['error']}")
    tag = re.sub(r"[^A-Za-z0-9_]+", "_", Path(file.filename or "import").stem)[:30] or "import"
    name = f"domus-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{tag}.json"
    (path / name).write_text(_json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    counts = None
    if restore:
        await require_pin(settings, pin, "config")
        counts = await bk.restore(db, data)
        await evaluate_all()
        await broadcast({"type": "refresh"})
    await push_notification("info", "Backup importato" + (" e ripristinato" if restore else ""), name)
    return {"ok": True, "saved_as": name, "counts": counts, "info": bk.describe(path / name)}


@api_router.get("/problems")
async def list_problems():
    offline = await db.entities.find({"available": False}, NOID).to_list(500)
    low_batt = await db.entities.find({"state.battery": {"$ne": None, "$lt": 25}}, NOID).to_list(500)
    warns = await db.notifications.find({"level": {"$in": ["warning", "error"]}, "read": False}, NOID).sort("ts", -1).to_list(50)
    return {"offline": offline, "low_battery": low_batt, "warnings": warns, "ha": ha.status()}


@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    try:
        await ws.send_text(_json.dumps({"type": "ha", "ha": ha.status()}, default=str))
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):  # noqa: BLE001
        ws_clients.discard(ws)


@api_router.get("/")
async def root():
    return {"app": "Domus", "sections": ["Sol Invictus", "Terminus"]}


app.include_router(api_router)

CORS_ORIGINS = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials="*" not in CORS_ORIGINS,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.readings.create_index([("entity_id", 1), ("ts", 1)])
    await db.readings.create_index([("ts", 1)])
    await db.entities.create_index([("ha_entity_id", 1)])
    await seed_if_needed()
    settings = await get_settings_doc()
    if not settings.get("pin_hash"):
        await db.settings.update_one({"id": "singleton"}, {"$set": {"pin_hash": pinlib.hash_pin(pinlib.DEFAULT_PIN)}}, upsert=True)
        settings = await get_settings_doc()
        logger.info("Default security PIN provisioned - change it in Impostazioni > Sicurezza")
    ha.on_event(ha_event)
    ha.configure(settings.get("ha_url"), settings.get("ha_token"), settings.get("ha_enabled"))
    if ha.enabled:
        asyncio.create_task(ha_check_and_import(settings))
    asyncio.create_task(climate_loop())
    asyncio.create_task(metering_loop())
    asyncio.create_task(media_loop())
    asyncio.create_task(bk.scheduler_loop(db, get_settings_doc))
    logger.info("Domus API ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
