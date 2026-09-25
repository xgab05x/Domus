import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { AppAPI, RoomsAPI, EntitiesAPI, DiscoveredAPI, SettingsAPI, EventsAPI, GroupsAPI, ScenesAPI, ClimateAPI, MetersAPI, ChartsAPI, EnergyAPI, NotificationsAPI, ViewsAPI, MediaAPI, AlarmAPI, CastAPI, API } from "@/lib/api";
import { computePhase } from "@/lib/solar";
import PinDialog from "@/components/PinDialog";

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
  const [meters, setMeters] = useState([]);
  const [charts, setCharts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [energy, setEnergy] = useState(null);
  const [views, setViews] = useState([]);
  const [ha, setHa] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [pinReq, setPinReq] = useState(null);
  const seenNotif = useRef(null);

  const ingestNotifications = useCallback((list) => {
    setNotifications(list);
    if (seenNotif.current === null) { seenNotif.current = new Set(list.map((n) => n.id)); return; }
    list.filter((n) => !seenNotif.current.has(n.id)).reverse().forEach((n) => {
      seenNotif.current.add(n.id);
      (n.level === "warning" || n.level === "error" ? toast.warning : toast.info)(n.title, { description: n.message });
    });
  }, []);

  const refresh = useCallback(async () => {
    const d = await AppAPI.data();
    setRooms(d.rooms); setEntities(d.entities); setDiscovered(d.discovered); setSettings(d.settings);
    setEvents(d.events); setGroups(d.groups); setScenes(d.scenes); setThermostats(d.thermostats);
    setZones(d.zones); setWeather(d.weather); setMeters(d.meters); setCharts(d.charts); setEnergy(d.energy);
    setViews(d.views || []); setHa(d.ha || null);
    ingestNotifications(d.notifications);
    setLoading(false);
  }, [ingestNotifications]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    const n = setInterval(async () => { try { ingestNotifications(await NotificationsAPI.list(50)); } catch { /* offline */ } }, 10000);
    return () => { clearInterval(t); clearInterval(n); };
  }, [refresh, ingestNotifications]);

  const mergeEntities = useCallback((affected = []) => {
    if (!affected.length) return;
    const map = new Map(affected.map((a) => [a.id, a]));
    setEntities((prev) => prev.map((e) => map.get(e.id) || e));
  }, []);

  useEffect(() => {
    let ws, timer, closed = false;
    const connect = () => {
      try { ws = new WebSocket(`${API.replace(/^http/, "ws")}/ws`); } catch { return; }
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === "entities") mergeEntities(m.affected);
          else if (m.type === "ha") setHa(m.ha);
          else if (m.type === "settings") setSettings(m.settings);
          else if (m.type === "refresh") refresh();
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (!closed) timer = setTimeout(connect, 6000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { closed = true; clearTimeout(timer); try { ws?.close(); } catch { /* noop */ } };
  }, [mergeEntities, refresh]);

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
  const activateScene = async (id) => {
    const scene = scenes.find((s) => s.id === id);
    const sensitive = (scene?.actions || []).some((a) => ["privacy", "siren", "locked"].some((k) => k in (a.state || {})));
    let pin = null;
    if (sensitive) {
      const res = await askPin("sensitive", `Attiva scena ${scene?.name || ""}`);
      if (!res.ok) return;
      pin = res.pin;
    }
    const res = await ScenesAPI.activate(id, pin);
    mergeEntities(res.affected);
  };

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

  // ---- Energy
  const refreshEnergy = useCallback(async () => {
    const [m, e, ents] = await Promise.all([MetersAPI.list(), EnergyAPI.summary(), EntitiesAPI.list({ type: "meter" })]);
    setMeters(m); setEnergy(e);
    const plugs = await EntitiesAPI.list({ type: "plug" });
    mergeEntities([...ents, ...plugs]);
  }, [mergeEntities]);
  const createMeter = async (data) => setMeters(await MetersAPI.create(data));
  const updateMeter = async (id, data) => setMeters(await MetersAPI.update(id, data));
  const deleteMeter = async (id) => { await MetersAPI.remove(id); setMeters((p) => p.filter((m) => m.id !== id)); setCharts((p) => p.filter((c) => !(c.source_kind === "meter" && c.source_id === id))); };
  const createChart = async (data) => { const c = await ChartsAPI.create(data); setCharts((p) => [...p, c]); return c; };
  const updateChart = async (id, data) => { const c = await ChartsAPI.update(id, data); setCharts((p) => p.map((x) => (x.id === id ? c : x))); return c; };
  const deleteChart = async (id) => { await ChartsAPI.remove(id); setCharts((p) => p.filter((x) => x.id !== id)); };

  // ---- Notifications / availability
  const markNotificationsRead = async () => { await NotificationsAPI.readAll(); setNotifications((p) => p.map((n) => ({ ...n, read: true }))); };
  const clearNotifications = async () => { await NotificationsAPI.clear(); setNotifications([]); };
  const setAvailability = async (id, available) => { const e = await NotificationsAPI.setAvailability(id, available); mergeEntities([e]); ingestNotifications(await NotificationsAPI.list(50)); };

  // ---- Views (Terminus)
  const createView = async (data) => { const v = await ViewsAPI.create(data); setViews((p) => [...p, v]); return v; };
  const updateView = async (id, data) => { const v = await ViewsAPI.update(id, data); setViews((p) => p.map((x) => (x.id === id ? v : x))); return v; };
  const deleteView = async (id) => { await ViewsAPI.remove(id); setViews((p) => p.filter((x) => x.id !== id)); };

  // ---- Media
  const mediaCommand = async (id, command, value) => {
    const e = await MediaAPI.command(id, command, value);
    mergeEntities([e]);
    return e;
  };

  // ---- Security PIN (disarmo e azioni sensibili)
  const pinNeeded = useCallback((scope) => {
    if (!settings?.pin_enabled || !settings?.pin_set) return false;
    if (scope === "config") return true;
    return scope === "disarm" ? settings.pin_protect_disarm !== false : settings.pin_protect_sensitive !== false;
  }, [settings]);

  const askPin = useCallback((scope, reason) => {
    if (!pinNeeded(scope)) return Promise.resolve({ ok: true, pin: null });
    return new Promise((resolve) => setPinReq({ reason, resolve: (pin) => resolve({ ok: !!pin, pin }) }));
  }, [pinNeeded]);

  // Settings that weaken security (PIN flags, alarm mapping/code) need the PIN both here and server-side.
  const updateSettingsSecure = async (patch, reason) => {
    const { ok, pin } = await askPin("config", reason || "Modifica impostazioni di sicurezza");
    if (!ok) return null;
    return updateSettings({ ...patch, ...(pin ? { pin } : {}) });
  };

  const setAlarmMode = async (mode) => {
    const { ok, pin } = mode === "disarmed" ? await askPin("disarm", "Disarma l'antintrusione") : { ok: true, pin: null };
    if (mode === "disarmed" && !ok) return null;
    const res = await AlarmAPI.set(mode, pin);
    setSettings((prev) => (prev ? { ...prev, alarm_armed: mode } : prev));
    await reloadEvents();
    return res;
  };

  // ---- Cast
  const castStart = async (id, body) => { const r = await CastAPI.start(id, body); mergeEntities([r.entity]); return r; };
  const castStop = async (id) => { const r = await CastAPI.stop(id); mergeEntities([r.entity]); return r; };

  const value = {
    rooms, entities, discovered, settings, events, groups, scenes, thermostats, zones, weather, meters, charts, notifications, energy, views, ha,
    loading, now, phase, effectiveTheme,
    refresh, updateEntity, moveEntity, deleteEntity, mergeEntities, setHa,
    createRoom, updateRoom, deleteRoom,
    assignDiscovered, mockDiscovery, updateSettings, reloadEvents,
    createGroup, updateGroup, deleteGroup, toggleGroup,
    createScene, updateScene, deleteScene, activateScene,
    createThermostat, updateThermostat, deleteThermostat,
    createZone, updateZone, deleteZone, setZone, setAllZones,
    refreshEnergy, createMeter, updateMeter, deleteMeter, createChart, updateChart, deleteChart,
    markNotificationsRead, clearNotifications, setAvailability,
    createView, updateView, deleteView, mediaCommand,
    askPin, pinNeeded, setAlarmMode, castStart, castStop, updateSettingsSecure,
  };

  return (
    <DomusCtx.Provider value={value}>
      {children}
      <PinDialog open={!!pinReq} reason={pinReq?.reason}
        onCancel={() => { pinReq?.resolve(null); setPinReq(null); }}
        onConfirm={(pin) => { pinReq?.resolve(pin); setPinReq(null); }} />
    </DomusCtx.Provider>
  );
}
