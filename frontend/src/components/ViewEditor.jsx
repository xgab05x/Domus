import { useEffect, useState } from "react";
import { LayoutGrid, Plus, Trash2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import IconPicker, { IconButton } from "@/components/IconPicker";
import { useDomus } from "@/context/DomusContext";
import { iconFor, SOFT_COLORS } from "@/lib/icons";
import { isSecurity, TYPE_LABEL, TYPE_ICON } from "@/lib/security";

const EMPTY = { name: "", icon: "layout-grid", color: "#b08e54", members: [], layout: "grid" };

// Create / edit Terminus views: named groups of cameras, doorbells, intercoms and sensors.
export default function ViewEditor({ open, onClose, initialId = null, onSaved }) {
  const { views, entities, rooms, createView, updateView, deleteView } = useDomus();
  const [selected, setSelected] = useState(initialId);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [picker, setPicker] = useState(false);

  useEffect(() => { if (open) setSelected(initialId); }, [open, initialId]);
  useEffect(() => {
    const v = views.find((x) => x.id === selected);
    setForm(v ? { ...EMPTY, ...v } : { ...EMPTY });
  }, [selected, views, open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const candidates = entities.filter((e) => isSecurity(e) && (typeF === "all" || e.type === typeF) && e.name.toLowerCase().includes(q.toLowerCase()));
  const toggleMember = (id) => set({ members: form.members.includes(id) ? form.members.filter((x) => x !== id) : [...form.members, id] });
  const selectAllVisible = () => set({ members: Array.from(new Set([...form.members, ...candidates.map((c) => c.id)])) });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Dai un nome alla vista");
    if (form.members.length === 0) return toast.error("Seleziona almeno un dispositivo");
    const payload = { name: form.name.trim(), icon: form.icon, color: form.color, members: form.members, layout: form.layout };
    let v;
    if (selected) v = await updateView(selected, payload);
    else { v = await createView(payload); setSelected(v.id); }
    toast.success("Vista salvata");
    onSaved?.(v);
  };
  const remove = async () => {
    if (!selected || !window.confirm("Eliminare la vista? I dispositivi restano.")) return;
    await deleteView(selected); setSelected(null); toast.success("Vista eliminata"); onSaved?.(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Viste Terminus" icon={<LayoutGrid size={18} />} testid="view-editor" width="max-w-4xl"
      subtitle="Componi schermate personalizzate: es. Perimetro, Piano terra, Notte. Ogni vista mostra solo le camere, i citofoni e i sensori che scegli."
      footer={<>
        {selected && <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="view-delete"><Trash2 size={14} /> Elimina</button>}
        <button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="view-save"><Save size={14} /> Salva</button>
      </>}>
      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <div className="space-y-1.5">
          <button onClick={() => setSelected(null)} className={`chip w-full justify-start ${!selected ? "chip-active" : ""}`} data-testid="view-new"><Plus size={13} /> Nuova vista</button>
          {views.map((v) => { const VI = iconFor(v.icon, LayoutGrid); return (
            <button key={v.id} onClick={() => setSelected(v.id)} className={`chip w-full justify-start ${selected === v.id ? "chip-active" : ""}`} data-testid={`view-select-${v.id}`}>
              <VI size={13} /> <span className="truncate">{v.name}</span><span className="ml-auto text-[10px] opacity-70">{v.members.length}</span>
            </button>
          ); })}
        </div>

        <div className="space-y-5">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <IconButton value={form.icon} onClick={() => setPicker(true)} testid="view-icon-btn" />
              <label className="block flex-1"><div className="label mb-1.5">Nome vista</div>
                <input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Perimetro esterno, Piano terra…" data-testid="view-name" /></label>
            </div>
            <div>
              <div className="label mb-1.5">Colore</div>
              <div className="flex gap-1.5">{SOFT_COLORS.map((c) => <button key={c} onClick={() => set({ color: c })} className={`w-6 h-6 rounded-full border-2 ${form.color === c ? "border-slate-700 dark:border-white scale-110" : "border-white/70"}`} style={{ background: c }} data-testid={`view-color-${c.slice(1)}`} />)}</div>
            </div>
          </div>

          <div>
            <div className="label mb-1.5">Disposizione</div>
            <div className="flex gap-2">
              <button onClick={() => set({ layout: "grid" })} className={`chip ${form.layout === "grid" ? "chip-active" : ""}`} data-testid="view-layout-grid">Griglia ampia</button>
              <button onClick={() => set({ layout: "compact" })} className={`chip ${form.layout === "compact" ? "chip-active" : ""}`} data-testid="view-layout-compact">Compatta (più camere)</button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="label">Dispositivi ({form.members.length})</div>
              <div className="flex items-center gap-1.5">
                <button onClick={selectAllVisible} className="chip !py-1 !text-[11px]" data-testid="view-select-all">Seleziona visibili</button>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="field !py-1.5 !pl-8 !w-44 text-xs" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="view-member-search" />
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {["all", "camera", "doorbell", "intercom", "alarm_zone", "sensor"].map((t) => <button key={t} onClick={() => setTypeF(t)} className={`chip !py-1 !text-[11px] ${typeF === t ? "chip-active" : ""}`} data-testid={`view-type-${t}`}>{t === "all" ? "Tutti" : TYPE_LABEL[t]}</button>)}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {candidates.map((e) => {
                const EI = iconFor(e.icon, TYPE_ICON[e.type]);
                const checked = form.members.includes(e.id);
                const room = rooms.find((r) => r.id === e.room_id);
                return (
                  <button key={e.id} onClick={() => toggleMember(e.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition-colors ${checked ? "bg-acc-soft" : "hover:bg-white/40 dark:hover:bg-white/5"}`} data-testid={`view-member-${e.id}`} aria-pressed={checked}>
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? "bg-[rgb(var(--acc-strong))] border-transparent text-white" : "border-slate-400/60"}`}>{checked && <span className="w-2 h-2 bg-white rounded-sm" />}</span>
                    <EI size={14} className="text-muted shrink-0" />
                    <span className="flex-1 break-words">{e.name}</span>
                    <span className="text-[10px] text-muted shrink-0">{room?.name || "—"} · {TYPE_LABEL[e.type]}</span>
                  </button>
                );
              })}
              {candidates.length === 0 && <div className="text-xs text-muted py-4 text-center">Nessun dispositivo trovato.</div>}
            </div>
          </div>
        </div>
      </div>
      <IconPicker open={picker} onClose={() => setPicker(false)} value={form.icon} onChange={(icon) => set({ icon })} title="Icona della vista" />
    </Modal>
  );
}
