from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Any, Dict
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Domus API")
api_router = APIRouter(prefix="/api")


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
    color: str = "#f59e0b"


class RoomCreate(BaseModel):
    name: str
    icon: Optional[str] = "home"
    color: Optional[str] = "#f59e0b"


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


EntityType = Literal[
    "light", "plug", "scene", "automation", "camera", "intercom", "alarm_zone", "sensor", "thermostat"
]


class Entity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    type: EntityType
    room_id: Optional[str] = None
    integration: str = "generic"   # sonoff | tuya | tapo | blink
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


class Scene(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    icon: str = "sparkles"
    color: str = "#f59e0b"


class SecurityEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    timestamp: str = Field(default_factory=now_iso)
    source: str
    message: str
    level: str = "info"  # info | warning | alert


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "singleton"
    address: str = "Roma, Italia"
    latitude: float = 41.9028
    longitude: float = 12.4964
    dynamic_colors: bool = True
    theme_mode: str = "auto"  # auto | light | dark
    home_name: str = "Casa Domus"
    alarm_armed: str = "disarmed"  # disarmed | home | away


class SettingsUpdate(BaseModel):
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    dynamic_colors: Optional[bool] = None
    theme_mode: Optional[str] = None
    home_name: Optional[str] = None
    alarm_armed: Optional[str] = None


# ---------- Helpers ----------
async def strip_id(doc):
    if doc:
        doc.pop("_id", None)
    return doc


# ---------- Seed ----------
async def seed_if_empty():
    if await db.rooms.count_documents({}) > 0:
        return

    rooms = [
        {"id": gen_id(), "name": "Salotto", "icon": "sofa", "order": 0, "color": "#f59e0b"},
        {"id": gen_id(), "name": "Cucina", "icon": "chef-hat", "order": 1, "color": "#ef4444"},
        {"id": gen_id(), "name": "Camera Matrimoniale", "icon": "bed", "order": 2, "color": "#8b5cf6"},
        {"id": gen_id(), "name": "Bagno", "icon": "bath", "order": 3, "color": "#06b6d4"},
        {"id": gen_id(), "name": "Giardino", "icon": "trees", "order": 4, "color": "#22c55e"},
        {"id": gen_id(), "name": "Garage", "icon": "car", "order": 5, "color": "#64748b"},
    ]
    await db.rooms.insert_many([dict(r) for r in rooms])
    salotto, cucina, camera, bagno, giardino, garage = [r["id"] for r in rooms]

    entities = [
        # Lights
        {"id": gen_id(), "name": "Plafoniera Salotto", "type": "light", "room_id": salotto, "integration": "sonoff", "icon": "lightbulb",
         "state": {"on": True, "brightness": 78, "color_temp": 3200, "rgb": [255, 214, 170], "supports_color": True, "supports_dimming": True}},
        {"id": gen_id(), "name": "Lampada Divano", "type": "light", "room_id": salotto, "integration": "tuya", "icon": "lamp",
         "state": {"on": False, "brightness": 40, "rgb": [200, 100, 255], "supports_color": True, "supports_dimming": True}},
        {"id": gen_id(), "name": "Striscia LED TV", "type": "light", "room_id": salotto, "integration": "tuya", "icon": "wand",
         "state": {"on": True, "brightness": 60, "rgb": [100, 200, 255], "supports_color": True, "supports_dimming": True}},
        {"id": gen_id(), "name": "Faretti Cucina", "type": "light", "room_id": cucina, "integration": "sonoff", "icon": "lightbulb",
         "state": {"on": True, "brightness": 90, "supports_dimming": True}},
        {"id": gen_id(), "name": "Sottopensile", "type": "light", "room_id": cucina, "integration": "sonoff", "icon": "wand",
         "state": {"on": False, "brightness": 50, "supports_dimming": True}},
        {"id": gen_id(), "name": "Abat-jour Sinistra", "type": "light", "room_id": camera, "integration": "tuya", "icon": "lamp",
         "state": {"on": False, "brightness": 30, "rgb": [255, 180, 100], "supports_color": True, "supports_dimming": True}},
        {"id": gen_id(), "name": "Plafoniera Camera", "type": "light", "room_id": camera, "integration": "sonoff", "icon": "lightbulb",
         "state": {"on": False, "brightness": 100, "supports_dimming": True}},
        {"id": gen_id(), "name": "Specchio Bagno", "type": "light", "room_id": bagno, "integration": "sonoff", "icon": "lightbulb",
         "state": {"on": True, "brightness": 100}},
        {"id": gen_id(), "name": "Faretti Giardino", "type": "light", "room_id": giardino, "integration": "tuya", "icon": "lightbulb",
         "state": {"on": True, "brightness": 70, "rgb": [255, 235, 200], "supports_color": True, "supports_dimming": True}},
        # Plugs
        {"id": gen_id(), "name": "Presa TV", "type": "plug", "room_id": salotto, "integration": "sonoff", "icon": "plug",
         "state": {"on": True, "power_w": 145.3}},
        {"id": gen_id(), "name": "Presa Frigo", "type": "plug", "room_id": cucina, "integration": "sonoff", "icon": "plug",
         "state": {"on": True, "power_w": 89.2}},
        {"id": gen_id(), "name": "Caricabatterie", "type": "plug", "room_id": camera, "integration": "tuya", "icon": "plug",
         "state": {"on": False, "power_w": 0.0}},
        {"id": gen_id(), "name": "Presa Garage", "type": "plug", "room_id": garage, "integration": "tuya", "icon": "plug",
         "state": {"on": False, "power_w": 0.0}},
        # Thermostat
        {"id": gen_id(), "name": "Termostato Salotto", "type": "thermostat", "room_id": salotto, "integration": "tuya", "icon": "thermometer",
         "state": {"on": True, "current_temp": 21.5, "target_temp": 22.0, "mode": "heat"}},
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
        # Automations & Scenes
        {"id": gen_id(), "name": "Buonanotte", "type": "scene", "room_id": None, "integration": "generic", "icon": "moon",
         "state": {"color": "#6366f1"}},
        {"id": gen_id(), "name": "Cinema", "type": "scene", "room_id": None, "integration": "generic", "icon": "clapperboard",
         "state": {"color": "#ec4899"}},
        {"id": gen_id(), "name": "Alba", "type": "scene", "room_id": None, "integration": "generic", "icon": "sunrise",
         "state": {"color": "#f59e0b"}},
        {"id": gen_id(), "name": "Tutto Spento", "type": "scene", "room_id": None, "integration": "generic", "icon": "power-off",
         "state": {"color": "#64748b"}},
        {"id": gen_id(), "name": "Luci al Tramonto", "type": "automation", "room_id": None, "integration": "generic", "icon": "sunset",
         "state": {"enabled": True, "trigger": "sunset"}},
        {"id": gen_id(), "name": "Simulazione Presenza", "type": "automation", "room_id": None, "integration": "generic", "icon": "user-check",
         "state": {"enabled": False, "trigger": "vacation"}},
    ]
    await db.entities.insert_many([dict(e) for e in entities])

    # Unassigned devices (newly discovered)
    discovered = [
        {"id": gen_id(), "name": "Sonoff MINIR2 - Ripostiglio", "type": "light", "integration": "sonoff", "icon": "lightbulb", "discovered_at": now_iso()},
        {"id": gen_id(), "name": "Tuya WiFi Plug 16A", "type": "plug", "integration": "tuya", "icon": "plug", "discovered_at": now_iso()},
        {"id": gen_id(), "name": "Tapo C210 Cam", "type": "camera", "integration": "tapo", "icon": "cctv", "discovered_at": now_iso()},
    ]
    await db.discovered.insert_many([dict(d) for d in discovered])

    # Settings
    await db.settings.insert_one(Settings().model_dump())

    # Security events
    events = [
        {"id": gen_id(), "timestamp": now_iso(), "source": "Giardino Frontale", "message": "Movimento rilevato", "level": "warning"},
        {"id": gen_id(), "timestamp": now_iso(), "source": "Sistema", "message": "Sistema disarmato", "level": "info"},
        {"id": gen_id(), "timestamp": now_iso(), "source": "Citofono Ingresso", "message": "Chiamata ricevuta", "level": "info"},
    ]
    await db.events.insert_many([dict(e) for e in events])


# ---------- Routes: Rooms ----------
@api_router.get("/rooms", response_model=List[Room])
async def list_rooms():
    docs = await db.rooms.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return docs


@api_router.post("/rooms", response_model=Room)
async def create_room(payload: RoomCreate):
    count = await db.rooms.count_documents({})
    room = Room(name=payload.name, icon=payload.icon or "home", color=payload.color or "#f59e0b", order=count)
    await db.rooms.insert_one(room.model_dump())
    return room


@api_router.patch("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, payload: RoomUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.rooms.update_one({"id": room_id}, {"$set": upd})
    doc = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Room not found")
    return doc


@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str):
    await db.entities.update_many({"room_id": room_id}, {"$set": {"room_id": None}})
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
    docs = await db.entities.find(q, {"_id": 0}).to_list(2000)
    return docs


@api_router.post("/entities", response_model=Entity)
async def create_entity(payload: EntityCreate):
    ent = Entity(**payload.model_dump(exclude_none=True))
    await db.entities.insert_one(ent.model_dump())
    return ent


@api_router.patch("/entities/{entity_id}", response_model=Entity)
async def update_entity(entity_id: str, payload: EntityUpdate):
    upd_raw = payload.model_dump(exclude_none=True)
    upd: Dict[str, Any] = {}
    if "name" in upd_raw:
        upd["name"] = upd_raw["name"]
    if "room_id" in upd_raw:
        upd["room_id"] = upd_raw["room_id"]
    if "icon" in upd_raw:
        upd["icon"] = upd_raw["icon"]
    if "state" in upd_raw:
        # merge state
        current = await db.entities.find_one({"id": entity_id}, {"_id": 0})
        if not current:
            raise HTTPException(404, "Entity not found")
        merged = {**(current.get("state") or {}), **upd_raw["state"]}
        upd["state"] = merged
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.entities.update_one({"id": entity_id}, {"$set": upd})
    doc = await db.entities.find_one({"id": entity_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Entity not found")
    return doc


@api_router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str):
    res = await db.entities.delete_one({"id": entity_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Entity not found")
    return {"ok": True}


@api_router.post("/entities/{entity_id}/move/{room_id}")
async def move_entity(entity_id: str, room_id: str):
    target = None if room_id == "unassigned" else room_id
    if target:
        exists = await db.rooms.find_one({"id": target})
        if not exists:
            raise HTTPException(404, "Room not found")
    await db.entities.update_one({"id": entity_id}, {"$set": {"room_id": target}})
    doc = await db.entities.find_one({"id": entity_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Entity not found")
    return doc


# ---------- Routes: Discovered ----------
@api_router.get("/discovered", response_model=List[DiscoveredDevice])
async def list_discovered():
    docs = await db.discovered.find({}, {"_id": 0}).to_list(1000)
    return docs


@api_router.post("/discovered/{disc_id}/assign/{room_id}", response_model=Entity)
async def assign_discovered(disc_id: str, room_id: str):
    disc = await db.discovered.find_one({"id": disc_id}, {"_id": 0})
    if not disc:
        raise HTTPException(404, "Discovered device not found")
    target_room = None if room_id == "unassigned" else room_id
    if target_room:
        r = await db.rooms.find_one({"id": target_room})
        if not r:
            raise HTTPException(404, "Room not found")
    # Create matching entity state defaults
    default_state: Dict[str, Any] = {}
    if disc["type"] == "light":
        default_state = {"on": False, "brightness": 80, "supports_dimming": True, "supports_color": True, "rgb": [255, 235, 200]}
    elif disc["type"] == "plug":
        default_state = {"on": False, "power_w": 0.0}
    elif disc["type"] == "camera":
        default_state = {"streaming": True, "recording": False, "motion": False}
    ent = Entity(
        name=disc["name"], type=disc["type"], room_id=target_room,
        integration=disc.get("integration", "generic"), icon=disc.get("icon", "lightbulb"),
        state=default_state,
    )
    await db.entities.insert_one(ent.model_dump())
    await db.discovered.delete_one({"id": disc_id})
    return ent


@api_router.post("/discovered/mock")
async def mock_new_discovery():
    """Utility for demo: enqueue a fake newly-detected device."""
    d = DiscoveredDevice(name="Nuovo Sonoff Basic R3", type="light", integration="sonoff", icon="lightbulb")
    await db.discovered.insert_one(d.model_dump())
    return d


# ---------- Routes: Settings ----------
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    if not doc:
        s = Settings()
        await db.settings.insert_one(s.model_dump())
        return s
    return doc


@api_router.patch("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.settings.update_one({"id": "singleton"}, {"$set": upd}, upsert=True)
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    return doc


# ---------- Routes: Events ----------
@api_router.get("/events", response_model=List[SecurityEvent])
async def list_events(limit: int = 50):
    docs = await db.events.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return docs


@api_router.post("/events", response_model=SecurityEvent)
async def create_event(evt: SecurityEvent):
    if not evt.id:
        evt.id = gen_id()
    if not evt.timestamp:
        evt.timestamp = now_iso()
    await db.events.insert_one(evt.model_dump())
    return evt


# ---------- Routes: Intercom / Alarm actions ----------
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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await seed_if_empty()
    logger.info("Domus API ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
