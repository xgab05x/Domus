import { useEffect, useState } from "react";
import { Circle, Expand, Video, VideoOff, EyeOff, Moon, Bell, BatteryMedium, Settings2 } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import CameraDetail from "@/components/CameraDetail";
import { CamerasAPI } from "@/lib/api";

export const CAM_BG = [
  "https://images.pexels.com/photos/39457148/pexels-photo-39457148.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/24346971/pexels-photo-24346971.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/19473771/pexels-photo-19473771.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.unsplash.com/photo-1751945965597-71171ec7a458?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NxA5NXx8MHwxfHNlYXJjaHwzfHxzbWFydCUyMGhvbWUlMjBtb2Rlcm4lMjBpbnRlcmlvciUyMGxpdmluZyUyMHJvb20lMjBhbWJpZW50JTIwbGlnaHRpbmd8ZW58MHx8fHwxNzkwMjkyNzM2fDA&ixlib=rb-4.1.0&q=85",
  "https://images.pexels.com/photos/101808/pexels-photo-101808.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
];

export const camBg = (cam, idx) => CAM_BG[(cam.name.length + idx) % CAM_BG.length];

export default function CameraGrid({ cams: camsProp, columns = "grid-cols-1 sm:grid-cols-2" }) {
  const { entities, updateEntity, ha } = useDomus();
  const cams = camsProp || entities.filter((e) => e.type === "camera" || e.type === "doorbell");
  const [focused, setFocused] = useState(null);
  const focusedCam = entities.find((c) => c.id === focused);

  return (
    <div className="space-y-4" data-testid="camera-grid">
      <div className={`grid ${columns} gap-4`}>
        {cams.map((c, i) => (
          <CamCard key={c.id} cam={c} bg={camBg(c, i)} live={!!(ha?.connected && c.ha_entity_id)} onOpen={() => setFocused(c.id)} onToggleRec={() => updateEntity(c.id, { state: { recording: !c.state?.recording } })} />
        ))}
        {cams.length === 0 && <div className="glass rounded-3xl p-8 text-center text-sm text-muted col-span-full" data-testid="cameras-empty">Nessuna telecamera in questa vista.</div>}
      </div>
      <CameraDetail cam={focusedCam} bg={focusedCam ? camBg(focusedCam, cams.indexOf(focusedCam)) : null} open={!!focusedCam} onClose={() => setFocused(null)} />
    </div>
  );
}

function CamCard({ cam, bg, live, onOpen, onToggleRec }) {
  const s = cam.state || {};
  const isDoorbell = cam.type === "doorbell";
  const offline = cam.available === false;
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!live) return undefined; const t = setInterval(() => setTick((x) => x + 1), 10000); return () => clearInterval(t); }, [live]);
  return (
    <div className={`glass rounded-3xl overflow-hidden group relative cursor-pointer ${s.ringing ? "ring-2 ring-[rgb(var(--acc)/0.7)]" : ""} ${offline ? "ring-1 ring-amber-400/60" : ""}`} data-testid={`cam-card-${cam.id}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="relative aspect-video overflow-hidden bg-slate-900">
        {s.privacy ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-1.5"><EyeOff size={28} /><span className="text-[10px] uppercase tracking-widest font-semibold">Privacy attiva</span></div>
        ) : (
          <img src={live ? CamerasAPI.snapshotUrl(cam.id, tick) : bg} alt={cam.name} onError={(e) => { e.currentTarget.src = bg; }}
            className="absolute inset-0 w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
            style={{ filter: s.night_vision === "on" ? "grayscale(1) brightness(0.9) contrast(1.15)" : "brightness(0.75) saturate(0.9)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] uppercase tracking-widest text-white font-semibold">
            <span className={`w-1.5 h-1.5 rounded-full ${offline ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} /> {offline ? "Offline" : live ? "Live" : "Live demo"}
          </span>
          {s.recording && <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-600/80 text-[10px] uppercase tracking-widest text-white font-semibold"><Circle size={8} className="fill-white" /> Rec</span>}
          {s.motion && <span className="px-2 py-1 rounded-full bg-amber-500/90 text-[10px] uppercase tracking-widest text-white font-semibold" data-testid={`cam-motion-${cam.id}`}>Movimento</span>}
          {s.night_vision === "on" && <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/80 text-[10px] uppercase tracking-widest text-white font-semibold"><Moon size={9} /> Notte</span>}
          {isDoorbell && <span className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur text-[10px] uppercase tracking-widest text-white font-semibold" data-testid={`cam-doorbell-badge-${cam.id}`}><Bell size={9} className={s.ringing ? "animate-bounce" : ""} /> {s.ringing ? "Suona" : "Citofono"}</span>}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="text-white min-w-0">
            <div className="font-semibold text-sm leading-snug break-words line-clamp-2" title={cam.name} data-testid={`cam-name-${cam.id}`}>{cam.name}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70 flex items-center gap-2">
              <span>{cam.integration}</span>
              {s.battery != null && <span className="flex items-center gap-0.5 normal-case tracking-normal"><BatteryMedium size={10} /> {Math.round(s.battery)}%</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconBtn testid={`cam-rec-${cam.id}`} onClick={onToggleRec} title="Registrazione">{s.recording ? <VideoOff size={16} /> : <Video size={16} />}</IconBtn>
            <IconBtn testid={`cam-settings-${cam.id}`} onClick={onOpen} title="Impostazioni"><Settings2 size={16} /></IconBtn>
            <IconBtn testid={`cam-expand-${cam.id}`} onClick={onOpen} title="Espandi"><Expand size={16} /></IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, testid }) {
  return (
    <button data-testid={testid} onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} title={title}
      className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition">
      {children}
    </button>
  );
}
