import { RadioTower } from "lucide-react";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";
import { iconFor } from "@/lib/icons";
import { toast } from "sonner";

export default function UnassignedDrawer({ open, onOpenChange }) {
  const { discovered, rooms, assignDiscovered, mockDiscovery } = useDomus();
  const simulate = async () => { await mockDiscovery(); toast.info("Nuovo dispositivo simulato"); };

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="Dispositivi rilevati" subtitle="Assegna ogni nuovo dispositivo a una stanza." icon={<RadioTower size={18} />} testid="unassigned-drawer"
      footer={<button data-testid="mock-discovery-btn" onClick={simulate} className="chip">Simula un nuovo rilevamento</button>}>
      <div className="space-y-3">
        {discovered.map((d) => {
          const Icon = iconFor(d.icon);
          return (
            <div key={d.id} className="glass-inner rounded-2xl p-4 flex items-center gap-3 flex-wrap" data-testid={`disc-row-${d.id}`}>
              <div className="icon-btn icon-on w-11 h-11"><Icon size={19} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{d.name}</div>
                <div className="label">{d.integration} · {d.type}</div>
              </div>
              <select data-testid={`assign-select-${d.id}`} className="field !w-auto" defaultValue=""
                onChange={async (e) => { const val = e.target.value; if (!val) return; await assignDiscovered(d.id, val === "unassigned" ? null : val); toast.success("Dispositivo aggiunto"); }}>
                <option value="">Assegna a…</option>
                <option value="unassigned">Non assegnata</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          );
        })}
        {discovered.length === 0 && <div className="text-center py-8 text-muted text-sm">Nessun nuovo dispositivo rilevato.</div>}
      </div>
    </Modal>
  );
}
