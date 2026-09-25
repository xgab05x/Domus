import { useEffect, useState } from "react";
import { SlidersHorizontal, Euro, Layers, AlertTriangle, Pencil, Plus } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { iconFor } from "@/lib/icons";
import EnergyChartCard from "@/components/EnergyChartCard";
import EnergyEditor from "@/components/EnergyEditor";
import DeviceBubble from "@/components/DeviceBubble";

const eur = (v) => `${Number(v || 0).toFixed(2).replace(".", ",")} €`;

export default function EnergyPanel({ roomFilter }) {
  const { energy, charts, meters, entities, refreshEnergy, settings } = useDomus();
  const [editor, setEditor] = useState({ open: false, tab: "charts", id: null });
  useEffect(() => { const t = setInterval(() => refreshEnergy().catch(() => {}), 10000); return () => clearInterval(t); }, [refreshEnergy]);

  const matchRoom = (rid) => roomFilter === "all" || (roomFilter === "unassigned" ? !rid : rid === roomFilter);
  const metering = entities.filter((e) => (e.type === "meter" || e.type === "plug") && e.state && "power_w" in e.state && matchRoom(e.room_id));
  const visibleMeters = meters.filter((m) => matchRoom(m.room_id));
  const cost = settings?.energy_cost || {};

  return (
    <div className="space-y-6" data-testid="energy-panel">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Consumi</h2>
          <p className="text-xs text-muted">Misuratori Sonoff POW / POW Ring, misuratori virtuali, grafici e costi · campionamento ogni 10s</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="chip" onClick={() => setEditor({ open: true, tab: "costs", id: null })} data-testid="open-energy-costs"><Euro size={13} /> Costi bolletta</button>
          <button className="chip btn-acc" onClick={() => setEditor({ open: true, tab: "charts", id: null })} data-testid="open-energy-editor"><SlidersHorizontal size={13} /> Gestisci consumi</button>
        </div>
      </div>

      {energy && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" data-testid="energy-summary">
          <Stat label="Potenza istantanea" value={`${Math.round(energy.total_power_w)} W`} hint={`${energy.meters_count} misuratori · ${eur(energy.cost_per_hour_now)}/h`} testid="energy-total-power" />
          <Stat label="Energia ultime 24h" value={`${energy.energy_24h_kwh.toFixed(2)} kWh`} hint={`ultima ora ${energy.energy_1h_kwh.toFixed(2)} kWh`} testid="energy-24h" />
          <Stat label="Costo energia 24h" value={eur(energy.cost_24h)} hint={`${Number(energy.price_kwh).toFixed(3).replace(".", ",")} €/kWh dalla bolletta`} testid="energy-cost-24h" />
          <Stat label="Stima mensile" value={eur(energy.cost_month_total)} hint={`energia ${eur(energy.cost_month_energy)} + fissi ${eur(energy.fixed_total)}${energy.vat_pct ? ` + IVA ${energy.vat_pct}%` : ""}`} testid="energy-cost-month" />
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold">Grafici</h3>
          <button className="chip !py-1" onClick={() => setEditor({ open: true, tab: "charts", id: null })} data-testid="new-chart-btn"><Plus size={13} /> Nuovo grafico</button>
        </div>
        {charts.length === 0 ? (
          <div className="glass rounded-[28px] p-8 text-center text-sm text-muted">Nessun grafico. Creane uno da "Gestisci consumi".</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="charts-grid">
            {charts.map((c) => <EnergyChartCard key={c.id} chart={c} onEdit={() => setEditor({ open: true, tab: "charts", id: c.id })} />)}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold">Misuratori virtuali</h3>
          <button className="chip !py-1" onClick={() => setEditor({ open: true, tab: "meters", id: null })} data-testid="new-meter-btn"><Plus size={13} /> Nuovo misuratore</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="meters-grid">
          {visibleMeters.map((m) => <MeterCard key={m.id} meter={m} onEdit={() => setEditor({ open: true, tab: "meters", id: m.id })} />)}
          {visibleMeters.length === 0 && <div className="glass rounded-[28px] p-6 text-center text-sm text-muted sm:col-span-2 xl:col-span-3">Nessun misuratore virtuale in questa vista.</div>}
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold mb-3">Misuratori singoli</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="metering-grid">
          {metering.map((e) => <DeviceBubble key={e.id} entity={e} />)}
        </div>
      </section>

      <EnergyEditor open={editor.open} tab={editor.tab} initialId={editor.id} onClose={() => setEditor((e) => ({ ...e, open: false }))} costPreview={{ energy, cost }} />
    </div>
  );
}

function Stat({ label, value, hint, testid }) {
  return (
    <div className="glass rounded-[24px] p-4" data-testid={testid}>
      <div className="label">{label}</div>
      <div className="font-display text-2xl font-semibold mt-1 leading-tight">{value}</div>
      <div className="text-[10px] text-muted mt-0.5 truncate">{hint}</div>
    </div>
  );
}

function MeterCard({ meter, onEdit }) {
  const Icon = iconFor(meter.icon, Layers);
  const live = meter.live || {};
  const members = meter.members_live || [];
  return (
    <div className="glass rounded-[28px] p-4 bubble" data-testid={`meter-card-${meter.id}`}>
      <div className="flex items-start gap-3">
        <div className="icon-btn w-11 h-11 shrink-0" style={{ background: `${meter.color}33`, color: meter.color }}><Icon size={19} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{meter.name}</div>
          <div className="label mt-0.5 flex items-center gap-1.5">
            <span>{members.length} misuratori</span>
            {live.offline > 0 && <span className="badge !bg-amber-500/20 !text-amber-800 dark:!text-amber-200 inline-flex items-center gap-1"><AlertTriangle size={9} /> {live.offline} offline</span>}
          </div>
        </div>
        <button onClick={onEdit} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`meter-edit-${meter.id}`} aria-label="Modifica misuratore"><Pencil size={12} /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1" data-testid={`meter-live-${meter.id}`}>
        <div><span className="font-display text-2xl font-semibold">{Math.round(live.power_w || 0)}</span> <span className="text-xs text-muted">W</span></div>
        <div><span className="font-display text-lg font-semibold">{Number(live.current_a || 0).toFixed(2)}</span> <span className="text-xs text-muted">A</span></div>
        <div><span className="font-display text-lg font-semibold">{live.voltage_v != null ? Number(live.voltage_v).toFixed(0) : "--"}</span> <span className="text-xs text-muted">V</span></div>
        <div><span className="font-display text-lg font-semibold">{Number(live.energy_kwh || 0).toFixed(1)}</span> <span className="text-xs text-muted">kWh tot.</span></div>
      </div>
      <div className="mt-3 h-2 rounded-full overflow-hidden flex glass-inner">
        {members.filter((m) => m.power_w > 0).map((m, i) => <div key={m.id} style={{ width: `${m.share_power}%`, background: `hsl(${(i * 47 + 30) % 360} 35% 55%)` }} title={`${m.name} ${m.share_power}%`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {members.map((m) => (
          <span key={m.id} className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${m.on ? "bg-acc-soft text-acc" : "glass-inner text-muted"}`} data-testid={`meter-member-${meter.id}-${m.id}`}>
            {!m.available && <AlertTriangle size={9} className="text-amber-600" />}{m.name} <b className="font-mono">{Math.round(m.power_w)}W</b>
          </span>
        ))}
      </div>
    </div>
  );
}
