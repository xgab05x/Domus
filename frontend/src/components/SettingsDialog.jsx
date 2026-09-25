import { useEffect, useState } from "react";
import { MapPin, Sun, Moon, Sparkles, Settings as SettingsIcon, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning, Wand2, X, Plus, Image as ImageIcon, Cpu, HardDrive, AlertTriangle, Home } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import ColorWheel from "@/components/ColorWheel";
import HASettings from "@/components/HASettings";
import BackupSettings from "@/components/BackupSettings";
import ProblemsSection from "@/components/ProblemsSection";
import { useDomus } from "@/context/DomusContext";
import { rgbToHex } from "@/lib/color";

const WEATHER = [
  { k: "auto", l: "Automatico", I: Wand2 }, { k: "clear", l: "Sereno", I: Sun }, { k: "clouds", l: "Nuvoloso", I: Cloud },
  { k: "fog", l: "Nebbia", I: CloudFog }, { k: "rain", l: "Pioggia", I: CloudRain }, { k: "snow", l: "Neve", I: CloudSnow }, { k: "storm", l: "Temporale", I: CloudLightning },
];
const TABS = [{ k: "general", l: "Casa", I: Home }, { k: "ha", l: "Home Assistant", I: Cpu }, { k: "backup", l: "Backup", I: HardDrive }, { k: "problems", l: "Problemi", I: AlertTriangle }];

export default function SettingsDialog({ open, onOpenChange, initialTab = "general" }) {
  const { settings, weather, updateSettings, refresh, ha, notifications, entities } = useDomus();
  const [local, setLocal] = useState(settings);
  const [newPreset, setNewPreset] = useState({ name: "", rgb: [255, 200, 120] });
  const [showWheel, setShowWheel] = useState(false);
  const [tab, setTab] = useState(initialTab);

  useEffect(() => { setLocal(settings); }, [settings, open]);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  if (!open || !local) return null;
  const problems = entities.filter((e) => e.available === false).length + notifications.filter((n) => !n.read && (n.level === "warning" || n.level === "error")).length;

  const save = async (patch, silent = false) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    await updateSettings(patch);
    if (!silent) toast.success("Impostazioni salvate");
  };

  const geocode = async () => {
    if (!local.address?.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(local.address)}`, { headers: { "Accept-Language": "it" } });
      const arr = await res.json();
      if (arr?.length) {
        const lat = parseFloat(arr[0].lat), lon = parseFloat(arr[0].lon);
        await save({ latitude: lat, longitude: lon, address: local.address }, true);
        await refresh();
        toast.success(`Coordinate aggiornate: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
      } else toast.error("Indirizzo non trovato");
    } catch { toast.error("Errore geocoding"); }
  };

  const presets = local.color_presets || [];
  const addPreset = async () => {
    if (!newPreset.name.trim()) return toast.error("Dai un nome al preset");
    await save({ color_presets: [...presets, { name: newPreset.name.trim(), rgb: newPreset.rgb }] });
    setNewPreset({ name: "", rgb: newPreset.rgb }); setShowWheel(false);
  };

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="Impostazioni Domus" subtitle="Casa, Home Assistant, backup e stato dei dispositivi" icon={<SettingsIcon size={18} />} testid="settings-dialog" width="max-w-3xl">
      <div className="flex items-center gap-1 p-1 rounded-full glass-inner mb-6 flex-wrap" data-testid="settings-tabs">
        {TABS.map(({ k, l, I }) => (
          <button key={k} onClick={() => setTab(k)} className={`chip !py-1.5 relative ${tab === k ? "chip-active" : "!bg-transparent !border-transparent"}`} data-testid={`settings-tab-${k}`}>
            <I size={13} /> {l}
            {k === "ha" && <span className={`w-1.5 h-1.5 rounded-full ${ha?.connected ? "bg-emerald-500" : "bg-slate-400"}`} />}
            {k === "problems" && problems > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="settings-problems-badge">{problems}</span>}
          </button>
        ))}
      </div>
      {tab === "ha" && <HASettings />}
      {tab === "backup" && <BackupSettings />}
      {tab === "problems" && <ProblemsSection />}
      {tab === "general" && <div className="space-y-7">
        <Section title="Nome casa">
          <input data-testid="home-name-input" className="field" value={local.home_name || ""} onChange={(e) => setLocal({ ...local, home_name: e.target.value })} onBlur={() => save({ home_name: local.home_name })} />
        </Section>

        <Section title="Posizione geografica" hint="Usata per alba/tramonto e per il meteo reale che anima lo sfondo.">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input data-testid="address-input" className="field flex-1" value={local.address || ""} onChange={(e) => setLocal({ ...local, address: e.target.value })} onBlur={() => save({ address: local.address }, true)} placeholder="Via, città, paese" />
              <button data-testid="geocode-btn" onClick={geocode} className="btn-acc px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-1 shrink-0"><MapPin size={14} /> Geolocalizza</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><div className="label mb-1">Latitudine</div>
                <input type="number" step="0.0001" data-testid="lat-input" className="field font-mono" value={local.latitude ?? 0} onChange={(e) => setLocal({ ...local, latitude: parseFloat(e.target.value) })} onBlur={() => save({ latitude: local.latitude })} /></label>
              <label className="block"><div className="label mb-1">Longitudine</div>
                <input type="number" step="0.0001" data-testid="lon-input" className="field font-mono" value={local.longitude ?? 0} onChange={(e) => setLocal({ ...local, longitude: parseFloat(e.target.value) })} onBlur={() => save({ longitude: local.longitude })} /></label>
            </div>
          </div>
        </Section>

        <Section title="Atmosfera" hint="Lo sfondo segue il sole (alba, giorno, tramonto, cielo stellato) e il meteo (nuvole, pioggia sul vetro, neve, nebbia, temporale).">
          <button data-testid="dynamic-colors-toggle" onClick={() => save({ dynamic_colors: !local.dynamic_colors })} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between mb-3">
            <span className="text-sm flex items-center gap-2"><Sparkles size={15} /> Sfondo dinamico {local.dynamic_colors ? "attivo" : "disattivato"}</span>
            <span className={`toggle ${local.dynamic_colors ? "on" : ""}`} />
          </button>
          <div className="label mb-1.5">Tema</div>
          <div className="flex gap-2 flex-wrap mb-4">
            {[{ k: "auto", l: "Automatico (segue il sole)", I: Sparkles }, { k: "light", l: "Chiaro", I: Sun }, { k: "dark", l: "Scuro", I: Moon }].map(({ k, l, I }) => (
              <button key={k} data-testid={`theme-${k}`} onClick={() => save({ theme_mode: k })} className={`chip ${local.theme_mode === k ? "chip-active" : ""}`}><I size={13} /> {l}</button>
            ))}
          </div>
          <div className="label mb-1.5">Meteo sfondo {weather?.source === "open-meteo" && <span className="normal-case tracking-normal font-normal">· rilevato: {weather.condition}{weather.temperature != null ? `, ${Math.round(weather.temperature)}°C` : ""}</span>}</div>
          <div className="flex gap-2 flex-wrap">
            {WEATHER.map(({ k, l, I }) => (
              <button key={k} data-testid={`weather-${k}`} onClick={async () => { await save({ weather_override: k }, true); await refresh(); }} className={`chip ${(local.weather_override || "auto") === k ? "chip-active" : ""}`}><I size={13} /> {l}</button>
            ))}
          </div>
        </Section>

        <Section title="Preset colore luci" hint="Le tinte rapide mostrate su ogni luce e nell'editor scene.">
          <div className="flex flex-wrap gap-2 mb-3">
            {presets.map((p, i) => (
              <div key={`${p.name}-${i}`} className="glass-inner rounded-full pl-1 pr-2 py-1 flex items-center gap-2 text-xs" data-testid={`settings-preset-${i}`}>
                <span className="w-6 h-6 rounded-full border border-white/70" style={{ background: rgbToHex(p.rgb) }} />
                <span className="font-medium">{p.name}</span>
                <button onClick={() => save({ color_presets: presets.filter((_, j) => j !== i) })} className="text-muted hover:text-rose-600" data-testid={`settings-preset-remove-${i}`} aria-label="Rimuovi"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowWheel((v) => !v)} className="w-9 h-9 rounded-full border-2 border-white/80 shadow" style={{ background: rgbToHex(newPreset.rgb) }} data-testid="settings-preset-wheel-toggle" aria-label="Scegli colore" />
            <input className="field !w-48" placeholder="Nome preset" value={newPreset.name} onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })} data-testid="settings-preset-name" />
            <button onClick={addPreset} className="btn-acc px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-1" data-testid="settings-preset-add"><Plus size={14} /> Aggiungi</button>
          </div>
          {showWheel && <div className="mt-3"><ColorWheel size={180} rgb={newPreset.rgb} onChange={(rgb) => setNewPreset({ ...newPreset, rgb })} testid="settings-preset-wheel" /></div>}
        </Section>

        <Section title="Loghi e media" hint="Metti i file in /public/brand/ e compariranno automaticamente.">
          <div className="glass-inner rounded-2xl p-3 text-xs space-y-1 font-mono">
            <div className="flex items-center gap-2 text-muted"><ImageIcon size={12} /> domus.png · sol.png · terminus.png (loghi)</div>
            <div className="flex items-center gap-2 text-muted"><ImageIcon size={12} /> sol-banner.webp · terminus-banner.webp (banner animati)</div>
          </div>
        </Section>
      </div>}
    </Modal>
  );
}

function Section({ title, hint, children }) {
  return (
    <div>
      <div className="label mb-1.5">{title}</div>
      {hint && <p className="text-xs text-muted mb-2.5">{hint}</p>}
      {children}
    </div>
  );
}
