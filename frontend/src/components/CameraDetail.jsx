import { useEffect, useState } from "react";
import { Cctv, EyeOff, Moon, Radar, Siren, Lightbulb, FlipHorizontal2, Video, VideoOff, Camera, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Bell, DoorOpen, Volume2, VolumeX, Zap, BatteryMedium, Wifi, Cpu, Download, Cast } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import CameraPlayer from "@/components/CameraPlayer";
import CastTargets from "@/components/CastTargets";
import AutomationsPanel from "@/components/AutomationsPanel";
import IconPicker, { IconButton } from "@/components/IconPicker";
import { useDomus } from "@/context/DomusContext";
import { CamerasAPI, IntercomAPI } from "@/lib/api";
import { TONE, batteryTone, fmtTime } from "@/lib/security";

const NV = [{ k: "auto", l: "Auto" }, { k: "on", l: "Sempre" }, { k: "off", l: "Off" }];

// Full camera / video-doorbell control panel: live view, PTZ, privacy, night vision, motion detection, siren, LED, flip, recording, presets.
export default function CameraDetail({ cam, bg, open, onClose }) {
  const { rooms, updateEntity, deleteEntity, reloadEvents, ha, events, askPin } = useDomus();
  const [name, setName] = useState(cam?.name || "");
  const [picker, setPicker] = useState(false);
  const [snap, setSnap] = useState(null);
  const [castOpen, setCastOpen] = useState(false);
  useEffect(() => { setName(cam?.name || ""); setSnap(null); }, [cam?.id, cam?.name, open]);
  if (!open || !cam) return null;

  const s = cam.state || {};
  const isDoorbell = cam.type === "doorbell";
  const live = ha?.connected && cam.ha_entity_id;
  const set = async (patch, msg) => {
    const sensitive = ["privacy", "siren", "locked"].some((k) => k in patch);
    let pin = null;
    if (sensitive) {
      const res = await askPin("sensitive", `${patch.privacy !== undefined ? "Modalità privacy" : "Sirena"} · ${cam.name}`);
      if (!res.ok) return;
      pin = res.pin;
    }
    try { await updateEntity(cam.id, { state: patch, ...(pin ? { pin } : {}) }); if (msg) toast.success(msg); }
    catch (err) { toast.error(err?.response?.data?.detail || "Comando non riuscito"); }
  };
  const saveName = async () => { if (name.trim() && name.trim() !== cam.name) { await updateEntity(cam.id, { name: name.trim() }); toast.success("Nome aggiornato"); } };
  const ptz = async (direction) => { await CamerasAPI.ptz(cam.id, { direction }); };
  const preset = async (p) => { await CamerasAPI.ptz(cam.id, { preset: p }); await reloadEvents(); toast.success(`Preset ${p}`); };
  const snapshot = () => { if (live) setSnap(CamerasAPI.snapshotUrl(cam.id, Date.now())); else toast.info("Snapshot reale disponibile con Home Assistant connesso · mostrata l'anteprima demo"); };
  const simulate = async () => { await CamerasAPI.simulateMotion(cam.id); await reloadEvents(); };
  const ring = async () => { await IntercomAPI.ring(cam.id); await reloadEvents(); toast.info("Campanello simulato"); };
  const answer = async (action) => {
    let pin = null;
    if (action === "unlock") {
      const res = await askPin("sensitive", `Apri la porta · ${cam.name}`);
      if (!res.ok) return;
      pin = res.pin;
    }
    try { await IntercomAPI.answer(cam.id, action, pin); await reloadEvents(); toast.success(action === "unlock" ? "Porta aperta" : "Chiamata chiusa"); }
    catch (err) { toast.error(err?.response?.data?.detail || "Comando non riuscito"); }
  };
  const remove = async () => { if (!window.confirm(`Eliminare "${cam.name}"?`)) return; await deleteEntity(cam.id); onClose(); toast.success("Dispositivo eliminato"); };
  const history = events.filter((ev) => ev.source === cam.name).slice(0, 8);

  return (
    <Modal open={open} onClose={onClose} title={cam.name} subtitle={`${isDoorbell ? "Videocitofono" : "Telecamera"} · ${cam.integration}${s.model ? ` · ${s.model}` : ""}`} icon={isDoorbell ? <Bell size={18} /> : <Cctv size={18} />} testid="camera-detail" width="max-w-5xl"
      footer={<>
        <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="camera-delete"><Trash2 size={14} /> Elimina</button>
        <button onClick={onClose} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold" data-testid="camera-done">Fatto</button>
      </>}>
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-black" data-testid="camera-live">
            {s.privacy ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2 bg-slate-900"><EyeOff size={40} /><div className="text-sm font-semibold">Modalità privacy attiva</div><div className="text-xs opacity-70">L'obiettivo è coperto, nessun flusso video.</div></div>
            ) : (
              <>
                <CameraPlayer cam={cam} bg={bg} live={!!live} nightVision={s.night_vision} />
                {snap && <img src={snap} alt="snapshot" className="absolute inset-0 w-full h-full object-cover" data-testid="camera-snap-overlay" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
              </>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap z-10">
              {s.recording && <Badge tone="bg-rose-600/80">Rec</Badge>}
              {s.motion && <Badge tone="bg-amber-500/90">Movimento</Badge>}
              {s.night_vision === "on" && <Badge tone="bg-indigo-500/80"><Moon size={10} /> Notte</Badge>}
              {isDoorbell && s.ringing && <Badge tone="bg-[rgb(var(--acc-strong))]"><Bell size={10} /> Sta suonando</Badge>}
            </div>
            {s.ptz && !s.privacy && (
              <div className="absolute right-3 bottom-3 grid grid-cols-3 gap-1 p-1.5 rounded-2xl bg-black/50 backdrop-blur z-10" data-testid="ptz-pad">
                <span /><PtzBtn onClick={() => ptz("up")} testid="ptz-up"><ChevronUp size={16} /></PtzBtn><span />
                <PtzBtn onClick={() => ptz("left")} testid="ptz-left"><ChevronLeft size={16} /></PtzBtn>
                <PtzBtn onClick={() => ptz("zoom_in")} testid="ptz-zoom-in"><ZoomIn size={14} /></PtzBtn>
                <PtzBtn onClick={() => ptz("right")} testid="ptz-right"><ChevronRight size={16} /></PtzBtn>
                <span /><PtzBtn onClick={() => ptz("down")} testid="ptz-down"><ChevronDown size={16} /></PtzBtn><PtzBtn onClick={() => ptz("zoom_out")} testid="ptz-zoom-out"><ZoomOut size={14} /></PtzBtn>
              </div>
            )}
            <div className="absolute left-3 bottom-3 flex items-center gap-1.5 z-10">
              <button onClick={snapshot} className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-semibold flex items-center gap-1" data-testid="camera-snapshot"><Camera size={13} /> Snapshot</button>
              <button onClick={() => setCastOpen(true)} className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-semibold flex items-center gap-1" data-testid="camera-cast"><Cast size={13} /> Trasmetti</button>
              {snap && <>
                <a href={snap} download={`${cam.name}.jpg`} className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-semibold flex items-center gap-1" data-testid="camera-snapshot-download"><Download size={13} /> Salva</a>
                <button onClick={() => setSnap(null)} className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-semibold" data-testid="camera-snapshot-close">Torna al live</button>
              </>}
              <button onClick={() => set({ recording: !s.recording }, s.recording ? "Registrazione fermata" : "Registrazione avviata")} className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-semibold flex items-center gap-1" data-testid="camera-record">
                {s.recording ? <VideoOff size={13} /> : <Video size={13} />} {s.recording ? "Stop rec" : "Registra"}
              </button>
            </div>
          </div>

          {(s.ptz_presets || []).length > 0 && (
            <div>
              <div className="label mb-1.5">Preset PTZ</div>
              <div className="flex gap-1.5 flex-wrap">
                {s.ptz_presets.map((p) => <button key={p} onClick={() => preset(p)} className={`chip ${s.ptz_preset === p ? "chip-active" : ""}`} data-testid={`ptz-preset-${p}`}>{p}</button>)}
              </div>
            </div>
          )}

          {isDoorbell && (
            <div className={`rounded-3xl p-4 ${s.ringing ? "bg-acc-soft ring-2 ring-[rgb(var(--acc)/0.6)]" : "glass-inner"}`} data-testid="doorbell-panel">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div><div className="label text-acc">Videocitofono</div><div className="font-semibold text-sm">{s.ringing ? "Qualcuno sta suonando…" : `Ultima suonata: ${fmtTime(s.last_ring)}`}</div></div>
                <div className={`icon-btn w-11 h-11 ${s.ringing ? "icon-on" : "icon-off"}`}><Bell size={20} className={s.ringing ? "animate-bounce" : ""} /></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {s.has_lock && <button onClick={() => answer("unlock")} className="btn-acc px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-1.5" data-testid="doorbell-unlock"><DoorOpen size={15} /> {s.locked === false ? "Porta aperta" : "Apri porta"}</button>}
                {s.ringing ? <button onClick={() => answer("hangup")} className="btn-danger px-4 py-2 rounded-2xl text-sm font-semibold" data-testid="doorbell-hangup">Chiudi chiamata</button>
                  : <button onClick={ring} className="chip" data-testid="doorbell-simulate-ring"><Bell size={13} /> Simula campanello</button>}
                <button onClick={() => set({ muted: !s.muted })} className="chip" data-testid="doorbell-mute">{s.muted ? <VolumeX size={13} /> : <Volume2 size={13} />} {s.muted ? "Silenzioso" : "Suono attivo"}</button>
                <button onClick={() => set({ chime: !s.chime })} className={`chip ${s.chime ? "chip-active" : ""}`} data-testid="doorbell-chime">Campanello interno {s.chime ? "on" : "off"}</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat icon={<BatteryMedium size={12} />} label="Batteria" value={s.battery != null ? `${Math.round(s.battery)}%` : "rete"} tone={s.battery != null ? batteryTone(s.battery) : "slate"} testid="camera-battery" />
            <Stat icon={<Wifi size={12} />} label="Segnale" value={s.signal != null ? `${Math.round(s.signal)}%` : "—"} tone={s.signal != null && s.signal < 50 ? "amber" : "slate"} />
            <Stat icon={<Radar size={12} />} label="Ultimo movimento" value={fmtTime(s.last_motion)} tone="slate" />
            <Stat icon={<Cpu size={12} />} label="Home Assistant" value={cam.ha_entity_id ? "collegata" : "demo"} tone={cam.ha_entity_id ? "emerald" : "slate"} />
          </div>
          {cam.ha_entity_id && <div className="text-xs text-muted font-mono">{cam.ha_entity_id}{Object.keys(cam.controls || {}).length ? ` · controlli: ${Object.keys(cam.controls).join(", ")}` : ""}</div>}
        </div>

        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">Nome e icona</div>
            <div className="flex gap-2 items-center">
              <IconButton value={cam.icon} onClick={() => setPicker(true)} testid="camera-icon-btn" />
              <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()} data-testid="camera-name-input" />
            </div>
            {cam.ha_name && <p className="text-[11px] text-muted mt-1">Nome in Home Assistant: <span className="font-mono">{cam.ha_name}</span> · {cam.ha_entity_id} (il tuo alias non lo modifica)</p>}
          </div>
          <div>
            <div className="label mb-1.5">Stanza / zona</div>
            <select className="field" value={cam.room_id || ""} onChange={(e) => updateEntity(cam.id, { room_id: e.target.value || null }).then(() => toast.success("Stanza aggiornata"))} data-testid="camera-room">
              <option value="">Esterno / nessuna</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="label mb-1.5">Impostazioni telecamera</div>
            <Toggle icon={<EyeOff size={15} />} label="Modalità privacy" hint="Copre l'obiettivo e sospende il video" on={!!s.privacy} onClick={() => set({ privacy: !s.privacy }, s.privacy ? "Privacy disattivata" : "Privacy attiva")} testid="camera-privacy" />
            <div className="glass-inner rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm flex items-center gap-2"><Moon size={15} /> Visione notturna</span>
                <div className="flex gap-1 p-0.5 rounded-full bg-white/40 dark:bg-white/5">
                  {NV.map((o) => <button key={o.k} onClick={() => set({ night_vision: o.k })} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${s.night_vision === o.k ? "bg-[rgb(var(--acc-strong))] text-white" : "hover:bg-white/60 dark:hover:bg-white/10"}`} data-testid={`camera-nv-${o.k}`}>{o.l}</button>)}
                </div>
              </div>
            </div>
            <Toggle icon={<Radar size={15} />} label="Rilevamento movimento" hint="Notifiche e registrazione su movimento" on={s.motion_detection !== false} onClick={() => set({ motion_detection: !(s.motion_detection !== false) })} testid="camera-motion-detection" />
            <Toggle icon={<Siren size={15} />} label="Sirena" hint="Allarme acustico sulla telecamera" on={!!s.siren} danger onClick={() => set({ siren: !s.siren }, s.siren ? "Sirena spenta" : "Sirena attivata!")} testid="camera-siren" />
            <Toggle icon={<Lightbulb size={15} />} label="LED di stato" on={s.led !== false} onClick={() => set({ led: !(s.led !== false) })} testid="camera-led" />
            <Toggle icon={<FlipHorizontal2 size={15} />} label="Immagine capovolta" on={!!s.flip} onClick={() => set({ flip: !s.flip })} testid="camera-flip" />
          </div>

          <button onClick={simulate} className="w-full chip justify-center" data-testid="camera-simulate-motion"><Zap size={13} /> Simula movimento</button>

          <div className="pt-1">
            <div className="label mb-1.5">{isDoorbell || cam.type === "intercom" ? "Quando suonano: azioni e tasti funzione" : "Quando rileva movimento: azioni"}</div>
            <AutomationsPanel compact entityId={cam.id}
              defaults={{ owner: cam.id, name: "", triggers: isDoorbell || cam.type === "intercom" ? [{ type: "ring", entity_id: cam.id }] : [{ type: "state", entity_id: cam.id, key: "motion", op: "on" }], actions: [] }} />
            <p className="text-[11px] text-muted mt-1.5">Queste automazioni compaiono come tasti nella finestra che si apre quando suonano (es. apri cancello con impulso, accendi una luce, attiva una scena).</p>
          </div>

          {history.length > 0 && (
            <div>
              <div className="label mb-1.5">Ultimi eventi</div>
              <div className="space-y-1">{history.map((ev) => <div key={ev.id} className="text-xs flex justify-between gap-2 glass-inner rounded-xl px-3 py-1.5"><span className="truncate">{ev.message}</span><span className="font-mono text-muted shrink-0">{new Date(ev.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span></div>)}</div>
            </div>
          )}
        </div>
      </div>
      <IconPicker open={picker} onClose={() => setPicker(false)} value={cam.icon} onChange={async (icon) => { await updateEntity(cam.id, { icon }); toast.success("Icona aggiornata"); }} title={`Icona per ${cam.name}`} />
      <CastTargets open={castOpen} onClose={() => setCastOpen(false)} title={`Trasmetti «${cam.name}»`} subtitle="La telecamera viene mostrata sullo schermo scelto"
        payloadFor={() => ({ kind: "camera", camera_id: cam.id })} />
    </Modal>
  );
}

function Toggle({ icon, label, hint, on, onClick, danger, testid }) {
  return (
    <button onClick={onClick} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left" data-testid={testid} aria-pressed={on}>
      <span className="min-w-0"><span className={`text-sm flex items-center gap-2 ${danger && on ? "text-rose-700 dark:text-rose-300 font-semibold" : ""}`}>{icon} {label}</span>{hint && <span className="block text-[11px] text-muted mt-0.5">{hint}</span>}</span>
      <span className={`toggle shrink-0 ${on ? "on" : ""}`} />
    </button>
  );
}

function Badge({ tone, children }) {
  return <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${tone} backdrop-blur text-[10px] uppercase tracking-widest text-white font-semibold`}>{children}</span>;
}

function PtzBtn({ children, onClick, testid }) {
  return <button onClick={onClick} className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/35 text-white flex items-center justify-center transition-colors" data-testid={testid}>{children}</button>;
}

function Stat({ icon, label, value, tone, testid }) {
  return (
    <div className="glass-inner rounded-2xl p-3" data-testid={testid}>
      <div className="label flex items-center gap-1">{icon} {label}</div>
      <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${TONE[tone] || TONE.slate}`}>{value}</div>
    </div>
  );
}
