"""Iteration 4 backend tests: PIN + HA alarm panel + camera stream-url/HLS + Cast.

Run serially (shared PIN/alarm state): python -m pytest tests/test_domus_v4.py -q -p no:randomly -n 0
Requires the fake HA: cd /app/backend && nohup python tests/fake_ha.py &
"""
import os
import time

import pytest
import requests

def _read_env(key):
    for p in ("/app/frontend/.env",):
        try:
            with open(p) as f:
                for line in f:
                    if line.startswith(key + "="):
                        return line.split("=", 1)[1].strip()
        except FileNotFoundError:
            pass
    return None

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL missing"
HA = "http://127.0.0.1:8123"
API = f"{BASE}/api"


def _wait_for(fn, timeout=5, interval=0.25):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if fn():
                return True
        except Exception:
            pass
        time.sleep(interval)
    return False


# ---- fixtures ----
@pytest.fixture(scope="module", autouse=True)
def ensure_ha_connected():
    """Verify fake HA is up and Domus is configured & connected to it."""
    r = requests.get(f"{HA}/api/config", headers={"Authorization": "Bearer demo-token"}, timeout=5)
    assert r.status_code == 200, "Fake HA is not running on :8123"
    # Ensure Domus has HA configured (idempotent)
    requests.post(f"{API}/ha/config", json={"ha_url": HA, "ha_token": "demo-token", "ha_enabled": True}, timeout=10)
    r = requests.post(f"{API}/ha/check", timeout=10)
    assert r.status_code == 200
    # Should already be imported from previous iterations; import once to be safe
    requests.post(f"{API}/ha/import", timeout=30)
    assert _wait_for(lambda: requests.get(f"{API}/ha/status").json().get("connected") is True, timeout=15), "HA not connected"
    yield


@pytest.fixture(autouse=True)
def clear_ha_calls():
    requests.delete(f"{HA}/_test/calls", timeout=2)  # optional if implemented
    yield


def _get_settings():
    return requests.get(f"{API}/settings").json()


def _ha_calls():
    return requests.get(f"{HA}/_test/calls", timeout=5).json()


def _reset_disarmed():
    # Force alarm back to disarmed on HA and reset PIN to 1234
    requests.post(f"{HA}/_test/set/alarm_control_panel.allarme_casa", json={"state": "disarmed"}, timeout=5)


# ---- PIN status / no leaks ----
class TestPinStatusAndLeaks:
    def test_pin_status_shape_and_no_hash(self):
        r = requests.get(f"{API}/pin/status")
        assert r.status_code == 200
        d = r.json()
        for k in ("enabled", "pin_set", "protect_disarm", "protect_sensitive", "locked", "lock_seconds", "attempts_left", "max_attempts"):
            assert k in d
        assert "pin_hash" not in d
        assert d["pin_set"] is True

    def test_settings_and_app_data_do_not_expose_hash(self):
        s = requests.get(f"{API}/settings").json()
        assert s.get("pin_hash") in ("", None)
        assert s.get("alarm_ha_code") in ("", None)
        assert "pin_set" in s
        ad = requests.get(f"{API}/app-data").json()
        settings = ad.get("settings", {})
        assert settings.get("pin_hash") in ("", None)
        assert settings.get("alarm_ha_code") in ("", None)


# ---- PIN verify + lockout ----
class TestPinVerify:
    def test_correct_pin_verifies(self):
        r = requests.post(f"{API}/pin/verify", json={"pin": "1234"})
        assert r.status_code == 200
        assert r.json().get("verified") is True

    def test_wrong_pin_401(self):
        r = requests.post(f"{API}/pin/verify", json={"pin": "0000"})
        assert r.status_code == 401

    def test_lockout_after_5_failures(self):
        # Make sure we start from a clean, unlocked counter
        st = requests.get(f"{API}/pin/status").json()
        if st.get("locked"):
            time.sleep(st.get("lock_seconds", 60) + 2)
        assert requests.post(f"{API}/pin/verify", json={"pin": "1234"}).status_code == 200
        # Attempt 5 wrong pins
        codes = []
        for _ in range(5):
            r = requests.post(f"{API}/pin/verify", json={"pin": "9999"})
            codes.append(r.status_code)
        # The 5th attempt should trigger lock => 429 (per pin.check())
        # After that, next attempt should be 429
        r = requests.post(f"{API}/pin/verify", json={"pin": "1234"})
        assert r.status_code == 429, f"Expected lockout 429, got {r.status_code} (previous: {codes})"
        # Reset with correct pin: need to wait ~60s OR clear via PIN change flow (which also uses check)
        # Since lockout is 60s, we sleep briefly then verify status locked; skip full wait to keep tests fast.
        st = requests.get(f"{API}/pin/status").json()
        assert st["locked"] is True
        assert st["lock_seconds"] > 0


# ---- Alarm disarm with PIN ----
class TestAlarmDisarm:
    @pytest.fixture(autouse=True)
    def unlock(self):
        # If locked from previous test, wait it out (max 65s) — do this only once when needed
        st = requests.get(f"{API}/pin/status").json()
        if st.get("locked"):
            time.sleep(st.get("lock_seconds", 60) + 2)
        _reset_disarmed()
        # Arm away first so we can test disarm
        r = requests.post(f"{API}/alarm/set/away", json={})
        assert r.status_code == 200, r.text
        yield
        # Cleanup: disarm with correct pin
        requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        _reset_disarmed()

    def test_disarm_without_pin_401(self):
        r = requests.post(f"{API}/alarm/set/disarmed", json={})
        assert r.status_code == 401

    def test_disarm_wrong_pin_401(self):
        r = requests.post(f"{API}/alarm/set/disarmed", json={"pin": "0000"})
        assert r.status_code == 401

    def test_disarm_correct_pin_ok(self):
        r = requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        assert r.status_code == 200, r.text
        assert r.json()["mode"] == "disarmed"

    def test_arm_does_not_require_pin(self):
        # disarm first, then arm modes without pin
        requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        for mode in ("home", "away", "night"):
            r = requests.post(f"{API}/alarm/set/{mode}", json={})
            assert r.status_code == 200, f"{mode}: {r.text}"


# ---- HA alarm panel wiring ----
class TestAlarmPanelHA:
    def test_panels_list(self):
        r = requests.get(f"{API}/alarm/panels")
        assert r.status_code == 200
        panels = r.json()
        assert any(p["entity_id"] == "alarm_control_panel.allarme_casa" for p in panels)

    def test_arm_calls_ha_service_and_disarm_passes_code(self):
        _reset_disarmed()
        # Arm away
        r = requests.post(f"{API}/alarm/set/away", json={})
        assert r.status_code == 200
        calls = _ha_calls()
        # Confirm at least one alarm_arm_away call to the panel
        assert any(c["domain"] == "alarm_control_panel" and c["service"] == "alarm_arm_away"
                   and c["data"].get("entity_id") == "alarm_control_panel.allarme_casa" for c in calls)
        # Disarm with pin: expect code passed
        r = requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        assert r.status_code == 200
        calls = _ha_calls()
        disarm_calls = [c for c in calls if c["service"] == "alarm_disarm"]
        assert disarm_calls, "no alarm_disarm HA call recorded"
        assert disarm_calls[-1]["data"].get("code") == "1234"

    def test_ha_state_change_syncs_to_domus(self):
        _reset_disarmed()
        st = requests.get(f"{API}/pin/status").json()
        if st.get("locked"):
            time.sleep(st.get("lock_seconds", 60) + 2)
        requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        # Change HA state externally
        requests.post(f"{HA}/_test/set/alarm_control_panel.allarme_casa", json={"state": "armed_night"})
        # Wait for Domus settings.alarm_armed to sync via the HA websocket subscription
        assert _wait_for(lambda: _get_settings().get("alarm_armed") == "night", timeout=25), \
            f"alarm_armed did not sync to 'night' (got {_get_settings().get('alarm_armed')})"


# ---- Camera stream-url and HLS proxy ----
class TestCameraStream:
    def test_stream_url_hls_for_ha_camera(self):
        # Find HA-linked camera
        ents = requests.get(f"{API}/entities?type=camera").json()
        ha_cam = next((e for e in ents if (e.get("ha_entity_id") or "").startswith("camera.")), None)
        assert ha_cam, "no HA-linked camera imported"
        r = requests.post(f"{API}/cameras/{ha_cam['id']}/stream-url", json={})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["available"] is True
        assert j["format"] == "hls"
        assert j["url"].startswith("/api/ha/hls/")

    def test_stream_url_demo_camera(self):
        ents = requests.get(f"{API}/entities?type=camera").json()
        demo = next((e for e in ents if not (e.get("ha_entity_id") or "").startswith("camera.")), None)
        if not demo:
            pytest.skip("no demo camera")
        r = requests.post(f"{API}/cameras/{demo['id']}/stream-url", json={})
        assert r.status_code == 200
        j = r.json()
        assert j["available"] is False
        assert j["reason"] == "demo"

    def test_hls_playlist_proxy(self):
        r = requests.get(f"{API}/ha/hls/faketoken/master_playlist.m3u8")
        assert r.status_code == 200
        assert "application/vnd.apple.mpegurl" in r.headers.get("content-type", "")
        assert "#EXTM3U" in r.text


# ---- Cast ----
class TestCast:
    def _find_screen(self):
        meds = requests.get(f"{API}/entities?type=media_player").json()
        # Prefer a TV/screen with an HA entity id
        return next((m for m in meds if (m.get("ha_entity_id") or "").startswith("media_player.")), None)

    def _find_camera(self):
        ents = requests.get(f"{API}/entities?type=camera").json()
        return next((e for e in ents if (e.get("ha_entity_id") or "").startswith("camera.")), None)

    def test_cast_camera_calls_play_stream(self):
        screen = self._find_screen()
        cam = self._find_camera()
        assert screen and cam
        r = requests.post(f"{API}/cast/{screen['id']}", json={"kind": "camera", "camera_id": cam["id"]})
        assert r.status_code == 200, r.text
        ent = r.json()["entity"]
        assert ent["state"].get("cast", {}).get("kind") == "camera"
        calls = _ha_calls()
        assert any(c["domain"] == "camera" and c["service"] == "play_stream"
                   and c["data"].get("entity_id") == cam["ha_entity_id"]
                   and c["data"].get("media_player") == screen["ha_entity_id"] for c in calls), \
            f"camera.play_stream not seen. Calls: {calls[-5:]}"

    def test_cast_dashboard_calls_play_media_url(self):
        screen = self._find_screen()
        assert screen
        r = requests.post(f"{API}/cast/{screen['id']}", json={"kind": "dashboard", "url": "https://domus.local/dashboard"})
        assert r.status_code == 200, r.text
        calls = _ha_calls()
        assert any(c["domain"] == "media_player" and c["service"] == "play_media"
                   and c["data"].get("media_content_type") == "url"
                   and c["data"].get("media_content_id") == "https://domus.local/dashboard" for c in calls)

    def test_cast_stop_clears_state(self):
        screen = self._find_screen()
        assert screen
        # Ensure something is casting
        requests.post(f"{API}/cast/{screen['id']}", json={"kind": "dashboard", "url": "https://x"})
        r = requests.post(f"{API}/cast/{screen['id']}/stop")
        assert r.status_code == 200
        ent = r.json()["entity"]
        assert ent["state"].get("cast") in (None, {})
        calls = _ha_calls()
        assert any(c["service"] == "media_stop" for c in calls)


# ---- Sensitive actions PIN enforcement ----
class TestSensitivePinEnforcement:
    def test_privacy_requires_pin(self):
        ents = requests.get(f"{API}/entities?type=camera").json()
        cam = ents[0] if ents else None
        assert cam
        # No pin -> 401
        r = requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"privacy": True}})
        assert r.status_code == 401, f"expected 401 without pin, got {r.status_code}"
        # With pin -> 200
        r = requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"privacy": True}, "pin": "1234"})
        assert r.status_code == 200, r.text
        # Reset privacy off
        requests.patch(f"{API}/entities/{cam['id']}", json={"state": {"privacy": False}, "pin": "1234"})


# ---- PIN change ----
class TestPinChange:
    def test_change_wrong_current_401(self):
        r = requests.post(f"{API}/pin/change", json={"current_pin": "0000", "new_pin": "4321"})
        assert r.status_code == 401

    def test_change_and_revert(self):
        # Wait if locked
        st = requests.get(f"{API}/pin/status").json()
        if st.get("locked"):
            time.sleep(st.get("lock_seconds", 60) + 2)
        r = requests.post(f"{API}/pin/change", json={"current_pin": "1234", "new_pin": "4321"})
        assert r.status_code == 200, r.text
        # Old pin should now fail
        r = requests.post(f"{API}/pin/verify", json={"pin": "1234"})
        assert r.status_code == 401
        # New pin works
        r = requests.post(f"{API}/pin/verify", json={"pin": "4321"})
        assert r.status_code == 200
        # Revert
        r = requests.post(f"{API}/pin/change", json={"current_pin": "4321", "new_pin": "1234"})
        assert r.status_code == 200
        r = requests.post(f"{API}/pin/verify", json={"pin": "1234"})
        assert r.status_code == 200


# ---- Final cleanup ----
def test_final_cleanup_disarm_and_restore():
    st = requests.get(f"{API}/pin/status").json()
    if st.get("locked"):
        time.sleep(st.get("lock_seconds", 60) + 2)
    requests.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
    _reset_disarmed()
    s = _get_settings()
    assert s.get("alarm_armed") in ("disarmed", None)
