import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { AlarmAPI } from "@/lib/api";
import { toast } from "sonner";
import SecurityCard from "@/components/SecurityCard";
import SensorDetail from "@/components/SensorDetail";

const MODES = [
  { k: "disarmed", l: "Disarmato", icon: ShieldOff, tone: "rgba(110,122,140,0.22)", fg: "inherit" },
  { k: "home", l: "Armato Home", icon: ShieldCheck, tone: "rgba(90,150,120,0.24)", fg: "#2f6b4f" },
  { k: "away", l: "Armato Away", icon: ShieldAlert, tone: "rgba(190,90,90,0.22)", fg: "#8f3b3b" },
];

export default function AlarmPanel({ zones: zonesProp }) {
  const { entities, settings, updateSettings, reloadEvents } = useDomus();
  const zones = zonesProp || entities.filter((e) => e.type === "alarm_zone");
  const mode = settings?.alarm_armed || "disarmed";
  const current = MODES.find((m) => m.k === mode) || MODES[0];
  const [open, setOpen] = useState(null);
  const openZone = entities.find((e) => e.id === open);
  const triggered = zones.filter((z) => z.state?.triggered).length;
  const bypassed = zones.filter((z) => z.state?.bypass).length;

  const setMode = async (m) => {
    await AlarmAPI.set(m);
    await updateSettings({ alarm_armed: m });
    await reloadEvents();
    toast.success(`Antintrusione: ${MODES.find((x) => x.k === m)?.l}`);
  };

  return (
    <div className="glass rounded-[28px] p-6" data-testid="alarm-panel">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <div className="label text-acc">Antintrusione</div>
          <h3 className="font-display text-lg font-semibold">Sistema di sicurezza</h3>
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: current.tone, color: current.fg }} data-testid="alarm-status">{current.l}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.k;
          return (
            <button key={m.k} data-testid={`alarm-${m.k}`} onClick={() => setMode(m.k)} aria-pressed={active}
              className={`p-3.5 rounded-2xl flex flex-col items-center gap-2 transition-all ${active ? "" : "glass-inner hover:bg-white/50 dark:hover:bg-white/10"}`}
              style={active ? { background: m.tone, color: m.fg, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" } : undefined}>
              <Icon size={20} />
              <div className="text-[11px] font-semibold">{m.l}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="label">Zone ({zones.length})</div>
        <div className="text-[10px] text-muted" data-testid="alarm-zone-summary">{triggered ? <span className="text-rose-600 font-semibold">{triggered} attive</span> : "tutto a riposo"}{bypassed ? ` · ${bypassed} bypass` : ""}</div>
      </div>
      <div className="grid grid-cols-1 gap-2" data-testid="alarm-zones">
        {zones.map((z) => <SecurityCard key={z.id} entity={z} compact onOpen={() => setOpen(z.id)} />)}
        {zones.length === 0 && <div className="text-xs text-muted py-2">Nessuna zona in questa vista.</div>}
      </div>
      <SensorDetail entity={openZone} open={!!openZone} onClose={() => setOpen(null)} />
    </div>
  );
}
