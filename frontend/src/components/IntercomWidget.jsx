import { useState } from "react";
import { Bell, PhoneOff, DoorOpen, Volume2, VolumeX, Lock, Unlock, Video } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { IntercomAPI } from "@/lib/api";
import { toast } from "sonner";
import CameraDetail from "@/components/CameraDetail";
import { camBg } from "@/components/CameraGrid";
import { fmtTime } from "@/lib/security";

// Intercoms and video doorbells (Blink, Tapo, Ring…) in one widget.
export default function IntercomWidget({ items: itemsProp }) {
  const { entities } = useDomus();
  const items = itemsProp || entities.filter((e) => e.type === "intercom" || e.type === "doorbell");
  if (items.length === 0) return null;
  return (
    <div className="space-y-4" data-testid="intercom-widget">
      {items.map((it, i) => <IntercomCard key={it.id} item={it} idx={i} />)}
    </div>
  );
}

function IntercomCard({ item, idx }) {
  const { updateEntity, reloadEvents, askPin } = useDomus();
  const [detail, setDetail] = useState(false);
  const s = item.state || {};
  const isDoorbell = item.type === "doorbell";
  const lastKey = isDoorbell ? "last_ring" : "last_call";

  const simulateRing = async () => { await IntercomAPI.ring(item.id); await reloadEvents(); toast.info("Qualcuno sta suonando…"); };
  const unlock = async () => {
    const { ok, pin } = await askPin("sensitive", `Apri la porta · ${item.name}`);
    if (!ok) return;
    try { await IntercomAPI.answer(item.id, "unlock", pin); await reloadEvents(); toast.success("Porta aperta"); }
    catch (err) { toast.error(err?.response?.data?.detail || "Apertura non riuscita"); }
  };
  const hangup = async () => { await IntercomAPI.answer(item.id, "hangup"); await reloadEvents(); toast.info("Chiamata terminata"); };
  const mute = async () => { await updateEntity(item.id, { state: { muted: !s.muted } }); };

  return (
    <div className={`glass rounded-[28px] p-6 relative overflow-hidden ${s.ringing ? "ring-2 ring-[rgb(var(--acc)/0.6)]" : ""}`} data-testid={`intercom-card-${item.id}`}>
      {s.ringing && <div className="absolute inset-0 bg-acc-soft animate-pulse pointer-events-none" />}
      <div className="relative flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="label text-acc">{isDoorbell ? "Videocitofono" : "Citofono"}</div>
          <h3 className="font-display text-lg font-semibold leading-snug break-words" data-testid={`intercom-name-${item.id}`}>{item.name}</h3>
          <div className="label mt-0.5">{item.integration}{s.battery != null ? ` · batteria ${Math.round(s.battery)}%` : ""}</div>
        </div>
        <div className={`icon-btn w-12 h-12 shrink-0 ${s.ringing ? "icon-on" : "icon-off"}`}><Bell size={22} className={s.ringing ? "animate-bounce" : ""} /></div>
      </div>

      {isDoorbell && (
        <button onClick={() => setDetail(true)} className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden mb-3 group" data-testid={`intercom-preview-${item.id}`}>
          <img src={camBg(item, idx)} alt={item.name} className="absolute inset-0 w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute bottom-2 left-3 text-white text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1"><Video size={11} /> Anteprima live</span>
          {s.motion && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-semibold uppercase">Movimento</span>}
        </button>
      )}

      <div className="relative text-sm text-muted mb-4 flex items-center justify-between gap-2">
        {s.ringing ? <span className="font-semibold text-acc">Chiamata in arrivo…</span>
          : <span>Ultima chiamata: <span className="font-mono" data-testid={`intercom-last-${item.id}`}>{fmtTime(s[lastKey])}</span></span>}
        {s.has_lock && <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.locked === false ? "text-emerald-700 dark:text-emerald-300" : ""}`} data-testid={`intercom-lock-${item.id}`}>{s.locked === false ? <Unlock size={12} /> : <Lock size={12} />} {s.locked === false ? "Porta aperta" : "Porta chiusa"}</span>}
      </div>

      <div className="relative flex flex-wrap gap-2">
        {s.ringing ? (
          <>
            <button data-testid={`intercom-unlock-${item.id}`} onClick={unlock} className="flex-1 min-w-[130px] px-4 py-3 rounded-2xl btn-acc font-semibold flex items-center justify-center gap-2"><DoorOpen size={16} /> Apri porta</button>
            <button data-testid={`intercom-hangup-${item.id}`} onClick={hangup} className="flex-1 min-w-[130px] px-4 py-3 rounded-2xl btn-danger font-semibold flex items-center justify-center gap-2"><PhoneOff size={16} /> Riaggancia</button>
          </>
        ) : (
          <>
            <button data-testid={`intercom-simulate-ring-${item.id}`} onClick={simulateRing} className="px-4 py-2.5 rounded-2xl btn-acc font-semibold text-sm flex items-center gap-2"><Bell size={15} /> Simula chiamata</button>
            {s.has_lock && <button data-testid={`intercom-open-${item.id}`} onClick={unlock} className="px-3 py-2.5 rounded-2xl btn-ghost flex items-center gap-2 text-sm"><DoorOpen size={15} /> Apri</button>}
            <button data-testid={`intercom-mute-${item.id}`} onClick={mute} className="px-3 py-2.5 rounded-2xl btn-ghost flex items-center gap-2 text-sm">
              {s.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}{s.muted ? "Silenzioso" : "Suono attivo"}
            </button>
            {isDoorbell && <button onClick={() => setDetail(true)} className="ml-auto chip" data-testid={`intercom-settings-${item.id}`}>Impostazioni</button>}
          </>
        )}
      </div>
      {isDoorbell && <CameraDetail cam={item} bg={camBg(item, idx)} open={detail} onClose={() => setDetail(false)} />}
    </div>
  );
}
