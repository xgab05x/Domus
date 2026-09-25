import { useCallback, useEffect, useState } from "react";
import { Zap, Plus, Play, Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { AutomationsAPI } from "@/lib/api";
import AutomationEditor from "@/components/AutomationEditor";

const TRIG_LABEL = { state: "stato", ring: "squillo", alarm: "allarme", time: "orario" };

// Elenco automazioni "se questo → allora quello".
export default function AutomationsPanel({ entityId, defaults, compact }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await AutomationsAPI.list(entityId ? { entity_id: entityId } : {})); }
    catch (err) { console.warn("Automazioni non disponibili:", err?.message || err); }
  }, [entityId]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (a) => { await AutomationsAPI.update(a.id, { enabled: !a.enabled }); load(); };
  const run = async (a) => {
    try { const r = await AutomationsAPI.run(a.id); toast.success(`Eseguita: ${(r.done || []).join(", ") || "nessuna azione"}`); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Esecuzione non riuscita"); }
  };
  const remove = async (a) => { if (!window.confirm(`Eliminare «${a.name}»?`)) return; await AutomationsAPI.remove(a.id); load(); toast.success("Automazione eliminata"); };

  return (
    <div data-testid="automations-panel">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="label text-acc">Automazioni</div>
          {!compact && <h3 className="font-display text-lg font-semibold">Se questo, allora quello</h3>}
        </div>
        <button onClick={() => setCreating(true)} className="btn-acc px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="automation-new"><Plus size={14} /> Nuova</button>
      </div>

      <div className="grid gap-2 stagger">
        {items.map((a) => (
          <div key={a.id} className="glass-inner rounded-2xl px-4 py-3 flex items-center gap-3" data-testid={`automation-card-${a.id}`}>
            <button onClick={() => toggle(a)} className={`icon-btn press w-9 h-9 shrink-0 ${a.enabled ? "icon-on" : "icon-off"}`} data-testid={`automation-toggle-${a.id}`} aria-pressed={a.enabled}>
              {a.enabled ? <Zap size={16} /> : <Power size={16} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{a.name}</div>
              <div className="text-[10px] text-muted truncate">
                SE {(a.triggers || []).map((t) => TRIG_LABEL[t.type] || t.type).join(a.match === "all" ? " + " : " / ") || "—"} → {(a.actions || []).length} azioni
                {a.last_run ? ` · ultima: ${new Date(a.last_run).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => run(a)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Prova" data-testid={`automation-run-${a.id}`}><Play size={14} /></button>
              <button onClick={() => setEditing(a)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Modifica" data-testid={`automation-edit-${a.id}`}><Pencil size={14} /></button>
              <button onClick={() => remove(a)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" title="Elimina" data-testid={`automation-delete-${a.id}`}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="glass-inner rounded-2xl px-4 py-6 text-center text-sm text-muted" data-testid="automations-empty">
            Nessuna automazione. Esempio: «quando suona il campanello → accendi la luce d'ingresso e dai un impulso al relè del cancello».
          </div>
        )}
      </div>

      <AutomationEditor open={creating} onClose={() => setCreating(false)} defaults={defaults} onSaved={load} />
      <AutomationEditor open={!!editing} automation={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
