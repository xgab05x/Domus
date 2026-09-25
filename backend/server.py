from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import time
from pathlib import Path
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

SEED_VERSION = 2
SYNC_KEYS = ("on", "brightness", "rgb", "color_temp")
NOID = {"_id": 0}

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
    "light", "plug", "switch", "scene", "automation", "camera", "intercom", "alarm_zone", "sensor", "thermostat"
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


class EntityCreate(BaseModel):
    name: str
    type: EntityType
    room_id: Optional[str] = None
    integration: Optional[str] = "generic"
    icon: Optional[str] = "lightbulb"
    state: Optional[Dict[str, Any]] = None


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    room_id: Optional[str] = None
    icon: Optional[str] = None
    state: Optional[Dict[str, Any]] = None


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
    weather_override: str = "auto"
    color_presets: List[Dict[str, Any]] = Field(default_factory=lambda: list(DEFAULT_COLOR_PRESETS))
    climate_presets: Dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_CLIMATE_PRESETS))
    seed_version: int = SEED_VERSION


class SettingsUpdate(BaseModel):
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    dynamic_colors: Optional[bool] = None
    theme_mode: Optional[str] = None
    home_name: Optional[str] = None
    alarm_armed: Optional[str] = None
    weather_override: Optional[str] = None
    color_presets: Optional[List[Dict[str, Any]]] = None
    climate_presets: Optional[Dict[str, float]] = None


# ---------- Helpers ----------
async def get_settings_doc() -> Dict[str, Any]:
    doc = await db.settings.find_one({"id": "singleton"}, NOID)
    if not doc:
        s = Settings()
        await db.settings.insert_one(s.model_dump())
        return s.model_dump()
    return {**Settings().model_dump(), **doc}


async def apply_state(entity_id: str, patch: Dict[str, Any], propagate: bool = True) -> List[Dict[str, Any]]:
    """Merge a state patch into an entity and mirror sync keys to linked group members."""
    current = await db.entities.find_one({"id": entity_id}, NOID)
    if not current:
        raise HTTPException(404, "Entity not found")
    current["state"] = {**(current.get("state") or {}), **patch}
    await db.entities.update_one({"id": entity_id}, {"$set": {"state": current["state"]}})
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
        if simulate and sensor and temp is not None:
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
    for coll in ("rooms", "entities", "discovered", "groups", "scenes", "thermostats", "zones", "events"):
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
        "sens_salotto", "sens_camera",
    )}

    def light(key, name, room, integ, icon="lightbulb", **state):
        return {"id": ids[key], "name": name, "type": "light", "room_id": room, "integration": integ, "icon": icon, "state": state}

    def switch(key, name, room, integ, icon="toggle-left", on=False):
        return {"id": ids[key], "name": name, "type": "switch", "room_id": room, "integration": integ, "icon": icon, "state": {"on": on}}

    def plug(key, name, room, integ, on, power):
        return {"id": ids[key], "name": name, "type": "plug", "room_id": room, "integration": integ, "icon": "plug", "state": {"on": on, "power_w": power}}

    def thermo(key, name, room, integ, cur, target, mode="heat", on=False, icon="fan"):
        return {"id": ids[key], "name": name, "type": "thermostat", "room_id": room, "integration": integ, "icon": icon,
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
        plug("presa_tv", "Presa TV", salotto, "sonoff", True, 145.3),
        plug("presa_frigo", "Presa Frigo", cucina, "sonoff", True, 89.2),
        plug("carica", "Caricabatterie", camera, "tuya", False, 0.0),
        plug("presa_garage", "Presa Garage", garage, "tuya", False, 0.0),
        thermo("vc1", "Ventilconvettore Soggiorno 1", salotto, "sonoff", 20.6, 21.0),
        thermo("vc2", "Ventilconvettore Soggiorno 2", salotto, "sonoff", 20.9, 21.0),
        thermo("term_camera", "Termostato Camera", camera, "tuya", 19.4, 17.0, icon="thermometer"),
        thermo("clima_cucina", "Climatizzatore Cucina", cucina, "tuya", 23.8, 24.0, mode="cool", icon="snowflake"),
        {"id": ids["sens_salotto"], "name": "Sensore Clima Salotto", "type": "sensor", "room_id": salotto, "integration": "sonoff", "icon": "gauge",
         "state": {"temperature": 20.4, "humidity": 47}},
        {"id": ids["sens_camera"], "name": "Sensore Clima Camera", "type": "sensor", "room_id": camera, "integration": "sonoff", "icon": "gauge",
         "state": {"temperature": 19.1, "humidity": 52}},
        # Cameras
        {"id": gen_id(), "name": "Ingresso", "type": "camera", "room_id": None, "integration": "tapo", "icon": "cctv",
         "state": {"streaming": True, "recording": True, "motion": False}},
        {"id": gen_id(), "name": "Giardino Frontale", "type": "camera", "room_id": None, "integration": "tapo", "icon": "cctv",
         "state": {"streaming": True, "recording": True, "motion": True}},
        {"id": gen_id(), "name": "Retro Casa", "type": "camera", "room_id": None, "integration": "blink", "icon": "cctv",
         "state": {"streaming": True, "recording": False, "motion": False}},
        {"id": gen_id(), "name": "Garage Interno", "type": "camera", "room_id": None, "integration": "blink", "icon": "cctv",
         "state": {"streaming": True, "recording": False, "motion": False}},
        # Intercom
        {"id": gen_id(), "name": "Citofono Ingresso", "type": "intercom", "room_id": None, "integration": "tapo", "icon": "bell",
         "state": {"ringing": False, "last_call": None, "muted": False}},
        # Alarm zones
        {"id": gen_id(), "name": "Porta Ingresso", "type": "alarm_zone", "room_id": None, "integration": "sonoff", "icon": "door-closed",
         "state": {"kind": "contact", "triggered": False, "bypass": False}},
        {"id": gen_id(), "name": "Finestra Salotto", "type": "alarm_zone", "room_id": None, "integration": "sonoff", "icon": "door-open",
         "state": {"kind": "contact", "triggered": False, "bypass": False}},
        {"id": gen_id(), "name": "PIR Corridoio", "type": "alarm_zone", "room_id": None, "integration": "tuya", "icon": "radar",
         "state": {"kind": "motion", "triggered": False, "bypass": False}},
        {"id": gen_id(), "name": "Rottura Vetri Cucina", "type": "alarm_zone", "room_id": None, "integration": "tuya", "icon": "shield-alert",
         "state": {"kind": "glassbreak", "triggered": False, "bypass": False}},
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

    discovered = [
        {"id": gen_id(), "name": "Sonoff MINIR2 - Ripostiglio", "type": "light", "integration": "sonoff", "icon": "lightbulb", "discovered_at": now_iso()},
        {"id": gen_id(), "name": "Tuya WiFi Plug 16A", "type": "plug", "integration": "tuya", "icon": "plug", "discovered_at": now_iso()},
        {"id": gen_id(), "name": "Tapo C210 Cam", "type": "camera", "integration": "tapo", "icon": "cctv", "discovered_at": now_iso()},
    ]
    await db.discovered.insert_many([dict(d) for d in discovered])

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
    await db.settings.update_one({"id": "singleton"}, {"$set": merged}, upsert=True)
    await evaluate_all()


# ---------- Routes: aggregate ----------
@api_router.get("/app-data")
async def app_data():
    rooms, entities, discovered, events, groups, scenes, thermostats, zones = await asyncio.gather(
        db.rooms.find({}, NOID).sort("order", 1).to_list(1000),
        db.entities.find({}, NOID).to_list(3000),
        db.discovered.find({}, NOID).to_list(1000),
        db.events.find({}, NOID).sort("timestamp", -1).to_list(30),
        db.groups.find({}, NOID).to_list(500),
        db.scenes.find({}, NOID).to_list(500),
        db.thermostats.find({}, NOID).to_list(300),
        db.zones.find({}, NOID).to_list(300),
    )
    settings = await get_settings_doc()
    weather = await current_weather()
    return {"rooms": rooms, "entities": entities, "discovered": discovered, "events": events, "groups": groups,
            "scenes": scenes, "thermostats": thermostats, "zones": zones, "settings": settings, "weather": weather}


@api_router.get("/weather")
async def get_weather():
    return await current_weather()


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
    meta = {k: raw[k] for k in ("name", "room_id", "icon") if k in raw}
    if not meta and "state" not in raw:
        raise HTTPException(400, "Nothing to update")
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
async def activate_scene(scene_id: str):
    s = await db.scenes.find_one({"id": scene_id}, NOID)
    if not s:
        raise HTTPException(404, "Scene not found")
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
    elif disc["type"] in ("plug", "switch"):
        default_state = {"on": False, "power_w": 0.0}
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
    return await get_settings_doc()


@api_router.patch("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    if "climate_presets" in upd:
        await evaluate_all()
    return await get_settings_doc()


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
    await db.entities.update_one({"id": entity_id}, {"$set": {"state.ringing": True, "state.last_call": now_iso()}})
    await db.events.insert_one(SecurityEvent(source="Citofono", message="Chiamata in arrivo", level="warning").model_dump())
    return {"ok": True}


@api_router.post("/intercom/{entity_id}/answer")
async def intercom_answer(entity_id: str, action: str = "hangup"):
    await db.entities.update_one({"id": entity_id}, {"$set": {"state.ringing": False}})
    msg = "Porta aperta" if action == "unlock" else "Chiamata terminata"
    await db.events.insert_one(SecurityEvent(source="Citofono", message=msg, level="info").model_dump())
    return {"ok": True}


@api_router.post("/alarm/set/{mode}")
async def set_alarm(mode: str):
    if mode not in ("disarmed", "home", "away"):
        raise HTTPException(400, "Invalid mode")
    await db.settings.update_one({"id": "singleton"}, {"$set": {"alarm_armed": mode}}, upsert=True)
    label = {"disarmed": "Sistema disarmato", "home": "Sistema armato (Home)", "away": "Sistema armato (Away)"}[mode]
    await db.events.insert_one(SecurityEvent(source="Antintrusione", message=label, level="info" if mode == "disarmed" else "warning").model_dump())
    return {"mode": mode}


@api_router.get("/")
async def root():
    return {"app": "Domus", "sections": ["Sol Invictus", "Terminus"]}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed_if_needed()
    asyncio.create_task(climate_loop())
    logger.info("Domus API ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
