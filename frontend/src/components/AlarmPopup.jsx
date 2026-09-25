import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldOff, Siren, X, VolumeX } from "lucide-react";
import { toast } from "sonner";
import CameraPlayer from "@/components/CameraPlayer";
import { useDomus } from "@/context/DomusContext";
import { camBg } from "@/components/CameraGrid";
import { stopSound } from "@/lib/sounds";

// Finestra rossa a tutto schermo quando scatta l'antintrusione: zona, telecamera e disarmo con PIN.
export default function AlarmPopup({ alert, onClose }) {
  const { entities, setAlarmMode, settings } = useDomus();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const t = setInterval(() => setElapsed((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  if (!alert) return null;

  const zone = entities.find((e) => e.id === alert.entity_id || e.name === alert.zone);
  const cam = entities.find((e) => ["camera", "doorbell"].includes(e.type) && (!zone?.room_id || e.room_id === zone.room_id));
  const disarm = async () => {
    setBusy(true);
    try {
      const res = await setAlarmMode("disarmed");
      if (res) { stopSound(); toast.success(`Antintrusione disarmata${res.ha ? " · anche sul pannello reale" : ""}`); onClose(); }
    } catch (err) { toast.error(err?.response?.data?.detail || "Disarmo non riuscito"); }
    setBusy(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3" data-testid="alarm-popup">
      <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-md" />
      <div className="absolute inset-0 border-[6px] border-rose-500/70 animate-pulse pointer-events-none" />
      <div className="relative glass-strong rounded-[30px] w-full max-w-xl overflow-hidden pop-in">
        <div className="px-5 py-4 bg-rose-600/90 text-white flex items-center gap-3">
          <Siren size={22} className="animate-pulse" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold leading-tight">ALLARME INTRUSIONE</div>
            <div className="text-xs opacity-90 truncate">{zone?.name || alert.zone || "Zona sconosciuta"} · da {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
          </div>
          <button onClick={() => { stopSound(); onClose(); }} className="w-9 h-9 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center shrink-0" data-testid="alarm-popup-close"><X size={16} /></button>
        </div>

        {cam && (
          <div className="relative aspect-video bg-slate-900">
            <CameraPlayer cam={cam} bg={camBg(cam, 0)} live={!!cam.ha_entity_id} testid="alarm-popup-player" />
            <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-semibold uppercase tracking-wider z-10">{cam.name}</span>
          </div>
        )}

        <div className="p-5 space-y-3">
          <button onClick={disarm} disabled={busy} className="w-full btn-acc py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50" data-testid="alarm-popup-disarm">
            <ShieldOff size={18} /> Disarma con il PIN
          </button>
          <button onClick={stopSound} className="w-full chip justify-center !py-2.5" data-testid="alarm-popup-silence"><VolumeX size={14} /> Silenzia la sirena su questo dispositivo</button>
          <p className="text-[11px] text-muted text-center">Il disarmo viene inviato anche al pannello reale collegato ({settings?.alarm_entity_id || "nessun pannello HA"}).</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
