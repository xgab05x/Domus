import { useEffect, useState } from "react";
import { X, MapPin, Sun, Moon, Sparkles, RefreshCw } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { toast } from "sonner";

export default function SettingsDialog({ open, onOpenChange }) {
  const { settings, updateSettings } = useDomus();
  const [local, setLocal] = useState(settings);

  useEffect(() => { setLocal(settings); }, [settings, open]);

  if (!open || !local) return null;

  const save = async (patch) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    await updateSettings(patch);
    toast.success("Impostazioni salvate");
  };

  const geocode = async () => {
    if (!local.address?.trim()) return;
    try {
      const q = encodeURIComponent(local.address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
      const res = await fetch(url, { headers: { "Accept-Language": "it" } });
      const arr = await res.json();
      if (arr && arr.length > 0) {
        const lat = parseFloat(arr[0].lat);
        const lon = parseFloat(arr[0].lon);
        await save({ latitude: lat, longitude: lon });
        toast.success(`Coordinate aggiornate: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
      } else {
        toast.error("Indirizzo non trovato");
      }
    } catch (e) {
      toast.error("Errore geocoding");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="settings-dialog">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative glass-strong rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 dark:border-white/10">
          <h3 className="font-display text-xl font-bold">Impostazioni Domus</h3>
          <button data-testid="close-settings" onClick={() => onOpenChange(false)} className="w-9 h-9 rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Home name */}
          <Section title="Nome casa">
            <input
              data-testid="home-name-input"
              value={local.home_name || ""}
              onChange={(e) => setLocal({ ...local, home_name: e.target.value })}
              onBlur={() => save({ home_name: local.home_name })}
              className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </Section>

          {/* Location */}
          <Section title="Posizione geografica" hint="Usata per calcolare alba/tramonto e cambiare l'atmosfera dell'app.">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  data-testid="address-input"
                  value={local.address || ""}
                  onChange={(e) => setLocal({ ...local, address: e.target.value })}
                  onBlur={() => save({ address: local.address })}
                  placeholder="Via, città, paese"
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  data-testid="geocode-btn"
                  onClick={geocode}
                  className="px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold flex items-center gap-1"
                >
                  <MapPin size={14} /> Geolocalizza
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Latitudine</div>
                  <input
                    type="number" step="0.0001"
                    data-testid="lat-input"
                    value={local.latitude ?? 0}
                    onChange={(e) => setLocal({ ...local, latitude: parseFloat(e.target.value) })}
                    onBlur={() => save({ latitude: local.latitude })}
                    className="w-full px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-amber-400 font-mono text-sm"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Longitudine</div>
                  <input
                    type="number" step="0.0001"
                    data-testid="lon-input"
                    value={local.longitude ?? 0}
                    onChange={(e) => setLocal({ ...local, longitude: parseFloat(e.target.value) })}
                    onBlur={() => save({ longitude: local.longitude })}
                    className="w-full px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-amber-400 font-mono text-sm"
                  />
                </label>
              </div>
            </div>
          </Section>

          {/* Dynamic colors */}
          <Section title="Colori dinamici" hint="Cambia i colori dell'interfaccia con la posizione del sole.">
            <ToggleRow
              testid="dynamic-colors-toggle"
              active={!!local.dynamic_colors}
              onClick={() => save({ dynamic_colors: !local.dynamic_colors })}
              iconOn={<Sparkles size={16} />}
              label={local.dynamic_colors ? "Attivi (alba / giorno / tramonto / notte)" : "Disattivati"}
            />
          </Section>

          {/* Theme mode */}
          <Section title="Tema">
            <div className="flex gap-2 flex-wrap">
              {[
                { k: "auto", l: "Automatico (segue sole)", icon: <Sparkles size={14} /> },
                { k: "light", l: "Chiaro", icon: <Sun size={14} /> },
                { k: "dark", l: "Scuro", icon: <Moon size={14} /> },
              ].map((o) => (
                <button
                  key={o.k}
                  data-testid={`theme-${o.k}`}
                  onClick={() => save({ theme_mode: o.k })}
                  className={`px-3.5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 border transition-all ${
                    local.theme_mode === o.k
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md"
                      : "bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {o.icon} {o.l}
                </button>
              ))}
            </div>
          </Section>

          {/* HA Integration status */}
          <Section title="Integrazioni Home Assistant (mock)">
            <div className="grid grid-cols-2 gap-2">
              {["Sonoff eWeLink", "Tuya Smart Life", "TP-Link Tapo", "Blink"].map((n) => (
                <div key={n} className="glass rounded-2xl px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{n}</span>
                  <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> collegato
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{title}</div>
      {hint && <div className="text-xs text-slate-500 mb-2">{hint}</div>}
      {children}
    </div>
  );
}

function ToggleRow({ active, onClick, label, iconOn, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className="w-full flex items-center justify-between glass rounded-2xl px-4 py-3 hover:scale-[1.01] transition"
    >
      <span className="flex items-center gap-2 text-sm">{iconOn} {label}</span>
      <span className={`relative w-11 h-6 rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${active ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
