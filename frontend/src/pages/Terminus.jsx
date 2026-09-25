import { useMemo, useState } from "react";
import CameraGrid from "@/components/CameraGrid";
import GridsPanel from "@/components/GridsPanel";
import AlarmPanel from "@/components/AlarmPanel";
import IntercomWidget from "@/components/IntercomWidget";
import SecurityCard from "@/components/SecurityCard";
import SensorDetail from "@/components/SensorDetail";
import ViewEditor from "@/components/ViewEditor";
import { useDomus } from "@/context/DomusContext";
import { Shield, AlertCircle, Info, AlertTriangle, LayoutGrid, Plus, Pencil, Grid3x3, Cctv, Radar } from "lucide-react";
import { BrandLogo } from "@/components/BrandMedia";
import BannerArt from "@/components/BannerArt";
import { iconFor } from "@/lib/icons";

const LEVEL_ICON = { info: Info, warning: AlertTriangle, alert: AlertCircle };
const LEVEL_CLR = { info: "text-muted", warning: "text-amber-700 dark:text-amber-300", alert: "text-rose-700 dark:text-rose-300" };
const MODE_LABEL = { disarmed: "Disarmato", home: "Armato · Home", away: "Armato · Away" };

export default function Terminus() {
  const { events, settings, entities, views } = useDomus();
  const [viewId, setViewId] = useState("all");
  const [editor, setEditor] = useState({ open: false, id: null });
  const [sensorOpen, setSensorOpen] = useState(null);

  const view = views.find((v) => v.id === viewId) || null;
  const inView = (e) => !view || view.members.includes(e.id);
  const cams = useMemo(() => entities.filter((e) => (e.type === "camera" || e.type === "doorbell") && inView(e)), [entities, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const intercoms = useMemo(() => entities.filter((e) => (e.type === "intercom" || e.type === "doorbell") && inView(e)), [entities, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const zones = useMemo(() => entities.filter((e) => e.type === "alarm_zone" && inView(e)), [entities, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const sensors = useMemo(() => entities.filter((e) => e.type === "sensor" && inView(e)), [entities, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCams = entities.filter((e) => e.type === "camera" || e.type === "doorbell").length;
  const allZones = entities.filter((e) => e.type === "alarm_zone");
  const triggered = allZones.filter((z) => z.state?.triggered).length;
  const offline = entities.filter((e) => ["camera", "doorbell", "intercom", "alarm_zone"].includes(e.type) && e.available === false).length;
  const sensorEntity = entities.find((e) => e.id === sensorOpen);
  const compact = view?.layout === "compact";

  return (
    <div className="space-y-8 fade-in">
      <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-stretch" data-testid="terminus-hero">
        <BannerArt name="terminus" />
        <div className="glass rounded-[28px] p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start gap-4">
            <BrandLogo name="terminus" size={72} className="shrink-0 drop-shadow-md" testid="brand-logo-terminus" fallback={<div className="icon-btn icon-on w-14 h-14 shrink-0"><Shield size={26} /></div>} />
            <div className="min-w-0">
              <div className="label text-acc">Terminus</div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1 leading-tight">Sicurezza perimetrale</h1>
              <p className="text-sm text-muted mt-2">Videosorveglianza, videocitofoni e antintrusione in un'unica plancia. Stato: <b className="text-foreground">{MODE_LABEL[settings?.alarm_armed] || "—"}</b>.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Telecamere" value={allCams} hint="e videocitofoni" testid="stat-cameras" />
            <Stat label="Zone" value={allZones.length} hint="monitorate" testid="stat-zones" />
            <Stat label="Allarmi" value={triggered} hint={triggered ? "zone attive!" : "nessuno attivo"} testid="stat-triggered" tone={triggered ? "rose" : null} />
            <Stat label="Offline" value={offline} hint="dispositivi" testid="stat-offline" tone={offline ? "amber" : null} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-full glass flex-wrap" data-testid="terminus-views">
          <button onClick={() => setViewId("all")} className={`chip !py-2 ${viewId === "all" ? "chip-active" : "!bg-transparent !border-transparent"}`} data-testid="view-tab-all"><Grid3x3 size={14} /> Tutto</button>
          {views.map((v) => { const VI = iconFor(v.icon, LayoutGrid); return (
            <button key={v.id} onClick={() => setViewId(v.id)} className={`chip !py-2 ${viewId === v.id ? "chip-active" : "!bg-transparent !border-transparent"}`} data-testid={`view-tab-${v.id}`}>
              <VI size={14} /> <span className="w-2 h-2 rounded-full" style={{ background: v.color }} /> {v.name}
            </button>
          ); })}
          <button onClick={() => setEditor({ open: true, id: null })} className="chip !py-2 !bg-transparent !border-dashed" data-testid="view-add-btn"><Plus size={14} /> Vista</button>
        </div>
        <div className="flex items-center gap-2">
          {view && <button onClick={() => setEditor({ open: true, id: view.id })} className="chip" data-testid="view-edit-btn"><Pencil size={13} /> Modifica vista</button>}
          <button onClick={() => setEditor({ open: true, id: view?.id || null })} className="chip" data-testid="open-view-editor-btn"><LayoutGrid size={13} /> Gestisci viste</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2"><Cctv size={18} className="text-acc" /> Live camere{view ? <span className="text-sm text-muted font-body font-normal">· {view.name}</span> : null}</h2>
            <CameraGrid cams={cams} columns={compact ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"} />
          </section>
          <GridsPanel />
          {(zones.length > 0 || sensors.length > 0) && (
            <section>
              <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2"><Radar size={18} className="text-acc" /> Sensori e zone</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="sensor-grid">
                {[...zones, ...sensors].map((z) => <SecurityCard key={z.id} entity={z} onOpen={() => setSensorOpen(z.id)} />)}
              </div>
            </section>
          )}
        </div>
        <div className="space-y-6">
          <IntercomWidget items={intercoms} />
          <AlarmPanel zones={zones} />
          <div className="glass rounded-[28px] p-6" data-testid="events-log">
            <h3 className="font-display text-lg font-semibold mb-3">Attività recente</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {events.map((ev) => {
                const Icon = LEVEL_ICON[ev.level] || Info;
                return (
                  <div key={ev.id} className="flex items-start gap-2 text-xs">
                    <Icon size={14} className={`${LEVEL_CLR[ev.level]} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0"><div className="font-semibold break-words">{ev.source}</div><div className="text-muted">{ev.message}</div></div>
                    <div className="text-[10px] font-mono text-muted shrink-0">{new Date(ev.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                );
              })}
              {events.length === 0 && <div className="text-xs text-muted">Nessun evento.</div>}
            </div>
          </div>
        </div>
      </div>

      <ViewEditor open={editor.open} initialId={editor.id} onClose={() => setEditor((e) => ({ ...e, open: false }))} onSaved={(v) => { if (v) setViewId(v.id); else setViewId("all"); }} />
      <SensorDetail entity={sensorEntity} open={!!sensorEntity} onClose={() => setSensorOpen(null)} />
    </div>
  );
}

function Stat({ label, value, hint, testid, tone }) {
  const cls = tone === "rose" ? "text-rose-600 dark:text-rose-300" : tone === "amber" ? "text-amber-600 dark:text-amber-300" : "";
  return (
    <div className="glass-inner rounded-2xl p-3" data-testid={testid}>
      <div className="label">{label}</div>
      <div className={`font-display text-3xl font-semibold mt-1 ${cls}`}>{value}</div>
      <div className="text-[10px] text-muted">{hint}</div>
    </div>
  );
}
