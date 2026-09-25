import { DoorClosed, DoorOpen, Radar, ShieldAlert, Siren, Bell, Cctv, Gauge, Phone } from "lucide-react";

export const SECURITY_TYPES = ["camera", "doorbell", "intercom", "alarm_zone", "sensor"];
export const KIND_LABEL = { contact: "Contatto porta/finestra", motion: "Movimento (PIR)", glassbreak: "Rottura vetri / vibrazione", safety: "Fumo · gas · acqua" };
export const KIND_SHORT = { contact: "contatto", motion: "movimento", glassbreak: "vibrazione", safety: "sicurezza" };
export const KIND_ICON = { contact: DoorClosed, motion: Radar, glassbreak: ShieldAlert, safety: Siren };
export const TYPE_LABEL = { camera: "Telecamera", doorbell: "Videocitofono", intercom: "Citofono", alarm_zone: "Sensore", sensor: "Sensore ambientale" };
export const TYPE_ICON = { camera: Cctv, doorbell: Bell, intercom: Phone, alarm_zone: Radar, sensor: Gauge };

export const isSecurity = (e) => SECURITY_TYPES.includes(e.type);

export function zoneStatus(z) {
  const s = z.state || {};
  const kind = s.kind || "contact";
  if (z.available === false) return { label: "Offline", tone: "amber" };
  if (s.tamper) return { label: "Manomissione", tone: "rose" };
  if (s.triggered) return { label: kind === "contact" ? "Aperto" : kind === "motion" ? "Movimento" : "Allarme", tone: "rose" };
  if (s.bypass) return { label: "Bypass", tone: "slate" };
  return { label: kind === "contact" ? "Chiuso" : "A riposo", tone: "emerald" };
}

export const TONE = {
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  acc: "bg-acc-soft text-acc",
};

export function batteryTone(b) {
  if (b == null) return "slate";
  if (b < 25) return "rose";
  if (b < 50) return "amber";
  return "emerald";
}

export function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? `oggi ${time}` : `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} ${time}`;
}

export { DoorOpen };
