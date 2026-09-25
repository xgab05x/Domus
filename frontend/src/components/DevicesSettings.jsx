import { useCallback, useEffect, useState } from "react";
import { MonitorSmartphone, Save, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DevicesAPI } from "@/lib/api";
import { deviceId, deviceName, setDeviceName } from "@/lib/device";

function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 90) return "adesso";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} g`;
}

// Impostazioni → Dispositivi: interfacce Domus in casa, con stato online/offline e nome di questa sessione.
export default function DevicesSettings() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState(deviceName());
  const [busy, setBusy] = useState(false);
  const me = deviceId();

  const load = useCallback(async () => {
    setBusy(true);
    try { setItems(await DevicesAPI.list()); } catch (err) { console.warn("Dispositivi non disponibili:", err?.message || err); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const save = async () => {
    const clean = setDeviceName(name);
    if (!clean) return toast.error("Inserisci un nome");
    await DevicesAPI.heartbeat({ device_id: me, name: clean, page: window.location.pathname, agent: navigator.userAgent.slice(0, 120) });
    toast.success(`Questa interfaccia ora si chiama «${clean}»`);
    load();
  };
  const remove = async (id) => {
    if (!window.confirm("Rimuovere questa interfaccia dall'elenco?")) return;
    await DevicesAPI.remove(id); load();
  };

  return (
    <div className="space-y-6" data-testid="devices-settings">
      <div>
        <div className="label mb-1.5">Nome di questa interfaccia</div>
        <div className="flex gap-2">
          <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Tablet Cucina" data-testid="device-name-input" />
          <button onClick={save} className="btn-acc px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-1.5" data-testid="device-name-save"><Save size={14} /> Salva</button>
        </div>
        <p className="text-[11px] text-muted mt-1.5">Il nome viene salvato su questo dispositivo e compare nel registro attività accanto a ogni comando.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="label">Interfacce Domus in casa ({items.filter((d) => d.online).length} online)</div>
          <button onClick={load} className="chip !py-1" data-testid="devices-refresh"><RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Aggiorna</button>
        </div>
        <div className="space-y-1.5">
          {items.map((d) => (
            <div key={d.id} className="glass-inner rounded-2xl px-4 py-3 flex items-center gap-3" data-testid={`device-row-${d.id}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${d.online ? "bg-emerald-500 animate-pulse" : "bg-slate-400/50"}`} />
              <MonitorSmartphone size={16} className="text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{d.name}{d.id === me && <span className="ml-2 text-[10px] text-acc">questa</span>}</div>
                <div className="text-[10px] text-muted truncate">{d.online ? "online" : `vista ${ago(d.last_seen)} fa`}{d.page ? ` · ${d.page}` : ""}</div>
              </div>
              {d.id !== me && <button onClick={() => remove(d.id)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted shrink-0" data-testid={`device-remove-${d.id}`}><Trash2 size={14} /></button>}
            </div>
          ))}
          {items.length === 0 && <div className="text-xs text-muted">Nessuna interfaccia registrata.</div>}
        </div>
      </div>
    </div>
  );
}
