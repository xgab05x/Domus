import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { RoomsAPI, EntitiesAPI, DiscoveredAPI, SettingsAPI, EventsAPI } from "@/lib/api";
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
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [r, e, d, s, ev] = await Promise.all([
      RoomsAPI.list(),
      EntitiesAPI.list(),
      DiscoveredAPI.list(),
      SettingsAPI.get(),
      EventsAPI.list(30),
    ]);
    setRooms(r);
    setEntities(e);
    setDiscovered(d);
    setSettings(s);
    setEvents(ev);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    const root = document.documentElement;
    if (effectiveTheme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [effectiveTheme]);

  // Entity actions with optimistic update
  const updateEntity = async (id, patch) => {
    setEntities((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch, state: { ...(x.state || {}), ...(patch.state || {}) } } : x)));
    try { await EntitiesAPI.update(id, patch); } catch (err) { await refresh(); throw err; }
  };

  const moveEntity = async (id, roomId) => {
    setEntities((prev) => prev.map((x) => (x.id === id ? { ...x, room_id: roomId || null } : x)));
    try { await EntitiesAPI.move(id, roomId); } catch (err) { await refresh(); throw err; }
  };

  const deleteEntity = async (id) => {
    setEntities((prev) => prev.filter((x) => x.id !== id));
    try { await EntitiesAPI.remove(id); } catch (err) { await refresh(); throw err; }
  };

  const createRoom = async (data) => { const r = await RoomsAPI.create(data); setRooms((prev) => [...prev, r]); return r; };
  const updateRoom = async (id, data) => { const r = await RoomsAPI.update(id, data); setRooms((prev) => prev.map((x) => (x.id === id ? r : x))); return r; };
  const deleteRoom = async (id) => { await RoomsAPI.remove(id); setRooms((prev) => prev.filter((x) => x.id !== id)); await refresh(); };

  const assignDiscovered = async (discId, roomId) => {
    const created = await DiscoveredAPI.assign(discId, roomId);
    setEntities((prev) => [...prev, created]);
    setDiscovered((prev) => prev.filter((x) => x.id !== discId));
    return created;
  };
  const mockDiscovery = async () => { const d = await DiscoveredAPI.mock(); setDiscovered((prev) => [...prev, d]); return d; };

  const updateSettings = async (data) => { const s = await SettingsAPI.update(data); setSettings(s); return s; };

  const reloadEvents = async () => { const ev = await EventsAPI.list(30); setEvents(ev); };

  const value = {
    rooms, entities, discovered, settings, events,
    loading, now, phase, effectiveTheme,
    refresh, updateEntity, moveEntity, deleteEntity,
    createRoom, updateRoom, deleteRoom,
    assignDiscovered, mockDiscovery, updateSettings, reloadEvents,
  };

  return <DomusCtx.Provider value={value}>{children}</DomusCtx.Provider>;
}
