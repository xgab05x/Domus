// Identità locale dell'interfaccia Domus (tablet, PC, telefono): serve per tracciare nei log chi ha dato il comando.
const ID_KEY = "domus_device_id";
const NAME_KEY = "domus_device_name";

function guessName() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "Tablet";
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return "Telefono";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "PC";
  return "Interfaccia Domus";
}

export function deviceId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function deviceName() {
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = guessName();
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

export function setDeviceName(name) {
  const clean = (name || "").trim().slice(0, 40);
  if (clean) localStorage.setItem(NAME_KEY, clean);
  return clean;
}
