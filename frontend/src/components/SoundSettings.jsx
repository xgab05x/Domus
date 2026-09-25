import { useRef, useState } from "react";
import { Bell, Siren, Volume2, Upload, Trash2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { SoundsAPI } from "@/lib/api";
import { RINGTONES, SIRENS, playSound, stopSound } from "@/lib/sounds";

const MUTE_KEY = "domus_mute_alerts";

// Impostazioni → Avvisi: pop-up citofono/allarme, suonerie, sirene, volume, durata e MP3 personalizzati.
export default function SoundSettings() {
  const { settings, updateSettings, refresh } = useDomus();
  const [muted, setMuted] = useState(localStorage.getItem(MUTE_KEY) === "1");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const custom = settings?.custom_sounds || [];

  const save = async (patch) => { await updateSettings(patch); };
  const preview = (id, volume, duration) => playSound(id, { volume, duration: Math.min(duration || 4, 5), custom });

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { await SoundsAPI.upload(f); await refresh(); toast.success("Suoneria caricata"); }
    catch (err) { toast.error(err?.response?.data?.detail || "Caricamento non riuscito"); }
    setBusy(false); e.target.value = "";
  };
  const removeSound = async (id) => { await SoundsAPI.remove(id); await refresh(); toast.success("Suoneria rimossa"); };

  return (
    <div className="space-y-7" data-testid="sound-settings">
      <Block icon={<Bell size={20} />} title="Quando suonano (citofono e campanelli)"
        enabled={settings?.intercom_popup !== false} onToggle={() => save({ intercom_popup: !(settings?.intercom_popup !== false) })} testid="intercom-popup-toggle">
        <SoundPicker label="Suoneria" value={settings?.intercom_sound || "ding_dong"} custom={custom} onChange={(v) => save({ intercom_sound: v })} testid="intercom-sound" />
        <Slider label="Volume" value={settings?.intercom_volume ?? 70} min={0} max={100} unit="%" onChange={(v) => save({ intercom_volume: v })} testid="intercom-volume" />
        <Slider label="Durata squillo" value={settings?.intercom_duration ?? 15} min={2} max={60} unit="s" onChange={(v) => save({ intercom_duration: v })} testid="intercom-duration" />
        <button onMouseDown={() => preview(settings?.intercom_sound || "ding_dong", settings?.intercom_volume ?? 70, 4)} onMouseUp={stopSound} className="chip" data-testid="intercom-sound-test"><Play size={12} /> Prova suoneria</button>
      </Block>

      <Block icon={<Siren size={20} />} title="Quando scatta l'allarme"
        enabled={settings?.alarm_popup !== false} onToggle={() => save({ alarm_popup: !(settings?.alarm_popup !== false) })} testid="alarm-popup-toggle">
        <SoundPicker label="Sirena" value={settings?.alarm_sound || "siren_classic"} custom={custom} sirens onChange={(v) => save({ alarm_sound: v })} testid="alarm-sound" />
        <Slider label="Volume" value={settings?.alarm_volume ?? 85} min={0} max={100} unit="%" onChange={(v) => save({ alarm_volume: v })} testid="alarm-volume" />
        <Slider label="Durata sirena" value={settings?.alarm_duration ?? 30} min={5} max={300} unit="s" onChange={(v) => save({ alarm_duration: v })} testid="alarm-duration" />
        <button onMouseDown={() => preview(settings?.alarm_sound || "siren_classic", settings?.alarm_volume ?? 85, 4)} onMouseUp={stopSound} className="chip" data-testid="alarm-sound-test"><Play size={12} /> Prova sirena</button>
      </Block>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="label">Le tue suonerie MP3 ({custom.length})</div>
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="chip" data-testid="sound-upload"><Upload size={12} /> {busy ? "Carico…" : "Carica MP3"}</button>
          <input ref={fileRef} type="file" accept="audio/*" onChange={upload} className="hidden" data-testid="sound-file-input" />
        </div>
        <div className="space-y-1.5">
          {custom.map((c) => (
            <div key={c.id} className="glass-inner rounded-2xl px-4 py-2.5 flex items-center gap-2" data-testid={`custom-sound-${c.id}`}>
              <Volume2 size={14} className="text-muted shrink-0" />
              <span className="text-sm truncate flex-1">{c.name}</span>
              <button onMouseDown={() => playSound(c.id, { volume: 80, duration: 5, custom })} onMouseUp={stopSound} className="chip !py-1 shrink-0"><Play size={11} /></button>
              <button onClick={() => removeSound(c.id)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted shrink-0" data-testid={`custom-sound-remove-${c.id}`}><Trash2 size={13} /></button>
            </div>
          ))}
          {custom.length === 0 && <p className="text-[11px] text-muted">Carica un MP3 (max 6 MB) per usarlo come suoneria o sirena.</p>}
        </div>
      </div>

      <button onClick={() => { const v = !muted; setMuted(v); localStorage.setItem(MUTE_KEY, v ? "1" : "0"); stopSound(); }}
        className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between press" data-testid="mute-this-device">
        <span className="text-sm flex items-center gap-2"><Square size={14} /> Silenzia gli avvisi solo su questo dispositivo<span className="block text-[11px] text-muted mt-0.5">I pop-up restano, l'audio no</span></span>
        <span className={`toggle shrink-0 ${muted ? "on" : ""}`} />
      </button>
    </div>
  );
}

function Block({ icon, title, enabled, onToggle, children, testid }) {
  return (
    <div>
      <button onClick={onToggle} className="w-full glass-inner rounded-3xl px-4 py-3 flex items-center gap-3 press mb-3" data-testid={testid} aria-pressed={enabled}>
        <span className={`icon-btn w-10 h-10 shrink-0 ${enabled ? "icon-on" : "icon-off"}`}>{icon}</span>
        <span className="min-w-0 flex-1 text-left"><span className="block text-sm font-semibold truncate">{title}</span><span className="block text-[11px] text-muted">{enabled ? "Finestra e audio attivi" : "Disattivato"}</span></span>
        <span className={`toggle shrink-0 ${enabled ? "on" : ""}`} />
      </button>
      {enabled && <div className="space-y-3 pl-1">{children}</div>}
    </div>
  );
}

function SoundPicker({ label, value, onChange, custom, sirens, testid }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}>
        <optgroup label={sirens ? "Sirene" : "Suonerie"}>{(sirens ? SIRENS : RINGTONES).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
        <optgroup label={sirens ? "Suonerie" : "Sirene"}>{(sirens ? RINGTONES : SIRENS).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
        {custom?.length > 0 && <optgroup label="I tuoi MP3">{custom.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
      </select>
    </div>
  );
}

function Slider({ label, value, min, max, unit, onChange, testid }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted mb-1"><span>{label}</span><span className="font-mono">{value}{unit}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="slider" style={{ "--fill": `${((value - min) / (max - min)) * 100}%` }} data-testid={testid} />
    </div>
  );
}
