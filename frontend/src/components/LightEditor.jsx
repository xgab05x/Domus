import { Palette, Plus, X, Power } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import ColorWheel from "@/components/ColorWheel";
import { useDomus } from "@/context/DomusContext";
import { useDebouncedCommit } from "@/hooks/useDebouncedCommit";
import { rgbToHex, kelvinToRgb } from "@/lib/color";

export default function LightEditor({ entity, open, onClose }) {
  if (!open || !entity) return null;
  return <Body entity={entity} onClose={onClose} />;
}

function Body({ entity, onClose }) {
  const { updateEntity, settings, updateSettings } = useDomus();
  const s = entity.state || {};
  const presets = settings?.color_presets || [];
  const rgb = s.rgb || [255, 200, 120];
  const [bri, setBri] = useDebouncedCommit(s.brightness ?? 100, (v) => updateEntity(entity.id, { state: { brightness: v, on: true } }));
  const [color, setColor] = useDebouncedCommit(rgb, (v) => updateEntity(entity.id, { state: { rgb: v, on: true } }), 120);
  const [kelvin, setKelvin] = useDebouncedCommit(s.color_temp ?? 3500, (v) => updateEntity(entity.id, { state: { color_temp: v, rgb: kelvinToRgb(v), on: true } }));
  const hex = rgbToHex(color);

  const addPreset = async () => {
    const name = window.prompt("Nome del preset colore");
    if (!name) return;
    await updateSettings({ color_presets: [...presets, { name, rgb: color }] });
    toast.success("Preset salvato");
  };
  const removePreset = async (i) => { await updateSettings({ color_presets: presets.filter((_, j) => j !== i) }); };

  return (
    <Modal open onClose={onClose} title={entity.name} subtitle="Dimmer, colore e preset" icon={<Palette size={18} />} testid="light-editor" width="max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full border border-white/70 shadow-inner transition-colors" style={{ background: s.on ? hex : "rgba(120,130,150,0.2)", opacity: s.on ? 0.35 + (bri / 100) * 0.65 : 1 }} data-testid="light-preview" />
        <div className="flex-1">
          <div className="label">Stato</div>
          <div className="text-sm font-semibold">{s.on ? `Accesa · ${bri}%` : "Spenta"}</div>
        </div>
        <button data-testid="light-editor-power" onClick={() => updateEntity(entity.id, { state: { on: !s.on } })} className={`icon-btn w-11 h-11 ${s.on ? "icon-on" : "icon-off"}`}>
          <Power size={18} />
        </button>
      </div>

      {s.supports_dimming && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted mb-2"><span>Luminosità</span><span className="font-mono">{bri}%</span></div>
          <input type="range" min="1" max="100" value={bri} onChange={(e) => setBri(parseInt(e.target.value, 10))} className="slider" style={{ "--fill": `${bri}%` }} data-testid="light-editor-brightness" />
        </div>
      )}

      {s.supports_color && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
            <ColorWheel rgb={color} onChange={setColor} size={210} testid="light-editor-wheel" />
            <div className="flex-1 w-full">
              <div className="label mb-2">Preset colore</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p, i) => (
                  <div key={`${p.name}-${i}`} className="relative group">
                    <button
                      onClick={() => setColor(p.rgb)} title={p.name} data-testid={`preset-color-${i}`}
                      className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${rgbToHex(p.rgb) === hex ? "border-slate-700 dark:border-white scale-110" : "border-white/80"}`}
                      style={{ background: rgbToHex(p.rgb) }}
                    />
                    <button onClick={() => removePreset(i)} aria-label="Rimuovi preset" data-testid={`preset-remove-${i}`} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-700 text-white hidden group-hover:flex items-center justify-center">
                      <X size={9} />
                    </button>
                  </div>
                ))}
                <button onClick={addPreset} data-testid="preset-add" className="w-9 h-9 rounded-full btn-ghost flex items-center justify-center" title="Salva colore attuale come preset">
                  <Plus size={15} />
                </button>
              </div>
              <div className="text-[11px] text-muted mt-3">Colore attuale <span className="font-mono">{hex}</span></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-muted mb-2"><span>Temperatura colore</span><span className="font-mono">{kelvin}K</span></div>
            <input
              type="range" min="2000" max="6500" step="50" value={kelvin} onChange={(e) => setKelvin(parseInt(e.target.value, 10))}
              className="slider" data-testid="light-editor-kelvin"
              style={{ background: "linear-gradient(90deg, #ffb46b, #fff1dc, #cfe0ff)" }}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
