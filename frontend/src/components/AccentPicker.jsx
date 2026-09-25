import ColorWheel from "@/components/ColorWheel";
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from "@/lib/color";

// Ruota colori (come per le luci) per scegliere il colore di tasti e grafiche di una sezione.
export default function AccentPicker({ label, value, def, onChange, testid }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || "") ? value : def;
  const rgb = hexToRgb(hex);
  const { h, s, v } = rgbToHsv(rgb);
  const wheelRgb = hsvToRgb(h, s, 1);
  const lum = Math.round(v * 100);

  const setHueSat = (picked) => {
    const hs = rgbToHsv(picked);
    onChange(rgbToHex(hsvToRgb(hs.h, hs.s, Math.max(0.2, v))));
  };
  const setLum = (pct) => onChange(rgbToHex(hsvToRgb(h, s, Math.max(0.2, pct / 100))));

  return (
    <div className="glass-inner rounded-[24px] p-4 flex flex-col items-center gap-3" data-testid={`${testid}-card`}>
      <div className="flex items-center gap-2 self-stretch">
        <span className="w-7 h-7 rounded-full border border-white/60 shrink-0" style={{ background: hex }} data-testid={`${testid}-swatch`} />
        <span className="text-sm font-semibold flex-1 truncate">{label}</span>
        <button onClick={() => onChange(def)} className="chip !py-1.5" data-testid={`${testid}-reset`}>Reset</button>
      </div>
      <ColorWheel rgb={wheelRgb} onChange={setHueSat} size={170} testid={`${testid}-wheel`} />
      <div className="self-stretch">
        <div className="flex items-center justify-between text-[11px] text-muted mb-1"><span>Luminosità</span><span className="font-mono">{lum}%</span></div>
        <input type="range" min="20" max="100" value={lum} onChange={(e) => setLum(parseInt(e.target.value, 10))}
          className="slider" style={{ "--fill": `${lum}%` }} data-testid={`${testid}-lum`} />
      </div>
      <input className="field font-mono text-center self-stretch" value={hex} onChange={(e) => onChange(e.target.value)} data-testid={`${testid}-hex`} />
    </div>
  );
}
