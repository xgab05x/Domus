import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const http = axios.create({ baseURL: API, timeout: 15000 });

export const RoomsAPI = {
  list: () => http.get("/rooms").then((r) => r.data),
  create: (data) => http.post("/rooms", data).then((r) => r.data),
  update: (id, data) => http.patch(`/rooms/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/rooms/${id}`).then((r) => r.data),
};

export const EntitiesAPI = {
  list: (params = {}) => http.get("/entities", { params }).then((r) => r.data),
  update: (id, data) => http.patch(`/entities/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/entities/${id}`).then((r) => r.data),
  move: (id, roomId) => http.post(`/entities/${id}/move/${roomId || "unassigned"}`).then((r) => r.data),
  create: (data) => http.post("/entities", data).then((r) => r.data),
};

export const DiscoveredAPI = {
  list: () => http.get("/discovered").then((r) => r.data),
  assign: (id, roomId) => http.post(`/discovered/${id}/assign/${roomId || "unassigned"}`).then((r) => r.data),
  mock: () => http.post("/discovered/mock").then((r) => r.data),
};

export const SettingsAPI = {
  get: () => http.get("/settings").then((r) => r.data),
  update: (data) => http.patch("/settings", data).then((r) => r.data),
};

export const EventsAPI = {
  list: (limit = 30) => http.get("/events", { params: { limit } }).then((r) => r.data),
};

export const IntercomAPI = {
  ring: (id) => http.post(`/intercom/${id}/ring`).then((r) => r.data),
  answer: (id, action) => http.post(`/intercom/${id}/answer`, null, { params: { action } }).then((r) => r.data),
};

export const AlarmAPI = {
  set: (mode) => http.post(`/alarm/set/${mode}`).then((r) => r.data),
};
