"""Iteration 6 backend tests: logs, devices, automations, sounds, grids, alarm popup, LED effects.

Run: python -m pytest tests/test_domus_v6.py -q -p no:randomly -n 0
Requires fake HA on :8123.
"""
import io
import os
import time

import pytest
import requests


def _read_env(key):
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        return None
    return None


BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL missing"
API = f"{BASE}/api"
HA = "http://127.0.0.1:8123"
HA_TOK = "demo-token"
HA_HDR = {"Authorization": f"Bearer {HA_TOK}"}
DEV_HDR = {"X-Domus-Device-Id": "test-dev-v6", "X-Domus-Device-Name": "Tablet Test v6"}


def _wait_unlocked():
    st = requests.get(f"{API}/pin/status").json()
    if st.get("locked"):
        time.sleep(st.get("lock_seconds", 60) + 2)


@pytest.fixture(scope="module", autouse=True)
def _module_setup():
    try:
        requests.get(f"{HA}/api/config", headers=HA_HDR, timeout=3)
    except Exception:
        pytest.skip("fake HA not reachable")
    requests.post(f"{API}/ha/config", json={"ha_url": HA, "ha_token": HA_TOK, "ha_enabled": True}, timeout=10)
    requests.post(f"{API}/ha/check", timeout=10)
    _wait_unlocked()
    # disarm at start
    requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
    yield
    _wait_unlocked()
    # Reset HA alarm & popup toggles
    requests.post(f"{HA}/_test/set/alarm_control_panel.allarme_casa", json={"state": "disarmed"})
    requests.patch(f"{API}/settings", json={"intercom_popup": True, "alarm_popup": True, "pin": "1234"})
    requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})


# ---------- LOG API ----------
class TestLogs:
    def test_logs_kinds_present(self):
        r = requests.get(f"{API}/logs")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "kinds" in data
        for k in ("alarm", "entity", "editor", "security", "automation", "cast", "system"):
            assert k in data["kinds"], f"missing kind {k}"

    def test_entity_patch_logs_with_device_name(self):
        # Pick a light
        lights = requests.get(f"{API}/entities?type=light").json()
        assert lights
        light = lights[0]
        import random
        brightness = random.randint(11, 99)
        r = requests.patch(f"{API}/entities/{light['id']}",
                           json={"state": {"on": True, "brightness": brightness}},
                           headers={**DEV_HDR, "Content-Type": "application/json"})
        assert r.status_code == 200
        time.sleep(0.5)
        items = requests.get(f"{API}/logs", params={"kind": "entity", "entity_id": light["id"]}).json()["items"]
        assert items, "no entity log after PATCH"
        assert any(it.get("device_name") == "Tablet Test v6" for it in items[:5]), \
            f"device_name not captured: {[it.get('device_name') for it in items[:3]]}"

    def test_editor_log_on_room_create(self):
        r = requests.post(f"{API}/rooms", json={"name": "TEST_v6_room"},
                          headers={**DEV_HDR, "Content-Type": "application/json"})
        assert r.status_code == 200
        rid = r.json()["id"]
        time.sleep(0.4)
        items = requests.get(f"{API}/logs", params={"kind": "editor", "search": "TEST_v6_room"}).json()["items"]
        assert any("TEST_v6_room" in (it.get("message") or "") for it in items), "editor log missing"
        requests.delete(f"{API}/rooms/{rid}")

    def test_alarm_log_generated(self):
        _wait_unlocked()
        requests.post(f"{API}/alarm/set/away", json={}, headers=DEV_HDR)
        time.sleep(0.4)
        r = requests.get(f"{API}/logs", params={"kind": "alarm"}).json()
        assert r["items"], "no alarm logs"
        requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"}, headers=DEV_HDR)

    def test_logs_export_csv_italian_headers(self):
        r = requests.get(f"{API}/logs/export")
        assert r.status_code == 200
        text = r.text
        assert "Data/ora" in text and "Tipo" in text and "Dispositivo Domus" in text

    def test_logs_delete_requires_pin(self):
        _wait_unlocked()
        r = requests.delete(f"{API}/logs", json={})
        assert r.status_code == 401
        r = requests.delete(f"{API}/logs", json={"pin": "1234"})
        assert r.status_code == 200


# ---------- DEVICES ----------
class TestDevices:
    def test_heartbeat_and_list_online(self):
        r = requests.post(f"{API}/devices/heartbeat",
                          json={"device_id": "test-dev-v6", "name": "Tablet Test v6", "page": "sol", "agent": "pytest"})
        assert r.status_code == 200
        devs = requests.get(f"{API}/devices").json()
        me = next((d for d in devs if d["id"] == "test-dev-v6"), None)
        assert me and me.get("online") is True

    def test_rename_device_reflected_in_logs(self):
        # ensure exists
        requests.post(f"{API}/devices/heartbeat",
                      json={"device_id": "test-dev-v6", "name": "Tablet Test v6"})
        r = requests.patch(f"{API}/devices/test-dev-v6", json={"device_id": "test-dev-v6", "name": "Tablet Rinominato"})
        assert r.status_code == 200
        # generate a log with new name via X-Domus header (the middleware reads from headers, not from device doc)
        hdr = {"X-Domus-Device-Id": "test-dev-v6", "X-Domus-Device-Name": "Tablet Rinominato"}
        lights = requests.get(f"{API}/entities?type=light").json()
        requests.patch(f"{API}/entities/{lights[0]['id']}", json={"state": {"on": False}},
                       headers={**hdr, "Content-Type": "application/json"})
        time.sleep(0.4)
        items = requests.get(f"{API}/logs", params={"kind": "entity"}).json()["items"]
        assert any(it.get("device_name") == "Tablet Rinominato" for it in items[:5])


# ---------- AUTOMATIONS ----------
class TestAutomations:
    @pytest.fixture(scope="class")
    def light(self):
        return requests.get(f"{API}/entities?type=light").json()[0]

    def test_crud_and_manual_run(self, light):
        # Create
        payload = {
            "name": "TEST_v6_auto",
            "enabled": True,
            "triggers": [{"type": "state", "entity_id": light["id"], "key": "on", "op": "on"}],
            "actions": [
                {"type": "entity", "entity_id": light["id"], "state": {"brightness": 42}},
                {"type": "notify", "level": "info", "title": "T", "message": "Ciao"},
            ],
        }
        r = requests.post(f"{API}/automations", json=payload)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]

        # list
        lst = requests.get(f"{API}/automations").json()
        assert any(a["id"] == aid for a in lst)

        # patch (toggle off/on)
        r = requests.patch(f"{API}/automations/{aid}", json={"enabled": False})
        assert r.status_code == 200 and r.json()["enabled"] is False
        requests.patch(f"{API}/automations/{aid}", json={"enabled": True})

        # manual run
        r = requests.post(f"{API}/automations/{aid}/run")
        assert r.status_code == 200
        done = r.json()["done"]
        assert done and any("aggiornato" in d for d in done)

        # log entry with kind=automation
        time.sleep(0.6)
        logs = requests.get(f"{API}/logs", params={"kind": "automation"}).json()["items"]
        assert any("TEST_v6_auto" in (l.get("message") or "") for l in logs)

        # delete
        r = requests.delete(f"{API}/automations/{aid}")
        assert r.status_code == 200

    def test_trigger_ring_runs_automation(self, light):
        # Find doorbell/intercom
        ents = requests.get(f"{API}/entities").json()
        bell = next((e for e in ents if e.get("type") in ("doorbell", "intercom")), None)
        if not bell:
            pytest.skip("no doorbell/intercom entity")
        payload = {
            "name": "TEST_v6_ring",
            "enabled": True,
            "triggers": [{"type": "ring", "entity_id": bell["id"]}],
            "actions": [{"type": "entity", "entity_id": light["id"], "state": {"on": True}}],
        }
        r = requests.post(f"{API}/automations", json=payload)
        aid = r.json()["id"]
        try:
            r = requests.post(f"{API}/intercom/{bell['id']}/ring")
            assert r.status_code == 200
            time.sleep(1.0)
            logs = requests.get(f"{API}/logs", params={"kind": "automation", "search": "TEST_v6_ring"}).json()["items"]
            assert logs, "ring did not trigger automation"
        finally:
            requests.delete(f"{API}/automations/{aid}")

    def test_pulse_action_toggles_off_after_seconds(self, light):
        # Set light off first
        requests.patch(f"{API}/entities/{light['id']}", json={"state": {"on": False}})
        payload = {
            "name": "TEST_v6_pulse",
            "enabled": True,
            "triggers": [],
            "actions": [{"type": "pulse", "entity_id": light["id"], "seconds": 0.6}],
        }
        r = requests.post(f"{API}/automations", json=payload)
        aid = r.json()["id"]
        try:
            requests.post(f"{API}/automations/{aid}/run")
            time.sleep(1.5)  # wait for pulse to complete
            e = next(x for x in requests.get(f"{API}/entities").json() if x["id"] == light["id"])
            assert (e.get("state") or {}).get("on") is False, "pulse should turn off after delay"
        finally:
            requests.delete(f"{API}/automations/{aid}")


# ---------- SOUNDS (object storage) ----------
class TestSounds:
    def test_upload_get_delete_sound(self):
        # small fake WAV bytes
        wav = b"RIFF$\x00\x00\x00WAVEfmt " + b"\x00" * 40
        files = {"file": ("TEST_v6.wav", wav, "audio/wav")}
        r = requests.post(f"{API}/sounds/upload", files=files)
        if r.status_code == 502:
            pytest.skip(f"object storage unavailable: {r.text[:100]}")
        assert r.status_code == 200, r.text
        sound = r.json()["sound"]
        sid = sound["id"]
        assert sound["url"] == f"/api/sounds/{sid}"

        # get audio content
        r = requests.get(f"{API}/sounds/{sid}")
        assert r.status_code == 200
        assert r.content == wav or len(r.content) > 0

        # settings contains it
        s = requests.get(f"{API}/settings").json()
        assert any(x["id"] == sid for x in (s.get("custom_sounds") or []))

        # delete
        r = requests.delete(f"{API}/sounds/{sid}")
        assert r.status_code == 200
        assert not any(x["id"] == sid for x in r.json().get("custom_sounds", []))

    def test_upload_rejects_invalid_extension(self):
        files = {"file": ("bad.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/sounds/upload", files=files)
        assert r.status_code == 400


# ---------- GRIDS ----------
class TestGrids:
    def test_grid_crud(self):
        # create
        r = requests.post(f"{API}/grids", json={"name": "TEST_v6_grid", "layout": "2x2", "slots": []})
        assert r.status_code == 200
        gid = r.json()["id"]

        # list
        assert any(g["id"] == gid for g in requests.get(f"{API}/grids").json())

        # patch
        r = requests.patch(f"{API}/grids/{gid}", json={"layout": "3x3", "slots": [{"camera_id": "abc"}]})
        assert r.status_code == 200 and r.json()["layout"] == "3x3"

        # delete
        r = requests.delete(f"{API}/grids/{gid}")
        assert r.status_code == 200

    def test_grid_not_found_404(self):
        r = requests.patch(f"{API}/grids/nope", json={"name": "x"})
        assert r.status_code == 404
        r = requests.delete(f"{API}/grids/nope")
        assert r.status_code == 404


# ---------- ALARM HA sync (popup trigger) ----------
class TestAlarmHASync:
    def test_ha_triggered_reflected_in_state(self):
        # Force fake HA to triggered
        requests.post(f"{HA}/_test/set/alarm_control_panel.allarme_casa", json={"state": "triggered"})
        time.sleep(1.5)
        st = requests.get(f"{API}/alarm/state").json()
        panel = st.get("panel") or {}
        assert panel.get("state") == "triggered" or st.get("ha_state") == "triggered", \
            f"panel not showing triggered: {panel}, ha_state={st.get('ha_state')}"
        # Disarm via API with PIN -> should call alarm_disarm on HA
        r = requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        assert r.status_code == 200
        time.sleep(1.0)
        calls = requests.get(f"{HA}/_test/calls").json()
        assert any(c["service"] == "alarm_disarm" for c in calls[-20:]), "HA alarm_disarm not called"
        # reset
        requests.post(f"{HA}/_test/set/alarm_control_panel.allarme_casa", json={"state": "disarmed"})


# ---------- LED EFFECTS support ----------
class TestLEDEffects:
    def test_effect_list_imported_and_service_called(self):
        # Add a light with effect_list to fake HA
        eid = "light.sonoff_tx_led"
        # inject state
        import json as _json
        # We can't add new entity via _test/set alone (STATES lookup only). Use fake HA internals via direct call:
        r = requests.post(f"{HA}/_test/set/{eid}",
                          json={"state": "on",
                                "attributes": {"friendly_name": "Sonoff TX LED",
                                               "supported_color_modes": ["rgb"],
                                               "effect_list": ["Rainbow", "Colorloop", "Party"],
                                               "effect": "Rainbow"}})
        if r.status_code != 200:
            pytest.skip("cannot inject led light into fake HA")
        # reimport HA entities
        requests.post(f"{API}/ha/import", timeout=15)
        time.sleep(1.5)
        ents = requests.get(f"{API}/entities?type=light").json()
        led = next((e for e in ents if (e.get("ha_entity_id") or "") == eid), None)
        if not led:
            pytest.skip("led light not imported (fake HA may not seed it in STATES dict)")
        effects = (led.get("controls") or {}).get("effects") or led.get("effect_list") or \
                  ((led.get("state") or {}).get("effect_list"))
        assert effects, f"effect_list not exposed on entity: {led}"
        # Try applying effect via PATCH (should call light.turn_on with effect)
        before = len(requests.get(f"{HA}/_test/calls").json())
        r = requests.patch(f"{API}/entities/{led['id']}", json={"state": {"effect": "Colorloop"}})
        assert r.status_code == 200
        time.sleep(0.5)
        calls = requests.get(f"{HA}/_test/calls").json()[before:]
        assert any(c["service"] == "turn_on" and c.get("data", {}).get("effect") == "Colorloop" for c in calls), \
            f"effect not sent to HA: {calls[-5:]}"


# ---------- INTERCOM POPUP toggle ----------
class TestIntercomPopupSetting:
    def test_toggle_intercom_popup(self):
        _wait_unlocked()
        r = requests.patch(f"{API}/settings", json={"intercom_popup": False})
        assert r.status_code == 200
        assert r.json().get("intercom_popup") is False
        r = requests.patch(f"{API}/settings", json={"intercom_popup": True})
        assert r.status_code == 200
        assert r.json().get("intercom_popup") is True

    def test_toggle_alarm_popup(self):
        _wait_unlocked()
        r = requests.patch(f"{API}/settings", json={"alarm_popup": False})
        assert r.status_code == 200
        assert r.json().get("alarm_popup") is False
        r = requests.patch(f"{API}/settings", json={"alarm_popup": True})
        assert r.status_code == 200
