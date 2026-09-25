import { useState } from "react";
import { Cast, Cctv, LayoutDashboard, Link2, StopCircle } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";

const DASHBOARDS = [
  { path: "/sol-invictus", label: "Sol Invictus", hint: "luci, clima, consumi" },
  { path: "/terminus", label: "Terminus", hint: "camere e sicurezza" },
];

// Send a camera stream or a Domus dashboard to a Nest Hub / Android TV / Chromecast.
export default function CastDialog({ target, open, onClose }) {
  const { entities, castStart, castStop, views } = useDomus();
  const [tab, setTab] = useState("camera");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open || !target) return null;

  const cams = entities.filter((e) => e.type === "camera" || e.type === "doorbell");
  const current = target.state?.cast;

  const send = async (body) => {
    setBusy(true);
    try {
      const r = await castStart(target.id, body);
      toast.success(r.demo ? `Trasmissione simulata su ${target.name} (demo)` : `In trasmissione su ${target.name}`);
      onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || "Cast non riuscito"); }
    setBusy(false);
  };
  const stop = async () => {
    setBusy(true);
    try { await castStop(target.id); toast.success("Trasmissione interrotta"); onClose(); }
    catch { toast.error("Impossibile interrompere"); }
    setBusy(false);
  };

  const origin = window.location.origin;
  return (
    <Modal open={open} onClose={onClose} title={`Trasmetti su ${target.name}`} subtitle="Telecamera live o dashboard Domus sullo schermo" icon={<Cast size={18} />} testid="cast-dialog" width="max-w-2xl"
      footer={current ? <button onClick={stop} disabled={busy} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="cast-stop"><StopCircle size={15} /> Stop trasmissione</button> : null}>
      {current && <div className="glass-inner rounded-2xl px-4 py-3 mb-4 text-sm flex items-center gap-2" data-testid="cast-current"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> In trasmissione: <b>{current.label}</b>{current.demo ? " (demo)" : ""}</div>}

      <div className="flex items-center gap-1 p-1 rounded-full glass-inner mb-5 w-fit">
        <button onClick={() => setTab("camera")} className={`chip !py-1.5 ${tab === "camera" ? "chip-active" : "!bg-transparent !border-transparent"}`} data-testid="cast-tab-camera"><Cctv size={13} /> Telecamera</button>
        <button onClick={() => setTab("dashboard")} className={`chip !py-1.5 ${tab === "dashboard" ? "chip-active" : "!bg-transparent !border-transparent"}`} data-testid="cast-tab-dashboard"><LayoutDashboard size={13} /> Dashboard</button>
      </div>

      {tab === "camera" ? (
        <div className="grid sm:grid-cols-2 gap-2" data-testid="cast-camera-list">
          {cams.map((c) => (
            <button key={c.id} disabled={busy} onClick={() => send({ kind: "camera", camera_id: c.id })} className="glass-inner rounded-2xl px-4 py-3 text-left press hover:bg-white/60 dark:hover:bg-white/10" data-testid={`cast-camera-${c.id}`}>
              <div className="font-semibold text-sm truncate">{c.name}</div>
              <div className="text-[11px] text-muted">{c.integration}{c.ha_entity_id ? " · HA" : " · demo"}</div>
            </button>
          ))}
          {cams.length === 0 && <div className="text-sm text-muted">Nessuna telecamera disponibile.</div>}
        </div>
      ) : (
        <div className="space-y-3" data-testid="cast-dashboard-list">
          {DASHBOARDS.map((d) => (
            <button key={d.path} disabled={busy} onClick={() => send({ kind: "dashboard", url: `${origin}${d.path}`, label: `Domus · ${d.label}` })} className="w-full glass-inner rounded-2xl px-4 py-3 text-left press hover:bg-white/60 dark:hover:bg-white/10" data-testid={`cast-dashboard-${d.label.replace(/\W+/g, "")}`}>
              <div className="font-semibold text-sm">{d.label}</div>
              <div className="text-[11px] text-muted">{d.hint} · {origin}{d.path}</div>
            </button>
          ))}
          {views.map((v) => (
            <button key={v.id} disabled={busy} onClick={() => send({ kind: "dashboard", url: `${origin}/terminus?view=${v.id}`, label: `Domus · ${v.name}` })} className="w-full glass-inner rounded-2xl px-4 py-3 text-left press hover:bg-white/60 dark:hover:bg-white/10" data-testid={`cast-view-${v.id}`}>
              <div className="font-semibold text-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: v.color }} /> Vista {v.name}</div>
              <div className="text-[11px] text-muted">vista personalizzata Terminus</div>
            </button>
          ))}
          <div className="flex gap-2 items-center">
            <input className="field flex-1" placeholder="https://… URL personalizzato" value={custom} onChange={(e) => setCustom(e.target.value)} data-testid="cast-custom-url" />
            <button disabled={!custom.trim() || busy} onClick={() => send({ kind: "dashboard", url: custom.trim(), label: "URL personalizzato" })} className="btn-acc px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50" data-testid="cast-custom-send"><Link2 size={14} /> Invia</button>
          </div>
          <p className="text-[11px] text-muted">Le dashboard vengono aperte dal dispositivo: il mini PC deve essere raggiungibile dalla rete locale dello schermo.</p>
        </div>
      )}
    </Modal>
  );
}
