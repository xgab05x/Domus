import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneOff, DoorOpen, Volume2, VolumeX, Mic, X, Zap, Camera as CamIcon } from "lucide-react";
import { toast } from "sonner";
import CameraPlayer from "@/components/CameraPlayer";
import { useDomus } from "@/context/DomusContext";
import { IntercomAPI, AutomationsAPI } from "@/lib/api";
import { camBg } from "@/components/CameraGrid";
import { iconFor } from "@/lib/icons";
import { stopSound } from "@/lib/sounds";

// Finestra che si apre quando suonano: video live, rispondi/aggancia, apri porta e tasti funzione programmabili.
export default function IntercomPopup({ alert, onClose }) {
  const { entities, ha, askPin, reloadEvents, updateEntity } = useDomus();
  const [buttons, setButtons] = useState([]);
  const [talking, setTalking] = useState(false);
  const cam = entities.find((e) => e.id === alert?.entity_id);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!alert?.entity_id) return;
    AutomationsAPI.list({ entity_id: alert.entity_id })
      .then((list) => setButtons(list.filter((a) => a.enabled !== false)))
      .catch((err) => console.warn("Tasti funzione non caricati:", err?.message || err));
  }, [alert?.entity_id]);

  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => closeRef.current?.(), 120000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!alert || !cam) return null;
  const s = cam.state || {};
  const live = ha?.connected && cam.ha_entity_id;
  const twoWay = !!(cam.controls?.talk || s.supports_talk);

  const close = () => { stopSound(); onClose(); };
  const hangup = async () => { stopSound(); try { await IntercomAPI.answer(cam.id, "hangup"); await reloadEvents(); } catch { /* demo */ } onClose(); };
  const unlock = async () => {
    const { ok, pin } = await askPin("sensitive", `Apri la porta · ${cam.name}`);
    if (!ok) return;
    try { stopSound(); await IntercomAPI.answer(cam.id, "unlock", pin); await reloadEvents(); toast.success("Porta aperta"); }
    catch (err) { toast.error(err?.response?.data?.detail || "Apertura non riuscita"); }
  };
  const mute = async () => { stopSound(); await updateEntity(cam.id, { state: { muted: !s.muted } }); };
  const talk = async () => {
    if (!twoWay) return toast.info("Questo citofono non espone l'audio bidirezionale in Home Assistant");
    setTalking((v) => !v);
    try { await IntercomAPI.answer(cam.id, "answer"); } catch { /* demo */ }
  };
  const runButton = async (a) => {
    try { const r = await AutomationsAPI.run(a.id); toast.success(`${a.name}: ${(r.done || []).join(", ") || "eseguito"}`); }
    catch (err) { toast.error(err?.response?.data?.detail || "Azione non riuscita"); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" data-testid="intercom-popup">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={close} />
      <div className="relative glass-strong rounded-[30px] w-full max-w-2xl overflow-hidden pop-in">
        <div className="relative aspect-video bg-slate-900">
          <CameraPlayer cam={cam} bg={camBg(cam, 0)} live={!!live} nightVision={s.night_vision} testid="intercom-popup-player" />
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <span className="px-2.5 py-1 rounded-full bg-rose-600/85 text-white text-[11px] font-bold uppercase tracking-wider animate-pulse">Stanno suonando</span>
            <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur text-white text-[11px] font-semibold">{cam.name}</span>
          </div>
          <button onClick={close} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur text-white flex items-center justify-center" data-testid="intercom-popup-close"><X size={16} /></button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Action onClick={talk} active={talking} disabled={!twoWay} icon={<Mic size={17} />} label={talking ? "In conversazione" : "Parla"} testid="intercom-popup-talk" />
            <Action onClick={mute} active={s.muted} icon={s.muted ? <VolumeX size={17} /> : <Volume2 size={17} />} label={s.muted ? "Audio muto" : "Audio"} testid="intercom-popup-mute" />
            {(s.has_lock || cam.controls?.unlock || cam.type !== "camera") && <Action onClick={unlock} icon={<DoorOpen size={17} />} label="Apri porta" tone="acc" testid="intercom-popup-unlock" />}
            <Action onClick={hangup} icon={<PhoneOff size={17} />} label="Aggancia" tone="danger" testid="intercom-popup-hangup" />
          </div>

          {buttons.length > 0 && (
            <div>
              <div className="label mb-1.5">Tasti funzione</div>
              <div className="flex gap-1.5 flex-wrap" data-testid="intercom-popup-buttons">
                {buttons.map((a) => {
                  const Icon = iconFor(a.icon || "zap") || Zap;
                  return <button key={a.id} onClick={() => runButton(a)} className="chip press" data-testid={`intercom-fn-${a.id}`}><Icon size={13} /> {a.name}</button>;
                })}
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted flex items-center gap-1.5"><CamIcon size={11} /> I tasti funzione si programmano nel dettaglio del citofono (automazioni collegate).</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Action({ onClick, icon, label, active, disabled, tone, testid }) {
  const cls = tone === "danger" ? "bg-rose-500/20 text-rose-700 dark:text-rose-300" : tone === "acc" ? "bg-acc-soft text-acc" : active ? "icon-on" : "glass-inner";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-2xl px-3 py-3 flex flex-col items-center gap-1.5 press ${cls} ${disabled ? "opacity-45" : ""}`} data-testid={testid} aria-pressed={!!active}>
      {icon}<span className="text-[11px] font-semibold text-center leading-tight">{label}</span>
    </button>
  );
}
