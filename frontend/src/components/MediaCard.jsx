import { Play, Pause, SkipBack, SkipForward, Power, Volume2, VolumeX, Settings2, Tv, Speaker, Music2 } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { useDebouncedCommit } from "@/hooks/useDebouncedCommit";
import { iconFor } from "@/lib/icons";
import { HAAPI } from "@/lib/api";

export const fmtDur = (sec) => { if (!sec && sec !== 0) return "--:--"; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, "0")}`; };
export const artUrl = (s) => (s?.media_image_url ? (s.media_image_url.startsWith("/") ? HAAPI.proxyUrl(s.media_image_url) : s.media_image_url) : null);
const APP_TINT = { Netflix: "#b81d24", YouTube: "#e62117", "Prime Video": "#00a8e1", "Disney+": "#1a3a8f", Spotify: "#1db954", DAZN: "#0a0a0a", RaiPlay: "#0a4a8f", "Amazon Music": "#25d1da", TuneIn: "#1c203c" };

export default function MediaCard({ entity, onOpen }) {
  const { mediaCommand, rooms } = useDomus();
  const s = entity.state || {};
  const isTv = s.device_class === "tv";
  const Icon = iconFor(entity.icon, isTv ? Tv : Speaker);
  const playing = s.status === "playing";
  const room = rooms.find((r) => r.id === entity.room_id);
  const tint = APP_TINT[s.app] || APP_TINT[s.media_artist] || null;
  const art = artUrl(s);
  const [vol, setVol] = useDebouncedCommit(s.volume ?? 0, (v) => mediaCommand(entity.id, "volume_set", v));
  const cmd = (c, v) => mediaCommand(entity.id, c, v);
  const pct = s.media_duration ? Math.min(100, ((s.media_position || 0) / s.media_duration) * 100) : 0;

  return (
    <div className={`relative glass rounded-[28px] overflow-hidden bubble ${entity.available === false ? "ring-1 ring-amber-400/60" : ""}`} data-testid={`media-card-${entity.id}`} data-status={s.status}>
      {s.power && (art || tint) && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {art ? <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-2xl scale-125" /> : <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at 20% 0%, ${tint}, transparent 60%)` }} />}
        </div>
      )}
      <div className="relative p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => cmd(s.power ? "turn_off" : "turn_on")} className={`icon-btn w-11 h-11 shrink-0 ${s.power ? "icon-on" : "icon-off"}`} data-testid={`media-power-${entity.id}`} aria-pressed={!!s.power} title={s.power ? "Spegni" : "Accendi"}>
            <Icon size={19} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-snug break-words line-clamp-2" data-testid={`media-name-${entity.id}`}>{entity.name}</div>
            <div className="label flex items-center gap-1.5 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full ${entity.available === false ? "bg-amber-500" : playing ? "bg-emerald-500 animate-pulse" : s.power ? "bg-emerald-500/60" : "bg-slate-400"}`} />
              <span>{s.power ? (playing ? "in riproduzione" : s.status === "paused" ? "in pausa" : "acceso") : "spento"}</span>
              {room && <><span className="opacity-40">·</span><span>{room.name}</span></>}
            </div>
          </div>
          <button onClick={onOpen} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" data-testid={`media-open-${entity.id}`} title="Dettagli"><Settings2 size={15} /></button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-white" style={{ background: tint || "rgba(120,120,140,0.35)" }} data-testid={`media-art-${entity.id}`}>
            {art ? <img src={art} alt="" className="w-full h-full object-cover" /> : <Music2 size={20} className="opacity-80" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" data-testid={`media-title-${entity.id}`}>{s.power ? s.media_title || (s.app ? `${s.app}` : "Nessun contenuto") : "—"}</div>
            <div className="text-xs text-muted truncate">{s.power ? [s.media_artist, s.app && s.app !== s.media_artist ? s.app : null, s.source].filter(Boolean).join(" · ") || "in attesa" : "spento"}</div>
            {s.power && s.media_duration > 0 && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-muted">
                <span>{fmtDur(s.media_position)}</span>
                <div className="flex-1 h-1 rounded-full bg-white/40 dark:bg-white/10 overflow-hidden"><div className="h-full bg-[rgb(var(--acc-strong))] transition-[width] duration-1000" style={{ width: `${pct}%` }} /></div>
                <span>{fmtDur(s.media_duration)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Ctl onClick={() => cmd("previous")} disabled={!s.power} testid={`media-prev-${entity.id}`}><SkipBack size={15} /></Ctl>
            <Ctl onClick={() => cmd("play_pause")} disabled={!s.power} primary testid={`media-play-${entity.id}`}>{playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}</Ctl>
            <Ctl onClick={() => cmd("next")} disabled={!s.power} testid={`media-next-${entity.id}`}><SkipForward size={15} /></Ctl>
          </div>
          <button onClick={() => cmd("mute", !s.muted)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center shrink-0" data-testid={`media-mute-${entity.id}`} aria-pressed={!!s.muted}>{s.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(parseInt(e.target.value, 10))} className="slider flex-1" style={{ "--fill": `${vol}%` }} data-testid={`media-volume-${entity.id}`} disabled={!s.power} />
          <span className="text-[11px] font-mono text-muted w-8 text-right">{vol}%</span>
        </div>

        {isTv && (s.app_list || []).length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap" data-testid={`media-apps-${entity.id}`}>
            {(s.app_list || []).slice(0, 4).map((a) => (
              <button key={a.id} onClick={() => cmd("launch_app", a.id)} className={`chip !py-1 !px-2.5 !text-[11px] ${s.app === a.name ? "chip-active" : ""}`} data-testid={`media-app-${entity.id}-${a.name.replace(/\W+/g, "")}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: APP_TINT[a.name] || "#888" }} /> {a.name}
              </button>
            ))}
            <button onClick={onOpen} className="chip !py-1 !px-2.5 !text-[11px]">Tutte le app…</button>
          </div>
        )}
        {!isTv && <div className="mt-3 flex items-center gap-1.5"><Power size={11} className="text-muted" /><span className="text-[11px] text-muted">{s.screen ? "Altoparlante con schermo" : "Altoparlante"} · annunci vocali disponibili</span></div>}
      </div>
    </div>
  );
}

function Ctl({ children, onClick, disabled, primary, testid }) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testid}
      className={`rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${primary ? "w-10 h-10 bg-[rgb(var(--acc-strong))] text-white hover:opacity-90" : "w-8 h-8 btn-ghost"}`}>
      {children}
    </button>
  );
}
