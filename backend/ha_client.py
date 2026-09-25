"""Home Assistant connector: REST + WebSocket, entity mapping and command translation."""
import asyncio
import json
import logging
import re
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import httpx
import websockets

logger = logging.getLogger("domus.ha")

MOTION_CLASSES = {"motion", "occupancy", "moving", "presence"}
CONTACT_CLASSES = {"door", "window", "opening", "garage_door"}
GLASS_CLASSES = {"vibration", "tamper", "sound"}
SAFETY_CLASSES = {"smoke", "gas", "moisture", "carbon_monoxide", "safety", "problem"}
CAMERA_CONTROLS = {
    "privacy": ("privacy", "lens_mask", "lens mask"), "night_vision": ("night", "ir_mode", "infrared"), "motion_detection": ("motion detection", "motion_detection", "detect"),
    "siren": ("siren", "alarm"), "led": ("led", "status light", "indicator"), "flip": ("flip", "mirror", "rotate"), "ptz_preset": ("preset",), "record": ("record",),
    "chime": ("chime", "ding"), "unlock": ("lock", "door"),
}
ZONE_ICON = {"motion": "radar", "contact": "door-closed", "glassbreak": "shield-alert", "safety": "siren"}
ALARM_SERVICE = {"disarmed": "alarm_disarm", "home": "alarm_arm_home", "away": "alarm_arm_away", "night": "alarm_arm_night",
                 "vacation": "alarm_arm_vacation", "custom": "alarm_arm_custom_bypass"}
HA_ALARM_MODE = {"disarmed": "disarmed", "armed_home": "home", "armed_away": "away", "armed_night": "night",
                 "armed_vacation": "vacation", "armed_custom_bypass": "custom"}
# alarm_control_panel supported_features bitmask (HA core)
PANEL_FEATURES = [(1, "home"), (2, "away"), (4, "night"), (16, "custom"), (32, "vacation")]


def panel_modes(supported_features: Any) -> List[str]:
    """Modes an HA alarm panel declares as supported (always includes `disarmed`)."""
    try:
        bits = int(supported_features)
    except (TypeError, ValueError):
        return ["disarmed", "home", "away"]
    return ["disarmed"] + [name for bit, name in PANEL_FEATURES if bits & bit]


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (s or "").lower()).strip("_")


def pct(v: Any, scale: float = 255.0) -> Optional[int]:
    try:
        return int(round(float(v) / scale * 100))
    except (TypeError, ValueError):
        return None


def fnum(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def domain_of(entity_id: str) -> str:
    return (entity_id or "").split(".", 1)[0]


# ---------- State translation (HA -> Domus) ----------
def zone_kind(device_class: str) -> Optional[str]:
    if device_class in MOTION_CLASSES:
        return "motion"
    if device_class in CONTACT_CLASSES:
        return "contact"
    if device_class in GLASS_CLASSES:
        return "glassbreak"
    if device_class in SAFETY_CLASSES:
        return "safety"
    return None


def state_from_ha(dtype: str, st: Dict[str, Any]) -> Dict[str, Any]:
    """Translate a raw HA state object into a Domus `state` patch for the given Domus type."""
    s, a = st.get("state"), st.get("attributes") or {}
    if dtype == "light":
        modes = a.get("supported_color_modes") or []
        out = {"on": s == "on", "supports_dimming": any(m in modes for m in ("brightness", "hs", "rgb", "rgbw", "rgbww", "xy", "color_temp")),
               "supports_color": any(m in modes for m in ("hs", "rgb", "rgbw", "rgbww", "xy"))}
        if a.get("brightness") is not None:
            out["brightness"] = max(1, pct(a["brightness"]) or 1)
        if a.get("rgb_color"):
            out["rgb"] = list(a["rgb_color"])[:3]
        if a.get("color_temp_kelvin"):
            out["color_temp"] = int(a["color_temp_kelvin"])
        if a.get("effect_list"):
            out["effect_list"] = list(a["effect_list"])[:60]
            out["effect"] = a.get("effect")
        return out
    if dtype in ("plug", "switch"):
        return {"on": s == "on"}
    if dtype == "alarm_zone":
        out = {"triggered": s == "on"}
        if s == "on":
            out["last_triggered"] = st.get("last_changed")
        return out
    if dtype == "sensor":
        dc = a.get("device_class")
        if dc == "temperature":
            return {"temperature": fnum(s)}
        if dc == "humidity":
            return {"humidity": fnum(s)}
        if domain_of(st.get("entity_id", "")) == "binary_sensor":
            return {"on": s == "on", "kind": dc or "generic"}
        return {"value": fnum(s) if fnum(s) is not None else s, "unit": a.get("unit_of_measurement")}
    if dtype == "meter":
        return {"power_w": fnum(s) or 0.0, "on": (fnum(s) or 0) > 1}
    if dtype == "thermostat":
        mode = a.get("hvac_mode") or s
        return {"on": s not in ("off", "unavailable", "unknown"), "current_temp": fnum(a.get("current_temperature")), "target_temp": fnum(a.get("temperature")),
                "mode": "cool" if mode == "cool" else "heat", "hvac_modes": a.get("hvac_modes") or []}
    if dtype == "camera":
        return {"streaming": s in ("streaming", "recording", "idle"), "recording": s == "recording", "motion_detection": bool(a.get("motion_detection", True)),
                "brand": a.get("brand"), "model": a.get("model_name"), "entity_picture": a.get("entity_picture")}
    if dtype == "doorbell":
        if domain_of(st.get("entity_id", "")) == "event":
            return {"last_ring": s if s not in ("unknown", "unavailable") else None, "ringing": (a.get("event_type") or "") in ("press", "ring", "single") and _recent(s)}
        if domain_of(st.get("entity_id", "")) == "binary_sensor":
            return {"ringing": s == "on", "last_ring": st.get("last_changed") if s == "on" else None}
        return {"streaming": s in ("streaming", "recording", "idle"), "recording": s == "recording", "entity_picture": a.get("entity_picture")}
    if dtype == "media_player":
        return {"power": s not in ("off", "unavailable", "unknown"), "status": s, "volume": pct(a.get("volume_level"), 1.0) if a.get("volume_level") is not None else None,
                "muted": bool(a.get("is_volume_muted")), "source": a.get("source"), "source_list": a.get("source_list") or [], "app": a.get("app_name"), "app_id": a.get("app_id"),
                "media_title": a.get("media_title"), "media_artist": a.get("media_artist") or a.get("media_series_title"), "media_album": a.get("media_album_name"),
                "media_image_url": a.get("entity_picture"), "media_duration": a.get("media_duration"), "media_position": a.get("media_position"),
                "device_class": a.get("device_class") or ("tv" if "tv" in (a.get("friendly_name") or "").lower() else "speaker"), "shuffle": a.get("shuffle"), "repeat": a.get("repeat"),
                "supported_features": a.get("supported_features", 0)}
    if dtype == "scene":
        return {"last_activated": s}
    if dtype == "automation":
        return {"enabled": s == "on", "trigger": a.get("last_triggered") or "HA"}
    return {"raw": s}


def _recent(ts: Optional[str], seconds: int = 45) -> bool:
    if not ts:
        return False
    try:
        from datetime import datetime
        return (time.time() - datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()) < seconds
    except ValueError:
        return False


def domus_type_for(st: Dict[str, Any], reg: Dict[str, Any], device: Dict[str, Any]) -> Optional[str]:
    eid = st["entity_id"]
    dom = domain_of(eid)
    a = st.get("attributes") or {}
    dc = a.get("device_class") or (reg or {}).get("original_device_class")
    name_l = (a.get("friendly_name") or eid).lower()
    model_l = ((device or {}).get("model") or "").lower()
    if dom == "light":
        return "light"
    if dom in ("switch", "input_boolean"):
        return "plug" if dc == "outlet" or "presa" in name_l or "plug" in name_l else "switch"
    if dom == "camera":
        return "doorbell" if "doorbell" in model_l or "doorbell" in name_l or "citofono" in name_l or "campanello" in name_l else "camera"
    if dom == "event" and (dc == "doorbell" or "doorbell" in name_l):
        return "doorbell"
    if dom == "binary_sensor":
        if "doorbell" in name_l or "campanello" in name_l:
            return "doorbell"
        return "alarm_zone" if zone_kind(dc or "") else "sensor"
    if dom == "sensor":
        if dc in ("temperature", "humidity"):
            return "sensor"
        if dc == "power":
            return "meter"
        return None
    if dom == "climate":
        return "thermostat"
    if dom == "media_player":
        return "media_player"
    if dom == "scene":
        return "scene"
    if dom == "automation":
        return "automation"
    return None


ICON_FOR = {"light": "lightbulb", "plug": "plug", "switch": "toggle-left", "camera": "cctv", "doorbell": "bell", "sensor": "gauge", "meter": "gauge",
            "thermostat": "thermometer", "media_player": "tv", "scene": "sparkles", "automation": "wand"}


def map_entities(states: List[Dict[str, Any]], registries: Dict[str, Any], notify_services: Optional[List[str]] = None) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Map raw HA states + registries into Domus entity dicts (keyed by ha_entity_id) and the list of HA area names."""
    ent_reg = {e["entity_id"]: e for e in (registries.get("entities") or [])}
    devices = {d["id"]: d for d in (registries.get("devices") or [])}
    areas = {a["area_id"]: a for a in (registries.get("areas") or [])}
    by_device: Dict[str, List[Dict[str, Any]]] = {}
    for st in states:
        reg = ent_reg.get(st["entity_id"]) or {}
        if reg.get("device_id"):
            by_device.setdefault(reg["device_id"], []).append(st)
    out: List[Dict[str, Any]] = []
    consumed: set = set()
    for st in states:
        eid = st["entity_id"]
        if eid in consumed:
            continue
        reg = ent_reg.get(eid) or {}
        if reg.get("disabled_by") or reg.get("hidden_by"):
            continue
        dev = devices.get(reg.get("device_id") or "") or {}
        dtype = domus_type_for(st, reg, dev)
        if not dtype:
            continue
        a = st.get("attributes") or {}
        area = areas.get(reg.get("area_id") or dev.get("area_id") or "") or {}
        platform = reg.get("platform") or dev.get("manufacturer") or "home_assistant"
        state = state_from_ha(dtype, st)
        controls: Dict[str, Any] = {}
        siblings = [s for s in by_device.get(reg.get("device_id") or "", []) if s["entity_id"] != eid]
        if dtype == "alarm_zone":
            state["kind"] = zone_kind(a.get("device_class") or reg.get("original_device_class") or "") or "contact"
            state.setdefault("bypass", False)
        if dtype in ("camera", "doorbell", "alarm_zone", "plug", "meter", "media_player", "sensor", "light", "switch"):
            for sib in siblings:
                sd, sa = domain_of(sib["entity_id"]), sib.get("attributes") or {}
                sdc = sa.get("device_class") or (ent_reg.get(sib["entity_id"]) or {}).get("original_device_class")
                sname = (sa.get("friendly_name") or sib["entity_id"]).lower()
                if sd == "sensor" and sdc == "battery":
                    state["battery"] = fnum(sib["state"]); controls["battery"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                elif sd == "sensor" and sdc == "signal_strength":
                    state["signal"] = fnum(sib["state"]); controls["signal"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                elif sd == "sensor" and sdc == "power" and dtype in ("plug", "switch", "light"):
                    state["power_w"] = fnum(sib["state"]) or 0.0; controls["power_w"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                    if dtype == "switch":
                        dtype = "plug"
                elif sd == "sensor" and sdc == "energy" and dtype in ("plug", "meter", "switch"):
                    state["energy_kwh"] = fnum(sib["state"]) or 0.0; controls["energy_kwh"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                elif sd == "sensor" and sdc == "voltage" and dtype in ("plug", "meter", "switch"):
                    state["voltage_v"] = fnum(sib["state"]); controls["voltage_v"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                elif sd == "sensor" and sdc == "current" and dtype in ("plug", "meter", "switch"):
                    state["current_a"] = fnum(sib["state"]) or 0.0; controls["current_a"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                elif dtype in ("camera", "doorbell"):
                    if sd == "binary_sensor" and sdc in MOTION_CLASSES:
                        state["motion"] = sib["state"] == "on"; controls["motion"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                    elif sd in ("event", "binary_sensor") and (sdc == "doorbell" or "doorbell" in sname or "campanello" in sname or "ring" in sname):
                        dtype = "doorbell"; controls["ring"] = sib["entity_id"]; consumed.add(sib["entity_id"])
                        state.update({k: v for k, v in state_from_ha("doorbell", sib).items() if k in ("ringing", "last_ring")})
                    elif sd == "lock":
                        controls["unlock"] = sib["entity_id"]; state["locked"] = sib["state"] == "locked"; state["has_lock"] = True; consumed.add(sib["entity_id"])
                    elif sd in ("switch", "select", "number", "siren", "button"):
                        for key, kws in CAMERA_CONTROLS.items():
                            if key in controls or key in ("unlock",):
                                continue
                            if any(k in sname for k in kws):
                                controls[key] = sib["entity_id"]; consumed.add(sib["entity_id"])
                                if sd == "switch":
                                    state[key] = sib["state"] == "on"
                                elif sd == "select":
                                    state[key] = sib["state"]; state[f"{key}_options"] = sa.get("options") or []
                                break
        if dtype in ("camera", "doorbell"):
            state.setdefault("privacy", False); state.setdefault("night_vision", "auto"); state.setdefault("motion_detection", True)
            state.setdefault("siren", False); state.setdefault("led", True); state.setdefault("flip", False); state.setdefault("motion", False); state.setdefault("recording", False)
            state.setdefault("ptz_presets", state.get("ptz_preset_options") or [])
            state["ptz"] = "ptz_preset" in controls or bool(a.get("ptz"))
        if dtype == "doorbell":
            state.setdefault("ringing", False); state.setdefault("muted", False); state.setdefault("chime", True); state.setdefault("last_ring", None)
        if dtype == "media_player" and notify_services:
            sl = slug(a.get("friendly_name") or eid.split(".", 1)[1])
            for svc in notify_services:
                if sl and (sl in svc or svc.replace("alexa_media_", "") in sl):
                    controls["notify_service"] = svc
                    break
        icon = ICON_FOR.get(dtype, "lightbulb")
        if dtype == "alarm_zone":
            icon = ZONE_ICON.get(state.get("kind", "contact"), "radar")
        if dtype == "media_player":
            icon = "tv" if state.get("device_class") == "tv" else "speaker"
        out.append({"name": a.get("friendly_name") or eid, "type": dtype, "integration": platform, "icon": icon, "state": state,
                    "available": st.get("state") != "unavailable", "ha_entity_id": eid, "ha_device_id": reg.get("device_id"), "area": area.get("name"), "controls": controls})
        consumed.add(eid)
    return out, sorted({a["name"] for a in areas.values() if a.get("name")})


# ---------- Command translation (Domus -> HA) ----------
def _onoff(domain: str, eid: str, on: bool) -> Tuple[str, str, Dict[str, Any]]:
    return domain, "turn_on" if on else "turn_off", {"entity_id": eid}


def services_for_patch(entity: Dict[str, Any], patch: Dict[str, Any]) -> List[Tuple[str, str, Dict[str, Any]]]:
    """Translate a Domus state patch into HA service calls."""
    eid = entity.get("ha_entity_id")
    controls = entity.get("controls") or {}
    t = entity.get("type")
    calls: List[Tuple[str, str, Dict[str, Any]]] = []
    if not eid and not controls:
        return calls
    dom = domain_of(eid or "")
    if t == "light" and eid:
        if patch.get("on") is False:
            return [_onoff("light", eid, False)]
        data: Dict[str, Any] = {"entity_id": eid}
        if "brightness" in patch:
            data["brightness_pct"] = int(patch["brightness"])
        if "rgb" in patch:
            data["rgb_color"] = list(patch["rgb"])[:3]
        elif "color_temp" in patch:
            data["color_temp_kelvin"] = int(patch["color_temp"])
        if patch.get("effect"):
            data["effect"] = patch["effect"]
        if len(data) > 1 or patch.get("on"):
            calls.append(("light", "turn_on", data))
    elif t in ("plug", "switch", "meter") and eid and "on" in patch and dom in ("switch", "input_boolean", "fan", "light"):
        calls.append(_onoff(dom, eid, bool(patch["on"])))
    elif t == "thermostat" and eid and dom == "climate":
        if "target_temp" in patch and patch["target_temp"] is not None:
            calls.append(("climate", "set_temperature", {"entity_id": eid, "temperature": float(patch["target_temp"])}))
        if "on" in patch or "mode" in patch:
            on = patch.get("on", (entity.get("state") or {}).get("on", True))
            mode = patch.get("mode", (entity.get("state") or {}).get("mode", "heat"))
            calls.append(("climate", "set_hvac_mode", {"entity_id": eid, "hvac_mode": "off" if not on else ("cool" if mode == "cool" else "heat")}))
    elif t in ("camera", "doorbell"):
        for key in ("privacy", "siren", "led", "flip", "chime", "record"):
            if key in patch and controls.get(key):
                cdom = domain_of(controls[key])
                calls.append(_onoff(cdom if cdom in ("switch", "siren", "light") else "switch", controls[key], bool(patch[key])))
        if "motion_detection" in patch:
            if controls.get("motion_detection"):
                calls.append(_onoff(domain_of(controls["motion_detection"]), controls["motion_detection"], bool(patch["motion_detection"])))
            elif eid and dom == "camera":
                calls.append(("camera", "enable_motion_detection" if patch["motion_detection"] else "disable_motion_detection", {"entity_id": eid}))
        if "night_vision" in patch and controls.get("night_vision"):
            c = controls["night_vision"]
            if domain_of(c) == "select":
                opts = (entity.get("state") or {}).get("night_vision_options") or []
                want = str(patch["night_vision"]).lower()
                opt = next((o for o in opts if want in str(o).lower()), None) or patch["night_vision"]
                calls.append(("select", "select_option", {"entity_id": c, "option": opt}))
            else:
                calls.append(_onoff(domain_of(c), c, str(patch["night_vision"]).lower() != "off"))
        if "ptz_preset" in patch and controls.get("ptz_preset"):
            calls.append(("select", "select_option", {"entity_id": controls["ptz_preset"], "option": patch["ptz_preset"]}))
        if "locked" in patch and controls.get("unlock"):
            calls.append(("lock", "lock" if patch["locked"] else "unlock", {"entity_id": controls["unlock"]}))
        if "recording" in patch and eid and dom == "camera" and not controls.get("record"):
            calls.append(("camera", "record" if patch["recording"] else "turn_on", {"entity_id": eid}) if patch["recording"] else ("camera", "turn_on", {"entity_id": eid}))
    elif t == "scene" and eid and patch.get("on"):
        calls.append(("scene", "turn_on", {"entity_id": eid}))
    elif t == "automation" and eid and "enabled" in patch:
        calls.append(_onoff("automation", eid, bool(patch["enabled"])))
    return calls


MEDIA_SIMPLE = {"turn_on": "turn_on", "turn_off": "turn_off", "play": "media_play", "pause": "media_pause", "play_pause": "media_play_pause", "stop": "media_stop",
                "next": "media_next_track", "previous": "media_previous_track", "volume_up": "volume_up", "volume_down": "volume_down"}


def media_service(entity: Dict[str, Any], command: str, value: Any) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    eid = entity.get("ha_entity_id")
    if not eid:
        return None
    if command in MEDIA_SIMPLE:
        return "media_player", MEDIA_SIMPLE[command], {"entity_id": eid}
    if command == "volume_set":
        return "media_player", "volume_set", {"entity_id": eid, "volume_level": max(0.0, min(1.0, float(value) / 100))}
    if command == "mute":
        return "media_player", "volume_mute", {"entity_id": eid, "is_volume_muted": bool(value)}
    if command == "select_source":
        return "media_player", "select_source", {"entity_id": eid, "source": value}
    if command == "launch_app":
        if value in ((entity.get("state") or {}).get("source_list") or []):
            return "media_player", "select_source", {"entity_id": eid, "source": value}
        return "media_player", "play_media", {"entity_id": eid, "media_content_type": "app", "media_content_id": value}
    if command == "seek":
        return "media_player", "media_seek", {"entity_id": eid, "seek_position": float(value)}
    if command == "shuffle":
        return "media_player", "shuffle_set", {"entity_id": eid, "shuffle": bool(value)}
    if command == "repeat":
        return "media_player", "repeat_set", {"entity_id": eid, "repeat": value or "off"}
    if command == "play_url":
        return "media_player", "play_media", {"entity_id": eid, "media_content_type": "music", "media_content_id": value}
    return None


def tts_service(entity: Dict[str, Any], message: str, announce: bool, tts_entity: str) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    eid = entity.get("ha_entity_id")
    svc = (entity.get("controls") or {}).get("notify_service")
    if svc and svc.startswith("alexa_media"):
        return "notify", svc, {"message": message, "data": {"type": "announce" if announce else "tts"}}
    if not eid:
        return None
    if tts_entity:
        return "tts", "speak", {"entity_id": tts_entity, "media_player_entity_id": eid, "message": message, "language": "it"}
    return "tts", "google_translate_say", {"entity_id": eid, "message": message, "language": "it"}


def notify_service(entity: Dict[str, Any], title: str, message: str, duration: int) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    svc = (entity.get("controls") or {}).get("notify_service")
    if svc:
        return "notify", svc, {"title": title, "message": message, "data": {"duration": duration}}
    eid = entity.get("ha_entity_id")
    if eid and eid.startswith("media_player."):
        return "media_player", "play_media", {"entity_id": eid, "media_content_type": "text", "media_content_id": f"{title}: {message}" if title else message}
    return None


# ---------- Client ----------
class HAClient:
    def __init__(self):
        self.url = ""
        self.token = ""
        self.enabled = False
        self.connected = False
        self.version: Optional[str] = None
        self.location: Optional[str] = None
        self.last_error: Optional[str] = None
        self.last_check: Optional[float] = None
        self.last_event: Optional[float] = None
        self.entity_count = 0
        self.events_received = 0
        self._task: Optional[asyncio.Task] = None
        self._listener: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None

    def configure(self, url: str, token: str, enabled: bool) -> bool:
        new = ((url or "").rstrip("/"), token or "", bool(enabled) and bool(url) and bool(token))
        changed = new != (self.url, self.token, self.enabled)
        self.url, self.token, self.enabled = new
        if not self.enabled:
            self.connected = False
        if changed:
            self.restart()
        return changed

    @property
    def headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def ws_url(self) -> str:
        return self.url.replace("https://", "wss://").replace("http://", "ws://") + "/api/websocket"

    def status(self) -> Dict[str, Any]:
        return {"enabled": self.enabled, "connected": self.connected, "mode": "live" if self.connected else "demo", "url": self.url, "token_set": bool(self.token),
                "version": self.version, "location_name": self.location, "entity_count": self.entity_count, "last_error": self.last_error,
                "last_check": self.last_check, "last_event": self.last_event, "events_received": self.events_received}

    async def rest(self, method: str, path: str, json_body: Any = None, timeout: float = 10) -> Any:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.request(method, self.url + path, headers=self.headers, json=json_body)
            r.raise_for_status()
            return r.json() if r.content else None

    async def check(self) -> Dict[str, Any]:
        self.last_check = time.time()
        if not self.enabled:
            self.connected = False
            self.last_error = None if self.token and self.url else "URL o token mancanti"
            return self.status()
        try:
            cfg = await self.rest("GET", "/api/config", timeout=6)
            states = await self.rest("GET", "/api/states", timeout=10)
            self.version, self.location, self.entity_count = cfg.get("version"), cfg.get("location_name"), len(states or [])
            self.connected, self.last_error = True, None
        except Exception as exc:  # noqa: BLE001
            self.connected, self.last_error = False, f"{type(exc).__name__}: {exc}"[:300]
        return self.status()

    async def ws_call(self, body: Dict[str, Any], timeout: float = 10) -> Any:
        async with websockets.connect(self.ws_url(), open_timeout=timeout) as w:
            if json.loads(await w.recv()).get("type") != "auth_required":
                raise RuntimeError("Handshake HA inatteso")
            await w.send(json.dumps({"type": "auth", "access_token": self.token}))
            if json.loads(await w.recv()).get("type") != "auth_ok":
                raise RuntimeError("Token HA rifiutato")
            await w.send(json.dumps({"id": 1, **body}))
            m = json.loads(await w.recv())
            if not m.get("success"):
                raise RuntimeError(str(m.get("error")))
            return m.get("result")

    async def stream_source(self, entity_id: str, fmt: str = "hls") -> Dict[str, Any]:
        """Ask HA to publish a live stream for a camera (`camera/stream` → {"url": "/api/hls/<token>/master_playlist.m3u8"})."""
        return await self.ws_call({"type": "camera/stream", "entity_id": entity_id, "format": fmt}, timeout=20) or {}

    async def registries(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        for key, typ in (("entities", "config/entity_registry/list"), ("devices", "config/device_registry/list"), ("areas", "config/area_registry/list")):
            try:
                out[key] = await self.ws_call({"type": typ}) or []
            except Exception as exc:  # noqa: BLE001
                logger.warning("registry %s failed: %s", key, exc)
                out[key] = []
        return out

    async def notify_services(self) -> List[str]:
        try:
            svcs = await self.rest("GET", "/api/services")
        except Exception:  # noqa: BLE001
            return []
        for d in svcs or []:
            if d.get("domain") == "notify":
                return list((d.get("services") or {}).keys())
        return []

    async def call_service(self, domain: str, service: str, data: Dict[str, Any]) -> Any:
        return await self.rest("POST", f"/api/services/{domain}/{service}", json_body=data, timeout=15)

    async def call_many(self, calls: List[Tuple[str, str, Dict[str, Any]]]) -> None:
        for domain, service, data in calls:
            await self.call_service(domain, service, data)

    async def fetch_bytes(self, path: str, timeout: float = 20) -> Tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(self.url + path, headers=self.headers)
            r.raise_for_status()
            return r.content, r.headers.get("content-type", "image/jpeg")

    def on_event(self, cb: Callable[[Dict[str, Any]], Awaitable[None]]):
        self._listener = cb

    def restart(self):
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        if self.enabled:
            try:
                self._task = asyncio.get_running_loop().create_task(self._subscribe_loop())
            except RuntimeError:
                pass

    async def _subscribe_loop(self):
        delay = 3
        while self.enabled:
            try:
                async with websockets.connect(self.ws_url(), ping_interval=20, open_timeout=10) as w:
                    if json.loads(await w.recv()).get("type") != "auth_required":
                        raise RuntimeError("handshake")
                    await w.send(json.dumps({"type": "auth", "access_token": self.token}))
                    if json.loads(await w.recv()).get("type") != "auth_ok":
                        raise RuntimeError("Token HA rifiutato")
                    await w.send(json.dumps({"id": 1, "type": "subscribe_events", "event_type": "state_changed"}))
                    if not json.loads(await w.recv()).get("success"):
                        raise RuntimeError("subscribe failed")
                    self.connected, self.last_error, delay = True, None, 3
                    logger.info("HA websocket subscribed")
                    async for raw in w:
                        m = json.loads(raw)
                        if m.get("type") == "event" and self._listener:
                            self.events_received += 1
                            self.last_event = time.time()
                            try:
                                await self._listener(m["event"].get("data") or {})
                            except Exception as exc:  # noqa: BLE001
                                logger.warning("HA event handler error: %s", exc)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                self.connected = False
                self.last_error = f"{type(exc).__name__}: {exc}"[:300]
                logger.info("HA websocket down (%s), retry in %ss", self.last_error, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)
