import { useEffect, useState } from "react";
import { Tv, Speaker, Play, Pause, SkipBack, SkipForward, Square, Shuffle, Repeat, Megaphone, MessageSquare, Trash2, Cpu, Music2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import IconPicker, { IconButton } from "@/components/IconPicker";
import { useDomus } from "@/context/DomusContext";
import { MediaAPI } from "@/lib/api";
import { useDebouncedCommit } from "@/hooks/useDebouncedCommit";
import { fmtDur, artUrl } from "@/components/MediaCard";

// Full media player editor: apps, sources, seek, shuffle/repeat, TTS / on-screen notify, rename/room/icon.
export default function MediaDetail({ entity, open, onClose }) {
  const { rooms, updateEntity, deleteEntity, mediaCommand, mergeEntities } = useDomus();
  const [name, setName] = useState(entity?.name || "");
  const [picker, setPicker] = useState(false);
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("Domus");
  useEffect(() => { setName(entity?.name || ""); }, [entity?.id, entity?.name, open]);
  const s = entity?.state || {};
  const [pos, setPos] = useDebouncedCommit(s.media_position ?? 0, (v) => entity && mediaCommand(entity.id, "seek", v));
  if (!open || !entity) return null;

  const isTv = s.device_class === "tv";
  const cmd = (c, v) => mediaCommand(entity.id, c, v);
  const saveName = async () => { if (name.trim() && name.trim() !== entity.name) { await updateEntity(entity.id, { name: name.trim() }); toast.success("Nome aggiornato"); } };
  const sendTts = async () => {
    if (!msg.trim()) return toast.error("Scrivi un messaggio");
    const r = await MediaAPI.tts(msg.trim(), [entity.id], true);
    toast.success(r.demo ? "Annuncio simulato (demo)" : "Annuncio inviato"); setMsg("");
    mergeEntities([{ ...entity, state: { ...s, last_tts: { message: msg.trim(), ts: new Date().toISOString() } } }]);
  };
  const sendNotify = async () => {
    if (!msg.trim()) return toast.error("Scrivi un messaggio");
    const r = await MediaAPI.notify(title, msg.trim(), [entity.id]);
    toast.success(r.demo ? "Notifica simulata (demo)" : "Notifica inviata allo schermo"); setMsg("");
  };
  const remove = async () => { if (!window.confirm(`Eliminare "${entity.name}"?`)) return; await deleteEntity(entity.id); onClose(); toast.success("Media player eliminato"); };
  const art = artUrl(s);

  return (
    <Modal open={open} onClose={onClose} title={entity.name} subtitle={`${isTv ? "Schermo" : "Altoparlante"} · ${entity.integration}${s.app ? ` · ${s.app}` : ""}`} icon={isTv ? <Tv size={18} /> : <Speaker size={18} />} testid="media-detail" width="max-w-4xl"
      footer={<>
        <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="media-delete"><Trash2 size={14} /> Elimina</button>
        <button onClick={onClose} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold" data-testid="media-done">Fatto</button>
      </>}>
      <div className="grid md:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-5">
          <div className="glass-inner rounded-3xl p-5 flex items-center gap-4" data-testid="media-now-playing">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-slate-500/30 text-white">{art ? <img src={art} alt="" className="w-full h-full object-cover" /> : <Music2 size={28} />}</div>
            <div className="flex-1 min-w-0">
              <div className="label">{s.power ? s.status === "playing" ? "In riproduzione" : s.status === "paused" ? "In pausa" : "Acceso" : "Spento"}</div>
              <div className="font-display text-xl font-semibold truncate">{s.media_title || s.app || "—"}</div>
              <div className="text-sm text-muted truncate">{[s.media_artist, s.media_album, s.source].filter(Boolean).join(" · ") || "nessun contenuto"}</div>
              {s.media_duration > 0 && (
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted">
                  <span>{fmtDur(pos)}</span>
                  <input type="range" min="0" max={s.media_duration} value={pos} onChange={(e) => setPos(parseInt(e.target.value, 10))} className="slider flex-1" style={{ "--fill": `${(pos / s.media_duration) * 100}%` }} data-testid="media-seek" />
                  <span>{fmtDur(s.media_duration)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Ctl onClick={() => cmd("shuffle", !s.shuffle)} active={!!s.shuffle} testid="media-shuffle"><Shuffle size={15} /></Ctl>
            <Ctl onClick={() => cmd("previous")} testid="media-detail-prev"><SkipBack size={17} /></Ctl>
            <button onClick={() => cmd("play_pause")} className="w-14 h-14 rounded-full bg-[rgb(var(--acc-strong))] text-white flex items-center justify-center hover:opacity-90" data-testid="media-detail-play">{s.status === "playing" ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}</button>
            <Ctl onClick={() => cmd("next")} testid="media-detail-next"><SkipForward size={17} /></Ctl>
            <Ctl onClick={() => cmd("stop")} testid="media-stop"><Square size={14} /></Ctl>
            <Ctl onClick={() => cmd("repeat", s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off")} active={s.repeat && s.repeat !== "off"} testid="media-repeat"><Repeat size={15} />{s.repeat === "one" && <span className="text-[9px] font-bold ml-0.5">1</span>}</Ctl>
            <button onClick={() => cmd(s.power ? "turn_off" : "turn_on")} className={`chip ${s.power ? "chip-active" : ""}`} data-testid="media-detail-power">{s.power ? "Spegni" : "Accendi"}</button>
          </div>

          {(s.app_list || []).length > 0 && (
            <div>
              <div className="label mb-2">App</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="media-app-grid">
                {s.app_list.map((a) => (
                  <button key={a.id} onClick={() => cmd("launch_app", a.id).then(() => toast.success(`${a.name} avviata`))} className={`glass-inner rounded-2xl px-3 py-3 text-sm font-semibold text-left hover:bg-white/60 dark:hover:bg-white/10 ${s.app === a.name ? "ring-2 ring-[rgb(var(--acc)/0.6)]" : ""}`} data-testid={`media-detail-app-${a.name.replace(/\W+/g, "")}`}>{a.name}</button>
                ))}
              </div>
            </div>
          )}
          {(s.source_list || []).length > 0 && (
            <div>
              <div className="label mb-2">Sorgente</div>
              <div className="flex gap-1.5 flex-wrap">{s.source_list.map((src) => <button key={src} onClick={() => cmd("select_source", src)} className={`chip ${s.source === src ? "chip-active" : ""}`} data-testid={`media-source-${src.replace(/\W+/g, "")}`}>{src}</button>)}</div>
            </div>
          )}

          <div className="glass-inner rounded-3xl p-4 space-y-2" data-testid="media-message-box">
            <div className="label">{isTv || s.screen ? "Annuncio vocale o notifica su schermo" : "Annuncio vocale"}</div>
            <div className="flex gap-2 flex-wrap">
              {(isTv || s.screen) && <input className="field !w-40" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo" data-testid="media-notify-title" />}
              <input className="field flex-1 min-w-[160px]" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Es. La cena è pronta!" data-testid="media-message" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={sendTts} className="btn-acc px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="media-send-tts"><Megaphone size={14} /> Parla</button>
              {(isTv || s.screen) && <button onClick={sendNotify} className="chip" data-testid="media-send-notify"><MessageSquare size={13} /> Mostra sullo schermo</button>}
            </div>
            {s.last_tts && <div className="text-[11px] text-muted">Ultimo annuncio: «{s.last_tts.message}»</div>}
            {s.last_notify && <div className="text-[11px] text-muted">Ultima notifica: «{s.last_notify.message}»</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">Nome e icona</div>
            <div className="flex gap-2 items-center">
              <IconButton value={entity.icon} onClick={() => setPicker(true)} testid="media-icon-btn" />
              <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()} data-testid="media-name-input" />
            </div>
          </div>
          <div>
            <div className="label mb-1.5">Stanza</div>
            <select className="field" value={entity.room_id || ""} onChange={(e) => updateEntity(entity.id, { room_id: e.target.value || null }).then(() => toast.success("Stanza aggiornata"))} data-testid="media-room">
              <option value="">Nessuna</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1.5">Tipo</div>
            <div className="flex gap-2">
              <button onClick={() => updateEntity(entity.id, { state: { device_class: "tv", screen: true } })} className={`chip ${isTv ? "chip-active" : ""}`} data-testid="media-class-tv"><Tv size={13} /> Schermo</button>
              <button onClick={() => updateEntity(entity.id, { state: { device_class: "speaker" } })} className={`chip ${!isTv ? "chip-active" : ""}`} data-testid="media-class-speaker"><Speaker size={13} /> Altoparlante</button>
            </div>
            {!isTv && <button onClick={() => updateEntity(entity.id, { state: { screen: !s.screen } })} className="mt-2 w-full glass-inner rounded-2xl px-3 py-2 flex items-center justify-between text-sm" data-testid="media-has-screen"><span>Ha uno schermo (Echo Show, Nest Hub)</span><span className={`toggle ${s.screen ? "on" : ""}`} /></button>}
          </div>
          <div className="glass-inner rounded-2xl p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold"><Cpu size={12} /> Home Assistant</div>
            <div className="font-mono text-muted break-all">{entity.ha_entity_id || "non collegato (demo)"}</div>
            {entity.controls?.notify_service && <div className="text-muted">notify: <span className="font-mono">{entity.controls.notify_service}</span></div>}
          </div>
        </div>
      </div>
      <IconPicker open={picker} onClose={() => setPicker(false)} value={entity.icon} onChange={async (icon) => { await updateEntity(entity.id, { icon }); toast.success("Icona aggiornata"); }} title={`Icona per ${entity.name}`} />
    </Modal>
  );
}

function Ctl({ children, onClick, active, testid }) {
  return <button onClick={onClick} className={`w-10 h-10 rounded-full flex items-center justify-center ${active ? "bg-acc-soft text-acc" : "btn-ghost"}`} data-testid={testid} aria-pressed={!!active}>{children}</button>;
}
