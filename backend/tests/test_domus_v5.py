"""Iteration 5 backend tests: security audit follow-up (SEC-001..005).

Run serially: python -m pytest tests/test_domus_v5.py -q -p no:randomly -n 0
Requires fake HA on :8123.
"""
import io
import json
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


def _wait_unlocked():
    st = requests.get(f"{API}/pin/status").json()
    if st.get("locked"):
        time.sleep(st.get("lock_seconds", 60) + 2)


@pytest.fixture(scope="module", autouse=True)
def _module_setup():
    # Ensure HA up & configured
    try:
        requests.get(f"{HA}/api/config", headers={"Authorization": "Bearer demo-token"}, timeout=3)
    except Exception:
        pytest.skip("fake HA not reachable")
    requests.post(f"{API}/ha/config", json={"ha_url": HA, "ha_token": "demo-token", "ha_enabled": True}, timeout=10)
    requests.post(f"{API}/ha/check", timeout=10)
    _wait_unlocked()
    yield
    # Final restore
    _wait_unlocked()
    # Reset any protected settings that tests may have mutated so v3/v4 regressions pass
    requests.patch(f"{API}/settings", json={
        "pin_enabled": True,
        "pin_protect_disarm": True,
        "pin_protect_sensitive": True,
        "alarm_ha_code": "",
        "alarm_use_pin_as_code": True,
        "alarm_entity_id": "alarm_control_panel.allarme_casa",
        "alarm_modes": ["home", "away", "night"],
        "alarm_zone_ids": [],
        "alarm_armed": "disarmed",
        "pin": "1234",
    })
    requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})


# ---------- SEC-001: PATCH /api/settings PIN enforcement ----------
class TestSEC001SettingsPin:
    PROTECTED_FIELDS = {
        "pin_enabled": False,
        "pin_protect_disarm": True,
        "pin_protect_sensitive": True,
        "alarm_ha_code": "9999",
        "alarm_use_pin_as_code": True,
        "alarm_entity_id": "alarm_control_panel.allarme_casa",
        "alarm_modes": ["home", "away", "night"],
        "alarm_zone_ids": [],
        "alarm_armed": "disarmed",
    }

    NON_PROTECTED = {
        "home_name": "Casa Test",
        "theme_mode": "dark",
        "color_presets": [{"name": "test", "hex": "#123456"}],
        "backup_auto": "daily",
        "tts_entity": "",
        "ha_import_rooms": True,
        "energy_cost": {"import": 0.25},
        "climate_presets": {"eco": 19},
    }

    @pytest.mark.parametrize("field,value", list(PROTECTED_FIELDS.items()))
    def test_protected_field_without_pin_401(self, field, value):
        _wait_unlocked()
        r = requests.patch(f"{API}/settings", json={field: value})
        assert r.status_code == 401, f"{field}: expected 401 got {r.status_code}: {r.text[:150]}"

    @pytest.mark.parametrize("field,value", list(PROTECTED_FIELDS.items()))
    def test_protected_field_with_pin_200(self, field, value):
        _wait_unlocked()
        r = requests.patch(f"{API}/settings", json={field: value, "pin": "1234"})
        assert r.status_code == 200, f"{field}: {r.status_code} {r.text[:150]}"

    @pytest.mark.parametrize("field,value", list(NON_PROTECTED.items()))
    def test_nonprotected_field_without_pin_200(self, field, value):
        _wait_unlocked()
        r = requests.patch(f"{API}/settings", json={field: value})
        assert r.status_code == 200, f"{field}: {r.status_code} {r.text[:150]}"


# ---------- SEC-001b: disable/reenable pin_enabled ----------
class TestSEC001bPinToggleAffectsDisarm:
    def test_disable_pin_disarm_no_pin_then_reenable(self):
        _wait_unlocked()
        # disable pin (with pin) -> then disarm without pin should be OK
        r = requests.patch(f"{API}/settings", json={"pin_enabled": False, "pin": "1234"})
        assert r.status_code == 200
        # arm first
        requests.post(f"{API}/alarm/set/away", json={})
        r = requests.post(f"{API}/alarm/set/disarmed", json={})
        assert r.status_code == 200, f"disarm no-pin when disabled: {r.status_code} {r.text[:150]}"
        # re-enable pin
        r = requests.patch(f"{API}/settings", json={"pin_enabled": True, "pin": "1234"})
        assert r.status_code == 200
        # arm again and try disarm without pin -> 401
        requests.post(f"{API}/alarm/set/away", json={})
        r = requests.post(f"{API}/alarm/set/disarmed", json={})
        assert r.status_code == 401
        # cleanup
        requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})


# ---------- SEC-002: backup restore requires PIN, does not overwrite secrets ----------
class TestSEC002BackupRestorePin:
    @pytest.fixture(scope="class")
    def backup_name(self):
        _wait_unlocked()
        r = requests.post(f"{API}/backups", json={"label": "sec_test"})
        assert r.status_code == 200, r.text
        return r.json()["name"]

    def test_restore_without_pin_401(self, backup_name):
        _wait_unlocked()
        r = requests.post(f"{API}/backups/{backup_name}/restore", json={})
        assert r.status_code == 401

    def test_restore_with_pin_200_and_pin_preserved(self, backup_name):
        _wait_unlocked()
        r = requests.post(f"{API}/backups/{backup_name}/restore", json={"pin": "1234"})
        assert r.status_code == 200, r.text
        # PIN 1234 must still verify
        _wait_unlocked()
        r = requests.post(f"{API}/pin/verify", json={"pin": "1234"})
        assert r.status_code == 200, "PIN 1234 broken after restore"

    def test_import_without_restore_no_pin_required(self, backup_name):
        # download backup then re-upload without restore
        _wait_unlocked()
        r = requests.get(f"{API}/backups/{backup_name}/download")
        assert r.status_code == 200
        files = {"file": ("test.json", r.content, "application/json")}
        r = requests.post(f"{API}/backups/import", files=files)
        assert r.status_code == 200, r.text

    def test_import_with_restore_without_pin_401(self, backup_name):
        _wait_unlocked()
        r = requests.get(f"{API}/backups/{backup_name}/download")
        files = {"file": ("test.json", r.content, "application/json")}
        r = requests.post(f"{API}/backups/import?restore=true", files=files)
        assert r.status_code == 401

    def test_import_with_restore_with_pin_200(self, backup_name):
        _wait_unlocked()
        r = requests.get(f"{API}/backups/{backup_name}/download")
        files = {"file": ("test.json", r.content, "application/json")}
        r = requests.post(f"{API}/backups/import?restore=true&pin=1234", files=files)
        assert r.status_code == 200, r.text
        _wait_unlocked()
        assert requests.post(f"{API}/pin/verify", json={"pin": "1234"}).status_code == 200


# ---------- SEC-004: backups must NOT contain secret settings ----------
class TestSEC004BackupNoSecrets:
    FORBIDDEN = {"pin_hash", "alarm_ha_code", "ha_token", "pin_enabled", "alarm_armed"}

    def test_backup_download_excludes_secrets(self):
        _wait_unlocked()
        r = requests.post(f"{API}/backups", json={"label": "sec_leak"})
        assert r.status_code == 200
        name = r.json()["name"]
        r = requests.get(f"{API}/backups/{name}/download")
        assert r.status_code == 200
        data = json.loads(r.content.decode("utf-8"))
        settings = data.get("settings") or {}
        leaked = [k for k in self.FORBIDDEN if k in settings]
        assert not leaked, f"Backup leaked settings keys: {leaked}"


# ---------- SEC-003: sensitive scene activation & entity state ----------
class TestSEC003SensitiveActions:
    @pytest.fixture(scope="class")
    def scenes(self):
        _wait_unlocked()
        # Find a camera to protect
        ents = requests.get(f"{API}/entities?type=camera").json()
        assert ents, "no camera entity"
        cam = ents[0]
        # Find a light
        lights = requests.get(f"{API}/entities?type=light").json()
        assert lights, "no light entity"
        light = lights[0]
        # Create sensitive scene
        sensitive_payload = {"name": "SEC_test_sensitive", "actions": [
            {"entity_id": cam["id"], "state": {"privacy": True}}
        ]}
        r = requests.post(f"{API}/scenes", json=sensitive_payload)
        assert r.status_code == 200, r.text
        sensitive_id = r.json()["id"]
        # Create normal scene
        normal_payload = {"name": "SEC_test_normal", "actions": [
            {"entity_id": light["id"], "state": {"on": True, "brightness": 50}}
        ]}
        r = requests.post(f"{API}/scenes", json=normal_payload)
        assert r.status_code == 200
        normal_id = r.json()["id"]
        yield {"sensitive": sensitive_id, "normal": normal_id, "camera": cam, "light": light}
        # cleanup
        requests.delete(f"{API}/scenes/{sensitive_id}")
        requests.delete(f"{API}/scenes/{normal_id}")
        # reset privacy
        requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"privacy": False}, "pin": "1234"})

    def test_sensitive_scene_no_pin_401(self, scenes):
        _wait_unlocked()
        r = requests.post(f"{API}/scenes/{scenes['sensitive']}/activate", json={})
        assert r.status_code == 401

    def test_sensitive_scene_with_pin_200(self, scenes):
        _wait_unlocked()
        r = requests.post(f"{API}/scenes/{scenes['sensitive']}/activate", json={"pin": "1234"})
        assert r.status_code == 200

    def test_normal_scene_no_pin_200(self, scenes):
        _wait_unlocked()
        r = requests.post(f"{API}/scenes/{scenes['normal']}/activate", json={})
        assert r.status_code == 200

    def test_entity_sensitive_state_locked_requires_pin(self, scenes):
        """Even non-camera entities: setting 'locked' must require PIN."""
        _wait_unlocked()
        light = scenes["light"]
        r = requests.patch(f"{API}/entities/{light['id']}", json={"state": {"locked": False}})
        assert r.status_code == 401
        r = requests.patch(f"{API}/entities/{light['id']}", json={"state": {"locked": False}, "pin": "1234"})
        assert r.status_code == 200

    def test_entity_siren_requires_pin(self, scenes):
        _wait_unlocked()
        cam = scenes["camera"]
        r = requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"siren": True}})
        assert r.status_code == 401
        r = requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"siren": True}, "pin": "1234"})
        assert r.status_code == 200
        requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"siren": False}, "pin": "1234"})


# ---------- SEC-005: HA proxy allowlist + HLS regex + cast URL validation ----------
class TestSEC005HAProxyAndCast:
    def test_ha_proxy_disallowed_path_404(self):
        r = requests.get(f"{API}/ha/proxy", params={"path": "/api/config"})
        assert r.status_code == 404

    def test_ha_proxy_allowed_prefix_not_404(self):
        # Allowlisted path -> should not be 404 (may be 200/502 depending on fake HA)
        r = requests.get(f"{API}/ha/proxy", params={"path": "/api/camera_proxy/camera.tapo_ingresso"})
        assert r.status_code != 404, f"unexpected 404 for allowed path: {r.text[:120]}"

    def test_ha_proxy_dotdot_404(self):
        r = requests.get(f"{API}/ha/proxy", params={"path": "/api/camera_proxy/../secrets"})
        assert r.status_code == 404
        r = requests.get(f"{API}/ha/proxy", params={"path": "/api/camera_proxy/%2e%2e/x"})
        assert r.status_code == 404

    def test_ha_hls_invalid_chars_404(self):
        # Note: 'requests' normalizes path segments, so we test cases that survive normalization
        # (encoded dotdot escapes normalization when server percent-decodes path param)
        for bad in ("abc%2e%2e/x", "abc def", "abc$foo"):
            r = requests.get(f"{API}/ha/hls/{bad}")
            assert r.status_code == 404, f"HLS bad path {bad!r}: got {r.status_code}"

    def test_cast_file_url_400(self):
        meds = requests.get(f"{API}/entities?type=media_player").json()
        screen = next((m for m in meds if (m.get("ha_entity_id") or "").startswith("media_player.")), None)
        assert screen
        r = requests.post(f"{API}/cast/{screen['id']}",
                          json={"kind": "dashboard", "url": "file:///etc/passwd"})
        assert r.status_code == 400

    def test_cast_credentials_url_400(self):
        meds = requests.get(f"{API}/entities?type=media_player").json()
        screen = next((m for m in meds if (m.get("ha_entity_id") or "").startswith("media_player.")), None)
        assert screen
        r = requests.post(f"{API}/cast/{screen['id']}",
                          json={"kind": "dashboard", "url": "http://user:pass@evil.com/"})
        assert r.status_code == 400

    def test_cast_https_valid_200(self):
        meds = requests.get(f"{API}/entities?type=media_player").json()
        screen = next((m for m in meds if (m.get("ha_entity_id") or "").startswith("media_player.")), None)
        assert screen
        r = requests.post(f"{API}/cast/{screen['id']}",
                          json={"kind": "dashboard", "url": "https://domus.local/dashboard"})
        assert r.status_code == 200, r.text
        # cleanup: stop
        requests.post(f"{API}/cast/{screen['id']}/stop")
