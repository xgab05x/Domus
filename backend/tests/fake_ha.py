"""Minimal fake Home Assistant (REST + WebSocket) used to exercise the Domus connector in the preview environment.
Run: python tests/fake_ha.py  (listens on 127.0.0.1:8123, token 'demo-token')."""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect

TOKEN = os.environ.get("FAKE_HA_TOKEN", "demo-token")
app = FastAPI()
calls = []


def ts():
    return datetime.now(timezone.utc).isoformat()


STATES = {
    "light.cucina_faretti": {"state": "on", "attributes": {"friendly_name": "Faretti Cucina HA", "brightness": 200, "supported_color_modes": ["brightness"]}},
    "light.led_salotto": {"state": "off", "attributes": {"friendly_name": "LED Salotto HA", "brightness": 80, "rgb_color": [255, 100, 50], "supported_color_modes": ["hs", "color_temp"]}},
    "switch.presa_forno": {"state": "on", "attributes": {"friendly_name": "Presa Forno HA", "device_class": "outlet"}},
    "sensor.presa_forno_power": {"state": "1850.5", "attributes": {"friendly_name": "Presa Forno Power", "device_class": "power", "unit_of_measurement": "W"}},
    "sensor.presa_forno_energy": {"state": "12.4", "attributes": {"friendly_name": "Presa Forno Energy", "device_class": "energy", "unit_of_measurement": "kWh"}},
    "camera.tapo_ingresso": {"state": "streaming", "attributes": {"friendly_name": "Tapo Ingresso HA", "brand": "TP-Link", "model_name": "C210"}},
    "switch.tapo_ingresso_privacy_mode": {"state": "off", "attributes": {"friendly_name": "Tapo Ingresso Privacy mode"}},
    "select.tapo_ingresso_night_vision": {"state": "auto", "attributes": {"friendly_name": "Tapo Ingresso Night vision", "options": ["auto", "on", "off"]}},
    "binary_sensor.tapo_ingresso_motion": {"state": "off", "attributes": {"friendly_name": "Tapo Ingresso Motion", "device_class": "motion"}},
    "binary_sensor.porta_garage": {"state": "off", "attributes": {"friendly_name": "Porta Garage Contatto HA", "device_class": "door"}},
    "sensor.porta_garage_battery": {"state": "63", "attributes": {"friendly_name": "Porta Garage Battery", "device_class": "battery"}},
    "camera.blink_doorbell": {"state": "idle", "attributes": {"friendly_name": "Blink Doorbell HA"}},
    "event.blink_doorbell_ring": {"state": "unknown", "attributes": {"friendly_name": "Blink Doorbell Ring", "device_class": "doorbell", "event_types": ["press"]}},
    "media_player.android_tv_camera": {"state": "playing", "attributes": {"friendly_name": "Android TV Camera HA", "volume_level": 0.4, "source_list": ["Netflix", "YouTube"], "source": "Netflix", "app_name": "Netflix", "media_title": "Demo movie", "media_duration": 3600, "media_position": 120, "device_class": "tv"}},
    "media_player.echo_show_bagno": {"state": "idle", "attributes": {"friendly_name": "Echo Show Bagno HA", "volume_level": 0.5}},
    "climate.termostato_studio": {"state": "heat", "attributes": {"friendly_name": "Termostato Studio HA", "current_temperature": 19.2, "temperature": 21.0, "hvac_modes": ["heat", "off"]}},
    "sensor.studio_temperatura": {"state": "19.2", "attributes": {"friendly_name": "Studio Temperatura", "device_class": "temperature"}},
    "scene.serata_film": {"state": "unknown", "attributes": {"friendly_name": "Serata Film HA"}},
    "alarm_control_panel.allarme_casa": {"state": "disarmed", "attributes": {"friendly_name": "Allarme Casa HA", "code_arm_required": False, "code_format": "number", "supported_features": 63, "changed_by": None}},
    "automation.luci_notte": {"state": "on", "attributes": {"friendly_name": "Luci Notte HA"}},
}
REG = {
    "entities": [
        {"entity_id": "switch.presa_forno", "device_id": "dev_forno", "platform": "sonoff", "area_id": "cucina"},
        {"entity_id": "sensor.presa_forno_power", "device_id": "dev_forno", "platform": "sonoff"},
        {"entity_id": "sensor.presa_forno_energy", "device_id": "dev_forno", "platform": "sonoff"},
        {"entity_id": "light.cucina_faretti", "device_id": "dev_faretti", "platform": "sonoff", "area_id": "cucina"},
        {"entity_id": "light.led_salotto", "device_id": "dev_led", "platform": "tuya", "area_id": "studio"},
        {"entity_id": "camera.tapo_ingresso", "device_id": "dev_tapo", "platform": "tapo"},
        {"entity_id": "switch.tapo_ingresso_privacy_mode", "device_id": "dev_tapo", "platform": "tapo"},
        {"entity_id": "select.tapo_ingresso_night_vision", "device_id": "dev_tapo", "platform": "tapo"},
        {"entity_id": "binary_sensor.tapo_ingresso_motion", "device_id": "dev_tapo", "platform": "tapo"},
        {"entity_id": "binary_sensor.porta_garage", "device_id": "dev_porta", "platform": "zha", "area_id": "garage"},
        {"entity_id": "sensor.porta_garage_battery", "device_id": "dev_porta", "platform": "zha"},
        {"entity_id": "camera.blink_doorbell", "device_id": "dev_blink", "platform": "blink"},
        {"entity_id": "event.blink_doorbell_ring", "device_id": "dev_blink", "platform": "blink"},
        {"entity_id": "media_player.echo_show_bagno", "device_id": "dev_echo", "platform": "alexa_media", "area_id": "bagno"},
        {"entity_id": "media_player.android_tv_camera", "device_id": "dev_atv", "platform": "androidtv", "area_id": "studio"},
        {"entity_id": "climate.termostato_studio", "device_id": "dev_clima", "platform": "tuya", "area_id": "studio"},
        {"entity_id": "alarm_control_panel.allarme_casa", "device_id": "dev_alarm", "platform": "manual"},
    ],
    "devices": [{"id": "dev_forno", "area_id": "cucina", "manufacturer": "Sonoff"}, {"id": "dev_faretti"}, {"id": "dev_led"}, {"id": "dev_tapo", "model": "C210"}, {"id": "dev_porta"},
                {"id": "dev_blink", "model": "Blink Video Doorbell"}, {"id": "dev_echo"}, {"id": "dev_atv"}, {"id": "dev_clima"}, {"id": "dev_alarm"}],
    "areas": [{"area_id": "cucina", "name": "Cucina"}, {"area_id": "studio", "name": "Studio"}, {"area_id": "garage", "name": "Garage"}, {"area_id": "bagno", "name": "Bagno"}],
}
subscribers = set()


def auth(h):
    if h != f"Bearer {TOKEN}":
        raise HTTPException(401, "unauthorized")


def state_obj(eid):
    s = STATES[eid]
    return {"entity_id": eid, "state": s["state"], "attributes": s["attributes"], "last_changed": ts(), "last_updated": ts()}


async def emit(eid, old):
    ev = {"event_type": "state_changed", "data": {"entity_id": eid, "old_state": old, "new_state": state_obj(eid)}, "time_fired": ts()}
    for ws in list(subscribers):
        try:
            await ws.send_text(json.dumps({"id": 1, "type": "event", "event": ev}))
        except Exception:
            subscribers.discard(ws)


async def set_state(eid, state=None, attrs=None):
    old = state_obj(eid)
    if state is not None:
        STATES[eid]["state"] = state
    if attrs:
        STATES[eid]["attributes"].update(attrs)
    await emit(eid, old)


@app.get("/api/")
async def root(authorization: str = Header("")):
    auth(authorization); return {"message": "API running."}


@app.get("/api/config")
async def config(authorization: str = Header("")):
    auth(authorization); return {"version": "2026.6.1", "location_name": "Casa Fake HA"}


@app.get("/api/states")
async def states(authorization: str = Header("")):
    auth(authorization); return [state_obj(e) for e in STATES]


@app.get("/api/states/{eid}")
async def state_one(eid: str, authorization: str = Header("")):
    auth(authorization)
    if eid not in STATES:
        raise HTTPException(404, "not found")
    return state_obj(eid)


@app.get("/api/services")
async def services(authorization: str = Header("")):
    auth(authorization)
    return [{"domain": "notify", "services": {"alexa_media_echo_show_bagno": {}, "android_tv_camera": {}, "mobile_app_phone": {}}}, {"domain": "light", "services": {"turn_on": {}, "turn_off": {}}}]


@app.post("/api/services/{domain}/{service}")
async def call_service(domain: str, service: str, body: dict, authorization: str = Header("")):
    auth(authorization)
    calls.append({"domain": domain, "service": service, "data": body, "ts": ts()})
    eid = body.get("entity_id")
    if isinstance(eid, str) and eid in STATES:
        if service in ("turn_on", "turn_off"):
            attrs = {}
            if "brightness_pct" in body:
                attrs["brightness"] = round(body["brightness_pct"] * 2.55)
            if "rgb_color" in body:
                attrs["rgb_color"] = body["rgb_color"]
            await set_state(eid, "on" if service == "turn_on" else "off", attrs)
        elif service == "select_option":
            await set_state(eid, body.get("option"))
        elif service == "volume_set":
            await set_state(eid, None, {"volume_level": body["volume_level"]})
        elif service in ("media_pause", "media_play", "media_play_pause"):
            await set_state(eid, "paused" if service == "media_pause" or (service == "media_play_pause" and STATES[eid]["state"] == "playing") else "playing")
        elif service == "set_temperature":
            await set_state(eid, None, {"temperature": body["temperature"]})
        elif service.startswith("alarm_"):
            mapping = {"alarm_disarm": "disarmed", "alarm_arm_home": "armed_home", "alarm_arm_away": "armed_away",
                       "alarm_arm_night": "armed_night", "alarm_arm_vacation": "armed_vacation", "alarm_arm_custom_bypass": "armed_custom_bypass"}
            if service in mapping:
                await set_state(eid, mapping[service], {"changed_by": "Domus"})
    return []


@app.get("/api/hls/{path:path}")
async def fake_hls(path: str, authorization: str = Header("")):
    from fastapi.responses import Response
    body = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nplaylist.m3u8\n" if path.endswith("master_playlist.m3u8") else "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-ENDLIST\n"
    return Response(content=body, media_type="application/vnd.apple.mpegurl")


@app.get("/api/camera_proxy/{eid}")
async def camera_proxy(eid: str, authorization: str = Header("")):
    auth(authorization)
    from fastapi.responses import Response
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0300050001019cd7c2900000000049454e44ae426082")
    return Response(content=png, media_type="image/png")


@app.get("/_test/calls")
async def test_calls():
    return calls


@app.post("/_test/set/{eid}")
async def test_set(eid: str, body: dict):
    await set_state(eid, body.get("state"), body.get("attributes"))
    return state_obj(eid)


@app.websocket("/api/websocket")
async def websocket(ws: WebSocket):
    await ws.accept()
    await ws.send_text(json.dumps({"type": "auth_required", "ha_version": "2026.6.1"}))
    m = json.loads(await ws.receive_text())
    if m.get("access_token") != TOKEN:
        await ws.send_text(json.dumps({"type": "auth_invalid", "message": "bad token"})); await ws.close(); return
    await ws.send_text(json.dumps({"type": "auth_ok", "ha_version": "2026.6.1"}))
    try:
        while True:
            m = json.loads(await ws.receive_text())
            t, mid = m.get("type"), m.get("id")
            if t == "subscribe_events":
                subscribers.add(ws)
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": True, "result": None}))
            elif t == "config/entity_registry/list":
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": True, "result": REG["entities"]}))
            elif t == "config/device_registry/list":
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": True, "result": REG["devices"]}))
            elif t == "config/area_registry/list":
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": True, "result": REG["areas"]}))
            elif t == "camera/stream":
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": True, "result": {"url": "/api/hls/faketoken/master_playlist.m3u8"}}))
            elif t == "get_states":
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": True, "result": [state_obj(e) for e in STATES]}))
            else:
                await ws.send_text(json.dumps({"id": mid, "type": "result", "success": False, "error": {"code": "unknown_command", "message": t}}))
    except WebSocketDisconnect:
        subscribers.discard(ws)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
