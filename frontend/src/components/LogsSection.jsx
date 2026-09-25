import { useCallback, useEffect, useState } from "react";
import { ScrollText, Download, Filter, RefreshCw, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { LogsAPI } from "@/lib/api";
import { useDomus } from "@/context/DomusContext";

const LEVEL_TONE = {
  alert: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  info: "bg-slate-500/10 text-muted",
};

function when(ts) {
  const d = new Date(ts);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

// Registro attività: armo/disarmo, accensioni, modifiche editor, con l'interfaccia che ha dato il comando.
export default function LogsSection({ fixedKind, entityId, compact, limit = 200 }) {
  const { askPin } = useDomus();
  const [kind, setKind] = useState(fixedKind || "all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ items: [], kinds: {} });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await LogsAPI.list({ kind: fixedKind || kind, entity_id: entityId || "", search, limit })); }
    catch (err) { console.warn("Registro non disponibile:", err?.message || err); }
    setBusy(false);
  }, [fixedKind, kind, entityId, search, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const clear = async () => {
    if (!window.confirm("Svuotare tutto il registro attività?")) return;
    const { ok, pin } = await askPin("config", "Svuota registro attività");
    if (!ok) return;
    try { await LogsAPI.clear(pin); toast.success("Registro svuotato"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Operazione non riuscita"); }
  };

  const kinds = Object.entries(data.kinds || {});
  return (
    <div className="space-y-3" data-testid="logs-section">
      {!fixedKind && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setKind("all")} className={`chip ${kind === "all" ? "chip-active" : ""}`} data-testid="log-kind-all"><Filter size={12} /> Tutto</button>
            {kinds.map(([k, label]) => (
              <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "chip-active" : ""}`} data-testid={`log-kind-${k}`}>{label}</button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field !py-1.5 !pl-8 !w-52" placeholder="Cerca…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="log-search" />
          </div>
          <button onClick={load} className="chip" data-testid="log-refresh"><RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Aggiorna</button>
          <a href={LogsAPI.exportUrl({ kind, entity_id: entityId || "", search })} className="chip" data-testid="log-export"><Download size={12} /> CSV</a>
          <button onClick={clear} className="chip text-rose-600 dark:text-rose-300" data-testid="log-clear"><Trash2 size={12} /> Svuota</button>
        </div>
      )}

      <div className={`space-y-1.5 overflow-y-auto pr-1 ${compact ? "max-h-72" : "max-h-[60vh]"}`} data-testid="logs-list">
        {data.items.map((l) => (
          <div key={l.id} className="glass-inner rounded-2xl px-3 py-2 flex items-start gap-3 fade-in" data-testid={`log-row-${l.id}`}>
            <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${LEVEL_TONE[l.level] || LEVEL_TONE.info}`}>{(data.kinds || {})[l.kind] || l.kind}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{l.message}{l.pin_used && <span className="ml-1.5 text-[10px] text-acc font-semibold">· con PIN</span>}</div>
              <div className="text-[10px] text-muted mt-0.5 truncate">{when(l.ts)} · da <b>{l.device_name}</b>{l.detail ? ` · ${l.detail}` : ""}</div>
            </div>
          </div>
        ))}
        {data.items.length === 0 && (
          <div className="glass-inner rounded-2xl px-4 py-6 text-center text-sm text-muted flex flex-col items-center gap-2" data-testid="logs-empty">
            <ScrollText size={20} className="opacity-60" /> Nessuna attività registrata per questo filtro.
          </div>
        )}
      </div>
    </div>
  );
}
