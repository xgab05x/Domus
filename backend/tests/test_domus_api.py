"""Domus backend API tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to reading frontend .env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- Rooms ----------------
class TestRooms:
    def test_list_seeded_rooms(self, s):
        r = s.get(f"{API}/rooms")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        names = [d["name"] for d in data]
        assert "Salotto" in names

    def test_room_crud_and_orphan(self, s):
        # Create
        r = s.post(f"{API}/rooms", json={"name": "TEST_Room", "color": "#123456"})
        assert r.status_code == 200
        room = r.json()
        rid = room["id"]
        assert room["name"] == "TEST_Room"
        assert room["color"] == "#123456"

        # Patch name+color
        r = s.patch(f"{API}/rooms/{rid}", json={"name": "TEST_Room2", "color": "#abcdef"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Room2"
        assert r.json()["color"] == "#abcdef"

        # Create entity in room, then delete room, entity should orphan
        e = s.post(f"{API}/entities", json={"name": "TEST_light", "type": "light", "room_id": rid,
                                             "state": {"on": False, "brightness": 50}}).json()
        eid = e["id"]
        r = s.delete(f"{API}/rooms/{rid}")
        assert r.status_code == 200
        # verify entity now has room_id null
        got = s.get(f"{API}/entities", params={"room_id": "unassigned"}).json()
        assert any(x["id"] == eid for x in got)
        # cleanup
        s.delete(f"{API}/entities/{eid}")


# ---------------- Entities ----------------
class TestEntities:
    def test_filter_by_type_light(self, s):
        r = s.get(f"{API}/entities", params={"type": "light"})
        assert r.status_code == 200
        data = r.json()
        assert all(e["type"] == "light" for e in data)
        assert len(data) >= 5

    def test_filter_unassigned(self, s):
        r = s.get(f"{API}/entities", params={"room_id": "unassigned"})
        assert r.status_code == 200
        for e in r.json():
            assert e["room_id"] is None

    def test_patch_state_merges(self, s):
        # find a seeded light with rgb
        lights = s.get(f"{API}/entities", params={"type": "light"}).json()
        target = next((l for l in lights if "rgb" in (l.get("state") or {})), None)
        assert target, "Need a light with rgb in seed"
        eid = target["id"]
        original_rgb = target["state"]["rgb"]
        # update only brightness
        r = s.patch(f"{API}/entities/{eid}", json={"state": {"brightness": 42}})
        assert r.status_code == 200
        merged = r.json()["state"]
        assert merged["brightness"] == 42
        assert merged["rgb"] == original_rgb  # preserved

    def test_move_entity(self, s):
        rooms = s.get(f"{API}/rooms").json()
        r1, r2 = rooms[0]["id"], rooms[1]["id"]
        # get an entity in r1
        ents = s.get(f"{API}/entities", params={"room_id": r1}).json()
        assert ents
        eid = ents[0]["id"]
        # move to r2
        r = s.post(f"{API}/entities/{eid}/move/{r2}")
        assert r.status_code == 200
        assert r.json()["room_id"] == r2
        # move to unassigned
        r = s.post(f"{API}/entities/{eid}/move/unassigned")
        assert r.status_code == 200
        assert r.json()["room_id"] is None
        # move back to r1
        r = s.post(f"{API}/entities/{eid}/move/{r1}")
        assert r.status_code == 200
        assert r.json()["room_id"] == r1

    def test_delete_entity(self, s):
        e = s.post(f"{API}/entities", json={"name": "TEST_del", "type": "plug", "state": {"on": False}}).json()
        eid = e["id"]
        r = s.delete(f"{API}/entities/{eid}")
        assert r.status_code == 200
        # verify not found now
        r2 = s.patch(f"{API}/entities/{eid}", json={"name": "x"})
        assert r2.status_code == 404


# ---------------- Discovered ----------------
class TestDiscovered:
    def test_list_and_mock_and_assign(self, s):
        r = s.get(f"{API}/discovered")
        assert r.status_code == 200
        before = len(r.json())

        # add mock
        r = s.post(f"{API}/discovered/mock")
        assert r.status_code == 200
        new_id = r.json()["id"]
        after = s.get(f"{API}/discovered").json()
        assert len(after) == before + 1
        assert any(d["id"] == new_id for d in after)

        # assign to first room
        room_id = s.get(f"{API}/rooms").json()[0]["id"]
        r = s.post(f"{API}/discovered/{new_id}/assign/{room_id}")
        assert r.status_code == 200
        assigned_ent = r.json()
        assert assigned_ent["room_id"] == room_id
        assert assigned_ent["type"] == "light"
        # discovered removed
        after2 = s.get(f"{API}/discovered").json()
        assert not any(d["id"] == new_id for d in after2)
        # cleanup
        s.delete(f"{API}/entities/{assigned_ent['id']}")

    def test_assign_invalid_room(self, s):
        # add mock, try to assign to non-existent room
        new = s.post(f"{API}/discovered/mock").json()
        r = s.post(f"{API}/discovered/{new['id']}/assign/nonexistent-room-id")
        assert r.status_code == 404
        # cleanup - assign to unassigned
        r2 = s.post(f"{API}/discovered/{new['id']}/assign/unassigned")
        if r2.status_code == 200:
            s.delete(f"{API}/entities/{r2.json()['id']}")


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings(self, s):
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        for k in ["address", "latitude", "longitude", "dynamic_colors", "theme_mode", "home_name", "alarm_armed"]:
            assert k in d

    def test_patch_settings_persists(self, s):
        r = s.patch(f"{API}/settings", json={"home_name": "TEST_Home", "dynamic_colors": False, "theme_mode": "light"})
        assert r.status_code == 200
        assert r.json()["home_name"] == "TEST_Home"
        assert r.json()["dynamic_colors"] is False
        assert r.json()["theme_mode"] == "light"
        # persistence via GET
        got = s.get(f"{API}/settings").json()
        assert got["home_name"] == "TEST_Home"
        assert got["dynamic_colors"] is False
        # restore defaults
        s.patch(f"{API}/settings", json={"home_name": "Casa Domus", "dynamic_colors": True, "theme_mode": "auto"})


# ---------------- Intercom / Alarm ----------------
class TestIntercomAlarm:
    def test_intercom_ring_answer_unlock(self, s):
        intercoms = s.get(f"{API}/entities", params={"type": "intercom"}).json()
        assert intercoms
        iid = intercoms[0]["id"]
        r = s.post(f"{API}/intercom/{iid}/ring")
        assert r.status_code == 200
        # verify ringing=True
        got = s.get(f"{API}/entities", params={"type": "intercom"}).json()
        got_i = next(x for x in got if x["id"] == iid)
        assert got_i["state"]["ringing"] is True

        r = s.post(f"{API}/intercom/{iid}/answer", params={"action": "unlock"})
        assert r.status_code == 200
        got = s.get(f"{API}/entities", params={"type": "intercom"}).json()
        got_i = next(x for x in got if x["id"] == iid)
        assert got_i["state"]["ringing"] is False

        # event 'Porta aperta' logged
        events = s.get(f"{API}/events", params={"limit": 10}).json()
        assert any(e["message"] == "Porta aperta" for e in events)

    def test_alarm_invalid_and_valid(self, s):
        r = s.post(f"{API}/alarm/set/bogus")
        assert r.status_code == 400
        for mode in ["disarmed", "home", "away"]:
            r = s.post(f"{API}/alarm/set/{mode}")
            assert r.status_code == 200
            assert r.json()["mode"] == mode
        # settings reflects
        assert s.get(f"{API}/settings").json()["alarm_armed"] == "away"
        s.post(f"{API}/alarm/set/disarmed")
