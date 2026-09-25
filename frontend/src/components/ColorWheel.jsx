import { useRef, useState } from "react";
import { rgbToHsv, hsvToRgb, rgbToHex } from "@/lib/color";

export default function ColorWheel({ rgb = [255, 200, 120], onChange, size = 220, testid = "color-wheel" }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const { h, s } = rgbToHsv(rgb);
  const R = size / 2;
  const knob = 22;
  const reach = R - knob / 2 - 2;
  const rad = (h * Math.PI) / 180;
  const px = R + Math.cos(rad) * s * reach;
  const py = R + Math.sin(rad) * s * reach;

  const pick = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - rect.left - R;
    const dy = e.clientY - rect.top - R;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    const dist = Math.min(1, Math.hypot(dx, dy) / reach);
    onChange(hsvToRgb(ang, dist, 1));
  };

  return (
    <div
      ref={ref}
      data-testid={testid}
      className="relative rounded-full select-none touch-none cursor-crosshair shrink-0"
      style={{
        width: size, height: size,
        background: "conic-gradient(from 90deg, #ff4d4d, #ffd24d, #7dff4d, #4dfff0, #4d7dff, #e64dff, #ff4d4d)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6), 0 12px 32px -14px rgba(0,0,0,0.35)",
      }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); pick(e); }}
      onPointerMove={(e) => drag && pick(e)}
      onPointerUp={(e) => { setDrag(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => setDrag(false)}
    >
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle closest-side, #fff 0%, rgba(255,255,255,0.9) 12%, rgba(255,255,255,0) 100%)" }} />
      <div
        className="absolute rounded-full border-2 border-white pointer-events-none"
        style={{ width: knob, height: knob, left: px - knob / 2, top: py - knob / 2, background: rgbToHex(rgb), boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
        data-testid={`${testid}-knob`}
      />
    </div>
  );
}
