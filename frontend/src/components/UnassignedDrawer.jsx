import { X, RadioTower, Lightbulb, Plug, Cctv } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { toast } from "sonner";

const icons = { light: Lightbulb, plug: Plug, camera: Cctv };

export default function UnassignedDrawer({ open, onOpenChange }) {
  const { discovered, rooms, assignDiscovered, mockDiscovery } = useDomus();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="unassigned-drawer">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative glass-strong rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 dark:border-white/10">
          <div>
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              <RadioTower size={18} className="text-amber-500" />
              Dispositivi rilevati
            </h3>
            <p className="text-xs text-slate-500">Assegna ogni nuovo dispositivo a una stanza.</p>
          </div>
          <button data-testid="close-unassigned" onClick={() => onOpenChange(false)} className="w-9 h-9 rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-3">
          {discovered.map((d) => {
            const Icon = icons[d.type] || Lightbulb;
            return (
              <div key={d.id} className="glass rounded-2xl p-4 flex items-center gap-3 flex-wrap" data-testid={`disc-row-${d.id}`}>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center">
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{d.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">{d.integration} · {d.type}</div>
                </div>
                <select
                  data-testid={`assign-select-${d.id}`}
                  className="px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-white/10 text-sm outline-none"
                  defaultValue=""
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    await assignDiscovered(d.id, val === "unassigned" ? null : val);
                    toast.success("Dispositivo aggiunto");
                  }}
                >
                  <option value="">Assegna a…</option>
                  <option value="unassigned">Non assegnata</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {discovered.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              Nessun nuovo dispositivo rilevato.
              <div className="mt-4">
                <button
                  data-testid="mock-discovery-btn"
                  onClick={async () => { await mockDiscovery(); toast.info("Nuovo dispositivo simulato"); }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500 text-white"
                >
                  Simula rilevamento
                </button>
              </div>
            </div>
          )}
          {discovered.length > 0 && (
            <button
              data-testid="mock-discovery-btn"
              onClick={async () => { await mockDiscovery(); toast.info("Nuovo dispositivo simulato"); }}
              className="text-xs text-slate-500 underline underline-offset-2"
            >
              Simula un nuovo rilevamento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
