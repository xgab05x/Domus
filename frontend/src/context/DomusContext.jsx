import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { AppAPI, RoomsAPI, EntitiesAPI, DiscoveredAPI, SettingsAPI, EventsAPI, GroupsAPI, ScenesAPI, ClimateAPI } from "@/lib/api";
import { computePhase } from "@/lib/solar";

const DomusCtx = createContext(null);

export const useDomus = () => {
  const ctx = useContext(DomusCtx);
  if (!ctx) throw new Error("useDomus must be used inside DomusProvider");
  return ctx;
};

export function DomusProvider({ children }) {
  const [rooms, setRooms] = useState([]);
  const [entities, setEntities] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [thermostats, setThermostats] = useState([]);
  const [zones, setZones] = useState([]);
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const d = await AppAPI.data();
    setRooms(d.rooms); setEntities(d.entities); setDiscovered(d.discovered); setSettings(d.settings);
    setEvents(d.events); setGroups(d.groups); setScenes(d.scenes); setThermostats(d.thermostats);
    setZones(d.zones); setWeather(d.weather);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const phase = useMemo(() => {
    if (!settings) return { phase: "day", progress: 0.5, sunriseHour: 6.5, sunsetHour: 19.5 };
    return computePhase(now, settings.latitude, settings.longitude);
  }, [now, settings]);

  const effectiveTheme = useMemo(() => {
    if (!settings) return "light";
    if (settings.theme_mode === "light") return "light";
    if (settings.theme_mode === "dark") return "dark";
    return phase.phase === "night" ? "dark" : "light";
  }, [settings, phase]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  }, [effectiveTheme]);

  const mergeEntities = useCallback((affected = []) => {
    if (!affected.length) return;
    const map = new Map(affected.map((a) => [a.id, a]));
    setEntities((prev) => prev.map((e) => map.get(e.id) || e));
  }, []);

  const applyClimate = useCallback((snap) => {
    if (!snap) return;
    if (snap.thermostats) setThermostats(snap.thermostats);
    if (snap.entities) setEntities(snap.entities);
    if (snap.zones) setZones(snap.zones);
  }, []);

  // ---- Entities
  const updateEntity = async (id, patch) => {
    setEntities((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch, state: { ...(x.state || {}), ...(patch.state || {}) } } : x)));
    try { const res = await EntitiesAPI.update(id, patch); mergeEntities(res.affected); }
    catch (err) { await refresh(); throw err; }
  };
  const moveEntity = async (id, roomId) => {
    setEntities((prev) => prev.map((x) => (x.id === id ? { ...x, room_id: roomId || null } : x)));
    try { await EntitiesAPI.move(id, roomId); } catch (err) { await refresh(); throw err; }
  };
  const deleteEntity = async (id) => {
    setEntities((prev) => prev.filter((x) => x.id !== id));
    try { await EntitiesAPI.remove(id); await refresh(); } catch (err) { await refresh(); throw err; }
  };

  // ---- Rooms
  const createRoom = async (data) => { const r = await RoomsAPI.create(data); setRooms((p) => [...p, r]); return r; };
  const updateRoom = async (id, data) => { const r = await RoomsAPI.update(id, data); setRooms((p) => p.map((x) => (x.id === id ? r : x))); return r; };
  const deleteRoom = async (id) => { await RoomsAPI.remove(id); await refresh(); };

  // ---- Discovered
  const assignDiscovered = async (discId, roomId) => {
    const created = await DiscoveredAPI.assign(discId, roomId);
    setEntities((p) => [...p, created]);
    setDiscovered((p) => p.filter((x) => x.id !== discId));
    return created;
  };
  const mockDiscovery = async () => { const d = await DiscoveredAPI.mock(); setDiscovered((p) => [...p, d]); return d; };

  // ---- Settings / events
  const updateSettings = async (data) => { const s = await SettingsAPI.update(data); setSettings(s); return s; };
  const reloadEvents = async () => { setEvents(await EventsAPI.list(30)); };

  // ---- Groups
  const createGroup = async (data) => { const g = await GroupsAPI.create(data); setGroups((p) => [...p, g]); return g; };
  const updateGroup = async (id, data) => { const g = await GroupsAPI.update(id, data); setGroups((p) => p.map((x) => (x.id === id ? g : x))); return g; };
  const deleteGroup = async (id) => { await GroupsAPI.remove(id); setGroups((p) => p.filter((x) => x.id !== id)); };
  const toggleGroup = async (id, on) => {
    const g = groups.find((x) => x.id === id);
    if (g) {
      const target = on === undefined ? !(entities.find((e) => e.id === g.primary_id)?.state?.on ?? g.members.some((m) => entities.find((e) => e.id === m)?.state?.on)) : on;
      setEntities((prev) => prev.map((e) => (g.members.includes(e.id) ? { ...e, state: { ...e.state, on: target } } : e)));
    }
    try { const res = await GroupsAPI.toggle(id, on); mergeEntities(res.affected); } catch (err) { await refresh(); throw err; }
  };

  // ---- Scenes
  const createScene = async (data) => { const s = await ScenesAPI.create(data); setScenes((p) => [...p, s]); return s; };
  const updateScene = async (id, data) => { const s = await ScenesAPI.update(id, data); setScenes((p) => p.map((x) => (x.id === id ? s : x))); return s; };
  const deleteScene = async (id) => { await ScenesAPI.remove(id); setScenes((p) => p.filter((x) => x.id !== id)); };
  const activateScene = async (id) => { const res = await ScenesAPI.activate(id); mergeEntities(res.affected); };

  // ---- Climate
  const createThermostat = async (data) => applyClimate(await ClimateAPI.createThermostat(data));
  const updateThermostat = async (id, patch) => {
    setThermostats((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try { applyClimate(await ClimateAPI.updateThermostat(id, patch)); } catch (err) { await refresh(); throw err; }
  };
  const deleteThermostat = async (id) => applyClimate(await ClimateAPI.removeThermostat(id));
  const createZone = async (data) => { const z = await ClimateAPI.createZone(data); setZones((p) => [...p, z]); return z; };
  const updateZone = async (id, data) => { const z = await ClimateAPI.updateZone(id, data); setZones((p) => p.map((x) => (x.id === id ? z : x))); return z; };
  const deleteZone = async (id) => { await ClimateAPI.removeZone(id); setZones((p) => p.filter((x) => x.id !== id)); };
  const setZone = async (id, body) => applyClimate(await ClimateAPI.setZone(id, body));
  const setAllZones = async (body) => applyClimate(await ClimateAPI.setAllZones(body));

  const value = {
    rooms, entities, discovered, settings, events, groups, scenes, thermostats, zones, weather,
    loading, now, phase, effectiveTheme,
    refresh, updateEntity, moveEntity, deleteEntity,
    createRoom, updateRoom, deleteRoom,
    assignDiscovered, mockDiscovery, updateSettings, reloadEvents,
    createGroup, updateGroup, deleteGroup, toggleGroup,
    createScene, updateScene, deleteScene, activateScene,
    createThermostat, updateThermostat, deleteThermostat,
    createZone, updateZone, deleteZone, setZone, setAllZones,
  };

  return <DomusCtx.Provider value={value}>{children}</DomusCtx.Provider>;
}
