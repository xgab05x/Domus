import { useState } from "react";
import { Cctv, Circle, Move3d, Expand, Video, VideoOff } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { toast } from "sonner";

const CAM_BG = [
  "https://images.pexels.com/photos/39457148/pexels-photo-39457148.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/24346971/pexels-photo-24346971.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/19473771/pexels-photo-19473771.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.unsplash.com/photo-1751945965597-71171ec7a458?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NxA5NXx8MHwxfHNlYXJjaHwzfHxzbWFydCUyMGhvbWUlMjBtb2Rlcm4lMjBpbnRlcmlvciUyMGxpdmluZyUyMHJvb20lMjBhbWJpZW50JTIwbGlnaHRpbmd8ZW58MHx8fHwxNzkwMjkyNzM2fDA&ixlib=rb-4.1.0&q=85",
];

export default function CameraGrid() {
  const { entities, updateEntity } = useDomus();
  const cams = entities.filter((e) => e.type === "camera");
  const [focused, setFocused] = useState(null);
  const focusedCam = cams.find((c) => c.id === focused);

  return (
    <div className="space-y-4" data-testid="camera-grid">
      {focusedCam && (
        <FocusedView
          cam={focusedCam}
          idx={cams.indexOf(focusedCam)}
          onClose={() => setFocused(null)}
          onToggleRec={() => updateEntity(focusedCam.id, { state: { recording: !focusedCam.state.recording } })}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cams.map((c, i) => (
          <CamCard key={c.id} cam={c} idx={i} onExpand={() => setFocused(c.id)} onToggleRec={() => updateEntity(c.id, { state: { recording: !c.state.recording } })} />
        ))}
      </div>
    </div>
  );
}

function CamCard({ cam, idx, onExpand, onToggleRec }) {
  const bg = CAM_BG[idx % CAM_BG.length];
  const motion = !!cam.state?.motion;
  return (
    <div className="glass rounded-3xl overflow-hidden group relative" data-testid={`cam-card-${cam.id}`}>
      <div className="relative aspect-video overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 group-hover:scale-100 transition-transform duration-700"
          style={{ backgroundImage: `url(${bg})`, filter: "brightness(0.75) saturate(0.9)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Overlays */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] uppercase tracking-widest text-white font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
          {cam.state?.recording && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-600/80 text-[10px] uppercase tracking-widest text-white font-semibold">
              <Circle size={8} className="fill-white" /> Rec
            </span>
          )}
          {motion && (
            <span className="px-2 py-1 rounded-full bg-amber-500/90 text-[10px] uppercase tracking-widest text-white font-semibold">
              Movimento
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="text-white">
            <div className="font-semibold text-sm">{cam.name}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">{cam.integration}</div>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn testid={`cam-rec-${cam.id}`} onClick={onToggleRec} title="Registrazione">
              {cam.state?.recording ? <VideoOff size={16} /> : <Video size={16} />}
            </IconBtn>
            <IconBtn testid={`cam-expand-${cam.id}`} onClick={onExpand} title="Espandi">
              <Expand size={16} />
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusedView({ cam, idx, onClose, onToggleRec }) {
  const bg = CAM_BG[idx % CAM_BG.length];
  return (
    <div className="fixed inset-0 z-40 p-6 flex items-center justify-center" data-testid="cam-focus">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-3xl overflow-hidden max-w-5xl w-full">
        <div className="relative aspect-video">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute top-4 left-4 text-white">
            <div className="font-display text-xl font-bold">{cam.name}</div>
            <div className="text-xs uppercase tracking-widest opacity-70">{cam.integration}</div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center" title="PTZ">
                <Move3d size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="focus-rec-btn" onClick={onToggleRec} className="px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1">
                {cam.state?.recording ? <VideoOff size={14} /> : <Video size={14} />}
                {cam.state?.recording ? "Stop Rec" : "Registra"}
              </button>
              <button data-testid="focus-close-btn" onClick={onClose} className="px-3 py-2 rounded-full bg-white text-slate-900 text-xs font-semibold">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      title={title}
      className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition"
    >
      {children}
    </button>
  );
}
