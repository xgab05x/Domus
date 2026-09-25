import { useEffect, useState } from "react";
import { Zap, Layers, BarChart3, Euro, Plus, Save, Trash2, Gauge } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import IconPicker, { IconButton } from "@/components/IconPicker";
import { useDomus } from "@/context/DomusContext";
import { iconFor, SOFT_COLORS } from "@/lib/icons";
import { METRICS, RANGE_LABEL, CHART_TYPE_LABEL } from "@/components/EnergyChartCard";

const TABS = [{ k: "meters", l: "Misuratori virtuali", I: Layers }, { k: "charts", l: "Grafici", I: BarChart3 }, { k: "costs", l: "Costi bolletta", I: Euro }];
const EMPTY_M = { name: "", room_id: null, members: [], voltage_mode: "avg", icon: "gauge", color: "#b08e54" };
const EMPTY_C = { title: "", source_kind: "meter", source_id: "", chart_type: "line", metrics: ["power_w"], range: "1h", size: "md", share_basis: "power" };

export default function EnergyEditor({ open, onClose, tab: initialTab = "charts", initialId = null, costPreview }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  return (
    <Modal open={open} onClose={onClose} title="Gestione consumi" subtitle="Misuratori virtuali, grafici personalizzati e costi dalla bolletta" icon={<Zap size={18} />} testid="energy-editor" width="max-w-4xl">
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ k, l, I }) => <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? "chip-active" : ""}`} data-testid={`energy-tab-${k}`}><I size={13} /> {l}</button>)}
      </div>
      {tab === "meters" && <MetersTab initialId={initialTab === "meters" ? initialId : null} open={open} />}
      {tab === "charts" && <ChartsTab initialId={initialTab === "charts" ? initialId : null} open={open} />}
      {tab === "costs" && <CostsTab preview={costPreview} />}
    </Modal>
  );
}

function SideList({ items, selected, onSelect, newLabel, testPrefix, icon }) {
  return (
    <div className="space-y-1.5">
      <button onClick={() => onSelect(null)} className={`chip w-full justify-start ${!selected ? "chip-active" : ""}`} data-testid={`${testPrefix}-new`}><Plus size={13} /> {newLabel}</button>
      {items.map((it) => (
        <button key={it.id} onClick={() => onSelect(it.id)} className={`chip w-full justify-start ${selected === it.id ? "chip-active" : ""}`} data-testid={`${testPrefix}-select-${it.id}`}>
          {icon(it)} <span className="truncate">{it.name || it.title}</span>
        </button>
      ))}
    </div>
  );
}

function Check({ checked, onClick, icon, title, meta, testid }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition-colors ${checked ? "bg-acc-soft" : "hover:bg-white/40 dark:hover:bg-white/5"}`} data-testid={testid} aria-pressed={checked}>
      <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? "bg-[rgb(var(--acc-strong))] border-transparent" : "border-slate-400/60"}`}>{checked && <span className="w-2 h-2 bg-white rounded-sm" />}</span>
      {icon}<span className="flex-1 truncate">{title}</span>{meta && <span className="text-[10px] text-muted">{meta}</span>}
    </button>
  );
}

const Footer = ({ selected, onDelete, onSave, saveLabel, prefix }) => (
  <div className="flex justify-end gap-2 pt-2">
    {selected && <button onClick={onDelete} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid={`${prefix}-delete`}><Trash2 size={14} /> Elimina</button>}
    <button onClick={onSave} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid={`${prefix}-save`}><Save size={14} /> {saveLabel}</button>
  </div>
);

function MetersTab({ initialId, open }) {
  const { meters, entities, rooms, createMeter, updateMeter, deleteMeter } = useDomus();
  const [selected, setSelected] = useState(initialId);
  const [form, setForm] = useState(EMPTY_M);
  const [picker, setPicker] = useState(false);
  useEffect(() => { setSelected(initialId); }, [initialId, open]);
  useEffect(() => { const m = meters.find((x) => x.id === selected); setForm(m ? { ...EMPTY_M, ...m } : { ...EMPTY_M }); }, [selected, meters]);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const candidates = entities.filter((e) => (e.type === "meter" || e.type === "plug") && e.state && "power_w" in e.state);
  const toggleMember = (id) => set({ members: form.members.includes(id) ? form.members.filter((x) => x !== id) : [...form.members, id] });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Inserisci un nome");
    if (!form.members.length) return toast.error("Seleziona almeno un misuratore");
    const payload = { name: form.name, room_id: form.room_id, members: form.members, voltage_mode: form.voltage_mode, icon: form.icon, color: form.color };
    if (selected) await updateMeter(selected, payload); else await createMeter(payload);
    toast.success("Misuratore salvato");
  };
  const remove = async () => { if (!selected || !window.confirm("Eliminare il misuratore virtuale e i suoi grafici?")) return; await deleteMeter(selected); setSelected(null); toast.success("Eliminato"); };

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <SideList items={meters} selected={selected} onSelect={setSelected} newLabel="Nuovo misuratore" testPrefix="vmeter" icon={(m) => { const I = iconFor(m.icon, Gauge); return <I size={13} />; }} />
      <div className="space-y-5">
        <div className="flex items-end gap-3">
          <div><div className="label mb-1.5">Icona</div><IconButton value={form.icon} onClick={() => setPicker(true)} testid="vmeter-icon" /></div>
          <label className="block flex-1"><div className="label mb-1.5">Nome</div><input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Lavanderia" data-testid="vmeter-name" /></label>
          <label className="block flex-1"><div className="label mb-1.5">Stanza</div>
            <select className="field" value={form.room_id || ""} onChange={(e) => set({ room_id: e.target.value || null })} data-testid="vmeter-room"><option value="">Nessuna</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><div className="label mb-1.5">Colore</div>
            <div className="flex gap-1.5 flex-wrap pt-1">{SOFT_COLORS.map((c) => <button key={c} onClick={() => set({ color: c })} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-slate-700 dark:border-white scale-110" : "border-white/70"}`} style={{ background: c }} data-testid={`vmeter-color-${c.slice(1)}`} aria-label={c} />)}</div></div>
          <label className="block"><div className="label mb-1.5">Tensione mostrata</div>
            <select className="field" value={form.voltage_mode} onChange={(e) => set({ voltage_mode: e.target.value })} data-testid="vmeter-voltage-mode">
              <option value="avg">Media dei membri</option><option value="max">Massima tra i membri</option>
              {form.members.map((id) => { const e = entities.find((x) => x.id === id); return e ? <option key={id} value={id}>Da: {e.name}</option> : null; })}
            </select></label>
        </div>
        <div>
          <div className="label mb-1.5">Misuratori sommati ({form.members.length}) · W e A vengono sommati</div>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {candidates.map((e) => { const I = iconFor(e.icon); return <Check key={e.id} checked={form.members.includes(e.id)} onClick={() => toggleMember(e.id)} icon={<I size={14} className="text-muted" />} title={e.name} meta={`${Math.round(e.state.power_w)} W · ${rooms.find((r) => r.id === e.room_id)?.name || "—"}`} testid={`vmeter-member-${e.id}`} />; })}
          </div>
        </div>
        <Footer selected={selected} onDelete={remove} onSave={save} saveLabel="Salva misuratore" prefix="vmeter" />
      </div>
      <IconPicker open={picker} onClose={() => setPicker(false)} value={form.icon} onChange={(icon) => set({ icon })} />
    </div>
  );
}

function ChartsTab({ initialId, open }) {
  const { charts, meters, entities, createChart, updateChart, deleteChart } = useDomus();
  const [selected, setSelected] = useState(initialId);
  const [form, setForm] = useState(EMPTY_C);
  useEffect(() => { setSelected(initialId); }, [initialId, open]);
  useEffect(() => { const c = charts.find((x) => x.id === selected); setForm(c ? { ...EMPTY_C, ...c } : { ...EMPTY_C, source_id: meters[0]?.id || "" }); }, [selected, charts, meters]);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const singles = entities.filter((e) => (e.type === "meter" || e.type === "plug") && e.state && "power_w" in e.state);
  const isMeter = form.source_kind === "meter";
  const toggleMetric = (k) => set({ metrics: form.metrics.includes(k) ? form.metrics.filter((x) => x !== k) : [...form.metrics, k] });
  const onSource = (v) => { const [kind, id] = v.split(":"); set({ source_kind: kind, source_id: id, chart_type: kind === "entity" && form.chart_type !== "line" ? "line" : form.chart_type }); };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Inserisci un titolo");
    if (!form.source_id) return toast.error("Scegli una sorgente");
    if (!form.metrics.length) return toast.error("Seleziona almeno un parametro");
    const payload = { title: form.title, source_kind: form.source_kind, source_id: form.source_id, chart_type: form.chart_type, metrics: form.metrics, range: form.range, size: form.size, share_basis: form.share_basis };
    if (selected) await updateChart(selected, payload); else { const c = await createChart(payload); setSelected(c.id); }
    toast.success("Grafico salvato");
  };
  const remove = async () => { if (!selected || !window.confirm("Eliminare il grafico?")) return; await deleteChart(selected); setSelected(null); toast.success("Grafico eliminato"); };

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <SideList items={charts} selected={selected} onSelect={setSelected} newLabel="Nuovo grafico" testPrefix="chart" icon={() => <BarChart3 size={13} />} />
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><div className="label mb-1.5">Titolo</div><input className="field" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Es. Consumo lavanderia" data-testid="chart-title" /></label>
          <label className="block"><div className="label mb-1.5">Sorgente</div>
            <select className="field" value={form.source_id ? `${form.source_kind}:${form.source_id}` : ""} onChange={(e) => onSource(e.target.value)} data-testid="chart-source">
              <option value="">Seleziona…</option>
              <optgroup label="Misuratori virtuali">{meters.map((m) => <option key={m.id} value={`meter:${m.id}`}>{m.name} ({m.members.length})</option>)}</optgroup>
              <optgroup label="Misuratori singoli">{singles.map((e) => <option key={e.id} value={`entity:${e.id}`}>{e.name}</option>)}</optgroup>
            </select></label>
        </div>
        <div>
          <div className="label mb-1.5">Tipo di grafico</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CHART_TYPE_LABEL).map(([k, l]) => {
              const disabled = k !== "line" && !isMeter;
              return <button key={k} disabled={disabled} onClick={() => set({ chart_type: k })} className={`chip ${form.chart_type === k ? "chip-active" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`} data-testid={`chart-type-${k}`}>{l}</button>;
            })}
          </div>
          {!isMeter && <p className="text-xs text-muted mt-1.5">Anello, radiale e barre mostrano la ripartizione tra i membri: disponibili solo per i misuratori virtuali.</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="label mb-1.5">Parametri mostrati</div>
            <div className="space-y-1">
              {Object.entries(METRICS).map(([k, m]) => <Check key={k} checked={form.metrics.includes(k)} onClick={() => toggleMetric(k)} icon={<span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />} title={`${m.label} (${m.unit})`} testid={`chart-metric-${k}`} />)}
            </div>
          </div>
          <div className="space-y-4">
            <div><div className="label mb-1.5">Intervallo</div>
              <div className="flex gap-2">{Object.entries(RANGE_LABEL).map(([k, l]) => <button key={k} onClick={() => set({ range: k })} className={`chip ${form.range === k ? "chip-active" : ""}`} data-testid={`chart-range-${k}`}>{l}</button>)}</div></div>
            <div><div className="label mb-1.5">Dimensione card</div>
              <div className="flex gap-2">{[["sm", "Piccola"], ["md", "Media"], ["lg", "Grande"]].map(([k, l]) => <button key={k} onClick={() => set({ size: k })} className={`chip ${form.size === k ? "chip-active" : ""}`} data-testid={`chart-size-${k}`}>{l}</button>)}</div></div>
            {form.chart_type !== "line" && (
              <div><div className="label mb-1.5">Percentuali calcolate su</div>
                <div className="flex gap-2">
                  <button onClick={() => set({ share_basis: "power" })} className={`chip ${form.share_basis === "power" ? "chip-active" : ""}`} data-testid="chart-basis-power">Assorbimento (W) istantaneo</button>
                  <button onClick={() => set({ share_basis: "energy" })} className={`chip ${form.share_basis === "energy" ? "chip-active" : ""}`} data-testid="chart-basis-energy">Energia (kWh) nell'intervallo</button>
                </div></div>
            )}
          </div>
        </div>
        <Footer selected={selected} onDelete={remove} onSave={save} saveLabel="Salva grafico" prefix="chart" />
      </div>
    </div>
  );
}

function CostsTab({ preview }) {
  const { settings, updateSettings, refreshEnergy } = useDomus();
  const [cost, setCost] = useState(settings?.energy_cost || { price_kwh: 0.28, vat_pct: 10, fixed_costs: [] });
  useEffect(() => { if (settings?.energy_cost) setCost(settings.energy_cost); }, [settings]);
  const setFixed = (i, p) => setCost((c) => ({ ...c, fixed_costs: c.fixed_costs.map((f, j) => (j === i ? { ...f, ...p } : f)) }));
  const save = async () => {
    const clean = { price_kwh: Number(cost.price_kwh) || 0, vat_pct: Number(cost.vat_pct) || 0, fixed_costs: (cost.fixed_costs || []).filter((f) => f.name?.trim()).map((f) => ({ name: f.name.trim(), amount: Number(f.amount) || 0 })) };
    await updateSettings({ energy_cost: clean }); await refreshEnergy(); toast.success("Costi aggiornati");
  };
  const fixedTotal = (cost.fixed_costs || []).reduce((a, f) => a + (Number(f.amount) || 0), 0);
  const e = preview?.energy;

  return (
    <div className="grid md:grid-cols-[1fr_260px] gap-6">
      <div className="space-y-5">
        <p className="text-sm text-muted">Copia i valori dalla tua bolletta: prezzo dell'energia al kWh, IVA e le voci fisse mensili (quota contatore, trasporto e gestione, oneri…). Servono per la stima realistica dei costi.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><div className="label mb-1.5">Prezzo energia (€/kWh)</div><input type="number" step="0.001" min="0" className="field font-mono" value={cost.price_kwh ?? ""} onChange={(ev) => setCost({ ...cost, price_kwh: ev.target.value })} data-testid="cost-price-kwh" /></label>
          <label className="block"><div className="label mb-1.5">IVA (%)</div><input type="number" step="1" min="0" className="field font-mono" value={cost.vat_pct ?? ""} onChange={(ev) => setCost({ ...cost, vat_pct: ev.target.value })} data-testid="cost-vat" /></label>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5"><div className="label">Costi fissi mensili</div><span className="text-xs text-muted font-mono">{fixedTotal.toFixed(2)} €/mese</span></div>
          <div className="space-y-2">
            {(cost.fixed_costs || []).map((f, i) => (
              <div key={i} className="flex items-center gap-2" data-testid={`cost-fixed-row-${i}`}>
                <input className="field flex-1" placeholder="Es. Quota fissa contatore" value={f.name} onChange={(ev) => setFixed(i, { name: ev.target.value })} data-testid={`cost-fixed-name-${i}`} />
                <input type="number" step="0.01" className="field !w-28 font-mono" value={f.amount} onChange={(ev) => setFixed(i, { amount: ev.target.value })} data-testid={`cost-fixed-amount-${i}`} />
                <span className="text-xs text-muted">€/mese</span>
                <button onClick={() => setCost({ ...cost, fixed_costs: cost.fixed_costs.filter((_, j) => j !== i) })} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" data-testid={`cost-fixed-remove-${i}`} aria-label="Rimuovi"><Trash2 size={13} /></button>
              </div>
            ))}
            <button onClick={() => setCost({ ...cost, fixed_costs: [...(cost.fixed_costs || []), { name: "", amount: 0 }] })} className="chip" data-testid="cost-fixed-add"><Plus size={13} /> Aggiungi voce fissa</button>
          </div>
        </div>
        <div className="flex justify-end"><button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="cost-save"><Save size={14} /> Salva costi</button></div>
      </div>
      <div className="glass-inner rounded-2xl p-4 text-sm space-y-2 self-start" data-testid="cost-preview">
        <div className="label">Anteprima stima</div>
        {e ? (<>
          <Row l="Energia 24h" v={`${e.energy_24h_kwh.toFixed(2)} kWh`} />
          <Row l="Costo energia 24h" v={`${e.cost_24h.toFixed(2)} €`} />
          <Row l="Energia / mese" v={`${e.cost_month_energy.toFixed(2)} €`} />
          <Row l="Costi fissi" v={`${e.fixed_total.toFixed(2)} €`} />
          <Row l={`IVA ${e.vat_pct}%`} v="" />
          <div className="divider pt-2 flex justify-between font-semibold"><span>Totale stimato / mese</span><span className="font-mono">{e.cost_month_total.toFixed(2)} €</span></div>
        </>) : <div className="text-muted text-xs">Nessun dato.</div>}
        <p className="text-[10px] text-muted pt-1">La stima proietta il consumo delle ultime 24h su 30 giorni.</p>
      </div>
    </div>
  );
}
const Row = ({ l, v }) => <div className="flex justify-between text-xs"><span className="text-muted">{l}</span><span className="font-mono">{v}</span></div>;
