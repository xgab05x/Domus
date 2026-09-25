import CameraGrid from "@/components/CameraGrid";
import AlarmPanel from "@/components/AlarmPanel";
import IntercomWidget from "@/components/IntercomWidget";
import { useDomus } from "@/context/DomusContext";
import { Shield, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { BrandLogo, BrandMotion } from "@/components/BrandMedia";

const LEVEL_ICON = { info: Info, warning: AlertTriangle, alert: AlertCircle };
const LEVEL_CLR = { info: "text-muted", warning: "text-amber-700 dark:text-amber-300", alert: "text-rose-700 dark:text-rose-300" };
const MODE_LABEL = { disarmed: "Disarmato", home: "Armato · Home", away: "Armato · Away" };

export default function Terminus() {
  const { events, settings, entities } = useDomus();
  const activeCams = entities.filter((e) => e.type === "camera").length;
  const activeZones = entities.filter((e) => e.type === "alarm_zone").length;

  return (
    <div className="space-y-8 fade-in">
      <div className="glass rounded-[28px] p-6 md:p-8 relative overflow-hidden" data-testid="terminus-hero">
        <div className="absolute inset-y-0 right-0 w-2/3 [mask-image:linear-gradient(to_left,black,transparent_85%)] pointer-events-none">
          <BrandMotion name="terminus" className="opacity-25 dark:opacity-30" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-start gap-4 flex-1">
            <BrandLogo name="terminus" size={56} className="rounded-2xl shrink-0" testid="brand-logo-terminus" fallback={<div className="icon-btn icon-on w-14 h-14 shrink-0"><Shield size={26} /></div>} />
            <div>
              <div className="label text-acc">Terminus</div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1 leading-tight">Sicurezza perimetrale</h1>
              <p className="text-sm text-muted mt-2 max-w-xl">Videosorveglianza, citofono e antintrusione in un'unica plancia. Stato: <b className="text-foreground">{MODE_LABEL[settings?.alarm_armed] || "—"}</b>.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-[240px]">
            <div className="glass-inner rounded-2xl p-3" data-testid="stat-cameras"><div className="label">Telecamere</div><div className="font-display text-3xl font-semibold mt-1">{activeCams}</div><div className="text-[10px] text-muted">attive</div></div>
            <div className="glass-inner rounded-2xl p-3" data-testid="stat-zones"><div className="label">Zone</div><div className="font-display text-3xl font-semibold mt-1">{activeZones}</div><div className="text-[10px] text-muted">monitorate</div></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="font-display text-xl font-semibold mb-3">Live camere</h2>
            <CameraGrid />
          </section>
        </div>
        <div className="space-y-6">
          <IntercomWidget />
          <AlarmPanel />
          <div className="glass rounded-[28px] p-6" data-testid="events-log">
            <h3 className="font-display text-lg font-semibold mb-3">Attività recente</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {events.map((ev) => {
                const Icon = LEVEL_ICON[ev.level] || Info;
                return (
                  <div key={ev.id} className="flex items-start gap-2 text-xs">
                    <Icon size={14} className={`${LEVEL_CLR[ev.level]} mt-0.5 shrink-0`} />
                    <div className="flex-1"><div className="font-semibold">{ev.source}</div><div className="text-muted">{ev.message}</div></div>
                    <div className="text-[10px] font-mono text-muted shrink-0">{new Date(ev.timestamp).toLocaleTimeString("it-IT")}</div>
                  </div>
                );
              })}
              {events.length === 0 && <div className="text-xs text-muted">Nessun evento.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
