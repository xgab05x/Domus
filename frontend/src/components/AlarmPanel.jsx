import { ShieldCheck, ShieldAlert, ShieldOff, Radar, DoorOpen, DoorClosed } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { AlarmAPI } from "@/lib/api";
import { toast } from "sonner";

const MODES = [
  { k: "disarmed", l: "Disarmato", icon: ShieldOff, tone: "rgba(110,122,140,0.22)", fg: "inherit" },
  { k: "home", l: "Armato Home", icon: ShieldCheck, tone: "rgba(90,150,120,0.24)", fg: "#2f6b4f" },
  { k: "away", l: "Armato Away", icon: ShieldAlert, tone: "rgba(190,90,90,0.22)", fg: "#8f3b3b" },
];
const zoneIcon = { contact: DoorClosed, motion: Radar, glassbreak: DoorOpen };
const KIND_LABEL = { contact: "contatto", motion: "movimento", glassbreak: "rottura vetri" };

export default function AlarmPanel() {
  const { entities, settings, updateSettings, updateEntity, reloadEvents } = useDomus();
  const zones = entities.filter((e) => e.type === "alarm_zone");
  const mode = settings?.alarm_armed || "disarmed";
  const current = MODES.find((m) => m.k === mode) || MODES[0];

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

      <div className="label mb-2">Zone rilevate</div>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((z) => {
          const kind = z.state?.kind || "contact";
          const Icon = zoneIcon[kind] || Radar;
          const bypass = !!z.state?.bypass;
          const triggered = !!z.state?.triggered;
          return (
            <div key={z.id} className={`rounded-2xl p-3 flex items-center gap-3 ${triggered ? "bg-rose-500/10 ring-1 ring-rose-400/40" : "glass-inner"}`} data-testid={`zone-${z.id}`}>
              <div className={`icon-btn w-9 h-9 shrink-0 ${triggered ? "bg-rose-500/80 text-white" : "icon-on"}`}><Icon size={15} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{z.name}</div>
                <div className="label">{KIND_LABEL[kind] || kind}</div>
              </div>
              <button data-testid={`zone-bypass-${z.id}`} onClick={() => updateEntity(z.id, { state: { bypass: !bypass } })} className={`chip !py-0.5 !px-2 !text-[10px] ${bypass ? "chip-active" : ""}`}>
                {bypass ? "bypass" : "attiva"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
