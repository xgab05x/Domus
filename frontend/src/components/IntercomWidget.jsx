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
    <div className={`glass rounded-3xl p-6 relative overflow-hidden ${s.ringing ? "ring-2 ring-amber-500 animate-pulse" : ""}`} data-testid="intercom-widget">
      {s.ringing && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 via-rose-400/20 to-amber-400/30 pointer-events-none" />
      )}
      <div className="relative flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-semibold">Citofono</div>
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">{intercom.name}</h3>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          s.ringing ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg" : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
        }`}>
          <Bell size={26} className={s.ringing ? "animate-bounce" : ""} />
        </div>
      </div>

      <div className="relative text-sm text-slate-600 dark:text-slate-300 mb-4">
        {s.ringing ? (
          <span className="font-semibold text-amber-600 dark:text-amber-400">Chiamata in arrivo…</span>
        ) : (
          <>Ultima chiamata: <span className="font-mono">{s.last_call ? new Date(s.last_call).toLocaleString("it-IT") : "—"}</span></>
        )}
      </div>

      <div className="relative flex flex-wrap gap-2">
        {s.ringing ? (
          <>
            <button data-testid="intercom-unlock" onClick={unlock} className="flex-1 min-w-[130px] px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg">
              <DoorOpen size={16} /> Apri porta
            </button>
            <button data-testid="intercom-hangup" onClick={hangup} className="flex-1 min-w-[130px] px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold flex items-center justify-center gap-2">
              <PhoneOff size={16} /> Riaggancia
            </button>
          </>
        ) : (
          <>
            <button data-testid="intercom-simulate-ring" onClick={simulateRing} className="px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold flex items-center gap-2">
              <Bell size={16} /> Simula chiamata
            </button>
            <button data-testid="intercom-mute" onClick={mute} className="px-3 py-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 flex items-center gap-2 text-sm">
              {s.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {s.muted ? "Silenzioso" : "Suono attivo"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
