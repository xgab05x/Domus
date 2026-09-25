import { useEffect, useState } from "react";
import { Radar, Save, Trash2, Zap, BatteryMedium, Wifi, Clock, ShieldOff, Link2, Cpu } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import IconPicker, { IconButton } from "@/components/IconPicker";
import { useDomus } from "@/context/DomusContext";
import { CamerasAPI } from "@/lib/api";
import { KIND_LABEL, KIND_ICON, zoneStatus, TONE, batteryTone, fmtTime } from "@/lib/security";

// Detail + editor modal for alarm zones and sensors: state, history, rename, kind, room, icon, bypass.
export default function SensorDetail({ entity, open, onClose }) {
  const { rooms, events, updateEntity, deleteEntity, reloadEvents, views, updateView } = useDomus();
  const [name, setName] = useState(entity?.name || "");
  const [picker, setPicker] = useState(false);
  useEffect(() => { setName(entity?.name || ""); }, [entity?.id, entity?.name, open]);
  if (!open || !entity) return null;

  const s = entity.state || {};
  const isZone = entity.type === "alarm_zone";
  const kind = s.kind || "contact";
  const st = zoneStatus(entity);
  const history = events.filter((ev) => ev.source === entity.name).slice(0, 20);
  const myViews = views.filter((v) => v.members.includes(entity.id));

  const saveName = async () => {
    if (!name.trim() || name.trim() === entity.name) return;
    await updateEntity(entity.id, { name: name.trim() });
    toast.success("Nome aggiornato");
  };
  const simulate = async () => { await CamerasAPI.simulateMotion(entity.id); await reloadEvents(); toast.warning(`${entity.name}: attivazione simulata`); };
  const remove = async () => {
    if (!window.confirm(`Eliminare "${entity.name}"?`)) return;
    await deleteEntity(entity.id); onClose(); toast.success("Sensore eliminato");
  };
  const toggleInView = async (v) => {
    const members = v.members.includes(entity.id) ? v.members.filter((m) => m !== entity.id) : [...v.members, entity.id];
    await updateView(v.id, { members });
  };

  return (
    <Modal open={open} onClose={onClose} title={entity.name} subtitle={isZone ? KIND_LABEL[kind] || kind : "Sensore ambientale"} icon={<Radar size={18} />} testid="sensor-detail" width="max-w-3xl"
      footer={<>
        <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="sensor-delete"><Trash2 size={14} /> Elimina</button>
        <button onClick={onClose} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold" data-testid="sensor-done">Fatto</button>
      </>}>
      <div className="grid md:grid-cols-[1fr_260px] gap-6">
        <div className="space-y-5">
          <div className={`rounded-3xl p-5 flex items-center justify-between gap-4 ${s.triggered ? "bg-rose-500/10 ring-1 ring-rose-400/40" : "glass-inner"}`} data-testid="sensor-state-hero">
            <div>
              <div className="label">Stato attuale</div>
              <div className="font-display text-3xl font-semibold mt-1" data-testid="sensor-state-label">{st.label}</div>
              <div className="text-xs text-muted mt-1">Ultimo evento: <span className="font-mono">{fmtTime(s.last_triggered)}</span></div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              {isZone && (
                <button onClick={() => updateEntity(entity.id, { state: { bypass: !s.bypass } })} className={`chip ${s.bypass ? "chip-active" : ""}`} data-testid="sensor-bypass"><ShieldOff size={13} /> {s.bypass ? "In bypass" : "Metti in bypass"}</button>
              )}
              <button onClick={simulate} className="chip" data-testid="sensor-simulate"><Zap size={13} /> Simula attivazione</button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat icon={<BatteryMedium size={13} />} label="Batteria" value={s.battery != null ? `${Math.round(s.battery)}%` : "—"} tone={batteryTone(s.battery)} testid="sensor-battery" />
            <Stat icon={<Wifi size={13} />} label="Segnale" value={s.signal != null ? `${Math.round(s.signal)}%` : "—"} tone={s.signal != null && s.signal < 50 ? "amber" : "slate"} />
            <Stat icon={<Clock size={13} />} label="Manomissione" value={s.tamper ? "Sì" : "No"} tone={s.tamper ? "rose" : "emerald"} />
            <Stat icon={<Link2 size={13} />} label="Integrazione" value={entity.integration} tone="slate" />
          </div>
          {s.temperature != null && <div className="text-sm text-muted">Temperatura <b className="text-foreground">{Number(s.temperature).toFixed(1)}°C</b>{s.humidity != null && <> · umidità <b className="text-foreground">{s.humidity}%</b></>}</div>}
          {entity.ha_entity_id && <div className="text-xs text-muted flex items-center gap-1.5"><Cpu size={12} /> Home Assistant: <span className="font-mono">{entity.ha_entity_id}</span></div>}

          <div>
            <div className="label mb-2">Cronologia</div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1" data-testid="sensor-history">
              {history.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-xs glass-inner rounded-xl px-3 py-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${ev.level === "warning" ? "bg-amber-500" : ev.level === "alert" ? "bg-rose-500" : "bg-emerald-500"}`} />
                  <span className="flex-1">{ev.message}</span>
                  <span className="font-mono text-muted">{new Date(ev.timestamp).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
              {history.length === 0 && <div className="text-xs text-muted py-3">Nessun evento registrato per questo sensore.</div>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">Nome</div>
            <div className="flex gap-2 items-center">
              <IconButton value={entity.icon} onClick={() => setPicker(true)} testid="sensor-icon-btn" />
              <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()} data-testid="sensor-name-input" />
            </div>
          </div>
          {isZone && (
            <div>
              <div className="label mb-1.5">Tipo sensore</div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(KIND_LABEL).map(([k, l]) => { const KI = KIND_ICON[k]; return (
                  <button key={k} onClick={() => updateEntity(entity.id, { state: { kind: k } })} className={`chip !justify-start !text-[11px] ${kind === k ? "chip-active" : ""}`} data-testid={`sensor-kind-${k}`}><KI size={12} /> <span className="truncate">{l.split(" ")[0]}</span></button>
                ); })}
              </div>
            </div>
          )}
          <div>
            <div className="label mb-1.5">Stanza / zona casa</div>
            <select className="field" value={entity.room_id || ""} onChange={(e) => updateEntity(entity.id, { room_id: e.target.value || null }).then(() => toast.success("Stanza aggiornata"))} data-testid="sensor-room">
              <option value="">Nessuna</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1.5">Viste Terminus</div>
            <div className="space-y-1">
              {views.map((v) => (
                <button key={v.id} onClick={() => toggleInView(v)} className={`w-full chip !justify-start ${v.members.includes(entity.id) ? "chip-active" : ""}`} data-testid={`sensor-view-${v.id}`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: v.color }} /> <span className="truncate">{v.name}</span>
                </button>
              ))}
              {views.length === 0 && <div className="text-xs text-muted">Nessuna vista creata.</div>}
              {myViews.length > 0 && <div className="text-[10px] text-muted mt-1">In {myViews.length} vista/e</div>}
            </div>
          </div>
          <button onClick={saveName} className="w-full btn-acc px-4 py-2 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="sensor-save"><Save size={14} /> Salva nome</button>
        </div>
      </div>
      <IconPicker open={picker} onClose={() => setPicker(false)} value={entity.icon} onChange={async (icon) => { await updateEntity(entity.id, { icon }); toast.success("Icona aggiornata"); }} title={`Icona per ${entity.name}`} />
    </Modal>
  );
}

function Stat({ icon, label, value, tone = "slate", testid }) {
  return (
    <div className="glass-inner rounded-2xl p-3" data-testid={testid}>
      <div className="label flex items-center gap-1">{icon} {label}</div>
      <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${TONE[tone]}`}>{value}</div>
    </div>
  );
}
