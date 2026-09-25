import { useEffect, useState } from "react";
import { AlertTriangle, WifiOff, BatteryLow, CheckCircle2, RefreshCw, Plug } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { ProblemsAPI } from "@/lib/api";
import { iconFor } from "@/lib/icons";
import { fmtTime } from "@/lib/security";

// Health overview: offline devices, low batteries, unread warnings, HA link state.
export default function ProblemsSection() {
  const { setAvailability, markNotificationsRead, settings, updateSettings } = useDomus();
  const [data, setData] = useState(null);
  const load = async () => { try { setData(await ProblemsAPI.list()); } catch { /* ignore */ } };
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const total = data ? data.offline.length + data.low_battery.length + data.warnings.length + (settings?.ha_enabled && !data.ha.connected ? 1 : 0) : 0;
  return (
    <div className="space-y-4" data-testid="problems-section">
      <div className={`rounded-3xl p-4 flex items-center gap-3 ${total ? "bg-amber-500/10 ring-1 ring-amber-400/40" : "bg-emerald-500/10 ring-1 ring-emerald-400/40"}`} data-testid="problems-summary">
        <div className={`icon-btn w-11 h-11 shrink-0 text-white ${total ? "bg-amber-500/80" : "bg-emerald-500/80"}`}>{total ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</div>
        <div className="flex-1"><div className="font-semibold text-sm" data-testid="problems-count">{total ? `${total} problemi da verificare` : "Tutto funziona correttamente"}</div><div className="text-xs text-muted">Dispositivi offline, batterie scariche, avvisi e collegamento Home Assistant.</div></div>
        <button onClick={load} className="chip shrink-0" data-testid="problems-refresh"><RefreshCw size={13} /></button>
      </div>

      <button onClick={() => updateSettings({ offline_simulation: !settings.offline_simulation })} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between" data-testid="offline-simulation-toggle">
        <span className="text-sm">Simula guasti casuali in modalità demo</span><span className={`toggle ${settings?.offline_simulation ? "on" : ""}`} />
      </button>
      <button onClick={() => updateSettings({ show_online_status: !settings.show_online_status })} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between" data-testid="show-online-toggle">
        <span className="text-sm">Mostra pallino online/offline sulle bubble</span><span className={`toggle ${settings?.show_online_status ? "on" : ""}`} />
      </button>

      {settings?.ha_enabled && data && !data.ha.connected && (
        <Row icon={<Plug size={15} />} tone="amber" title="Home Assistant non raggiungibile" sub={data.ha.last_error || "modalità demo attiva"} testid="problem-ha" />
      )}
      <Group title={`Offline (${data?.offline.length ?? 0})`} testid="problems-offline">
        {(data?.offline || []).map((e) => { const I = iconFor(e.icon); return (
          <Row key={e.id} icon={<I size={15} />} tone="amber" title={e.name} sub={`${e.integration} · dall'ultimo contatto ${fmtTime(e.last_seen)}`} testid={`problem-offline-${e.id}`}
            action={<button onClick={async () => { await setAvailability(e.id, true); load(); }} className="chip !py-1 !text-[11px]" data-testid={`problem-retry-${e.id}`}><WifiOff size={11} /> Segna online</button>} />
        ); })}
      </Group>
      <Group title={`Batteria bassa (${data?.low_battery.length ?? 0})`} testid="problems-battery">
        {(data?.low_battery || []).map((e) => { const I = iconFor(e.icon); return <Row key={e.id} icon={<I size={15} />} tone="rose" title={e.name} sub={`${Math.round(e.state.battery)}% · sostituire presto`} testid={`problem-battery-${e.id}`} badge={<BatteryLow size={13} className="text-rose-600" />} />; })}
      </Group>
      <Group title={`Avvisi non letti (${data?.warnings.length ?? 0})`} testid="problems-warnings" action={data?.warnings.length ? <button onClick={async () => { await markNotificationsRead(); load(); }} className="text-[11px] text-acc font-semibold" data-testid="problems-read-all">segna letti</button> : null}>
        {(data?.warnings || []).map((n) => <Row key={n.id} icon={<AlertTriangle size={15} />} tone={n.level === "error" ? "rose" : "amber"} title={n.title} sub={`${n.message || ""} · ${fmtTime(n.ts)}`} testid={`problem-warning-${n.id}`} />)}
      </Group>
    </div>
  );
}

function Group({ title, children, action, testid }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div data-testid={testid}>
      <div className="flex items-center justify-between mb-1.5"><div className="label">{title}</div>{action}</div>
      <div className="space-y-1.5">{items.length ? items : <div className="text-xs text-muted px-1">Nessuno.</div>}</div>
    </div>
  );
}

function Row({ icon, tone, title, sub, action, badge, testid }) {
  const t = tone === "rose" ? "bg-rose-500/80" : "bg-amber-500/80";
  return (
    <div className="glass-inner rounded-2xl px-3 py-2 flex items-center gap-3" data-testid={testid}>
      <div className={`icon-btn w-8 h-8 shrink-0 text-white ${t}`}>{icon}</div>
      <div className="flex-1 min-w-0"><div className="text-sm font-semibold break-words">{title}</div><div className="text-[11px] text-muted truncate">{sub}</div></div>
      {badge}{action}
    </div>
  );
}
