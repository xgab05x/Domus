"""Backend tests for Domus iteration 2: sync/panel groups, scenes, climate, zones, weather.

Runs against public REACT_APP_BACKEND_URL. No auth. Restores mutable settings at end.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = BASE_URL + "/api"


@pytest.fixture(scope="module")
def app_data():
    r = requests.get(f"{API}/app-data", timeout=20)
    assert r.status_code == 200
    return r.json()


# ---------- Aggregate shape ----------
def test_app_data_shape(app_data):
    d = app_data
    assert len(d["rooms"]) == 7
    assert len(d["entities"]) == 36
    assert len(d["groups"]) == 3
    assert len(d["scenes"]) == 8
    assert len(d["thermostats"]) == 3
    assert len(d["zones"]) == 2
    s = d["settings"]
    assert s["seed_version"] == 2
    assert isinstance(s.get("color_presets"), list) and len(s["color_presets"]) >= 5
    assert set(s["climate_presets"].keys()) >= {"comfort", "eco", "night", "away"}
    assert s.get("weather_override") is not None
    assert d["weather"]["condition"] in {"clear", "clouds", "fog", "rain", "snow", "storm"}


# ---------- Weather override ----------
def test_weather_override_and_reset():
    r = requests.patch(f"{API}/settings", json={"weather_override": "rain"})
    assert r.status_code == 200
    w = requests.get(f"{API}/weather").json()
    assert w["condition"] == "rain" and w.get("overridden") is True
    # reset
    r = requests.patch(f"{API}/settings", json={"weather_override": "auto"})
    assert r.status_code == 200
    w = requests.get(f"{API}/weather").json()
    assert w["condition"] in {"clear", "clouds", "fog", "rain", "snow", "storm"}
    assert not w.get("overridden")


# ---------- Sync group Corridoio ----------
@pytest.fixture(scope="module")
def corridoio_ctx(app_data):
    groups = app_data["groups"]
    entities = {e["id"]: e for e in app_data["entities"]}
    corr = next(g for g in groups if g["name"] == "Corridoio" and g["kind"] == "sync")
    luce = next(e for e in app_data["entities"] if e["name"] == "Luce Corridoio")
    tasti = [e for e in app_data["entities"] if e["name"].startswith("Tasto Corridoio")]
    return {"group": corr, "luce": luce, "tasti": tasti, "entities": entities}


def test_sync_group_propagates_on(corridoio_ctx):
    luce_id = corridoio_ctx["luce"]["id"]
    members = corridoio_ctx["group"]["members"]
    r = requests.patch(f"{API}/entities/{luce_id}", json={"state": {"on": True}})
    assert r.status_code == 200
    data = r.json()
    affected_ids = {a["id"] for a in data["affected"]}
    assert set(members).issubset(affected_ids)
    for a in data["affected"]:
        if a["id"] in members:
            assert a["state"]["on"] is True


def test_sync_group_propagates_off_via_tasto(corridoio_ctx):
    tasto_id = corridoio_ctx["tasti"][0]["id"]
    members = corridoio_ctx["group"]["members"]
    r = requests.patch(f"{API}/entities/{tasto_id}", json={"state": {"on": False}})
    assert r.status_code == 200
    data = r.json()
    affected_ids = {a["id"] for a in data["affected"]}
    assert set(members).issubset(affected_ids)
    # verify persisted
    ents = requests.get(f"{API}/entities").json()
    for e in ents:
        if e["id"] in members:
            assert e["state"]["on"] is False


def test_group_toggle_endpoint(corridoio_ctx):
    gid = corridoio_ctx["group"]["id"]
    r = requests.post(f"{API}/groups/{gid}/toggle")
    assert r.status_code == 200
    data = r.json()
    assert "on" in data
    on_val = data["on"]
    affected_ids = {a["id"] for a in data["affected"]}
    assert set(corridoio_ctx["group"]["members"]).issubset(affected_ids)
    # all members should have that on state
    ents = {e["id"]: e for e in requests.get(f"{API}/entities").json()}
    for mid in corridoio_ctx["group"]["members"]:
        assert ents[mid]["state"]["on"] == on_val


# ---------- Panel groups & CRUD ----------
def test_panel_groups_exist(app_data):
    panels = [g for g in app_data["groups"] if g["kind"] == "panel"]
    assert len(panels) >= 2
    names = {g["name"] for g in panels}
    assert "Placca Soggiorno Porta" in names
    assert "Placca Cucina" in names


def test_group_crud_sync():
    # get 2 lights
    ents = requests.get(f"{API}/entities?type=light").json()
    two = [e["id"] for e in ents[:2]]
    payload = {"name": "TEST_SyncGroup", "kind": "sync", "members": two, "display": "both"}
    r = requests.post(f"{API}/groups", json=payload)
    assert r.status_code == 200
    g = r.json()
    gid = g["id"]
    assert g["display"] == "both"
    # patch
    r = requests.patch(f"{API}/groups/{gid}", json={"display": "members_only"})
    assert r.status_code == 200 and r.json()["display"] == "members_only"
    # delete
    r = requests.delete(f"{API}/groups/{gid}")
    assert r.status_code == 200


# ---------- Scenes ----------
def test_scene_cinema_activate(app_data):
    scene = next(s for s in app_data["scenes"] if s["name"] == "Cinema")
    ent_by_name = {e["name"]: e for e in app_data["entities"]}
    r = requests.post(f"{API}/scenes/{scene['id']}/activate")
    assert r.status_code == 200
    affected = {a["id"]: a for a in r.json()["affected"]}
    plaf = ent_by_name["Plafoniera Salotto"]
    led = ent_by_name["Striscia LED TV"]
    assert affected[plaf["id"]]["state"]["on"] is False
    assert affected[led["id"]]["state"]["on"] is True
    assert affected[led["id"]]["state"]["brightness"] == 30
    assert affected[led["id"]]["state"]["rgb"] == [80, 120, 255]


def test_scene_crud():
    ents = requests.get(f"{API}/entities?type=light").json()
    eid = ents[0]["id"]
    payload = {"name": "TEST_Scene", "actions": [{"entity_id": eid, "state": {"on": True, "brightness": 55}}]}
    r = requests.post(f"{API}/scenes", json=payload)
    assert r.status_code == 200
    sid = r.json()["id"]
    r = requests.patch(f"{API}/scenes/{sid}", json={"name": "TEST_Scene2"})
    assert r.status_code == 200 and r.json()["name"] == "TEST_Scene2"
    r = requests.delete(f"{API}/scenes/{sid}")
    assert r.status_code == 200


# ---------- Climate ----------
def _get_thermos():
    return requests.get(f"{API}/thermostats").json()


def test_thermostat_target_and_preset():
    thermos = _get_thermos()
    sogg = next(t for t in thermos if t["name"] == "Soggiorno")
    tid = sogg["id"]
    # set target 24 (manual)
    r = requests.patch(f"{API}/thermostats/{tid}", json={"target_temp": 24})
    assert r.status_code == 200
    snap = r.json()
    assert "thermostats" in snap and "entities" in snap and "zones" in snap
    updated = next(t for t in snap["thermostats"] if t["id"] == tid)
    assert updated["preset"] == "manual"
    assert updated["effective_target"] == 24
    # demand should be true (sensor ~20-21)
    assert updated["demand"] is True

    # actuators state
    ents = {e["id"]: e for e in snap["entities"]}
    for aid in sogg["actuators"]:
        a = ents[aid]
        assert a["state"].get("on") is True, f"Actuator {a['name']} should be on"
        if a["type"] == "thermostat":
            assert a["state"].get("target_temp") == 24

    # now eco preset
    r = requests.patch(f"{API}/thermostats/{tid}", json={"preset": "eco"})
    assert r.status_code == 200
    snap = r.json()
    updated = next(t for t in snap["thermostats"] if t["id"] == tid)
    assert updated["effective_target"] == 18.5


def test_shared_actuator_caldaia_on_if_any_demand():
    # Ensure Soggiorno on and manual high target so demand True
    thermos = _get_thermos()
    sogg = next(t for t in thermos if t["name"] == "Soggiorno")
    requests.patch(f"{API}/thermostats/{sogg['id']}", json={"on": True, "target_temp": 24})
    ents = {e["name"]: e for e in requests.get(f"{API}/entities").json()}
    assert ents["Caldaia"]["state"].get("on") is True


def test_zone_set_and_set_all():
    zones = requests.get(f"{API}/zones").json()
    giorno = next(z for z in zones if z["name"] == "Zona Giorno")
    # set on=False
    r = requests.post(f"{API}/zones/{giorno['id']}/set", json={"on": False})
    assert r.status_code == 200
    snap = r.json()
    ttmap = {t["id"]: t for t in snap["thermostats"]}
    for tid in giorno["thermostat_ids"]:
        assert ttmap[tid]["on"] is False

    # set-all on=True
    r = requests.post(f"{API}/zones/set-all", json={"on": True})
    assert r.status_code == 200
    for t in r.json()["thermostats"]:
        assert t["on"] is True

    # zone preset
    r = requests.post(f"{API}/zones/{giorno['id']}/set", json={"preset": "comfort"})
    assert r.status_code == 200
    ttmap = {t["id"]: t for t in r.json()["thermostats"]}
    for tid in giorno["thermostat_ids"]:
        assert ttmap[tid]["preset"] == "comfort"


def test_zone_crud_and_thermostat_crud():
    # create thermostat
    ents = requests.get(f"{API}/entities").json()
    sensor = next(e for e in ents if e["type"] == "sensor")
    payload = {"name": "TEST_Therm", "sensor_entity_id": sensor["id"], "actuators": [], "target_temp": 22.0}
    r = requests.post(f"{API}/thermostats", json=payload)
    assert r.status_code == 200
    tid = next(t["id"] for t in r.json()["thermostats"] if t["name"] == "TEST_Therm")
    # patch
    r = requests.patch(f"{API}/thermostats/{tid}", json={"name": "TEST_Therm2"})
    assert r.status_code == 200
    assert any(t["name"] == "TEST_Therm2" for t in r.json()["thermostats"])
    # zone create referencing
    r = requests.post(f"{API}/zones", json={"name": "TEST_Zone", "thermostat_ids": [tid]})
    assert r.status_code == 200
    zid = r.json()["id"]
    r = requests.patch(f"{API}/zones/{zid}", json={"name": "TEST_Zone2"})
    assert r.status_code == 200 and r.json()["name"] == "TEST_Zone2"
    r = requests.delete(f"{API}/zones/{zid}")
    assert r.status_code == 200
    r = requests.delete(f"{API}/thermostats/{tid}")
    assert r.status_code == 200


# ---------- Settings persistence ----------
def test_settings_presets_persist():
    r = requests.patch(f"{API}/settings", json={"climate_presets": {"comfort": 22, "eco": 18, "night": 17, "away": 15}})
    assert r.status_code == 200
    assert r.json()["climate_presets"]["comfort"] == 22
    # color presets
    new_presets = [{"name": "TEST", "rgb": [10, 20, 30]}]
    r = requests.patch(f"{API}/settings", json={"color_presets": new_presets})
    assert r.status_code == 200
    assert r.json()["color_presets"][0]["name"] == "TEST"
    # restore
    from_default = [
        {"name": "Caldo", "rgb": [255, 196, 120]},
        {"name": "Neutro", "rgb": [255, 236, 214]},
        {"name": "Freddo", "rgb": [205, 226, 255]},
        {"name": "Tramonto", "rgb": [255, 140, 90]},
        {"name": "Oceano", "rgb": [90, 170, 220]},
        {"name": "Lavanda", "rgb": [170, 140, 230]},
        {"name": "Foresta", "rgb": [110, 190, 140]},
    ]
    requests.patch(f"{API}/settings", json={"color_presets": from_default,
                                            "climate_presets": {"comfort": 21.0, "eco": 18.5, "night": 17.0, "away": 15.0}})


# ---------- CRUD regression basics ----------
def test_room_crud_orphaning():
    r = requests.post(f"{API}/rooms", json={"name": "TEST_Room"})
    rid = r.json()["id"]
    e = requests.post(f"{API}/entities", json={"name": "TEST_Ent", "type": "light", "room_id": rid}).json()
    requests.delete(f"{API}/rooms/{rid}")
    got = requests.get(f"{API}/entities").json()
    ent = next(x for x in got if x["id"] == e["id"])
    assert ent["room_id"] is None
    requests.delete(f"{API}/entities/{e['id']}")


def test_discovered_mock_and_assign():
    r = requests.post(f"{API}/discovered/mock")
    assert r.status_code == 200
    did = r.json()["id"]
    r = requests.post(f"{API}/discovered/{did}/assign/unassigned")
    assert r.status_code == 200
    eid = r.json()["id"]
    requests.delete(f"{API}/entities/{eid}")


def test_alarm_and_intercom():
    for mode in ("home", "away", "disarmed"):
        r = requests.post(f"{API}/alarm/set/{mode}")
        assert r.status_code == 200
    assert requests.post(f"{API}/alarm/set/bogus").status_code == 400
    intercom = next(e for e in requests.get(f"{API}/entities").json() if e["type"] == "intercom")
    assert requests.post(f"{API}/intercom/{intercom['id']}/ring").status_code == 200
    assert requests.post(f"{API}/intercom/{intercom['id']}/answer?action=unlock").status_code == 200
