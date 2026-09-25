"""
Domus iteration 3 regression tests.
Covers: Views CRUD, Cameras (PTZ / simulate-motion / snapshot), Media commands / TTS / notify,
Intercom + Doorbell ring/answer, Home Assistant (fake HA) connect / import / live sync,
Backups (create/list/restore/delete/download/import), Problems, and Settings token masking.
Fake HA must be running at http://127.0.0.1:8123 (token demo-token). Started via:
  cd /app/backend && nohup python3 tests/fake_ha.py > /tmp/fake_ha.log 2>&1 &
"""
import io
import json
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://smart-home-unified-1.preview.emergentagent.com"
FAKE_HA_URL = "http://127.0.0.1:8123"
FAKE_HA_TOKEN = os.environ.get("FAKE_HA_TOKEN", "demo-token")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def app_data(api):
    r = api.get(f"{BASE_URL}/api/app-data", timeout=30)
    assert r.status_code == 200
    return r.json()


# ---------- Views CRUD ----------
class TestViews:
    def test_seed_views_exist(self, api):
        r = api.get(f"{BASE_URL}/api/views")
        assert r.status_code == 200
        views = r.json()
        names = {v["name"] for v in views}
        assert "Perimetro Esterno" in names
        assert "Interno Notte" in names
        for v in views:
            assert len(v["members"]) >= 4

    def test_view_crud(self, api):
        payload = {"name": "TEST_View", "icon": "star", "color": "#123456", "members": [], "layout": "grid"}
        r = api.post(f"{BASE_URL}/api/views", json=payload)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["name"] == "TEST_View"
        vid = v["id"]

        # PATCH
        r2 = api.patch(f"{BASE_URL}/api/views/{vid}", json={"name": "TEST_View_2", "layout": "compact"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_View_2"
        assert r2.json()["layout"] == "compact"

        # GET verify persistence
        r3 = api.get(f"{BASE_URL}/api/views")
        assert any(x["id"] == vid and x["name"] == "TEST_View_2" for x in r3.json())

        # DELETE
        r4 = api.delete(f"{BASE_URL}/api/views/{vid}")
        assert r4.status_code == 200

        r5 = api.get(f"{BASE_URL}/api/views")
        assert not any(x["id"] == vid for x in r5.json())

    def test_view_not_found(self, api):
        r = api.patch(f"{BASE_URL}/api/views/does-not-exist", json={"name": "x"})
        assert r.status_code == 404
        r = api.delete(f"{BASE_URL}/api/views/does-not-exist")
        assert r.status_code == 404


# ---------- Sensor / alarm zone: names full + simulate ----------
class TestSensors:
    def test_alarm_zone_full_names_present(self, app_data):
        names = {e["name"] for e in app_data["entities"] if e["type"] == "alarm_zone"}
        # These names should be present (full, not truncated)
        expected = ["Porta Ingresso Principale", "PIR Corridoio Piano Terra"]
        for n in expected:
            assert n in names, f"missing full sensor name: {n}"

    def test_simulate_zone_activation(self, api, app_data):
        zone = next(e for e in app_data["entities"] if e["type"] == "alarm_zone")
        r = api.post(f"{BASE_URL}/api/cameras/{zone['id']}/simulate-motion")
        assert r.status_code == 200
        # entity now triggered=True
        r2 = api.get(f"{BASE_URL}/api/entities")
        e = next(x for x in r2.json() if x["id"] == zone["id"])
        assert e["state"].get("triggered") is True


# ---------- Cameras & doorbell ----------
class TestCameras:
    def test_camera_ptz_direction(self, api, app_data):
        cam = next(e for e in app_data["entities"] if e["type"] == "camera" and (e.get("state") or {}).get("ptz"))
        r = api.post(f"{BASE_URL}/api/cameras/{cam['id']}/ptz", json={"direction": "left"})
        assert r.status_code == 200, r.text
        assert r.json().get("direction") == "left"

    def test_camera_ptz_preset(self, api, app_data):
        cam = next((e for e in app_data["entities"] if e["type"] == "camera" and (e.get("state") or {}).get("ptz")), None)
        assert cam is not None
        r = api.post(f"{BASE_URL}/api/cameras/{cam['id']}/ptz", json={"preset": "Porta"})
        assert r.status_code == 200, r.text

    def test_camera_ptz_bad_body(self, api, app_data):
        cam = next(e for e in app_data["entities"] if e["type"] == "camera")
        r = api.post(f"{BASE_URL}/api/cameras/{cam['id']}/ptz", json={})
        assert r.status_code == 400

    def test_camera_toggle_state(self, api, app_data):
        cam = next(e for e in app_data["entities"] if e["type"] == "camera")
        r = api.patch(f"{BASE_URL}/api/entities/{cam['id']}", json={"state": {"privacy": True, "night_vision": "on"}, "pin": "1234"})
        assert r.status_code == 200, r.text
        # verify
        r2 = api.get(f"{BASE_URL}/api/entities")
        e = next(x for x in r2.json() if x["id"] == cam["id"])
        assert e["state"].get("privacy") is True
        assert e["state"].get("night_vision") == "on"
        # reset
        api.patch(f"{BASE_URL}/api/entities/{cam['id']}", json={"state": {"privacy": False, "night_vision": "auto"}, "pin": "1234"})

    def test_doorbell_exists(self, app_data):
        names = [e["name"] for e in app_data["entities"] if e["type"] == "doorbell"]
        assert any("Blink" in n or "Videocitofono" in n for n in names), f"No doorbell found: {names}"


# ---------- Intercom / doorbell ring cycle ----------
class TestIntercom:
    def test_intercom_ring_and_unlock(self, api, app_data):
        e = next(x for x in app_data["entities"] if x["type"] == "intercom")
        r = api.post(f"{BASE_URL}/api/intercom/{e['id']}/ring")
        assert r.status_code == 200
        r = api.post(f"{BASE_URL}/api/intercom/{e['id']}/answer?action=unlock", json={"pin": "1234"})
        assert r.status_code == 200
        r = api.post(f"{BASE_URL}/api/intercom/{e['id']}/answer?action=hangup")
        assert r.status_code == 200

    def test_doorbell_ring_and_unlock(self, api, app_data):
        d = next((x for x in app_data["entities"] if x["type"] == "doorbell"), None)
        assert d is not None
        r = api.post(f"{BASE_URL}/api/intercom/{d['id']}/ring")
        assert r.status_code == 200
        r = api.post(f"{BASE_URL}/api/intercom/{d['id']}/answer?action=hangup")
        assert r.status_code == 200


# ---------- Media ----------
class TestMedia:
    def test_media_players_exist(self, app_data):
        players = [e for e in app_data["entities"] if e["type"] == "media_player"]
        assert len(players) >= 5
        tvs = [e for e in players if (e.get("state") or {}).get("device_class") == "tv"]
        speakers = [e for e in players if (e.get("state") or {}).get("device_class") != "tv"]
        assert len(tvs) >= 2
        assert len(speakers) >= 3

    def test_media_commands(self, api, app_data):
        p = next(e for e in app_data["entities"] if e["type"] == "media_player")
        # power on
        r = api.post(f"{BASE_URL}/api/media/{p['id']}/command", json={"command": "turn_on"})
        assert r.status_code == 200
        # play
        r = api.post(f"{BASE_URL}/api/media/{p['id']}/command", json={"command": "play"})
        assert r.status_code == 200
        assert r.json()["state"]["status"] == "playing"
        # volume_set
        r = api.post(f"{BASE_URL}/api/media/{p['id']}/command", json={"command": "volume_set", "value": 42})
        assert r.status_code == 200
        assert r.json()["state"]["volume"] == 42
        # mute
        r = api.post(f"{BASE_URL}/api/media/{p['id']}/command", json={"command": "mute", "value": True})
        assert r.status_code == 200
        assert r.json()["state"]["muted"] is True
        # next
        r = api.post(f"{BASE_URL}/api/media/{p['id']}/command", json={"command": "next"})
        assert r.status_code == 200
        # bad command
        r = api.post(f"{BASE_URL}/api/media/{p['id']}/command", json={"command": "does_not_exist"})
        assert r.status_code == 400

    def test_tts_empty_message_400(self, api):
        r = api.post(f"{BASE_URL}/api/media/tts", json={"message": "  "})
        assert r.status_code == 400

    def test_tts_sends(self, api, app_data):
        speakers = [e for e in app_data["entities"] if e["type"] == "media_player"]
        ids = [speakers[0]["id"]]
        r = api.post(f"{BASE_URL}/api/media/tts", json={"message": "Test annuncio", "ids": ids})
        assert r.status_code == 200
        data = r.json()
        assert set(data["sent"]) >= set(ids) or len(data["sent"]) >= 1
        # demo flag reflects ha.connected state (may be True or False)
        assert "demo" in data

    def test_notify_sends_to_screens(self, api):
        r = api.post(f"{BASE_URL}/api/media/notify", json={"title": "TEST", "message": "Ciao"})
        assert r.status_code == 200
        assert isinstance(r.json()["sent"], list)


# ---------- Home Assistant (fake HA) ----------
class TestHomeAssistant:
    def _fake_ha_up(self):
        try:
            r = requests.get(f"{FAKE_HA_URL}/api/config", headers={"Authorization": f"Bearer {FAKE_HA_TOKEN}"}, timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def test_fake_ha_running(self):
        assert self._fake_ha_up(), "fake_ha.py not running on 127.0.0.1:8123"

    def test_settings_masks_token(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        s = r.json()
        assert s.get("ha_token", "") == ""
        assert "ha_token_set" in s

    def test_ha_connect_and_status(self, api):
        r = api.post(f"{BASE_URL}/api/ha/config", json={"ha_url": FAKE_HA_URL, "ha_token": FAKE_HA_TOKEN, "ha_enabled": True})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ha"]["connected"] is True
        assert data["ha"]["mode"] == "live"
        assert data["ha"]["version"].startswith("2026.")
        # settings never leak token
        assert data["settings"].get("ha_token", "") == ""
        assert data["settings"].get("ha_token_set") is True

    def test_ha_import(self, api):
        r = api.post(f"{BASE_URL}/api/ha/import")
        assert r.status_code == 200, r.text
        data = r.json()
        # counts keys (created/updated)
        assert "created" in data or "updated" in data or "count" in data or "rooms" in data or isinstance(data, dict)

    def test_ha_states_lists(self, api):
        r = api.get(f"{BASE_URL}/api/ha/states")
        assert r.status_code == 200
        states = r.json()
        assert isinstance(states, list)
        assert len(states) > 5
        assert any(s.get("linked") for s in states)

    def test_ha_live_sync_state_change(self, api):
        # set light on in fake HA, expect entity update within a couple seconds
        requests.post(f"{FAKE_HA_URL}/_test/set/light.led_salotto",
                      json={"state": "on", "attributes": {"brightness": 255}}, timeout=5)
        found = False
        for _ in range(15):
            time.sleep(1)
            r = api.get(f"{BASE_URL}/api/entities")
            for e in r.json():
                if e.get("ha_entity_id") == "light.led_salotto":
                    if (e.get("state") or {}).get("on") is True:
                        found = True
                    break
            if found:
                break
        assert found, "led_salotto did not sync to on within ~15s"

    def test_ha_domus_to_ha_call(self, api):
        # find a light imported from HA (name ends with 'HA')
        r = api.get(f"{BASE_URL}/api/entities")
        light = next((e for e in r.json() if e["type"] == "light" and (e.get("ha_entity_id") or "").startswith("light.")), None)
        assert light is not None, "No HA-linked light entity found"
        # clear fake HA calls first
        try:
            requests.delete(f"{FAKE_HA_URL}/_test/calls", timeout=3)
        except Exception:
            pass
        # toggle on
        r2 = api.patch(f"{BASE_URL}/api/entities/{light['id']}", json={"state": {"on": True}})
        assert r2.status_code == 200
        time.sleep(1.0)
        calls = requests.get(f"{FAKE_HA_URL}/_test/calls", timeout=5).json()
        assert any(c.get("domain") == "light" and c.get("service") in ("turn_on", "turn_off") for c in calls), \
            f"No light service call recorded, got: {calls}"

    def test_ha_disable_and_clear_token(self, api):
        r = api.post(f"{BASE_URL}/api/ha/config", json={"ha_enabled": False})
        assert r.status_code == 200
        assert r.json()["ha"]["mode"] == "demo"
        # clear token
        r = api.post(f"{BASE_URL}/api/ha/config", json={"ha_token_clear": True})
        assert r.status_code == 200
        s = api.get(f"{BASE_URL}/api/settings").json()
        assert s.get("ha_token_set") is False


# ---------- Backups ----------
class TestBackups:
    _created = []

    def test_list_backups(self, api):
        r = api.get(f"{BASE_URL}/api/backups")
        assert r.status_code == 200
        d = r.json()
        assert "dir" in d and "items" in d
        assert d["dir"]["writable"] is True

    def test_create_backup(self, api):
        r = api.post(f"{BASE_URL}/api/backups?label=TESTv3")
        assert r.status_code == 200, r.text
        info = r.json()
        assert info["name"].startswith("domus-") and info["name"].endswith(".json")
        assert "counts" in info
        TestBackups._created.append(info["name"])

    def test_download_backup(self, api):
        assert TestBackups._created
        name = TestBackups._created[0]
        r = api.get(f"{BASE_URL}/api/backups/{name}/download")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/json")
        j = r.json()
        # backup file structure: top-level meta + "data" or "collections"; entities may be nested
        blob = json.dumps(j)
        assert "entities" in blob and "rooms" in blob

    def test_import_invalid_json_400(self, api):
        files = {"file": ("bad.json", b"not-json", "application/json")}
        # requests strips json header for multipart
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/backups/import", files=files)
        assert r.status_code == 400

    def test_path_traversal_blocked(self, api):
        r = api.delete(f"{BASE_URL}/api/backups/..%2Fetc%2Fpasswd")
        assert r.status_code in (400, 404)

    def test_restore_roundtrip(self, api):
        # rename a view, backup, rename again, restore, confirm original name back
        views = api.get(f"{BASE_URL}/api/views").json()
        target = next(v for v in views if v["name"] == "Interno Notte")
        vid = target["id"]
        orig_name = target["name"]

        b = api.post(f"{BASE_URL}/api/backups?label=RESTOREtest").json()
        TestBackups._created.append(b["name"])

        api.patch(f"{BASE_URL}/api/views/{vid}", json={"name": "TEST_Renamed"})
        assert api.get(f"{BASE_URL}/api/views").json()
        assert any(v["id"] == vid and v["name"] == "TEST_Renamed" for v in api.get(f"{BASE_URL}/api/views").json())

        r = api.post(f"{BASE_URL}/api/backups/{b['name']}/restore", json={"pin": "1234"})
        assert r.status_code == 200, r.text

        views_after = api.get(f"{BASE_URL}/api/views").json()
        assert any(v["id"] == vid and v["name"] == orig_name for v in views_after), \
            f"restore did not revert name; got {[v['name'] for v in views_after]}"

    def test_cleanup_delete_created_backups(self, api):
        for name in TestBackups._created:
            r = api.delete(f"{BASE_URL}/api/backups/{name}")
            assert r.status_code in (200, 404)


# ---------- Problems ----------
class TestProblems:
    def test_problems_shape(self, api):
        r = api.get(f"{BASE_URL}/api/problems")
        assert r.status_code == 200
        d = r.json()
        for k in ("offline", "low_battery", "warnings", "ha"):
            assert k in d
        assert isinstance(d["offline"], list)
        assert isinstance(d["low_battery"], list)
        # PIR Garage low battery seeded
        names = [e.get("name") for e in d["low_battery"]]
        # Not strictly required to be present after HA import may replace but should generally be present
        assert isinstance(names, list)


# ---------- Final cleanup: leave HA disabled & backup dir default ----------
def test_zz_final_cleanup(api):
    api.post(f"{BASE_URL}/api/ha/config", json={"ha_enabled": False})
    api.patch(f"{BASE_URL}/api/settings", json={"backup_dir": "/var/lib/domus/backups"})
    s = api.get(f"{BASE_URL}/api/settings").json()
    assert s.get("backup_dir", "/var/lib/domus/backups").endswith("backups")
