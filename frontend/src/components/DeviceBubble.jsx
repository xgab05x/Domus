import { useState } from "react";
import { MoreVertical, MoveRight, Trash2, Palette, Link2, Flame, Snowflake, AlertTriangle, Shapes } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { useDebouncedCommit } from "@/hooks/useDebouncedCommit";
import { iconFor } from "@/lib/icons";
import { rgbToHex } from "@/lib/color";
import TempDial from "@/components/TempDial";
import LightEditor from "@/components/LightEditor";
import IconPicker from "@/components/IconPicker";

export default function DeviceBubble({ entity }) {
  const { updateEntity, deleteEntity, rooms, moveEntity, groups, settings } = useDomus();
  const [menu, setMenu] = useState(false);
  const [editor, setEditor] = useState(false);
  const [picker, setPicker] = useState(false);
  const Icon = iconFor(entity.icon);
  const s = entity.state || {};
  const isOn = !!s.on;
  const type = entity.type;
  const isLight = type === "light", isPlug = type === "plug", isSwitch = type === "switch", isMeter = type === "meter", isThermo = type === "thermostat", isSensor = type === "sensor", isAuto = type === "automation";
  const linked = groups.some((g) => g.kind === "sync" && g.members.includes(entity.id));
  const offline = entity.available === false;
  const showOnline = settings?.show_online_status !== false && !isAuto;
  const tint = isOn && isLight && s.rgb ? rgbToHex(s.rgb) : null;
  const presets = (settings?.color_presets || []).slice(0, 5);

  const [bri, setBri] = useDebouncedCommit(s.brightness ?? 0, (v) => updateEntity(entity.id, { state: { brightness: v, on: true } }));
  const [target, setTarget] = useDebouncedCommit(s.target_temp ?? 21, (v) => updateEntity(entity.id, { state: { target_temp: v } }));

  const toggle = async () => {
    if (isAuto) { await updateEntity(entity.id, { state: { enabled: !s.enabled } }); return; }
    if (isSensor) return;
    await updateEntity(entity.id, { state: { on: !isOn } });
  };

  return (
    <div
      className={`relative glass rounded-[28px] p-4 bubble ${offline ? "ring-1 ring-amber-400/60" : ""}`}
      style={tint ? { boxShadow: `inset 0 0 0 1px ${tint}44, 0 14px 34px -22px ${tint}` } : undefined}
      data-testid={`device-bubble-${entity.id}`}
      data-offline={offline || undefined}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={toggle} data-testid={`toggle-${entity.id}`} aria-pressed={isOn}
          className={`icon-btn press w-11 h-11 shrink-0 ${isOn || (isAuto && s.enabled) ? "icon-on glow-on" : "icon-off"} ${offline ? "opacity-60" : ""}`}
          style={tint ? { background: `${tint}55` } : undefined}
        >
          <Icon key={isOn ? "on" : "off"} size={19} className="pop-in" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" title={entity.name}>{entity.name}</div>
          <div className="label flex items-center gap-1.5 mt-0.5 flex-wrap">
            {offline ? (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 normal-case tracking-normal font-semibold" data-testid={`offline-badge-${entity.id}`}><AlertTriangle size={11} /> offline</span>
            ) : (
              <>
                {showOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="online" data-testid={`online-dot-${entity.id}`} />}
                <span>{entity.integration}</span>
              </>
            )}
            {linked && <span className="badge flex items-center gap-1" data-testid={`linked-badge-${entity.id}`}><Link2 size={9} /> collegato</span>}
          </div>
        </div>
        <div className="relative">
          <button data-testid={`menu-${entity.id}`} onClick={() => setMenu((v) => !v)} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted">
            <MoreVertical size={15} />
          </button>
          {menu && (
            <div className="absolute right-0 top-9 z-30 w-56 glass-strong rounded-2xl p-2" onMouseLeave={() => setMenu(false)} data-testid={`menu-panel-${entity.id}`}>
              {isLight && (s.supports_color || s.supports_dimming) && (
                <button className="w-full text-left px-2 py-1.5 rounded-xl text-xs hover:bg-white/60 dark:hover:bg-white/10 flex items-center gap-2" onClick={() => { setMenu(false); setEditor(true); }} data-testid={`edit-light-${entity.id}`}>
                  <Palette size={14} /> Dimmer & colore
                </button>
              )}
              <button className="w-full text-left px-2 py-1.5 rounded-xl text-xs hover:bg-white/60 dark:hover:bg-white/10 flex items-center gap-2" onClick={() => { setMenu(false); setPicker(true); }} data-testid={`change-icon-${entity.id}`}>
                <Shapes size={14} /> Cambia icona
              </button>
              <div className="px-2 pt-1 pb-1 label">Sposta in stanza</div>
              <div className="max-h-52 overflow-y-auto">
                <button className="w-full text-left px-2 py-1.5 rounded-xl text-xs hover:bg-white/60 dark:hover:bg-white/10 flex items-center gap-2" onClick={async () => { setMenu(false); await moveEntity(entity.id, null); toast.success("Spostata in Non assegnate"); }} data-testid={`move-unassigned-${entity.id}`}>
                  <MoveRight size={14} /> Non assegnata
                </button>
                {rooms.map((r) => (
                  <button key={r.id} className={`w-full text-left px-2 py-1.5 rounded-xl text-xs hover:bg-white/60 dark:hover:bg-white/10 flex items-center gap-2 ${r.id === entity.room_id ? "font-semibold" : ""}`} onClick={async () => { setMenu(false); await moveEntity(entity.id, r.id); toast.success(`Spostata in ${r.name}`); }} data-testid={`move-to-${r.id}-${entity.id}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color }} /> {r.name}
                  </button>
                ))}
              </div>
              <div className="divider my-1" />
              <button className="w-full text-left px-2 py-1.5 rounded-xl text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2" onClick={async () => { setMenu(false); await deleteEntity(entity.id); toast.success("Dispositivo eliminato"); }} data-testid={`delete-${entity.id}`}>
                <Trash2 size={14} /> Elimina
              </button>
            </div>
          )}
        </div>
      </div>

      {isLight && s.supports_dimming && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted mb-1.5"><span>Luminosità</span><span className="font-mono">{bri}%</span></div>
          <input type="range" min="1" max="100" value={bri} onChange={(e) => setBri(parseInt(e.target.value, 10))} className="slider" style={{ "--fill": `${bri}%` }} data-testid={`brightness-${entity.id}`} />
        </div>
      )}
      {isLight && s.supports_color && (
        <div className="mt-3 flex items-center gap-1.5">
          {presets.map((p, i) => (
            <button key={`${p.name}-${i}`} title={p.name} onClick={() => updateEntity(entity.id, { state: { rgb: p.rgb, on: true } })} data-testid={`quick-color-${entity.id}-${i}`}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${rgbToHex(p.rgb) === (s.rgb ? rgbToHex(s.rgb) : "") ? "border-slate-700 dark:border-white scale-110" : "border-white/80"}`}
              style={{ background: rgbToHex(p.rgb) }} />
          ))}
          <button onClick={() => setEditor(true)} className="ml-auto chip !py-1 !px-2.5" data-testid={`open-light-editor-${entity.id}`}><Palette size={12} /> Colore</button>
        </div>
      )}
      {isLight && !s.supports_color && !s.supports_dimming && <div className="mt-3 text-xs text-muted">{isOn ? "Accesa" : "Spenta"}</div>}
      {isSwitch && <div className="mt-3 text-xs text-muted">{isOn ? "Acceso" : "Spento"}</div>}
      {(isPlug || isMeter) && (
        <div className="mt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold" data-testid={`power-${entity.id}`}>{(s.power_w ?? 0).toFixed(isMeter ? 0 : 1)}</span>
            <span className="text-xs text-muted">W</span>
            {s.voltage_v != null && <span className="ml-auto text-[11px] font-mono text-muted" data-testid={`meter-va-${entity.id}`}>{Number(s.current_a ?? 0).toFixed(2)} A · {Number(s.voltage_v).toFixed(0)} V</span>}
          </div>
          {s.energy_kwh != null && <div className="text-[10px] text-muted mt-0.5">{Number(s.energy_kwh).toFixed(1)} kWh totali{s.nominal_w ? ` · nominale ${s.nominal_w} W` : ""}</div>}
        </div>
      )}
      {isThermo && (
        <div className="mt-2 flex items-center gap-3">
          <TempDial size={120} value={target} current={s.current_temp} mode={s.mode || "heat"} active={isOn} onChange={setTarget} testid={`dial-${entity.id}`} />
          <div className="text-xs space-y-1.5 min-w-0">
            <div className="badge inline-flex items-center gap-1">{s.mode === "cool" ? <Snowflake size={10} /> : <Flame size={10} />} {s.mode === "cool" ? "Freddo" : "Caldo"}</div>
            <div className="text-muted">{isOn ? "In funzione" : "Spento"}</div>
          </div>
        </div>
      )}
      {isSensor && (
        <div className="mt-3 flex gap-5">
          <div><div className="font-display text-2xl font-semibold">{s.temperature != null ? Number(s.temperature).toFixed(1) : "--"}°</div><div className="text-[10px] text-muted">temperatura</div></div>
          {s.humidity != null && <div><div className="font-display text-2xl font-semibold">{s.humidity}%</div><div className="text-[10px] text-muted">umidità</div></div>}
        </div>
      )}
      {isAuto && (
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted">trigger: {s.trigger}</div>
          <button onClick={toggle} data-testid={`auto-toggle-${entity.id}`} className={`toggle ${s.enabled ? "on" : ""}`} aria-label="Attiva automazione" />
        </div>
      )}

      <LightEditor entity={entity} open={editor} onClose={() => setEditor(false)} />
      <IconPicker open={picker} onClose={() => setPicker(false)} value={entity.icon} onChange={async (icon) => { await updateEntity(entity.id, { icon }); toast.success("Icona aggiornata"); }} title={`Icona per ${entity.name}`} />
    </div>
  );
}
