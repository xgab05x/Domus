import { useState } from "react";
import { Cast, Tv, StopCircle } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";

// Scegli uno o più schermi (TV, Fire Stick, Nest Hub) e trasmetti una camera o una griglia.
export default function CastTargets({ open, onClose, title, subtitle, payloadFor }) {
  const { entities, castStart, castStop } = useDomus();
  const players = entities.filter((e) => e.type === "media_player");
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const send = async () => {
    if (!sel.length) return toast.error("Seleziona almeno uno schermo");
    setBusy(true);
    let ok = 0;
    for (const id of sel) {
      try { await castStart(id, payloadFor(id)); ok += 1; }
      catch (err) { toast.error(`${entities.find((e) => e.id === id)?.name}: ${err?.response?.data?.detail || "cast non riuscito"}`); }
    }
    setBusy(false);
    if (ok) { toast.success(`In trasmissione su ${ok} schermo/i`); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title || "Trasmetti su…"} subtitle={subtitle} icon={<Cast size={18} />} width="max-w-lg" testid="cast-targets"
      footer={<button onClick={send} disabled={busy} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50" data-testid="cast-targets-send"><Cast size={15} /> Trasmetti</button>}>
      <div className="space-y-1.5">
        {players.map((p) => {
          const on = sel.includes(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2">
              <button onClick={() => setSel((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                className={`flex-1 glass-inner rounded-2xl px-4 py-3 flex items-center gap-3 press text-left ${on ? "ring-1 ring-[rgb(var(--acc)/0.5)]" : ""}`} data-testid={`cast-target-${p.id}`}>
                <Tv size={15} className="text-muted shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{p.name}</span>
                  <span className="block text-[10px] text-muted truncate">{p.state?.cast ? `in trasmissione: ${p.state.cast.label}` : p.ha_entity_id ? "Home Assistant" : "demo"}</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${on ? "bg-[rgb(var(--acc-strong))]" : "bg-slate-400/40"}`} />
              </button>
              {p.state?.cast && <button onClick={() => castStop(p.id).then(() => toast.success("Trasmissione interrotta"))} className="btn-ghost w-9 h-9 rounded-full flex items-center justify-center text-muted shrink-0" title="Stop" data-testid={`cast-target-stop-${p.id}`}><StopCircle size={15} /></button>}
            </div>
          );
        })}
        {players.length === 0 && <div className="text-sm text-muted">Nessun media player disponibile.</div>}
      </div>
    </Modal>
  );
}
