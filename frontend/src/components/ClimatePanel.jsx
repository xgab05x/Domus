import { useState } from "react";
import { Power, SlidersHorizontal, Flame, Snowflake, Pencil, Clock, Minus, Plus, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { useDebouncedCommit } from "@/hooks/useDebouncedCommit";
import TempDial, { MODE_COLOR } from "@/components/TempDial";
import ClimateEditor, { PRESETS } from "@/components/ClimateEditor";

export default function ClimatePanel({ roomFilter }) {
  const { thermostats, zones, settings, setAllZones } = useDomus();
  const [editor, setEditor] = useState({ open: false, tab: "thermostats", id: null });
  const visible = thermostats.filter((t) => roomFilter === "all" || (roomFilter === "unassigned" ? !t.room_id : t.room_id === roomFilter));
  const anyOn = thermostats.some((t) => t.on);

  return (
    <div className="space-y-6" data-testid="climate-panel">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Clima</h2>
          <p className="text-xs text-muted">Termostati virtuali, zone e programmazione · simulazione termica attiva</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="chip" onClick={async () => { await setAllZones({ on: !anyOn }); toast.success(anyOn ? "Tutte le zone spente" : "Tutte le zone accese"); }} data-testid="zones-toggle-all">
            <Power size={13} /> {anyOn ? "Spegni tutte le zone" : "Accendi tutte le zone"}
          </button>
          <button className="chip btn-acc" onClick={() => setEditor({ open: true, tab: "thermostats", id: null })} data-testid="open-climate-editor"><SlidersHorizontal size={13} /> Gestisci clima</button>
        </div>
      </div>

      {zones.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="zones-grid">
          {zones.map((z) => <ZoneCard key={z.id} zone={z} presets={settings?.climate_presets} onEdit={() => setEditor({ open: true, tab: "zones", id: z.id })} />)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="thermostats-grid">
        {visible.map((t) => <ThermostatCard key={t.id} t={t} onEdit={() => setEditor({ open: true, tab: "thermostats", id: t.id })} />)}
        {visible.length === 0 && <div className="glass rounded-[28px] p-8 text-center text-sm text-muted md:col-span-2 xl:col-span-3">Nessun termostato in questa vista. Creane uno da "Gestisci clima".</div>}
      </div>

      <ClimateEditor open={editor.open} tab={editor.tab} initialId={editor.id} onClose={() => setEditor((e) => ({ ...e, open: false }))} />
    </div>
  );
}

function ZoneCard({ zone, presets = {}, onEdit }) {
  const { thermostats, setZone } = useDomus();
  const members = zone.thermostat_ids.map((id) => thermostats.find((t) => t.id === id)).filter(Boolean);
  const on = members.some((t) => t.on);
  const temps = members.map((t) => t.current_temp).filter((v) => v != null);
  const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const targets = members.map((t) => t.effective_target ?? t.target_temp);
  const avgTarget = targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : 21;
  const preset = members.length && members.every((t) => t.preset === members[0].preset) ? members[0].preset : null;

  return (
    <div className="glass rounded-[24px] p-4 bubble" data-testid={`zone-card-${zone.id}`}>
      <div className="flex items-start gap-3">
        <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: zone.color }} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{zone.name}</div>
          <div className="text-[10px] text-muted truncate">{members.map((m) => m.name).join(" · ") || "Nessun termostato"}</div>
        </div>
        <button onClick={onEdit} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`zone-edit-${zone.id}`} aria-label="Modifica zona"><Pencil size={12} /></button>
        <button onClick={() => setZone(zone.id, { on: !on })} className={`toggle ${on ? "on" : ""}`} data-testid={`zone-toggle-${zone.id}`} aria-label="Accendi zona" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-muted">Media <b className="font-display text-base text-foreground">{avg != null ? avg.toFixed(1) : "--"}°</b></div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZone(zone.id, { target_temp: Math.round((avgTarget - 0.5) * 2) / 2 })} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center" data-testid={`zone-minus-${zone.id}`} aria-label="Diminuisci"><Minus size={12} /></button>
          <span className="font-mono text-sm w-12 text-center" data-testid={`zone-target-${zone.id}`}>{avgTarget.toFixed(1)}°</span>
          <button onClick={() => setZone(zone.id, { target_temp: Math.round((avgTarget + 0.5) * 2) / 2 })} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center" data-testid={`zone-plus-${zone.id}`} aria-label="Aumenta"><Plus size={12} /></button>
        </div>
      </div>
      <div className="mt-3 flex gap-1 flex-wrap">
        {PRESETS.map((p) => (
          <button key={p.k} onClick={() => setZone(zone.id, { preset: p.k })} className={`chip !py-0.5 !px-2 !text-[10px] ${preset === p.k ? "chip-active" : ""}`} data-testid={`zone-preset-${zone.id}-${p.k}`}>
            {p.l} {presets[p.k] != null && <span className="font-mono opacity-70">{presets[p.k]}°</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThermostatCard({ t, onEdit }) {
  const { entities, rooms, settings, updateThermostat } = useDomus();
  const presets = settings?.climate_presets || {};
  const shown = t.effective_target ?? t.target_temp;
  const [target, setTarget] = useDebouncedCommit(shown, (v) => updateThermostat(t.id, { target_temp: v, preset: "manual" }), 300);
  const heat = t.hvac_type !== "cool";
  const color = MODE_COLOR[t.hvac_type] || MODE_COLOR.heat;
  const room = rooms.find((r) => r.id === t.room_id);
  const sensor = entities.find((e) => e.id === t.sensor_entity_id);
  const acts = t.actuators.map((id) => entities.find((e) => e.id === id)).filter(Boolean);
  const scheduleActive = t.schedule_enabled;

  return (
    <div className="glass rounded-[28px] p-5 bubble" data-testid={`thermostat-card-${t.id}`}>
      <div className="flex items-start gap-3">
        <div className="icon-btn w-11 h-11 shrink-0" style={{ background: `${color}33`, color }}>{heat ? <Flame size={19} /> : <Snowflake size={19} />}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{t.name}</div>
          <div className="label mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{room?.name || "Nessuna stanza"}</span>
            <span className="badge">{heat ? "Caldo" : "Freddo"}</span>
            {scheduleActive && <span className="badge inline-flex items-center gap-1"><Clock size={9} /> programma</span>}
          </div>
        </div>
        <button onClick={onEdit} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`thermostat-edit-${t.id}`} aria-label="Modifica termostato"><Pencil size={12} /></button>
        <button onClick={() => updateThermostat(t.id, { on: !t.on })} className={`toggle ${t.on ? "on" : ""}`} data-testid={`thermostat-toggle-${t.id}`} aria-label="Accendi termostato" />
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button onClick={() => setTarget(Math.max(10, Math.round((target - 0.5) * 2) / 2))} className="btn-ghost w-9 h-9 rounded-full flex items-center justify-center" data-testid={`thermostat-minus-${t.id}`} aria-label="Diminuisci"><Minus size={14} /></button>
        <TempDial size={176} value={target} current={t.current_temp} mode={t.hvac_type} active={t.on && t.demand} disabled={!t.on} onChange={setTarget} testid={`thermostat-dial-${t.id}`} />
        <button onClick={() => setTarget(Math.min(30, Math.round((target + 0.5) * 2) / 2))} className="btn-ghost w-9 h-9 rounded-full flex items-center justify-center" data-testid={`thermostat-plus-${t.id}`} aria-label="Aumenta"><Plus size={14} /></button>
      </div>

      <div className="text-center text-xs mt-1" data-testid={`thermostat-status-${t.id}`}>
        {!t.on ? <span className="text-muted">Spento</span> : t.demand ? <span style={{ color }} className="font-semibold">{heat ? "Riscaldamento attivo" : "Raffrescamento attivo"}</span> : <span className="text-muted">In attesa · temperatura raggiunta</span>}
      </div>

      <div className="mt-3 flex gap-1 flex-wrap justify-center">
        <button onClick={() => updateThermostat(t.id, { preset: "manual" })} className={`chip !py-0.5 !px-2 !text-[10px] ${t.preset === "manual" ? "chip-active" : ""}`} data-testid={`thermostat-preset-${t.id}-manual`}>Manuale</button>
        {PRESETS.map((p) => (
          <button key={p.k} onClick={() => updateThermostat(t.id, { preset: p.k })} className={`chip !py-0.5 !px-2 !text-[10px] ${t.preset === p.k ? "chip-active" : ""}`} data-testid={`thermostat-preset-${t.id}-${p.k}`}>
            {p.l} <span className="font-mono opacity-70">{presets[p.k]}°</span>
          </button>
        ))}
      </div>

      <div className="mt-4 divider pt-3 space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted"><Thermometer size={11} /> Sensore: <span className="text-foreground font-medium truncate">{sensor?.name || "—"}</span></div>
        <div className="flex flex-wrap gap-1.5">
          {acts.map((a) => (
            <span key={a.id} className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${a.state?.on ? "bg-acc-soft text-acc" : "glass-inner text-muted"}`} data-testid={`actuator-${t.id}-${a.id}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${a.state?.on ? "bg-emerald-500" : "bg-slate-400"}`} /> {a.name}
            </span>
          ))}
          {acts.length === 0 && <span className="text-muted">Nessun attuatore collegato</span>}
        </div>
      </div>
    </div>
  );
}
