import { useEffect, useState } from "react";
import { Thermometer, Layers, Gauge, Plus, Save, Trash2, Flame, Snowflake, Clock } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";
import { iconFor, SOFT_COLORS } from "@/lib/icons";

export const PRESETS = [
  { k: "comfort", l: "Comfort" }, { k: "eco", l: "Eco" }, { k: "night", l: "Notte" }, { k: "away", l: "Fuori casa" },
];
const DAYS = ["L", "M", "M", "G", "V", "S", "D"];
const EMPTY_T = { name: "", room_id: null, hvac_type: "heat", on: false, target_temp: 21, preset: "manual", sensor_entity_id: null, actuators: [], hysteresis: 0.4, schedule_enabled: false, schedule: [] };
const EMPTY_Z = { name: "", thermostat_ids: [], color: "#6f8fb0" };
const TABS = [{ k: "thermostats", l: "Termostati", I: Thermometer }, { k: "zones", l: "Zone", I: Layers }, { k: "presets", l: "Preset", I: Gauge }];

export default function ClimateEditor({ open, onClose, tab: initialTab = "thermostats", initialId = null }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  return (
    <Modal open={open} onClose={onClose} title="Gestione clima" subtitle="Termostati virtuali, zone collegate e preset di temperatura" icon={<Thermometer size={18} />} testid="climate-editor" width="max-w-4xl">
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ k, l, I }) => <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? "chip-active" : ""}`} data-testid={`climate-tab-${k}`}><I size={13} /> {l}</button>)}
      </div>
      {tab === "thermostats" && <ThermostatsTab initialId={initialTab === "thermostats" ? initialId : null} open={open} />}
      {tab === "zones" && <ZonesTab initialId={initialTab === "zones" ? initialId : null} open={open} />}
      {tab === "presets" && <PresetsTab />}
    </Modal>
  );
}

function SideList({ items, selected, onSelect, newLabel, testPrefix, icon }) {
  return (
    <div className="space-y-1.5">
      <button onClick={() => onSelect(null)} className={`chip w-full justify-start ${!selected ? "chip-active" : ""}`} data-testid={`${testPrefix}-new`}><Plus size={13} /> {newLabel}</button>
      {items.map((it) => (
        <button key={it.id} onClick={() => onSelect(it.id)} className={`chip w-full justify-start ${selected === it.id ? "chip-active" : ""}`} data-testid={`${testPrefix}-select-${it.id}`}>
          {icon(it)} <span className="truncate">{it.name}</span>
        </button>
      ))}
    </div>
  );
}

function CheckRow({ checked, onClick, icon, title, meta, testid }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition-colors ${checked ? "bg-acc-soft" : "hover:bg-white/40 dark:hover:bg-white/5"}`} data-testid={testid} aria-pressed={checked}>
      <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? "bg-[rgb(var(--acc-strong))] border-transparent" : "border-slate-400/60"}`}>{checked && <span className="w-2 h-2 bg-white rounded-sm" />}</span>
      {icon}
      <span className="flex-1 truncate">{title}</span>
      {meta && <span className="text-[10px] text-muted">{meta}</span>}
    </button>
  );
}

function ThermostatsTab({ initialId, open }) {
  const { thermostats, entities, rooms, createThermostat, updateThermostat, deleteThermostat } = useDomus();
  const [selected, setSelected] = useState(initialId);
  const [form, setForm] = useState(EMPTY_T);
  useEffect(() => { setSelected(initialId); }, [initialId, open]);
  useEffect(() => { const t = thermostats.find((x) => x.id === selected); setForm(t ? { ...EMPTY_T, ...t } : { ...EMPTY_T }); }, [selected, thermostats]);

  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const sensors = entities.filter((e) => e.type === "thermostat" || e.type === "sensor");
  const actuators = entities.filter((e) => ["switch", "plug", "thermostat"].includes(e.type));
  const toggleAct = (id) => set({ actuators: form.actuators.includes(id) ? form.actuators.filter((x) => x !== id) : [...form.actuators, id] });
  const setSched = (i, p) => set({ schedule: form.schedule.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const toggleDay = (i, d) => { const s = form.schedule[i]; setSched(i, { days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort() }); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Inserisci un nome");
    if (!form.sensor_entity_id) return toast.error("Scegli il sensore di riferimento");
    const payload = { name: form.name, room_id: form.room_id, hvac_type: form.hvac_type, on: form.on, target_temp: Number(form.target_temp), preset: form.preset, sensor_entity_id: form.sensor_entity_id, actuators: form.actuators, hysteresis: Number(form.hysteresis), schedule_enabled: form.schedule_enabled, schedule: form.schedule.map((s) => ({ ...s, target: Number(s.target) })) };
    if (selected) await updateThermostat(selected, payload); else await createThermostat(payload);
    toast.success("Termostato salvato");
  };
  const remove = async () => { if (!selected || !window.confirm("Eliminare il termostato virtuale?")) return; await deleteThermostat(selected); setSelected(null); toast.success("Eliminato"); };

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <SideList items={thermostats} selected={selected} onSelect={setSelected} newLabel="Nuovo termostato" testPrefix="thermo" icon={(t) => (t.hvac_type === "cool" ? <Snowflake size={13} /> : <Flame size={13} />)} />
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><div className="label mb-1.5">Nome</div><input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Soggiorno" data-testid="thermo-name" /></label>
          <label className="block"><div className="label mb-1.5">Stanza</div>
            <select className="field" value={form.room_id || ""} onChange={(e) => set({ room_id: e.target.value || null })} data-testid="thermo-room"><option value="">Nessuna</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><div className="label mb-1.5">Tipo</div>
            <div className="flex gap-2">
              <button onClick={() => set({ hvac_type: "heat" })} className={`chip ${form.hvac_type === "heat" ? "chip-active" : ""}`} data-testid="thermo-type-heat"><Flame size={13} /> Caldo</button>
              <button onClick={() => set({ hvac_type: "cool" })} className={`chip ${form.hvac_type === "cool" ? "chip-active" : ""}`} data-testid="thermo-type-cool"><Snowflake size={13} /> Freddo</button>
            </div></div>
          <label className="block"><div className="label mb-1.5">Isteresi (°C)</div><input type="number" step="0.1" min="0.1" max="3" className="field font-mono" value={form.hysteresis} onChange={(e) => set({ hysteresis: e.target.value })} data-testid="thermo-hysteresis" /></label>
        </div>
        <label className="block"><div className="label mb-1.5">Sensore di riferimento (temperatura mostrata e usata per regolare)</div>
          <select className="field" value={form.sensor_entity_id || ""} onChange={(e) => set({ sensor_entity_id: e.target.value || null })} data-testid="thermo-sensor">
            <option value="">Seleziona…</option>{sensors.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.type === "sensor" ? `${s.state?.temperature ?? "--"}°` : `${s.state?.current_temp ?? "--"}°`}</option>)}
          </select></label>
        <div>
          <div className="label mb-1.5">Attuatori comandati ({form.actuators.length})</div>
          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
            {actuators.map((a) => { const AI = iconFor(a.icon); return <CheckRow key={a.id} checked={form.actuators.includes(a.id)} onClick={() => toggleAct(a.id)} icon={<AI size={14} className="text-muted" />} title={a.name} meta={`${rooms.find((r) => r.id === a.room_id)?.name || "—"} · ${a.type}`} testid={`thermo-actuator-${a.id}`} />; })}
          </div>
        </div>
        <div>
          <button onClick={() => set({ schedule_enabled: !form.schedule_enabled })} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between" data-testid="thermo-schedule-toggle">
            <span className="text-sm flex items-center gap-2"><Clock size={14} /> Programmazione oraria settimanale</span>
            <span className={`toggle ${form.schedule_enabled ? "on" : ""}`} />
          </button>
          <div className="mt-2 space-y-2">
            {form.schedule.map((s, i) => (
              <div key={i} className="glass-inner rounded-2xl p-3 flex flex-wrap items-center gap-2" data-testid={`thermo-schedule-row-${i}`}>
                <div className="flex gap-1">{DAYS.map((d, di) => <button key={di} onClick={() => toggleDay(i, di)} className={`w-7 h-7 rounded-full text-[11px] font-semibold ${s.days.includes(di) ? "icon-on" : "icon-off"}`} data-testid={`thermo-schedule-${i}-day-${di}`}>{d}</button>)}</div>
                <input type="time" className="field !w-28 !py-1.5 font-mono text-xs" value={s.start} onChange={(e) => setSched(i, { start: e.target.value })} data-testid={`thermo-schedule-${i}-start`} />
                <span className="text-muted text-xs">→</span>
                <input type="time" className="field !w-28 !py-1.5 font-mono text-xs" value={s.end} onChange={(e) => setSched(i, { end: e.target.value })} data-testid={`thermo-schedule-${i}-end`} />
                <input type="number" step="0.5" className="field !w-20 !py-1.5 font-mono text-xs" value={s.target} onChange={(e) => setSched(i, { target: e.target.value })} data-testid={`thermo-schedule-${i}-target`} />
                <span className="text-muted text-xs">°C</span>
                <button onClick={() => set({ schedule: form.schedule.filter((_, j) => j !== i) })} className="ml-auto btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`thermo-schedule-${i}-remove`} aria-label="Rimuovi fascia"><Trash2 size={12} /></button>
              </div>
            ))}
            <button onClick={() => set({ schedule: [...form.schedule, { days: [0, 1, 2, 3, 4], start: "07:00", end: "22:00", target: form.hvac_type === "cool" ? 25 : 21 }] })} className="chip" data-testid="thermo-schedule-add"><Plus size={13} /> Aggiungi fascia</button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {selected && <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="thermo-delete"><Trash2 size={14} /> Elimina</button>}
          <button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="thermo-save"><Save size={14} /> Salva termostato</button>
        </div>
      </div>
    </div>
  );
}

function ZonesTab({ initialId, open }) {
  const { zones, thermostats, createZone, updateZone, deleteZone } = useDomus();
  const [selected, setSelected] = useState(initialId);
  const [form, setForm] = useState(EMPTY_Z);
  useEffect(() => { setSelected(initialId); }, [initialId, open]);
  useEffect(() => { const z = zones.find((x) => x.id === selected); setForm(z ? { ...EMPTY_Z, ...z } : { ...EMPTY_Z }); }, [selected, zones]);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const toggleT = (id) => set({ thermostat_ids: form.thermostat_ids.includes(id) ? form.thermostat_ids.filter((x) => x !== id) : [...form.thermostat_ids, id] });
  const save = async () => {
    if (!form.name.trim()) return toast.error("Inserisci un nome");
    const payload = { name: form.name, thermostat_ids: form.thermostat_ids, color: form.color };
    if (selected) await updateZone(selected, payload); else { const z = await createZone(payload); setSelected(z.id); }
    toast.success("Zona salvata");
  };
  const remove = async () => { if (!selected || !window.confirm("Eliminare la zona?")) return; await deleteZone(selected); setSelected(null); toast.success("Zona eliminata"); };

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <SideList items={zones} selected={selected} onSelect={setSelected} newLabel="Nuova zona" testPrefix="zone" icon={(z) => <span className="w-2.5 h-2.5 rounded-full" style={{ background: z.color }} />} />
      <div className="space-y-5">
        <label className="block"><div className="label mb-1.5">Nome zona</div><input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Zona giorno" data-testid="zone-name" /></label>
        <div><div className="label mb-1.5">Colore</div>
          <div className="flex gap-1.5 flex-wrap">{SOFT_COLORS.map((c) => <button key={c} onClick={() => set({ color: c })} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-slate-700 dark:border-white scale-110" : "border-white/70"}`} style={{ background: c }} data-testid={`zone-color-${c.slice(1)}`} aria-label={c} />)}</div></div>
        <div>
          <div className="label mb-1.5">Termostati collegati ({form.thermostat_ids.length})</div>
          <p className="text-xs text-muted mb-2">Accendere, spegnere o cambiare temperatura alla zona agisce su tutti i termostati collegati.</p>
          <div className="space-y-1">
            {thermostats.map((t) => <CheckRow key={t.id} checked={form.thermostat_ids.includes(t.id)} onClick={() => toggleT(t.id)} icon={t.hvac_type === "cool" ? <Snowflake size={14} className="text-muted" /> : <Flame size={14} className="text-muted" />} title={t.name} meta={`${t.current_temp != null ? t.current_temp.toFixed(1) : "--"}° · ${t.on ? "acceso" : "spento"}`} testid={`zone-thermo-${t.id}`} />)}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {selected && <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="zone-delete"><Trash2 size={14} /> Elimina</button>}
          <button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="zone-save"><Save size={14} /> Salva zona</button>
        </div>
      </div>
    </div>
  );
}

function PresetsTab() {
  const { settings, updateSettings } = useDomus();
  const [local, setLocal] = useState(settings?.climate_presets || {});
  useEffect(() => { setLocal(settings?.climate_presets || {}); }, [settings]);
  const save = async () => {
    const clean = Object.fromEntries(Object.entries(local).map(([k, v]) => [k, Number(v)]));
    await updateSettings({ climate_presets: clean }); toast.success("Preset aggiornati");
  };
  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted">Le temperature dei preset valgono per tutti i termostati e le zone. Puoi attivarle con un tocco dalle card.</p>
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map((p) => (
          <label key={p.k} className="glass-inner rounded-2xl p-3 block">
            <div className="label mb-1">{p.l}</div>
            <div className="flex items-center gap-2">
              <input type="number" step="0.5" min="5" max="35" className="field font-mono" value={local[p.k] ?? ""} onChange={(e) => setLocal({ ...local, [p.k]: e.target.value })} data-testid={`climate-preset-${p.k}`} />
              <span className="text-sm text-muted">°C</span>
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end"><button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="climate-presets-save"><Save size={14} /> Salva preset</button></div>
    </div>
  );
}
