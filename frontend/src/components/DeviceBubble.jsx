import { useState } from "react";
import {
  Lightbulb, Lamp, Wand2, Plug, Thermometer, Sparkles, Moon, Clapperboard, Sunrise as SunriseIco,
  Sunset as SunsetIco, PowerOff, UserCheck, MoveRight, MoreVertical, Trash2, Edit3
} from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { toast } from "sonner";

const iconMap = {
  lightbulb: Lightbulb, lamp: Lamp, wand: Wand2, plug: Plug, thermometer: Thermometer,
  sparkles: Sparkles, moon: Moon, clapperboard: Clapperboard, sunrise: SunriseIco, sunset: SunsetIco,
  "power-off": PowerOff, "user-check": UserCheck,
};

function rgbToHex(rgb = [255, 200, 120]) {
  return "#" + rgb.map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export default function DeviceBubble({ entity }) {
  const { updateEntity, deleteEntity, rooms, moveEntity } = useDomus();
  const [menu, setMenu] = useState(false);
  const Icon = iconMap[entity.icon] || Lightbulb;
  const s = entity.state || {};
  const isOn = !!s.on;
  const isDim = s.supports_dimming;
  const isColor = s.supports_color;
  const isScene = entity.type === "scene";
  const isAutomation = entity.type === "automation";
  const isPlug = entity.type === "plug";
  const isLight = entity.type === "light";
  const isThermo = entity.type === "thermostat";
  const glow = isOn && isLight && s.rgb ? rgbToHex(s.rgb) : (isOn ? "#f59e0b" : "transparent");

  const activate = async () => {
    if (isScene) {
      toast.success(`Scena "${entity.name}" attivata`);
      return;
    }
    if (isAutomation) {
      await updateEntity(entity.id, { state: { enabled: !s.enabled } });
      toast.info(`Automazione ${!s.enabled ? "attivata" : "disattivata"}`);
      return;
    }
    await updateEntity(entity.id, { state: { on: !isOn } });
  };

  return (
    <div
      className="relative glass rounded-3xl p-5 transition-all duration-300 hover:scale-[1.02] group"
      style={isOn && isLight ? { boxShadow: `0 0 40px -10px ${glow}, 0 8px 32px 0 rgba(15,23,42,0.12)` } : undefined}
      data-testid={`device-bubble-${entity.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <button
          onClick={activate}
          data-testid={`toggle-${entity.id}`}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
            isOn
              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md"
              : "bg-slate-200/70 dark:bg-slate-700/70 text-slate-500 dark:text-slate-300"
          }`}
        >
          <Icon size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" title={entity.name}>{entity.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {entity.integration}
          </div>
        </div>
        <div className="relative">
          <button
            data-testid={`menu-${entity.id}`}
            onClick={() => setMenu((v) => !v)}
            className="w-7 h-7 rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 flex items-center justify-center text-slate-500"
          >
            <MoreVertical size={16} />
          </button>
          {menu && (
            <div
              className="absolute right-0 top-9 z-30 w-56 glass-strong rounded-2xl p-2"
              onMouseLeave={() => setMenu(false)}
              data-testid={`menu-panel-${entity.id}`}
            >
              <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-widest text-slate-500">Sposta in stanza</div>
              <div className="max-h-52 overflow-y-auto">
                <button
                  className="w-full text-left px-2 py-1.5 rounded-xl text-xs hover:bg-white/70 dark:hover:bg-slate-700/60 flex items-center gap-2"
                  onClick={async () => { setMenu(false); await moveEntity(entity.id, null); toast.success("Spostata in Non assegnate"); }}
                  data-testid={`move-unassigned-${entity.id}`}
                >
                  <MoveRight size={14} /> Non assegnata
                </button>
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    className={`w-full text-left px-2 py-1.5 rounded-xl text-xs hover:bg-white/70 dark:hover:bg-slate-700/60 flex items-center gap-2 ${
                      r.id === entity.room_id ? "font-semibold" : ""
                    }`}
                    onClick={async () => { setMenu(false); await moveEntity(entity.id, r.id); toast.success(`Spostata in ${r.name}`); }}
                    data-testid={`move-to-${r.id}-${entity.id}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                    {r.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/40 dark:border-white/10 my-1" />
              <button
                className="w-full text-left px-2 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-500/10 flex items-center gap-2"
                onClick={async () => { setMenu(false); await deleteEntity(entity.id); toast.success("Dispositivo eliminato"); }}
                data-testid={`delete-${entity.id}`}
              >
                <Trash2 size={14} /> Elimina
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {isLight && isDim && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Luminosità</span>
            <span className="font-mono">{s.brightness ?? 0}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={s.brightness ?? 0}
            onChange={(e) => updateEntity(entity.id, { state: { brightness: parseInt(e.target.value, 10), on: true } })}
            className="slider-thumb w-full h-1.5 rounded-full appearance-none bg-gradient-to-r from-amber-200 to-orange-400"
            data-testid={`brightness-${entity.id}`}
          />
        </div>
      )}
      {isLight && isColor && (
        <div className="mt-3 flex items-center gap-2">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex-1">Colore</div>
          <input
            type="color"
            value={rgbToHex(s.rgb || [255, 200, 120])}
            onChange={(e) => updateEntity(entity.id, { state: { rgb: hexToRgb(e.target.value), on: true } })}
            className="w-9 h-9 rounded-full border-2 border-white shadow cursor-pointer bg-transparent"
            data-testid={`color-${entity.id}`}
          />
        </div>
      )}
      {isPlug && (
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-display font-bold">{(s.power_w ?? 0).toFixed(1)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Watt</div>
        </div>
      )}
      {isThermo && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-display font-bold">{s.current_temp?.toFixed(1)}°</div>
            <div className="text-xs text-slate-500">attuale</div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Target</span>
            <span className="font-mono">{s.target_temp?.toFixed(1)}°</span>
          </div>
          <input
            type="range" min="14" max="28" step="0.5" value={s.target_temp ?? 21}
            onChange={(e) => updateEntity(entity.id, { state: { target_temp: parseFloat(e.target.value) } })}
            className="slider-thumb w-full h-1.5 rounded-full appearance-none bg-gradient-to-r from-sky-200 to-rose-400"
            data-testid={`target-temp-${entity.id}`}
          />
        </div>
      )}
      {isScene && (
        <button
          onClick={activate}
          data-testid={`scene-activate-${entity.id}`}
          className="w-full mt-1 py-2 rounded-2xl bg-gradient-to-r from-amber-400/90 to-orange-500/90 text-white text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/30 transition-all"
        >
          Attiva scena
        </button>
      )}
      {isAutomation && (
        <div className="flex items-center justify-between mt-1">
          <div className="text-xs text-slate-500">{s.trigger}</div>
          <button
            onClick={activate}
            data-testid={`auto-toggle-${entity.id}`}
            className={`relative w-11 h-6 rounded-full transition-colors ${s.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${s.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
      )}
    </div>
  );
}
