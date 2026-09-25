import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const http = axios.create({ baseURL: API, timeout: 15000 });
const d = (p) => p.then((r) => r.data);

export const AppAPI = { data: () => d(http.get("/app-data")) };
export const WeatherAPI = { get: () => d(http.get("/weather")) };

export const RoomsAPI = {
  list: () => d(http.get("/rooms")),
  create: (data) => d(http.post("/rooms", data)),
  update: (id, data) => d(http.patch(`/rooms/${id}`, data)),
  remove: (id) => d(http.delete(`/rooms/${id}`)),
};

export const EntitiesAPI = {
  list: (params = {}) => d(http.get("/entities", { params })),
  update: (id, data) => d(http.patch(`/entities/${id}`, data)),
  remove: (id) => d(http.delete(`/entities/${id}`)),
  move: (id, roomId) => d(http.post(`/entities/${id}/move/${roomId || "unassigned"}`)),
  create: (data) => d(http.post("/entities", data)),
};

export const GroupsAPI = {
  create: (data) => d(http.post("/groups", data)),
  update: (id, data) => d(http.patch(`/groups/${id}`, data)),
  remove: (id) => d(http.delete(`/groups/${id}`)),
  toggle: (id, on) => d(http.post(`/groups/${id}/toggle`, null, { params: on === undefined ? {} : { on } })),
};

export const ScenesAPI = {
  create: (data) => d(http.post("/scenes", data)),
  update: (id, data) => d(http.patch(`/scenes/${id}`, data)),
  remove: (id) => d(http.delete(`/scenes/${id}`)),
  activate: (id) => d(http.post(`/scenes/${id}/activate`)),
};

export const ClimateAPI = {
  createThermostat: (data) => d(http.post("/thermostats", data)),
  updateThermostat: (id, data) => d(http.patch(`/thermostats/${id}`, data)),
  removeThermostat: (id) => d(http.delete(`/thermostats/${id}`)),
  createZone: (data) => d(http.post("/zones", data)),
  updateZone: (id, data) => d(http.patch(`/zones/${id}`, data)),
  removeZone: (id) => d(http.delete(`/zones/${id}`)),
  setZone: (id, body) => d(http.post(`/zones/${id}/set`, body)),
  setAllZones: (body) => d(http.post("/zones/set-all", body)),
};

export const DiscoveredAPI = {
  list: () => d(http.get("/discovered")),
  assign: (id, roomId) => d(http.post(`/discovered/${id}/assign/${roomId || "unassigned"}`)),
  mock: () => d(http.post("/discovered/mock")),
};

export const MetersAPI = {
  list: () => d(http.get("/meters")),
  create: (data) => d(http.post("/meters", data)),
  update: (id, data) => d(http.patch(`/meters/${id}`, data)),
  remove: (id) => d(http.delete(`/meters/${id}`)),
};

export const ChartsAPI = {
  create: (data) => d(http.post("/charts", data)),
  update: (id, data) => d(http.patch(`/charts/${id}`, data)),
  remove: (id) => d(http.delete(`/charts/${id}`)),
};

export const HistoryAPI = { get: (kind, id, range) => d(http.get("/history", { params: { kind, id, range } })) };
export const EnergyAPI = { summary: () => d(http.get("/energy/summary")) };

export const NotificationsAPI = {
  list: (limit = 50) => d(http.get("/notifications", { params: { limit } })),
  readAll: () => d(http.post("/notifications/read-all")),
  clear: () => d(http.delete("/notifications")),
  setAvailability: (id, available) => d(http.post(`/entities/${id}/availability`, null, { params: { available } })),
};

export const SettingsAPI = {
  get: () => d(http.get("/settings")),
  update: (data) => d(http.patch("/settings", data)),
};

export const EventsAPI = { list: (limit = 30) => d(http.get("/events", { params: { limit } })) };

export const IntercomAPI = {
  ring: (id) => d(http.post(`/intercom/${id}/ring`)),
  answer: (id, action) => d(http.post(`/intercom/${id}/answer`, null, { params: { action } })),
};

export const AlarmAPI = { set: (mode) => d(http.post(`/alarm/set/${mode}`)) };

export const ViewsAPI = {
  list: () => d(http.get("/views")),
  create: (data) => d(http.post("/views", data)),
  update: (id, data) => d(http.patch(`/views/${id}`, data)),
  remove: (id) => d(http.delete(`/views/${id}`)),
};

export const CamerasAPI = {
  ptz: (id, body) => d(http.post(`/cameras/${id}/ptz`, body)),
  simulateMotion: (id) => d(http.post(`/cameras/${id}/simulate-motion`)),
  snapshotUrl: (id, t = 0) => `${API}/cameras/${id}/snapshot?t=${t}`,
  streamUrl: (id) => `${API}/cameras/${id}/stream`,
};

export const MediaAPI = {
  command: (id, command, value) => d(http.post(`/media/${id}/command`, { command, value })),
  tts: (message, ids, announce = true) => d(http.post("/media/tts", { message, ids, announce })),
  notify: (title, message, ids, duration = 8) => d(http.post("/media/notify", { title, message, ids, duration })),
};

export const HAAPI = {
  status: () => d(http.get("/ha/status")),
  check: () => d(http.post("/ha/check")),
  config: (data) => d(http.post("/ha/config", data)),
  import: () => d(http.post("/ha/import", null, { timeout: 120000 })),
  states: (limit = 500) => d(http.get("/ha/states", { params: { limit } })),
  proxyUrl: (path) => `${API}/ha/proxy?path=${encodeURIComponent(path)}`,
};

export const BackupsAPI = {
  list: () => d(http.get("/backups")),
  create: (label) => d(http.post("/backups", null, { params: label ? { label } : {} })),
  restore: (name, includeSettings = true) => d(http.post(`/backups/${encodeURIComponent(name)}/restore`, null, { params: { include_settings: includeSettings } })),
  remove: (name) => d(http.delete(`/backups/${encodeURIComponent(name)}`)),
  downloadUrl: (name) => `${API}/backups/${encodeURIComponent(name)}/download`,
  upload: (file, restore = false) => { const fd = new FormData(); fd.append("file", file); return d(http.post("/backups/import", fd, { params: { restore }, headers: { "Content-Type": "multipart/form-data" } })); },
};

export const ProblemsAPI = { list: () => d(http.get("/problems")) };
