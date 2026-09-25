import { useCallback, useEffect, useState } from "react";
import { Grid2x2, Plus, Cast, Pencil, Trash2, Save, ArrowLeft, ArrowRight, X, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import CastTargets from "@/components/CastTargets";
import { GridsAPI } from "@/lib/api";
import { useDomus } from "@/context/DomusContext";

const LAYOUTS = [{ v: "2x2", l: "2 × 2", slots: 4 }, { v: "1+3", l: "1 grande + 3", slots: 4 }, { v: "3x3", l: "3 × 3", slots: 9 }, { v: "1x2", l: "2 affiancate", slots: 2 }];
export const layoutClass = (layout) => ({ "2x2": "grid-cols-2 grid-rows-2", "3x3": "grid-cols-3 grid-rows-3", "1x2": "grid-cols-2 grid-rows-1", "1+3": "grid-cols-3 grid-rows-3" }[layout] || "grid-cols-2 grid-rows-2");
export const slotClass = (layout, i) => (layout === "1+3" && i === 0 ? "col-span-2 row-span-2" : "");

// Sezione Griglia: componi le telecamere e trasmetti la griglia (o una singola camera) sugli schermi.
export default function GridsPanel() {
  const { entities } = useDomus();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [casting, setCasting] = useState(null);
  const cams = entities.filter((e) => ["camera", "doorbell"].includes(e.type));

  const load = useCallback(async () => {
    try { setItems(await GridsAPI.list()); } catch (err) { console.warn("Griglie non disponibili:", err?.message || err); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => { const g = await GridsAPI.create({ name: `Griglia ${items.length + 1}`, layout: "2x2", slots: cams.slice(0, 4).map((c) => c.id) }); await load(); setEditing(g); };
  const remove = async (g) => { if (!window.confirm(`Eliminare «${g.name}»?`)) return; await GridsAPI.remove(g.id); load(); };

  return (
    <div className="glass rounded-[28px] p-6" data-testid="grids-panel">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <div className="label text-acc">Videosorveglianza</div>
          <h3 className="font-display text-lg font-semibold">Griglia telecamere</h3>
        </div>
        <button onClick={create} className="btn-acc px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="grid-new"><Plus size={14} /> Nuova griglia</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 stagger">
        {items.map((g) => (
          <div key={g.id} className="glass-inner rounded-2xl p-3" data-testid={`grid-card-${g.id}`}>
            <div className="flex items-center gap-2 mb-2">
              <Grid2x2 size={15} className="text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{g.name}</div>
                <div className="text-[10px] text-muted">{LAYOUTS.find((l) => l.v === g.layout)?.l} · {(g.slots || []).filter(Boolean).length} telecamere</div>
              </div>
              <button onClick={() => setCasting(g)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Trasmetti" data-testid={`grid-cast-${g.id}`}><Cast size={14} /></button>
              <a href={`/wall/${g.id}`} target="_blank" rel="noreferrer" className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Apri a schermo pieno" data-testid={`grid-open-${g.id}`}><Maximize2 size={14} /></a>
              <button onClick={() => setEditing(g)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Modifica" data-testid={`grid-edit-${g.id}`}><Pencil size={14} /></button>
              <button onClick={() => remove(g)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Elimina" data-testid={`grid-delete-${g.id}`}><Trash2 size={14} /></button>
            </div>
            <div className={`grid gap-1 aspect-video ${layoutClass(g.layout)}`}>
              {(g.slots || []).map((id, i) => {
                const c = cams.find((x) => x.id === id);
                return <div key={i} className={`rounded-lg bg-slate-900/70 text-white/80 text-[9px] flex items-center justify-center text-center px-1 ${slotClass(g.layout, i)}`}>{c?.name || "vuoto"}</div>;
              })}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="glass-inner rounded-2xl px-4 py-6 text-center text-sm text-muted sm:col-span-2" data-testid="grids-empty">Nessuna griglia. Creane una per vedere più telecamere insieme e trasmetterla su TV, Fire Stick o Nest Hub.</div>}
      </div>

      <GridEditor grid={editing} open={!!editing} cams={cams} onClose={() => setEditing(null)} onSaved={load} />
      <CastTargets open={!!casting} onClose={() => setCasting(null)} title={`Trasmetti «${casting?.name}»`} subtitle="La griglia si apre a schermo pieno sul dispositivo scelto"
        payloadFor={() => ({ kind: "dashboard", url: `${window.location.origin}/wall/${casting.id}`, label: `Domus · ${casting.name}` })} />
    </div>
  );
}

function GridEditor({ grid, open, onClose, cams, onSaved }) {
  const [form, setForm] = useState(null);
  useEffect(() => { if (open && grid) setForm({ ...grid, slots: [...(grid.slots || [])] }); }, [open, grid]);
  if (!open || !form) return null;

  const max = LAYOUTS.find((l) => l.v === form.layout)?.slots || 4;
  const slots = Array.from({ length: max }, (_, i) => form.slots[i] || "");
  const setSlot = (i, id) => setForm((f) => { const s = [...slots]; s[i] = id; return { ...f, slots: s }; });
  const move = (i, dir) => setForm((f) => { const s = [...slots]; const j = i + dir; if (j < 0 || j >= s.length) return f; [s[i], s[j]] = [s[j], s[i]]; return { ...f, slots: s }; });
  const save = async () => {
    await GridsAPI.update(form.id, { name: form.name, layout: form.layout, slots: slots.filter((x, i) => i < max) });
    toast.success("Griglia salvata"); onSaved(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Componi la griglia" subtitle="Scegli il layout e trascina le telecamere nei riquadri" icon={<Grid2x2 size={18} />} width="max-w-2xl" testid="grid-editor"
      footer={<button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="grid-save"><Save size={15} /> Salva</button>}>
      <div className="space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          <input className="field flex-1 min-w-[180px]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="grid-name" />
          {LAYOUTS.map((l) => <button key={l.v} onClick={() => setForm({ ...form, layout: l.v })} className={`chip ${form.layout === l.v ? "chip-active" : ""}`} data-testid={`grid-layout-${l.v}`}>{l.l}</button>)}
        </div>
        <div className="space-y-1.5">
          {slots.map((id, i) => (
            <div key={i} className="glass-inner rounded-2xl px-3 py-2 flex items-center gap-2" data-testid={`grid-slot-${i}`}>
              <span className="text-[11px] text-muted w-14 shrink-0">Riquadro {i + 1}</span>
              <select className="field !py-1.5 flex-1 min-w-0" value={id} onChange={(e) => setSlot(i, e.target.value)} data-testid={`grid-slot-select-${i}`}>
                <option value="">— vuoto —</option>
                {cams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => move(i, -1)} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted shrink-0" data-testid={`grid-slot-up-${i}`}><ArrowLeft size={13} /></button>
              <button onClick={() => move(i, 1)} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted shrink-0" data-testid={`grid-slot-down-${i}`}><ArrowRight size={13} /></button>
              <button onClick={() => setSlot(i, "")} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted shrink-0" data-testid={`grid-slot-clear-${i}`}><X size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
