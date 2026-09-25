import { useEffect, useState } from "react";
import { Link2, LayoutGrid, Plus, Trash2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";
import { iconFor } from "@/lib/icons";

const EMPTY = { name: "", kind: "sync", members: [], primary_id: null, display: "group_only", hide_members: true, room_id: null, icon: "link", color: "#b08e54" };
const MEMBER_TYPES = ["light", "plug", "switch", "thermostat"];

export default function GroupEditor({ open, onClose, initialId = null }) {
  const { groups, entities, rooms, createGroup, updateGroup, deleteGroup } = useDomus();
  const [selected, setSelected] = useState(initialId);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");

  useEffect(() => { if (open) setSelected(initialId); }, [open, initialId]);
  useEffect(() => {
    const g = groups.find((x) => x.id === selected);
    setForm(g ? { ...EMPTY, ...g } : { ...EMPTY });
  }, [selected, groups, open]);

  const candidates = entities.filter((e) => MEMBER_TYPES.includes(e.type) && e.name.toLowerCase().includes(q.toLowerCase()));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleMember = (id) => set({ members: form.members.includes(id) ? form.members.filter((x) => x !== id) : [...form.members, id] });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Inserisci un nome");
    if (form.members.length < 2) return toast.error("Seleziona almeno due dispositivi");
    const payload = { ...form, icon: form.kind === "panel" ? "layout-grid" : "link", primary_id: form.members.includes(form.primary_id) ? form.primary_id : null };
    delete payload.id;
    if (selected) await updateGroup(selected, payload);
    else { const g = await createGroup(payload); setSelected(g.id); }
    toast.success("Gruppo salvato");
  };
  const remove = async () => {
    if (!selected || !window.confirm("Eliminare il gruppo? I dispositivi restano.")) return;
    await deleteGroup(selected); setSelected(null); toast.success("Gruppo eliminato");
  };

  return (
    <Modal
      open={open} onClose={onClose} title="Gruppi e placche" icon={<Link2 size={18} />} testid="group-editor" width="max-w-4xl"
      subtitle="Collega più dispositivi in uno solo, oppure raggruppa i tasti di una placca fisica."
      footer={<>
        {selected && <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="group-delete"><Trash2 size={14} /> Elimina</button>}
        <button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="group-save"><Save size={14} /> Salva</button>
      </>}
    >
      <div className="grid md:grid-cols-[230px_1fr] gap-6">
        <div className="space-y-1.5">
          <button onClick={() => setSelected(null)} className={`chip w-full justify-start ${!selected ? "chip-active" : ""}`} data-testid="group-new"><Plus size={13} /> Nuovo gruppo</button>
          {groups.map((g) => {
            const GI = iconFor(g.icon, g.kind === "panel" ? LayoutGrid : Link2);
            return (
              <button key={g.id} onClick={() => setSelected(g.id)} className={`chip w-full justify-start ${selected === g.id ? "chip-active" : ""}`} data-testid={`group-select-${g.id}`}>
                <GI size={13} /> <span className="truncate">{g.name}</span><span className="ml-auto text-[10px] opacity-70">{g.members.length}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><div className="label mb-1.5">Nome</div>
              <input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Corridoio, Placca cucina…" data-testid="group-name" /></label>
            <label className="block"><div className="label mb-1.5">Stanza</div>
              <select className="field" value={form.room_id || ""} onChange={(e) => set({ room_id: e.target.value || null })} data-testid="group-room">
                <option value="">Nessuna</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select></label>
          </div>

          <div>
            <div className="label mb-1.5">Tipo</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => set({ kind: "sync" })} className={`chip ${form.kind === "sync" ? "chip-active" : ""}`} data-testid="group-kind-sync"><Link2 size={13} /> Collegamento (un solo dispositivo)</button>
              <button onClick={() => set({ kind: "panel" })} className={`chip ${form.kind === "panel" ? "chip-active" : ""}`} data-testid="group-kind-panel"><LayoutGrid size={13} /> Placca (tasti fisici)</button>
            </div>
            <p className="text-xs text-muted mt-2">
              {form.kind === "sync"
                ? "Quando uno dei membri cambia stato, tutti gli altri lo seguono (es. una luce e i suoi tasti su più placche)."
                : "Mostra i tasti della placca dentro un'unica bubble, come nel dispositivo reale."}
            </p>
          </div>

          {form.kind === "sync" ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="label mb-1.5">Visualizzazione</div>
                <select className="field" value={form.display} onChange={(e) => set({ display: e.target.value })} data-testid="group-display">
                  <option value="group_only">Solo bubble del gruppo</option>
                  <option value="members_only">Solo i membri (con badge)</option>
                  <option value="both">Gruppo e membri</option>
                </select>
              </div>
              <div>
                <div className="label mb-1.5">Dispositivo principale</div>
                <select className="field" value={form.primary_id || ""} onChange={(e) => set({ primary_id: e.target.value || null })} data-testid="group-primary">
                  <option value="">Automatico</option>
                  {form.members.map((id) => { const e = entities.find((x) => x.id === id); return e ? <option key={id} value={id}>{e.name}</option> : null; })}
                </select>
              </div>
            </div>
          ) : (
            <button onClick={() => set({ hide_members: !form.hide_members })} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between" data-testid="group-hide-members">
              <span className="text-sm">Nascondi i tasti dalla griglia (visibili solo nella placca)</span>
              <span className={`toggle ${form.hide_members ? "on" : ""}`} />
            </button>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="label">Membri ({form.members.length})</div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field !py-1.5 !pl-8 !w-52 text-xs" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="group-member-search" />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {candidates.map((e) => {
                const EI = iconFor(e.icon);
                const checked = form.members.includes(e.id);
                const room = rooms.find((r) => r.id === e.room_id);
                return (
                  <button key={e.id} onClick={() => toggleMember(e.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition-colors ${checked ? "bg-acc-soft" : "hover:bg-white/40 dark:hover:bg-white/5"}`} data-testid={`group-member-${e.id}`} aria-pressed={checked}>
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center ${checked ? "bg-[rgb(var(--acc-strong))] border-transparent text-white" : "border-slate-400/60"}`}>{checked && <span className="w-2 h-2 bg-white rounded-sm" />}</span>
                    <EI size={14} className="text-muted" />
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-[10px] text-muted">{room?.name || "—"} · {e.type}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
