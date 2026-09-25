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
