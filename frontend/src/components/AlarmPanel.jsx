import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldOff, Moon, Palmtree, SlidersHorizontal, Lock, Cpu } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { toast } from "sonner";
import SecurityCard from "@/components/SecurityCard";
import SensorDetail from "@/components/SensorDetail";
import { MODE_META } from "@/components/AlarmSettings";

const ICONS = { disarmed: ShieldOff, home: ShieldCheck, away: ShieldAlert, night: Moon, vacation: Palmtree, custom: SlidersHorizontal };
const HA_BUSY = { arming: "In armamento…", pending: "Conto alla rovescia…", triggered: "ALLARME IN CORSO" };

export default function AlarmPanel({ zones: zonesProp }) {
  const { entities, settings, setAlarmMode, ha, pinNeeded } = useDomus();
  const allowed = settings?.alarm_zone_ids?.length ? settings.alarm_zone_ids : null;
  const zones = (zonesProp || entities.filter((e) => e.type === "alarm_zone")).filter((z) => !allowed || allowed.includes(z.id));
  const mode = settings?.alarm_armed || "disarmed";
  const modes = (settings?.alarm_modes?.length ? settings.alarm_modes : ["disarmed", "home", "away"]).filter((m) => MODE_META[m]);
  const current = MODE_META[mode] || MODE_META.disarmed;
  const haState = settings?.alarm_ha_state;
  const linked = !!settings?.alarm_entity_id && ha?.connected;
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const openZone = entities.find((e) => e.id === open);
  const triggered = zones.filter((z) => z.state?.triggered).length;
  const bypassed = zones.filter((z) => z.state?.bypass).length;

  const setMode = async (m) => {
    setBusy(m);
    try {
      const res = await setAlarmMode(m);
      if (res) toast.success(`Antintrusione: ${MODE_META[m]?.l}${res.ha ? " · inviato a Home Assistant" : ""}`);
    } catch (err) { toast.error(err?.response?.data?.detail || "Comando allarme non riuscito"); }
    setBusy(null);
  };

  return (
    <div className="glass rounded-[28px] p-6" data-testid="alarm-panel">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="label text-acc">Antintrusione</div>
          <h3 className="font-display text-lg font-semibold">Sistema di sicurezza</h3>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${HA_BUSY[haState] ? "animate-pulse" : ""}`} style={{ background: current.tone, color: current.fg }} data-testid="alarm-status">
          {HA_BUSY[haState] || current.l}
        </div>
      </div>

      <div className={`grid gap-2 mb-4 ${modes.length > 3 ? "grid-cols-3" : "grid-cols-3"}`}>
        {modes.map((m) => {
          const Icon = ICONS[m] || ShieldCheck;
          const active = mode === m;
          const meta = MODE_META[m];
          return (
            <button key={m} data-testid={`alarm-${m}`} onClick={() => setMode(m)} aria-pressed={active} disabled={!!busy}
              className={`p-3.5 rounded-2xl flex flex-col items-center gap-2 press transition-all ${active ? "" : "glass-inner hover:bg-white/50 dark:hover:bg-white/10"} ${busy === m ? "opacity-60" : ""}`}
              style={active ? { background: meta.tone, color: meta.fg, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" } : undefined}>
              <Icon size={20} className={active ? "pop-in" : ""} />
              <div className="text-[11px] font-semibold text-center leading-tight">{meta.l}</div>
              {m === "disarmed" && pinNeeded("disarm") && <Lock size={10} className="opacity-70" data-testid="alarm-disarm-pin-hint" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-4 text-[10px] text-muted flex-wrap" data-testid="alarm-ha-link">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${linked ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15"}`}>
          <Cpu size={10} /> {linked ? `pannello HA · ${settings.alarm_entity_id}` : "pannello HA non collegato"}
        </span>
        {pinNeeded("disarm") && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-acc-soft text-acc"><Lock size={10} /> PIN per disarmare</span>}
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
