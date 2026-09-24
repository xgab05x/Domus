import CameraGrid from "@/components/CameraGrid";
import AlarmPanel from "@/components/AlarmPanel";
import IntercomWidget from "@/components/IntercomWidget";
import { useDomus } from "@/context/DomusContext";
import { Shield, AlertCircle, Info, AlertTriangle } from "lucide-react";

const LEVEL_ICON = { info: Info, warning: AlertTriangle, alert: AlertCircle };
const LEVEL_CLR = {
  info: "text-slate-600 dark:text-slate-300",
  warning: "text-amber-600 dark:text-amber-400",
  alert: "text-rose-600 dark:text-rose-400",
};

export default function Terminus() {
  const { events, settings, entities } = useDomus();
  const activeCams = entities.filter((e) => e.type === "camera").length;
  const activeZones = entities.filter((e) => e.type === "alarm_zone").length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass rounded-3xl p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs uppercase tracking-widest font-semibold">
            <Shield size={14} />
            Terminus
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2">
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">Sicurezza</span> perimetrale
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-3 max-w-xl">
            Videosorveglianza, citofono e antintrusione uniti in un'unica plancia.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-3xl p-5" data-testid="stat-cameras">
            <div className="text-xs uppercase tracking-widest text-slate-500">Telecamere</div>
            <div className="font-display text-4xl font-extrabold">{activeCams}</div>
            <div className="text-xs text-slate-500">attive</div>
          </div>
          <div className="glass rounded-3xl p-5" data-testid="stat-zones">
            <div className="text-xs uppercase tracking-widest text-slate-500">Zone</div>
            <div className="font-display text-4xl font-extrabold">{activeZones}</div>
            <div className="text-xs text-slate-500">monitorate</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="font-display text-xl font-bold mb-3">Live camere</h2>
            <CameraGrid />
          </section>
        </div>
        <div className="space-y-6">
          <IntercomWidget />
          <AlarmPanel />
          <div className="glass rounded-3xl p-6" data-testid="events-log">
            <h3 className="font-display text-lg font-bold mb-3">Attività recente</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {events.map((ev) => {
                const Icon = LEVEL_ICON[ev.level] || Info;
                return (
                  <div key={ev.id} className="flex items-start gap-2 text-xs">
                    <Icon size={14} className={`${LEVEL_CLR[ev.level]} mt-0.5 shrink-0`} />
                    <div className="flex-1">
                      <div className="font-semibold">{ev.source}</div>
                      <div className="text-slate-500 dark:text-slate-400">{ev.message}</div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(ev.timestamp).toLocaleTimeString("it-IT")}
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && <div className="text-xs text-slate-500">Nessun evento.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
