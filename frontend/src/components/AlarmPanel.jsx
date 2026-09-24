import { ShieldCheck, ShieldAlert, ShieldOff, Radar, DoorOpen, DoorClosed } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { AlarmAPI } from "@/lib/api";
import { toast } from "sonner";

const MODES = [
  { k: "disarmed", l: "Disarmato", icon: ShieldOff, color: "from-slate-400 to-slate-500" },
  { k: "home", l: "Armato Home", icon: ShieldCheck, color: "from-emerald-500 to-teal-600" },
  { k: "away", l: "Armato Away", icon: ShieldAlert, color: "from-rose-500 to-red-600" },
];

const zoneIcon = { contact: DoorClosed, motion: Radar, glassbreak: DoorOpen };

export default function AlarmPanel() {
  const { entities, settings, updateSettings, updateEntity, reloadEvents } = useDomus();
  const zones = entities.filter((e) => e.type === "alarm_zone");
  const mode = settings?.alarm_armed || "disarmed";

  const setMode = async (m) => {
    await AlarmAPI.set(m);
    await updateSettings({ alarm_armed: m });
    await reloadEvents();
    toast.success(`Sistema: ${m}`);
  };

  return (
    <div className="glass rounded-3xl p-6" data-testid="alarm-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-semibold">Antintrusione</div>
          <h3 className="font-display text-xl font-bold">Sistema di sicurezza</h3>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${MODES.find((m) => m.k === mode)?.color}`} data-testid="alarm-status">
          {MODES.find((m) => m.k === mode)?.l}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.k;
          return (
            <button
              key={m.k}
              data-testid={`alarm-${m.k}`}
              onClick={() => setMode(m.k)}
              className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                active
                  ? `bg-gradient-to-br ${m.color} text-white border-transparent shadow-lg scale-[1.02]`
                  : "bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-white/10 hover:scale-[1.02]"
              }`}
            >
              <Icon size={22} />
              <div className="text-xs font-semibold">{m.l}</div>
            </button>
          );
        })}
      </div>

      <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Zone rilevate</div>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((z) => {
          const kind = z.state?.kind || "contact";
          const Icon = zoneIcon[kind] || Radar;
          const bypass = !!z.state?.bypass;
          const triggered = !!z.state?.triggered;
          return (
            <div key={z.id} className={`rounded-2xl p-3 flex items-center gap-3 border ${
              triggered ? "bg-rose-500/10 border-rose-500/40" : "bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-white/10"
            }`} data-testid={`zone-${z.id}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                triggered ? "bg-rose-500 text-white" : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
              }`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate text-slate-900 dark:text-slate-50">{z.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-400">{kind}</div>
              </div>
              <button
                data-testid={`zone-bypass-${z.id}`}
                onClick={() => updateEntity(z.id, { state: { bypass: !bypass } })}
                className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                  bypass ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {bypass ? "BYPASS" : "attiva"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
