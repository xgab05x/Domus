import { Bell, PhoneOff, DoorOpen, Volume2, VolumeX } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { IntercomAPI } from "@/lib/api";
import { toast } from "sonner";

export default function IntercomWidget() {
  const { entities, updateEntity, reloadEvents } = useDomus();
  const intercom = entities.find((e) => e.type === "intercom");
  if (!intercom) return null;
  const s = intercom.state || {};

  const simulateRing = async () => { await IntercomAPI.ring(intercom.id); await updateEntity(intercom.id, { state: { ringing: true, last_call: new Date().toISOString() } }); await reloadEvents(); toast.info("Qualcuno sta suonando…"); };
  const unlock = async () => { await IntercomAPI.answer(intercom.id, "unlock"); await updateEntity(intercom.id, { state: { ringing: false } }); await reloadEvents(); toast.success("Porta aperta"); };
  const hangup = async () => { await IntercomAPI.answer(intercom.id, "hangup"); await updateEntity(intercom.id, { state: { ringing: false } }); await reloadEvents(); toast.info("Chiamata terminata"); };
  const mute = async () => { await updateEntity(intercom.id, { state: { muted: !s.muted } }); };

  return (
    <div className={`glass rounded-[28px] p-6 relative overflow-hidden ${s.ringing ? "ring-2 ring-[rgb(var(--acc)/0.6)]" : ""}`} data-testid="intercom-widget">
      {s.ringing && <div className="absolute inset-0 bg-acc-soft animate-pulse pointer-events-none" />}
      <div className="relative flex items-center justify-between mb-3 gap-3">
        <div>
          <div className="label text-acc">Citofono</div>
          <h3 className="font-display text-lg font-semibold">{intercom.name}</h3>
        </div>
        <div className={`icon-btn w-12 h-12 ${s.ringing ? "icon-on" : "icon-off"}`}><Bell size={22} className={s.ringing ? "animate-bounce" : ""} /></div>
      </div>

      <div className="relative text-sm text-muted mb-4">
        {s.ringing ? <span className="font-semibold text-acc">Chiamata in arrivo…</span>
          : <>Ultima chiamata: <span className="font-mono">{s.last_call ? new Date(s.last_call).toLocaleString("it-IT") : "—"}</span></>}
      </div>

      <div className="relative flex flex-wrap gap-2">
        {s.ringing ? (
          <>
            <button data-testid="intercom-unlock" onClick={unlock} className="flex-1 min-w-[130px] px-4 py-3 rounded-2xl btn-acc font-semibold flex items-center justify-center gap-2"><DoorOpen size={16} /> Apri porta</button>
            <button data-testid="intercom-hangup" onClick={hangup} className="flex-1 min-w-[130px] px-4 py-3 rounded-2xl btn-danger font-semibold flex items-center justify-center gap-2"><PhoneOff size={16} /> Riaggancia</button>
          </>
        ) : (
          <>
            <button data-testid="intercom-simulate-ring" onClick={simulateRing} className="px-4 py-2.5 rounded-2xl btn-acc font-semibold text-sm flex items-center gap-2"><Bell size={15} /> Simula chiamata</button>
            <button data-testid="intercom-mute" onClick={mute} className="px-3 py-2.5 rounded-2xl btn-ghost flex items-center gap-2 text-sm">
              {s.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}{s.muted ? "Silenzioso" : "Suono attivo"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
